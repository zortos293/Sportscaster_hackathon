const CURSOR_API_BASE = "https://api.cursor.com/v1";

const WEBHOOK_MOMENT_TYPES = new Set(["opening", "score", "key_play", "period"]);

/** Each webhook starts a cloud agent — cap frequency to avoid resource_exhausted. */
let lastWebhookAt = 0;
let webhookCooldownUntil = 0;
let webhookInFlight = false;

function webhookMinIntervalMs(): number {
  const seconds = Number.parseInt(
    process.env.CURSOR_AUTOMATION_WEBHOOK_MIN_INTERVAL_SECONDS ?? "90",
    10,
  );
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 90_000;
}

function webhookCooldownMs(): number {
  const seconds = Number.parseInt(
    process.env.CURSOR_AUTOMATION_WEBHOOK_COOLDOWN_SECONDS ?? "300",
    10,
  );
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 300_000;
}

export type WebhookTriggerResult =
  | { status: "triggered" }
  | { status: "skipped"; reason: string }
  | { status: "failed"; error: string };

export function shouldTriggerAutomationWebhook(momentType: string): boolean {
  return WEBHOOK_MOMENT_TYPES.has(momentType);
}

/** Users often paste the full "Authorization: Bearer crsr_..." header from the dashboard. */
export function normalizeCursorAutomationToken(raw: string | undefined): string | undefined {
  if (!raw) return undefined;

  let token = raw.trim();
  const hashIndex = token.indexOf("#");
  if (hashIndex >= 0) {
    token = token.slice(0, hashIndex).trim();
  }

  if (/^authorization:/i.test(token)) {
    token = token.replace(/^authorization:\s*/i, "");
  }
  if (/^bearer\s+/i.test(token)) {
    token = token.replace(/^bearer\s+/i, "");
  }

  return token || undefined;
}

export type CursorCommentaryOptions = {
  apiKey: string;
  systemPrompt: string;
  userPrompt: string;
  model?: string;
  agentId?: string;
  timeoutMs?: number;
};

export type CursorCommentaryResult = {
  text: string;
  agentId: string;
  runId: string;
  source: "cursor";
};

type CursorRun = {
  id: string;
  agentId: string;
  status: string;
  result?: string;
};

type CursorAgentResponse = {
  agent: { id: string };
  run: CursorRun;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** Serialize Cloud Agent calls — parallel requests spawn multiple agents and hit plan limits. */
let commentaryQueue: Promise<unknown> = Promise.resolve();
let lastCursorApiCallAt = 0;
let cursorApiCooldownUntil = 0;

function cursorMinIntervalMs(): number {
  const ms = Number.parseInt(process.env.CURSOR_API_MIN_INTERVAL_MS ?? "2000", 10);
  return Number.isFinite(ms) && ms > 0 ? ms : 2000;
}

function cursorRateLimitCooldownMs(): number {
  const seconds = Number.parseInt(process.env.CURSOR_API_COOLDOWN_SECONDS ?? "60", 10);
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 60_000;
}

function isCursorRateLimitError(message: string): boolean {
  return /rate_limit|429|100 requests per minute/i.test(message);
}

function isCursorAgentLimitError(message: string): boolean {
  return /validation_error|cloud agents|reached the limit|upgrade to ultra/i.test(message);
}

async function withCommentaryQueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = async (): Promise<T> => {
    const now = Date.now();
    if (now < cursorApiCooldownUntil) {
      await sleep(cursorApiCooldownUntil - now);
    }

    const gap = Date.now() - lastCursorApiCallAt;
    const minGap = cursorMinIntervalMs();
    if (gap < minGap) {
      await sleep(minGap - gap);
    }

    lastCursorApiCallAt = Date.now();
    return fn();
  };

  const task = commentaryQueue.then(run, run);
  commentaryQueue = task.then(
    () => undefined,
    () => undefined,
  );
  return task;
}

function buildPrompt(systemPrompt: string, userPrompt: string): string {
  return `${systemPrompt}

---

${userPrompt}

---

Reply with ONLY the spoken broadcast line — no quotes, labels, markdown, or explanation.`;
}

