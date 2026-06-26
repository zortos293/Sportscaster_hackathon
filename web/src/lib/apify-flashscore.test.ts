import { describe, expect, it } from "vitest";
import {
  extractFlashscoreEventLines,
  flashscoreSummaryToLiveMatch,
  parseFlashscoreEventMinute,
  resolveFlashscoreMatchId,
} from "@/lib/apify-flashscore";
import { parseLiveScoreElapsed } from "@/lib/full-match-align";

const tunisiaNetherlandsItems = [
  {
    recordType: "match_basic",
    matchId: "Kx4mP2nQ",
    sourceUrl: "https://www.flashscore.com/match/football/tunisia-netherlands/Kx4mP2nQ/",
    homeTeamName: "Tunisia",
    awayTeamName: "Netherlands",
    homeScore: 0,
    awayScore: 4,
    status: "Finished",
    statusCategory: "finished",
    competitionName: "World Cup",
  },
  {
    recordType: "match_events",
    matchId: "Kx4mP2nQ",
    eventId: "evt1",
    minute: "2'",
    type: "goal",
    typeLabel: "Goal",
    side: "away",
    playerName: "Cody Gakpo",
    homeScoreAfter: 0,
    awayScoreAfter: 1,
  },
  {
    recordType: "match_events",
    matchId: "Kx4mP2nQ",
    eventId: "evt2",
    minute: "7'",
    type: "goal",
    typeLabel: "Goal",
    side: "away",
    playerName: "Brian Brobbey",
    homeScoreAfter: 0,
    awayScoreAfter: 2,
  },
  {
    recordType: "match_events",
    matchId: "Kx4mP2nQ",
    eventId: "evt3",
    minute: "60'",
    type: "sub_in",
    typeLabel: "Substitution",
    side: "home",
    playerName: "Player A",
  },
  {
    recordType: "match_events",
    matchId: "Kx4mP2nQ",
    eventId: "evt4",
    minute: "70'",
    type: "yellow_card",
    typeLabel: "Yellow card",
    side: "home",
    playerName: "Player B",
  },
];

describe("resolveFlashscoreMatchId", () => {
  it("accepts alphanumeric ids and flashscore urls", () => {
    expect(resolveFlashscoreMatchId("Kx4mP2nQ")).toBe("Kx4mP2nQ");
    expect(
      resolveFlashscoreMatchId(
        "https://www.flashscore.com/match/football/tunisia-netherlands/Kx4mP2nQ/",
      ),
    ).toBe("Kx4mP2nQ");
  });
});

describe("parseFlashscoreEventMinute", () => {
  it("parses minute strings and stoppage time", () => {
    expect(parseFlashscoreEventMinute({ minute: "7'" })).toBe(420);
    expect(parseFlashscoreEventMinute({ minute: "90+3'" })).toBe(5580);
    expect(parseFlashscoreEventMinute({ minuteBase: 45, minuteAdded: 2 })).toBe(47 * 60);
  });
});

describe("extractFlashscoreEventLines", () => {
  it("marks Flashscore events as minute-only so OCR can refine to seconds", () => {
    const lines = extractFlashscoreEventLines(tunisiaNetherlandsItems, "Kx4mP2nQ");

    expect(lines).toHaveLength(3);
    expect(lines[0]?.gameElapsedPrecision).toBe("minute");
    expect(lines[0]?.eventCategory).toBe("goal");
    expect(parseLiveScoreElapsed(lines[1]!)).toBe(7 * 60);
  });

  it("extracts nested events from match-full records", () => {
    const lines = extractFlashscoreEventLines(
      [
        {
          recordType: "match-full",
          matchId: "Ab12Cd34",
          homeTeamName: "Home",
          awayTeamName: "Away",
          events: [
            {
              minute: "16'",
              type: "goal",
              type_label: "Goal",
              player_name: "Striker",
              side: "home",
              home_score_after: 1,
              away_score_after: 0,
            },
          ],
        },
      ],
      "Ab12Cd34",
    );

    expect(lines).toHaveLength(1);
    expect(lines[0]?.text).toContain("Striker");
    expect(parseLiveScoreElapsed(lines[0]!)).toBe(16 * 60);
  });
});

describe("flashscoreSummaryToLiveMatch", () => {
  it("maps match_basic records to LiveMatch", () => {
    const match = flashscoreSummaryToLiveMatch(tunisiaNetherlandsItems[0]!, "Kx4mP2nQ");
    expect(match.homeTeamName).toBe("Tunisia");
    expect(match.awayTeamName).toBe("Netherlands");
    expect(match.status).toBe("finished");
  });
});
