import Link from "next/link";
import { LivePlayerSection } from "@/components/sportcast/LivePlayerSection";
import { MatchCard } from "@/components/sportcast/MatchCard";
import { MaterialIcon } from "@/components/sportcast/MaterialIcon";
import { SportCategoryChips } from "@/components/sportcast/SportCategoryChips";
import { SportcastFooter } from "@/components/sportcast/SportcastFooter";
import { SportcastHeader } from "@/components/sportcast/SportcastHeader";
import { getFeaturedDemoMatch, LIVE_DEMO_MATCHES } from "@/lib/sportcast/live-matches";

const TRENDING = [
  {
    tag: "TRENDING #1",
    tagClass: "text-primary",
    icon: "trending_up" as const,
    title: "Champions League: Madrid vs London",
    viewers: "4.2M Viewers",
  },
  {
    tag: "HOCKEY",
    tagClass: "text-on-surface-variant",
    icon: null,
    title: "World Cup Qualifiers: Canada vs USA",
    viewers: "1.8M Viewers",
  },
  {
    tag: "FUTSAL",
    tagClass: "text-on-surface-variant",
    icon: null,
    title: "Copa Futsal: Brazil vs Argentina",
    viewers: "950K Viewers",
  },
];

export default function LivePage() {
  const featured = getFeaturedDemoMatch();
  const continueWatching = LIVE_DEMO_MATCHES;

  return (
    <>
      <SportcastHeader activeNav="live" showCategories />
      <SportCategoryChips />
      <LivePlayerSection featured={featured} />

      <main className="mx-auto max-w-(--spacing-container-max) px-margin-mobile pb-8 pt-8 md:px-margin-desktop">
        <div className="space-y-16">
          <section>
            <div className="mb-6 flex items-end justify-between">
              <h2 className="font-display text-headline-lg text-on-surface">
                Continue Watching
              </h2>
              <Link href="/matches" className="font-label-md text-primary hover:underline">
                View All
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {continueWatching.map((match) => (
                <MatchCard key={match.id} match={match} variant="compact" />
              ))}
            </div>
          </section>

          <section className="-mx-margin-mobile rounded-3xl bg-surface-container-low px-margin-mobile py-12 md:-mx-margin-desktop md:px-margin-desktop">
            <div className="mb-8 flex items-end justify-between">
              <h2 className="font-display text-headline-lg text-on-surface">
                Trending Matches
              </h2>
              <Link href="#" className="font-label-md text-primary hover:underline">
                See Rankings
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {TRENDING.map((item) => (
                <div
                  key={item.title}
                  className="flex h-48 flex-col justify-between rounded-2xl border border-surface-container-highest bg-surface p-6 shadow-sm"
                >
                  <div className="flex items-start justify-between">
                    <span
                      className={`flex items-center gap-2 text-label-sm font-bold ${item.tagClass}`}
                    >
                      {item.icon ? <MaterialIcon name={item.icon} className="text-base" /> : null}
                      {item.tag}
                    </span>
                    <MaterialIcon name="more_vert" className="text-secondary" />
                  </div>
                  <div>
                    <h3 className="font-display text-on-surface">{item.title}</h3>
                    <p className="text-body-md text-secondary">{item.viewers}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
      <SportcastFooter />
    </>
  );
}
