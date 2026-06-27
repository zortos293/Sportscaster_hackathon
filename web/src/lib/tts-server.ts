import {
  readCachedTtsAudio,
  ttsCacheKey,
  writeCachedTtsAudio,
} from "@/lib/tts-cache-server";

export type TtsConfig = {
  apiKey: string;
  voiceId: string;
  modelId: string;
};

export type TtsResult = {
  audio: Buffer;
  mime: string;
  cacheHit: boolean;
};

export function getTtsConfig(): TtsConfig | null {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) return null;

  return {
    apiKey,
    voiceId: process.env.ELEVENLABS_VOICE_ID?.trim() ?? "JBFqnCBsd6RMkjVDRZzb",
    modelId: process.env.ELEVENLABS_MODEL?.trim() ?? "eleven_flash_v2_5",
  };
}

async function requestElevenLabsTts(
  config: TtsConfig,
  text: string,
  stream: boolean,
): Promise<Buffer> {
  const endpoint = stream
    ? `https://api.elevenlabs.io/v1/text-to-speech/${config.voiceId}/stream`
    : `https://api.elevenlabs.io/v1/text-to-speech/${config.voiceId}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "xi-api-key": config.apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text: text.slice(0, 2500),
      model_id: config.modelId,
      ...(stream
        ? {
            output_format: "mp3_44100_128",
            optimize_streaming_latency: 3,
          }
        : {}),
      voice_settings: {
        stability: 0.35,
        similarity_boost: 0.85,
        style: 0.45,
        use_speaker_boost: true,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(`TTS request failed: ${errorText.slice(0, 200)}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length === 0) {
    throw new Error("TTS request returned empty audio");
  }

  return buffer;
}

export async function synthesizeTts(
  text: string,
  options?: { stream?: boolean },
): Promise<TtsResult> {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("text is required");
  }

  const config = getTtsConfig();
  if (!config) {
    throw new Error("ElevenLabs is not configured");
  }

  const cacheKey = ttsCacheKey(trimmed, config.voiceId, config.modelId);
  const cached = await readCachedTtsAudio(cacheKey);
  if (cached) {
    return { audio: cached, mime: "audio/mpeg", cacheHit: true };
  }

  const audio = await requestElevenLabsTts(config, trimmed, options?.stream ?? false);
  await writeCachedTtsAudio(cacheKey, audio);

  return { audio, mime: "audio/mpeg", cacheHit: false };
}
