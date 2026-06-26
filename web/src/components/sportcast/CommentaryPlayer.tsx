"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { MaterialIcon } from "./MaterialIcon";

export function CommentaryPlayer() {
  const [playing, setPlaying] = useState(true);
  const [progress, setProgress] = useState(35);

  return (
    <main className="relative flex min-h-[calc(100vh-5rem)] items-center justify-center overflow-hidden">
      <div className="absolute inset-0 z-0 scale-110">
        <div
          className="h-full w-full bg-cover bg-center"
          style={{
            backgroundImage:
              "url('https://lh3.googleusercontent.com/aida-public/AB6AXuBLACAi8OlYbrirZTynIUXfP13Sl_rJSb0mJrZVV8i9Fqm2Sf4rhHgpmXcctukrLTwkWuWlbJbK5Hw87d5jd2EFEp_5G-eqz4aStMU4ZKjgNBf5fTbLEjQzxuJNWvC7mTLfCXfz2WXBh_l_rK-xUO65rIQVQuUGbUU-UD1efR7MNYTzGMjfMGjriAU9AQYboig-ju1uh9jZnwOjd-vhsgY7oe2JLrj_D4TmUe5S5bpPYqMw_3aCNh_wJaCstLT_AG-tf7GGMADGoq95')",
          }}
        />
        <div className="commentary-blur-overlay absolute inset-0" />
      </div>

      <div className="relative z-10 flex w-full max-w-4xl flex-col items-center px-margin-mobile py-8 md:px-margin-desktop">
        <Link
          href="/live"
          aria-label="Back to match"
          className="group absolute top-0 right-4 flex items-center gap-2 text-white/70 transition-colors hover:text-white md:right-0"
        >
          <MaterialIcon name="close" className="text-2xl transition-transform group-active:scale-90" />
          <span className="hidden font-label-md md:inline">Back to Match</span>
        </Link>

        <div className="mb-8 aspect-video w-full max-w-sm overflow-hidden rounded-xl shadow-2xl md:mb-12 md:aspect-square">
          <Image
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuDtEC8XwMPy0rKMRX0DYqKIHBckD8nl98E8uP1kpT3NlKWPYA6iq-YQZO1ERpr_NcDcBQAWayWa9ny15YB3ll6s6OR39rGgnfow3XCsCvzTa_jZ2YEHBlFNrHgZBvmHnwo7FhBRmnodJqa9m5h301CwAh5gdtKqemj7bTvdpXi1c5jHALgHLWnu2mR4XCPHUW1rRhRe10HV9ArwAl5_4LmbhvduraiSZH11b0OrKlO4G9ETGJjOGaweh8Kk08XpjnIeXX-wbUelrU4G"
            alt="Amsterdam Padel League Finals"
            width={400}
            height={400}
            className="h-full w-full object-cover"
          />
        </div>

        <div className="mb-8 px-2 text-center md:mb-10">
          <h1 className="mb-2 font-display text-headline-lg text-white md:text-display-lg-mobile">
            Amsterdam Padel League Finals
          </h1>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="flex items-center gap-1 rounded-sm bg-primary px-2 py-0.5 text-[10px] font-bold tracking-widest text-white">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
              LIVE
            </span>
            <p className="text-body-md text-white/60">AI Live Commentary • Sportcast Premium</p>
          </div>
        </div>

        <div className="mb-8 w-full">
          <div
            className="commentary-progress"
            onClick={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              const x = event.clientX - rect.left;
              const percentage = Math.min(Math.max(0, x / rect.width), 1) * 100;
              setProgress(percentage);
            }}
            role="slider"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <div className="commentary-progress-fill" style={{ width: `${progress}%` }}>
              <div className="commentary-progress-thumb" />
            </div>
          </div>
          <div className="mt-3 flex justify-between px-1 font-label-sm text-white/50">
            <span>14:32</span>
            <span>42:15</span>
          </div>
        </div>

        <div className="mb-10 flex w-full max-w-md items-center justify-between md:mb-12">
          <button type="button" className="flex h-12 w-12 items-center justify-center text-white/70 transition-all hover:text-white active:scale-95">
            <span className="rounded border border-white/30 px-1 text-sm font-bold">1.5x</span>
          </button>
          <button type="button" className="flex flex-col items-center text-white transition-all hover:text-primary-container active:scale-90">
            <MaterialIcon name="replay_10" className="text-4xl" />
          </button>
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            className="flex h-20 w-20 items-center justify-center rounded-full bg-white text-on-background shadow-lg transition-all hover:scale-110 active:scale-95"
          >
            <MaterialIcon name={playing ? "pause" : "play_arrow"} filled className="text-5xl" />
          </button>
          <button type="button" className="flex flex-col items-center text-white transition-all hover:text-primary-container active:scale-90">
            <MaterialIcon name="forward_10" className="text-4xl" />
          </button>
          <button type="button" className="flex h-12 w-12 items-center justify-center text-white/70 transition-all hover:text-white active:scale-95">
            <MaterialIcon name="timer" />
          </button>
        </div>

        <div className="flex flex-wrap justify-center gap-4">
          <button
            type="button"
            className="flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-6 py-3 font-label-md text-white backdrop-blur-md transition-all hover:bg-white/20 active:scale-95"
          >
            <MaterialIcon name="insights" className="text-lg" />
            View Insights
          </button>
          <button
            type="button"
            className="flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-6 py-3 font-label-md text-white backdrop-blur-md transition-all hover:bg-white/20 active:scale-95"
          >
            <MaterialIcon name="share" className="text-lg" />
            Share Commentary
          </button>
        </div>
      </div>
    </main>
  );
}
