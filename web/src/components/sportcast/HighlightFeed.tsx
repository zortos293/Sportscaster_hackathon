"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { HighlightClip } from "@/lib/sportcast/highlights-server";
import { MaterialIcon } from "./MaterialIcon";

function getEventBadge(kind: string, description: string): { label: string; icon: string; color: string } {
  const d = description.toLowerCase();
  if (kind === "score") {
    if (d.includes("penalty")) return { label: "PENALTY", icon: "sports_soccer", color: "bg-orange-500" };
    if (d.includes("own goal")) return { label: "OWN GOAL", icon: "sports_soccer", color: "bg-amber-600" };
    return { label: "GOAL", icon: "sports_soccer", color: "bg-primary" };
  }
  if (d.includes("red card") || d.includes("sent off") || d.includes("second yellow"))
    return { label: "RED CARD", icon: "style", color: "bg-red-600" };
  if (d.includes("yellow card"))
    return { label: "YELLOW CARD", icon: "style", color: "bg-amber-400" };
  if (d.includes("penalty"))
    return { label: "PENALTY", icon: "sports_soccer", color: "bg-orange-500" };
  return { label: "KEY PLAY", icon: "star", color: "bg-surface-tint" };
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  return `${m}'`;
}

const ACTIONS = [
  { icon: "thumb_up", label: "Like", filled: true },
  { icon: "thumb_down", label: "Dislike", filled: false },
  { icon: "chat", label: "66", filled: true },
  { icon: "share", label: "Share", filled: false },
  { icon: "bookmark", label: "Save", filled: false },
];

