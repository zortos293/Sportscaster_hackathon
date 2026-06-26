import { describe, expect, it } from "vitest";
import {
  alignLiveScoreLinesToAnchors,
  filterNoisyOcrAnchors,
  isCondensedOrHighlightTimeline,
  mapHighlightEventToVideoAt,
  parseClockText,
  parseLiveScoreElapsed,
  refineEventTimingFromOcrAnchors,
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
  it("prefers main broadcast footage over replay inserts for replayed minutes", () => {
    const segments = splitHighlightSegments([
      anchor(145, 7 * 60 + 1),
      anchor(180, 2 * 60),
      anchor(295, 6 * 60 + 25),
      anchor(400, 7 * 60 + 5),
    ]);
    const mapped = mapHighlightEventToVideoAt(7 * 60, segments, {
      minuteOnlyWindow: { min: 6 * 60, max: 7 * 60 },
    });
    expect(mapped?.videoAt).toBeCloseTo(295, 0);
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

describe("refineEventTimingFromOcrAnchors", () => {
  it("snaps minute-only feed events to OCR scoreboard seconds", () => {
    const refined = refineEventTimingFromOcrAnchors(2 * 60, [
      anchor(164, 2 * 60 + 3, 0.9),
    ]);
    expect(refined?.gameElapsed).toBe(123);
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

    const firstGoal = aligned.find((event) => Math.floor(event.gameElapsed / 60) === 23);
    const secondGoal = aligned.find((event) => Math.floor(event.gameElapsed / 60) === 67);

    expect(firstGoal?.gameElapsed).toBe(23 * 60 + 10);
    expect(firstGoal?.videoAt).toBeCloseTo(40, 0);
    expect(secondGoal?.gameElapsed).toBe(67 * 60 + 12);
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
    expect(aligned[0]?.gameElapsed).toBe(123);
    expect(aligned[0]?.videoAt).toBe(164);
  });

  it("refines FotMob minute-only goals to OCR seconds in the video", () => {
    const anchors = [anchor(164, 2 * 60 + 3)];
    const lines: LiveScoreLine[] = [
      {
        dedupeKey: "fotmob-goal",
        text: "2' — Goal",
        timestamp: "2'",
        minute: "2",
        gameElapsedPrecision: "minute",
        sortKey: 1,
        eventCategory: "goal",
      },
    ];

    const aligned = alignLiveScoreLinesToAnchors(sampleMatch, lines, anchors, {
      alignmentMode: "highlight",
    });

    expect(aligned[0]?.gameElapsed).toBe(123);
    expect(aligned[0]?.videoAt).toBe(164);
  });

  it("maps minute-only feed goals to main footage instead of replay inserts", () => {
    const aligned = alignLiveScoreLinesToAnchors(
      sampleMatch,
      [
        {
          dedupeKey: "brobbey-goal",
          text: "07:00 — Goal! B. Brobbey scores",
          timestamp: "7'",
          minute: "7",
          gameElapsedPrecision: "minute",
          sortKey: 1,
          eventCategory: "goal",
        },
      ],
      [
        anchor(145, 7 * 60 + 1),
        anchor(180, 2 * 60),
        anchor(295, 6 * 60 + 25),
        anchor(400, 7 * 60 + 5),
      ],
      { alignmentMode: "highlight" },
    );

    expect(aligned).toHaveLength(1);
    expect(aligned[0]?.videoAt).toBeCloseTo(295, 0);
    expect(aligned[0]?.videoAt).toBeGreaterThan(200);
  });

  it("maps second-precision SofaScore goals directly without minute-only OCR window", () => {
    const aligned = alignLiveScoreLinesToAnchors(
      sampleMatch,
      [
        {
          dedupeKey: "sofascore-goal",
          text: "06:25 — Goal! Brian Brobbey scores",
          timestamp: "06:25",
          minute: "6",
          gameElapsed: 385,
          gameElapsedPrecision: "second",
          sortKey: 385,
          eventCategory: "goal",
        },
      ],
      [
        anchor(145, 7 * 60 + 1),
        anchor(180, 2 * 60),
        anchor(295, 6 * 60 + 25),
        anchor(400, 7 * 60 + 5),
      ],
      { alignmentMode: "highlight" },
    );

    expect(aligned).toHaveLength(1);
    expect(aligned[0]?.gameElapsed).toBe(385);
    expect(aligned[0]?.videoAt).toBeCloseTo(295, 0);
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
