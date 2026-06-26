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

export type CursorModelParam = { id: string; value: string };

export type CursorModelSelection = {
  id: string;
  params?: CursorModelParam[];
};

/** Map UI-style model slugs to Cloud Agents API `model` objects. */
export function resolveCursorModelSelection(raw?: string | CursorModelSelection): CursorModelSelection {
  if (raw && typeof raw !== "string") return raw;

  const envModel = (raw ?? process.env.CURSOR_COMMENTARY_MODEL ?? "composer-2.5").trim();
  const normalized = envModel.toLowerCase();

  const aliases: Record<string, CursorModelSelection> = {
    composer: { id: "composer-2.5", params: [{ id: "fast", value: "true" }] },
    "composer-latest": { id: "composer-2.5", params: [{ id: "fast", value: "true" }] },
    "composer-2": { id: "composer-2.5", params: [{ id: "fast", value: "true" }] },
    "composer-2-fast": { id: "composer-2.5", params: [{ id: "fast", value: "true" }] },
    "composer-2.5": { id: "composer-2.5", params: [{ id: "fast", value: "true" }] },
    "composer-2.5-fast": { id: "composer-2.5", params: [{ id: "fast", value: "true" }] },
    "composer-2-slow": { id: "composer-2.5", params: [{ id: "fast", value: "false" }] },
    "composer-2.5-slow": { id: "composer-2.5", params: [{ id: "fast", value: "false" }] },
    auto: { id: "default" },
    default: { id: "default" },
  };

  if (aliases[normalized]) {
    return aliases[normalized];
  }

  return { id: envModel };
}

export function resolveCursorCommentaryModel(raw?: string | CursorModelSelection): CursorModelSelection {
  return resolveCursorModelSelection(raw);
}

export type CursorCommentaryOptions = {
  apiKey: string;
  systemPrompt: string;
  userPrompt: string;
  agentId?: string;
  model?: string | CursorModelSelection;
  timeoutMs?: number;
};

export type CursorCommentaryResult = {
  text: string;
  agentId: string;
  runId: string;
  source: "cursor";
};

export type BootstrapStreamAgentOptions = {
  apiKey: string;
  gameId: string;
  bootstrapPrompt: string;
  existingAgentId?: string;
  model?: string | CursorModelSelection;
  timeoutMs?: number;
};

export type BootstrapStreamAgentResult = {
  agentId: string;
  source: "cursor";
  reused: boolean;
};

type CursorRun = {
  id: string;
  agentId: string;
  status: string;
  result?: string;
};

type CursorAgentSummary = {
  id: string;
  name?: string;
  status?: string;
};

type CursorAgentListResponse = {
  items: CursorAgentSummary[];
};

type CursorAgentResponse = {
  agent: { id: string };
  run: CursorRun;
};

/** Per-process cache — client also holds agentId for the active stream. */
const streamAgentByGameId = new Map<string, string>();

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
  const ms = Number.parseInt(process.env.CURSOR_API_MIN_INTERVAL_MS ?? "800", 10);
  return Number.isFinite(ms) && ms > 0 ? ms : 800;
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

function isCursorAgentBusyError(message: string): boolean {
  return /409|agent_busy|already running/i.test(message);
}

function normalizeRunStatus(status: string | undefined): string {
  return (status ?? "").toUpperCase();
}

function modelSelectionKey(model: CursorModelSelection): string {
  const params = model.params
    ?.map((param) => `${param.id}=${param.value}`)
    .sort()
    .join(",");
  return params ? `${model.id}:${params}` : model.id;
}

function streamAgentName(gameId: string, modelKey: string): string {
  const safeGameId = gameId.replace(/[^a-zA-Z0-9_.-]/g, "-").slice(0, 80);
  const safeModelKey = modelKey.replace(/[^a-zA-Z0-9_.=-]/g, "-").slice(0, 80);
  return `sportscaster-${safeGameId}-${safeModelKey}`;
}

function isTerminalRunStatus(status: string): boolean {
  return ["FINISHED", "ERROR", "CANCELLED", "EXPIRED"].includes(status);
}

