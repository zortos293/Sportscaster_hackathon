import {
  alignLiveScoreLinesToAnchors,
  filterNoisyOcrAnchors,
  getAlignmentStats,
  parseClockText,
  preserveHighlightOcrAnchors,
  splitHighlightSegments,
} from "@/lib/full-match-align";
import type {
  FullMatchAlignmentMode,
  FullMatchOcrAnchor,
} from "@/lib/full-match-align";
import {
  fetchLiveScoreCommentary,
  fetchLiveScoreEvents,
  fetchLiveScoreMatchesWithCommentary,
  matchSubtitle,
  matchTitle,
  type LiveMatch,
  type LiveScoreLine,
} from "@/lib/livescore";
import type { TimelineEvent } from "@/lib/timeline";
import {
  buildCandidateSampleTimes,
  detectSceneCutTimes,
  estimateSampleIntervalSeconds,
} from "@/lib/video-scene-detect";
import { ConvexHttpClient } from "convex/browser";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, unlink } from "node:fs/promises";
import { availableParallelism, tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { api } from "../../convex/_generated/api";

const execFileAsync = promisify(execFile);

type ConvexFullMatchImport = {
  gameId: string;
  title: string;
  subtitle: string;
  sourceUrl: string;
  videoFile?: string;
  liveScoreMatchId: string;
  status: string;
  statusMessage?: string;
  durationSeconds?: number;
  confidence?: number;
  createdAt: number;
  updatedAt: number;
};

export type FullMatchImportRequest = {
  sourceUrl: string;
  liveScoreMatchId: string;
  title?: string;
  subtitle?: string;
  gameId?: string;
  sampleEverySeconds?: number;
  maxSamples?: number;
  alignmentMode?: FullMatchAlignmentMode;
};

export type FullMatchImportResult = {
  gameId: string;
  title: string;
  subtitle: string;
  status: string;
  statusMessage?: string;
  videoFile?: string;
  durationSeconds?: number;
  anchorCount?: number;
  segmentCount?: number;
  alignmentMode?: FullMatchAlignmentMode;
  eventCount?: number;
  confidence?: number;
};

const DEFAULT_FIFA_CLOCK_ROI_ID = "clock-pill-fifa";

const CLOCK_CROP_FILTERS = {
  default: "scale=iw*4:ih*4,format=gray,eq=contrast=2:brightness=0.04,unsharp=5:5:1.0",
  pill: "scale=iw*5:ih*5,format=gray,eq=contrast=2.8:brightness=0.1:gamma=0.85,unsharp=5:5:1.2",
} as const;

type ClockCropFilterProfile = keyof typeof CLOCK_CROP_FILTERS;

type VideoProbe = {
  durationSeconds: number;
  width: number;
  height: number;
};

type Roi = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  filter?: ClockCropFilterProfile;
};

type SavedClockRoiConfig = {
  gameId?: string;
  roiId?: string;
  normalized?: { x: number; y: number; width: number; height: number };
  pixels?: { x: number; y: number; width: number; height: number };
  filter?: ClockCropFilterProfile;
};

type OcrProgress = {
  phase: "scene_detect" | "extracting" | "ocr";
  processed: number;
  total: number;
  anchors: number;
};

const CHANGE_ONLY_VIDEO_WINDOW_SECONDS = 5;

const DEFAULT_SAMPLE_SECONDS = 2;
const SHORT_VIDEO_SAMPLE_SECONDS = 1;
const SHORT_VIDEO_MAX_DURATION_SECONDS = 20 * 60;
const DEFAULT_MAX_SAMPLES = 1200;
const DEFAULT_OCR_CONCURRENCY = 4;

function adaptiveSampleEverySeconds(
  durationSeconds: number,
  requested?: number,
): number {
  if (requested && requested > 0) return requested;
  return durationSeconds <= SHORT_VIDEO_MAX_DURATION_SECONDS
    ? SHORT_VIDEO_SAMPLE_SECONDS
    : DEFAULT_SAMPLE_SECONDS;
}

function roiSampleTimes(durationSeconds: number): number[] {
  const earlySamples = [0, 1, 2, 3, 5, 8, 10, 15, 20, 30, 45, 60, 90, 120];
  const start = 5;
  const end = Math.max(start + 1, durationSeconds - 5);
  const count = Math.min(8, Math.max(4, Math.ceil(durationSeconds / 120)));
  const spread =
    end <= start
      ? [Math.max(0, Math.min(start, durationSeconds / 2))]
      : Array.from({ length: count }, (_, index) =>
          Math.round(start + ((end - start) / Math.max(count - 1, 1)) * index),
        );

  return [...new Set([...earlySamples, ...spread])]
    .filter((time) => time >= 0 && time < durationSeconds - 0.5)
    .sort((a, b) => a - b);
}

const TOOL_ENV: Record<string, string> = {
  "yt-dlp": "YTDLP_PATH",
  ffmpeg: "FFMPEG_PATH",
  ffprobe: "FFPROBE_PATH",
  tesseract: "TESSERACT_PATH",
};

const COMMON_TOOL_DIRS = [
  "/opt/homebrew/bin",
  "/usr/local/bin",
  "/usr/bin",
  "/bin",
];

function toolVersionArgs(command: string): string[] {
  return command === "ffmpeg" || command === "ffprobe" ? ["-version"] : ["--version"];
}

function getConvexClient(): ConvexHttpClient {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL?.trim();
  if (!url || !/^https?:\/\//.test(url)) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is required for full-match alignment.");
  }
  return new ConvexHttpClient(url);
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "match";
}

