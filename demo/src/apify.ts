import { ApifyClient } from "apify-client";

const BET365_ACTOR =
  process.env.APIFY_BET365_ACTOR?.trim() || "zen-studio/bet365-sports-data";

const DEFAULT_FOOTBALL_COMPETITIONS =
  "premier-league,champions-league,la-liga,bundesliga,serie-a,ligue-1,mls,europa-league";

const LIVE_STATUSES = new Set([
  "live",
  "inprogress",
  "in progress",
  "halftime",
  "1st half",
  "2nd half",
  "extra time",
  "penalties",
  "break",
]);

export interface LiveMatch {
  matchId: string;
  sourceUrl?: string;
  homeTeamName: string;
  awayTeamName: string;
  homeScore?: number;
  awayScore?: number;
  status?: string;
  statusCategory?: string;
  competitionName?: string;
  commentaryAvailable?: boolean;
  commentaryLineCount?: number;
  eventsAvailable?: boolean;
  eventsLineCount?: number;
}

export type EventCategory =
  | "goal"
  | "card"
  | "substitution"
  | "penalty"
  | "offside"
  | "other";

export interface CommentaryLine {
  dedupeKey: string;
  text: string;
  timestamp: string;
  minute?: string;
  sortKey: number;
  eventType?: string;
  eventCategory?: EventCategory;
}

interface MatchContext {
  homeTeam?: string;
  awayTeam?: string;
  homeScore?: number;
  awayScore?: number;
}

export class ApifyQuotaError extends Error {
  readonly upgradeUrl = "https://console.apify.com/billing/subscription";

  constructor(message: string) {
    super(message);
    this.name = "ApifyQuotaError";
  }
}

export function isApifyQuotaError(error: unknown): boolean {
  if (error instanceof ApifyQuotaError) return true;
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("Free plan allows") || message.includes("used all 5");
}

export function isApifyConfigured(): boolean {
  return Boolean(process.env.APIFY_TOKEN?.trim());
}

export function getApifyActorId(): string {
  return BET365_ACTOR;
}

export function getApifyToken(): string {
  const token = process.env.APIFY_TOKEN?.trim();
  if (!token) {
    throw new Error(
      "APIFY_TOKEN is missing. Add it to .env from https://console.apify.com/account/integrations",
    );
  }
  return token;
}

function createApifyClient(): ApifyClient {
  return new ApifyClient({ token: getApifyToken() });
}

function footballCompetitions(): string {
  return process.env.APIFY_FOOTBALL_COMPETITIONS?.trim() || DEFAULT_FOOTBALL_COMPETITIONS;
}

async function runBet365Actor(
  input: Record<string, unknown>,
): Promise<Record<string, unknown>[]> {
  const client = createApifyClient();
  const run = await client.actor(BET365_ACTOR).call(input);
  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  const records = items as Record<string, unknown>[];

  const warningItem = records.find((item) => typeof item._warning === "string");
  const planWarning =
    asString(warningItem?._warning) ??
    (run.statusMessage?.includes("Free plan") ? run.statusMessage : undefined);
  const dataItems = records.filter((item) => !item._warning);

  if (planWarning && dataItems.length === 0) {
    throw new ApifyQuotaError(
      `${planWarning} Upgrade at https://console.apify.com/billing/subscription`,
    );
  }

  return dataItems;
}

function asString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && !Number.isNaN(value)) return String(value);
  return undefined;
}

function isLiveGame(item: Record<string, unknown>): boolean {
  const status = asString(item.status)?.toLowerCase() ?? "";
  if (LIVE_STATUSES.has(status)) return true;

  const minute = item.minute;
  const progress = item.progress;
  if (
    typeof minute === "number" &&
    minute > 0 &&
    minute < 100 &&
    status !== "finished" &&
    status !== "notstarted" &&
    status !== "not started"
  ) {
    return true;
  }

  if (
    typeof progress === "number" &&
    progress > 0 &&
    progress < 100 &&
    status !== "finished" &&
    status !== "notstarted" &&
    status !== "not started"
  ) {
    return true;
  }

  return false;
}

function liveMatchSortKey(item: Record<string, unknown>): number {
  if (isLiveGame(item)) return 0;
  const status = asString(item.status)?.toLowerCase() ?? "";
  if (status === "notstarted" || status === "not started") return 2;
  return 1;
}

