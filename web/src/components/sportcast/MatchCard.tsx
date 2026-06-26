import Image from "next/image";
import Link from "next/link";
import type { SportcastMatch } from "@/lib/sportcast/matches";
import { MatchBadge } from "./MatchBadge";
import { MaterialIcon } from "./MaterialIcon";

export function MatchCard({
  match,
  variant = "grid",
}: {
  match: SportcastMatch;
  variant?: "grid" | "compact";
}) {
  const badgePosition =
    match.badge.type === "scheduled"
      ? "bottom-3 left-3"
      : match.badge.type === "trending"
        ? "top-3 right-3"
        : "top-3 left-3";

  if (variant === "compact") {
    return (
      <Link href={`/matches#${match.id}`} className="group block">
        <div className="relative mb-3 aspect-video overflow-hidden rounded-lg border border-surface-container bg-black shadow-sm">
          <Image
            src={match.poster}
            alt={match.league}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, 33vw"
          />
          {match.badge.type === "live" ? (
            <span className="absolute top-2 left-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-white uppercase">
              Live
            </span>
          ) : null}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 transition-opacity group-hover:opacity-100">
            <MaterialIcon name="play_circle" filled className="text-5xl text-white" />
          </div>
        </div>
        <h3 className="font-display text-base text-on-surface">{match.venue}</h3>
        <p className="text-label-sm text-secondary">
          {match.sport}
          {match.subtitle ? ` • ${match.subtitle}` : ` • ${match.league}`}
        </p>
      </Link>
    );
  }

  return (
    <article
      id={match.id}
      className="group scroll-mt-28 overflow-hidden rounded-xl border border-surface-container bg-surface-container-lowest shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-video overflow-hidden bg-black">
        <Image
          src={match.poster}
          alt={match.league}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 33vw"
        />
        <div className={`absolute ${badgePosition}`}>
          <MatchBadge badge={match.badge} />
        </div>
      </div>
      <div className="p-4">
        <span className="text-xs font-bold tracking-wider text-primary uppercase">
          {match.league}
        </span>
        <h3 className="mt-1 mb-1 font-display text-on-surface">{match.venue}</h3>
        <p className="text-sm text-secondary">{match.sport}</p>
      </div>
    </article>
  );
}
