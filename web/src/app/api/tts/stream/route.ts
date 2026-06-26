export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: text.slice(0, 2500),
        model_id: modelId,
        output_format: "mp3_44100_128",
        optimize_streaming_latency: 3,
        voice_settings: {
          stability: 0.35,
          similarity_boost: 0.85,
          style: 0.45,
          use_speaker_boost: true,
        },
      }),
    },
  );

  if (!response.ok || !response.body) {
    const errorText = await response.text().catch(() => "Unknown error");
    return Response.json(
      { error: `TTS stream failed: ${errorText.slice(0, 200)}` },
      { status: 502 },
    );
  }

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      const reader = response.body!.getReader();
      let chunkIndex = 0;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const base64Chunk = Buffer.from(value).toString("base64");
          const event = `event: chunk\ndata: ${JSON.stringify({ index: chunkIndex, audio: base64Chunk })}\n\n`;
          controller.enqueue(encoder.encode(event));
          chunkIndex++;
        }

        controller.enqueue(encoder.encode("event: done\ndata: {}\n\n"));
        controller.close();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Stream error";
        controller.enqueue(
          encoder.encode(`event: error\ndata: ${JSON.stringify({ error: message })}\n\n`),
        );
        controller.close();
      } finally {
        reader.releaseLock();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
