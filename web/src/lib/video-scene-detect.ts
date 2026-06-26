const DEFAULT_SCENE_THRESHOLD = 15;
const MAX_SCENE_CUTS = 200;
const MIN_CUT_GAP_SECONDS = 1;
const MIN_SCENE_CUTS_FOR_FALLBACK = 8;
const FALLBACK_SAMPLE_EVERY_SECONDS = 5;
const CUT_PADDING_SECONDS = 1;
const MAX_CANDIDATE_TIMES = 300;

export function parseSceneCutTimesFromFfmpegOutput(output: string): number[] {
  const times: number[] = [];
  const patterns = [
    /lavfi\.scd\.time[=:\s]+([0-9.]+)/gi,
    /scene time:\s*([0-9.]+)/gi,
  ];

  for (const pattern of patterns) {
    for (const match of output.matchAll(pattern)) {
      const value = Number.parseFloat(match[1] ?? "");
      if (Number.isFinite(value) && value >= 0) {
        times.push(value);
      }
    }
  }

  return mergeNearbySceneCuts(
    [...new Set(times.map((time) => Math.round(time * 10) / 10))].sort((a, b) => a - b),
  );
}

export function mergeNearbySceneCuts(
  times: number[],
  minGapSeconds = MIN_CUT_GAP_SECONDS,
): number[] {
  if (times.length === 0) return [];

  const merged: number[] = [times[0]!];
  for (let index = 1; index < times.length; index += 1) {
    const current = times[index]!;
    const previous = merged[merged.length - 1]!;
    if (current - previous >= minGapSeconds) {
      merged.push(current);
    }
  }
  return merged.slice(0, MAX_SCENE_CUTS);
}

export function buildCandidateSampleTimes(options: {
  sceneCuts: number[];
  durationSeconds: number;
  minCutsForFallback?: number;
  fallbackEverySeconds?: number;
  cutPaddingSeconds?: number;
  maxCandidates?: number;
}): number[] {
  const {
    sceneCuts,
    durationSeconds,
    minCutsForFallback = MIN_SCENE_CUTS_FOR_FALLBACK,
    fallbackEverySeconds = FALLBACK_SAMPLE_EVERY_SECONDS,
    cutPaddingSeconds = CUT_PADDING_SECONDS,
    maxCandidates = MAX_CANDIDATE_TIMES,
  } = options;

  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return [0];
  }

  const times = new Set<number>();
  times.add(0);
  times.add(Math.max(0, Math.round((durationSeconds - 0.5) * 10) / 10));

  for (const cut of sceneCuts) {
    const roundedCut = Math.max(0, Math.round(cut * 10) / 10);
    times.add(roundedCut);
    for (
      let offset = -cutPaddingSeconds;
      offset <= cutPaddingSeconds;
      offset += 0.5
    ) {
      const sampleAt = Math.round((roundedCut + offset) * 10) / 10;
      if (sampleAt >= 0 && sampleAt < durationSeconds) {
        times.add(sampleAt);
      }
    }
  }

  if (sceneCuts.length < minCutsForFallback) {
    for (let sampleAt = 0; sampleAt < durationSeconds; sampleAt += fallbackEverySeconds) {
      times.add(Math.round(sampleAt * 10) / 10);
    }
  }

  return [...times]
    .filter((time) => time >= 0 && time < durationSeconds)
    .sort((a, b) => a - b)
    .slice(0, maxCandidates);
}

export async function detectSceneCutTimes(
  videoPath: string,
  durationSeconds: number,
  runFfmpeg: (args: string[]) => Promise<{ stdout: string; stderr: string }>,
): Promise<number[]> {
  try {
    const { stderr, stdout } = await runFfmpeg([
      "-hide_banner",
      "-i",
      videoPath,
      "-vf",
      `scdet=threshold=${DEFAULT_SCENE_THRESHOLD},metadata=print`,
      "-an",
      "-f",
      "null",
      "-",
    ]);
    const cuts = parseSceneCutTimesFromFfmpegOutput(`${stdout}\n${stderr}`);
    if (cuts.length > 0) return cuts;
  } catch (error) {
    const stderr =
      typeof error === "object" &&
      error != null &&
      "stderr" in error &&
      Buffer.isBuffer((error as { stderr?: Buffer }).stderr)
        ? (error as { stderr: Buffer }).stderr.toString()
        : "";
    const cuts = parseSceneCutTimesFromFfmpegOutput(stderr);
    if (cuts.length > 0) return cuts;
  }

  return buildCandidateSampleTimes({
    sceneCuts: [],
    durationSeconds,
    minCutsForFallback: 0,
    fallbackEverySeconds: FALLBACK_SAMPLE_EVERY_SECONDS,
  });
}

export function estimateSampleIntervalSeconds(sampleTimes: number[]): number {
  if (sampleTimes.length < 2) return 2;
  const gaps = sampleTimes
    .slice(1)
    .map((time, index) => time - sampleTimes[index]!)
    .filter((gap) => gap > 0);
  if (gaps.length === 0) return 2;
  gaps.sort((a, b) => a - b);
  return Math.max(0.5, gaps[Math.floor(gaps.length / 2)] ?? 2);
}
