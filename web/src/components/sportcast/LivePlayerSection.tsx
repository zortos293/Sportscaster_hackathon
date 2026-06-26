"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { SportcastMatch } from "@/lib/sportcast/matches";
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
      <div className="live-stage flex flex-col rounded-xl shadow-xl lg:flex-row lg:items-stretch">
        <div className="live-player-main flex min-w-0 flex-1 flex-col">
          <div className="live-screen relative aspect-[16/9] w-full overflow-hidden rounded-t-xl md:aspect-[21/9]">
            <Image
              src={featured.poster}
              alt=""
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-105"
              sizes="100vw"
              priority
            />
            <div className="hero-gradient absolute inset-0" />
            <div className="play-overlay absolute inset-0 flex items-center justify-center transition-opacity duration-300">
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
            <div className="hero-info pointer-events-none absolute right-6 bottom-6 left-6 z-10 transition-opacity duration-300 md:right-10 md:left-10">
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

          <div className="live-action-bar flex flex-col gap-3 rounded-b-xl p-4 shadow-xl sm:flex-row md:p-5">
            <Link href={watchHref} className="live-action-btn">
              <div className="icon-wrap">
                <MaterialIcon name="mic" className="text-[22px]" />
              </div>
              <div className="min-w-0 text-left">
                <div className="text-sm leading-tight font-bold md:text-base">
                  AI Commentary
                </div>
                <div className="text-xs leading-snug text-zinc-500 md:text-sm">
                  Watch with AI sportscaster
                </div>
              </div>
            </Link>
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
                <div className="text-sm leading-tight font-bold md:text-base">
                  Insights
                </div>
                <div className="text-xs leading-snug text-zinc-500 md:text-sm">
                  View match analysis
                </div>
              </div>
            </button>
          </div>
        </div>

        <aside
          id="insights-panel"
          aria-label="Live Insights"
          aria-hidden={!insightsOpen}
          className="insights-panel bg-surface"
        >
          <div className="flex flex-none items-center justify-between border-b border-outline-variant p-6">
            <div className="flex items-center gap-2">
              <MaterialIcon name="analytics" filled className="text-primary" />
              <h2 className="font-display text-headline-md">Live Insights</h2>
            </div>
            <button
              type="button"
              aria-label="Close insights panel"
              onClick={() => setOpen(false)}
              className="rounded-full p-1 text-secondary transition-colors hover:bg-surface-container hover:text-on-surface"
            >
              <MaterialIcon name="close" />
            </button>
          </div>

          <div className="insights-panel-scroll custom-scrollbar min-h-0 flex-grow space-y-8 overflow-y-auto p-6">
            <section>
              <h3 className="mb-6 font-label-md tracking-widest text-secondary uppercase">
                Match Overview
              </h3>
              <p className="text-body-md text-on-surface-variant">
                {featured.venue} — {featured.league}. Press play to watch the highlight reel with
                ESPN-synced markers and AI commentary.
              </p>
            </section>
          </div>

          <div className="flex-none border-t border-outline-variant bg-surface-container-lowest p-6">
            <Link
              href={watchHref}
              className="flex w-full items-center justify-center gap-3 rounded-full bg-primary py-4 px-6 font-bold text-white shadow-lg shadow-primary/20 transition-transform active:scale-[0.98]"
            >
              <MaterialIcon name="play_arrow" filled />
              Start Broadcast
            </Link>
          </div>
        </aside>
      </div>
    </section>
  );
}
