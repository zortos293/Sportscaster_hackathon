import { type VideoSyncMode } from "@/lib/timeline-sync";

export type BroadcastGame = {
  id: string;
  title: string;
  subtitle: string;
  sport: string;
  league: string;
  eventId: string;
  videoFile: string;
  persona: string;
  finalScore: string;
  videoMode: VideoSyncMode;
  /** Known duration for timeline sync when ffprobe is unavailable. */
  durationSeconds?: number;
};

export function videoUrl(videoFile: string): string {
  if (videoFile.startsWith("full-matches/")) {
    return `/api/full-match-video/${encodeURIComponent(videoFile.slice("full-matches/".length))}`;
  }
  return `/samples/${videoFile}`;
}

/** Demo highlight reels keep the source broadcast audio; imports use muted video + TTS. */
export function usesNativeVideoAudio(game: BroadcastGame): boolean {
  return game.videoMode === "highlights";
}
