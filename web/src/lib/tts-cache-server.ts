import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export const TTS_AUDIO_MIME = "audio/mpeg";

export type TtsCacheRequest = {
  gameId: string;
  eventKey: string;
  text: string;
  voiceId?: string;
  modelId?: string;
};

export type CachedTtsAudio = {
  filePath: string;
  publicUrl: string;
};

export type TtsProviderConfig = {
  apiKey?: string;
  voiceId: string;
  modelId: string;
};

const PUBLIC_CACHE_DIR = "tts-cache";
const DEFAULT_ELEVENLABS_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb";
const DEFAULT_ELEVENLABS_MODEL = "eleven_flash_v2_5";

function publicRoot(): string {
  return path.join(process.cwd(), "public");
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "line";
}

function contentHash(text: string, voiceId: string, modelId: string): string {
  return createHash("sha256")
    .update(`${voiceId}\n${modelId}\n${normalizeText(text)}`)
    .digest("hex")
    .slice(0, 16);
}

export function getTtsProviderConfig(): TtsProviderConfig {
  return {
    apiKey: process.env.ELEVENLABS_API_KEY,
    voiceId: process.env.ELEVENLABS_VOICE_ID ?? DEFAULT_ELEVENLABS_VOICE_ID,
    modelId: process.env.ELEVENLABS_MODEL ?? DEFAULT_ELEVENLABS_MODEL,
  };
}

function cacheParts(request: TtsCacheRequest, config = getTtsProviderConfig()) {
  const gameSlug = slugify(request.gameId);
  const eventSlug = slugify(request.eventKey);
  const hash = contentHash(
    request.text,
    request.voiceId ?? config.voiceId,
    request.modelId ?? config.modelId,
  );
  const fileName = `${eventSlug}-${hash}.mp3`;
  const relativePath = path.posix.join(PUBLIC_CACHE_DIR, gameSlug, fileName);

  return {
    eventSlug,
    filePath: path.join(publicRoot(), ...relativePath.split("/")),
    publicUrl: `/${relativePath}`,
    folderPath: path.join(publicRoot(), PUBLIC_CACHE_DIR, gameSlug),
  };
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    const info = await stat(filePath);
    return info.isFile() && info.size > 0;
  } catch {
    return false;
  }
}

export async function findCachedTtsAudio(
  request: TtsCacheRequest,
): Promise<CachedTtsAudio | null> {
  const parts = cacheParts(request);

  if (await fileExists(parts.filePath)) {
    return { filePath: parts.filePath, publicUrl: parts.publicUrl };
  }

  return null;
}

export async function readCachedTtsAudio(
  request: TtsCacheRequest,
): Promise<{ audio: Buffer; publicUrl: string } | null> {
  const cached = await findCachedTtsAudio(request);
  if (!cached) return null;

  return {
    audio: await readFile(cached.filePath),
    publicUrl: cached.publicUrl,
  };
}

export async function writeCachedTtsAudio(
  request: TtsCacheRequest,
  audio: Buffer,
): Promise<CachedTtsAudio> {
  const parts = cacheParts(request);
  await mkdir(path.dirname(parts.filePath), { recursive: true });
  await writeFile(parts.filePath, audio);
  return { filePath: parts.filePath, publicUrl: parts.publicUrl };
}

export async function synthesizeElevenLabsSpeech(
  text: string,
  config = getTtsProviderConfig(),
): Promise<Buffer> {
  if (!config.apiKey) {
    throw new Error("ElevenLabs is not configured");
  }

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${config.voiceId}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": config.apiKey,
        "Content-Type": "application/json",
        Accept: TTS_AUDIO_MIME,
      },
      body: JSON.stringify({
        text: text.slice(0, 2500),
        model_id: config.modelId,
        output_format: "mp3_44100_128",
        voice_settings: {
          stability: 0.35,
          similarity_boost: 0.85,
          style: 0.45,
          use_speaker_boost: true,
        },
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(`TTS request failed: ${errorText.slice(0, 200)}`);
  }

  return Buffer.from(await response.arrayBuffer());
}
