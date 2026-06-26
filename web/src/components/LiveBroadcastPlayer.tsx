"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type LiveCommentaryLine = {
  id: string;
  type: "score" | "play" | "status" | "period";
  text: string;
  score: { home: number; away: number };
  period: string;
  timestamp: string;
};

type GameState = {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  status: string;
  period: string;
  clock: string;
};

type LiveBroadcastPlayerProps = {
  gameId: string;
  title?: string;
};

type AudioQueueItem = {
  text: string;
  id: string;
};

function statusLabel(
  status: "connecting" | "connected" | "live" | "ended" | "error",
) {
  if (status === "live") return "Live";
  if (status === "connecting") return "Connecting...";
  if (status === "connected") return "Connected";
  if (status === "ended") return "Game Over";
  return "Offline";
}

function statusClass(
  status: "connecting" | "connected" | "live" | "ended" | "error",
) {
  if (status === "live") {
    return "rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 ring-1 ring-red-600/20 animate-pulse";
  }
  if (status === "connecting" || status === "connected") {
    return "rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-600/20";
  }
  if (status === "ended") {
    return "rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700 ring-1 ring-neutral-600/20";
  }
  return "rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 ring-1 ring-red-600/20";
}

async function streamTtsAndPlay(
  text: string,
  onDone: () => void,
): Promise<void> {
  try {
    const response = await fetch("/api/tts/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!response.ok || !response.body) {
      onDone();
      return;
    }

    const chunks: Uint8Array[] = [];
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (!data || data === "{}") continue;

          try {
            const parsed = JSON.parse(data) as { audio?: string };
            if (parsed.audio) {
              const binary = atob(parsed.audio);
              const bytes = new Uint8Array(binary.length);
              for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.codePointAt(i) ?? 0;
              }
              chunks.push(bytes);
            }
          } catch {
            // Skip malformed chunks
          }
        }
      }
    }

    if (chunks.length === 0) {
      onDone();
      return;
    }

    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const fullAudio = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      fullAudio.set(chunk, offset);
      offset += chunk.length;
    }

    const blob = new Blob([fullAudio], { type: "audio/mpeg" });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);

    const cleanup = () => {
      URL.revokeObjectURL(url);
      onDone();
    };

    audio.onended = cleanup;
    audio.onerror = cleanup;
    audio.play().catch(cleanup);
  } catch {
    onDone();
  }
}

function drainAudioQueue(
  queue: { current: AudioQueueItem[] },
  isPlaying: { current: boolean },
) {
  if (isPlaying.current || queue.current.length === 0) return;

  const next = queue.current.shift();
  if (!next) return;

  isPlaying.current = true;

  void streamTtsAndPlay(next.text, () => {
    isPlaying.current = false;
    drainAudioQueue(queue, isPlaying);
  });
}