function mapScoreItem(item: Record<string, unknown>): LiveMatch | undefined {
  const gameId = asString(item.gameId);
  if (!gameId) return undefined;

  return {
    matchId: gameId,
    sourceUrl: asString(item.webUrl),
    homeTeamName: asString(item.homeTeam) ?? "Home",
    awayTeamName: asString(item.awayTeam) ?? "Away",
    homeScore: typeof item.homeScore === "number" ? item.homeScore : undefined,
    awayScore: typeof item.awayScore === "number" ? item.awayScore : undefined,
    status: asString(item.status),
    statusCategory: asString(item.minuteDisplay) ?? asString(item.minute),
    competitionName: asString(item.competition),
  };
}

export async function fetchLiveFootballMatches(): Promise<LiveMatch[]> {
  const items = await runBet365Actor({
    action: "scores",
    competitionIds: footballCompetitions(),
    maxResults: 60,
  });

  const matches = items
    .map(mapScoreItem)
    .filter((match): match is LiveMatch => Boolean(match))
    .sort((a, b) => {
      const itemA = items.find((item) => asString(item.gameId) === a.matchId);
      const itemB = items.find((item) => asString(item.gameId) === b.matchId);
      const rankA = itemA ? liveMatchSortKey(itemA) : 1;
      const rankB = itemB ? liveMatchSortKey(itemB) : 1;
      if (rankA !== rankB) return rankA - rankB;
      return a.homeTeamName.localeCompare(b.homeTeamName);
    });

  const liveOnly = matches.filter((match) => {
    const item = items.find((entry) => asString(entry.gameId) === match.matchId);
    return item ? isLiveGame(item) : false;
  });

  const result = liveOnly.length > 0 ? liveOnly : matches.slice(0, 20);
  if (result.length === 0) {
    throw new Error(
      "No football matches returned from Bet365. Try again later or enter a game ID below (e.g. 4679449).",
    );
  }

  return result;
}

export function formatBet365Clock(record: Record<string, unknown>): string {
  const minute = record.minute;
  const added = record.addedTime;

  if (typeof minute === "number") {
    if (typeof added === "number" && added > 0) {
      return `${String(minute).padStart(2, "0")}+${String(added).padStart(2, "0")}`;
    }
    return `${String(minute).padStart(2, "0")}:00`;
  }

  const display = asString(record.minuteDisplay);
  if (display) return display.replace("'", "");

  return "00:00";
}

function bet365SortKey(record: Record<string, unknown>, index: number): number {
  const minute = typeof record.minute === "number" ? record.minute : 0;
  const added = typeof record.addedTime === "number" ? record.addedTime : 0;
  return minute * 10_000 + added * 100 + index;
}

function buildCommentaryText(body: string, timestamp: string): string {
  if (body.startsWith(`${timestamp} —`) || body.startsWith(`${timestamp} -`)) {
    return body;
  }
  return `${timestamp} — ${body}`;
}

function categorizeEvent(eventType: string, subType?: string): EventCategory {
  const normalized = `${eventType} ${subType ?? ""}`.toLowerCase();
  if (normalized.includes("goal")) return "goal";
  if (normalized.includes("card")) return "card";
  if (normalized.includes("substitution") || normalized.includes("sub")) return "substitution";
  if (normalized.includes("penalty")) return "penalty";
  if (normalized.includes("offside")) return "offside";
  return "other";
}

function resolveTeamName(
  teamKey: string | undefined,
  context: MatchContext,
): string | undefined {
  if (teamKey === "home") return context.homeTeam;
  if (teamKey === "away") return context.awayTeam;
  return undefined;
}

function formatBet365EventBody(
  record: Record<string, unknown>,
  context: MatchContext,
  runningScore: { home: number; away: number },
): { body: string; eventType: string; eventCategory: EventCategory } | undefined {
  const type = asString(record.type);
  if (!type) return undefined;

  const subType = asString(record.subType);
  const player = asString(record.player);
  const teamKey = asString(record.team);
  const teamName = resolveTeamName(teamKey, context);
  const assists = Array.isArray(record.assistPlayers)
    ? record.assistPlayers.map(asString).filter(Boolean)
    : [];
  const eventType = subType ? `${type} (${subType})` : type;
  const eventCategory = categorizeEvent(type, subType);

  let body: string | undefined;

  if (type === "Goal") {
    if (subType?.toLowerCase().includes("own")) {
      body = player ? `Own goal by ${player}` : "Own goal";
    } else if (subType?.toLowerCase().includes("penalty")) {
      body = player ? `Penalty! ${player} converts` : "Penalty scored";
    } else {
      body = player ? `Goal! ${player} scores` : "Goal!";
    }

    if (assists.length > 0) {
      body += `, assisted by ${assists.join(" and ")}`;
    }

    if (teamKey === "home") runningScore.home += 1;
    if (teamKey === "away") runningScore.away += 1;
    body += ` — Score ${runningScore.home}-${runningScore.away}`;
  } else if (type === "Card") {
    const cardKind = subType?.toLowerCase() ?? "";
    if (cardKind.includes("red") && cardKind.includes("second")) {
      body = player ? `Second yellow for ${player} — sent off` : "Second yellow card";
    } else if (cardKind.includes("red")) {
      body = player ? `Red card for ${player}` : "Red card";
    } else {
      body = player ? `Yellow card for ${player}` : "Yellow card";
    }
  } else if (type === "Substitution") {
    body = player ? `Substitution — ${player}` : "Substitution";
  } else if (type.toLowerCase().includes("offside")) {
    body = player ? `Offside — ${player}` : "Offside";
  } else if (type.toLowerCase().includes("var")) {
    body = player ? `VAR check — ${player}` : "VAR decision";
  } else {
    body = player
      ? `${eventType} — ${player}`
      : subType
        ? `${type} — ${subType}`
        : type;
  }

  if (teamName && !body.startsWith(`${teamName}:`)) {
    body = `${teamName}: ${body}`;
  }

  return { body, eventType, eventCategory };
}

