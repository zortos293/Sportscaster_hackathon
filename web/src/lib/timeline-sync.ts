import type { TimelineEvent, TimelineEventKind } from "@/lib/timeline";

export type VideoSyncMode = "highlights" | "full_match";

const FOOTBALL_QUARTER_SECONDS = 15 * 60;
const SOCCER_MATCH_SECONDS = 90 * 60;

const KIND_PRIORITY: Record<TimelineEventKind, number> = {
  opening: 0,
  period: 1,
  score: 2,
  key_play: 3,
  stat_spotlight: 4,
  color: 5,
};

export function mapGameTimeToVideoLinear(
  gameElapsed: number,
  maxGameElapsed: number,
  videoDuration: number,
): number {
  const introSeconds = 5;
  const outroSeconds = 8;
  const usable = Math.max(videoDuration - introSeconds - outroSeconds, 1);
  const ratio = Math.min(Math.max(gameElapsed / Math.max(maxGameElapsed, 1), 0), 1);
  return introSeconds + ratio * usable;
}

/** Highlight reels cut between moments in order — map events sequentially, not by game clock. */
export function assignHighlightVideoTimes(
  events: TimelineEvent[],
  videoDuration: number,
): TimelineEvent[] {
  const intro = 5;
  const outro = 8;
  const usable = Math.max(videoDuration - intro - outro, 1);

  const contentEvents = events
    .filter((e) => e.kind !== "color")
    .sort(
      (a, b) =>
        a.gameElapsed - b.gameElapsed ||
        KIND_PRIORITY[a.kind] - KIND_PRIORITY[b.kind] ||
        a.id.localeCompare(b.id),
    );

  const timed = contentEvents.map((event, index) => {
    const slot =
      contentEvents.length <= 1
        ? 0
        : index / (contentEvents.length - 1);
    return {
      ...event,
      videoAt: intro + slot * usable,
    };
  });

  return ensureContinuousCoverage(timed, videoDuration, []);
}

export function assignFullMatchVideoTimes(
  events: TimelineEvent[],
  videoDuration: number,
  sport: string,
): TimelineEvent[] {
  const maxElapsed = Math.max(
    ...events.map((e) => e.gameElapsed),
    sport === "soccer" ? SOCCER_MATCH_SECONDS : FOOTBALL_QUARTER_SECONDS * 4,
  );

  return events
    .filter((e) => e.kind !== "color")
    .map((event) => ({
      ...event,
      videoAt: mapGameTimeToVideoLinear(event.gameElapsed, maxElapsed, videoDuration),
    }));
}

export function ensureContinuousCoverage(
  events: TimelineEvent[],
  videoDuration: number,
  facts: string[],
): TimelineEvent[] {
  const sorted = [...events].sort((a, b) => a.videoAt - b.videoAt);
  const result: TimelineEvent[] = [];
  let factIndex = 0;

  const minGap = 10;
  const maxFillersPerGap = 4;

  for (let i = 0; i < sorted.length; i += 1) {
    const current = sorted[i];
    result.push(current);

    const next = sorted[i + 1];
    const gapStart = current.videoAt;
    const gapEnd = next?.videoAt ?? Math.max(videoDuration - 6, gapStart + minGap);
    const gap = gapEnd - gapStart;

    if (gap < minGap) continue;

    const fillerCount = Math.min(maxFillersPerGap, Math.max(1, Math.floor(gap / minGap) - 1));
    for (let j = 1; j <= fillerCount; j += 1) {
      const videoAt = gapStart + (gap * j) / (fillerCount + 1);
      const fact = facts[factIndex % Math.max(facts.length, 1)] ?? "Keep the energy up between plays.";
      factIndex += 1;
      const kind: TimelineEventKind = j % 2 === 1 ? "color" : "stat_spotlight";

      result.push({
        id: `${kind}-${Math.round(videoAt * 10)}-${factIndex}`,
        videoAt,
        gameElapsed: current.gameElapsed,
        scoreHome: current.scoreHome,
        scoreAway: current.scoreAway,
        periodLabel: current.periodLabel,
        kind,
        description:
          kind === "stat_spotlight"
            ? `Stat spotlight — ${fact}`
            : "Between-the-whistles banter — keep the booth alive.",
        context: fact,
      });
    }
  }

  return result.sort((a, b) => a.videoAt - b.videoAt);
}

export function applyVideoSync(
  events: TimelineEvent[],
  videoDuration: number,
  sport: string,
  mode: VideoSyncMode,
  facts: string[],
): TimelineEvent[] {
  const base =
    mode === "highlights"
      ? assignHighlightVideoTimes(events, videoDuration)
      : assignFullMatchVideoTimes(events, videoDuration, sport);

  return ensureContinuousCoverage(base, videoDuration, facts);
}
