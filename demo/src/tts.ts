import { createClient } from "./config.js";

export interface StreamLineResult {
  ttfaMs: number;
  totalMs: number;
  audio: Buffer;
}

export interface StreamLineOptions {
  onFirstChunk?: (ttfaMs: number) => void;
}

export async function streamLineToAudio(
  text: string,
  voiceId: string,
  modelId: string,
  options: StreamLineOptions = {},
): Promise<StreamLineResult> {
  const client = createClient();
  const start = performance.now();

  const stream = await client.textToSpeech.stream(voiceId, {
    text,
    modelId,
    outputFormat: "mp3_44100_128",
    optimizeStreamingLatency: 3,
  });

  const chunks: Buffer[] = [];
  let ttfaMs: number | null = null;
  const reader = stream.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (ttfaMs === null) {
        ttfaMs = performance.now() - start;
        options.onFirstChunk?.(ttfaMs);
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }

  const totalMs = performance.now() - start;

  if (ttfaMs === null) {
    throw new Error("Stream completed without receiving audio data");
  }

  return { ttfaMs, totalMs, audio: Buffer.concat(chunks) };
}

export function summarize(values: number[]): { avg: number; min: number; max: number } {
  return {
    avg: values.reduce((sum, v) => sum + v, 0) / values.length,
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

export function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
