import { getDemoGame } from "@/lib/demo-games";
import {
  getBundledCommentaryLine,
  getBundledCommentaryLines,
} from "@/lib/demo-static-timelines";
import { eventCacheKey, type CachedCommentaryLine } from "@/lib/match-cache";
import type { TimelineEvent } from "@/lib/timeline";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";

export type StoredCommentaryLine = CachedCommentaryLine & { cachedAt?: number };

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

export async function getCachedCommentaryLine(
  gameId: string,
  event: TimelineEvent,
): Promise<{ text: string; source: string; cachedAt: number } | null> {
  const bundled = getBundledCommentaryLine(gameId, event);
  if (bundled) return bundled;

  const client = getConvexClient();
  if (!client) return null;

  const line = await client.query(api.matches.getCommentaryLine, {
    gameId,
    eventKey: eventCacheKey(event),
  });

  if (!line?.text?.trim()) return null;

  return {
    text: line.text.trim(),
    source: normalizeSource(line.source),
    cachedAt: line.cachedAt,
  };
}

export async function getCachedCommentaryLinesForGame(
  gameId: string,
): Promise<StoredCommentaryLine[]> {
  const bundled = getBundledCommentaryLines(gameId);
  if (bundled.length > 0) {
    return bundled.map((line) => ({ ...line, cachedAt: 0 }));
  }

  const client = getConvexClient();
  if (!client) return [];

  const rows = await client.query(api.matches.getCommentaryLinesForGame, { gameId });
  return rows
    .filter((row) => row.text?.trim())
    .map((row) => ({
      eventKey: row.eventKey,
      eventId: row.eventId,
      kind: row.kind,
      description: row.description,
      videoAt: row.videoAt,
      text: row.text.trim(),
      source: normalizeSource(row.source),
      cachedAt: row.cachedAt,
    }));
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
}
