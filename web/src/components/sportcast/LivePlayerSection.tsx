"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { SportcastMatch } from "@/lib/sportcast/matches";
import { InsightsPanel } from "./InsightsPanel";
import { MaterialIcon } from "./MaterialIcon";

type LivePlayerSectionProps = {
  featured: SportcastMatch;
};

export function LivePlayerSection({ featured }: LivePlayerSectionProps) {
  const router = useRouter();
  const [isLive, setIsLive] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const watchHref = featured.watchHref ?? `/live/watch/${featured.id}`;

  const setOpen = useCallback((open: boolean) => {
    setInsightsOpen(open);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && insightsOpen) {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [insightsOpen, setOpen]);

  return (
    <section
      className={`live-player-section mb-16 ${isLive ? "is-live" : ""} ${insightsOpen ? "insights-open" : ""}`}
    >
      <div className="live-stage flex flex-col lg:flex-row lg:items-stretch">
        <div className="live-player-main flex min-w-0 flex-1 flex-col">
          <div className="live-screen relative w-full overflow-hidden bg-black">
            <Image
              src={featured.poster}
              alt=""
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-105"
              sizes="100vw"
              priority
            />
            <div className="hero-gradient pointer-events-none absolute inset-0" />
            <div className="play-overlay absolute inset-0 z-[3] flex items-center justify-center transition-opacity duration-300">
              <button
                type="button"
                onClick={() => {
                  setIsLive(true);
                  router.push(watchHref);
                }}
                className="flex h-20 w-20 items-center justify-center rounded-full border border-white/30 bg-white/20 backdrop-blur-md transition-all hover:scale-110 hover:bg-white/40 active:scale-95 md:h-28 md:w-28"
              >
                <MaterialIcon
                  name="play_arrow"
                  filled
                  className="text-5xl text-white md:text-7xl"
                />
              </button>
            </div>
            <div className="hero-info pointer-events-none absolute right-6 bottom-6 left-6 z-[4] transition-opacity duration-300 md:right-10 md:left-10">
              <div className="mb-4 flex flex-wrap gap-2">
                <span className="flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-[10px] font-bold tracking-wider text-white uppercase">
                  <span
                    className={`h-2 w-2 rounded-full bg-white ${isLive ? "pulse-animation" : ""}`}
                  />
                  {isLive ? "Live" : "Replay"}
                </span>
                <span className="rounded-full bg-white/20 px-3 py-1 text-[10px] font-bold tracking-wider text-white uppercase backdrop-blur-sm">
                  {featured.sport}
                </span>
              </div>
              <h1 className="font-display text-headline-lg-mobile text-white md:text-display-lg">
                {featured.venue}
              </h1>
              <p className="max-w-2xl text-body-lg text-white/90">
                {featured.league}
                {featured.subtitle ? ` • ${featured.subtitle}` : ""}
              </p>
            </div>
          </div>

          <div className="live-action-bar mx-auto flex w-full max-w-(--spacing-container-max) flex-col gap-3 p-4 sm:flex-row md:px-margin-desktop md:py-5">
            <button
              type="button"
              onClick={() => router.push("/commentary")}
              className="live-action-btn"
            >
              <div className="icon-wrap">
                <MaterialIcon name="podcasts" className="text-[22px]" />
              </div>
              <div className="min-w-0 text-left">
                <div className="text-sm leading-tight font-bold md:text-base">Podcast</div>
                <div className="text-xs leading-snug text-zinc-500 md:text-sm">
                  Listen to the match podcast
                </div>
              </div>
            </button>
            <button
              type="button"
              aria-controls="insights-panel"
              aria-expanded={insightsOpen}
              onClick={() => setOpen(!insightsOpen)}
              className={`live-action-btn ${insightsOpen ? "is-active" : ""}`}
            >
              <div className="icon-wrap">
                <MaterialIcon name="bar_chart" className="text-[22px]" />
              </div>
              <div className="min-w-0 text-left">
                <div className="text-sm leading-tight font-bold md:text-base">Insights</div>
                <div className="text-xs leading-snug text-zinc-500 md:text-sm">
                  View match analysis
                </div>
              </div>
            </button>
          </div>
        </div>

        <InsightsPanel open={insightsOpen} onClose={() => setOpen(false)} />
      </div>
    </section>
  );
}
