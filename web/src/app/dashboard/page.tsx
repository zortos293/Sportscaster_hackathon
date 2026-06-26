"use client";

import { useState } from "react";
import { useAppAuth } from "@/components/AppAuthProvider";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { DEMO_GAMES } from "@/lib/demo-games";

export default function DashboardPage() {
  const { isAuthenticated, isLoading, signOut } = useAppAuth();
  const router = useRouter();
  const [liveGameId, setLiveGameId] = useState("");

  async function handleSignOut() {
    await signOut();
    router.push("/");
    router.refresh();
  }

  if (isLoading) {
    return (
      <>
        <SiteHeader />
        <DashboardShell>
          <div className="px-6 py-12 lg:px-8">
            <p className="text-base/7 text-neutral-600 sm:text-sm/6">Loading…</p>
          </div>
        </DashboardShell>
        <SiteFooter />
      </>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <>
      <SiteHeader />
      <DashboardShell>
        <div className="px-6 py-8 sm:py-10 lg:px-8 lg:py-12">
          <div className="max-w-3xl">
            <h1 className="max-w-[35ch] text-3xl font-semibold tracking-tight text-balance text-neutral-950 sm:text-4xl">
              Dashboard
            </h1>
            <p className="mt-4 max-w-[48ch] text-base/7 text-pretty text-neutral-600 sm:text-sm/6">
              Pick a demo match. Video, scoreboard, and AI voice-over are synced in the
              browser — no Python server required.
            </p>
          </div>

          <div className="mt-10 rounded-xl bg-red-50/50 p-5 ring-1 ring-red-200/50 sm:p-6">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
              </span>
              <h2 className="text-lg font-semibold text-neutral-950">Live Game</h2>
            </div>
            <p className="mt-2 text-sm/6 text-neutral-600">
              Enter an ESPN event ID to watch a live game with AI commentary.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (liveGameId.trim()) {
                  router.push(`/dashboard/live/${liveGameId.trim()}`);
                }
              }}
              className="mt-4 flex gap-3"
            >
              <input
                type="text"
                value={liveGameId}
                onChange={(e) => setLiveGameId(e.target.value)}
                placeholder="football-nfl-401547417"
                className="flex-1 rounded-lg border-0 px-3 py-2 text-sm text-neutral-900 ring-1 ring-inset ring-neutral-300 placeholder:text-neutral-400 focus:ring-2 focus:ring-red-500"
              />
              <button
                type="submit"
                disabled={!liveGameId.trim()}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Go Live
              </button>
            </form>
            <p className="mt-3 text-xs text-neutral-500">
              Format: sport-league-eventId (e.g., football-nfl-401547417, basketball-nba-401584793)
            </p>
          </div>

          <div className="mt-8">
            <h2 className="text-lg font-semibold text-neutral-950">Replay Demos</h2>
            <p className="mt-1 text-sm/6 text-neutral-600">
              Watch pre-recorded highlights with synced AI commentary.
            </p>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {DEMO_GAMES.map((game) => (
              <Link
                key={game.id}
                href={`/dashboard/watch/${game.id}`}
                className="group rounded-xl p-5 ring-1 ring-black/10 transition hover:ring-emerald-600/30 sm:p-6"
              >
                <p className="font-mono text-sm/6 text-emerald-700">{game.subtitle}</p>
                <h2 className="mt-2 text-xl font-semibold text-neutral-950 group-hover:text-emerald-800">
                  {game.title}
                </h2>
                <p className="mt-2 text-sm/6 text-neutral-600">Final: {game.finalScore}</p>
                <p className="mt-4 text-sm/6 font-medium text-emerald-700">Start broadcast →</p>
              </Link>
            ))}
          </div>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={handleSignOut}
              className="w-full rounded-lg px-3 py-2.5 text-base/7 font-medium text-neutral-700 ring-1 ring-black/10 sm:w-auto sm:py-2 sm:text-sm/6"
            >
              Sign out
            </button>
            <Link
              href="/"
              className="w-full rounded-lg px-3 py-2.5 text-center text-base/7 font-medium text-emerald-700 sm:w-auto sm:py-2 sm:text-sm/6"
            >
              Back to home
            </Link>
          </div>
        </div>
      </DashboardShell>
      <SiteFooter />
    </>
  );
}
