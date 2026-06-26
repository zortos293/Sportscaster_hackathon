import { describe, expect, it } from "vitest";
import {
  extractFotMobEventLines,
  parseFotMobEventMinute,
  resolveFotMobMatchId,
} from "@/lib/apify-fotmob";
import { parseLiveScoreElapsed } from "@/lib/full-match-align";

describe("parseFotMobEventMinute", () => {
  it("uses the exact integer minute from FotMob events", () => {
    expect(parseFotMobEventMinute({ minute: 2, minuteLabel: 2 })).toBe(120);
    expect(parseFotMobEventMinute({ minute: 23, minuteLabel: 23 })).toBe(23 * 60);
  });

  it("parses stoppage labels like 45+2", () => {
    expect(parseFotMobEventMinute({ minute: 45, minuteLabel: "45+2" })).toBe((45 + 2) * 60);
  });
});

describe("resolveFotMobMatchId", () => {
  it("accepts numeric ids and fotmob urls", () => {
    expect(resolveFotMobMatchId("4506324")).toBe("4506324");
    expect(resolveFotMobMatchId("https://www.fotmob.com/match/4506324")).toBe("4506324");
  });
});

describe("extractFotMobEventLines", () => {
  it("marks FotMob events as minute-only so OCR can refine to seconds", () => {
    const lines = extractFotMobEventLines({
      matchId: 4506324,
      homeTeam: { name: "Tunisia", score: 0 },
      awayTeam: { name: "Netherlands", score: 1 },
      events: [
        {
          type: "Goal",
          minute: 2,
          minuteLabel: 2,
          isHome: false,
          playerName: "Cody Gakpo",
          homeScore: 0,
          awayScore: 1,
        },
      ],
    });

    expect(lines).toHaveLength(1);
    expect(lines[0]?.gameElapsedPrecision).toBe("minute");
    expect(lines[0]?.gameElapsed).toBeUndefined();
    expect(parseLiveScoreElapsed(lines[0]!)).toBe(120);
  });

  it("drops substitutions and keeps goals and cards", () => {
    const lines = extractFotMobEventLines({
      matchId: 4506324,
      homeTeam: { name: "Tunisia", score: 0 },
      awayTeam: { name: "Netherlands", score: 1 },
      events: [
        {
          type: "Goal",
          minute: 2,
          minuteLabel: 2,
          isHome: false,
          playerName: "Cody Gakpo",
          homeScore: 0,
          awayScore: 1,
        },
        {
          type: "Substitution",
          minute: 60,
          minuteLabel: 60,
          isHome: true,
          playerName: "Player A",
        },
        {
          type: "Card",
          minute: 70,
          minuteLabel: 70,
          isHome: true,
          playerName: "Player B",
          card: "Yellow",
        },
      ],
    });

    expect(lines).toHaveLength(2);
    expect(lines[0]?.eventCategory).toBe("goal");
    expect(lines[1]?.eventCategory).toBe("card");
  });
});
