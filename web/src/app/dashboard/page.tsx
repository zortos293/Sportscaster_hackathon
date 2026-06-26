"use client";

import { useState } from "react";
import { useAppAuth } from "@/components/AppAuthProvider";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DashboardShell } from "@/components/DashboardShell";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

type ImportedHighlightStatus = {
  id: string;
  title: string;
  subtitle: string;
  feedType: "full_match";
  eventsLineCount: number;
  alignmentStatus?: string;
  alignmentConfidence?: number;
  cached: boolean;
  lineCount: number;
};

export default function DashboardPage() {
  const { isAuthenticated, isLoading, signOut } = useAppAuth();
  const router = useRouter();
  const [games, setGames] = useState<ImportedHighlightStatus[]>([]);
  const [loadingGames, setLoadingGames] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/admin/cache-matches");
        const data = (await response.json()) as { games?: ImportedHighlightStatus[] };
        if (cancelled || !data.games) return;
        setGames(data.games.filter((game) => game.feedType === "full_match"));
      } catch {
        // Status is optional on dashboard — cards still work without it.
      } finally {
        if (!cancelled) setLoadingGames(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
              Your imported highlight videos with OCR-aligned match moments and generated
              commentary. Add and cache new highlights in the{" "}
              <Link href="/admin" className="font-medium text-emerald-700">
                admin panel
              </Link>.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {loadingGames ? (
              <p className="text-sm/6 text-neutral-600">Loading imported highlights…</p>
            ) : null}
            {!loadingGames && games.length === 0 ? (
              <div className="rounded-xl p-5 ring-1 ring-black/10 sm:p-6">
                <h2 className="text-xl font-semibold text-neutral-950">No imported highlights yet</h2>
                <p className="mt-2 text-sm/6 text-neutral-600">
                  Import a YouTube/VOD highlight in admin to make it appear here.
                </p>
                <Link href="/admin" className="mt-4 inline-block text-sm/6 font-medium text-emerald-700">
                  Import highlights
                </Link>
              </div>
            ) : null}
            {games.map((game) => (
              <Link
                key={game.id}
                href={`/dashboard/watch/${game.id}`}
                className="group rounded-xl p-5 ring-1 ring-black/10 transition hover:ring-emerald-600/30 sm:p-6"
              >
                <p className="font-mono text-sm/6 text-emerald-700">{game.subtitle}</p>
                <h2 className="mt-2 text-xl font-semibold text-neutral-950 group-hover:text-emerald-800">
                  {game.title}
                </h2>
                <p className="mt-2 text-sm/6 text-neutral-600">
                  {game.eventsLineCount} aligned moments · {game.alignmentStatus ?? "pending"}
                </p>
                <p className="mt-1 text-sm/6 text-neutral-500">
                  OCR confidence{" "}
                  {game.alignmentConfidence != null
                    ? `${Math.round(game.alignmentConfidence * 100)}%`
                    : "—"}
                </p>
                {game.cached ? (
                  <p className="mt-2 text-sm/6 font-medium text-emerald-700">
                    Cached · {game.lineCount} lines ready
                  </p>
                ) : (
                  <p className="mt-2 text-sm/6 text-amber-700">Not cached — generate in admin</p>
                )}
                <p className="mt-4 text-sm/6 font-medium text-emerald-700">Start broadcast →</p>
              </Link>
            ))}
          </div>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link
              href="/admin"
              className="w-full rounded-lg bg-emerald-700 px-3 py-2.5 text-center text-base/7 font-medium text-white sm:w-auto sm:py-2 sm:text-sm/6"
            >
              Cache commentary
            </Link>
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
