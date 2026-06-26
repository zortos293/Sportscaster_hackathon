import type { ServerResponse } from "node:http";
import { getModelId, getVoiceId } from "./config.js";
import { streamLineToAudio, summarize } from "./tts.js";

export interface CastLineInput {
  dedupeKey?: string;
  text: string;
  timestamp?: string;
  eventType?: string;
  eventCategory?: string;
}

function sendSse(res: ServerResponse, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function castLinesOverSse(
  res: ServerResponse,
  lines: CastLineInput[],
  meta: Record<string, unknown> = {},
): Promise<void> {
  const voiceId = getVoiceId();
  const modelId = getModelId();

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });

  sendSse(res, "started", { voiceId, modelId, lineCount: lines.length, ...meta });

  const benchmarkStart = performance.now();
  const ttfaValues: number[] = [];
  const totalValues: number[] = [];
  let totalChars = 0;

  try {
    for (let i = 0; i < lines.length; i++) {
      const { text, dedupeKey, timestamp } = lines[i];
      const lineNumber = i + 1;

      sendSse(res, "line-start", {
        lineNumber,
        text,
        charCount: text.length,
        dedupeKey,
        timestamp,
        eventType: lines[i].eventType,
        eventCategory: lines[i].eventCategory,
      });

      const { ttfaMs, totalMs, audio } = await streamLineToAudio(text, voiceId, modelId, {
        onFirstChunk: (firstChunkMs) => {
          sendSse(res, "line-ttfa", { lineNumber, ttfaMs: firstChunkMs, dedupeKey });
        },
      });

      ttfaValues.push(ttfaMs);
      totalValues.push(totalMs);
      totalChars += text.length;

      sendSse(res, "line-audio", {
        lineNumber,
        ttfaMs,
        totalMs,
        charCount: text.length,
        dedupeKey,
        timestamp,
        audioBase64: audio.toString("base64"),
      });
    }

    const benchmarkTotalMs = performance.now() - benchmarkStart;
    const ttfaStats = summarize(ttfaValues);
    const totalStats = summarize(totalValues);

    sendSse(res, "summary", {
      lineCount: lines.length,
      totalChars,
      benchmarkTotalMs,
      ttfa: ttfaStats,
      stream: totalStats,
      throughputCharsPerSec: totalChars / (benchmarkTotalMs / 1000),
      ...meta,
    });

    sendSse(res, "done", {});
    res.end();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    sendSse(res, "error", { message });
    res.end();
  }
}
