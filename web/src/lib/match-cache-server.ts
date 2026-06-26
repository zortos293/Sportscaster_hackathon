import { getBundledCommentaryLine } from "@/lib/demo-static-timelines";
import { eventCacheKey } from "@/lib/match-cache";
import type { TimelineEvent } from "@/lib/timeline";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";

function getConvexClient(): ConvexHttpClient | null {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL?.trim();
  if (!url || !/^https?:\/\//.test(url)) return null;
  return new ConvexHttpClient(url);
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
    source: line.source === "bundled" ? "bundled" : line.source === "cursor" ? "cursor" : line.source === "llm" ? "llm" : "template",
    cachedAt: line.cachedAt,
  };
}
