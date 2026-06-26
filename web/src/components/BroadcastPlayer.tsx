"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BroadcastDebugPane } from "@/components/BroadcastDebugPane";
import { type DemoGame, videoUrl } from "@/lib/demo-games";
import { templateCommentary } from "@/lib/commentary-prompts";
import type { CommentaryDebugEntry, TimelineDebugInfo } from "@/lib/debug-types";
import type { GameBroadcastContext } from "@/lib/game-context";
import { type TimelineEvent } from "@/lib/timeline";

type CommentaryLine = {
  key: string;
  id: string;
  text: string;
  trigger: string;
  videoAt: number;
  source: CommentaryDebugEntry["source"] | "cursor";
};

function eventCacheKey(event: TimelineEvent): string {
  return `${event.id}@${event.videoAt.toFixed(1)}`;
}

type CachedCommentary = {
  text: string;
  source: CommentaryDebugEntry["source"] | "cursor";
  userPrompt?: string;
  model?: string;
  generatedAt: string;
  cursorAgentId?: string;
};

type BroadcastPlayerProps = {
  game: DemoGame;
};

const COMMENTARY_LEAD_SECONDS = 180;
/** Fire a cached line when the video is this close to the event timestamp. */
const PLAYBACK_FIRE_AHEAD_SECONDS = 1.5;
/** Events to prefetch per pipeline pass (sequential for recentLines context). */
const PREFETCH_PIPELINE_BATCH = 10;

function isEventDue(currentTime: number, event: TimelineEvent): boolean {
  return currentTime >= event.videoAt - PLAYBACK_FIRE_AHEAD_SECONDS;
}

type CommentaryPurpose = "prefetch" | "playback";

type AudioQueueItem = {
  url?: string;
  text?: string;
  streaming?: boolean;
};

function drainAudioQueue(
  queue: { current: AudioQueueItem[] },
  isPlaying: { current: boolean },
  retainUrls: { current: Set<string> },
  onAudioStart?: () => void,
  onAudioEnd?: () => void,
) {
  if (isPlaying.current || queue.current.length === 0) return;

  const next = queue.current.shift();
  if (!next) return;

  isPlaying.current = true;
  onAudioStart?.();

  if (next.streaming && next.text) {
    void streamTtsAndPlay(next.text, () => {
      isPlaying.current = false;
      onAudioEnd?.();
      drainAudioQueue(queue, isPlaying, retainUrls, onAudioStart, onAudioEnd);
    });
    return;
  }

  if (!next.url) {
    isPlaying.current = false;
    drainAudioQueue(queue, isPlaying, retainUrls, onAudioStart, onAudioEnd);
    return;
  }

  const audio = new Audio(next.url);
  const onDone = () => {
    if (!retainUrls.current.has(next.url!)) {
      URL.revokeObjectURL(next.url!);
    }
    isPlaying.current = false;
    onAudioEnd?.();
    drainAudioQueue(queue, isPlaying, retainUrls, onAudioStart, onAudioEnd);
  };
  audio.onended = onDone;
  audio.onerror = onDone;
  audio.play().catch(onDone);
}

