import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";

export type HighlightEvent = {
  _id: string;
  gameId: string;
  kind: string;
  description: string;
  gameElapsed: number;
  videoAt: number;
  scoreHome: number;
  scoreAway: number;
  periodLabel: string;
  context?: string;
  confidence: number;
  matchTitle: string;
  matchSubtitle: string;
};

function getConvexClient(): ConvexHttpClient | null {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL?.trim();
  if (!url || !/^https?:\/\//.test(url)) return null;
  return new ConvexHttpClient(url);
}

export async function fetchHighlights(): Promise<HighlightEvent[]> {
  const client = getConvexClient();
  if (!client) return [];
  try {
    return await client.query(api.matches.listHighlights, {});
  } catch {
    return [];
  }
}
