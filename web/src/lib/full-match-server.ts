import {
  alignLiveScoreLinesToAnchors,
  parseClockText,
  preserveHighlightOcrAnchors,
} from "@/lib/full-match-align";
import type { FullMatchOcrAnchor } from "@/lib/full-match-align";
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
import { ConvexHttpClient } from "convex/browser";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
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
  eventCount?: number;
  confidence?: number;
};

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
};

const DEFAULT_SAMPLE_SECONDS = 2;
const DEFAULT_MAX_SAMPLES = 1200;

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
  options?: { cwd?: string; timeoutMs?: number },
): Promise<string> {
  const executable = await resolveTool(command);
  try {
    const { stdout } = await execFileAsync(executable, args, {
      cwd: options?.cwd,
      timeout: options?.timeoutMs ?? 120_000,
      maxBuffer: 1024 * 1024 * 8,
    });
    return stdout;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to run ${executable}: ${message}`);
  }
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
    // FIFA-style scorebugs often place the clock in a small white pill near the
    // upper-left, below the very top edge of the broadcast frame.
    { id: "top-left-clock-tight", x: 0.04, y: 0.09, width: 0.15, height: 0.11 },
    { id: "top-left-clock-lower", x: 0.04, y: 0.12, width: 0.16, height: 0.12 },
    { id: "top-left-clock-wide", x: 0.035, y: 0.075, width: 0.2, height: 0.14 },
    { id: "top-left-wide", x: 0.02, y: 0.02, width: 0.32, height: 0.12 },
    { id: "top-left-wide-lower", x: 0.02, y: 0.08, width: 0.34, height: 0.16 },
    { id: "top-center-wide", x: 0.34, y: 0.02, width: 0.32, height: 0.12 },
    { id: "top-right-wide", x: 0.66, y: 0.02, width: 0.32, height: 0.12 },
    { id: "bottom-left-wide", x: 0.02, y: 0.84, width: 0.32, height: 0.12 },
  ];

  return boxes.map((box) => ({
    id: box.id,
    x: Math.max(0, Math.round(box.x * width)),
    y: Math.max(0, Math.round(box.y * height)),
    width: Math.max(120, Math.round(box.width * width)),
    height: Math.max(40, Math.round(box.height * height)),
  }));
}

async function extractCrop(options: {
  videoPath: string;
  outputPath: string;
  videoAt: number;
  roi: Roi;
}): Promise<void> {
  const { roi } = options;
  await runTool("ffmpeg", [
    "-y",
    "-ss",
    String(Math.max(0, options.videoAt)),
    "-i",
    options.videoPath,
    "-frames:v",
    "1",
    "-vf",
    `crop=${roi.width}:${roi.height}:${roi.x}:${roi.y},scale=iw*4:ih*4,format=gray,eq=contrast=2:brightness=0.04,unsharp=5:5:1.0`,
    options.outputPath,
  ]);
}

async function ocrImage(imagePath: string): Promise<string> {
  const attempts = [
    ["--psm", "7"],
    ["--psm", "8"],
    ["--psm", "13"],
    ["--psm", "6"],
  ];
  const outputs: string[] = [];
  for (const psmArgs of attempts) {
    const text = await runTool(
      "tesseract",
      [
        imagePath,
        "stdout",
        ...psmArgs,
        "-l",
        "eng",
        "-c",
        "tessedit_char_whitelist=0123456789:+.'’",
      ],
      { timeoutMs: 30_000 },
    ).catch(() => "");
    if (text.trim()) outputs.push(text.trim());
    if (parseClockText(text)) return text;
  }
  return outputs.join(" ");
}

async function detectClockRoi(options: {
  videoPath: string;
  probe: VideoProbe;
  workDir: string;
}): Promise<Roi> {
  const rois = candidateRois(options.probe);
  const sampleTimes = [30, 60, 120, 300, 600, 900, 1800].filter(
    (time) => time < options.probe.durationSeconds - 5,
  );
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
        });
        const text = await ocrImage(cropPath).catch(() => "");
        const parsed = parseClockText(text);
        if (parsed) {
          hits += 1;
          confidence += parsed.confidence;
        }
      }
      return { roi, hits, confidence };
    }),
  );

  const best = scored.sort(
    (a, b) => b.hits - a.hits || b.confidence - a.confidence,
  )[0];
  if (!best || best.hits === 0) {
    throw new Error("Could not auto-detect a scoreboard clock ROI with OCR.");
  }
  return best.roi;
}

async function readOcrAnchors(options: {
  videoPath: string;
  probe: VideoProbe;
  roi: Roi;
  workDir: string;
  sampleEverySeconds: number;
  maxSamples: number;
}): Promise<FullMatchOcrAnchor[]> {
  const anchors: FullMatchOcrAnchor[] = [];
  const sampleCount = Math.min(
    options.maxSamples,
    Math.floor(options.probe.durationSeconds / options.sampleEverySeconds),
  );

  for (let i = 0; i <= sampleCount; i += 1) {
    const videoAt = i * options.sampleEverySeconds;
    const cropPath = path.join(options.workDir, `clock-${i}.png`);
    await extractCrop({
      videoPath: options.videoPath,
      outputPath: cropPath,
      videoAt,
      roi: options.roi,
    });
    const rawText = await ocrImage(cropPath).catch(() => "");
    const parsed = parseClockText(rawText);
    if (!parsed) continue;
    anchors.push({
      period: parsed.period,
      gameElapsed: parsed.gameElapsed,
      videoAt,
      rawText: rawText.trim(),
      confidence: parsed.confidence,
    });
  }

  const preserved = preserveHighlightOcrAnchors(anchors);
  if (preserved.length < 4) {
    throw new Error(
      `OCR found only ${preserved.length} usable clock anchors. Try a clearer video or manual ROI/offset fallback.`,
    );
  }
  return preserved;
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
      statusMessage: "Detecting scoreboard clock and reading OCR anchors",
      videoFile: downloaded.videoFile,
      durationSeconds: probe.durationSeconds,
    });

    const roi = await detectClockRoi({
      videoPath: downloaded.absolutePath,
      probe,
      workDir,
    });
    const anchors = await readOcrAnchors({
      videoPath: downloaded.absolutePath,
      probe,
      roi,
      workDir,
      sampleEverySeconds: request.sampleEverySeconds ?? DEFAULT_SAMPLE_SECONDS,
      maxSamples: request.maxSamples ?? DEFAULT_MAX_SAMPLES,
    });

    const rawLines = await fetchRawLines(match);
    const aligned = alignLiveScoreLinesToAnchors(match, rawLines, anchors);
    if (aligned.length === 0) {
      throw new Error("No LiveScore lines could be mapped onto OCR anchors.");
    }

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
      statusMessage: `Aligned ${aligned.length} LiveScore events from ${anchors.length} OCR anchors`,
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
  const aligned = alignLiveScoreLinesToAnchors(match, rawLines, anchors);
  if (aligned.length === 0) {
    throw new Error("No LiveScore lines could be mapped onto manual offsets.");
  }

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
    eventCount: aligned.length,
    confidence,
  };
}
