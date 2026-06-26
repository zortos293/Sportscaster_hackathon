"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import { LiveBroadcastPlayer } from "@/components/LiveBroadcastPlayer";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

function parseGameId(gameId: string): {
  sport: string;
  league: string;
  eventId: string;
  title: string;
} | null {
  const parts = gameId.split("-");
  if (parts.length < 3) return null;

  const [sport, league, eventId] = parts;
  const sportLabels: Record<string, string> = {
    football: "Football",
    basketball: "Basketball",
    soccer: "Soccer",
    baseball: "Baseball",
    hockey: "Hockey",
  };
  const leagueLabels: Record<string, string> = {
    nfl: "NFL",
    nba: "NBA",
    mlb: "MLB",
    nhl: "NHL",
    "college-football": "College Football",
    "mens-college-basketball": "College Basketball",
    eng: "Premier League",
    usa: "MLS",
  };

  const sportLabel = sportLabels[sport] ?? sport.toUpperCase();
  const leagueLabel = leagueLabels[league] ?? league.toUpperCase();

  return {
    sport,
    league,
    eventId,
    title: `${leagueLabel} Live`,
  };
}

export default function LivePage() {
  const params = useParams();
  const gameId = params.gameId as string;
  const parsed = parseGameId(gameId);

  return (
    <>
      <SiteHeader />
      <DashboardShell>
        <div className="px-6 py-8 sm:py-10 lg:px-8 lg:py-12">
          <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-mono text-sm/6 text-red-600">Live</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight text-neutral-950 sm:text-4xl">
                {parsed?.title ?? "Live Broadcast"}
              </h1>
            </div>
            <Link
              href="/dashboard"
              className="rounded-lg px-3 py-2 text-sm/6 font-medium text-neutral-700 ring-1 ring-black/10"
            >
              ← Back to dashboard
            </Link>
          </div>

          {!parsed ? (
            <div className="rounded-xl p-5 ring-1 ring-red-200">
              <p className="text-sm/6 text-red-700">
                Invalid game ID format. Expected: sport-league-eventId
              </p>
              <p className="mt-2 text-sm/6 text-neutral-600">
                Example: <code className="rounded bg-neutral-100 px-1.5 py-0.5">football-nfl-401547417</code>
              </p>
            </div>
          ) : (
            <LiveBroadcastPlayer gameId={gameId} title={parsed.title} />
          )}

          <div className="mt-8 rounded-xl bg-neutral-50 p-5 ring-1 ring-black/5">
            <h3 className="text-sm font-medium text-neutral-900">
              Game ID Format
            </h3>
            <p className="mt-2 text-sm/6 text-neutral-600">
              Use the format: <code className="rounded bg-white px-1.5 py-0.5 ring-1 ring-black/10">sport-league-eventId</code>
            </p>
            <ul className="mt-3 space-y-1 text-sm text-neutral-600">
              <li>
                <code className="rounded bg-white px-1.5 py-0.5 ring-1 ring-black/10">football-nfl-401547417</code> — NFL game
              </li>
              <li>
                <code className="rounded bg-white px-1.5 py-0.5 ring-1 ring-black/10">basketball-nba-401584793</code> — NBA game
              </li>
              <li>
                <code className="rounded bg-white px-1.5 py-0.5 ring-1 ring-black/10">soccer-eng.1-123456</code> — Premier League game
              </li>
            </ul>
            <p className="mt-3 text-sm/6 text-neutral-500">
              Find event IDs on ESPN game pages — the number in the URL after /game/
            </p>
          </div>
        </div>
      </DashboardShell>
      <SiteFooter />
    </>
  );
}