async function waitForAgentIdle(
  apiKey: string,
  agentId: string,
  timeoutMs = 30_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const agent = await cursorFetch<{ latestRunId?: string }>(apiKey, `/agents/${agentId}`);
    if (!agent.latestRunId) return;

    const run = await cursorFetch<CursorRun>(
      apiKey,
      `/agents/${agentId}/runs/${agent.latestRunId}`,
    );
    if (isTerminalRunStatus(normalizeRunStatus(run.status))) return;

    await sleep(400);
  }

  throw new Error("Cursor agent busy — prior run did not finish in time");
}

async function startFollowUpRun(
  apiKey: string,
  agentId: string,
  promptText: string,
): Promise<CursorRun> {
  await waitForAgentIdle(apiKey, agentId);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const followUp = await cursorFetch<{ run: CursorRun }>(
        apiKey,
        `/agents/${agentId}/runs`,
        {
          method: "POST",
          body: JSON.stringify({
            prompt: { text: promptText },
          }),
        },
      );
      return followUp.run;
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (isCursorAgentBusyError(message) && attempt < 4) {
        await sleep(500 * (attempt + 1));
        continue;
      }
      throw error;
    }
  }

  throw new Error("Cursor agent busy — could not queue follow-up run");
}

async function findStreamAgent(
  apiKey: string,
  gameId: string,
  modelKey: string,
): Promise<string | undefined> {
  try {
    const list = await cursorFetch<CursorAgentListResponse>(apiKey, "/agents?limit=20");
    const match = list.items.find(
      (agent) =>
        agent.name === streamAgentName(gameId, modelKey) &&
        normalizeRunStatus(agent.status) === "ACTIVE",
    );
    return match?.id;
  } catch {
    return undefined;
  }
}

async function validateStreamAgent(apiKey: string, agentId: string): Promise<boolean> {
  try {
    await cursorFetch<{ id: string }>(apiKey, `/agents/${agentId}`);
    return true;
  } catch {
    return false;
  }
}

