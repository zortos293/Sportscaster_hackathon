import { getFullMatchTimeline } from "@/lib/full-match-server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const gameId = searchParams.get("gameId");
  const duration = Number.parseFloat(searchParams.get("duration") ?? "0");

  if (!gameId || !duration || duration <= 0) {
    return Response.json({ error: "gameId and duration are required" }, { status: 400 });
  }

  try {
    const aligned = await getFullMatchTimeline(gameId);
    if (!aligned?.importJob || aligned.events.length === 0) {
      return Response.json({ error: "Imported highlight timeline not found" }, { status: 404 });
    }

    const title = aligned.importJob.title;
    return Response.json({
      events: aligned.events,
      gameId,
      gameContext: {
        matchup: title,
        awayTeam: "Away",
        homeTeam: "Home",
        facts: [
          `Aligned from LiveScore match ${aligned.importJob.liveScoreMatchId}.`,
          `Source video: ${aligned.importJob.sourceUrl}.`,
        ],
        narrative: `${title} playback aligned by OCR clock anchors and LiveScore event minutes.`,
      },
      videoMode: "full_match_aligned",
      debug: {
        fetchedAt: new Date().toISOString(),
        sourceUrl: aligned.importJob.sourceUrl,
        summary: {
          source: "full-match-alignment",
          status: aligned.importJob.status,
          confidence: aligned.importJob.confidence,
        },
        events: aligned.events,
        videoMode: "full_match_aligned",
      },
    });
  } catch {
    return Response.json({ error: "Failed to build timeline" }, { status: 502 });
  }
}
