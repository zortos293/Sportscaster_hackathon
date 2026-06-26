import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

export const runtime = "nodejs";

function resolveVideoPath(filename: string): string {
  const safeName = path.basename(filename);
  return path.join(process.cwd(), ".full-matches", safeName);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params;
  const videoPath = resolveVideoPath(filename);

  let info: Awaited<ReturnType<typeof stat>>;
  try {
    info = await stat(videoPath);
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const range = request.headers.get("range");
  const size = info.size;

  if (!range) {
    const stream = Readable.toWeb(createReadStream(videoPath));
    return new Response(stream as BodyInit, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(size),
        "Accept-Ranges": "bytes",
      },
    });
  }

  const match = range.match(/bytes=(\d*)-(\d*)/);
  const start = match?.[1] ? Number.parseInt(match[1], 10) : 0;
  const end = match?.[2] ? Number.parseInt(match[2], 10) : size - 1;
  const boundedStart = Math.max(0, Math.min(start, size - 1));
  const boundedEnd = Math.max(boundedStart, Math.min(end, size - 1));
  const chunkSize = boundedEnd - boundedStart + 1;

  const stream = Readable.toWeb(
    createReadStream(videoPath, { start: boundedStart, end: boundedEnd }),
  );

  return new Response(stream as BodyInit, {
    status: 206,
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(chunkSize),
      "Content-Range": `bytes ${boundedStart}-${boundedEnd}/${size}`,
      "Accept-Ranges": "bytes",
    },
  });
}
