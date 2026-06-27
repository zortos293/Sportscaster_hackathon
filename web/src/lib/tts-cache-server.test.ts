import { afterEach, describe, expect, it } from "vitest";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import {
  readCachedTtsAudio,
  ttsCacheKey,
  writeCachedTtsAudio,
} from "./tts-cache-server";

describe("tts-cache-server", () => {
  const cacheDir = path.join(process.cwd(), ".tts-cache");
  const testKey = ttsCacheKey("Hello from Sportcast.", "voice-a", "model-a");

  afterEach(async () => {
    await rm(cacheDir, { recursive: true, force: true });
  });

  it("returns null for missing cache entries", async () => {
    await expect(readCachedTtsAudio("missing-key")).resolves.toBeNull();
  });

  it("writes and reads cached audio", async () => {
    const audio = Buffer.from("fake-mp3-bytes");
    await writeCachedTtsAudio(testKey, audio);
    await expect(readCachedTtsAudio(testKey)).resolves.toEqual(audio);
  });

  it("uses stable cache keys for the same text and voice", () => {
    expect(ttsCacheKey("Same line.", "voice", "model")).toBe(
      ttsCacheKey("Same line.", "voice", "model"),
    );
    expect(ttsCacheKey("Other line.", "voice", "model")).not.toBe(
      ttsCacheKey("Same line.", "voice", "model"),
    );
  });
});