async function cursorFetch<T>(
  apiKey: string,
  path: string,
  init?: RequestInit,
  attempt = 0,
): Promise<T> {
  const auth = Buffer.from(`${apiKey}:`).toString("base64");
  const response = await fetch(`${CURSOR_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    if (response.status === 429 && attempt < 3) {
      cursorApiCooldownUntil = Date.now() + cursorRateLimitCooldownMs();
      await sleep(2000 * (attempt + 1));
      return cursorFetch<T>(apiKey, path, init, attempt + 1);
    }
    throw new Error(`Cursor API ${response.status}: ${body.slice(0, 400)}`);
  }

  return response.json() as Promise<T>;
}

async function waitForRun(
  apiKey: string,
  agentId: string,
  runId: string,
  timeoutMs: number,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const run = await cursorFetch<CursorRun>(
      apiKey,
      `/agents/${agentId}/runs/${runId}`,
    );

    if (run.status === "FINISHED" && run.result?.trim()) {
      return run.result.trim();
    }

    if (run.status === "ERROR" || run.status === "CANCELLED" || run.status === "EXPIRED") {
      throw new Error(`Cursor run ${run.status.toLowerCase()}`);
    }

    await sleep(800);
  }

  throw new Error("Cursor commentary timed out");
}

export async function generateCursorCommentary(
  options: CursorCommentaryOptions,
): Promise<CursorCommentaryResult> {
  return withCommentaryQueue(() => generateCursorCommentaryInner(options));
}

async function generateCursorCommentaryInner(
  options: CursorCommentaryOptions,
): Promise<CursorCommentaryResult> {
  const {
    apiKey,
    systemPrompt,
    userPrompt,
    model = process.env.CURSOR_COMMENTARY_MODEL ?? "composer-2.5",
    agentId,
    timeoutMs = 45_000,
  } = options;

  const promptText = buildPrompt(systemPrompt, userPrompt);

  let activeAgentId = agentId;
  let run: CursorRun | undefined;

  if (activeAgentId) {
    try {
      const followUp = await cursorFetch<{ run: CursorRun }>(
        apiKey,
        `/agents/${activeAgentId}/runs`,
        {
          method: "POST",
          body: JSON.stringify({
            prompt: { text: promptText },
          }),
        },
      );
      run = followUp.run;
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (!message.includes("409")) {
        throw error;
      }
      activeAgentId = undefined;
    }
  }

  if (!activeAgentId || !run) {
    try {
      const created = await cursorFetch<CursorAgentResponse>(apiKey, "/agents", {
        method: "POST",
        body: JSON.stringify({
          prompt: { text: promptText },
          model: { id: model },
          name: "Sportscaster commentary",
        }),
      });
      activeAgentId = created.agent.id;
      run = created.run;
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (isCursorRateLimitError(message)) {
        cursorApiCooldownUntil = Date.now() + cursorRateLimitCooldownMs();
        throw new Error(
          "Cursor rate limit reached (100/min). Commentary will resume shortly — one moment at a time.",
        );
      }
      if (isCursorAgentLimitError(message)) {
        throw new Error(
          "Cursor Cloud Agent limit reached on your plan. Close other agents or upgrade — only one agent is used per broadcast.",
        );
      }
      throw error;
    }
  }

  const text = await waitForRun(apiKey, activeAgentId, run.id, timeoutMs);

  return {
    text,
    agentId: activeAgentId,
    runId: run.id,
    source: "cursor",
  };
}

export async function triggerCursorAutomationWebhook(options: {
  webhookUrl: string;
  token: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  const response = await fetch(options.webhookUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(options.payload),
  });

  if (!response.ok) {
    const body = await response.text();
    if (/resource_exhausted|failed_precondition/i.test(body)) {
      const label = /resource_exhausted/i.test(body)
        ? "resource_exhausted"
        : "failed_precondition";
      throw new Error(
        `Cursor automation ${label}. Webhook paused for ${Math.round(webhookCooldownMs() / 1000)}s. Use CURSOR_API_KEY for sync commentary, or check automation repo/limits in Cursor.`,
      );
    }
    throw new Error(`Cursor automation webhook ${response.status}: ${body.slice(0, 400)}`);
  }
}

/** Rate-limited webhook — only for major moments; skips color/stat filler spam. */
export async function triggerAutomationWebhookIfAllowed(options: {
  webhookUrl: string;
  token: string;
  payload: Record<string, unknown>;
  momentType: string;
}): Promise<WebhookTriggerResult> {
  const momentType = options.momentType;

  if (!shouldTriggerAutomationWebhook(momentType)) {
    return { status: "skipped", reason: `moment type "${momentType}" (filler events skipped)` };
  }

  const now = Date.now();
  if (now < webhookCooldownUntil) {
    const waitSec = Math.ceil((webhookCooldownUntil - now) / 1000);
    return { status: "skipped", reason: `cooldown after quota error (${waitSec}s left)` };
  }

  if (now - lastWebhookAt < webhookMinIntervalMs()) {
    return { status: "skipped", reason: "rate limit (one webhook per major moment)" };
  }

  if (webhookInFlight) {
    return { status: "skipped", reason: "webhook already in flight" };
  }

  webhookInFlight = true;
  try {
    await triggerCursorAutomationWebhook({
      webhookUrl: options.webhookUrl,
      token: options.token,
      payload: options.payload,
    });
    lastWebhookAt = Date.now();
    return { status: "triggered" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cursor automation webhook failed";
    if (/resource_exhausted|quota exhausted|failed_precondition/i.test(message)) {
      webhookCooldownUntil = Date.now() + webhookCooldownMs();
    }
    return { status: "failed", error: message };
  } finally {
    webhookInFlight = false;
  }
}

export function cursorCommentaryConfigured(): boolean {
  const key = process.env.CURSOR_API_KEY;
  return Boolean(key && key !== "your_cursor_api_key_here");
}

export function cursorAutomationWebhookConfigured(): boolean {
  const url = process.env.CURSOR_AUTOMATION_WEBHOOK_URL?.trim();
  const token = normalizeCursorAutomationToken(process.env.CURSOR_AUTOMATION_TOKEN);
  return Boolean(url && token);
}

export function getCursorAutomationWebhookConfig():
  | { webhookUrl: string; token: string }
  | undefined {
  const webhookUrl = process.env.CURSOR_AUTOMATION_WEBHOOK_URL?.trim();
  const token = normalizeCursorAutomationToken(process.env.CURSOR_AUTOMATION_TOKEN);
  if (!webhookUrl || !token) return undefined;
  return { webhookUrl, token };
}
