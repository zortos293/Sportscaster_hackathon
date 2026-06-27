import { synthesizeTts } from "@/lib/tts-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { text } = (await request.json()) as { text?: string };

  if (!text?.trim()) {
    return Response.json({ error: "text is required" }, { status: 400 });
  }

  try {
    const result = await synthesizeTts(text, { stream: true });
    const encoder = new TextEncoder();
    const base64Chunk = result.audio.toString("base64");

    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            `event: chunk\ndata: ${JSON.stringify({ index: 0, audio: base64Chunk, cacheHit: result.cacheHit })}\n\n`,
          ),
        );
        controller.enqueue(encoder.encode("event: done\ndata: {}\n\n"));
        controller.close();
      },
    });

    return new Response(body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "TTS stream failed";
    const status = message.includes("not configured") ? 503 : 502;
    return Response.json({ error: message }, { status });
  }
}
