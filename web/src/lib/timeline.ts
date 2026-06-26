import { extractGameContext, type GameBroadcastContext } from "@/lib/game-context";
import { applyVideoSync, type VideoSyncMode } from "@/lib/timeline-sync";

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

function parseFootballClock(period: number, clockDisplay: string): number {
  const parts = clockDisplay.trim().split(":");
  const minutes = Number.parseInt(parts[0] ?? "0", 10);
  const seconds = Number.parseInt(parts[1] ?? "0", 10);
  const remaining = minutes * 60 + seconds;
  const elapsedInQuarter = FOOTBALL_QUARTER_SECONDS - remaining;
  return (period - 1) * FOOTBALL_QUARTER_SECONDS + Math.max(elapsedInQuarter, 0);
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildTimeline(
  payload: any,
  sport: string,
  videoDuration: number,
  videoMode: VideoSyncMode = "highlights",
): { events: TimelineEvent[]; gameContext: GameBroadcastContext; videoMode: VideoSyncMode } {
  const gameContext = extractGameContext(payload, sport);
  const rawEvents =
    sport === "soccer"
      ? buildSoccerTimeline(payload, gameContext)
      : buildFootballTimeline(payload, gameContext);

  const events = applyVideoSync(
    rawEvents,
    videoDuration,
    sport,
    videoMode,
    gameContext.facts,
  );

  return { events, gameContext, videoMode };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildFootballTimeline(payload: any, gameContext: GameBroadcastContext): TimelineEvent[] {
  const scoringPlays = payload.scoringPlays ?? [];
  const drives = payload.drives?.previous ?? [];

  const events: TimelineEvent[] = [
    {
      id: "opening",
      videoAt: 0,
      gameElapsed: 0,
      scoreHome: 0,
      scoreAway: 0,
      description: `Opening kickoff — ${gameContext.matchup}.`,
      periodLabel: "1st Quarter",
      kind: "opening",
      context: gameContext.narrative,
    },
  ];

  scoringPlays.forEach((play: Record<string, unknown>, index: number) => {
    const period = (play.period as { number?: number })?.number ?? 1;
    const clock = (play.clock as { displayValue?: string })?.displayValue ?? "15:00";
    events.push({
      id: `score-${index}`,
      videoAt: 0,
      gameElapsed: parseFootballClock(period, clock),
      scoreHome: Number(play.homeScore ?? 0),
      scoreAway: Number(play.awayScore ?? 0),
      description: String(play.text ?? "Scoring play").trim(),
      periodLabel: footballPeriodLabel(period),
      kind: "score",
    });
  });

  for (const [index, drive] of drives.entries()) {
    if (drive.isScore) continue;
    const result = String(drive.displayResult ?? drive.result ?? "");
    const yards = Number(drive.yards ?? 0);
    const isTurnover = /interception|fumble/i.test(result);
    if (!isTurnover && yards < 45) continue;

    const period = drive.start?.period?.number ?? 1;
    const clock = drive.start?.clock?.displayValue ?? "15:00";
    const elapsed = parseFootballClock(period, clock);
    const team = drive.team?.displayName ?? drive.team ?? "Offense";
    const scores = runningScoreAtElapsed(events, elapsed);

    events.push({
      id: `drive-${index}`,
      videoAt: 0,
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
      videoAt: 0,
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

  return events.sort((a, b) => a.gameElapsed - b.gameElapsed);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildSoccerTimeline(payload: any, gameContext: GameBroadcastContext): TimelineEvent[] {
  const keyEvents = payload.keyEvents ?? [];

  const events: TimelineEvent[] = [
    {
      id: "opening",
      videoAt: 0,
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
        videoAt: 0,
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
        videoAt: 0,
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
        videoAt: 0,
        gameElapsed: elapsed,
        scoreHome,
        scoreAway,
        description: text,
        periodLabel,
        kind: "key_play",
      });
    }
  }

  return events.sort((a, b) => a.gameElapsed - b.gameElapsed);
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
export type { VideoSyncMode } from "@/lib/timeline-sync";
