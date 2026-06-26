import { describe, expect, it } from "vitest";
import {
  extractGoalLinesFromShotmap,
  extractSofaScoreEventLines,
  formatSofaScoreClock,
  isSofaScoreGoalShot,
  parseSofaScoreClock,
  resolveSofaScoreEventId,
} from "@/lib/sofascore";

const tunisiaNetherlandsEvent = {
  id: 14179430,
  customId: "fUbsEUb",
  homeTeam: { name: "Tunisia" },
  awayTeam: { name: "Netherlands" },
  homeScore: { current: 1 },
  awayScore: { current: 3 },
};

describe("resolveSofaScoreEventId", () => {
  it("accepts numeric ids and event urls", () => {
    expect(resolveSofaScoreEventId("14179430")).toBe("14179430");
    expect(resolveSofaScoreEventId("https://api.sofascore.com/api/v1/event/14179430")).toBe(
      "14179430",
    );
  });
});

describe("parseSofaScoreClock", () => {
  it("prefers timeSeconds for second-precision timing", () => {
    expect(parseSofaScoreClock({ timeSeconds: 4179 })).toEqual({
      gameElapsed: 4179,
      precision: "second",
    });
    expect(formatSofaScoreClock(4179)).toBe("69:39");
  });

  it("falls back to minute plus added time", () => {
    expect(parseSofaScoreClock({ time: 45, addedTime: 2 })).toEqual({
      gameElapsed: (45 + 2) * 60,
      precision: "minute",
    });
  });
});

describe("extractGoalLinesFromShotmap", () => {
  it("keeps only goal shots and preserves timeSeconds", () => {
    const lines = extractGoalLinesFromShotmap(tunisiaNetherlandsEvent, [
      {
        id: 1,
        isHome: false,
        shotType: "goal",
        timeSeconds: 385,
        player: { name: "Brian Brobbey" },
      },
      {
        id: 2,
        isHome: false,
        shotType: "miss",
        timeSeconds: 390,
        player: { name: "Memphis Depay" },
      },
      {
        id: 3,
        isHome: true,
        shotType: "goal",
        timeSeconds: 3217,
        player: { name: "Hazem Mastouri" },
      },
    ]);

    expect(lines).toHaveLength(2);
    expect(lines[0]?.gameElapsed).toBe(385);
    expect(lines[0]?.gameElapsedPrecision).toBe("second");
    expect(lines[0]?.text).toContain("Brian Brobbey");
    expect(isSofaScoreGoalShot({ shotType: "goal" })).toBe(true);
    expect(isSofaScoreGoalShot({ shotType: "miss" })).toBe(false);
  });
});

describe("extractSofaScoreEventLines", () => {
  it("merges goals from shotmap and cards from incidents", () => {
    const lines = extractSofaScoreEventLines({
      event: tunisiaNetherlandsEvent,
      shots: [
        {
          id: 1,
          isHome: false,
          shotType: "goal",
          timeSeconds: 385,
          player: { name: "Brian Brobbey" },
        },
      ],
      incidents: [
        {
          id: 10,
          isHome: true,
          incidentType: "card",
          incidentClass: "yellow",
          time: 72,
          playerName: "Amine Ben Hamida",
        },
      ],
    });

    expect(lines).toHaveLength(2);
    expect(lines.some((line) => line.eventCategory === "goal")).toBe(true);
    expect(lines.some((line) => line.eventCategory === "card")).toBe(true);
  });
});