async function streamTtsAndPlay(text: string, onDone: () => void): Promise<void> {
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
            const parsed = JSON.parse(data) as { audio?: string; error?: string };
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


function formatScore(away: number | null, home: number | null) {
  if (away === null || home === null) return "0 – 0";
  return `${away} – ${home}`;
}

function statusLabel(status: "loading" | "ready" | "live" | "buffering" | "error") {
  if (status === "live") return "On air";
  if (status === "buffering") return "Buffering";
  if (status === "loading") return "Loading";
  if (status === "ready") return "Press play";
  return "Offline";
}

function statusClass(status: "loading" | "ready" | "live" | "buffering" | "error") {
  if (status === "live") {
    return "rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-600/20";
  }
  if (status === "buffering") {
    return "rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700 ring-1 ring-violet-600/20";
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
  const audioQueueRef = useRef<AudioQueueItem[]>([]);
  const isPlayingAudioRef = useRef(false);
  const audioUnlockedRef = useRef(false);
  const playbackActiveRef = useRef(false);
  const lastSyncRef = useRef(0);
  const prefetchPipelineRunningRef = useRef(false);
  const commentaryRef = useRef<CommentaryLine[]>([]);
  const retainedTtsUrlsRef = useRef<Set<string>>(new Set());
  const schedulePrefetchRef = useRef<() => void>(() => {});

  const [status, setStatus] = useState<"loading" | "ready" | "live" | "buffering" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [scoreAway, setScoreAway] = useState(0);
  const [scoreHome, setScoreHome] = useState(0);
  const [period, setPeriod] = useState<string | null>(null);
  const [commentary, setCommentary] = useState<CommentaryLine[]>([]);
  const [timelineReady, setTimelineReady] = useState(false);
  const [llmAvailable, setLlmAvailable] = useState(false);
  const [ttsAvailable, setTtsAvailable] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [commentaryDebugLog, setCommentaryDebugLog] = useState<CommentaryDebugEntry[]>([]);
  const [timelineDebug, setTimelineDebug] = useState<TimelineDebugInfo | null>(null);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const gameContextRef = useRef<GameBroadcastContext | null>(null);
  const commentaryCacheRef = useRef<Map<string, CachedCommentary>>(new Map());
  const cursorAgentIdRef = useRef<string | undefined>(undefined);
  const cursorCloudAgentsRef = useRef(false);
  const streamAgentBootstrapRef = useRef<Promise<boolean> | null>(null);
  const llmAvailableRef = useRef(false);
  const ttsAvailableRef = useRef(false);
  const timelineLoadedDurationRef = useRef<number | null>(null);
  const timelineLoadInFlightRef = useRef(false);
  const commentaryFetchChainRef = useRef<Promise<unknown>>(Promise.resolve());
  const inFlightCommentaryRef = useRef<Map<string, Promise<CachedCommentary>>>(new Map());
  const cursorPausedUntilRef = useRef(0);
  const playbackQueueRef = useRef<TimelineEvent[]>([]);
  const playbackPumpRunningRef = useRef(false);
  const pumpPlaybackQueueRef = useRef<() => void>(() => {});
  const enqueuePlaybackRef = useRef<(event: TimelineEvent) => void>(() => {});

  const resolveCommentaryLocally = useCallback(
    (event: TimelineEvent): CachedCommentary => {
      const generatedAt = new Date().toISOString();
      const text = templateCommentary(event, game.title, gameContextRef.current ?? undefined);
      const result: CachedCommentary = { text, source: "template", generatedAt };
      commentaryCacheRef.current.set(eventCacheKey(event), result);
      return result;
    },
    [game.title],
  );

  const runSerializedCommentaryFetch = useCallback(<T,>(fn: () => Promise<T>): Promise<T> => {
    const task = commentaryFetchChainRef.current.then(fn, fn);
    commentaryFetchChainRef.current = task.then(
      () => undefined,
      () => undefined,
    );
    return task;
  }, []);

  const bootstrapStreamSession = useCallback(async (): Promise<boolean> => {
    if (!cursorCloudAgentsRef.current) return true;
    if (cursorAgentIdRef.current) return true;
    if (streamAgentBootstrapRef.current) return streamAgentBootstrapRef.current;

    const task = runSerializedCommentaryFetch(async (): Promise<boolean> => {
      try {
        const response = await fetch("/api/commentary/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            gameId: game.id,
            gameTitle: game.title,
            persona: game.persona,
            gameContext: gameContextRef.current ?? undefined,
            cursorAgentId: cursorAgentIdRef.current,
          }),
        });
        const data = (await response.json()) as {
          cursorAgentId?: string;
          error?: string;
        };

        if (!response.ok || !data.cursorAgentId) {
          if (response.status === 429 || /rate limit/i.test(data.error ?? "")) {
            cursorPausedUntilRef.current = Date.now() + 60_000;
          }
          return false;
        }

        cursorAgentIdRef.current = data.cursorAgentId;
        return true;
      } catch {
        return false;
      } finally {
        streamAgentBootstrapRef.current = null;
      }
    });

    streamAgentBootstrapRef.current = task;
    return task;
  }, [game.id, game.persona, game.title, runSerializedCommentaryFetch]);

  const fetchCommentary = useCallback(
    async (
      event: TimelineEvent,
      recentLines: string[],
      purpose: CommentaryPurpose,
    ): Promise<CachedCommentary> => {
      const cacheKey = eventCacheKey(event);
      const cached = commentaryCacheRef.current.get(cacheKey);
      if (cached) return cached;

      if (!llmAvailableRef.current) {
        return resolveCommentaryLocally(event);
      }

      if (Date.now() < cursorPausedUntilRef.current) {
        return resolveCommentaryLocally(event);
      }

      if (cursorCloudAgentsRef.current) {
        const ready = await bootstrapStreamSession();
        if (!ready || !cursorAgentIdRef.current) {
          return resolveCommentaryLocally(event);
        }
      }

      const inFlight = inFlightCommentaryRef.current.get(cacheKey);
      if (inFlight) return inFlight;

      const doFetch = async (): Promise<CachedCommentary> => {
        const generatedAt = new Date().toISOString();
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
              cursorAgentId: cursorAgentIdRef.current,
              purpose,
            }),
          });
          const data = (await response.json()) as {
            text?: string;
            source?: "llm" | "template" | "cursor";
            error?: string;
            cursorAgentId?: string;
            debug?: {
              userPrompt?: string;
              model?: string;
              generatedAt?: string;
            };
          };

          if (response.status === 429 || /rate limit/i.test(data.error ?? "")) {
            cursorPausedUntilRef.current = Date.now() + 60_000;
            return resolveCommentaryLocally(event);
          }

          if (
            response.status === 502 &&
            /cloud agent limit|agent busy|agent limit/i.test(data.error ?? "")
          ) {
            cursorPausedUntilRef.current = Date.now() + 30_000;
            return resolveCommentaryLocally(event);
          }

          if (!response.ok || !data.text?.trim()) {
            return resolveCommentaryLocally(event);
          }

          if (data.cursorAgentId) {
            cursorAgentIdRef.current = data.cursorAgentId;
          }
          const result: CachedCommentary = {
            text: data.text,
            source: data.source ?? "template",
            userPrompt: data.debug?.userPrompt,
            model: data.debug?.model,
            generatedAt: data.debug?.generatedAt ?? generatedAt,
            cursorAgentId: data.cursorAgentId,
          };
          commentaryCacheRef.current.set(cacheKey, result);
          return result;
        } catch {
          return resolveCommentaryLocally(event);
        }
      };

      const request = runSerializedCommentaryFetch(doFetch).finally(() => {
        inFlightCommentaryRef.current.delete(cacheKey);
      });

      inFlightCommentaryRef.current.set(cacheKey, request);
      return request;
    },
    [bootstrapStreamSession, game.persona, game.title, resolveCommentaryLocally, runSerializedCommentaryFetch],
  );

  const speakCommentary = useCallback(
    (text: string) => {
      if (!ttsAvailableRef.current || !audioUnlockedRef.current || !text.trim()) {
        return;
      }

      audioQueueRef.current.push({ text, streaming: true });
      drainAudioQueue(
        audioQueueRef,
        isPlayingAudioRef,
        retainedTtsUrlsRef,
        () => schedulePrefetchRef.current(),
        () => schedulePrefetchRef.current(),
      );
    },
    [],
  );

  const deliverCommentary = useCallback(
    (event: TimelineEvent, cached: CachedCommentary) => {
      const firedKey = eventCacheKey(event);
      if (firedRef.current.has(firedKey)) return;

      const videoAt = videoRef.current?.currentTime ?? event.videoAt;
      const recentLines = commentaryRef.current.map((line) => line.text);

      setScoreAway(event.scoreAway);
      setScoreHome(event.scoreHome);
      setPeriod(event.periodLabel);

      setCommentaryDebugLog((prev) => [
        ...prev,
        {
          id: firedKey,
          generatedAt: cached.generatedAt,
          videoAt,
          source: cached.source,
          text: cached.text,
          event,
          model: cached.model,
          userPrompt: cached.userPrompt,
          recentLines,
        },
      ]);

      firedRef.current.add(firedKey);

      setCommentary((prev) => {
        const next = [
          ...prev,
          {
            key: firedKey,
            id: event.id,
            text: cached.text,
            trigger: event.kind,
            videoAt: event.videoAt,
            source: cached.source,
          },
        ];
        commentaryRef.current = next;
        return next;
      });

      speakCommentary(cached.text);
    },
    [speakCommentary],
  );

  const pumpPlaybackQueue = useCallback(async () => {
    if (playbackPumpRunningRef.current) return;
    playbackPumpRunningRef.current = true;

    try {
      while (playbackQueueRef.current.length > 0) {
        const event = playbackQueueRef.current[0];
        const firedKey = eventCacheKey(event);

        if (firedRef.current.has(firedKey)) {
          playbackQueueRef.current.shift();
          continue;
        }

        const recentLines = commentaryRef.current.map((line) => line.text).slice(-4);
        let cached: CachedCommentary;
        try {
          cached = await fetchCommentary(event, recentLines, "playback");
        } catch {
          cached = resolveCommentaryLocally(event);
        }

        deliverCommentary(event, cached);
        playbackQueueRef.current.shift();
        schedulePrefetchRef.current();
      }
    } finally {
      playbackPumpRunningRef.current = false;
      if (playbackQueueRef.current.length > 0) {
        void pumpPlaybackQueue();
      }
    }
  }, [deliverCommentary, fetchCommentary, resolveCommentaryLocally]);

  const enqueuePlayback = useCallback(
    (event: TimelineEvent) => {
      const firedKey = eventCacheKey(event);
      if (firedRef.current.has(firedKey)) return;

      const cached = commentaryCacheRef.current.get(firedKey);
      if (cached) {
        deliverCommentary(event, cached);
        return;
      }

      if (playbackQueueRef.current.some((queued) => eventCacheKey(queued) === firedKey)) {
        return;
      }

      playbackQueueRef.current.push(event);
      playbackQueueRef.current.sort((a, b) => a.videoAt - b.videoAt);
      void pumpPlaybackQueue();
    },
    [deliverCommentary, pumpPlaybackQueue],
  );

  useEffect(() => {
    pumpPlaybackQueueRef.current = () => {
      void pumpPlaybackQueue();
    };
    enqueuePlaybackRef.current = enqueuePlayback;
  }, [enqueuePlayback, pumpPlaybackQueue]);

  const runPrefetchPipeline = useCallback(
    async () => {
      if (!llmAvailableRef.current) return;
      if (prefetchPipelineRunningRef.current) return;
      if (Date.now() < cursorPausedUntilRef.current) return;

      prefetchPipelineRunningRef.current = true;

      try {
        const currentTime = videoRef.current?.currentTime ?? 0;
        const recentLines = commentaryRef.current.map((line) => line.text).slice(-4);

        const upcoming = timelineRef.current
          .filter((event) => !firedRef.current.has(eventCacheKey(event)))
          .filter((event) => event.videoAt >= currentTime - 2)
          .filter((event) => event.videoAt <= currentTime + COMMENTARY_LEAD_SECONDS)
          .filter((event) => !commentaryCacheRef.current.has(eventCacheKey(event)))
          .sort((a, b) => a.videoAt - b.videoAt)
          .slice(0, PREFETCH_PIPELINE_BATCH);

        for (const event of upcoming) {
          const cacheKey = eventCacheKey(event);
          if (commentaryCacheRef.current.has(cacheKey)) continue;

          const result = await fetchCommentary(event, [...recentLines], "prefetch");
          recentLines.push(result.text);
          if (recentLines.length > 4) recentLines.shift();

          if (isEventDue(videoRef.current?.currentTime ?? 0, event)) {
            enqueuePlaybackRef.current(event);
          }
        }
      } finally {
        prefetchPipelineRunningRef.current = false;
      }
    },
    [fetchCommentary],
  );

  useEffect(() => {
    schedulePrefetchRef.current = () => {
      void runPrefetchPipeline();
    };
  }, [runPrefetchPipeline]);

  const schedulePrefetch = useCallback(() => {
    void runPrefetchPipeline();
  }, [runPrefetchPipeline]);

  const syncToVideoTime = useCallback(
    (currentTime: number) => {
      if (!timelineReady || !playbackActiveRef.current) return;

      const due = timelineRef.current
        .filter((event) => {
          const key = eventCacheKey(event);
          if (firedRef.current.has(key)) return false;
          return isEventDue(currentTime, event);
        })
        .sort((a, b) => a.videoAt - b.videoAt);

      for (const event of due) {
        enqueuePlayback(event);
      }
    },
    [enqueuePlayback, timelineReady],
  );

  const loadTimeline = useCallback(
    async (duration: number) => {
      if (timelineLoadInFlightRef.current) return;
      if (timelineLoadedDurationRef.current === duration && timelineRef.current.length > 0) {
        return;
      }

      timelineLoadInFlightRef.current = true;
      try {
        const statusResponse = await fetch("/api/commentary/status");
        if (statusResponse.ok) {
          const status = (await statusResponse.json()) as {
            providers?: { cursorCloudAgents?: boolean; openAi?: boolean; elevenLabs?: boolean };
          };
          llmAvailableRef.current = Boolean(
            status.providers?.cursorCloudAgents || status.providers?.openAi,
          );
          cursorCloudAgentsRef.current = Boolean(status.providers?.cursorCloudAgents);
          ttsAvailableRef.current = Boolean(status.providers?.elevenLabs);
          setLlmAvailable(llmAvailableRef.current);
          setTtsAvailable(ttsAvailableRef.current);
        }

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
        playbackQueueRef.current = [];
        commentaryCacheRef.current.clear();
        for (const url of retainedTtsUrlsRef.current) {
          URL.revokeObjectURL(url);
        }
        retainedTtsUrlsRef.current.clear();
        cursorAgentIdRef.current = undefined;
        streamAgentBootstrapRef.current = null;
        commentaryRef.current = [];
        setCommentary([]);
        setCommentaryDebugLog([]);
        timelineLoadedDurationRef.current = duration;
        setTimelineReady(true);
        setStatus("ready");

        if (llmAvailableRef.current) {
          if (cursorCloudAgentsRef.current) {
            const ready = await bootstrapStreamSession();
            if (ready) {
              void runPrefetchPipeline();
            }
          } else {
            void runPrefetchPipeline();
          }
        }
      } catch {
        setError("Could not build ESPN timeline for this video.");
        setStatus("error");
      } finally {
        timelineLoadInFlightRef.current = false;
      }
    },
    [bootstrapStreamSession, game.id, runPrefetchPipeline],
  );

  const unlockAudio = useCallback(() => {
    audioUnlockedRef.current = true;
    playbackActiveRef.current = true;
    setStatus("live");
    drainAudioQueue(
      audioQueueRef,
      isPlayingAudioRef,
      retainedTtsUrlsRef,
      () => schedulePrefetchRef.current(),
      () => schedulePrefetchRef.current(),
    );

    void runPrefetchPipeline();
    syncToVideoTime(videoRef.current?.currentTime ?? 0);
  }, [runPrefetchPipeline, syncToVideoTime]);

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
      if (now - lastSyncRef.current < 150) return;
      lastSyncRef.current = now;
      syncToVideoTime(video.currentTime);
      schedulePrefetch();
    };

    const onSeeked = () => {
      const t = video.currentTime;
      for (const event of timelineRef.current) {
        const firedKey = eventCacheKey(event);
        if (event.videoAt > t + 1) {
          firedRef.current.delete(firedKey);
        }
      }

      playbackQueueRef.current = playbackQueueRef.current.filter(
        (event) => event.videoAt <= t + 1,
      );

      setCommentary((prev) => {
        const next = prev.filter((line) => line.videoAt <= t + 1);
        commentaryRef.current = next;
        return next;
      });
      setCommentaryDebugLog((prev) => prev.filter((entry) => entry.videoAt <= t + 1));

      audioQueueRef.current = [];
      isPlayingAudioRef.current = false;

      syncToVideoTime(t);
      void runPrefetchPipeline();
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
      for (const item of audioQueueRef.current) {
        if (item.url && !retainedTtsUrlsRef.current.has(item.url)) {
          URL.revokeObjectURL(item.url);
        }
      }
      audioQueueRef.current = [];
      for (const url of retainedTtsUrlsRef.current) {
        URL.revokeObjectURL(url);
      }
      retainedTtsUrlsRef.current.clear();
    };
  }, [loadTimeline, runPrefetchPipeline, schedulePrefetch, syncToVideoTime, unlockAudio]);

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
          Press play to start. AI commentary is prefetched ahead of the video — if a line is not
          ready yet, playback pauses briefly (status: Buffering) until it is.
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
                  ? llmAvailable && ttsAvailable
                    ? "Press play — AI commentary and ElevenLabs voice are ready."
                    : llmAvailable
                      ? "Press play — AI commentary ready (add ELEVENLABS_API_KEY for voice)."
                      : "Press play — template commentary runs locally (add CURSOR_API_KEY for AI)."
                  : "Building highlight timeline from ESPN data…"}
              </li>
            ) : (
              commentary.map((line) => (
                <li
                  key={line.key}
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
