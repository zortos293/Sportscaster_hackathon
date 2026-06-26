import { describe, expect, it } from "vitest";
import {
  filterMajorTimelineEvents,
  filterMajorTimelineLines,
  isMajorTimelineEvent,
  isMajorTimelineLine,
} from "@/lib/match-event-filter";
import type { LiveScoreLine } from "@/lib/livescore";
import type { TimelineEvent } from "@/lib/timeline";

function line(partial: Partial<LiveScoreLine> & Pick<LiveScoreLine, "text">): LiveScoreLine {
  return {
    dedupeKey: partial.dedupeKey ?? partial.text,
    timestamp: partial.timestamp ?? "10:00",
    sortKey: partial.sortKey ?? 0,
    ...partial,
  };
}

describe("isMajorTimelineLine", () => {
  it("keeps goals and cards", () => {
    expect(isMajorTimelineLine(line({ text: "Goal!", eventCategory: "goal" }))).toBe(true);
    expect(isMajorTimelineLine(line({ text: "Yellow card", eventCategory: "card" }))).toBe(true);
  });

  it("drops substitutions and generic commentary", () => {
    expect(isMajorTimelineLine(line({ text: "Substitution", eventCategory: "substitution" }))).toBe(
      false,
    );
    expect(isMajorTimelineLine(line({ text: "Nice build-up play", eventCategory: "other" }))).toBe(
      false,
    );
  });
});

describe("filterMajorTimelineLines", () => {
  it("returns only major incidents", () => {
    const filtered = filterMajorTimelineLines([
      line({ text: "Goal!", eventCategory: "goal", sortKey: 1 }),
      line({ text: "Sub off", eventCategory: "substitution", sortKey: 2 }),
      line({ text: "Yellow card", eventCategory: "card", sortKey: 3 }),
    ]);
    expect(filtered).toHaveLength(2);
  });
});

describe("filterMajorTimelineEvents", () => {
  it("keeps goals and cards on the player timeline", () => {
    const events: TimelineEvent[] = [
      {
        id: "g1",
        videoAt: 10,
        gameElapsed: 600,
        scoreHome: 1,
        scoreAway: 0,
        description: "Goal!",
        periodLabel: "1st Half",
        kind: "score",
      },
      {
        id: "s1",
        videoAt: 20,
        gameElapsed: 700,
        scoreHome: 1,
        scoreAway: 0,
        description: "Substitution — Player",
        periodLabel: "1st Half",
        kind: "key_play",
      },
      {
        id: "c1",
        videoAt: 30,
        gameElapsed: 800,
        scoreHome: 1,
        scoreAway: 0,
        description: "Yellow card for Player",
        periodLabel: "1st Half",
        kind: "key_play",
      },
    ];

    expect(filterMajorTimelineEvents(events)).toHaveLength(2);
    expect(isMajorTimelineEvent(events[1]!)).toBe(false);
  });
});
