import type { TimelineEvent } from "@/lib/timeline";

export function eventCacheKey(event: Pick<TimelineEvent, "id" | "videoAt">): string {
  return `${event.id}@${event.videoAt.toFixed(1)}`;
}

export type CachedCommentaryLine = {
  eventKey: string;
  eventId: string;
  kind: string;
  description: string;
  videoAt: number;
  text: string;
  source: string;
};

/** Default MP4 duration for admin bulk-cache when video metadata is unavailable. */
export const DEFAULT_CACHE_VIDEO_DURATION_SECONDS = 600;
