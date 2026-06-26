"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BroadcastDebugPane } from "@/components/BroadcastDebugPane";
import { type DemoGame, videoUrl } from "@/lib/demo-games";
import { templateCommentary } from "@/lib/commentary-prompts";
import type { CommentaryDebugEntry, TimelineDebugInfo } from "@/lib/debug-types";
import type { GameBroadcastContext } from "@/lib/game-context";
import { type TimelineEvent } from "@/lib/timeline";

type CommentaryLine = {
  id: string;
  text: string;
  trigger: string;
};

type BroadcastPlayerProps = {
  game: DemoGame;
};

function drainAudioQueue(
  queue: { current: string[] },
  isPlaying: { current: boolean },
) {
  if (isPlaying.current || queue.current.length === 0) return;

  const next = queue.current.shift();
  if (!next) return;

  isPlaying.current = true;
  const audio = new Audio(next);
  const onDone = () => {
    URL.revokeObjectURL(next);
    isPlaying.current = false;
    drainAudioQueue(queue, isPlaying);
  };
  audio.onended = onDone;
  audio.onerror = onDone;
  audio.play().catch(onDone);
}

function formatScore(away: number | null, home: number | null) {
  if (away === null || home === null) return "0 – 0";
  return `${away} – ${home}`;
}

function statusLabel(status: "loading" | "ready" | "live" | "error") {
  if (status === "live") return "On air";
  if (status === "loading") return "Loading";
  if (status === "ready") return "Press play";
  return "Offline";
}

function statusClass(status: "loading" | "ready" | "live" | "error") {
  if (status === "live") {
    return "rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-600/20";
  }
  if (status === "loading") {
    return "rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-600/20";
  }
  if (status === "ready") {
    return "rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700 ring-1 ring-sky-600/20";
  }
  return "rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 ring-1 ring-red-600/20";
}

