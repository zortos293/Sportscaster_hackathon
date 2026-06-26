export async function POST(request: Request) {
  const { text } = (await request.json()) as { text?: string };

  if (!text?.trim()) {
    return Response.json({ error: "text is required" }, { status: 400 });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID ?? "JBFqnCBsd6RMkjVDRZzb";
  const modelId = process.env.ELEVENLABS_MODEL ?? "eleven_flash_v2_5";

  if (!apiKey) {
    return Response.json({ error: "ElevenLabs is not configured" }, { status: 503 });
  }

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text: text.slice(0, 2500),
      model_id: modelId,
      voice_settings: {
        stability: 0.35,
        similarity_boost: 0.85,
        style: 0.45,
        use_speaker_boost: true,
      },
    }),
  });

  if (!response.ok) {
    return Response.json({ error: "TTS request failed" }, { status: 502 });
  }

  const buffer = await response.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  return Response.json({ audioBase64: base64, mime: "audio/mpeg" });
}