export function LiveBroadcastPlayer({ gameId, title }: LiveBroadcastPlayerProps) {
  const [status, setStatus] = useState<
    "connecting" | "connected" | "live" | "ended" | "error"
  >("connecting");
  const [error, setError] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [commentary, setCommentary] = useState<LiveCommentaryLine[]>([]);
  const [ttsEnabled, setTtsEnabled] = useState(false);

  const audioQueueRef = useRef<AudioQueueItem[]>([]);
  const isPlayingAudioRef = useRef(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const commentaryIdCounterRef = useRef(0);

  const enableTts = useCallback(() => {
    setTtsEnabled(true);
  }, []);

  useEffect(() => {
    const eventSource = new EventSource(`/api/live/${gameId}/stream`);
    eventSourceRef.current = eventSource;

    eventSource.addEventListener("connected", (e) => {
      setStatus("connected");
      console.log("[live] Connected:", JSON.parse(e.data));
    });

    eventSource.addEventListener("agent_ready", (e) => {
      console.log("[live] Agent ready:", JSON.parse(e.data));
    });

    eventSource.addEventListener("state", (e) => {
      const data = JSON.parse(e.data) as GameState;
      setGameState(data);
      setStatus("live");
    });

    eventSource.addEventListener("commentary", (e) => {
      const data = JSON.parse(e.data) as Omit<LiveCommentaryLine, "id">;
      commentaryIdCounterRef.current += 1;
      const line: LiveCommentaryLine = {
        ...data,
        id: `live-${commentaryIdCounterRef.current}`,
      };

      setCommentary((prev) => [...prev, line].slice(-20));

      if (ttsEnabled) {
        audioQueueRef.current.push({ text: line.text, id: line.id });
        drainAudioQueue(audioQueueRef, isPlayingAudioRef);
      }
    });

    eventSource.addEventListener("ended", (e) => {
      const data = JSON.parse(e.data);
      console.log("[live] Game ended:", data);
      setStatus("ended");
      eventSource.close();
    });

    eventSource.addEventListener("error", (e) => {
      if (eventSource.readyState === EventSource.CLOSED) {
        setStatus("error");
        setError("Connection lost");
      } else {
        try {
          const data = JSON.parse((e as MessageEvent).data);
          console.error("[live] Error:", data);
        } catch {
          console.error("[live] SSE error");
        }
      }
    });

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, [gameId, ttsEnabled]);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-6">
        <div className="rounded-xl p-6 ring-1 ring-black/10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-sm/6 text-red-600">Live broadcast</p>
              <h2 className="mt-1 text-xl font-semibold text-neutral-950">
                {title ?? (gameState ? `${gameState.awayTeam} at ${gameState.homeTeam}` : "Loading...")}
              </h2>
              {gameState && (
                <p className="mt-1 text-sm/6 text-neutral-600">
                  {gameState.status} {gameState.clock && `• ${gameState.clock}`}
                </p>
              )}
            </div>
            <span className={statusClass(status)}>{statusLabel(status)}</span>
          </div>

          {gameState && (
            <div className="mt-6 flex items-center justify-center gap-8">
              <div className="text-center">
                <p className="text-sm font-medium text-neutral-600">
                  {gameState.awayTeam}
                </p>
                <p className="mt-1 text-4xl font-bold tabular-nums text-neutral-950">
                  {gameState.awayScore}
                </p>
              </div>
              <div className="text-2xl font-light text-neutral-400">—</div>
              <div className="text-center">
                <p className="text-sm font-medium text-neutral-600">
                  {gameState.homeTeam}
                </p>
                <p className="mt-1 text-4xl font-bold tabular-nums text-neutral-950">
                  {gameState.homeScore}
                </p>
              </div>
            </div>
          )}

          {gameState?.period && (
            <p className="mt-4 text-center text-sm/6 text-neutral-600">
              {gameState.period}
            </p>
          )}

          {error && (
            <p className="mt-4 text-sm/6 text-red-700" role="alert">
              {error}
            </p>
          )}

          {!ttsEnabled && status === "live" && (
            <button
              onClick={enableTts}
              className="mt-6 w-full rounded-lg bg-neutral-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 transition-colors"
            >
              Enable Voice Commentary
            </button>
          )}

          {ttsEnabled && (
            <p className="mt-4 text-center text-sm/6 text-emerald-600">
              🎙️ Voice commentary enabled
            </p>
          )}
        </div>

        <div className="rounded-xl p-5 ring-1 ring-black/10 sm:p-6">
          <h3 className="text-sm font-medium text-neutral-600">How it works</h3>
          <p className="mt-2 text-sm/6 text-neutral-600">
            This page connects to a live ESPN feed and generates AI commentary
            in real-time. The system polls for game updates every 15 seconds and
            creates broadcast-style commentary for scoring plays, key moments,
            and period changes.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <div className="min-h-64 flex-1 rounded-xl p-5 ring-1 ring-black/10 sm:p-6">
          <h3 className="text-lg font-semibold text-neutral-950">
            Live Commentary
          </h3>
          <ul className="mt-4 flex max-h-[500px] flex-col gap-3 overflow-y-auto">
            {commentary.length === 0 ? (
              <li className="text-sm/6 text-neutral-600">
                {status === "connecting"
                  ? "Connecting to game feed..."
                  : status === "connected"
                    ? "Waiting for game events..."
                    : status === "live"
                      ? "Listening for plays..."
                      : "No commentary yet"}
              </li>
            ) : (
              commentary.map((line) => (
                <li
                  key={line.id}
                  className={`rounded-lg px-3 py-2 text-sm/6 ${
                    line.type === "score"
                      ? "bg-amber-50 text-amber-900 ring-1 ring-amber-200"
                      : "bg-neutral-950/[0.03] text-neutral-800"
                  }`}
                >
                  <span className="font-medium">
                    {line.score.away}-{line.score.home}
                  </span>{" "}
                  {line.text}
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
