import {
  buildHighlightClips,
  type HighlightClip,
} from "@/lib/sportcast/highlight-clips-server";

export type { HighlightClip };

/** @deprecated Use HighlightClip from highlight-clips-server */
export type HighlightEvent = HighlightClip;

export async function fetchHighlightClips(): Promise<HighlightClip[]> {
  return buildHighlightClips();
}

/** @deprecated Use fetchHighlightClips */
export async function fetchHighlights(): Promise<HighlightClip[]> {
  return fetchHighlightClips();
}
