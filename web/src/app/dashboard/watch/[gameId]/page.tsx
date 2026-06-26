"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import { BroadcastPlayer } from "@/components/BroadcastPlayer";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { getDemoGame } from "@/lib/demo-games";

export default function WatchPage() {
  const params = useParams();
  const gameId = params.gameId as string;
  const game = getDemoGame(gameId);

  return (
    <>
      <SiteHeader />
      <DashboardShell>
        <div className="px-6 py-8 sm:py-10 lg:px-8 lg:py-12">
          <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-mono text-sm/6 text-emerald-700">Broadcast</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight text-neutral-950 sm:text-4xl">
                {game?.title ?? "Game not found"}
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
              <p className="text-sm/6 text-red-700">Unknown game: {gameId}</p>
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
