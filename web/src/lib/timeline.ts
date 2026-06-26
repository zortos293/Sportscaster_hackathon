import { extractGameContext, type GameBroadcastContext } from "@/lib/game-context";

export type TimelineEventKind =
  | "opening"
  | "score"
  | "key_play"
  | "period"
  | "stat_spotlight"
  | "color";

export type TimelineEvent = {
  id: string;
  videoAt: number;
  gameElapsed: number;
  scoreHome: number;
  scoreAway: number;
  description: string;
  periodLabel: string;
  kind: TimelineEventKind;
  context?: string;
};

const FOOTBALL_QUARTER_SECONDS = 15 * 60;
const SOCCER_MATCH_SECONDS = 90 * 60;
const MIN_VIDEO_GAP_SECONDS = 14;
const MAX_FILLERS_PER_GAP = 2;

function parseFootballClock(period: number, clockDisplay: string): number {
  const parts = clockDisplay.trim().split(":");
  const minutes = Number.parseInt(parts[0] ?? "0", 10);
  const seconds = Number.parseInt(parts[1] ?? "0", 10);
  const remaining = minutes * 60 + seconds;
  const elapsedInQuarter = FOOTBALL_QUARTER_SECONDS - remaining;
  return (period - 1) * FOOTBALL_QUARTER_SECONDS + Math.max(elapsedInQuarter, 0);
}

function mapGameTimeToVideo(
  gameElapsed: number,
  maxGameElapsed: number,
  videoDuration: number,
): number {
  const introSeconds = 8;
  const outroSeconds = 12;
  const usable = Math.max(videoDuration - introSeconds - outroSeconds, 1);
  const ratio = Math.min(Math.max(gameElapsed / Math.max(maxGameElapsed, 1), 0), 1);
  return introSeconds + ratio * usable;
}

function parseScoreFromGoalText(text: string): { home: number; away: number } {
  const match = /(\d+)\s*,\s*.*?(\d+)/.exec(text);
  if (match) {
    return { away: Number.parseInt(match[1] ?? "0", 10), home: Number.parseInt(match[2] ?? "0", 10) };
  }
  return { home: 0, away: 0 };
}

function footballPeriodLabel(period: number): string {
  if (period === 1) return "1st Quarter";
  if (period === 2) return "2nd Quarter";
  if (period === 3) return "3rd Quarter";
  if (period === 4) return "4th Quarter";
  return `Q${period}`;
}

function soccerPeriodLabel(period: number): string {
  return period === 1 ? "1st Half" : "2nd Half";
}

function runningScoreAtElapsed(
  events: Array<{ gameElapsed: number; scoreHome: number; scoreAway: number }>,
  elapsed: number,
): { scoreHome: number; scoreAway: number } {
  let scoreHome = 0;
  let scoreAway = 0;
  for (const event of events) {
    if (event.gameElapsed <= elapsed) {
      scoreHome = event.scoreHome;
      scoreAway = event.scoreAway;
    }
  }
  return { scoreHome, scoreAway };
}

function insertGapFillers(
  events: TimelineEvent[],
  videoDuration: number,
  facts: string[],
): TimelineEvent[] {
  const sorted = [...events].sort((a, b) => a.videoAt - b.videoAt);
  const result: TimelineEvent[] = [];
  let factIndex = 0;

  for (let i = 0; i < sorted.length; i += 1) {
    const current = sorted[i];
    result.push(current);

    const next = sorted[i + 1];
    const gapStart = current.videoAt;
    const gapEnd = next?.videoAt ?? Math.max(videoDuration - 8, gapStart + MIN_VIDEO_GAP_SECONDS);
    const gap = gapEnd - gapStart;

    if (gap < MIN_VIDEO_GAP_SECONDS) continue;

    const fillerCount = Math.min(MAX_FILLERS_PER_GAP, Math.floor(gap / MIN_VIDEO_GAP_SECONDS) - 1);
    for (let j = 1; j <= fillerCount; j += 1) {
      const videoAt = gapStart + (gap * j) / (fillerCount + 1);
      const fact = facts[factIndex % facts.length] ?? "Keep the energy up between plays.";
      factIndex += 1;
      const kind: TimelineEventKind = j % 2 === 0 ? "stat_spotlight" : "color";

      result.push({
        id: `${kind}-${Math.round(videoAt * 10)}-${factIndex}`,
        videoAt,
        gameElapsed: current.gameElapsed,
        scoreHome: current.scoreHome,
        scoreAway: current.scoreAway,
        periodLabel: current.periodLabel,
        kind,
        description:
          kind === "stat_spotlight"
            ? `Stat spotlight — ${fact}`
            : "Between-the-whistles banter — keep the booth alive.",
        context: fact,
      });
    }
  }

  return result.sort((a, b) => a.videoAt - b.videoAt);
}

