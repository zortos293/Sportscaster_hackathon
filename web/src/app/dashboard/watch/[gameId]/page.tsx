"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { DashboardShell } from "@/components/DashboardShell";
import { BroadcastPlayer } from "@/components/BroadcastPlayer";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { type BroadcastGame } from "@/lib/broadcast-game";
import { getDemoGame } from "@/lib/demo-games";

type FullMatchImport = {
  gameId: string;
  title: string;
  subtitle: string;
  videoFile?: string;
  liveScoreMatchId: string;
  status: string;
};

export default function WatchPage() {
  const params = useParams();
  const gameId = params.gameId as string;
  const demoGame = getDemoGame(gameId);
  const [importedGame, setImportedGame] = useState<BroadcastGame | null>(null);
  const [loadingImport, setLoadingImport] = useState(!demoGame);

  useEffect(() => {
    if (demoGame) return;

    let cancelled = false;
    (async () => {
      setLoadingImport(true);
      try {
        const response = await fetch("/api/admin/full-match");
        const data = (await response.json()) as { imports?: FullMatchImport[] };
        if (cancelled) return;
        const found = data.imports?.find((item) => item.gameId === gameId);
        if (found?.videoFile && found.status === "aligned") {
          setImportedGame({
            id: found.gameId,
            title: found.title,
            subtitle: found.subtitle,
            sport: "soccer",
            league: "livescore",
            eventId: found.liveScoreMatchId,
            videoFile: found.videoFile,
            persona: "British Premier League football commentator with building excitement",
            finalScore: "LiveScore aligned",
            videoMode: "full_match_aligned",
          });
        }
      } finally {
        if (!cancelled) setLoadingImport(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [gameId, demoGame]);

  const game = demoGame ?? importedGame;

  return (
    <>
      <SiteHeader />
      <DashboardShell>
        <div className="px-6 py-8 sm:py-10 lg:px-8 lg:py-12">
          <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-mono text-sm/6 text-emerald-700">Broadcast</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight text-neutral-950 sm:text-4xl">
                {game?.title ?? (loadingImport ? "Loading match…" : "Game not found")}
              </h1>
            </div>
            <Link
              href="/dashboard"
              className="rounded-lg px-3 py-2 text-sm/6 font-medium text-emerald-700 ring-1 ring-black/10"
            >
              ← Back to dashboard
            </Link>
          </div>

          {!game ? (
            <div className="rounded-xl p-5 ring-1 ring-red-200">
              <p className="text-sm/6 text-red-700">
                {loadingImport ? "Loading imported highlight…" : `Unknown game: ${gameId}`}
              </p>
            </div>
          ) : (
            <BroadcastPlayer game={game} />
          )}
        </div>
      </DashboardShell>
      <SiteFooter />
    </>
  );
}
