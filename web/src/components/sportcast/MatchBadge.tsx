import type { MatchBadge as MatchBadgeType } from "@/lib/sportcast/matches";
import { MaterialIcon } from "./MaterialIcon";

export function MatchBadge({ badge }: { badge: MatchBadgeType }) {
  if (badge.type === "live") {
    return (
      <span className="live-pulse flex items-center gap-1 rounded-full bg-primary px-2 py-1 text-[10px] font-extrabold uppercase text-white">
        <span className="h-1.5 w-1.5 rounded-full bg-white" />
        Live
      </span>
    );
  }

  if (badge.type === "trending") {
    return (
      <span className="flex items-center gap-1 rounded-full bg-secondary/80 px-2 py-1 text-[10px] font-extrabold uppercase text-white backdrop-blur-md">
        <MaterialIcon name="trending_up" className="text-sm" />
        Trending
      </span>
    );
  }

  if (badge.type === "replay") {
    return (
      <span className="rounded-full bg-surface-container-high px-2 py-1 text-[10px] font-extrabold uppercase text-on-surface-variant">
        Replay
      </span>
    );
  }

  return (
    <span className="rounded-full bg-on-surface px-2 py-1 text-[10px] font-bold uppercase text-surface">
      {badge.label}
    </span>
  );
}
