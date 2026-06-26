import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getModelId, getVoiceId } from "./config.js";
import { formatMs, streamLineToAudio, summarize } from "./tts.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");
const defaultLinesPath = join(projectRoot, "data", "commentary-lines.json");
const outputDir = join(projectRoot, "output");

interface LineMetrics {
  lineNumber: number;
  text: string;
  charCount: number;
  ttfaMs: number;
  totalMs: number;
  outputFile: string;
}

async function loadCommentaryLines(inputPath?: string): Promise<string[]> {
  const filePath = resolve(inputPath ?? defaultLinesPath);
  const raw = await readFile(filePath, "utf-8");
  const parsed: unknown = JSON.parse(raw);

  if (!Array.isArray(parsed) || parsed.some((line) => typeof line !== "string")) {
    throw new Error(`Expected a JSON array of strings in ${filePath}`);
  }

  if (parsed.length === 0) {
    throw new Error(`No commentary lines found in ${filePath}`);
  }

  return parsed;
}

async function main(): Promise<void> {
  const inputPath = process.argv[2];
  const lines = await loadCommentaryLines(inputPath);
  const voiceId = getVoiceId();
  const modelId = getModelId();

  await mkdir(outputDir, { recursive: true });

  console.log("ElevenLabs Commentary Benchmark (streaming)");
  console.log(`Voice: ${voiceId}`);
  console.log(`Model: ${modelId}`);
  console.log(`Lines: ${lines.length}`);
  console.log("");

  const benchmarkStart = performance.now();
  const results: LineMetrics[] = [];

  for (let i = 0; i < lines.length; i++) {
    const text = lines[i];
    const lineNumber = i + 1;
    const fileName = `line-${String(lineNumber).padStart(2, "0")}.mp3`;
    const outputFile = join(outputDir, fileName);

    process.stdout.write(`Line ${lineNumber}: streaming... `);

    const { ttfaMs, totalMs, audio } = await streamLineToAudio(
      text,
      voiceId,
      modelId,
    );

    await writeFile(outputFile, audio);

    results.push({
      lineNumber,
      text,
      charCount: text.length,
      ttfaMs,
      totalMs,
      outputFile: fileName,
    });

    console.log(
      `TTFA ${formatMs(ttfaMs)} | Total ${formatMs(totalMs)} | ${text.length} chars → ${fileName}`,
    );
  }

  const benchmarkTotalMs = performance.now() - benchmarkStart;
  const ttfaStats = summarize(results.map((r) => r.ttfaMs));
  const totalStats = summarize(results.map((r) => r.totalMs));
  const totalChars = results.reduce((sum, r) => sum + r.charCount, 0);
  const charsPerSec = totalChars / (benchmarkTotalMs / 1000);

  console.log("");
  console.log("Summary");
  console.log("-------");
  console.log(`Lines processed:     ${results.length}`);
  console.log(`Total characters:    ${totalChars}`);
  console.log(
    `TTFA (avg/min/max):  ${formatMs(ttfaStats.avg)} / ${formatMs(ttfaStats.min)} / ${formatMs(ttfaStats.max)}`,
  );
  console.log(
    `Stream (avg/min/max): ${formatMs(totalStats.avg)} / ${formatMs(totalStats.min)} / ${formatMs(totalStats.max)}`,
  );
  console.log(`Benchmark duration:  ${formatMs(benchmarkTotalMs)}`);
  console.log(`Throughput:          ${charsPerSec.toFixed(1)} chars/sec`);
  console.log(`Output directory:    ${outputDir}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
  process.exit(1);
});
