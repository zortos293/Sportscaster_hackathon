import {
  buildStreamBootstrapPrompt,
  COMMENTARY_SYSTEM_PROMPT,
} from "@/lib/commentary-prompts";
import {
  bootstrapStreamAgent,
  cursorCommentaryConfigured,
  resolveCursorCommentaryModel,
} from "@/lib/cursor-commentary";
import type { GameBroadcastContext } from "@/lib/game-context";

export const maxDuration = 60;

type SessionRequest = {
  gameId: string;
  gameTitle: string;
  persona: string;
  gameContext?: GameBroadcastContext;
  cursorAgentId?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as SessionRequest;
  const { gameId, gameTitle, persona, gameContext, cursorAgentId } = body;

  if (!gameId || !gameTitle) {
    return Response.json({ error: "gameId and gameTitle are required" }, { status: 400 });
  }

  if (!cursorCommentaryConfigured()) {
    return Response.json({ error: "Cursor API is not configured" }, { status: 503 });
  }

  const cursorModel = resolveCursorCommentaryModel();
  const bootstrapPrompt = `${COMMENTARY_SYSTEM_PROMPT}

---

${buildStreamBootstrapPrompt({ persona, gameTitle, gameContext })}

---

Reply with ONLY the word READY.`;

  try {
    const result = await bootstrapStreamAgent({
      apiKey: process.env.CURSOR_API_KEY!,
      gameId,
      bootstrapPrompt,
      existingAgentId: cursorAgentId,
      model: cursorModel,
    });

    return Response.json({
      cursorAgentId: result.agentId,
      source: result.source,
      reused: result.reused,
      debug: {
        gameId,
        gameTitle,
        persona,
        model: cursorModel,
        reused: result.reused,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stream agent bootstrap failed";
    console.warn("[commentary/session] bootstrap failed:", message);
    const status = /rate limit|429/i.test(message) ? 429 : 502;
    return Response.json({ error: message, source: "error" }, { status });
  }
}
