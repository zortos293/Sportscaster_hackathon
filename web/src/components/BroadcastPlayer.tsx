"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BroadcastDebugPane } from "@/components/BroadcastDebugPane";
import { type BroadcastGame, usesNativeVideoAudio, usesBundledCommentary, videoUrl } from "@/lib/broadcast-game";
import { getBundledCommentaryLine, getBundledCommentaryLines } from "@/lib/demo-static-timelines";
import { templateCommentary } from "@/lib/commentary-prompts";
import type { CommentaryDebugEntry, TimelineDebugInfo } from "@/lib/debug-types";
import type { GameBroadcastContext } from "@/lib/game-context";
import { filterMajorTimelineEvents, isMajorTimelineEvent } from "@/lib/match-event-filter";
import { type TimelineEvent } from "@/lib/timeline";

type CommentaryLine = {
  key: string;
  id: string;
  text: string;
  trigger: string;
  videoAt: number;
  source: CommentaryDebugEntry["source"] | "cursor";
};

type TimelineMarker = {
  key: string;
  label: string;
  title: string;
  videoAt: number;
  className: string;
};

import { eventCacheKey } from "@/lib/match-cache";
type CachedCommentary = {
  text: string;
  source: CommentaryDebugEntry["source"] | "cursor" | "bundled";
  audioUrl?: string;
  userPrompt?: string;
  model?: string;
  generatedAt: string;
  cursorAgentId?: string;
};

type BroadcastPlayerProps = {
  game: BroadcastGame;
};

const SYNC_LOOKAHEAD_SECONDS = 3;
const PLAYBACK_FIRE_AHEAD_SECONDS = SYNC_LOOKAHEAD_SECONDS;
const INITIAL_PREFETCH_LIMIT = 8;
const ROLLING_PREFETCH_SECONDS = 45;
const COMMENTARY_LEAD_SECONDS = ROLLING_PREFETCH_SECONDS;
const PREFETCH_PIPELINE_BATCH = INITIAL_PREFETCH_LIMIT;

function isEventDue(currentTime: number, event: TimelineEvent): boolean {
  return currentTime >= event.videoAt - PLAYBACK_FIRE_AHEAD_SECONDS;
}

type CommentaryPurpose = "prefetch" | "playback";

type AudioQueueItem = {
  url?: string;
  text?: string;
  gameId?: string;
  eventKey?: string;
  revokeUrl?: boolean;
};

type ResolvedAudio = {
  url: string;
  revokeUrl: boolean;
};

async function fetchTtsAudioUrl(
  text: string,
  options: { gameId?: string; eventKey?: string } = {},
): Promise<ResolvedAudio | null> {
  const response = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      gameId: options.gameId,
      eventKey: options.eventKey,
    }),
  });

  if (!response.ok) return null;

  const data = (await response.json()) as {
    audioUrl?: string;
    audioBase64?: string;
    mime?: string;
  };

  if (data.audioUrl) {
    return { url: data.audioUrl, revokeUrl: false };
  }

  if (!data.audioBase64) return null;

  const binary = atob(data.audioBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: data.mime ?? "audio/mpeg" });
  return { url: URL.createObjectURL(blob), revokeUrl: true };
}

