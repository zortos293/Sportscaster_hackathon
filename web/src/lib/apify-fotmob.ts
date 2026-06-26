import type { EventCategory, LiveMatch, LiveScoreLine } from "@/lib/livescore";
import { isMajorTimelineLine } from "@/lib/match-event-filter";
import { asString, runApifyActor } from "@/lib/apify-shared";

const FOTMOB_ACTOR =
  process.env.APIFY_FOTMOB_ACTOR?.trim() || "incognito_mode/fotmob-match-details-scraper";

type FotMobTeam = {
  id?: number;
  name?: string;
  score?: number;
};

type FotMobEvent = {
  type?: string;
  minute?: number;
  minuteLabel?: number | string;
  isHome?: boolean;
  playerId?: number;
  playerName?: string;
  homeScore?: number;
  awayScore?: number;
  card?: string;
  goalType?: string;
  assist?: string;
  playersInvolved?: string[];
};

export function parseFotMobEventMinute(event: FotMobEvent): number {
  const label =
    typeof event.minuteLabel === "number"
      ? String(event.minuteLabel)
      : typeof event.minuteLabel === "string"
        ? event.minuteLabel.trim()
        : "";

  if (label) {
    const stoppage = label.match(/^(\d{1,3})\s*\+\s*(\d{1,2})'?$/);
    if (stoppage) {
      return (Number.parseInt(stoppage[1]!, 10) + Number.parseInt(stoppage[2]!, 10)) * 60;
    }
    const mmss = label.match(/^(\d{1,3}):(\d{2})'?$/);
    if (mmss) {
      return Number.parseInt(mmss[1]!, 10) * 60 + Number.parseInt(mmss[2]!, 10);
    }
    const minuteOnly = label.match(/^(\d{1,3})'?$/);
    if (minuteOnly) {
      return Number.parseInt(minuteOnly[1]!, 10) * 60;
    }
  }

  if (typeof event.minute === "number" && Number.isFinite(event.minute)) {
    return event.minute * 60;
  }

  return 0;
}

export function formatFotMobClock(minuteSeconds: number): string {
  const totalMinutes = Math.floor(minuteSeconds / 60);
  const seconds = minuteSeconds % 60;
  if (seconds > 0) {
    return `${String(totalMinutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(totalMinutes).padStart(2, "0")}:00`;
}

function categorizeFotMobEvent(type: string, goalType?: string, card?: string): EventCategory {
  const normalized = `${type} ${goalType ?? ""} ${card ?? ""}`.toLowerCase();
  if (normalized.includes("goal") || normalized.includes("penalty")) return "goal";
  if (normalized.includes("card")) return "card";
  if (normalized.includes("substitution") || normalized.includes("sub")) return "substitution";
  if (normalized.includes("offside")) return "offside";
  return "other";
}

function buildCommentaryText(body: string, timestamp: string): string {
  if (body.startsWith(`${timestamp} —`) || body.startsWith(`${timestamp} -`)) {
    return body;
  }
  return `${timestamp} — ${body}`;
}

function formatFotMobEventBody(
  event: FotMobEvent,
  context: { homeTeam?: string; awayTeam?: string },
): { body: string; eventType: string; eventCategory: EventCategory } | undefined {
  const type = event.type?.trim();
  if (!type) return undefined;

  const player = event.playerName?.trim();
  const teamName = event.isHome ? context.homeTeam : context.awayTeam;
  const eventType = event.goalType ? `${type} (${event.goalType})` : type;
  const eventCategory = categorizeFotMobEvent(type, event.goalType, event.card);

  let body: string | undefined;
  const normalized = type.toLowerCase();

  if (normalized.includes("goal")) {
    body = player ? `Goal! ${player} scores` : "Goal!";
    if (event.assist?.trim()) {
      body += `, assisted by ${event.assist.trim()}`;
    }
    if (event.homeScore != null && event.awayScore != null) {
      body += ` — Score ${event.homeScore}-${event.awayScore}`;
    }
  } else if (normalized.includes("card")) {
    const cardKind = event.card?.toLowerCase() ?? "";
    if (cardKind.includes("red")) {
      body = player ? `Red card for ${player}` : "Red card";
    } else {
      body = player ? `Yellow card for ${player}` : "Yellow card";
    }
  } else if (normalized.includes("substitution")) {
    const players = event.playersInvolved?.filter(Boolean) ?? [];
    body =
      players.length > 0
        ? `Substitution — ${players.join(" / ")}`
        : player
          ? `Substitution — ${player}`
          : "Substitution";
  } else {
    body = player ? `${eventType} — ${player}` : eventType;
  }

  if (teamName && body && !body.startsWith(`${teamName}:`)) {
    body = `${teamName}: ${body}`;
  }

  return { body, eventType, eventCategory };
}

export function resolveFotMobMatchId(matchIdOrUrl: string): string {
  const trimmed = matchIdOrUrl.trim();
  if (/^\d+$/.test(trimmed)) return trimmed;

  const urlMatch = trimmed.match(/fotmob\.com\/(?:match|matches)\/(\d+)/i);
  if (urlMatch?.[1]) return urlMatch[1];

  const hashMatch = trimmed.match(/#(\d{5,})/);
  if (hashMatch?.[1]) return hashMatch[1];

  throw new Error("Provide a FotMob match ID or fotmob.com/match URL.");
}

export function fotmobDetailToLiveMatch(detail: Record<string, unknown>): LiveMatch {
  const homeTeam = detail.homeTeam as FotMobTeam | undefined;
  const awayTeam = detail.awayTeam as FotMobTeam | undefined;

  return {
    matchId: asString(detail.matchId) ?? "unknown",
    sourceUrl: asString(detail.matchUrl),
    homeTeamName: homeTeam?.name ?? "Home",
    awayTeamName: awayTeam?.name ?? "Away",
    homeScore: typeof homeTeam?.score === "number" ? homeTeam.score : undefined,
    awayScore: typeof awayTeam?.score === "number" ? awayTeam.score : undefined,
    status: detail.finished === true ? "finished" : detail.started === true ? "live" : "scheduled",
    competitionName: asString(detail.leagueName),
    eventsAvailable: true,
  };
}

export function extractFotMobEventLines(detail: Record<string, unknown>): LiveScoreLine[] {
  const matchId = asString(detail.matchId) ?? "unknown";
  const homeTeam = (detail.homeTeam as FotMobTeam | undefined)?.name;
  const awayTeam = (detail.awayTeam as FotMobTeam | undefined)?.name;
  const events = Array.isArray(detail.events) ? (detail.events as FotMobEvent[]) : [];
  const lines: LiveScoreLine[] = [];

  for (let index = 0; index < events.length; index += 1) {
    const event = events[index]!;
    const formatted = formatFotMobEventBody(event, { homeTeam, awayTeam });
    if (!formatted || !isMajorTimelineLine({ ...formatted, text: formatted.body })) continue;

    const minute = String(Math.floor(parseFotMobEventMinute(event) / 60));
    const timestamp = `${minute}'`;

    lines.push({
      dedupeKey: `fotmob:${matchId}:${index}:${formatted.eventType}:${timestamp}:${formatted.body.slice(0, 40)}`,
      timestamp,
      minute,
      gameElapsedPrecision: "minute",
      sortKey: parseFotMobEventMinute(event) * 100 + index,
      text: buildCommentaryText(formatted.body, timestamp),
      eventType: formatted.eventType,
      eventCategory: formatted.eventCategory,
    });
  }

  return lines.sort((a, b) => a.sortKey - b.sortKey || a.timestamp.localeCompare(b.timestamp));
}

export async function fetchFotMobMatchDetail(matchIdOrUrl: string): Promise<Record<string, unknown>> {
  const matchId = resolveFotMobMatchId(matchIdOrUrl);
  const items = await runApifyActor(FOTMOB_ACTOR, {
    matchIds: [matchId],
    includeEvents: true,
    includePlayerStats: false,
    includeLineups: false,
    includeTeamStats: false,
    includeH2H: false,
    includeRawData: false,
  });

  const detail = items.find((item) => asString(item.matchId) === matchId) ?? items[0];
  if (!detail) {
    throw new Error(`Apify FotMob returned no match detail for matchId ${matchId}`);
  }

  return detail;
}

export async function fetchFotMobEventsForMatch(matchIdOrUrl: string): Promise<{
  match: LiveMatch;
  lines: LiveScoreLine[];
  dataNote: string;
}> {
  const matchId = resolveFotMobMatchId(matchIdOrUrl);
  const detail = await fetchFotMobMatchDetail(matchId);
  const match = fotmobDetailToLiveMatch(detail);
  const lines = extractFotMobEventLines(detail);

  const matchLabel = `${match.homeTeamName} vs ${match.awayTeamName}`;
  let dataNote = `FotMob timeline via Apify: ${lines.length} events with exact match-minute timestamps.`;
  if (lines.length === 0) {
    dataNote = `FotMob has no timeline events for ${matchLabel} yet.`;
  }

  return { match, lines, dataNote };
}

// Backward-compatible exports used by full-match-server during migration.
export { isApifyConfigured } from "@/lib/apify-shared";
