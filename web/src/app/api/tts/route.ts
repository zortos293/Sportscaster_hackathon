import { synthesizeTts } from "@/lib/tts-server";

export async function POST(request: Request) {
  const { text } = (await request.json()) as { text?: string };

  if (!text?.trim()) {
    return Response.json({ error: "text is required" }, { status: 400 });
  }

  try {
    const result = await synthesizeTts(text);
    return Response.json({
      audioBase64: result.audio.toString("base64"),
      mime: result.mime,
      cacheHit: result.cacheHit,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "TTS request failed";
    const status = message.includes("not configured") ? 503 : 502;
    return Response.json({ error: message }, { status });
  }
}
