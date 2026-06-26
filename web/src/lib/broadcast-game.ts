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
};

export function videoUrl(videoFile: string): string {
  if (videoFile.startsWith("full-matches/")) {
    return `/api/full-match-video/${encodeURIComponent(videoFile.slice("full-matches/".length))}`;
  }
  return `/samples/${videoFile}`;
}
