"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { FOOTBALL_POSTER } from "@/lib/sportcast/live-matches";
import { MaterialIcon } from "./MaterialIcon";

type ImportedHighlightStatus = {
  id: string;
  title: string;
  subtitle: string;
  feedType: "full_match";
  alignmentStatus?: string;
};

export function ImportedHighlightsRow() {
  const [imports, setImports] = useState<ImportedHighlightStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/admin/cache-matches");
        const data = (await response.json()) as { games?: ImportedHighlightStatus[] };
        if (cancelled || !data.games) return;
        setImports(data.games.filter((game) => game.feedType === "full_match"));
      } catch {
        // Optional section — hide when unavailable.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <p className="text-body-md text-secondary">Loading imported highlights…</p>;
  }

  if (imports.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {imports.map((game) => (
        <Link
          key={game.id}
          href={`/live/watch/${game.id}`}
          className="group block overflow-hidden rounded-xl border border-surface-container bg-surface-container-lowest shadow-sm transition-shadow hover:shadow-md"
        >
          <div className="relative aspect-video overflow-hidden bg-black">
            <Image
              src={FOOTBALL_POSTER}
              alt={game.title}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, 33vw"
            />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 transition-opacity group-hover:opacity-100">
              <MaterialIcon name="play_circle" filled className="text-5xl text-white" />
            </div>
          </div>
          <div className="p-4">
            <span className="text-xs font-bold tracking-wider text-primary uppercase">
              {game.subtitle}
            </span>
            <h3 className="mt-1 font-display text-on-surface group-hover:text-primary">
              {game.title}
            </h3>
            <p className="mt-1 text-sm text-secondary">
              {game.alignmentStatus ?? "pending"} · Imported highlight
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}
