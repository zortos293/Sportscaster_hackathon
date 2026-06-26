import { getCachedCommentaryLinesForGame } from "@/lib/match-cache-server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const gameId = searchParams.get("gameId");

  if (!gameId) {
    return Response.json({ error: "gameId is required" }, { status: 400 });
  }

  const lines = await getCachedCommentaryLinesForGame(gameId);
  return Response.json({ gameId, lines });
}
