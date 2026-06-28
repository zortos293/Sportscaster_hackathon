import { describe, expect, it } from "vitest";
import { usesNativeVideoAudio, type BroadcastGame } from "@/lib/broadcast-game";
import { getDemoGame } from "@/lib/demo-games";

const baseGame: BroadcastGame = {
  id: "demo",
  title: "Demo",
  subtitle: "Demo",
  sport: "soccer",
  league: "demo",
  eventId: "demo",
  videoFile: "demo.mp4",
  persona: "Commentator",
  finalScore: "Demo",
  videoMode: "highlights",
};

describe("usesNativeVideoAudio", () => {
  it("uses source audio for regular highlight reels by default", () => {
    expect(usesNativeVideoAudio(baseGame)).toBe(true);
  });

  it("lets games opt into AI voiceover", () => {
    expect(usesNativeVideoAudio({ ...baseGame, audioMode: "ai" })).toBe(false);
  });

  it("lets static demos opt into their embedded source audio", () => {
    expect(
      usesNativeVideoAudio({
        ...baseGame,
        audioMode: "native",
        timelineSource: "static",
      }),
    ).toBe(true);
  });

  it("keeps the affected demos on their intended audio modes", () => {
    expect(usesNativeVideoAudio(getDemoGame("hobby-horsing-germany")!)).toBe(true);
    expect(usesNativeVideoAudio(getDemoGame("georgia-ole-miss")!)).toBe(false);
  });
});