async function createStreamAgent(
  apiKey: string,
  gameId: string,
  bootstrapPrompt: string,
  model: CursorModelSelection,
): Promise<{ agentId: string; run: CursorRun }> {
  const modelKey = modelSelectionKey(model);
  try {
    const created = await cursorFetch<CursorAgentResponse>(apiKey, "/agents", {
      method: "POST",
      body: JSON.stringify({
        prompt: { text: bootstrapPrompt },
        model,
        name: streamAgentName(gameId, modelKey),
      }),
    });
    return { agentId: created.agent.id, run: created.run };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (isCursorRateLimitError(message)) {
      cursorApiCooldownUntil = Date.now() + cursorRateLimitCooldownMs();
      throw new Error(
        "Cursor rate limit reached (100/min). Commentary will resume shortly — one moment at a time.",
      );
    }
    if (isCursorAgentLimitError(message)) {
      const existing = await findStreamAgent(apiKey, gameId, modelKey);
      if (existing) {
        const run = await startFollowUpRun(apiKey, existing, bootstrapPrompt);
        return { agentId: existing, run };
      }
      throw new Error(
        "Cursor Cloud Agent limit reached. Close other agents in Cursor, then reload the page.",
      );
    }
    throw error;
  }
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

function buildBatchPrompt(systemPrompt: string, userPrompt: string): string {
  return `${systemPrompt}

---

${userPrompt}`;
}

export type CursorBatchCommentaryResult = {
  text: string;
  agentId: string;
  runId: string;
  source: "cursor";
};

export async function generateCursorBatchCommentary(options: {
  apiKey: string;
  systemPrompt: string;
  userPrompt: string;
  model?: string;
  agentId?: string;
  timeoutMs?: number;
}): Promise<CursorBatchCommentaryResult> {
  return withCommentaryQueue(() => generateCursorBatchCommentaryInner(options));
}

async function generateCursorBatchCommentaryInner(options: {
  apiKey: string;
  systemPrompt: string;
  userPrompt: string;
  model?: string;
  agentId?: string;
  timeoutMs?: number;
}): Promise<CursorBatchCommentaryResult> {
  const {
    apiKey,
    systemPrompt,
    userPrompt,
    model,
    agentId,
    timeoutMs = Number.parseInt(process.env.CURSOR_BATCH_TIMEOUT_MS ?? "180000", 10) || 180_000,
  } = options;

  const modelSelection = resolveCursorModelSelection(model);
  const promptText = buildBatchPrompt(systemPrompt, userPrompt);

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
          model: modelSelection,
          name: "Sportscaster batch cache",
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
          "Cursor Cloud Agent limit reached on your plan. Close other agents at cursor.com/agents, then retry — caching uses one agent for all lines.",
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

export function parseBatchCommentaryJson(
  raw: string,
  expectedKeys: string[],
): Map<string, string> {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const jsonText = (fenced?.[1] ?? trimmed).trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("Cursor batch response was not valid JSON");
  }

  const entries = Array.isArray(parsed)
    ? parsed
    : typeof parsed === "object" &&
        parsed !== null &&
        Array.isArray((parsed as { lines?: unknown }).lines)
      ? (parsed as { lines: unknown[] }).lines
      : null;

  if (!entries) {
    throw new Error("Cursor batch response missing lines array");
  }

  const byKey = new Map<string, string>();
  for (const entry of entries) {
    if (
      typeof entry !== "object" ||
      entry === null ||
      typeof (entry as { eventKey?: unknown }).eventKey !== "string" ||
      typeof (entry as { text?: unknown }).text !== "string"
    ) {
      continue;
    }
    const { eventKey, text } = entry as { eventKey: string; text: string };
    const line = text.trim();
    if (line) {
      byKey.set(eventKey, line);
    }
  }

  const missing = expectedKeys.filter((key) => !byKey.has(key));
  if (missing.length === expectedKeys.length) {
    throw new Error("Cursor batch response contained no matching commentary lines");
  }

  return byKey;
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
  let emptyFinishPolls = 0;

  while (Date.now() < deadline) {
    const run = await cursorFetch<CursorRun>(
      apiKey,
      `/agents/${agentId}/runs/${runId}`,
    );
    const status = normalizeRunStatus(run.status);

    if (status === "FINISHED") {
      if (run.result?.trim()) {
        return run.result.trim();
      }
      emptyFinishPolls += 1;
      if (emptyFinishPolls >= 8) {
        throw new Error("Cursor run finished without commentary text");
      }
      await sleep(600);
      continue;
    }

    if (status === "ERROR" || status === "CANCELLED" || status === "EXPIRED") {
      throw new Error(`Cursor run ${status.toLowerCase()}`);
    }

    await sleep(300);
  }

  throw new Error("Cursor commentary timed out");
}

export async function bootstrapStreamAgent(
  options: BootstrapStreamAgentOptions,
): Promise<BootstrapStreamAgentResult> {
  return withCommentaryQueue(() => bootstrapStreamAgentInner(options));
}

async function bootstrapStreamAgentInner(
  options: BootstrapStreamAgentOptions,
): Promise<BootstrapStreamAgentResult> {
  const {
    apiKey,
    gameId,
    bootstrapPrompt,
    existingAgentId,
    timeoutMs = 45_000,
    model: modelOverride,
  } = options;

  let model: CursorModelSelection;
  if (modelOverride) {
    model =
      typeof modelOverride === "string"
        ? resolveCursorCommentaryModel(modelOverride)
        : modelOverride;
  } else {
    model = resolveCursorCommentaryModel();
  }
  const modelKey = modelSelectionKey(model);

  const cached = streamAgentByGameId.get(gameId);
  if (cached && (await validateStreamAgent(apiKey, cached))) {
    return { agentId: cached, source: "cursor", reused: true };
  }

  if (existingAgentId && (await validateStreamAgent(apiKey, existingAgentId))) {
    streamAgentByGameId.set(gameId, existingAgentId);
    return { agentId: existingAgentId, source: "cursor", reused: true };
  }

  const existing = await findStreamAgent(apiKey, gameId, modelKey);
  if (existing) {
    streamAgentByGameId.set(gameId, existing);
    return { agentId: existing, source: "cursor", reused: true };
  }

  const { agentId, run } = await createStreamAgent(apiKey, gameId, bootstrapPrompt, model);
  await waitForRun(apiKey, agentId, run.id, timeoutMs);
  streamAgentByGameId.set(gameId, agentId);

  return { agentId, source: "cursor", reused: false };
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
    model,
    agentId,
    timeoutMs = 45_000,
  } = options;

  const modelSelection = resolveCursorModelSelection(model);
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
          model: modelSelection,
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
          "Cursor Cloud Agent limit reached on your plan. Close other agents at cursor.com/agents, then retry — caching uses one agent for all lines.",
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