function injectStatSpotlights(events: TimelineEvent[], facts: string[]): TimelineEvent[] {
  if (facts.length === 0) return events;

  const scoreEvents = events.filter((e) => e.kind === "score");
  const result = [...events];
  let factIndex = 0;

  for (let i = 0; i < scoreEvents.length - 1; i += 1) {
    const current = scoreEvents[i];
    const next = scoreEvents[i + 1];
    const midpoint =
      current.videoAt + (next.videoAt - current.videoAt) / 2;

    if (next.videoAt - current.videoAt < 20) continue;

    const fact = facts[factIndex % facts.length];
    factIndex += 1;
    result.push({
      id: `stat-mid-${i}`,
      videoAt: midpoint,
      gameElapsed: (current.gameElapsed + next.gameElapsed) / 2,
      scoreHome: current.scoreHome,
      scoreAway: current.scoreAway,
      periodLabel: current.periodLabel,
      kind: "stat_spotlight",
      description: `Stat spotlight — ${fact}`,
      context: fact,
    });
  }

  return result.sort((a, b) => a.videoAt - b.videoAt);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildTimeline(
  payload: any,
  sport: string,
  videoDuration: number,
): { events: TimelineEvent[]; gameContext: GameBroadcastContext } {
  const gameContext = extractGameContext(payload, sport);
  const events =
    sport === "soccer"
      ? buildSoccerTimeline(payload, videoDuration, gameContext)
      : buildFootballTimeline(payload, videoDuration, gameContext);

  const withStats = injectStatSpotlights(events, gameContext.facts);
  const filled = insertGapFillers(withStats, videoDuration, gameContext.facts);

  return { events: filled, gameContext };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildFootballTimeline(
  payload: any,
  videoDuration: number,
  gameContext: GameBroadcastContext,
): TimelineEvent[] {
  const scoringPlays = payload.scoringPlays ?? [];
  const drives = payload.drives?.previous ?? [];
  const rawScoreEvents: Array<{ elapsed: number; play: Record<string, unknown> }> = [];

  for (const play of scoringPlays) {
    const period = play.period?.number ?? 1;
    const clock = play.clock?.displayValue ?? "15:00";
    rawScoreEvents.push({ elapsed: parseFootballClock(period, clock), play });
  }

  const maxElapsed = Math.max(
    ...rawScoreEvents.map((item) => item.elapsed),
    ...drives.map((d: { start?: { period?: { number?: number }; clock?: { displayValue?: string } } }) => {
      const period = d.start?.period?.number ?? 1;
      const clock = d.start?.clock?.displayValue ?? "15:00";
      return parseFootballClock(period, clock);
    }),
    FOOTBALL_QUARTER_SECONDS * 4,
  );

  const events: TimelineEvent[] = [
    {
      id: "opening",
      videoAt: 3,
      gameElapsed: 0,
      scoreHome: 0,
      scoreAway: 0,
      description: `Opening kickoff — ${gameContext.matchup}.`,
      periodLabel: "1st Quarter",
      kind: "opening",
      context: gameContext.narrative,
    },
  ];

  rawScoreEvents.forEach((item, index) => {
    const period = (item.play.period as { number?: number })?.number ?? 1;
    events.push({
      id: `score-${index}`,
      videoAt: mapGameTimeToVideo(item.elapsed, maxElapsed, videoDuration),
      gameElapsed: item.elapsed,
      scoreHome: Number(item.play.homeScore ?? 0),
      scoreAway: Number(item.play.awayScore ?? 0),
      description: String(item.play.text ?? "Scoring play").trim(),
      periodLabel: footballPeriodLabel(period),
      kind: "score",
    });
  });

  for (const [index, drive] of drives.entries()) {
    if (drive.isScore) continue;
    const result = String(drive.displayResult ?? drive.result ?? "");
    const yards = Number(drive.yards ?? 0);
    const isTurnover = /interception|fumble/i.test(result);
    const isLongDrive = yards >= 45;
    if (!isTurnover && !isLongDrive) continue;

    const period = drive.start?.period?.number ?? 1;
    const clock = drive.start?.clock?.displayValue ?? "15:00";
    const elapsed = parseFootballClock(period, clock);
    const team = drive.team?.displayName ?? drive.team ?? "Offense";
    const scores = runningScoreAtElapsed(events, elapsed);

    events.push({
      id: `drive-${index}`,
      videoAt: mapGameTimeToVideo(elapsed, maxElapsed, videoDuration),
      gameElapsed: elapsed,
      scoreHome: scores.scoreHome,
      scoreAway: scores.scoreAway,
      description: isTurnover
        ? `${team} drive ends in a ${result.toLowerCase()} — ${drive.description ?? ""}`.trim()
        : `${team} grinds out a ${yards}-yard drive: ${drive.description ?? result}.`,
      periodLabel: footballPeriodLabel(period),
      kind: "key_play",
      context: `${team} ${result}, ${drive.offensivePlays ?? "?"} plays for ${yards} yards.`,
    });
  }

  for (const quarter of [2, 3, 4]) {
    const elapsed = (quarter - 1) * FOOTBALL_QUARTER_SECONDS;
    const scores = runningScoreAtElapsed(events, elapsed);
    events.push({
      id: `period-q${quarter}`,
      videoAt: mapGameTimeToVideo(elapsed, maxElapsed, videoDuration),
      gameElapsed: elapsed,
      scoreHome: scores.scoreHome,
      scoreAway: scores.scoreAway,
      description:
        quarter === 3
          ? "Halftime — second-half storylines and adjustments."
          : `${footballPeriodLabel(quarter)} underway.`,
      periodLabel: footballPeriodLabel(quarter),
      kind: "period",
      context: `Score at ${footballPeriodLabel(quarter).toLowerCase()}: ${scores.scoreAway}-${scores.scoreHome}.`,
    });
  }

  return events.sort((a, b) => a.videoAt - b.videoAt);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildSoccerTimeline(
  payload: any,
  videoDuration: number,
  gameContext: GameBroadcastContext,
): TimelineEvent[] {
  const keyEvents = payload.keyEvents ?? [];
  const maxElapsed = Math.max(
    ...keyEvents.map((e: { clock?: { value?: number } }) => Number(e.clock?.value ?? 0)),
    SOCCER_MATCH_SECONDS,
  );

  const events: TimelineEvent[] = [
    {
      id: "opening",
      videoAt: 3,
      gameElapsed: 0,
      scoreHome: 0,
      scoreAway: 0,
      description: `Kickoff — ${gameContext.matchup}.`,
      periodLabel: "1st Half",
      kind: "opening",
      context: gameContext.narrative,
    },
  ];

  let scoreHome = 0;
  let scoreAway = 0;

  for (const [index, play] of keyEvents.entries()) {
    const type = play.type?.type ?? "";
    const elapsed = Number(play.clock?.value ?? 0);
    const period = play.period?.number ?? (elapsed >= 2700 ? 2 : 1);
    const periodLabel = soccerPeriodLabel(period);
    const text = String(play.shortText ?? play.text ?? "").trim();

    if (type === "kickoff" && index === 0) continue;

    if (play.scoringPlay && type.startsWith("goal")) {
      const scores = parseScoreFromGoalText(String(play.text ?? ""));
      scoreHome = scores.home;
      scoreAway = scores.away;
      events.push({
        id: `goal-${index}`,
        videoAt: mapGameTimeToVideo(elapsed, maxElapsed, videoDuration),
        gameElapsed: elapsed,
        scoreHome,
        scoreAway,
        description: text || "Goal!",
        periodLabel,
        kind: "score",
      });
      continue;
    }

    if (type === "halftime" || type === "start-2nd-half" || type === "end-regular-time") {
      events.push({
        id: `${type}-${index}`,
        videoAt: mapGameTimeToVideo(elapsed, maxElapsed, videoDuration),
        gameElapsed: elapsed,
        scoreHome,
        scoreAway,
        description: text || type.replaceAll("-", " "),
        periodLabel: type === "start-2nd-half" ? "2nd Half" : periodLabel,
        kind: "period",
        context: `Score ${scoreAway}-${scoreHome}.`,
      });
      continue;
    }

    if (
      type.includes("card") ||
      type === "substitution" ||
      type.includes("penalty") ||
      type.includes("var")
    ) {
      if (!text) continue;
      events.push({
        id: `key-${index}`,
        videoAt: mapGameTimeToVideo(elapsed, maxElapsed, videoDuration),
        gameElapsed: elapsed,
        scoreHome,
        scoreAway,
        description: text,
        periodLabel,
        kind: "key_play",
      });
    }
  }

  return events.sort((a, b) => a.videoAt - b.videoAt);
}

export async function fetchEspnSummary(sport: string, league: string, eventId: string) {
  const url = espnSummaryUrl(sport, league, eventId);
  const response = await fetch(url, { next: { revalidate: 3600 } });
  if (!response.ok) {
    throw new Error("Failed to fetch ESPN summary");
  }
  return response.json();
}

export function espnSummaryUrl(sport: string, league: string, eventId: string): string {
  return `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/summary?event=${eventId}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractEspnDebugSummary(payload: any, sport: string) {
  const header = payload.header
    ? {
        id: payload.header.id,
        name: payload.header.competitions?.[0]?.name ?? payload.header.name,
        shortName: payload.header.shortName,
        season: payload.header.season,
        competitions: payload.header.competitions?.map(
          (comp: {
            id?: string;
            date?: string;
            status?: { type?: { description?: string; state?: string } };
            competitors?: Array<{
              homeAway?: string;
              team?: { displayName?: string; abbreviation?: string };
              score?: string;
            }>;
          }) => ({
            id: comp.id,
            date: comp.date,
            status: comp.status,
            competitors: comp.competitors?.map((c) => ({
              homeAway: c.homeAway,
              team: c.team,
              score: c.score,
            })),
          }),
        ),
      }
    : undefined;

  if (sport === "soccer") {
    return {
      header,
      keyEvents: payload.keyEvents ?? [],
      scoringPlays: (payload.keyEvents ?? []).filter(
        (event: { scoringPlay?: boolean }) => event.scoringPlay,
      ),
    };
  }

  return {
    header,
    scoringPlays: payload.scoringPlays ?? [],
    keyEvents: payload.keyEvents ?? [],
    drives: payload.drives?.previous?.length ?? 0,
  };
}

export { templateCommentary } from "@/lib/commentary-prompts";
export type { GameBroadcastContext } from "@/lib/game-context";
