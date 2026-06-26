"use client";

import Image from "next/image";
import { MaterialIcon } from "./MaterialIcon";

const PERFORMERS = [
  {
    name: "Vinícius Jr.",
    role: "Forward • Real Madrid",
    rating: "9.2",
    ratingClass: "bg-primary/10 text-primary",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAGq6q8Ut4AcJD_OmntqfBUbn3tcoF4rQUX06m2-2QH5Dxb7pd6RqYM6tfvtENVFFD9u2iZ7V6U3xC_ajR8u22_akXDcarpBSva16E91WKocRlRWUhfVkjmm_b2ROqMLOTMkIxjqUOOBX2UWlqYBYC0YXV-AHX0DXR9lPwKGzoFbarZRHcQ5RaiopqglK4spYDDU6AE6qxmgkcE4v9rcYKWyzuZjbPhXHCEwQkg6oSdXERVwJujzmJmkTT9pS_0BcJlmG-b8adQPCD5",
    stats: [
      { label: "Goals", value: "1" },
      { label: "Ast", value: "1" },
      { label: "Acc%", value: "88%" },
      { label: "Dist", value: "10.2km" },
    ],
  },
  {
    name: "Erling Haaland",
    role: "Forward • Man City",
    rating: "7.8",
    ratingClass: "bg-surface-container-highest text-on-surface",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuANzlDqYHCGeLtDWcyc07_5yNvHaqoZws9YlD-d5Kv1kSKH_-RHzbEBwSO0k2m-ebBbGg6ouNyTWR86QRGQiCj8FZYYB7CzJyh3S2egx1jLzYAlvGEE0njQKclu6dIEhFkEbEBCZiicQvDBRX6zvSQHdtTOvu7ZR2J08xkxJChwhUxYweg1PctsVdvQRmd_v_SOA1EeTNfZqaOHlxE3koNWSQbV4H5UOT3-vMOTcK_cNFh7w2_FlBby9EGIBYWLQmT-PjhZt8RZo3qk",
    stats: [
      { label: "Goals", value: "1" },
      { label: "Ast", value: "0" },
      { label: "Acc%", value: "92%" },
      { label: "Dist", value: "9.4km" },
    ],
  },
];

const HIGHLIGHTS = [
  { label: "Great Goal", image: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=400&q=80" },
  { label: "Amazing Save", image: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=400&q=80" },
];

const TACTICAL_NOTES = [
  "Madrid are overloading the left flank to exploit space behind the City full-back.",
  "City's press intensity has dropped 15% since the 60th minute mark.",
];

type InsightsPanelProps = {
  open: boolean;
  onClose: () => void;
};

export function InsightsPanel({ open, onClose }: InsightsPanelProps) {
  return (
    <aside
      id="insights-panel"
      aria-label="Live Insights"
      aria-hidden={!open}
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
          onClick={onClose}
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
                <span className="mb-1 block text-label-sm text-secondary">Shots on Target</span>
                <div className="flex items-end gap-2">
                  <span className="text-headline-md leading-none">8</span>
                  <span className="mb-0.5 text-label-sm text-secondary">/ 12 total</span>
                </div>
              </div>
              <div className="rounded-xl border border-outline-variant/50 bg-surface-container-low p-4">
                <span className="mb-1 block text-label-sm text-secondary">Pass Accuracy</span>
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
            {PERFORMERS.map((player) => (
              <div
                key={player.name}
                className="group cursor-pointer rounded-2xl border border-outline-variant/50 bg-white p-4 shadow-sm transition-all hover:shadow-md"
              >
                <div className="flex gap-4">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-surface-container-high">
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
                      {player.stats.map((stat) => (
                        <div key={stat.label} className="flex flex-col">
                          <span className="text-[10px] font-bold text-secondary uppercase">
                            {stat.label}
                          </span>
                          <span className="font-bold">{stat.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3 className="mb-4 font-label-md tracking-widest text-secondary uppercase">
            Match Highlights
          </h3>
          <div className="custom-scrollbar flex gap-4 overflow-x-auto pb-2">
            {HIGHLIGHTS.map((clip) => (
              <div
                key={clip.label}
                className="group relative aspect-[9/16] w-32 shrink-0 cursor-pointer overflow-hidden rounded-xl bg-surface-container-high"
              >
                <Image
                  src={clip.image}
                  alt=""
                  fill
                  className="object-cover opacity-80 transition-transform duration-500 group-hover:scale-110"
                  sizes="128px"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <MaterialIcon name="play_circle" className="text-3xl text-white drop-shadow-md" />
                </div>
                <div className="absolute right-0 bottom-0 left-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                  <p className="text-[10px] leading-tight font-bold text-white">{clip.label}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3 className="mb-4 font-label-md tracking-widest text-secondary uppercase">
            Match Notes
          </h3>
          <div className="rounded-2xl border border-outline-variant/50 bg-white p-4 shadow-sm">
            <textarea
              className="custom-scrollbar h-24 w-full resize-none border-none bg-transparent text-body-md text-on-surface placeholder:text-secondary/50 focus:ring-0"
              placeholder="Write your match notes here..."
            />
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
            {TACTICAL_NOTES.map((note) => (
              <li key={note} className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <p className="text-label-md leading-relaxed text-on-surface-variant">{note}</p>
              </li>
            ))}
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
  );
}
