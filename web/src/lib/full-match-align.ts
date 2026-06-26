import { eventCacheKey } from "@/lib/match-cache";
import type { LiveMatch, LiveScoreLine } from "@/lib/livescore";
import type { TimelineEvent, TimelineEventKind } from "@/lib/timeline";

export type FullMatchOcrAnchor = {
  period: string;
  gameElapsed: number;
  videoAt: number;
  rawText: string;
  confidence: number;
};

export type FullMatchAlignedEvent = TimelineEvent & {
  eventKey: string;
  eventId: string;
  confidence: number;
};

const MINUTE_SECONDS = 60;
const FIRST_HALF_SECONDS = 45 * MINUTE_SECONDS;

export function parseClockText(rawText: string): {
  gameElapsed: number;
  period: string;
  confidence: number;
} | null {
  const normalized = rawText
    .replace(/[^\d:+.'’\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const stoppage = normalized.match(/\b(\d{1,2})\s*\+\s*(\d{1,2})\b/);
  if (stoppage) {
    const minute = Number.parseInt(stoppage[1]!, 10);
    const extra = Number.parseInt(stoppage[2]!, 10);
    if (minute <= 130 && extra <= 30) {
      return {
        gameElapsed: (minute + extra) * MINUTE_SECONDS,
        period: minute >= 45 ? "2nd Half" : "1st Half",
        confidence: 0.82,
      };
    }
  }

  const mmss = normalized.match(/\b(\d{1,3})\s*[:.]\s*(\d{2})\b/);
  if (mmss) {
    const minute = Number.parseInt(mmss[1]!, 10);
    const second = Number.parseInt(mmss[2]!, 10);
    if (minute <= 130 && second < 60) {
      return {
        gameElapsed: minute * MINUTE_SECONDS + second,
        period: minute >= 45 ? "2nd Half" : "1st Half",
        confidence: 0.9,
      };
    }
  }

  const compactClock = normalized.match(/\b(\d{1,2})(\d{2})\b/);
  if (compactClock) {
    const minute = Number.parseInt(compactClock[1]!, 10);
    const second = Number.parseInt(compactClock[2]!, 10);
    if (minute <= 130 && second < 60) {
      return {
        gameElapsed: minute * MINUTE_SECONDS + second,
        period: minute >= 45 ? "2nd Half" : "1st Half",
        confidence: 0.72,
      };
    }
  }

  const minuteOnly = normalized.match(/\b(\d{1,3})\s*['’]\b/);
  if (minuteOnly) {
    const minute = Number.parseInt(minuteOnly[1]!, 10);
    if (minute <= 130) {
      return {
        gameElapsed: minute * MINUTE_SECONDS,
        period: minute >= 45 ? "2nd Half" : "1st Half",
        confidence: 0.68,
      };
    }
  }

  return null;
}

export function smoothOcrAnchors(anchors: FullMatchOcrAnchor[]): FullMatchOcrAnchor[] {
  const sorted = [...anchors]
    .filter((anchor) => Number.isFinite(anchor.gameElapsed) && Number.isFinite(anchor.videoAt))
    .sort((a, b) => a.videoAt - b.videoAt);

  const result: FullMatchOcrAnchor[] = [];
  let secondHalfOffsetApplied = false;

  for (const anchor of sorted) {
    let adjusted = anchor;
    const previous = result[result.length - 1];

    if (
      previous &&
      anchor.gameElapsed < 35 * MINUTE_SECONDS &&
      previous.gameElapsed > 40 * MINUTE_SECONDS &&
      !secondHalfOffsetApplied
    ) {
      adjusted = {
        ...anchor,
        gameElapsed: anchor.gameElapsed + FIRST_HALF_SECONDS,
        period: "2nd Half",
      };
      secondHalfOffsetApplied = true;
    }

    const last = result[result.length - 1];
    if (last) {
      const videoDelta = adjusted.videoAt - last.videoAt;
      const gameDelta = adjusted.gameElapsed - last.gameElapsed;
      if (videoDelta <= 0 || gameDelta < -30) continue;
      if (videoDelta < 20 && Math.abs(gameDelta) > 10 * MINUTE_SECONDS) continue;
    }

    result.push(adjusted);
  }

  return result;
}

export function preserveHighlightOcrAnchors(anchors: FullMatchOcrAnchor[]): FullMatchOcrAnchor[] {
  const sorted = [...anchors]
    .filter((anchor) => Number.isFinite(anchor.gameElapsed) && Number.isFinite(anchor.videoAt))
    .sort((a, b) => a.videoAt - b.videoAt);

  const result: FullMatchOcrAnchor[] = [];
  for (const anchor of sorted) {
    const previous = result[result.length - 1];
    if (
      previous &&
      Math.abs(previous.videoAt - anchor.videoAt) < 0.5 &&
      Math.abs(previous.gameElapsed - anchor.gameElapsed) < 5
    ) {
      if (anchor.confidence > previous.confidence) {
        result[result.length - 1] = anchor;
      }
      continue;
    }
    result.push(anchor);
  }
  return result;
}

function isCondensedOrHighlightTimeline(anchors: FullMatchOcrAnchor[]): boolean {
  const sorted = [...anchors].sort((a, b) => a.videoAt - b.videoAt);
  if (sorted.length < 2) return false;

  let backwardJumps = 0;
  let largestGameElapsed = 0;
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1]!;
    const current = sorted[index]!;
    largestGameElapsed = Math.max(largestGameElapsed, current.gameElapsed);
    if (current.gameElapsed + 45 < previous.gameElapsed) {
      backwardJumps += 1;
    }
  }

  const videoSpan = sorted[sorted.length - 1]!.videoAt - sorted[0]!.videoAt;
  return backwardJumps > 0 || (largestGameElapsed > 75 * MINUTE_SECONDS && videoSpan < 35 * MINUTE_SECONDS);
}

function nearestAnchorVideoAt(
  gameElapsed: number,
  anchors: FullMatchOcrAnchor[],
): { videoAt: number; confidence: number } | null {
  if (anchors.length === 0) return null;

  const best = [...anchors]
    .map((anchor) => ({
      anchor,
      distance: Math.abs(anchor.gameElapsed - gameElapsed),
    }))
    .sort((a, b) => a.distance - b.distance || b.anchor.confidence - a.anchor.confidence)[0];

  if (!best) return null;
  const withinSameMinute = best.distance <= 65;
  const withinNearbyClip = best.distance <= 3 * MINUTE_SECONDS;
  if (!withinNearbyClip) return null;

  return {
    videoAt: Math.max(0, best.anchor.videoAt + Math.min(best.distance, 20) * 0.15),
    confidence: best.anchor.confidence * (withinSameMinute ? 1 : 0.55),
  };
}

export function interpolateVideoAt(
  gameElapsed: number,
  anchors: FullMatchOcrAnchor[],
): { videoAt: number; confidence: number } | null {
  const sorted = [...anchors].sort((a, b) => a.gameElapsed - b.gameElapsed);
  if (sorted.length === 0) return null;

  if (sorted.length === 1) {
    const only = sorted[0]!;
    return {
      videoAt: Math.max(0, only.videoAt + (gameElapsed - only.gameElapsed)),
      confidence: only.confidence * 0.45,
    };
  }

  let before = sorted[0]!;
  let after = sorted[sorted.length - 1]!;

  for (let i = 0; i < sorted.length - 1; i += 1) {
    const left = sorted[i]!;
    const right = sorted[i + 1]!;
    if (gameElapsed >= left.gameElapsed && gameElapsed <= right.gameElapsed) {
      before = left;
      after = right;
      break;
    }
  }

  if (gameElapsed < before.gameElapsed) {
    after = sorted[1]!;
  } else if (gameElapsed > after.gameElapsed) {
    before = sorted[sorted.length - 2]!;
  }

  const gameSpan = after.gameElapsed - before.gameElapsed;
  const videoSpan = after.videoAt - before.videoAt;
  if (gameSpan <= 0 || videoSpan <= 0) return null;

  const ratio = (gameElapsed - before.gameElapsed) / gameSpan;
  const extrapolated = ratio < 0 || ratio > 1;
  return {
    videoAt: Math.max(0, before.videoAt + ratio * videoSpan),
    confidence: Math.min(before.confidence, after.confidence) * (extrapolated ? 0.55 : 1),
  };
}

export function parseLiveScoreElapsed(line: Pick<LiveScoreLine, "timestamp" | "minute">): number {
  const parsed = parseClockText(line.timestamp);
  if (parsed) return parsed.gameElapsed;

  const minute = Number.parseInt(line.minute ?? "0", 10);
  return Number.isFinite(minute) && minute >= 0 ? minute * MINUTE_SECONDS : 0;
}

export function mapLiveScoreCategoryToKind(category?: string): TimelineEventKind {
  switch (category) {
    case "goal":
    case "penalty":
      return "score";
    case "card":
    case "substitution":
    case "offside":
      return "key_play";
    default:
      return "color";
  }
}

function stripTimestampPrefix(text: string): string {
  return text.replace(/^\d{1,3}(?::\d{2}|\+\d{1,2})\s*[—-]\s*/, "").trim();
}

export function alignLiveScoreLinesToAnchors(
  match: LiveMatch,
  lines: LiveScoreLine[],
  anchors: FullMatchOcrAnchor[],
): FullMatchAlignedEvent[] {
  const preserved = preserveHighlightOcrAnchors(anchors);
  const useNearestClockAnchor = isCondensedOrHighlightTimeline(preserved);
  const smoothed = useNearestClockAnchor ? preserved : smoothOcrAnchors(preserved);

  return lines
    .map((line, index) => {
      const gameElapsed = parseLiveScoreElapsed(line);
      const mapped = useNearestClockAnchor
        ? nearestAnchorVideoAt(gameElapsed, smoothed)
        : interpolateVideoAt(gameElapsed, smoothed);
      if (!mapped) return undefined;

      const minute = Math.floor(gameElapsed / MINUTE_SECONDS);
      const event: TimelineEvent = {
        id: line.dedupeKey,
        videoAt: mapped.videoAt + index * 0.05,
        gameElapsed,
        scoreHome: match.homeScore ?? 0,
        scoreAway: match.awayScore ?? 0,
        description: stripTimestampPrefix(line.text),
        periodLabel: minute > 45 ? "2nd Half" : "1st Half",
        kind: mapLiveScoreCategoryToKind(line.eventCategory),
        context: line.eventType,
      };

      return {
        ...event,
        eventKey: eventCacheKey(event),
        eventId: match.matchId,
        confidence: mapped.confidence,
      };
    })
    .filter((event): event is FullMatchAlignedEvent => Boolean(event));
}
