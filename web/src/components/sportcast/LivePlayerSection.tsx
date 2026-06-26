"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { MaterialIcon } from "./MaterialIcon";

export function LivePlayerSection() {
  const router = useRouter();
  const [isLive, setIsLive] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);

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
            <div
              className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
              style={{
                backgroundImage:
                  "url('https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=1920&q=80')",
              }}
            />
            <div className="hero-gradient absolute inset-0" />
            <div className="play-overlay absolute inset-0 flex items-center justify-center transition-opacity duration-300">
              <button
                type="button"
                onClick={() => setIsLive(true)}
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
                  Football
                </span>
              </div>
              <h1 className="font-display text-headline-lg-mobile text-white md:text-display-lg">
                Champions League Final Highlights
              </h1>
              <p className="max-w-2xl text-body-lg text-white/90">
                Real Madrid vs Manchester City • May 17, 2025 • 1h 52m
              </p>
            </div>
          </div>

          <div className="live-action-bar flex flex-col gap-3 rounded-b-xl p-4 shadow-xl sm:flex-row md:p-5">
            <button
              type="button"
              onClick={() => router.push("/commentary")}
              className="live-action-btn"
            >
              <div className="icon-wrap">
                <MaterialIcon name="mic" className="text-[22px]" />
              </div>
              <div className="min-w-0 text-left">
                <div className="text-sm leading-tight font-bold md:text-base">
                  AI Commentary
                </div>
                <div className="text-xs leading-snug text-zinc-500 md:text-sm">
                  Listen to live commentary
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
                Real-Time Match Stats
              </h3>
              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-label-sm font-bold">
                    <span>MAD</span>
                    <span>POSSESSION</span>
                    <span>MCI</span>
                  </div>
                  <div className="flex h-2 w-full overflow-hidden rounded-full bg-surface-container-high">
                    <div className="h-full bg-primary" style={{ width: "58%" }} />
                    <div className="h-full bg-tertiary-container" style={{ width: "42%" }} />
                  </div>
                  <div className="mt-1 flex justify-between text-body-md font-bold">
                    <span>58%</span>
                    <span>42%</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl border border-outline-variant/50 bg-surface-container-low p-4">
                    <span className="mb-1 block text-label-sm text-secondary">
                      Shots on Target
                    </span>
                    <div className="flex items-end gap-2">
                      <span className="text-headline-md leading-none">8</span>
                      <span className="mb-0.5 text-label-sm text-secondary">/ 12 total</span>
                    </div>
                  </div>
                  <div className="rounded-xl border border-outline-variant/50 bg-surface-container-low p-4">
                    <span className="mb-1 block text-label-sm text-secondary">
                      Pass Accuracy
                    </span>
                    <div className="flex items-end gap-2">
                      <span className="text-headline-md leading-none">89%</span>
                      <span className="mb-0.5 text-label-sm text-primary">+4% avg</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h3 className="mb-4 font-label-md tracking-widest text-secondary uppercase">
                Top Performers
              </h3>
              <div className="space-y-4">
                {[
                  {
                    name: "Vinícius Jr.",
                    role: "Forward • Real Madrid",
                    rating: "9.2",
                    ratingClass: "bg-primary/10 text-primary",
                    image:
                      "https://lh3.googleusercontent.com/aida-public/AB6AXuAGq6q8Ut4AcJD_OmntqfBUbn3tcoF4rQUX06m2-2QH5Dxb7pd6RqYM6tfvtENVFFD9u2iZ7V6U3xC_ajR8u22_akXDcarpBSva16E91WKocRlRWUhfVkjmm_b2ROqMLOTMkIxjqUOOBX2UWlqYBYC0YXV-AHX0DXR9lPwKGzoFbarZRHcQ5RaiopqglK4spYDDU6AE6qxmgkcE4v9rcYKWyzuZjbPhXHCEwQkg6oSdXERVwJujzmJmkTT9pS_0BcJlmG-b8adQPCD5",
                  },
                  {
                    name: "Erling Haaland",
                    role: "Forward • Man City",
                    rating: "7.8",
                    ratingClass: "bg-surface-container-highest text-on-surface",
                    image:
                      "https://lh3.googleusercontent.com/aida-public/AB6AXuANzlDqYHCGeLtDWcyc07_5yNvHaqoZws9YlD-d5Kv1kSKH_-RHzbEBwSO0k2m-ebBbGg6ouNyTWR86QRGQiCj8FZYYB7CzJyh3S2egx1jLzYAlvGEE0njQKclu6dIEhFkEbEBCZiicQvDBRX6zvSQHdtTOvu7ZR2J08xkxJChwhUxYweg1PctsVdvQRmd_v_SOA1EeTNfZqaOHlxE3koNWSQbV4H5UOT3-vMOTcK_cNFh7w2_FlBby9EGIBYWLQmT-PjhZt8RZo3qk",
                  },
                ].map((player) => (
                  <div
                    key={player.name}
                    className="group cursor-pointer rounded-2xl border border-outline-variant/50 bg-white p-4 shadow-sm transition-all hover:shadow-md"
                  >
                    <div className="flex gap-4">
                      <div className="h-14 w-14 overflow-hidden rounded-xl bg-surface-container-high">
                        <Image
                          src={player.image}
                          alt=""
                          width={56}
                          height={56}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-grow">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="text-body-md font-bold">{player.name}</h4>
                            <p className="text-label-sm text-secondary">{player.role}</p>
                          </div>
                          <span
                            className={`flex-none rounded px-2 py-0.5 text-label-sm font-bold ${player.ratingClass}`}
                          >
                            {player.rating}
                          </span>
                        </div>
                        <div className="mt-3 grid grid-cols-4 gap-2">
                          {[
                            ["Goals", "1"],
                            ["Ast", player.name.includes("Haaland") ? "0" : "1"],
                            ["Acc%", player.name.includes("Haaland") ? "92%" : "88%"],
                            ["Dist", player.name.includes("Haaland") ? "9.4km" : "10.2km"],
                          ].map(([label, value]) => (
                            <div key={label} className="flex flex-col">
                              <span className="text-[10px] font-bold text-secondary uppercase">
                                {label}
                              </span>
                              <span className="font-bold">{value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-primary/10 bg-primary/5 p-5">
              <div className="mb-3 flex items-center gap-2">
                <MaterialIcon name="smart_toy" className="text-sm text-primary" />
                <h3 className="font-label-md tracking-wider text-primary uppercase">
                  AI Tactical Notes
                </h3>
              </div>
              <ul className="space-y-3">
                <li className="flex gap-3">
                  <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-primary" />
                  <p className="text-label-md leading-relaxed text-on-surface-variant">
                    Madrid are overloading the left flank to exploit space behind the City
                    full-back.
                  </p>
                </li>
                <li className="flex gap-3">
                  <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-primary" />
                  <p className="text-label-md leading-relaxed text-on-surface-variant">
                    City&apos;s press intensity has dropped 15% since the 60th minute mark.
                  </p>
                </li>
              </ul>
            </section>
          </div>

          <div className="flex-none border-t border-outline-variant bg-surface-container-lowest p-6">
            <button
              type="button"
              className="flex w-full items-center justify-center gap-3 rounded-full bg-primary py-4 px-6 font-bold text-white shadow-lg shadow-primary/20 transition-transform active:scale-[0.98]"
            >
              <MaterialIcon name="share" />
              Share Insights
            </button>
          </div>
        </aside>
      </div>
    </section>
  );
}