function HighlightVideoSlide({
  clip,
  isFirst,
  isActive,
  onVisible,
  onScrollUp,
  onScrollDown,
}: {
  clip: HighlightClip;
  isFirst: boolean;
  isActive: boolean;
  onVisible: () => void;
  onScrollUp: () => void;
  onScrollDown: () => void;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [liked, setLiked] = useState(false);
  const [muted, setMuted] = useState(true);
  const [ready, setReady] = useState(false);

  const badge = getEventBadge(clip.kind, clip.description);
  const score = `${clip.scoreHome} – ${clip.scoreAway}`;
  const timeLabel = clip.gameElapsed > 0 ? formatElapsed(clip.gameElapsed) : clip.periodLabel;
  const caption = clip.context ? `${clip.description} · ${clip.context}` : clip.description;
  const clipEnd = clip.videoAt + clip.clipDuration;

  useEffect(() => {
    const node = sectionRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting && entry.intersectionRatio >= 0.55) {
          onVisible();
        }
      },
      { threshold: [0.55, 0.75] },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [onVisible]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !ready) return;

    if (!isActive) {
      video.pause();
      return;
    }

    const startPlayback = async () => {
      try {
        if (Math.abs(video.currentTime - clip.videoAt) > 0.35) {
          video.currentTime = clip.videoAt;
        }
        await video.play();
      } catch {
        // Autoplay may be blocked until user interacts.
      }
    };

    void startPlayback();
  }, [isActive, clip.videoAt, ready]);

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video || !isActive) return;
    if (video.currentTime >= clipEnd - 0.05) {
      video.pause();
    }
  }, [clipEnd, isActive]);

  const handleReplay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = clip.videoAt;
    void video.play();
  }, [clip.videoAt]);

  return (
    <section
      ref={sectionRef}
      className="video-card relative flex h-full w-full flex-shrink-0 snap-start items-center justify-center py-4"
    >
      <div className="group relative aspect-[9/16] h-full max-h-full overflow-hidden rounded-2xl bg-black shadow-2xl">
        <video
          ref={videoRef}
          src={clip.videoUrl}
          className="absolute inset-0 h-full w-full object-cover"
          playsInline
          preload={isFirst ? "auto" : "metadata"}
          muted={muted}
          onLoadedMetadata={() => setReady(true)}
          onTimeUpdate={handleTimeUpdate}
          onClick={handleReplay}
        />

        <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/80 pointer-events-none" />

        <div className="absolute top-5 left-5 flex items-center gap-2">
          <div className={`${badge.color} flex items-center gap-1.5 rounded-full px-3 py-1 shadow-lg`}>
            <MaterialIcon name={badge.icon} filled className="text-sm text-white" />
            <span className="text-[11px] font-bold tracking-widest text-white uppercase">
              {badge.label}
            </span>
          </div>
        </div>

        <div className="absolute top-5 right-20 flex flex-col items-center">
          <span className="font-display text-2xl font-extrabold text-white drop-shadow-lg">
            {score}
          </span>
          <span className="text-[10px] font-semibold tracking-widest text-white/70 uppercase">
            {timeLabel}
          </span>
        </div>

        {clip.nativeAudio ? (
          <button
            type="button"
            onClick={() => setMuted((value) => !value)}
            className="absolute top-5 right-5 flex h-10 w-10 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm"
            aria-label={muted ? "Unmute clip" : "Mute clip"}
          >
            <MaterialIcon name={muted ? "volume_off" : "volume_up"} />
          </button>
        ) : null}

        <div className="pointer-events-none absolute bottom-0 left-0 w-full p-5 text-white">
          <div className="pointer-events-auto mb-1 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-white/40 bg-white/10">
              <MaterialIcon name="sports" filled className="text-base text-white" />
            </div>
            <span className="max-w-[60%] truncate text-sm font-bold text-white/90">
              {clip.matchTitle}
            </span>
            {clip.matchSubtitle ? (
              <span className="truncate rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold text-white/80">
                {clip.matchSubtitle}
              </span>
            ) : null}
          </div>
          <p className="pointer-events-auto mb-3 line-clamp-2 text-sm leading-snug text-white/90">
            {caption}
          </p>
          <div className="pointer-events-auto flex items-center gap-3">
            <Link
              href={`/live/watch/${clip.gameId}?t=${Math.round(clip.videoAt)}`}
              className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur-sm"
            >
              <MaterialIcon name="open_in_full" className="text-sm" />
              Full broadcast
            </Link>
            <MaterialIcon name="music_note" className="text-sm text-white/60" />
            <span className="max-w-[140px] truncate text-[11px] font-medium text-white/60">
              Sportcast Highlights
            </span>
          </div>
        </div>

        <div className="absolute right-3 bottom-6 z-20 flex flex-col items-center gap-5">
          {ACTIONS.map((action) => {
            const isLike = action.icon === "thumb_up";
            const active = isLike && liked;
            return (
              <button
                key={action.icon}
                type="button"
                onClick={() => {
                  if (isLike) setLiked((value) => !value);
                }}
                className="group/btn flex flex-col items-center gap-1"
              >
                <div
                  className={`glass-overlay flex h-12 w-12 items-center justify-center rounded-full text-white transition-all group-hover/btn:scale-110 active:scale-90 ${
                    active ? "bg-primary/60" : ""
                  }`}
                >
                  <MaterialIcon
                    name={action.icon}
                    filled={action.filled || active}
                    className="text-2xl text-white"
                  />
                </div>
                <span className="text-[10px] font-semibold text-white drop-shadow-md">
                  {isLike && active ? "Liked" : action.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {isFirst ? (
        <div className="absolute top-1/2 right-6 hidden -translate-y-1/2 flex-col gap-3 lg:flex">
          <button
            type="button"
            onClick={onScrollUp}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-container-low text-on-surface shadow-md transition-all hover:bg-primary hover:text-white"
            aria-label="Previous highlight"
          >
            <MaterialIcon name="arrow_upward" />
          </button>
          <button
            type="button"
            onClick={onScrollDown}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-container-low text-on-surface shadow-md transition-all hover:bg-primary hover:text-white"
            aria-label="Next highlight"
          >
            <MaterialIcon name="arrow_downward" />
          </button>
        </div>
      ) : null}
    </section>
  );
}

export function HighlightFeed({ clips = [] }: { clips?: HighlightClip[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  function scrollBy(direction: "up" | "down") {
    const container = containerRef.current;
    if (!container) return;
    container.scrollBy({
      top: direction === "up" ? -container.clientHeight : container.clientHeight,
      behavior: "smooth",
    });
  }

  useEffect(() => {
    const container = containerRef.current;
    if (!container || clips.length === 0) return;

    const onScroll = () => {
      const index = Math.round(container.scrollTop / Math.max(container.clientHeight, 1));
      setActiveIndex(Math.min(Math.max(index, 0), clips.length - 1));
    };

    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, [clips.length]);

  const backdropClip = clips[activeIndex] ?? clips[0];

  return (
    <main className="relative flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden bg-[#0d0d0f]">
      {backdropClip ? (
        <div className="pointer-events-none absolute inset-0 z-0 scale-110 opacity-30 blur-3xl">
          <video
            src={backdropClip.videoUrl}
            className="h-full w-full object-cover"
            muted
            playsInline
            aria-hidden
          />
        </div>
      ) : null}

      <div
        ref={containerRef}
        className="video-container hide-scrollbar relative z-10 flex h-full w-full snap-y snap-mandatory flex-col items-center overflow-y-scroll"
      >
        {clips.map((clip, index) => (
          <HighlightVideoSlide
            key={clip.id}
            clip={clip}
            isFirst={index === 0}
            isActive={index === activeIndex}
            onVisible={() => setActiveIndex(index)}
            onScrollUp={() => scrollBy("up")}
            onScrollDown={() => scrollBy("down")}
          />
        ))}

        {clips.length === 0 ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-4 px-6 text-center text-white/50">
            <MaterialIcon name="sports" className="text-6xl" />
            <p className="text-lg font-medium">No highlight clips yet</p>
            <p className="text-sm">Demo matches and imported highlights will appear here as short clips.</p>
            <Link href="/live" className="mt-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white">
              Browse live matches
            </Link>
          </div>
        ) : null}
      </div>
    </main>
  );
}