function buildMatchContext(detail: Record<string, unknown>): MatchContext {
  return {
    homeTeam: asString(detail.homeTeam),
    awayTeam: asString(detail.awayTeam),
    homeScore: typeof detail.homeScore === "number" ? detail.homeScore : undefined,
    awayScore: typeof detail.awayScore === "number" ? detail.awayScore : undefined,
  };
}

export function extractBet365CommentaryLines(
  detail: Record<string, unknown>,
): CommentaryLine[] {
  const context = buildMatchContext(detail);
  const events = Array.isArray(detail.events) ? detail.events : [];
  const runningScore = { home: 0, away: 0 };
  const lines: CommentaryLine[] = [];

  for (let index = 0; index < events.length; index++) {
    const record = events[index] as Record<string, unknown>;
    const formatted = formatBet365EventBody(record, context, runningScore);
    if (!formatted) continue;

    const timestamp = formatBet365Clock(record);
    const minute =
      typeof record.minute === "number"
        ? String(record.minute)
        : asString(record.minuteDisplay)?.replace("'", "");

    lines.push({
      dedupeKey: `bet365:${asString(detail.gameId)}:${index}:${formatted.eventType}:${timestamp}:${formatted.body}`,
      timestamp,
      minute,
      sortKey: bet365SortKey(record, index),
      text: buildCommentaryText(formatted.body, timestamp),
      eventType: formatted.eventType,
      eventCategory: formatted.eventCategory,
    });
  }

  return lines.sort(
    (a, b) => a.sortKey - b.sortKey || a.timestamp.localeCompare(b.timestamp),
  );
}

function resolveGameId(matchUrl?: string, matchId?: string): string {
  if (matchId?.trim()) return matchId.trim();

  if (matchUrl?.trim()) {
    const numeric = matchUrl.match(/(\d{5,})/);
    if (numeric?.[1]) return numeric[1];
  }

  throw new Error("Provide matchId (Bet365 gameId) or matchUrl");
}

export async function fetchMatchDetail(
  matchUrl?: string,
  matchId?: string,
): Promise<Record<string, unknown>> {
  const gameId = resolveGameId(matchUrl, matchId);
  const items = await runBet365Actor({
    action: "gameDetail",
    gameIds: [gameId],
  });

  const detail = items[0];
  if (!detail) {
    throw new Error(`No game detail returned for gameId ${gameId}`);
  }

  return detail;
}

export async function fetchCommentaryLines(
  matchUrl?: string,
  matchId?: string,
): Promise<{ matchUrl: string; lines: CommentaryLine[]; dataNote?: string }> {
  const gameId = resolveGameId(matchUrl, matchId);
  const detail = await fetchMatchDetail(matchUrl, matchId);
  const lines = extractBet365CommentaryLines(detail);

  const matchLabel = `${asString(detail.homeTeam) ?? "Home"} vs ${asString(detail.awayTeam) ?? "Away"}`;
  const webUrl = asString(detail.webUrl);
  const resolvedUrl = webUrl ?? matchUrl ?? `bet365://game/${gameId}`;

  let dataNote: string | undefined;
  if (lines.length === 0) {
    dataNote = `No timeline events found for ${matchLabel} yet. Try again during or after the match.`;
  } else {
    const eventTypes = [...new Set(lines.map((line) => line.eventType).filter(Boolean))];
    dataNote = `Bet365 timeline: ${lines.length} events (${eventTypes.join(", ")}). Each line includes match timestamp for TTS.`;
  }

  return { matchUrl: resolvedUrl, lines, dataNote };
}