function fullMatchGameId(liveScoreMatchId: string): string {
  return `fm-${liveScoreMatchId}`;
}

async function resolveTool(command: string): Promise<string> {
  const envPath = process.env[TOOL_ENV[command] ?? ""];
  if (envPath?.trim()) return envPath.trim();

  const pathEntries = [
    ...(process.env.PATH?.split(":") ?? []),
    ...COMMON_TOOL_DIRS,
  ].filter(Boolean);

  for (const dir of [...new Set(pathEntries)]) {
    const candidate = path.join(dir, command);
    try {
      await execFileAsync(candidate, toolVersionArgs(command), {
        timeout: 10_000,
        maxBuffer: 1024 * 1024,
      });
      return candidate;
    } catch {
      // Try the next common location.
    }
  }

  return command;
}

async function runTool(
  command: string,
  args: string[],
  options?: { cwd?: string; timeoutMs?: number; env?: Record<string, string> },
): Promise<string> {
  const captured = await runToolCapture(command, args, options);
  return captured.stdout;
}

async function runToolCapture(
  command: string,
  args: string[],
  options?: { cwd?: string; timeoutMs?: number; env?: Record<string, string> },
): Promise<{ stdout: string; stderr: string }> {
  const executable = await resolveTool(command);
  try {
    const { stdout, stderr } = await execFileAsync(executable, args, {
      cwd: options?.cwd,
      env: options?.env ? { ...process.env, ...options.env } : process.env,
      timeout: options?.timeoutMs ?? 120_000,
      maxBuffer: 1024 * 1024 * 16,
    });
    return { stdout, stderr };
  } catch (error) {
    const execError = error as { stdout?: string | Buffer; stderr?: string | Buffer; message?: string };
    const stdout =
      typeof execError.stdout === "string"
        ? execError.stdout
        : Buffer.isBuffer(execError.stdout)
          ? execError.stdout.toString()
          : "";
    const stderr =
      typeof execError.stderr === "string"
        ? execError.stderr
        : Buffer.isBuffer(execError.stderr)
          ? execError.stderr.toString()
          : "";
    if (stdout || stderr) {
      return { stdout, stderr };
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to run ${executable}: ${message}`);
  }
}

async function hashCropFile(cropPath: string): Promise<string> {
  const bytes = await readFile(cropPath);
  return createHash("sha1").update(bytes).digest("hex");
}

function ocrConcurrency(): number {
  const configured = Number.parseInt(process.env.FULL_MATCH_OCR_CONCURRENCY ?? "", 10);
  if (Number.isFinite(configured) && configured > 0) {
    return Math.min(12, configured);
  }
  return Math.max(2, Math.min(6, Math.floor(availableParallelism() / 2) || DEFAULT_OCR_CONCURRENCY));
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index]!, index);
    }
  });
  await Promise.all(workers);
  return results;
}

async function assertLocalTools(): Promise<void> {
  const tools = ["yt-dlp", "ffmpeg", "ffprobe", "tesseract"];
  const failures: string[] = [];
  for (const tool of tools) {
    try {
      await runTool(tool, toolVersionArgs(tool), { timeoutMs: 10_000 });
    } catch {
      failures.push(tool);
    }
  }
  if (failures.length > 0) {
    throw new Error(
      `Missing local tool(s): ${failures.join(", ")}. Install them before importing full matches.`,
    );
  }
}

async function findLiveScoreMatch(matchId: string): Promise<LiveMatch> {
  const matches = await fetchLiveScoreMatchesWithCommentary().catch(() => []);
  const found = matches.find((match) => match.matchId === matchId);
  if (found) return found;

  return {
    matchId,
    homeTeamName: "Home",
    awayTeamName: "Away",
    status: "Full match",
    competitionName: "LiveScore",
  };
}

async function fetchRawLines(match: LiveMatch): Promise<LiveScoreLine[]> {
  const commentary = await fetchLiveScoreCommentary(match.sourceUrl, match.matchId).catch(
    () => undefined,
  );
  if (commentary && commentary.lines.length > 0) return commentary.lines;

  const events = await fetchLiveScoreEvents(match.sourceUrl, match.matchId);
  if (events.lines.length > 0) return events.lines;

  throw new Error("LiveScore returned no commentary or incident lines for this match.");
}

async function upsertImport(
  payload: Omit<FullMatchImportResult, "anchorCount" | "eventCount"> & {
    sourceUrl: string;
    liveScoreMatchId: string;
  },
): Promise<void> {
  const client = getConvexClient();
  await client.mutation(api.matches.upsertFullMatchImport, {
    gameId: payload.gameId,
    title: payload.title,
    subtitle: payload.subtitle,
    sourceUrl: payload.sourceUrl,
    liveScoreMatchId: payload.liveScoreMatchId,
    status: payload.status,
    statusMessage: payload.statusMessage,
    videoFile: payload.videoFile,
    durationSeconds: payload.durationSeconds,
    confidence: payload.confidence,
  });
}

async function downloadVideo(options: {
  sourceUrl: string;
  gameId: string;
  title: string;
}): Promise<{ videoFile: string; absolutePath: string }> {
  const samplesDir = path.join(process.cwd(), ".full-matches");
  await mkdir(samplesDir, { recursive: true });

  const filename = `${options.gameId}-${slugify(options.title)}.mp4`;
  const absolutePath = path.join(samplesDir, filename);

  await runTool(
    "yt-dlp",
    [
      "-f",
      "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/best",
      "--merge-output-format",
      "mp4",
      "-o",
      absolutePath,
      options.sourceUrl,
    ],
    { timeoutMs: 30 * 60_000 },
  );

  return {
    videoFile: `full-matches/${filename}`,
    absolutePath,
  };
}

async function probeVideo(absolutePath: string): Promise<VideoProbe> {
  const output = await runTool("ffprobe", [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=width,height:format=duration",
    "-of",
    "json",
    absolutePath,
  ]);
  const parsed = JSON.parse(output) as {
    streams?: Array<{ width?: number; height?: number }>;
    format?: { duration?: string };
  };
  const stream = parsed.streams?.[0];
  const durationSeconds = Number.parseFloat(parsed.format?.duration ?? "0");
  if (!stream?.width || !stream.height || !Number.isFinite(durationSeconds)) {
    throw new Error("ffprobe could not read video width, height, or duration.");
  }
  return { width: stream.width, height: stream.height, durationSeconds };
}

function candidateRois(probe: VideoProbe): Roi[] {
  const { width, height } = probe;
  const boxes = [
    {
      id: DEFAULT_FIFA_CLOCK_ROI_ID,
      x: 0.0078125,
      y: 0.0296296,
      width: 0.1,
      height: 0.0777778,
      minWidth: 100,
      minHeight: 40,
      filter: "pill" as const,
    },
    {
      id: "clock-pill-wide",
      x: 0.012,
      y: 0.05,
      width: 0.095,
      height: 0.075,
      minWidth: 90,
      minHeight: 36,
      filter: "pill" as const,
    },
    {
      id: "top-left-clock-tight",
      x: 0.04,
      y: 0.09,
      width: 0.15,
      height: 0.11,
      minWidth: 120,
      minHeight: 40,
      filter: "default" as const,
    },
    {
      id: "top-left-clock-lower",
      x: 0.04,
      y: 0.12,
      width: 0.16,
      height: 0.12,
      minWidth: 120,
      minHeight: 40,
      filter: "default" as const,
    },
    {
      id: "top-left-clock-wide",
      x: 0.035,
      y: 0.075,
      width: 0.2,
      height: 0.14,
      minWidth: 120,
      minHeight: 40,
      filter: "default" as const,
    },
    {
      id: "top-left-wide",
      x: 0.02,
      y: 0.02,
      width: 0.32,
      height: 0.12,
      minWidth: 120,
      minHeight: 40,
      filter: "default" as const,
    },
    {
      id: "top-left-wide-lower",
      x: 0.02,
      y: 0.08,
      width: 0.34,
      height: 0.16,
      minWidth: 120,
      minHeight: 40,
      filter: "default" as const,
    },
    {
      id: "top-center-wide",
      x: 0.34,
      y: 0.02,
      width: 0.32,
      height: 0.12,
      minWidth: 120,
      minHeight: 40,
      filter: "default" as const,
    },
    {
      id: "top-right-wide",
      x: 0.66,
      y: 0.02,
      width: 0.32,
      height: 0.12,
      minWidth: 120,
      minHeight: 40,
      filter: "default" as const,
    },
  ];

  return boxes.map((box) => ({
    id: box.id,
    x: Math.max(0, Math.round(box.x * width)),
    y: Math.max(0, Math.round(box.y * height)),
    width: Math.max(box.minWidth, Math.round(box.width * width)),
    height: Math.max(box.minHeight, Math.round(box.height * height)),
    filter: box.filter,
  }));
}

function looksLikeClockReading(rawText: string): boolean {
  if (parseClockText(rawText)) return true;
  const normalized = rawText.replace(/[^\d:+.'’\s]/g, " ").replace(/\s+/g, " ").trim();
  return (
    /\b\d{1,2}\s*[:.+’'\\-]\s*\d{2}\b/.test(normalized) ||
    /\b\d{1,2}\s*\+\s*\d{1,2}\b/.test(normalized) ||
    /\b\d{3,4}\b/.test(normalized)
  );
}

async function extractCrop(options: {
  videoPath: string;
  outputPath: string;
  videoAt: number;
  roi: Roi;
  filterProfile?: ClockCropFilterProfile;
}): Promise<void> {
  const { roi } = options;
  const filterProfile = options.filterProfile ?? roi.filter ?? "default";
  const filterChain = CLOCK_CROP_FILTERS[filterProfile];
  await runTool("ffmpeg", [
    "-y",
    "-ss",
    String(Math.max(0, options.videoAt)),
    "-i",
    options.videoPath,
    "-frames:v",
    "1",
    "-vf",
    `crop=${roi.width}:${roi.height}:${roi.x}:${roi.y},${filterChain}`,
    options.outputPath,
  ]);
}

async function runTesseractPsm(imagePath: string, psm: string): Promise<string> {
  return runTool(
    "tesseract",
    [
      imagePath,
      "stdout",
      "--psm",
      psm,
      "-l",
      "eng",
      "-c",
      "tessedit_char_whitelist=0123456789:+.'’",
    ],
    { timeoutMs: 30_000, env: { OMP_THREAD_LIMIT: "1" } },
  ).catch(() => "");
}

async function ocrImage(imagePath: string): Promise<string> {
  for (const psm of ["7", "8", "13"] as const) {
    const text = (await runTesseractPsm(imagePath, psm)).trim();
    if (text && (parseClockText(text) || psm === "13")) {
      return text;
    }
  }
  return "";
}

async function ocrImageForRoiDetection(imagePath: string): Promise<{
  text: string;
  parsed: ReturnType<typeof parseClockText>;
}> {
  let bestText = "";
  let bestParsed: ReturnType<typeof parseClockText> = null;

  for (const psm of ["7", "8", "13", "6"] as const) {
    const text = (await runTesseractPsm(imagePath, psm)).trim();
    if (!text) continue;
    const parsed = parseClockText(text);
    if (parsed) {
      return { text, parsed };
    }
    if (looksLikeClockReading(text)) {
      bestText = text;
      bestParsed = parsed;
    }
  }

  return { text: bestText, parsed: bestParsed };
}

function savedClockRoiPaths(options: {
  gameId?: string;
  videoPath?: string;
}): string[] {
  const dir = path.join(process.cwd(), ".full-matches");
  const paths: string[] = [];
  if (options.gameId) {
    paths.push(path.join(dir, `${options.gameId}.roi.json`));
  }
  if (options.videoPath) {
    const base = path.basename(options.videoPath, path.extname(options.videoPath));
    paths.push(path.join(dir, `${base}.roi.json`));
  }
  return paths;
}

async function loadSavedClockRoi(options: {
  probe: VideoProbe;
  gameId?: string;
  videoPath?: string;
}): Promise<Roi | null> {
  for (const configPath of savedClockRoiPaths(options)) {
    try {
      const raw = await readFile(configPath, "utf8");
      const config = JSON.parse(raw) as SavedClockRoiConfig;
      if (config.pixels) {
        return {
          id: config.roiId ?? "saved-roi",
          x: config.pixels.x,
          y: config.pixels.y,
          width: config.pixels.width,
          height: config.pixels.height,
          filter: config.filter ?? "pill",
        };
      }
      if (config.normalized) {
        const { width, height } = options.probe;
        return {
          id: config.roiId ?? "saved-roi",
          x: Math.round(config.normalized.x * width),
          y: Math.round(config.normalized.y * height),
          width: Math.max(100, Math.round(config.normalized.width * width)),
          height: Math.max(40, Math.round(config.normalized.height * height)),
          filter: config.filter ?? "pill",
        };
      }
    } catch {
      // try next candidate path
    }
  }
  return null;
}

async function resolveClockRoi(options: {
  videoPath: string;
  probe: VideoProbe;
  workDir: string;
  gameId?: string;
}): Promise<Roi> {
  const saved = await loadSavedClockRoi({
    probe: options.probe,
    gameId: options.gameId,
    videoPath: options.videoPath,
  });
  if (saved) return saved;
  return detectClockRoi(options);
}

async function detectClockRoi(options: {
  videoPath: string;
  probe: VideoProbe;
  workDir: string;
}): Promise<Roi> {
  const rois = candidateRois(options.probe);
  const sampleTimes = roiSampleTimes(options.probe.durationSeconds);
  const scored = await Promise.all(
    rois.map(async (roi) => {
      let hits = 0;
      let confidence = 0;
      for (const time of sampleTimes) {
        const cropPath = path.join(options.workDir, `${roi.id}-${time}.png`);
        await extractCrop({
          videoPath: options.videoPath,
          outputPath: cropPath,
          videoAt: time,
          roi,
          filterProfile: roi.filter,
        });
        const { text, parsed } = await ocrImageForRoiDetection(cropPath).catch(() => ({
          text: "",
          parsed: null,
        }));
        if (parsed) {
          hits += 1;
          confidence += parsed.confidence;
        } else if (looksLikeClockReading(text)) {
          hits += 0.5;
          confidence += 0.45;
        }
      }
      return { roi, hits, confidence };
    }),
  );

  const best = scored.sort(
    (a, b) => b.hits - a.hits || b.confidence - a.confidence,
  )[0];

  if (!best || best.hits === 0) {
    const fallback = rois.find((roi) => roi.id === DEFAULT_FIFA_CLOCK_ROI_ID) ?? rois[0];
    if (!fallback) {
      throw new Error("Could not auto-detect a scoreboard clock ROI with OCR.");
    }
    return fallback;
  }

  return best.roi;
}

async function extractClockCropsAtTimes(options: {
  videoPath: string;
  roi: Roi;
  workDir: string;
  sampleTimes: number[];
}): Promise<Array<{ index: number; videoAt: number; cropPath: string }>> {
  const crops = await mapWithConcurrency(
    options.sampleTimes,
    Math.min(8, ocrConcurrency() + 2),
    async (videoAt, index) => {
      const cropPath = path.join(options.workDir, `clock-${String(index).padStart(6, "0")}.png`);
      await extractCrop({
        videoPath: options.videoPath,
        outputPath: cropPath,
        videoAt,
        roi: options.roi,
        filterProfile: options.roi.filter,
      });
      return {
        index,
        videoAt,
        cropPath,
      };
    },
  );

  return crops.sort((a, b) => a.videoAt - b.videoAt);
}

function shouldEmitChangeOnlyAnchor(
  previous: FullMatchOcrAnchor | undefined,
  candidate: FullMatchOcrAnchor,
): boolean {
  if (!previous) return true;
  if (candidate.gameElapsed !== previous.gameElapsed) return true;
  return candidate.videoAt - previous.videoAt > CHANGE_ONLY_VIDEO_WINDOW_SECONDS;
}

async function ocrCropsToAnchors(
  crops: Array<{ videoAt: number; cropPath: string }>,
  onProgress?: (progress: OcrProgress) => Promise<void>,
): Promise<FullMatchOcrAnchor[]> {
  const anchors: FullMatchOcrAnchor[] = [];
  let processed = 0;
  let skippedDuplicateCrop = 0;
  let lastCropHash: string | null = null;
  let lastParsed: {
    gameElapsed: number;
    period: string;
    confidence: number;
    rawText: string;
  } | null = null;
  let lastProgressAt = 0;

  function tryEmitAnchor(candidate: FullMatchOcrAnchor) {
    const previous = anchors[anchors.length - 1];
    if (shouldEmitChangeOnlyAnchor(previous, candidate)) {
      anchors.push(candidate);
    }
  }

  for (const crop of crops) {
    processed += 1;
    const cropHash = await hashCropFile(crop.cropPath).catch(() => null);

    if (cropHash && cropHash === lastCropHash) {
      skippedDuplicateCrop += 1;
      if (lastParsed) {
        tryEmitAnchor({
          period: lastParsed.period,
          gameElapsed: lastParsed.gameElapsed,
          videoAt: crop.videoAt,
          rawText: lastParsed.rawText,
          confidence: lastParsed.confidence * 0.98,
        });
      }
    } else {
      const rawText = await ocrImage(crop.cropPath).catch(() => "");
      const parsed = parseClockText(rawText);
      lastCropHash = cropHash;
      if (parsed) {
        lastParsed = {
          gameElapsed: parsed.gameElapsed,
          period: parsed.period,
          confidence: parsed.confidence,
          rawText: rawText.trim(),
        };
        tryEmitAnchor({
          period: parsed.period,
          gameElapsed: parsed.gameElapsed,
          videoAt: crop.videoAt,
          rawText: rawText.trim(),
          confidence: parsed.confidence,
        });
      } else {
        lastParsed = null;
      }
    }

    const now = Date.now();
    if (processed === crops.length || processed === 1 || now - lastProgressAt > 2500) {
      lastProgressAt = now;
      void onProgress?.({
        phase: "ocr",
        processed,
        total: crops.length,
        anchors: anchors.length,
      }).catch(() => undefined);
    }
  }

  if (skippedDuplicateCrop > 0 && anchors.length > 0) {
    void onProgress?.({
      phase: "ocr",
      processed: crops.length,
      total: crops.length,
      anchors: anchors.length,
    }).catch(() => undefined);
  }

  return anchors;
}

async function refineAnchorsNearSegmentBoundaries(options: {
  videoPath: string;
  roi: Roi;
  workDir: string;
  anchors: FullMatchOcrAnchor[];
  sampleIntervalSeconds: number;
}): Promise<FullMatchOcrAnchor[]> {
  const segments = splitHighlightSegments(options.anchors);
  const boundaries = segments
    .slice(1)
    .map((segment) => segment.videoAtStart)
    .filter((videoAt) => Number.isFinite(videoAt));

  if (boundaries.length === 0) return options.anchors;

  const sampleTimes = new Set<number>();
  for (const boundary of boundaries) {
    for (let offset = -3; offset <= 3; offset += 0.5) {
      sampleTimes.add(Math.max(0, Math.round((boundary + offset) * 2) / 2));
    }
  }

  const refined = await mapWithConcurrency(
    [...sampleTimes],
    ocrConcurrency(),
    async (videoAt, index) => {
      const cropPath = path.join(options.workDir, `refine-${index}.png`);
      await extractCrop({
        videoPath: options.videoPath,
        outputPath: cropPath,
        videoAt,
        roi: options.roi,
        filterProfile: options.roi.filter,
      });
      const rawText = await ocrImage(cropPath).catch(() => "");
      const parsed = parseClockText(rawText);
      if (!parsed) return null;
      return {
        period: parsed.period,
        gameElapsed: parsed.gameElapsed,
        videoAt,
        rawText: rawText.trim(),
        confidence: parsed.confidence,
      };
    },
  );

  const merged = [...options.anchors, ...refined.filter((anchor): anchor is FullMatchOcrAnchor => Boolean(anchor))];
  return filterNoisyOcrAnchors(preserveHighlightOcrAnchors(merged), options.sampleIntervalSeconds);
}

async function readOcrAnchors(options: {
  videoPath: string;
  probe: VideoProbe;
  roi: Roi;
  workDir: string;
  sampleEverySeconds: number;
  maxSamples: number;
  onProgress?: (progress: OcrProgress) => Promise<void>;
}): Promise<FullMatchOcrAnchor[]> {
  await options.onProgress?.({
    phase: "scene_detect",
    processed: 0,
    total: 1,
    anchors: 0,
  });

  const sceneCuts = await detectSceneCutTimes(
    options.videoPath,
    options.probe.durationSeconds,
    (args) => runToolCapture("ffmpeg", args, { timeoutMs: Math.max(180_000, options.probe.durationSeconds * 1000) }),
  );
  const sampleTimes = buildCandidateSampleTimes({
    sceneCuts,
    durationSeconds: options.probe.durationSeconds,
  }).slice(0, options.maxSamples);
  const sampleIntervalSeconds = estimateSampleIntervalSeconds(sampleTimes);

  await options.onProgress?.({
    phase: "extracting",
    processed: 0,
    total: sampleTimes.length,
    anchors: sceneCuts.length,
  });

  const crops = await extractClockCropsAtTimes({
    videoPath: options.videoPath,
    roi: options.roi,
    workDir: options.workDir,
    sampleTimes,
  });

  const anchors = await ocrCropsToAnchors(crops, options.onProgress);

  const refined = await refineAnchorsNearSegmentBoundaries({
    videoPath: options.videoPath,
    roi: options.roi,
    workDir: options.workDir,
    anchors,
    sampleIntervalSeconds,
  });

  if (refined.length < 4) {
    throw new Error(
      `OCR found only ${refined.length} usable clock anchors from ${sampleTimes.length} smart-sampled frames (${sceneCuts.length} scene cuts). Try a clearer video or manual ROI/offset fallback.`,
    );
  }
  return refined;
}

function averageConfidence(anchors: FullMatchOcrAnchor[]): number {
  if (anchors.length === 0) return 0;
  return anchors.reduce((sum, anchor) => sum + anchor.confidence, 0) / anchors.length;
}

function toTimelineEvent(event: {
  id: string;
  videoAt: number;
  gameElapsed: number;
  scoreHome: number;
  scoreAway: number;
  description: string;
  periodLabel: string;
  kind: string;
  context?: string;
}): TimelineEvent {
  return {
    id: event.id,
    videoAt: event.videoAt,
    gameElapsed: event.gameElapsed,
    scoreHome: event.scoreHome,
    scoreAway: event.scoreAway,
    description: event.description,
    periodLabel: event.periodLabel,
    kind: event.kind as TimelineEvent["kind"],
    context: event.context,
  };
}

export async function listFullMatchImports(): Promise<ConvexFullMatchImport[]> {
  return getConvexClient().query(api.matches.listFullMatchImports, {});
}

export async function deleteFullMatchImport(gameId: string): Promise<{
  gameId: string;
  videoDeleted: boolean;
}> {
  const client = getConvexClient();
  const importJob = await client.query(api.matches.getFullMatchImport, { gameId });

  let videoDeleted = false;
  if (importJob?.videoFile?.startsWith("full-matches/")) {
    const filename = path.basename(importJob.videoFile);
    const videoPath = path.join(process.cwd(), ".full-matches", filename);
    await unlink(videoPath)
      .then(() => {
        videoDeleted = true;
      })
      .catch(() => undefined);
  }

  await client.mutation(api.matches.clearFullMatchImport, { gameId });
  return { gameId, videoDeleted };
}

export async function getFullMatchTimeline(gameId: string): Promise<{
  importJob: ConvexFullMatchImport | null;
  events: TimelineEvent[];
} | null> {
  const client = getConvexClient();
  const importJob = await client.query(api.matches.getFullMatchImport, { gameId });
  if (!importJob) return null;

  const stored = await client.query(api.matches.getFullMatchAlignedEvents, { gameId });
  const events = stored
    .map((event) =>
      toTimelineEvent({
        id: event.eventKey,
        videoAt: event.videoAt,
        gameElapsed: event.gameElapsed,
        scoreHome: event.scoreHome,
        scoreAway: event.scoreAway,
        description: event.description,
        periodLabel: event.periodLabel,
        kind: event.kind,
        context: event.context,
      }),
    )
    .sort((a, b) => a.videoAt - b.videoAt);

  return { importJob, events };
}

export async function processFullMatchImport(
  request: FullMatchImportRequest,
): Promise<FullMatchImportResult> {
  await assertLocalTools();

  const match = await findLiveScoreMatch(request.liveScoreMatchId);
  const gameId = request.gameId?.trim() || fullMatchGameId(request.liveScoreMatchId);
  const title = request.title?.trim() || matchTitle(match);
  const subtitle = request.subtitle?.trim() || `Full match · ${matchSubtitle(match)}`;

  await upsertImport({
    gameId,
    title,
    subtitle,
    sourceUrl: request.sourceUrl,
    liveScoreMatchId: request.liveScoreMatchId,
    status: "importing",
    statusMessage: "Downloading video with yt-dlp",
  });

  const workDir = await mkdtemp(path.join(tmpdir(), "sportscaster-full-match-"));
  try {
    const downloaded = await downloadVideo({
      sourceUrl: request.sourceUrl,
      gameId,
      title,
    });
    const probe = await probeVideo(downloaded.absolutePath);

    await upsertImport({
      gameId,
      title,
      subtitle,
      sourceUrl: request.sourceUrl,
      liveScoreMatchId: request.liveScoreMatchId,
      status: "ocr",
      statusMessage: "Detecting scoreboard ROI and smart-sampling clock frames",
      videoFile: downloaded.videoFile,
      durationSeconds: probe.durationSeconds,
    });

    const roi = await resolveClockRoi({
      videoPath: downloaded.absolutePath,
      probe,
      workDir,
      gameId,
    });
    const sampleEverySeconds = adaptiveSampleEverySeconds(
      probe.durationSeconds,
      request.sampleEverySeconds,
    );
    const alignmentMode = request.alignmentMode ?? "highlight";
    let lastOcrStatusAt = 0;
    const anchors = await readOcrAnchors({
      videoPath: downloaded.absolutePath,
      probe,
      roi,
      workDir,
      sampleEverySeconds,
      maxSamples: request.maxSamples ?? DEFAULT_MAX_SAMPLES,
      onProgress: async (progress) => {
        const now = Date.now();
        const isFinalProgress = progress.processed >= progress.total;
        if (!isFinalProgress && progress.processed > 0 && now - lastOcrStatusAt < 2500) return;
        lastOcrStatusAt = now;
        const statusMessage =
          progress.phase === "scene_detect"
            ? "Detecting highlight scene cuts for smart OCR sampling"
            : progress.phase === "extracting"
              ? `Extracting ${progress.total} smart-sampled scoreboard crops (${progress.anchors} scene cuts)`
              : `Smart OCR ${progress.processed}/${progress.total} candidate frames; ${progress.anchors} clock anchors found`;
        await upsertImport({
          gameId,
          title,
          subtitle,
          sourceUrl: request.sourceUrl,
          liveScoreMatchId: request.liveScoreMatchId,
          status: "ocr",
          statusMessage,
          videoFile: downloaded.videoFile,
          durationSeconds: probe.durationSeconds,
        });
      },
    });

    await upsertImport({
      gameId,
      title,
      subtitle,
      sourceUrl: request.sourceUrl,
      liveScoreMatchId: request.liveScoreMatchId,
      status: "aligning",
      statusMessage: `Read ${anchors.length} OCR anchors; fetching LiveScore events and aligning`,
      videoFile: downloaded.videoFile,
      durationSeconds: probe.durationSeconds,
    });

    const rawLines = await fetchRawLines(match);
    const aligned = alignLiveScoreLinesToAnchors(match, rawLines, anchors, {
      alignmentMode,
      sampleIntervalSeconds: sampleEverySeconds,
    });
    if (aligned.length === 0) {
      throw new Error("No LiveScore lines could be mapped onto OCR anchors.");
    }

    const alignmentStats = getAlignmentStats(anchors, {
      alignmentMode,
      sampleIntervalSeconds: sampleEverySeconds,
    });

    const client = getConvexClient();
    await client.mutation(api.matches.replaceFullMatchAnchors, { gameId, anchors });
    await client.mutation(api.matches.replaceFullMatchAlignedEvents, {
      gameId,
      events: aligned.map((event) => ({
        eventKey: event.eventKey,
        eventId: event.eventId,
        kind: event.kind,
        description: event.description,
        gameElapsed: event.gameElapsed,
        videoAt: event.videoAt,
        scoreHome: event.scoreHome,
        scoreAway: event.scoreAway,
        periodLabel: event.periodLabel,
        context: event.context,
        confidence: event.confidence,
      })),
    });

    const confidence = averageConfidence(anchors);
    await upsertImport({
      gameId,
      title,
      subtitle,
      sourceUrl: request.sourceUrl,
      liveScoreMatchId: request.liveScoreMatchId,
      status: "aligned",
      statusMessage: `Aligned ${aligned.length} LiveScore events from ${anchors.length} OCR anchors (${alignmentStats.segmentCount} clip segments, ${alignmentStats.alignmentMode} mode)`,
      videoFile: downloaded.videoFile,
      durationSeconds: probe.durationSeconds,
      confidence,
    });

    return {
      gameId,
      title,
      subtitle,
      status: "aligned",
      videoFile: downloaded.videoFile,
      durationSeconds: probe.durationSeconds,
      anchorCount: anchors.length,
      segmentCount: alignmentStats.segmentCount,
      alignmentMode: alignmentStats.alignmentMode,
      eventCount: aligned.length,
      confidence,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Full-match import failed";
    await upsertImport({
      gameId,
      title,
      subtitle,
      sourceUrl: request.sourceUrl,
      liveScoreMatchId: request.liveScoreMatchId,
      status: "error",
      statusMessage: message,
    }).catch(() => undefined);
    throw error;
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export function fullMatchPublicVideoUrl(videoFile: string): string {
  return `/samples/${videoFile}`;
}

export async function manualAlignFullMatch(options: {
  gameId: string;
  firstHalfVideoAt: number;
  secondHalfVideoAt?: number;
}): Promise<FullMatchImportResult> {
  const client = getConvexClient();
  const importJob = await client.query(api.matches.getFullMatchImport, {
    gameId: options.gameId,
  });
  if (!importJob) {
    throw new Error("Full-match import not found");
  }

  const match = await findLiveScoreMatch(importJob.liveScoreMatchId);
  const secondHalfVideoAt =
    options.secondHalfVideoAt ?? options.firstHalfVideoAt + 45 * 60 + 15 * 60;
  const anchors: FullMatchOcrAnchor[] = [
    {
      period: "1st Half",
      gameElapsed: 0,
      videoAt: options.firstHalfVideoAt,
      rawText: "manual kickoff",
      confidence: 0.7,
    },
    {
      period: "1st Half",
      gameElapsed: 45 * 60 - 1,
      videoAt: Math.max(options.firstHalfVideoAt + 1, secondHalfVideoAt - 15 * 60),
      rawText: "manual halftime estimate",
      confidence: 0.55,
    },
    {
      period: "2nd Half",
      gameElapsed: 45 * 60,
      videoAt: secondHalfVideoAt,
      rawText: "manual second-half kickoff",
      confidence: 0.7,
    },
    {
      period: "2nd Half",
      gameElapsed: 90 * 60,
      videoAt: secondHalfVideoAt + 45 * 60,
      rawText: "manual full-time estimate",
      confidence: 0.55,
    },
  ];

  const rawLines = await fetchRawLines(match);
  const aligned = alignLiveScoreLinesToAnchors(match, rawLines, anchors, {
    alignmentMode: "full_match",
  });
  if (aligned.length === 0) {
    throw new Error("No LiveScore lines could be mapped onto manual offsets.");
  }

  const alignmentStats = getAlignmentStats(anchors, { alignmentMode: "full_match" });

  await client.mutation(api.matches.replaceFullMatchAnchors, {
    gameId: options.gameId,
    anchors,
  });
  await client.mutation(api.matches.replaceFullMatchAlignedEvents, {
    gameId: options.gameId,
    events: aligned.map((event) => ({
      eventKey: event.eventKey,
      eventId: event.eventId,
      kind: event.kind,
      description: event.description,
      gameElapsed: event.gameElapsed,
      videoAt: event.videoAt,
      scoreHome: event.scoreHome,
      scoreAway: event.scoreAway,
      periodLabel: event.periodLabel,
      context: event.context,
      confidence: event.confidence,
    })),
  });

  const confidence = averageConfidence(anchors);
  await upsertImport({
    gameId: options.gameId,
    title: importJob.title,
    subtitle: importJob.subtitle,
    sourceUrl: importJob.sourceUrl,
    liveScoreMatchId: importJob.liveScoreMatchId,
    status: "aligned",
    statusMessage: `Aligned ${aligned.length} LiveScore events from manual offsets`,
    videoFile: importJob.videoFile,
    durationSeconds: importJob.durationSeconds,
    confidence,
  });

  return {
    gameId: options.gameId,
    title: importJob.title,
    subtitle: importJob.subtitle,
    status: "aligned",
    statusMessage: "Aligned from manual offsets",
    videoFile: importJob.videoFile,
    durationSeconds: importJob.durationSeconds,
    anchorCount: anchors.length,
    segmentCount: alignmentStats.segmentCount,
    alignmentMode: alignmentStats.alignmentMode,
    eventCount: aligned.length,
    confidence,
  };
}

export async function realignFullMatchImport(options: {
  gameId: string;
  alignmentMode?: FullMatchAlignmentMode;
  reOcr?: boolean;
}): Promise<FullMatchImportResult> {
  const client = getConvexClient();
  const importJob = await client.query(api.matches.getFullMatchImport, {
    gameId: options.gameId,
  });
  if (!importJob) {
    throw new Error("Full-match import not found");
  }
  if (!importJob.videoFile?.startsWith("full-matches/")) {
    throw new Error("Imported video file is missing; re-import the highlight first.");
  }

  const match = await findLiveScoreMatch(importJob.liveScoreMatchId);
  const alignmentMode = options.alignmentMode ?? "highlight";
  const videoPath = path.join(
    process.cwd(),
    ".full-matches",
    path.basename(importJob.videoFile),
  );
  const durationSeconds = importJob.durationSeconds ?? (await probeVideo(videoPath)).durationSeconds;
  const sampleEverySeconds = adaptiveSampleEverySeconds(durationSeconds);

  await upsertImport({
    gameId: options.gameId,
    title: importJob.title,
    subtitle: importJob.subtitle,
    sourceUrl: importJob.sourceUrl,
    liveScoreMatchId: importJob.liveScoreMatchId,
    status: options.reOcr ? "ocr" : "aligning",
    statusMessage: options.reOcr
      ? "Re-reading scoreboard clock from stored video"
      : "Re-aligning LiveScore events from stored OCR anchors",
    videoFile: importJob.videoFile,
    durationSeconds,
  });

  let anchors: FullMatchOcrAnchor[];
  const workDir = await mkdtemp(path.join(tmpdir(), "sportscaster-realign-"));
  try {
    if (options.reOcr) {
      await assertLocalTools();
      const probe = await probeVideo(videoPath);
      const roi = await resolveClockRoi({
        videoPath,
        probe,
        workDir,
        gameId: options.gameId,
      });
      anchors = await readOcrAnchors({
        videoPath,
        probe,
        roi,
        workDir,
        sampleEverySeconds,
        maxSamples: DEFAULT_MAX_SAMPLES,
      });
      await client.mutation(api.matches.replaceFullMatchAnchors, {
        gameId: options.gameId,
        anchors,
      });
    } else {
      const stored = await client.query(api.matches.getFullMatchAnchors, {
        gameId: options.gameId,
      });
      if (stored.length === 0) {
        throw new Error("No stored OCR anchors found. Re-import or choose re-OCR.");
      }
      anchors = stored.map((anchor) => ({
        period: anchor.period,
        gameElapsed: anchor.gameElapsed,
        videoAt: anchor.videoAt,
        rawText: anchor.rawText,
        confidence: anchor.confidence,
      }));
    }

    const rawLines = await fetchRawLines(match);
    const aligned = alignLiveScoreLinesToAnchors(match, rawLines, anchors, {
      alignmentMode,
      sampleIntervalSeconds: sampleEverySeconds,
    });
    if (aligned.length === 0) {
      throw new Error("No LiveScore lines could be mapped onto OCR anchors.");
    }

    const alignmentStats = getAlignmentStats(anchors, {
      alignmentMode,
      sampleIntervalSeconds: sampleEverySeconds,
    });

    await client.mutation(api.matches.replaceFullMatchAlignedEvents, {
      gameId: options.gameId,
      events: aligned.map((event) => ({
        eventKey: event.eventKey,
        eventId: event.eventId,
        kind: event.kind,
        description: event.description,
        gameElapsed: event.gameElapsed,
        videoAt: event.videoAt,
        scoreHome: event.scoreHome,
        scoreAway: event.scoreAway,
        periodLabel: event.periodLabel,
        context: event.context,
        confidence: event.confidence,
      })),
    });

    const confidence = averageConfidence(anchors);
    await upsertImport({
      gameId: options.gameId,
      title: importJob.title,
      subtitle: importJob.subtitle,
      sourceUrl: importJob.sourceUrl,
      liveScoreMatchId: importJob.liveScoreMatchId,
      status: "aligned",
      statusMessage: `Re-aligned ${aligned.length} events from ${anchors.length} anchors (${alignmentStats.segmentCount} clip segments, ${alignmentStats.alignmentMode} mode)`,
      videoFile: importJob.videoFile,
      durationSeconds,
      confidence,
    });

    return {
      gameId: options.gameId,
      title: importJob.title,
      subtitle: importJob.subtitle,
      status: "aligned",
      statusMessage: `Re-aligned ${aligned.length} events`,
      videoFile: importJob.videoFile,
      durationSeconds,
      anchorCount: anchors.length,
      segmentCount: alignmentStats.segmentCount,
      alignmentMode: alignmentStats.alignmentMode,
      eventCount: aligned.length,
      confidence,
    };
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
