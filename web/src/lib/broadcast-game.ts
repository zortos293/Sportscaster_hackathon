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
  /** Use bundled markers instead of ESPN for timeline + commentary. */
  timelineSource?: "espn" | "static";
  /** "native" keeps source video audio; default "ai" mutes video and uses ElevenLabs. */
  audioSource?: "native" | "ai";
};

export function videoUrl(videoFile: string): string {
  if (/^https?:\/\//i.test(videoFile)) {
    return videoFile;
  }
  if (videoFile.startsWith("full-matches/")) {
    return `/api/full-match-video/${encodeURIComponent(videoFile.slice("full-matches/".length))}`;
  }
  return `/samples/${videoFile}`;
}

/** Mute video and overlay AI voice unless the game explicitly keeps native audio. */
export function usesNativeVideoAudio(game: BroadcastGame): boolean {
  return game.audioSource === "native";
}

/** Pre-bundled commentary lines (no Convex / Cursor required). */
export function usesBundledCommentary(game: BroadcastGame): boolean {
  return game.timelineSource === "static";
}
