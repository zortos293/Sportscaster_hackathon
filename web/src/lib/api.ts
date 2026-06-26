const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type SessionResponse = {
  session_id: string;
  sport: string;
  league: string;
  event_id: string;
  poll_interval_seconds: number;
  video_source: { type: string; url: string | null };
  status: string;
};

export type GameSnapshot = {
  raw_text: string;
  score_home: number | null;
  score_away: number | null;
  status: string | null;
  period: string | null;
  leaders: string | null;
};

export type WsCommentary = {
  type: "commentary";
  text: string;
  trigger: string;
  audio_base64: string | null;
  audio_mime: string | null;
};

export type WsGameState = {
  type: "game_state";
  snapshot: GameSnapshot;
};

export type WsMessage =
  | WsCommentary
  | WsGameState
  | { type: "heartbeat"; session_id: string }
  | { type: "error"; message: string };

export function apiBaseUrl() {
  return API_URL.replace(/\/$/, "");
}

export function wsBaseUrl() {
  const base = apiBaseUrl();
  return base.replace(/^http/, "ws");
}

export function mediaUrl(path: string) {
  if (path.startsWith("http")) return path;
  return `${apiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function stopSession(sessionId: string) {
  await fetch(`${apiBaseUrl()}/sessions/${sessionId}/stop`, { method: "POST" });
}
