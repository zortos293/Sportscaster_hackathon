"use client";

import Image from "next/image";
import { useRef } from "react";
import { MaterialIcon } from "./MaterialIcon";

const HIGHLIGHTS = [
  {
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuChdygEEa910GwsnPTWAEjrK0bXGQrtvArJVTXYx5mo-fDaMZV0cJK3vQ09i7VTkzFMaPCayWutyIf8aZFZ0l94UzQi8hNKQAL_eeJ6Gf1XOPkiFpvg5V7qX9p-oYo2EAKvyKexR2k2UYD3o2hv9aTWd44NdVHOBJKNdHxZuYPHXMKhV20WaSFlLlbuFYk71O5bdzs-xpDKBtNlSgTLGbq0s0j0EaFDWXYQwBGh0ibmRynGz80GN7FmhOLowjuVADyNcxfQ4bV07Y4E",
    caption: "Incredible solo goal from last night's derby! 🔥 What a run and finish. #SportcastHighlights #Football #DerbyDay",
  },
  {
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDzzpyLrWFflQSzGmNM500sOmVSPROUYwel0xIrupf2KX0z49sUxf2bVYcEOltM8iH67k3br9NICkOphG8VAuATQ1bVg57XPBm2kCORau6fa55rbpdiMQHXErS-cnlIG4vv9b0DcT7xxU9SV3Nx4EAnuzJXXZSc9LS72Rx4VZaI1UUbf4hz_2o5TR-SGy6CKFk3hIKPLEwzQB1d_voHxHoFQEhCfqSahu3aquz7hY4hdfLjwAaXL_Pq1Gb0THHOlxeWqooJ-R8fM93Y",
    caption: "Slam dunk of the night — pure power under the lights.",
  },
];

export function HighlightFeed() {
  const containerRef = useRef<HTMLDivElement>(null);

  function scrollBy(direction: "up" | "down") {
    const container = containerRef.current;
    if (!container) return;
    const amount = direction === "up" ? -container.clientHeight : container.clientHeight;
    container.scrollBy({ top: amount, behavior: "smooth" });
  }

  return (
    <main className="relative flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden bg-on-surface">
      <div className="pointer-events-none absolute inset-0 z-0 scale-110 opacity-40 blur-3xl">
        <div
          className="h-full w-full bg-cover bg-center"
          style={{
            backgroundImage:
              "url('https://lh3.googleusercontent.com/aida-public/AB6AXuDyc5pSBX4qWtMv-jej1lvapt2KMnwfc841-zogJyYZd0GvskUayxNonT79YvaoVlWqebF7zlsM9IenhG2QR_vSbuRS91cdCC1UXnY5VNE6brVhdaxDxdjvAxR267t2O3EL9SC2QtWRQWLReUgfllzgL59lOgTf7EL3R0eJr_nzqfpNDcfrBpDyukfJ_o5e8jxeD6-cpi2R7PPS6EYRcvBdsmsMRByHEGsgey6oYcMf99cUjqlPLgAXx37WcioRoBh6STypg114RPdF')",
          }}
        />
      </div>

      <div
        ref={containerRef}
        className="video-container relative z-10 flex h-full w-full snap-y snap-mandatory flex-col items-center overflow-y-scroll"
      >
        {HIGHLIGHTS.map((highlight, index) => (
          <section
            key={index}
            className="video-card relative flex h-full w-full flex-shrink-0 snap-start items-center justify-center py-4"
          >
            <div className="group relative aspect-[9/16] h-full overflow-hidden rounded-xl bg-black shadow-2xl">
              <Image
                src={highlight.image}
                alt=""
                fill
                className="object-cover"
                sizes="400px"
              />
              <div className="absolute top-6 left-6 flex items-center gap-2">
                <div className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 shadow-lg">
                  <div className="pulse-live h-2 w-2 rounded-full bg-white" />
                  <span className="text-[10px] font-bold tracking-widest text-white uppercase">
                    Live Heat
                  </span>
                </div>
              </div>
              <div className="pointer-events-none absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/80 to-transparent p-6 text-white">
                <div className="pointer-events-auto mb-3 flex items-center gap-3">
                  <div className="h-10 w-10 overflow-hidden rounded-full border-2 border-white shadow-lg">
                    <Image
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuAij8vdmOPuge60qraYJaDDz_N8gMFGRaDTRanOGfV9vSktplXLX5hA5M-qt133ANJ9p-61L44kWV4N0DWYJBOGk7PbWC4G9SFP8x-2Rdh9E-Lswmpct7OiJodge3IZnGMSKUEsa7pAZKqDG9a3HxpBy0i3hxeUg172NNQVoy4Y28NplU8KUcstYUMTLJX_tA0K6GfbeV2e2Zi9Vb0Ntu7MEmUQbVBNrZ4XJwjGDCHtymEHND_x_xP89jCPMZUHU9-I2dlCKpfWLAxp"
                      alt=""
                      width={40}
                      height={40}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <span className="font-display text-white">@SportcastOfficial</span>
                  <button
                    type="button"
                    className="rounded-full bg-white px-4 py-1.5 font-label-sm text-on-surface transition-all hover:bg-primary hover:text-white active:scale-95"
                  >
                    Follow
                  </button>
                </div>
                <p className="pointer-events-auto mb-3 line-clamp-2 text-body-md">{highlight.caption}</p>
              </div>
              <div className="absolute right-4 bottom-6 z-20 flex flex-col items-center gap-6">
                {[
                  { icon: "thumb_up", label: "28K", filled: true },
                  { icon: "thumb_down", label: "Dislike", filled: false },
                  { icon: "chat", label: "66", filled: true },
                  { icon: "share", label: "Share", filled: false },
                  { icon: "cached", label: "Remix", filled: false },
                ].map((action) => (
                  <div key={action.icon} className="group/btn flex cursor-pointer flex-col items-center gap-1">
                    <div className="glass-overlay flex h-14 w-14 items-center justify-center rounded-full text-white transition-all group-hover/btn:scale-110 active:scale-90">
                      <MaterialIcon name={action.icon} filled={action.filled} className="text-3xl" />
                    </div>
                    <span className="font-label-sm text-white drop-shadow-md">{action.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {index === 0 ? (
              <div className="absolute top-1/2 right-8 hidden -translate-y-1/2 flex-col gap-4 lg:flex">
                <button
                  type="button"
                  onClick={() => scrollBy("up")}
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-container-low text-on-surface shadow-md transition-all hover:bg-primary hover:text-white"
                >
                  <MaterialIcon name="arrow_upward" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollBy("down")}
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-container-low text-on-surface shadow-md transition-all hover:bg-primary hover:text-white"
                >
                  <MaterialIcon name="arrow_downward" />
                </button>
              </div>
            ) : null}
          </section>
        ))}
      </div>
    </main>
  );
}
