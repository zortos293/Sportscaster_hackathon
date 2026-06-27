import {
  findCachedTtsAudio,
  getTtsProviderConfig,
  synthesizeElevenLabsSpeech,
  TTS_AUDIO_MIME,
  writeCachedTtsAudio,
} from "@/lib/tts-cache-server";

export const runtime = "nodejs";

type TtsRequest = {
  text?: string;
  gameId?: string;
  eventKey?: string;
  force?: boolean;
};

export async function POST(request: Request) {
  const { text, gameId, eventKey, force = false } = (await request.json()) as TtsRequest;

  if (!text?.trim()) {
    return Response.json({ error: "text is required" }, { status: 400 });
  }

  const cacheRequest =
    gameId && eventKey
      ? {
          gameId,
          eventKey,
          text,
        }
      : null;

  if (cacheRequest && !force) {
    const cached = await findCachedTtsAudio(cacheRequest);
    if (cached) {
      return Response.json({
        audioUrl: cached.publicUrl,
        mime: TTS_AUDIO_MIME,
        cacheHit: true,
      });
    }
  }

  const config = getTtsProviderConfig();
  if (!config.apiKey) {
    return Response.json({ error: "ElevenLabs is not configured" }, { status: 503 });
  }

  try {
    const audio = await synthesizeElevenLabsSpeech(text, config);
    let cached: Awaited<ReturnType<typeof writeCachedTtsAudio>> | null = null;
    if (cacheRequest) {
      try {
        cached = await writeCachedTtsAudio(cacheRequest, audio);
      } catch (error) {
        console.warn("[tts] failed to write cached audio:", error);
      }
    }

    return Response.json({
      audioUrl: cached?.publicUrl,
      audioBase64: cached ? undefined : audio.toString("base64"),
      mime: TTS_AUDIO_MIME,
      cacheHit: false,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "TTS request failed" },
      { status: 502 },
    );
  }
}
