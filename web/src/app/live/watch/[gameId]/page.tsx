"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { BroadcastPlayer } from "@/components/BroadcastPlayer";
import { SportcastFooter } from "@/components/sportcast/SportcastFooter";
import { SportcastHeader } from "@/components/sportcast/SportcastHeader";
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

export default function LiveWatchPage() {
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
      <SportcastHeader activeNav="live" dark />
      <main className="mx-auto max-w-(--spacing-container-max) px-margin-mobile py-8 md:px-margin-desktop">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-label-md text-primary">Broadcast</p>
            <h1 className="mt-1 font-display text-headline-lg text-on-surface">
              {game?.title ?? (loadingImport ? "Loading match…" : "Game not found")}
            </h1>
            {game?.subtitle ? (
              <p className="mt-1 text-body-md text-secondary">{game.subtitle}</p>
            ) : null}
          </div>
          <Link
            href="/live"
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 font-label-md text-primary ring-1 ring-outline-variant transition hover:bg-surface-container-low"
          >
            ← Back to Live
          </Link>
        </div>

        {!game ? (
          <div className="rounded-2xl border border-red-200 bg-surface p-6">
            <p className="text-body-md text-red-700">
              {loadingImport ? "Loading imported highlight…" : `Unknown game: ${gameId}`}
            </p>
          </div>
        ) : (
          <BroadcastPlayer game={game} />
        )}
      </main>
      <SportcastFooter />
    </>
  );
}
