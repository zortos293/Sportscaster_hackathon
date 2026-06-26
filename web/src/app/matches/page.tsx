import Link from "next/link";
import { ImportedHighlightsRow } from "@/components/sportcast/ImportedHighlightsRow";
import { MatchCard } from "@/components/sportcast/MatchCard";
import { SportcastFooter } from "@/components/sportcast/SportcastFooter";
import { SportcastHeader } from "@/components/sportcast/SportcastHeader";
import { LIVE_DEMO_MATCHES } from "@/lib/sportcast/live-matches";

export default function MatchesPage() {
  return (
    <>
      <SportcastHeader activeNav="live" dark />
      <main className="mx-auto max-w-(--spacing-container-max) px-margin-mobile py-8 md:px-margin-desktop">
        <section className="mb-8">
          <div className="mb-2 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <h1 className="mb-2 font-display text-headline-lg text-on-surface">
                Continue Watching
              </h1>
              <p className="text-body-md text-secondary">
                Demo replays and imported full-match highlights.
              </p>
            </div>
            <Link href="/live" className="shrink-0 font-label-md text-primary hover:underline">
              ← Back to Live
            </Link>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {LIVE_DEMO_MATCHES.map((match) => (
            <MatchCard key={match.id} match={match} variant="compact" />
          ))}
        </div>

        <section className="mt-16">
          <h2 className="mb-6 font-display text-headline-lg text-on-surface">
            Imported Highlights
          </h2>
          <ImportedHighlightsRow />
        </section>
      </main>
      <SportcastFooter />
    </>
  );
}
