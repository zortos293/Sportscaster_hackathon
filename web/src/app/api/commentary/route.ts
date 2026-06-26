import {
  buildCommentaryUserPrompt,
  COMMENTARY_SYSTEM_PROMPT,
  templateCommentary,
} from "@/lib/commentary-prompts";
import {
  cursorAutomationWebhookConfigured,
  cursorCommentaryConfigured,
  generateCursorCommentary,
  getCursorAutomationWebhookConfig,
  triggerAutomationWebhookIfAllowed,
} from "@/lib/cursor-commentary";
import { getCachedCommentaryLine } from "@/lib/match-cache-server";
import type { GameBroadcastContext } from "@/lib/game-context";
import type { TimelineEvent } from "@/lib/timeline";
import OpenAI from "openai";

export const maxDuration = 60;

type CommentaryRequest = {
  event: TimelineEvent;
  gameTitle: string;
  gameId?: string;
  persona: string;
  gameContext?: GameBroadcastContext;
  recentLines?: string[];
  cursorAgentId?: string;
  /** prefetch = warm LLM cache only; never trigger automation webhooks */
  purpose?: "prefetch" | "playback";
};

export async function POST(request: Request) {
  const body = (await request.json()) as CommentaryRequest;
  const {
    event,
    gameTitle,
    gameId,
    persona,
    gameContext,
    recentLines = [],
    cursorAgentId,
    purpose = "playback",
  } = body;

  if (!event || !gameTitle) {
    return Response.json({ error: "event and gameTitle are required" }, { status: 400 });
  }

  const generatedAt = new Date().toISOString();
  const userPrompt = buildCommentaryUserPrompt({
    persona,
    gameTitle,
    event,
    gameContext,
    recentLines,
  });
  const fallback = templateCommentary(event, gameTitle, gameContext);

  const debug: Record<string, unknown> = {
    generatedAt,
    event,
    gameId,
    persona,
    gameContext,
    recentLines,
    userPrompt,
    systemPrompt: COMMENTARY_SYSTEM_PROMPT,
    model: process.env.CURSOR_COMMENTARY_MODEL ?? process.env.OPENAI_MODEL ?? "composer-2",
    cursorAgentId,
  };

  // Webhooks are async sidecars — skip when sync Cursor API is the commentary source.
  if (
    purpose === "playback" &&
    cursorAutomationWebhookConfigured() &&
    !cursorCommentaryConfigured()
  ) {
    const webhook = getCursorAutomationWebhookConfig();
    if (webhook) {
      void triggerAutomationWebhookIfAllowed({
        webhookUrl: webhook.webhookUrl,
        token: webhook.token,
        momentType: event.kind,
        payload: {
          persona,
          gameTitle,
          momentType: event.kind,
          period: event.periodLabel,
          score: `${event.scoreAway}-${event.scoreHome}`,
          playDescription: event.description,
          context: event.context ?? gameContext?.narrative,
          facts: gameContext?.facts?.slice(0, 8),
          recentLines,
        },
      }).then((webhookResult) => {
        if (webhookResult.status === "failed") {
          console.warn("[commentary] webhook failed:", webhookResult.error);
        }
      });
      debug.webhook = "queued";
    }
  } else if (purpose === "prefetch") {
    debug.webhook = "skipped";
    debug.webhookSkipReason = "prefetch (playback-only)";
  }

  if (gameId) {
    const cached = await getCachedCommentaryLine(gameId, event);
    if (cached) {
      return Response.json({
        text: cached.text,
        source: cached.source,
        debug: {
          ...debug,
          cacheHit: true,
          cachedAt: new Date(cached.cachedAt).toISOString(),
        },
      });
    }
    debug.cacheHit = false;
  }

  if (cursorCommentaryConfigured()) {
    try {
      const result = await generateCursorCommentary({
        apiKey: process.env.CURSOR_API_KEY!,
        systemPrompt: COMMENTARY_SYSTEM_PROMPT,
        userPrompt,
        agentId: cursorAgentId,
      });

      const text = result.text?.trim();
      if (!text) {
        return Response.json(
          { error: "Cursor returned empty commentary", source: "error", debug },
          { status: 502 },
        );
      }

      return Response.json({
        text,
        source: "cursor",
        cursorAgentId: result.agentId,
        debug: {
          ...debug,
          cursorRunId: result.runId,
          cursorAgentId: result.agentId,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Cursor commentary failed";
      const status = /rate limit|429/i.test(message) ? 429 : 502;
      return Response.json(
        { error: message, source: "error", debug: { ...debug, error: message } },
        { status },
      );
    }
  }

  const openAiKey = process.env.OPENAI_API_KEY;
  if (openAiKey && openAiKey !== "your_openai_key_here") {
    try {
      const client = new OpenAI({ apiKey: openAiKey });
      const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
      const response = await client.chat.completions.create({
        model,
        temperature: 0.95,
        max_tokens: 130,
        messages: [
          { role: "system", content: COMMENTARY_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      });

      const text = response.choices[0]?.message?.content?.trim();
      return Response.json({
        text: text || fallback,
        source: text ? "llm" : "template",
        debug: {
          ...debug,
          model,
          usage: response.usage,
          finishReason: response.choices[0]?.finish_reason,
        },
      });
    } catch (error) {
      return Response.json({
        text: fallback,
        source: "template",
        debug: {
          ...debug,
          error: error instanceof Error ? error.message : "OpenAI commentary failed",
        },
      });
    }
  }

  return Response.json({ text: fallback, source: "template", debug });
}
