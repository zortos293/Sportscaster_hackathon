import { NextResponse } from "next/server";
import { buildHighlightClips } from "@/lib/sportcast/highlight-clips-server";

export async function GET() {
  try {
    const clips = await buildHighlightClips();
    return NextResponse.json({ clips });
  } catch {
    return NextResponse.json({ error: "Failed to load highlight clips" }, { status: 502 });
  }
}
