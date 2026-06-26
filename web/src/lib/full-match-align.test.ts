import { describe, expect, it } from "vitest";
import {
  alignLiveScoreLinesToAnchors,
  filterNoisyOcrAnchors,
  isCondensedOrHighlightTimeline,
  mapHighlightEventToVideoAt,
  parseClockText,
  parseLiveScoreElapsed,
  splitHighlightSegments,
  type FullMatchOcrAnchor,
} from "@/lib/full-match-align";
import type { LiveMatch, LiveScoreLine } from "@/lib/livescore";

function anchor(
  videoAt: number,
  gameElapsed: number,
  confidence = 0.9,
): FullMatchOcrAnchor {
  const minute = Math.floor(gameElapsed / 60);
  return {
    period: minute >= 45 ? "2nd Half" : "1st Half",
    gameElapsed,
    videoAt,
    rawText: `${minute}:00`,
    confidence,
  };
}

const sampleMatch: LiveMatch = {
  matchId: "1417943",
  homeTeamName: "Tunisia",
  awayTeamName: "Netherlands",
  homeScore: 0,
  awayScore: 2,
};

describe("parseClockText", () => {
  it("parses stoppage time", () => {
    const parsed = parseClockText("45 + 02");
    expect(parsed?.gameElapsed).toBe((45 + 2) * 60);
  });

  it("parses mm:ss clocks", () => {
    const parsed = parseClockText("67:12");
    expect(parsed?.gameElapsed).toBe(67 * 60 + 12);
  });
});

describe("filterNoisyOcrAnchors", () => {
  it("applies second-half relative offset after halftime", () => {
    const filtered = filterNoisyOcrAnchors([
      anchor(100, 44 * 60),
      anchor(102, 7 * 60 + 30),
    ]);
    expect(filtered[1]?.gameElapsed).toBe(45 * 60 + 7 * 60 + 30);
  });
});

describe("isCondensedOrHighlightTimeline", () => {
  it("detects compressed chronological highlights without backward jumps", () => {
    const anchors = [
      anchor(30, 23 * 60),
      anchor(180, 45 * 60),
      anchor(420, 67 * 60),
      anchor(780, 89 * 60),
    ];
    expect(isCondensedOrHighlightTimeline(anchors)).toBe(true);
  });
});

describe("splitHighlightSegments", () => {
  it("splits on backward clock jumps", () => {
    const segments = splitHighlightSegments([
      anchor(120, 67 * 60),
      anchor(300, 67 * 60 + 20),
      anchor(420, 23 * 60),
    ]);
    expect(segments).toHaveLength(2);
    expect(segments[0]?.minGameElapsed).toBe(67 * 60);
    expect(segments[1]?.minGameElapsed).toBe(23 * 60);
  });
});

describe("mapHighlightEventToVideoAt", () => {
  it("snaps to the earliest matching clip for replayed minutes", () => {
    const segments = splitHighlightSegments([
      anchor(134, 67 * 60 + 12),
      anchor(520, 67 * 60 + 5),
    ]);
    const mapped = mapHighlightEventToVideoAt(67 * 60 + 10, segments);
    expect(mapped?.videoAt).toBe(134);
  });

  it("uses the OCR video timestamp when the scoreboard clock matches", () => {
    const segments = splitHighlightSegments([anchor(164, 2 * 60 + 3)]);
    const mapped = mapHighlightEventToVideoAt(2 * 60 + 3, segments);
    expect(mapped?.videoAt).toBe(164);
  });

  it("interpolates between continuous-play anchors instead of snapping to the nearest clip", () => {
    const segments = splitHighlightSegments([
      anchor(164, 2 * 60 + 3),
      anchor(220, 3 * 60),
    ]);
    const mapped = mapHighlightEventToVideoAt(2 * 60 + 30, segments);
    expect(mapped?.videoAt).toBeCloseTo(191, 0);
  });
});

describe("alignLiveScoreLinesToAnchors", () => {
  it("maps chronological highlight goals to OCR clip times instead of linear spread", () => {
    const anchors = [
      anchor(40, 23 * 60 + 10),
      anchor(210, 45 * 60 + 2),
      anchor(134, 67 * 60 + 12),
    ];
    const lines: LiveScoreLine[] = [
      {
        dedupeKey: "goal-1",
        text: "23:00 — Goal",
        timestamp: "23:00",
        minute: "23",
        sortKey: 1,
        eventCategory: "goal",
      },
      {
        dedupeKey: "goal-2",
        text: "67:00 — Goal",
        timestamp: "67:00",
        minute: "67",
        sortKey: 2,
        eventCategory: "goal",
      },
    ];

    const aligned = alignLiveScoreLinesToAnchors(sampleMatch, lines, anchors, {
      alignmentMode: "highlight",
    });

    expect(aligned).toHaveLength(2);

    const firstGoal = aligned.find((event) => event.gameElapsed === 23 * 60);
    const secondGoal = aligned.find((event) => event.gameElapsed === 67 * 60);

    expect(firstGoal?.videoAt).toBeCloseTo(40, 0);
    expect(secondGoal?.videoAt).toBeCloseTo(134, 0);
    expect(secondGoal?.videoAt).toBeLessThan(200);
  });

  it("places a marker at the OCR video time when LiveScore minute matches the scoreboard clock", () => {
    const anchors = [anchor(164, 2 * 60 + 3)];
    const lines: LiveScoreLine[] = [
      {
        dedupeKey: "goal-early",
        text: "02:00 — Goal",
        timestamp: "02:00",
        minute: "2",
        sortKey: 1,
        eventCategory: "goal",
      },
    ];

    const aligned = alignLiveScoreLinesToAnchors(sampleMatch, lines, anchors, {
      alignmentMode: "highlight",
    });

    expect(aligned).toHaveLength(1);
    expect(aligned[0]?.videoAt).toBe(164);
  });

  it("maps stoppage-time LiveScore events using timestamp parsing", () => {
    const stoppageElapsed = (45 + 2) * 60;
    const anchors = [
      anchor(198, 45 * 60),
      anchor(200, stoppageElapsed),
      anchor(205, stoppageElapsed + 3),
    ];
    const lines: LiveScoreLine[] = [
      {
        dedupeKey: "goal-stoppage",
        text: "45+02 — Goal",
        timestamp: "45+02",
        minute: "45",
        sortKey: 1,
        eventCategory: "goal",
      },
    ];

    expect(parseLiveScoreElapsed(lines[0]!)).toBe((45 + 2) * 60);

    const aligned = alignLiveScoreLinesToAnchors(sampleMatch, lines, anchors, {
      alignmentMode: "highlight",
    });
    expect(aligned).toHaveLength(1);
    expect(aligned[0]?.videoAt).toBeCloseTo(200, 0);
  });
});
