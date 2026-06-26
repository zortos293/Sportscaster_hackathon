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

export type FullMatchAlignmentMode = "highlight" | "full_match";

export type HighlightSegment = {
  anchors: FullMatchOcrAnchor[];
  videoAtStart: number;
  videoAtEnd: number;
  minGameElapsed: number;
  maxGameElapsed: number;
};

export type AlignmentStats = {
  anchorCount: number;
  segmentCount: number;
  alignmentMode: FullMatchAlignmentMode;
};

export type AlignLiveScoreOptions = {
  alignmentMode?: FullMatchAlignmentMode;
  sampleIntervalSeconds?: number;
};

const MINUTE_SECONDS = 60;
const FIRST_HALF_SECONDS = 45 * MINUTE_SECONDS;
const SEGMENT_BACKWARD_JUMP_SECONDS = 3 * MINUTE_SECONDS;
const HIGHLIGHT_MATCH_TOLERANCE_SECONDS = 90;
const EXACT_ANCHOR_SNAP_SECONDS = 20;
const DEFAULT_SAMPLE_INTERVAL_SECONDS = 2;

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

function applySecondHalfRelativeOffset(
  anchor: FullMatchOcrAnchor,
  previous: FullMatchOcrAnchor | undefined,
): FullMatchOcrAnchor {
  if (!previous) return anchor;
  if (previous.gameElapsed <= 40 * MINUTE_SECONDS) return anchor;
  if (anchor.gameElapsed >= 20 * MINUTE_SECONDS) return anchor;

  const minute = Math.floor(anchor.gameElapsed / MINUTE_SECONDS);
  if (minute >= 20) return anchor;

  return {
    ...anchor,
    gameElapsed: anchor.gameElapsed + FIRST_HALF_SECONDS,
    period: "2nd Half",
    confidence: anchor.confidence * 0.95,
  };
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

export function filterNoisyOcrAnchors(
  anchors: FullMatchOcrAnchor[],
  sampleIntervalSeconds = DEFAULT_SAMPLE_INTERVAL_SECONDS,
): FullMatchOcrAnchor[] {
  const preserved = preserveHighlightOcrAnchors(anchors);
  const result: FullMatchOcrAnchor[] = [];

  for (const anchor of preserved) {
    const previous = result[result.length - 1];
    let adjusted = applySecondHalfRelativeOffset(anchor, previous);
    const secondHalfCorrected = adjusted.gameElapsed !== anchor.gameElapsed;

    if (previous && !secondHalfCorrected) {
      const videoDelta = adjusted.videoAt - previous.videoAt;
      const gameDelta = adjusted.gameElapsed - previous.gameElapsed;
      const isSegmentBoundary = gameDelta < -SEGMENT_BACKWARD_JUMP_SECONDS;

      if (
        !isSegmentBoundary &&
        videoDelta <= sampleIntervalSeconds * 1.5 &&
        gameDelta > 8 * MINUTE_SECONDS
      ) {
        if (adjusted.confidence <= previous.confidence) continue;
        result.pop();
      }

      if (
        !isSegmentBoundary &&
        adjusted.confidence < 0.7 &&
        videoDelta <= 4 &&
        Math.abs(gameDelta) > 2 * MINUTE_SECONDS
      ) {
        continue;
      }
    }

    result.push(adjusted);
  }

  return result;
}

function buildSegment(anchors: FullMatchOcrAnchor[]): HighlightSegment {
  const sorted = [...anchors].sort((a, b) => a.videoAt - b.videoAt);
  const gameElapsedValues = sorted.map((anchor) => anchor.gameElapsed);
  return {
    anchors: sorted,
    videoAtStart: sorted[0]?.videoAt ?? 0,
    videoAtEnd: sorted[sorted.length - 1]?.videoAt ?? 0,
    minGameElapsed: Math.min(...gameElapsedValues),
    maxGameElapsed: Math.max(...gameElapsedValues),
  };
}

export function splitHighlightSegments(anchors: FullMatchOcrAnchor[]): HighlightSegment[] {
  const sorted = [...anchors].sort((a, b) => a.videoAt - b.videoAt);
  if (sorted.length === 0) return [];

  const segments: HighlightSegment[] = [];
  let current: FullMatchOcrAnchor[] = [sorted[0]!];

  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1]!;
    const anchor = sorted[index]!;
    if (anchor.gameElapsed + SEGMENT_BACKWARD_JUMP_SECONDS < previous.gameElapsed) {
      segments.push(buildSegment(current));
      current = [anchor];
    } else {
      current.push(anchor);
    }
  }

  segments.push(buildSegment(current));
  return segments;
}

