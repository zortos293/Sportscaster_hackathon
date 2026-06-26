import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { usesNativeVideoAudio, videoUrl, type BroadcastGame } from "@/lib/broadcast-game";
import { DEMO_GAMES } from "@/lib/demo-games";
import { getFullMatchTimeline } from "@/lib/full-match-server";
import { filterMajorTimelineEvents } from "@/lib/match-event-filter";
import { buildTimeline, fetchEspnSummary, type TimelineEvent } from "@/lib/timeline";

export const HIGHLIGHT_CLIP_DURATION_SECONDS = 12;
export const HIGHLIGHT_CLIP_LEAD_SECONDS = 2;

export type HighlightClip = {
  id: string;
  gameId: string;
  videoUrl: string;
  videoAt: number;
  clipDuration: number;
  kind: string;
  description: string;
  gameElapsed: number;
  scoreHome: number;
  scoreAway: number;
  periodLabel: string;
  context?: string;
  matchTitle: string;
  matchSubtitle: string;
  nativeAudio: boolean;
};

function getConvexClient(): ConvexHttpClient | null {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL?.trim();
  if (!url || !/^https?:\/\//.test(url)) return null;
  return new ConvexHttpClient(url);
}

function eventToClip(
  event: TimelineEvent,
  game: Pick<BroadcastGame, "id" | "title" | "subtitle" | "videoFile" | "videoMode">,
  nativeAudio: boolean,
): HighlightClip {
  const clipStart = Math.max(0, event.videoAt - HIGHLIGHT_CLIP_LEAD_SECONDS);

  return {
    id: `${game.id}-${event.id}`,
    gameId: game.id,
    videoUrl: videoUrl(game.videoFile),
    videoAt: clipStart,
    clipDuration: HIGHLIGHT_CLIP_DURATION_SECONDS,
    kind: event.kind,
    description: event.description,
    gameElapsed: event.gameElapsed,
    scoreHome: event.scoreHome,
    scoreAway: event.scoreAway,
    periodLabel: event.periodLabel,
    context: event.context,
    matchTitle: game.title,
    matchSubtitle: game.subtitle,
    nativeAudio,
  };
}

async function clipsFromDemoGame(game: BroadcastGame): Promise<HighlightClip[]> {
  const duration = game.durationSeconds;
  if (!duration || duration <= 0) return [];

  try {
    const payload = await fetchEspnSummary(game.sport, game.league, game.eventId);
    const { events } = buildTimeline(payload, game.sport, duration, game.videoMode);
    const nativeAudio = usesNativeVideoAudio(game);

    return filterMajorTimelineEvents(events)
      .sort((a, b) => a.videoAt - b.videoAt)
      .map((event) => eventToClip(event, game, nativeAudio));
  } catch {
    return [];
  }
}

async function clipsFromImportedMatch(gameId: string): Promise<HighlightClip[]> {
  try {
    const aligned = await getFullMatchTimeline(gameId);
    if (!aligned?.importJob?.videoFile || aligned.events.length === 0) return [];

    const game = {
      id: gameId,
      title: aligned.importJob.title,
      subtitle: aligned.importJob.subtitle,
      videoFile: aligned.importJob.videoFile,
      videoMode: "full_match_aligned" as const,
    };

    return aligned.events
      .sort((a, b) => a.videoAt - b.videoAt)
      .map((event) => eventToClip(event, game, false));
  } catch {
    return [];
  }
}

async function clipsFromConvexHighlights(): Promise<HighlightClip[]> {
  const client = getConvexClient();
  if (!client) return [];

  try {
    const rows = await client.query(api.matches.listHighlights, {});
    const imports = await client.query(api.matches.listFullMatchImports, {});
    const importMap = new Map(imports.map((row) => [row.gameId, row]));

    const clips: HighlightClip[] = [];
    for (const row of rows) {
      const imp = importMap.get(row.gameId);
      if (!imp?.videoFile) continue;

      clips.push({
        id: String(row._id),
        gameId: row.gameId,
        videoUrl: videoUrl(imp.videoFile),
        videoAt: Math.max(0, row.videoAt - HIGHLIGHT_CLIP_LEAD_SECONDS),
        clipDuration: HIGHLIGHT_CLIP_DURATION_SECONDS,
        kind: row.kind,
        description: row.description,
        gameElapsed: row.gameElapsed,
        scoreHome: row.scoreHome,
        scoreAway: row.scoreAway,
        periodLabel: row.periodLabel,
        context: row.context,
        matchTitle: row.matchTitle,
        matchSubtitle: row.matchSubtitle,
        nativeAudio: false,
      });
    }
    return clips;
  } catch {
    return [];
  }
}

export async function buildHighlightClips(): Promise<HighlightClip[]> {
  const demoClips = (
    await Promise.all(DEMO_GAMES.map((game) => clipsFromDemoGame(game)))
  ).flat();

  const client = getConvexClient();
  let importClips: HighlightClip[] = [];
  if (client) {
    try {
      const imports = await client.query(api.matches.listFullMatchImports, {});
      const alignedImports = imports.filter(
        (row) => row.status === "aligned" && row.videoFile,
      );
      importClips = (
        await Promise.all(alignedImports.map((row) => clipsFromImportedMatch(row.gameId)))
      ).flat();
    } catch {
      // Fall back to listHighlights rows below.
    }
  }

  const convexClips = await clipsFromConvexHighlights();

  const merged = new Map<string, HighlightClip>();
  for (const clip of [...demoClips, ...importClips, ...convexClips]) {
    merged.set(clip.id, clip);
  }

  return [...merged.values()].sort(
    (a, b) => a.matchTitle.localeCompare(b.matchTitle) || a.videoAt - b.videoAt,
  );
}
