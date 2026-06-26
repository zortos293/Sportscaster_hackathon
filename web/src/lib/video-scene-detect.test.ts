import { describe, expect, it } from "vitest";
import {
  buildCandidateSampleTimes,
  mergeNearbySceneCuts,
  parseSceneCutTimesFromFfmpegOutput,
} from "@/lib/video-scene-detect";

describe("parseSceneCutTimesFromFfmpegOutput", () => {
  it("parses lavfi.scd.time markers from ffmpeg stderr", () => {
    const output = `
[Parsed_scdet_0 @ 0x123] lavfi.scd.time: 12.400000
[Parsed_scdet_0 @ 0x123] lavfi.scd.time: 45.120000
`;
    expect(parseSceneCutTimesFromFfmpegOutput(output)).toEqual([12.4, 45.1]);
  });
});

describe("mergeNearbySceneCuts", () => {
  it("merges cuts within one second", () => {
    expect(mergeNearbySceneCuts([10, 10.4, 11.2, 20])).toEqual([10, 11.2, 20]);
  });
});

describe("buildCandidateSampleTimes", () => {
  it("adds padding around scene cuts", () => {
    const times = buildCandidateSampleTimes({
      sceneCuts: [60],
      durationSeconds: 120,
    });
    expect(times).toContain(60);
    expect(times).toContain(59);
    expect(times).toContain(61);
  });

  it("falls back to sparse sampling when few scene cuts", () => {
    const times = buildCandidateSampleTimes({
      sceneCuts: [30],
      durationSeconds: 60,
    });
    expect(times.filter((time) => time % 5 === 0).length).toBeGreaterThan(5);
  });
});
