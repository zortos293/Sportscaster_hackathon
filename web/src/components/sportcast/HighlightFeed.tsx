"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import type { HighlightEvent } from "@/lib/sportcast/highlights-server";
import { MATCHES } from "@/lib/sportcast/matches";
import { MaterialIcon } from "./MaterialIcon";

type SlideData = {
  image: string;
  badge: { label: string; icon: string; color: string };
  score: string;
  caption: string;
  matchTitle: string;
  matchSubtitle: string;
  timeLabel: string;
};

const FALLBACK_SLIDES: SlideData[] = [
  {
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuChdygEEa910GwsnPTWAEjrK0bXGQrtvArJVTXYx5mo-fDaMZV0cJK3vQ09i7VTkzFMaPCayWutyIf8aZFZ0l94UzQi8hNKQAL_eeJ6Gf1XOPkiFpvg5V7qX9p-oYo2EAKvyKexR2k2UYD3o2hv9aTWd44NdVHOBJKNdHxZuYPHXMKhV20WaSFlLlbuFYk71O5bdzs-xpDKBtNlSgTLGbq0s0j0EaFDWXYQwBGh0ibmRynGz80GN7FmhOLowjuVADyNcxfQ4bV07Y4E",
    badge: { label: "GOAL", icon: "sports_soccer", color: "bg-primary" },
    score: "2 – 1",
    caption: "Incredible solo run and finish from last night's derby! 🔥 #SportcastHighlights #Football",
    matchTitle: "Derby Day",
    matchSubtitle: "Premier League · 54'",
    timeLabel: "54'",
  },
  {
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuDzzpyLrWFflQSzGmNM500sOmVSPROUYwel0xIrupf2KX0z49sUxf2bVYcEOltM8iH67k3br9NICkOphG8VAuATQ1bVg57XPBm2kCORau6fa55rbpdiMQHXErS-cnlIG4vv9b0DcT7xxU9SV3Nx4EAnuzJXXZSc9LS72Rx4VZaI1UUbf4hz_2o5TR-SGy6CKFk3hIKPLEwzQB1d_voHxHoFQEhCfqSahu3aquz7hY4hdfLjwAaXL_Pq1Gb0THHOlxeWqooJ-R8fM93Y",
    badge: { label: "KEY PLAY", icon: "star", color: "bg-amber-500" },
    score: "0 – 0",
    caption: "Slam dunk of the night — pure power under the lights. 🏀 #Basketball",
    matchTitle: "Championship Finals",
    matchSubtitle: "NBA · 3rd Quarter",
    timeLabel: "Q3",
  },
];

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

function highlightToSlide(h: HighlightEvent, index: number): SlideData {
  const poster = MATCHES[index % MATCHES.length]?.poster ?? FALLBACK_SLIDES[0]!.image;
  const badge = getEventBadge(h.kind, h.description);
  const score = `${h.scoreHome} – ${h.scoreAway}`;
  const timeLabel = h.gameElapsed > 0 ? formatElapsed(h.gameElapsed) : h.periodLabel;
  const caption = h.context ? `${h.description} · ${h.context}` : h.description;

  return {
    image: poster,
    badge,
    score,
    caption,
    matchTitle: h.matchTitle,
    matchSubtitle: `${h.matchSubtitle}${h.matchSubtitle ? " · " : ""}${h.periodLabel}`,
    timeLabel,
  };
}

const ACTIONS = [
  { icon: "thumb_up", label: "Like", filled: true },
  { icon: "thumb_down", label: "Dislike", filled: false },
  { icon: "chat", label: "66", filled: true },
  { icon: "share", label: "Share", filled: false },
  { icon: "bookmark", label: "Save", filled: false },
];