export function BroadcastPlayer({ game }: BroadcastPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<TimelineEvent[]>([]);
  const firedRef = useRef<Set<string>>(new Set());
  const processingRef = useRef<Set<string>>(new Set());
  const audioQueueRef = useRef<string[]>([]);
  const isPlayingAudioRef = useRef(false);
  const audioUnlockedRef = useRef(false);
  const lastSyncRef = useRef(0);
  const commentaryRef = useRef<CommentaryLine[]>([]);

  const [status, setStatus] = useState<"loading" | "ready" | "live" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [scoreAway, setScoreAway] = useState(0);
  const [scoreHome, setScoreHome] = useState(0);
  const [period, setPeriod] = useState<string | null>(null);
  const [commentary, setCommentary] = useState<CommentaryLine[]>([]);
  const [timelineReady, setTimelineReady] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [commentaryDebugLog, setCommentaryDebugLog] = useState<CommentaryDebugEntry[]>([]);
  const [timelineDebug, setTimelineDebug] = useState<TimelineDebugInfo | null>(null);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const gameContextRef = useRef<GameBroadcastContext | null>(null);

  const playTts = useCallback(async (text: string) => {
    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!response.ok) return;

      const { audioBase64, mime } = (await response.json()) as {
        audioBase64: string;
        mime: string;
      };

      const binary = atob(audioBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: mime });
      audioQueueRef.current.push(URL.createObjectURL(blob));
      drainAudioQueue(audioQueueRef, isPlayingAudioRef);
    } catch {
      // TTS optional — captions still show
    }
  }, []);

  const fireEvent = useCallback(
    async (event: TimelineEvent) => {
      if (firedRef.current.has(event.id) || processingRef.current.has(event.id)) {
        return;
      }
      processingRef.current.add(event.id);

      setScoreAway(event.scoreAway);
      setScoreHome(event.scoreHome);
      setPeriod(event.periodLabel);

      const recentLines = commentaryRef.current.map((line) => line.text);
      const generatedAt = new Date().toISOString();
      const videoAt = videoRef.current?.currentTime ?? event.videoAt;

      let line = "";
      let source: CommentaryDebugEntry["source"] = "fallback";
      let userPrompt: string | undefined;
      let model: string | undefined;

      try {
        const response = await fetch("/api/commentary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event,
            gameTitle: game.title,
            persona: game.persona,
            gameContext: gameContextRef.current ?? undefined,
            recentLines,
          }),
        });
        const data = (await response.json()) as {
          text: string;
          source?: "llm" | "template";
          debug?: {
            userPrompt?: string;
            model?: string;
            generatedAt?: string;
          };
        };
        line = data.text;
        source = data.source ?? "template";
        userPrompt = data.debug?.userPrompt;
        model = data.debug?.model;

        setCommentaryDebugLog((prev) => [
          ...prev,
          {
            id: event.id,
            generatedAt: data.debug?.generatedAt ?? generatedAt,
            videoAt,
            source,
            text: line,
            event,
            model,
            userPrompt,
            recentLines,
          },
        ]);
      } catch {
        line = templateCommentary(event, game.title, gameContextRef.current ?? undefined);
        setCommentaryDebugLog((prev) => [
          ...prev,
          {
            id: event.id,
            generatedAt,
            videoAt,
            source: "fallback",
            text: line,
            event,
            recentLines,
          },
        ]);
      }

      firedRef.current.add(event.id);
      processingRef.current.delete(event.id);

      setCommentary((prev) => {
        const next = [
          ...prev,
          { id: event.id, text: line, trigger: event.kind },
        ];
        commentaryRef.current = next;
        return next;
      });

      if (audioUnlockedRef.current) {
        void playTts(line);
      }
    },
    [game.persona, game.title, playTts],
  );

  const syncToVideoTime = useCallback(
    (currentTime: number) => {
      if (!timelineReady) return;

      const due = timelineRef.current.filter(
        (event) => event.videoAt <= currentTime && !firedRef.current.has(event.id),
      );

      for (const event of due) {
        void fireEvent(event);
      }
    },
    [fireEvent, timelineReady],
  );

  const loadTimeline = useCallback(
    async (duration: number) => {
      try {
        const response = await fetch(
          `/api/timeline?gameId=${game.id}&duration=${duration}`,
        );
        if (!response.ok) {
          throw new Error("Failed to load timeline");
        }
        const data = (await response.json()) as {
          events: TimelineEvent[];
          gameContext?: GameBroadcastContext;
          debug?: TimelineDebugInfo;
        };
        timelineRef.current = data.events;
        gameContextRef.current = data.gameContext ?? data.debug?.gameContext ?? null;
        setTimelineDebug(data.debug ?? null);
        firedRef.current.clear();
        processingRef.current.clear();
        commentaryRef.current = [];
        setCommentary([]);
        setCommentaryDebugLog([]);
        setTimelineReady(true);
        setStatus("ready");
        syncToVideoTime(videoRef.current?.currentTime ?? 0);
      } catch {
        setError("Could not build ESPN timeline for this video.");
        setStatus("error");
      }
    },
    [game.id, syncToVideoTime],
  );

  const unlockAudio = useCallback(() => {
    audioUnlockedRef.current = true;
    setStatus("live");
    drainAudioQueue(audioQueueRef, isPlayingAudioRef);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onLoadedMetadata = () => {
      if (video.duration && Number.isFinite(video.duration)) {
        void loadTimeline(video.duration);
      }
    };

    const onPlay = () => {
      unlockAudio();
    };

    const onTimeUpdate = () => {
      setVideoCurrentTime(video.currentTime);
      const now = Date.now();
      if (now - lastSyncRef.current < 250) return;
      lastSyncRef.current = now;
      syncToVideoTime(video.currentTime);
    };

    const onSeeked = () => {
      syncToVideoTime(video.currentTime);
    };

    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("play", onPlay);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("seeked", onSeeked);

    if (video.readyState >= 1 && video.duration) {
      void loadTimeline(video.duration);
    }

    return () => {
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("seeked", onSeeked);
      for (const url of audioQueueRef.current) {
        URL.revokeObjectURL(url);
      }
      audioQueueRef.current = [];
    };
  }, [loadTimeline, syncToVideoTime, unlockAudio]);

  return (
    <div>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div>
        <div className="overflow-hidden rounded-xl ring-1 ring-black/10">
          <video
            ref={videoRef}
            className="aspect-video w-full bg-neutral-950"
            src={videoUrl(game.videoFile)}
            controls
            muted
            playsInline
            preload="metadata"
          />
        </div>
        <p className="mt-3 text-sm/6 text-neutral-600">
          Press play to start. Score and AI voice-over sync to the highlight timeline
          (ESPN scoring plays mapped to video position).
        </p>
      </div>

      <div className="flex flex-col gap-6">
        <div className="rounded-xl p-5 ring-1 ring-black/10 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-sm/6 text-emerald-700">Live booth</p>
              <h2 className="mt-1 text-xl font-semibold text-neutral-950">{game.title}</h2>
              <p className="mt-1 text-sm/6 text-neutral-600">{game.subtitle}</p>
            </div>
            <span className={statusClass(status)}>{statusLabel(status)}</span>
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-4">
            <div>
              <dt className="text-sm/6 text-neutral-600">Score</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums text-neutral-950">
                {formatScore(scoreAway, scoreHome)}
              </dd>
            </div>
            <div>
              <dt className="text-sm/6 text-neutral-600">Final (ESPN)</dt>
              <dd className="mt-1 text-sm/6 font-medium text-neutral-950">{game.finalScore}</dd>
            </div>
          </dl>

          {period ? <p className="mt-4 text-sm/6 text-neutral-600">{period}</p> : null}

          {error ? (
            <p className="mt-4 text-sm/6 text-red-700" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className="min-h-64 flex-1 rounded-xl p-5 ring-1 ring-black/10 sm:p-6">
          <h3 className="text-lg font-semibold text-neutral-950">Commentary</h3>
          <ul className="mt-4 flex max-h-96 flex-col gap-3 overflow-y-auto">
            {commentary.length === 0 ? (
              <li className="text-sm/6 text-neutral-600">
                {timelineReady
                  ? "Press play — commentary follows the video timeline."
                  : "Building timeline from ESPN scoring data…"}
              </li>
            ) : (
              commentary.map((line) => (
                <li
                  key={line.id}
                  className="rounded-lg bg-neutral-950/[0.03] px-3 py-2 text-sm/6 text-neutral-800"
                >
                  {line.text}
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
      </div>

      <BroadcastDebugPane
        open={debugOpen}
        onToggle={() => setDebugOpen((prev) => !prev)}
        commentaryLog={commentaryDebugLog}
        timelineDebug={timelineDebug}
        videoCurrentTime={videoCurrentTime}
      />
    </div>
  );
}
