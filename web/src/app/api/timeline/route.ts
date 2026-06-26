import { getDemoGame } from "@/lib/demo-games";
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
    const { events, gameContext, videoMode } = buildTimeline(
      payload,
      game.sport,
      duration,
      game.videoMode,
    );
    const summary = extractEspnDebugSummary(payload, game.sport);

    return Response.json({
      events,
      gameId: game.id,
      gameContext,
      videoMode,
      debug: {
        espnUrl,
        fetchedAt,
        summary,
        payload,
        events,
        gameContext,
        videoMode,
      },
    });
  } catch {
    return Response.json({ error: "Failed to build timeline" }, { status: 502 });
  }
}
