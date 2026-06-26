import {
  deleteFullMatchImport,
  listFullMatchImports,
  manualAlignFullMatch,
  processFullMatchImport,
  realignFullMatchImport,
  type FullMatchImportRequest,
} from "@/lib/full-match-server";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET() {
  try {
    const imports = await listFullMatchImports();
    return Response.json({ imports });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to list full-match imports";
    return Response.json({ error: message, imports: [] }, { status: 502 });
  }
}

export async function POST(request: Request) {
  let body: Partial<FullMatchImportRequest> & {
    action?: string;
    firstHalfVideoAt?: number;
    secondHalfVideoAt?: number;
    reOcr?: boolean;
  } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  if (body.action === "realign") {
    if (!body.gameId?.trim()) {
      return Response.json({ error: "gameId is required for realignment" }, { status: 400 });
    }
    try {
      const result = await realignFullMatchImport({
        gameId: body.gameId,
        alignmentMode: body.alignmentMode,
        reOcr: body.reOcr,
      });
      return Response.json({ ok: true, result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Realignment failed";
      return Response.json({ ok: false, error: message }, { status: 502 });
    }
  }

  if (body.action === "manual-align") {
    if (!body.gameId?.trim() || typeof body.firstHalfVideoAt !== "number") {
      return Response.json(
        { error: "gameId and firstHalfVideoAt are required for manual alignment" },
        { status: 400 },
      );
    }
    try {
      const result = await manualAlignFullMatch({
        gameId: body.gameId,
        firstHalfVideoAt: body.firstHalfVideoAt,
        secondHalfVideoAt: body.secondHalfVideoAt,
      });
      return Response.json({ ok: true, result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Manual alignment failed";
      return Response.json({ ok: false, error: message }, { status: 502 });
    }
  }

  if (!body.sourceUrl?.trim()) {
    return Response.json({ error: "sourceUrl is required" }, { status: 400 });
  }
  if (
    !body.liveScoreMatchId?.trim() &&
    !body.fotmobMatchId?.trim() &&
    !body.flashscoreMatchId?.trim() &&
    !body.sofaScoreEventId?.trim()
  ) {
    return Response.json(
      { error: "sofaScoreEventId, flashscoreMatchId, fotmobMatchId, or liveScoreMatchId is required" },
      { status: 400 },
    );
  }

  try {
    const result = await processFullMatchImport({
      sourceUrl: body.sourceUrl,
      liveScoreMatchId: body.liveScoreMatchId,
      fotmobMatchId: body.fotmobMatchId,
      flashscoreMatchId: body.flashscoreMatchId,
      sofaScoreEventId: body.sofaScoreEventId,
      title: body.title,
      subtitle: body.subtitle,
      gameId: body.gameId,
      sampleEverySeconds: body.sampleEverySeconds,
      maxSamples: body.maxSamples,
      alignmentMode: body.alignmentMode,
    });
    return Response.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Full-match import failed";
    return Response.json({ ok: false, error: message }, { status: 502 });
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const gameId = searchParams.get("gameId");
  if (!gameId?.trim()) {
    return Response.json({ error: "gameId is required" }, { status: 400 });
  }

  try {
    const result = await deleteFullMatchImport(gameId);
    return Response.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to remove full match";
    return Response.json({ ok: false, error: message }, { status: 502 });
  }
}
