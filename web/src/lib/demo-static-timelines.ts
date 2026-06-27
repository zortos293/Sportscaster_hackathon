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

const CHELSEA_NEWCASTLE_EVENTS: TimelineEvent[] = [
  {
    id: "opening",
    videoAt: 5,
    gameElapsed: 0,
    scoreHome: 0,
    scoreAway: 0,
    periodLabel: "1st Half",
    kind: "opening",
    description: "Kickoff - Newcastle United at Chelsea.",
    context:
      "Venue: Stamford Bridge in London. Chelsea Total Shots leader: Pedro Neto (5). Chelsea Saves leader: Wesley Fofana (2).",
  },
  {
    id: "key-1",
    videoAt: 33.45833333333333,
    gameElapsed: 644,
    scoreHome: 0,
    scoreAway: 0,
    periodLabel: "1st Half",
    kind: "key_play",
    description: "Wesley Fofana Yellow Card",
  },
  {
    id: "goal-2",
    videoAt: 61.916666666666664,
    gameElapsed: 1070,
    scoreHome: 0,
    scoreAway: 1,
    periodLabel: "1st Half",
    kind: "score",
    description: "Nicolas Jackson Goal",
  },
  {
    id: "key-3",
    videoAt: 90.375,
    gameElapsed: 1297,
    scoreHome: 0,
    scoreAway: 1,
    periodLabel: "1st Half",
    kind: "key_play",
    description: "Fabian Schar Yellow Card",
  },
  {
    id: "goal-4",
    videoAt: 118.83333333333333,
    gameElapsed: 1872,
    scoreHome: 1,
    scoreAway: 1,
    periodLabel: "1st Half",
    kind: "score",
    description: "Alexander Isak Goal - Volley",
  },
  {
    id: "goal-7",
    videoAt: 204.20833333333334,
    gameElapsed: 2775,
    scoreHome: 1,
    scoreAway: 2,
    periodLabel: "2nd Half",
    kind: "score",
    description: "Cole Palmer Goal",
  },
  {
    id: "key-8",
    videoAt: 232.66666666666666,
    gameElapsed: 3219,
    scoreHome: 1,
    scoreAway: 2,
    periodLabel: "2nd Half",
    kind: "key_play",
    description: "Romeo Lavia Yellow Card",
  },
  {
    id: "key-9",
    videoAt: 261.125,
    gameElapsed: 3798,
    scoreHome: 1,
    scoreAway: 2,
    periodLabel: "2nd Half",
    kind: "key_play",
    description: "Sandro Tonali Yellow Card",
  },
  {
    id: "key-10",
    videoAt: 289.58333333333337,
    gameElapsed: 3897,
    scoreHome: 1,
    scoreAway: 2,
    periodLabel: "2nd Half",
    kind: "key_play",
    description: "Noni Madueke Yellow Card",
  },
  {
    id: "key-18",
    videoAt: 517.25,
    gameElapsed: 5003,
    scoreHome: 1,
    scoreAway: 2,
    periodLabel: "2nd Half",
    kind: "key_play",
    description: "Robert Sanchez Yellow Card",
  },
  {
    id: "key-19",
    videoAt: 545.7083333333333,
    gameElapsed: 5238,
    scoreHome: 1,
    scoreAway: 2,
    periodLabel: "2nd Half",
    kind: "key_play",
    description: "Pedro Neto Yellow Card",
  },
  {
    id: "key-22",
    videoAt: 631.0833333333333,
    gameElapsed: 5355,
    scoreHome: 1,
    scoreAway: 2,
    periodLabel: "2nd Half",
    kind: "key_play",
    description: "Sean Longstaff Yellow Card",
  },
  {
    id: "key-23",
    videoAt: 688,
    gameElapsed: 5400,
    scoreHome: 1,
    scoreAway: 2,
    periodLabel: "2nd Half",
    kind: "key_play",
    description: "Christopher Nkunku Yellow Card",
  },
];

const CHELSEA_NEWCASTLE_CONTEXT: GameBroadcastContext = {
  matchup: "Newcastle United at Chelsea",
  awayTeam: "Newcastle United",
  homeTeam: "Chelsea",
  venue: "Stamford Bridge in London",
  facts: [
    "Venue: Stamford Bridge in London.",
    "Chelsea Total Shots leader: Pedro Neto (5).",
    "Chelsea Saves leader: Wesley Fofana (2).",
    "Newcastle United Total Shots leader: Alexander Isak (3).",
    "Newcastle United Saves leader: Nick Pope (5).",
    "Chelsea held 50.4 possession to Newcastle United's 49.6.",
    "Shots on target: Chelsea 7, Newcastle United 3.",
    "These sides met recently - Chelsea won 3-2 in 2023-24 English Premier League.",
  ],
  narrative:
    "Stamford Bridge gets a Premier League highlight reel with Chelsea and Newcastle trading goals, cards, and momentum.",
};

const CHELSEA_NEWCASTLE_LINES: Record<string, string> = {
  opening:
    "Good evening from Stamford Bridge, where Chelsea and Newcastle are ready to tear into a Premier League showcase. Settle in, because this one has pace, bite, and plenty of edge.",
  "key-1":
    "Wesley Fofana goes into the book early, and that is a little warning flare for Chelsea's back line. Newcastle will know there is pressure to test him now.",
  "goal-2":
    "Nicolas Jackson breaks it open for Chelsea! The Blues strike first at the Bridge, and that finish gives this crowd exactly the jolt it came for.",
  "key-3":
    "Fabian Schar sees yellow, and the temperature is climbing now. Newcastle cannot let the emotion of this first half start making decisions for them.",
  "goal-4":
    "Alexander Isak answers with a volley! What a hit from Newcastle's number nine, and just like that this match is level again at one apiece.",
  "goal-7":
    "Cole Palmer restores Chelsea's lead! Cool as you like in the second half, and Stamford Bridge erupts as the Blues move back in front.",
  "key-8":
    "Romeo Lavia is booked, and Chelsea have to manage this spell carefully. Newcastle are chasing the game, and every loose challenge gives them another invitation.",
  "key-9":
    "Sandro Tonali picks up yellow for Newcastle, and that is another flashpoint in a match full of them. The midfield battle is starting to leave marks.",
  "key-10":
    "Noni Madueke is shown yellow, and Chelsea are walking a thin line now. They have the lead, but they cannot let this become a card-counting contest.",
  "key-18":
    "Robert Sanchez goes into the referee's notebook late on, and that tells you how tense this finish has become. Chelsea are trying to protect every second.",
  "key-19":
    "Pedro Neto is booked as well, and the closing stages are getting scrappy. Newcastle still believe there is one more chance hiding in this match.",
  "key-22":
    "Sean Longstaff sees yellow for Newcastle, and frustration is starting to spill over. Time is running away, and Chelsea can feel the finish line.",
  "key-23":
    "Christopher Nkunku gets a late yellow, one more spark in a fiery finish. Chelsea are almost there, but Newcastle are making them earn every whistle.",
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
  "chelsea-newcastle": {
    events: CHELSEA_NEWCASTLE_EVENTS,
    gameContext: CHELSEA_NEWCASTLE_CONTEXT,
    commentary: buildCommentary(CHELSEA_NEWCASTLE_EVENTS, CHELSEA_NEWCASTLE_LINES),
  },
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