export function isCondensedOrHighlightTimeline(anchors: FullMatchOcrAnchor[]): boolean {
  const sorted = [...anchors].sort((a, b) => a.videoAt - b.videoAt);
  if (sorted.length < 2) return false;

  let backwardJumps = 0;
  let largestGameElapsed = sorted[0]!.gameElapsed;
  let smallestGameElapsed = sorted[0]!.gameElapsed;

  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1]!;
    const current = sorted[index]!;
    largestGameElapsed = Math.max(largestGameElapsed, current.gameElapsed);
    smallestGameElapsed = Math.min(smallestGameElapsed, current.gameElapsed);
    if (current.gameElapsed + 45 < previous.gameElapsed) {
      backwardJumps += 1;
    }
  }

  const videoSpan = sorted[sorted.length - 1]!.videoAt - sorted[0]!.videoAt;
  const gameSpan = largestGameElapsed - smallestGameElapsed;

  return (
    backwardJumps > 0 ||
    (largestGameElapsed > 75 * MINUTE_SECONDS && videoSpan < 35 * MINUTE_SECONDS) ||
    (videoSpan > 0 && gameSpan / videoSpan > 2)
  );
}

function resolveUseHighlightMode(
  anchors: FullMatchOcrAnchor[],
  mode?: FullMatchAlignmentMode,
): boolean {
  if (mode === "highlight") return true;
  if (mode === "full_match") return false;
  return isCondensedOrHighlightTimeline(anchors);
}

function isContinuousPlayPair(
  before: FullMatchOcrAnchor,
  after: FullMatchOcrAnchor,
): boolean {
  const gameSpan = after.gameElapsed - before.gameElapsed;
  const videoSpan = after.videoAt - before.videoAt;
  if (gameSpan <= 0 || videoSpan <= 0) return false;
  return gameSpan <= videoSpan * 1.6 + 20 && videoSpan <= gameSpan * 2 + 20;
}

function findBestSegment(
  gameElapsed: number,
  segments: HighlightSegment[],
): HighlightSegment | null {
  if (segments.length === 0) return null;

  const containing = segments.filter(
    (segment) =>
      gameElapsed >= segment.minGameElapsed - HIGHLIGHT_MATCH_TOLERANCE_SECONDS &&
      gameElapsed <= segment.maxGameElapsed + HIGHLIGHT_MATCH_TOLERANCE_SECONDS,
  );
  if (containing.length === 1) return containing[0]!;
  if (containing.length > 1) {
    return containing.sort((a, b) => {
      const aCenter = (a.minGameElapsed + a.maxGameElapsed) / 2;
      const bCenter = (b.minGameElapsed + b.maxGameElapsed) / 2;
      return Math.abs(aCenter - gameElapsed) - Math.abs(bCenter - gameElapsed);
    })[0]!;
  }

  return segments.sort((a, b) => {
    const aDistance =
      gameElapsed < a.minGameElapsed
        ? a.minGameElapsed - gameElapsed
        : gameElapsed > a.maxGameElapsed
          ? gameElapsed - a.maxGameElapsed
          : 0;
    const bDistance =
      gameElapsed < b.minGameElapsed
        ? b.minGameElapsed - gameElapsed
        : gameElapsed > b.maxGameElapsed
          ? gameElapsed - b.maxGameElapsed
          : 0;
    return aDistance - bDistance;
  })[0]!;
}

