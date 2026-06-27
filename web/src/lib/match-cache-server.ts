import { getDemoGame } from "@/lib/demo-games";
import {
  getBundledCommentaryLine,
  getBundledCommentaryLines,
} from "@/lib/demo-static-timelines";
import { eventCacheKey, type CachedCommentaryLine } from "@/lib/match-cache";
import { findCachedTtsAudio } from "@/lib/tts-cache-server";
import type { TimelineEvent } from "@/lib/timeline";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";

export type StoredCommentaryLine = CachedCommentaryLine & {
  cachedAt?: number;
  audioUrl?: string;
};

function getConvexClient(): ConvexHttpClient | null {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL?.trim();
  if (!url || !/^https?:\/\//.test(url)) return null;
  return new ConvexHttpClient(url);
}

function normalizeSource(source: string): StoredCommentaryLine["source"] {
  if (source === "bundled") return "bundled";
  if (source === "cursor") return "cursor";
  if (source === "llm") return "llm";
  return "template";
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "Convex cache unavailable";
}

export async function getCachedCommentaryLine(
  gameId: string,
  event: TimelineEvent,
): Promise<{ text: string; source: string; cachedAt: number; audioUrl?: string } | null> {
  const bundled = getBundledCommentaryLine(gameId, event);
  if (bundled) {
    const audio = await findCachedTtsAudio({
      gameId,
      eventKey: eventCacheKey(event),
      text: bundled.text,
    });
    return { ...bundled, audioUrl: audio?.publicUrl };
  }

  const client = getConvexClient();
  if (!client) return null;

  let line: Awaited<ReturnType<typeof client.query<typeof api.matches.getCommentaryLine>>>;
  try {
    line = await client.query(api.matches.getCommentaryLine, {
      gameId,
      eventKey: eventCacheKey(event),
    });
  } catch (error) {
    console.warn("[match-cache] failed to read commentary line:", errorMessage(error));
    return null;
  }

  if (!line?.text?.trim()) return null;

  const audio = await findCachedTtsAudio({
    gameId,
    eventKey: eventCacheKey(event),
    text: line.text,
  });

  return {
    text: line.text.trim(),
    source: normalizeSource(line.source),
    cachedAt: line.cachedAt,
    audioUrl: audio?.publicUrl,
  };
}

export async function getCachedCommentaryLinesForGame(
  gameId: string,
): Promise<StoredCommentaryLine[]> {
  const bundled = getBundledCommentaryLines(gameId);
  if (bundled.length > 0) {
    return Promise.all(
      bundled.map(async (line) => {
        const audio = await findCachedTtsAudio({
          gameId,
          eventKey: line.eventKey,
          text: line.text,
        });
        return { ...line, cachedAt: 0, audioUrl: audio?.publicUrl };
      }),
    );
  }

  const client = getConvexClient();
  if (!client) return [];

  let rows: Awaited<ReturnType<typeof client.query<typeof api.matches.getCommentaryLinesForGame>>>;
  try {
    rows = await client.query(api.matches.getCommentaryLinesForGame, { gameId });
  } catch (error) {
    console.warn("[match-cache] failed to read commentary lines:", errorMessage(error));
    return [];
  }
  const lines = rows.filter((row) => row.text?.trim());
  return Promise.all(
    lines.map(async (row) => {
      const text = row.text.trim();
      const audio = await findCachedTtsAudio({
        gameId,
        eventKey: row.eventKey,
        text,
      });

      return {
        eventKey: row.eventKey,
        eventId: row.eventId,
        kind: row.kind,
        description: row.description,
        videoAt: row.videoAt,
        text,
        source: normalizeSource(row.source),
        cachedAt: row.cachedAt,
        audioUrl: audio?.publicUrl,
      };
    }),
  );
}

export async function persistCommentaryLine(options: {
  gameId: string;
  gameTitle: string;
  event: TimelineEvent;
  text: string;
  source: string;
}): Promise<void> {
  const client = getConvexClient();
  if (!client) return;

  const demo = getDemoGame(options.gameId);
  try {
    await client.mutation(api.matches.upsertCommentaryLine, {
      gameId: options.gameId,
      title: options.gameTitle,
      subtitle: demo?.subtitle ?? "",
      source: options.source,
      line: {
        eventKey: eventCacheKey(options.event),
        eventId: options.event.id,
        kind: options.event.kind,
        description: options.event.description,
        videoAt: options.event.videoAt,
        text: options.text.trim(),
        source: options.source,
      },
    });
  } catch (error) {
    console.warn("[match-cache] failed to persist commentary line:", errorMessage(error));
  }
}
