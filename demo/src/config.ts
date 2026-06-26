import "dotenv/config";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

export const DEFAULT_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb";
export const DEFAULT_MODEL = "eleven_flash_v2_5";

export function createClient(): ElevenLabsClient {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ELEVENLABS_API_KEY is missing. Copy .env.example to .env and add your API key.",
    );
  }
  return new ElevenLabsClient({ apiKey });
}

export function getVoiceId(): string {
  return process.env.ELEVENLABS_VOICE_ID ?? DEFAULT_VOICE_ID;
}

export function getModelId(): string {
  return process.env.ELEVENLABS_MODEL ?? DEFAULT_MODEL;
}