function HighlightSlide({
  slide,
  isFirst,
  onScrollUp,
  onScrollDown,
}: {
  slide: SlideData;
  isFirst: boolean;
  onScrollUp: () => void;
  onScrollDown: () => void;
}) {
  const [liked, setLiked] = useState(false);

  return (
    <section className="video-card relative flex h-full w-full flex-shrink-0 snap-start items-center justify-center py-4">
      <div className="group relative aspect-[9/16] h-full max-h-full overflow-hidden rounded-2xl bg-black shadow-2xl">
        <Image
          src={slide.image}
          alt={slide.caption}
          fill
          className="object-cover"
          sizes="400px"
          priority={isFirst}
        />

        {/* Atmospheric gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/75 pointer-events-none" />

        {/* Event badge — top left */}
        <div className="absolute top-5 left-5 flex items-center gap-2">
          <div className={`${slide.badge.color} flex items-center gap-1.5 rounded-full px-3 py-1 shadow-lg`}>
            <MaterialIcon name={slide.badge.icon} filled className="text-sm text-white" />
            <span className="text-[11px] font-bold tracking-widest text-white uppercase">
              {slide.badge.label}
            </span>
          </div>
        </div>

        {/* Score — top right */}
        <div className="absolute top-5 right-20 flex flex-col items-center">
          <span className="font-display text-2xl font-extrabold text-white drop-shadow-lg">
            {slide.score}
          </span>
          <span className="text-[10px] font-semibold tracking-widest text-white/70 uppercase">
            {slide.timeLabel}
          </span>
        </div>

        {/* Bottom info overlay */}
        <div className="pointer-events-none absolute bottom-0 left-0 w-full p-5 text-white">
          <div className="pointer-events-auto mb-1 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-white/40 bg-white/10">
              <MaterialIcon name="sports" filled className="text-base text-white" />
            </div>
            <span className="text-sm font-bold text-white/90 truncate max-w-[60%]">
              {slide.matchTitle}
            </span>
            {slide.matchSubtitle ? (
              <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold text-white/80 truncate">
                {slide.matchSubtitle}
              </span>
            ) : null}
          </div>
          <p className="pointer-events-auto mb-3 line-clamp-2 text-sm text-white/90 leading-snug">
            {slide.caption}
          </p>
          <div className="pointer-events-auto flex items-center gap-2">
            <MaterialIcon name="music_note" className="text-sm text-white/60" />
            <span className="text-[11px] font-medium text-white/60 truncate max-w-[180px]">
              Sportcast Highlights
            </span>
          </div>
        </div>

        {/* Right action column */}
        <div className="absolute right-3 bottom-6 z-20 flex flex-col items-center gap-5">
          {ACTIONS.map((action) => {
            const isLike = action.icon === "thumb_up";
            const active = isLike && liked;
            return (
              <button
                key={action.icon}
                type="button"
                onClick={() => { if (isLike) setLiked((v) => !v); }}
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
                    className={`text-2xl ${active ? "text-white" : "text-white"}`}
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

      {/* Desktop scroll navigation — only on first slide so it renders once */}
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

export function HighlightFeed({ highlights = [] }: { highlights?: HighlightEvent[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

  const slides: SlideData[] =
    highlights.length > 0
      ? highlights.map(highlightToSlide)
      : FALLBACK_SLIDES;

  function scrollBy(direction: "up" | "down") {
    const container = containerRef.current;
    if (!container) return;
    container.scrollBy({
      top: direction === "up" ? -container.clientHeight : container.clientHeight,
      behavior: "smooth",
    });
  }

  return (
    <main className="relative flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden bg-[#0d0d0f]">
      {/* Atmospheric background blur */}
      <div className="pointer-events-none absolute inset-0 z-0 scale-110 opacity-30 blur-3xl">
        <div
          className="h-full w-full bg-cover bg-center"
          style={{ backgroundImage: `url('${slides[0]?.image ?? ""}')` }}
        />
      </div>

      <div
        ref={containerRef}
        className="video-container hide-scrollbar relative z-10 flex h-full w-full snap-y snap-mandatory flex-col items-center overflow-y-scroll"
      >
        {slides.map((slide, index) => (
          <HighlightSlide
            key={`${slide.matchTitle}-${index}`}
            slide={slide}
            isFirst={index === 0}
            onScrollUp={() => scrollBy("up")}
            onScrollDown={() => scrollBy("down")}
          />
        ))}

        {slides.length === 0 && (
          <div className="flex h-full w-full flex-col items-center justify-center gap-4 text-white/50">
            <MaterialIcon name="sports" className="text-6xl" />
            <p className="text-lg font-medium">No highlights yet</p>
            <p className="text-sm">Import a match to generate highlight reels</p>
          </div>
        )}
      </div>
    </main>
  );
}