function playAudioUrl(
  audioUrl: string,
  revokeUrl: boolean,
  currentAudio: { current: HTMLAudioElement | null },
  onDone: () => void,
) {
  const audio = new Audio(audioUrl);
  currentAudio.current = audio;

  const cleanup = () => {
    if (revokeUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    if (currentAudio.current === audio) {
      currentAudio.current = null;
    }
    onDone();
  };

  audio.onended = cleanup;
  audio.onerror = cleanup;
  audio.play().catch(cleanup);
}

function drainAudioQueue(
  queue: { current: AudioQueueItem[] },
  isPlaying: { current: boolean },
  currentAudio: { current: HTMLAudioElement | null },
) {
  if (isPlaying.current || queue.current.length === 0) return;

  const next = queue.current.shift();
  if (!next) return;

  const finish = () => {
    isPlaying.current = false;
    drainAudioQueue(queue, isPlaying, currentAudio);
  };

  isPlaying.current = true;

  if (next.url) {
    playAudioUrl(next.url, Boolean(next.revokeUrl), currentAudio, finish);
    return;
  }

  if (!next.text?.trim()) {
    finish();
    return;
  }

  void fetchTtsAudioUrl(next.text, {
    gameId: next.gameId,
    eventKey: next.eventKey,
  })
    .then((audio) => {
      if (!audio) {
        finish();
        return;
      }
      playAudioUrl(audio.url, audio.revokeUrl, currentAudio, finish);
    })
    .catch(finish);
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

function markerLabel(event: TimelineEvent): string {
  const text = `${event.description} ${event.context ?? ""}`.toLowerCase();
  if (event.kind === "score") return "Goal";
  if (text.includes("red card")) return "Red card";
  if (text.includes("yellow card")) return "Yellow card";
  if (text.includes("card")) return "Card";
  if (text.includes("substitution")) return "Sub";
  if (event.kind === "period") return event.periodLabel;
  return "Key";
}

function markerClass(event: TimelineEvent): string {
  const text = `${event.description} ${event.context ?? ""}`.toLowerCase();
  if (event.kind === "score") return "bg-emerald-500 ring-emerald-900/20";
  if (text.includes("red card")) return "bg-red-600 ring-red-900/20";
  if (text.includes("yellow card") || text.includes("card")) {
    return "bg-yellow-400 ring-yellow-900/20";
  }
  if (event.kind === "period") return "bg-sky-500 ring-sky-900/20";
  return "bg-purple-500 ring-purple-900/20";
}

function buildTimelineMarkers(events: TimelineEvent[]): TimelineMarker[] {
  const seen = new Set<string>();
  return events
    .filter(isMajorTimelineEvent)
    .filter((event) => {
      const key = eventCacheKey(event);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((event) => ({
      key: eventCacheKey(event),
      label: markerLabel(event),
      title: `${markerLabel(event)} · ${event.periodLabel} · ${event.description}`,
      videoAt: event.videoAt,
      className: markerClass(event),
    }));
}

export function BroadcastPlayer({ game }: BroadcastPlayerProps) {
  const nativeVideoAudio = usesNativeVideoAudio(game);
  const bundledCommentary = usesBundledCommentary(game);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<TimelineEvent[]>([]);
  const firedRef = useRef<Set<string>>(new Set());
  const audioQueueRef = useRef<AudioQueueItem[]>([]);
  const isPlayingAudioRef = useRef(false);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioUnlockedRef = useRef(false);
  const playbackActiveRef = useRef(false);
  const lastSyncRef = useRef(0);
  const prefetchPipelineRunningRef = useRef(false);
  const prefetchStartedRef = useRef(false);
  const prefetchGenerationRef = useRef(0);
  const commentaryRef = useRef<CommentaryLine[]>([]);
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
  const [videoDuration, setVideoDuration] = useState(0);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
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
  const inFlightTtsRef = useRef<Map<string, Promise<string | null>>>(new Map());
  const cursorPausedUntilRef = useRef(0);
  const playbackQueueRef = useRef<TimelineEvent[]>([]);
  const playbackPumpRunningRef = useRef(false);
  const enqueuePlaybackRef = useRef<(event: TimelineEvent) => void>(() => {});

  const resolveCommentaryLocally = useCallback(
    (event: TimelineEvent): CachedCommentary => {
      const generatedAt = new Date().toISOString();
      const bundled = getBundledCommentaryLine(game.id, event);
      if (bundled) {
        const result: CachedCommentary = {
          text: bundled.text,
          source: "bundled",
          generatedAt,
        };
        commentaryCacheRef.current.set(eventCacheKey(event), result);
        return result;
      }

      const text = templateCommentary(event, game.title, gameContextRef.current ?? undefined);
      const result: CachedCommentary = { text, source: "template", generatedAt };
      commentaryCacheRef.current.set(eventCacheKey(event), result);
      return result;
    },
    [game.id, game.title],
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

      const bundled = getBundledCommentaryLine(game.id, event);
      if (bundled) {
        const result: CachedCommentary = {
          text: bundled.text,
          source: "bundled",
          generatedAt: new Date().toISOString(),
        };
        commentaryCacheRef.current.set(cacheKey, result);
        return result;
      }

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
              gameId: game.id,
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
            source?: "llm" | "template" | "cursor" | "bundled";
            audioUrl?: string;
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
            audioUrl: data.audioUrl,
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
    [bootstrapStreamSession, game.id, game.persona, game.title, resolveCommentaryLocally, runSerializedCommentaryFetch],
  );

  const speakCommentary = useCallback((event: TimelineEvent, cached: CachedCommentary) => {
    if (nativeVideoAudio || !audioUnlockedRef.current || !cached.text.trim()) {
      return;
    }

    const eventKey = eventCacheKey(event);
    if (cached.audioUrl) {
      audioQueueRef.current.push({ url: cached.audioUrl });
    } else {
      audioQueueRef.current.push({
        text: cached.text,
        gameId: game.id,
        eventKey,
      });
    }
    drainAudioQueue(audioQueueRef, isPlayingAudioRef, currentAudioRef);
  }, [game.id, nativeVideoAudio]);

  const ensureTtsAudio = useCallback(
    (event: TimelineEvent, cached: CachedCommentary): Promise<string | null> => {
      if (nativeVideoAudio || cached.audioUrl || !cached.text.trim() || !ttsAvailableRef.current) {
        return Promise.resolve(cached.audioUrl ?? null);
      }

      const eventKey = eventCacheKey(event);
      const inFlight = inFlightTtsRef.current.get(eventKey);
      if (inFlight) return inFlight;

      const task = fetchTtsAudioUrl(cached.text, {
        gameId: game.id,
        eventKey,
      })
        .then((audio) => {
          if (!audio) return null;

          if (audio.revokeUrl) {
            URL.revokeObjectURL(audio.url);
            return null;
          }

          const next = { ...cached, audioUrl: audio.url };
          commentaryCacheRef.current.set(eventKey, next);
          return audio.url;
        })
        .catch(() => null)
        .finally(() => {
          inFlightTtsRef.current.delete(eventKey);
        });

      inFlightTtsRef.current.set(eventKey, task);
      return task;
    },
    [game.id, nativeVideoAudio],
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

      setCommentaryDebugLog((prev) => {
        if (prev.some((entry) => entry.id === firedKey)) return prev;
        return [
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
        ];
      });

      firedRef.current.add(firedKey);

      setCommentary((prev) => {
        if (prev.some((entry) => entry.key === firedKey)) {
          commentaryRef.current = prev;
          return prev;
        }
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

      speakCommentary(event, cached);
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
    enqueuePlaybackRef.current = enqueuePlayback;
  }, [enqueuePlayback]);

  const prefetchCommentary = useCallback(
    async (events: TimelineEvent[], generation: number) => {
      if (prefetchPipelineRunningRef.current) return;
      if (generation !== prefetchGenerationRef.current) return;

      prefetchPipelineRunningRef.current = true;

      try {
        const currentTime = videoRef.current?.currentTime ?? 0;
        const recentLines = commentaryRef.current.map((line) => line.text).slice(-4);

        const upcoming = events
          .filter((event) => !firedRef.current.has(eventCacheKey(event)))
          .filter((event) => event.videoAt >= currentTime - 2)
          .filter((event) => event.videoAt <= currentTime + COMMENTARY_LEAD_SECONDS)
          .sort((a, b) => a.videoAt - b.videoAt)
          .slice(0, PREFETCH_PIPELINE_BATCH);

        for (const event of upcoming) {
          if (generation !== prefetchGenerationRef.current) return;

          const cacheKey = eventCacheKey(event);
          let result = commentaryCacheRef.current.get(cacheKey);
          if (!result) {
            if (llmAvailableRef.current && Date.now() >= cursorPausedUntilRef.current) {
              result = await fetchCommentary(event, [...recentLines], "prefetch");
            } else {
              result = resolveCommentaryLocally(event);
            }
            recentLines.push(result.text);
            if (recentLines.length > 4) recentLines.shift();
          }

          void ensureTtsAudio(event, result);

          if (isEventDue(videoRef.current?.currentTime ?? 0, event)) {
            enqueuePlaybackRef.current(event);
          }
        }
      } finally {
        prefetchPipelineRunningRef.current = false;
      }
    },
    [ensureTtsAudio, fetchCommentary, resolveCommentaryLocally],
  );

  const runPrefetchPipeline = useCallback(() => {
    void prefetchCommentary(timelineRef.current, prefetchGenerationRef.current);
  }, [prefetchCommentary]);

  useEffect(() => {
    schedulePrefetchRef.current = () => {
      runPrefetchPipeline();
    };
  }, [runPrefetchPipeline]);

  const schedulePrefetch = useCallback(() => {
    runPrefetchPipeline();
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
        const events =
          game.timelineSource === "static"
            ? data.events
            : filterMajorTimelineEvents(data.events);
        timelineRef.current = events;
        setTimelineEvents(events);
        gameContextRef.current = data.gameContext ?? data.debug?.gameContext ?? null;
        setTimelineDebug(data.debug ?? null);
        firedRef.current.clear();
        playbackQueueRef.current = [];
        commentaryCacheRef.current.clear();
        for (const line of getBundledCommentaryLines(game.id)) {
          commentaryCacheRef.current.set(line.eventKey, {
            text: line.text,
            source: "bundled",
            generatedAt: new Date().toISOString(),
          });
        }
        try {
          const cacheResponse = await fetch(`/api/commentary/cache?gameId=${game.id}`);
          if (cacheResponse.ok) {
            const cacheData = (await cacheResponse.json()) as {
              lines?: Array<{
                eventKey: string;
                text: string;
                source: string;
                audioUrl?: string;
                cachedAt?: number;
              }>;
            };
            for (const line of cacheData.lines ?? []) {
              if (!line.text?.trim()) continue;
              commentaryCacheRef.current.set(line.eventKey, {
                text: line.text.trim(),
                source: (line.source as CommentaryDebugEntry["source"]) ?? "cursor",
                audioUrl: line.audioUrl,
                generatedAt: new Date(line.cachedAt ?? Date.now()).toISOString(),
              });
            }
          }
        } catch {
          // Convex cache is optional during local dev.
        }
        cursorAgentIdRef.current = undefined;
        streamAgentBootstrapRef.current = null;
        commentaryRef.current = [];
        setCommentary([]);
        setCommentaryDebugLog([]);
        prefetchGenerationRef.current += 1;
        timelineLoadedDurationRef.current = duration;
        setVideoDuration(duration);
        prefetchStartedRef.current = false;
        setTimelineReady(true);
        setStatus("ready");
        prefetchStartedRef.current = true;
        void prefetchCommentary(data.events, prefetchGenerationRef.current);
      } catch {
        setError("Could not load the imported highlight timeline for this video.");
        setStatus("error");
      } finally {
        timelineLoadInFlightRef.current = false;
      }
    },
    [game.id, game.timelineSource, prefetchCommentary],
  );

  const unlockAudio = useCallback(() => {
    audioUnlockedRef.current = true;
    playbackActiveRef.current = true;
    setStatus("live");
    drainAudioQueue(audioQueueRef, isPlayingAudioRef, currentAudioRef);

    if (!prefetchStartedRef.current) {
      prefetchStartedRef.current = true;
      void prefetchCommentary(timelineRef.current, prefetchGenerationRef.current);
    }

    void runPrefetchPipeline();
    syncToVideoTime(videoRef.current?.currentTime ?? 0);
  }, [prefetchCommentary, runPrefetchPipeline, syncToVideoTime]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const resolveDuration = (): number | null => {
      if (video.duration && Number.isFinite(video.duration) && video.duration > 0) {
        return video.duration;
      }
      if (game.durationSeconds && game.durationSeconds > 0) {
        return game.durationSeconds;
      }
      return null;
    };

    const onLoadedMetadata = () => {
      const duration = resolveDuration();
      if (duration) {
        void loadTimeline(duration);
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
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current.currentTime = 0;
        currentAudioRef.current = null;
      }
      isPlayingAudioRef.current = false;

      syncToVideoTime(t);
      void runPrefetchPipeline();
    };

    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("play", onPlay);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("seeked", onSeeked);

    if (video.readyState >= 1) {
      const duration = resolveDuration();
      if (duration) {
        void loadTimeline(duration);
      }
    }

    return () => {
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("seeked", onSeeked);
      for (const item of audioQueueRef.current) {
        if (item.url && item.revokeUrl) {
          URL.revokeObjectURL(item.url);
        }
      }
      audioQueueRef.current = [];
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
    };
  }, [game.durationSeconds, loadTimeline, runPrefetchPipeline, schedulePrefetch, syncToVideoTime, unlockAudio]);

  useEffect(() => {
    if (!game.durationSeconds || game.durationSeconds <= 0) return;
    if (timelineLoadedDurationRef.current) return;
    void loadTimeline(game.durationSeconds);
  }, [game.durationSeconds, loadTimeline]);

  const timelineMarkers = buildTimelineMarkers(timelineEvents);
  const progressPct =
    videoDuration > 0 ? Math.min(100, Math.max(0, (videoCurrentTime / videoDuration) * 100)) : 0;

  function seekToMarker(videoAt: number) {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(videoAt, video.duration || videoAt));
    syncToVideoTime(video.currentTime);
  }

  return (
    <div>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div>
        <div className="relative overflow-hidden rounded-xl ring-1 ring-black/10">
          <video
            ref={videoRef}
            className="aspect-video w-full bg-neutral-950"
            src={videoUrl(game.videoFile)}
            controls
            muted={!nativeVideoAudio}
            playsInline
            preload="metadata"
          />
          <div className="pointer-events-none absolute inset-x-5 bottom-16 rounded-full bg-black/45 px-3 py-2 backdrop-blur-sm">
            <div className="relative h-2 rounded-full bg-white/25">
              <div
                className="absolute left-0 top-0 h-full rounded-full bg-emerald-300/70"
                style={{ width: `${progressPct}%` }}
              />
              {timelineMarkers.map((marker) => {
                const left =
                  videoDuration > 0
                    ? Math.min(100, Math.max(0, (marker.videoAt / videoDuration) * 100))
                    : 0;
                return (
                  <button
                    key={`overlay-${marker.key}`}
                    type="button"
                    title={marker.title}
                    aria-label={marker.title}
                    onClick={() => seekToMarker(marker.videoAt)}
                    className={`pointer-events-auto absolute top-1/2 h-5 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white/80 transition hover:h-6 hover:w-4 ${marker.className}`}
                    style={{ left: `${left}%` }}
                  />
                );
              })}
            </div>
          </div>
        </div>
        {nativeVideoAudio ? (
          <p className="mt-3 text-sm/6 text-neutral-600">
            Press play for the highlight reel with original broadcast audio. On-screen markers
            still track ESPN key moments.
          </p>
        ) : null}
        <div className="mt-3 rounded-xl bg-neutral-950/[0.03] px-3 py-3 ring-1 ring-black/10">
          <div className="relative h-3 rounded-full bg-neutral-200">
            <div
              className="absolute left-0 top-0 h-full rounded-full bg-emerald-600/40"
              style={{ width: `${progressPct}%` }}
            />
            {timelineMarkers.map((marker) => {
              const left =
                videoDuration > 0
                  ? Math.min(100, Math.max(0, (marker.videoAt / videoDuration) * 100))
                  : 0;
              return (
                <button
                  key={marker.key}
                  type="button"
                  title={marker.title}
                  aria-label={marker.title}
                  onClick={() => seekToMarker(marker.videoAt)}
                  className={`absolute top-1/2 h-4 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 transition hover:h-5 hover:w-3 ${marker.className}`}
                  style={{ left: `${left}%` }}
                />
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-xs/5 text-neutral-600">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Goal
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-yellow-400" /> Card
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-purple-500" /> Key moment
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-sky-500" /> Period
            </span>
          </div>
        </div>
        <p className="mt-3 text-sm/6 text-neutral-600">
          Press play to start. Markers show goals, cards, key moments, and period breaks; click a
          marker to jump to that moment.
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
              <dt className="text-sm/6 text-neutral-600">Source</dt>
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
                  ? nativeVideoAudio
                    ? "Press play — original highlight audio plays from the video."
                    : bundledCommentary
                      ? "Press play — bundled sportscast commentary is ready."
                      : llmAvailable && ttsAvailable
                        ? "Press play — AI commentary and ElevenLabs voice are ready."
                        : llmAvailable
                          ? "Press play — AI commentary ready (add ELEVENLABS_API_KEY for voice)."
                          : "Press play — template commentary runs locally (add CURSOR_API_KEY for AI)."
                  : bundledCommentary
                    ? "Loading demo timeline…"
                    : nativeVideoAudio
                      ? "Loading demo timeline…"
                      : "Loading imported highlight timeline…"}
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
