"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { LiveBroadcastPlayer } from "@/components/LiveBroadcastPlayer";
import { SportcastFooter } from "@/components/sportcast/SportcastFooter";
import { SportcastHeader } from "@/components/sportcast/SportcastHeader";

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

export default function LiveStreamPage() {
  const params = useParams();
  const gameId = params.gameId as string;
  const parsed = parseGameId(gameId);

  return (
    <>
      <SportcastHeader activeNav="live" />
      <main className="mx-auto max-w-(--spacing-container-max) px-margin-mobile py-8 md:px-margin-desktop">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-label-md text-primary">Live Stream</p>
            <h1 className="mt-1 font-display text-headline-lg text-on-surface">
              {parsed?.title ?? "Live Broadcast"}
            </h1>
          </div>
          <Link
            href="/live"
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 font-label-md text-primary ring-1 ring-outline-variant transition hover:bg-surface-container-low"
          >
            ← Back to Live
          </Link>
        </div>

        {!parsed ? (
          <div className="rounded-2xl border border-red-200 bg-surface p-6">
            <p className="text-body-md text-red-700">
              Invalid game ID format. Expected: sport-league-eventId
            </p>
            <p className="mt-2 text-body-md text-secondary">
              Example:{" "}
              <code className="rounded bg-surface-container px-1.5 py-0.5">
                football-nfl-401547417
              </code>
            </p>
          </div>
        ) : (
          <LiveBroadcastPlayer gameId={gameId} title={parsed.title} />
        )}
      </main>
      <SportcastFooter />
    </>
  );
}
