import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const CACHE_DIR = path.join(process.cwd(), ".tts-cache");

export function ttsCacheKey(text: string, voiceId: string, modelId: string): string {
  return createHash("sha256")
    .update(`${voiceId}|${modelId}|${text.trim()}`)
    .digest("hex");
}

function cacheFilePath(cacheKey: string): string {
  return path.join(CACHE_DIR, `${cacheKey}.mp3`);
}

export async function readCachedTtsAudio(cacheKey: string): Promise<Buffer | null> {
  try {
    const filePath = cacheFilePath(cacheKey);
    const info = await stat(filePath);
    if (!info.isFile() || info.size === 0) return null;
    return readFile(filePath);
  } catch {
    return null;
  }
}

export async function writeCachedTtsAudio(cacheKey: string, audio: Buffer): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(cacheFilePath(cacheKey), audio);
}
