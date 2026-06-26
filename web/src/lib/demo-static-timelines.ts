import type { GameBroadcastContext } from "@/lib/game-context";
import { eventCacheKey, type CachedCommentaryLine } from "@/lib/match-cache";
import type { TimelineEvent } from "@/lib/timeline";

export type StaticDemoPack = {
  events: TimelineEvent[];
  gameContext: GameBroadcastContext;
  commentary: CachedCommentaryLine[];
};

const HOBBY_HORSING_EVENTS: TimelineEvent[] = [
  {
    id: "hh-opening",
    videoAt: 0,
    gameElapsed: 0,
    scoreHome: 0,
    scoreAway: 0,
    periodLabel: "Round 1",
    kind: "opening",
    description: "Germany hosts its first national hobby horsing championship — riders enter the arena",
    context: "Hannover · Opening ceremony",
  },
  {
    id: "hh-jump-combo",
    videoAt: 10,
    gameElapsed: 10,
    scoreHome: 0,
    scoreAway: 0,
    periodLabel: "Round 1",
    kind: "key_play",
    description: "Clean triple-bar combination — textbook stick landing on the final jump",
    context: "Technical routine",
  },
  {
    id: "hh-freestyle",
    videoAt: 22,
    gameElapsed: 22,
    scoreHome: 1,
    scoreAway: 0,
    periodLabel: "Round 1",
    kind: "score",
    description: "Freestyle gallop sequence earns 9.2 from the judges",
    context: "Crowd favorite",
  },
  {
    id: "hh-penalty",
    videoAt: 34,
    gameElapsed: 34,
    scoreHome: 1,
    scoreAway: 0,
    periodLabel: "Round 1",
    kind: "key_play",
    description: "Technical penalty — stirrup touch on the dismount costs half a point",
    context: "Judge review",
  },
  {
    id: "hh-champion",
    videoAt: 44,
    gameElapsed: 44,
    scoreHome: 2,
    scoreAway: 0,
    periodLabel: "Final",
    kind: "score",
    description: "Championship-clinching routine — arena erupts as Germany crowns its first hobby horsing champion",
    context: "Final scores posted",
  },
];

const HOBBY_HORSING_CONTEXT: GameBroadcastContext = {
  matchup: "Germany Hobby Horsing Championship",
  awayTeam: "International field",
  homeTeam: "Germany",
  venue: "Hannover",
  facts: [
    "Hobby horsing combines gymnastics, dance, and show jumping — all on a stick horse.",
    "Judges score technical difficulty, artistry, and landings on a 10-point scale.",
    "This is the first nationally televised championship in Germany.",
    "Riders range from ages 8 to 24, with separate junior and senior divisions.",
  ],
  narrative:
    "A packed hall in Hannover witnesses history as Germany's inaugural hobby horsing championship crowns its first national champion.",
};

const HOBBY_HORSING_LINES: Record<string, string> = {
  "hh-opening":
    "Welcome to Hannover — history in the making! Germany's first-ever hobby horsing championship is underway, and the energy in this arena is absolutely electric!",
  "hh-jump-combo":
    "Oh, listen to that stick hit the mat — clean as a whistle! Triple-bar combination nailed with textbook form. The judges are already scribbling notes.",
  "hh-freestyle":
    "What a gallop! She sells every stride like it's the Derby itself — and the judges love it! 9.2 on the board, and this crowd is on its feet!",
  "hh-penalty":
    "Wait — the judges are conferring. Stirrup touch on the dismount, that's a half-point deduction. Heartbreaking after such a strong routine, but the championship is still within reach.",
  "hh-champion":
    "AND THERE IT IS! Germany has its first hobby horsing champion! The arena absolutely erupts — you couldn't write a better finish to this inaugural championship!",
};

function buildCommentary(events: TimelineEvent[], lines: Record<string, string>): CachedCommentaryLine[] {
  return events.map((event) => ({
    eventKey: eventCacheKey(event),
    eventId: event.id,
    kind: event.kind,
    description: event.description,
    videoAt: event.videoAt,
    text: lines[event.id] ?? event.description,
    source: "bundled",
  }));
}

const STATIC_PACKS: Record<string, StaticDemoPack> = {
  "hobby-horsing-germany": {
    events: HOBBY_HORSING_EVENTS,
    gameContext: HOBBY_HORSING_CONTEXT,
    commentary: buildCommentary(HOBBY_HORSING_EVENTS, HOBBY_HORSING_LINES),
  },
};

export function getStaticDemoPack(gameId: string): StaticDemoPack | undefined {
  return STATIC_PACKS[gameId];
}

export function getBundledCommentaryLine(
  gameId: string,
  event: Pick<TimelineEvent, "id" | "videoAt">,
): { text: string; source: string; cachedAt: number } | null {
  const pack = STATIC_PACKS[gameId];
  if (!pack) return null;

  const key = eventCacheKey(event);
  const line = pack.commentary.find((entry) => entry.eventKey === key);
  if (!line?.text?.trim()) return null;

  return {
    text: line.text.trim(),
    source: "bundled",
    cachedAt: 0,
  };
}

/** Warm client/server caches with all bundled lines for a static demo. */
export function getBundledCommentaryLines(gameId: string): CachedCommentaryLine[] {
  return STATIC_PACKS[gameId]?.commentary ?? [];
}
