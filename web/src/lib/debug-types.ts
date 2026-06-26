import type { GameBroadcastContext } from "@/lib/game-context";
import type { TimelineEvent } from "@/lib/timeline";

export type CommentaryDebugEntry = {
  id: string;
  generatedAt: string;
  videoAt: number;
  source: "llm" | "template" | "fallback" | "cursor";
  text: string;
  event: TimelineEvent;
  model?: string;
  userPrompt?: string;
  recentLines?: string[];
};

export type EspnDebugSummary = {
  header?: {
    id?: string;
    name?: string;
    shortName?: string;
    season?: { year?: number; type?: number };
    competitions?: Array<{
      id?: string;
      date?: string;
      status?: { type?: { description?: string; state?: string } };
      competitors?: Array<{
        homeAway?: string;
        team?: { displayName?: string; abbreviation?: string };
        score?: string;
      }>;
    }>;
  };
  scoringPlays?: unknown[];
  keyEvents?: unknown[];
};

export type TimelineDebugInfo = {
  espnUrl: string;
  fetchedAt: string;
  summary: EspnDebugSummary;
  payload: unknown;
  events: TimelineEvent[];
  gameContext?: GameBroadcastContext;
  videoMode?: string;
};
