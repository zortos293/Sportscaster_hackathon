import { getDemoGame } from "@/lib/demo-games";
import { extractGameContext } from "@/lib/game-context";
import {
  buildTimeline,
  espnSummaryUrl,
  extractEspnDebugSummary,
  fetchEspnSummary,
} from "@/lib/timeline";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const gameId = searchParams.get("gameId");
  const duration = Number.parseFloat(searchParams.get("duration") ?? "0");

  const game = gameId ? getDemoGame(gameId) : undefined;
  if (!game || !duration || duration <= 0) {
    return Response.json({ error: "gameId and duration are required" }, { status: 400 });
  }

  try {
    const fetchedAt = new Date().toISOString();
    const espnUrl = espnSummaryUrl(game.sport, game.league, game.eventId);
    const payload = await fetchEspnSummary(game.sport, game.league, game.eventId);
    const { events, gameContext } = buildTimeline(payload, game.sport, duration);
    const summary = extractEspnDebugSummary(payload, game.sport);

    return Response.json({
      events,
      gameId: game.id,
      gameContext,
      debug: {
        espnUrl,
        fetchedAt,
        summary,
        payload,
        events,
        gameContext,
      },
    });
  } catch {
    return Response.json({ error: "Failed to build timeline" }, { status: 502 });
  }
}

// Re-export for tests or server use
export { extractGameContext };