export function mapHighlightEventToVideoAt(
  gameElapsed: number,
  segments: HighlightSegment[],
): { videoAt: number; confidence: number } | null {
  if (segments.length === 0) return null;

  const segment = findBestSegment(gameElapsed, segments);
  if (!segment || segment.anchors.length === 0) return null;

  const sorted = [...segment.anchors].sort((a, b) => a.gameElapsed - b.gameElapsed);

  const exactMatches = sorted.filter(
    (anchor) => Math.abs(anchor.gameElapsed - gameElapsed) <= EXACT_ANCHOR_SNAP_SECONDS,
  );
  if (exactMatches.length > 0) {
    const best = exactMatches.sort((a, b) => {
      const gameDiff =
        Math.abs(a.gameElapsed - gameElapsed) - Math.abs(b.gameElapsed - gameElapsed);
      if (gameDiff !== 0) return gameDiff;
      return a.videoAt - b.videoAt;
    })[0]!;
    const distance = Math.abs(best.gameElapsed - gameElapsed);
    return {
      videoAt: Math.max(0, best.videoAt),
      confidence: best.confidence * (distance <= 5 ? 1 : 0.85),
    };
  }

  for (let index = 0; index < sorted.length - 1; index += 1) {
    const left = sorted[index]!;
    const right = sorted[index + 1]!;
    if (gameElapsed < left.gameElapsed || gameElapsed > right.gameElapsed) continue;

    if (isContinuousPlayPair(left, right)) {
      return interpolateVideoAt(gameElapsed, [left, right]);
    }

    const leftDistance = gameElapsed - left.gameElapsed;
    const rightDistance = right.gameElapsed - gameElapsed;
    const pick = leftDistance <= rightDistance ? left : right;
    return {
      videoAt: Math.max(0, pick.videoAt),
      confidence: pick.confidence * 0.72,
    };
  }

  if (sorted.length >= 2) {
    const interpolated = interpolateVideoAt(gameElapsed, sorted);
    if (interpolated) return interpolated;
  }

  const nearest = [...sorted].sort((a, b) => {
    const distanceDiff =
      Math.abs(a.gameElapsed - gameElapsed) - Math.abs(b.gameElapsed - gameElapsed);
    if (distanceDiff !== 0) return distanceDiff;
    return a.videoAt - b.videoAt;
  })[0]!;

  if (Math.abs(nearest.gameElapsed - gameElapsed) <= HIGHLIGHT_MATCH_TOLERANCE_SECONDS) {
    return {
      videoAt: Math.max(0, nearest.videoAt),
      confidence: nearest.confidence * 0.65,
    };
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

export function prepareAlignmentAnchors(
  anchors: FullMatchOcrAnchor[],
  options?: AlignLiveScoreOptions,
): {
  anchors: FullMatchOcrAnchor[];
  segments: HighlightSegment[];
  alignmentMode: FullMatchAlignmentMode;
  smoothedAnchors: FullMatchOcrAnchor[];
} {
  const filtered = filterNoisyOcrAnchors(
    anchors,
    options?.sampleIntervalSeconds ?? DEFAULT_SAMPLE_INTERVAL_SECONDS,
  );
  const useHighlight = resolveUseHighlightMode(filtered, options?.alignmentMode);
  const segments = splitHighlightSegments(filtered);
  const smoothedAnchors = useHighlight ? filtered : smoothOcrAnchors(filtered);

  return {
    anchors: filtered,
    segments,
    alignmentMode: useHighlight ? "highlight" : "full_match",
    smoothedAnchors,
  };
}

export function getAlignmentStats(
  anchors: FullMatchOcrAnchor[],
  options?: AlignLiveScoreOptions,
): AlignmentStats {
  const prepared = prepareAlignmentAnchors(anchors, options);
  return {
    anchorCount: prepared.anchors.length,
    segmentCount: prepared.segments.length,
    alignmentMode: prepared.alignmentMode,
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
  options?: AlignLiveScoreOptions,
): FullMatchAlignedEvent[] {
  const prepared = prepareAlignmentAnchors(anchors, options);
  const useHighlight = prepared.alignmentMode === "highlight";

  return lines
    .map((line, index) => {
      const gameElapsed = parseLiveScoreElapsed(line);
      const mapped = useHighlight
        ? mapHighlightEventToVideoAt(gameElapsed, prepared.segments)
        : interpolateVideoAt(gameElapsed, prepared.smoothedAnchors);
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
