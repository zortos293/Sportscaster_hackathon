import {
  cacheAllLiveScoreMatches,
  cacheGame,
  listCachedMatchStatuses,
} from "@/lib/cache-matches-server";
import { assertAdminEnabled } from "@/lib/admin-access";

export const maxDuration = 300;

export async function GET() {
  try {
    const payload = await listCachedMatchStatuses();
    return Response.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load matches";
    return Response.json({ error: message, games: [] }, { status: 502 });
  }
}

export async function POST(request: Request) {
  const denied = assertAdminEnabled();
  if (denied) return denied;

  let body: { gameId?: string; matchId?: string; all?: boolean } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  if (body.all) {
    try {
      const payload = await cacheAllLiveScoreMatches();
      const failed = payload.results.filter((result) => result.error);
      return Response.json({
        ...payload,
        ok: failed.length === 0,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Bulk cache failed";
      return Response.json({ ok: false, error: message }, { status: 502 });
    }
  }

  const gameId = body.gameId ?? body.matchId;
  if (!gameId) {
    return Response.json({ error: "gameId (or matchId) or all=true is required" }, { status: 400 });
  }

  const result = await cacheGame(gameId);
  if (result.error) {
    return Response.json({ ok: false, result }, { status: 502 });
  }

  return Response.json({ ok: true, result });
}
