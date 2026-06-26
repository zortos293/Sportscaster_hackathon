import type { EventCategory, LiveMatch, LiveScoreLine } from "@/lib/livescore";
import { isMajorTimelineLine } from "@/lib/match-event-filter";
import { asString, runApifyActor } from "@/lib/apify-shared";

const FLASHSCORE_ACTOR =
  process.env.APIFY_FLASHSCORE_ACTOR?.trim() || "joaobrito/flashscore-sports-data-api";

type FlashscoreEvent = Record<string, unknown>;

function readNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value.trim(), 10);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return undefined;
}

function readString(value: unknown): string | undefined {
  return asString(value);
}

function eventField(event: FlashscoreEvent, ...keys: string[]): unknown {
  for (const key of keys) {
    if (event[key] !== undefined && event[key] !== null) return event[key];
  }
  return undefined;
}

export function resolveFlashscoreMatchId(matchIdOrUrl: string): string {
  const trimmed = matchIdOrUrl.trim();
  if (/^[A-Za-z0-9]{6,16}$/.test(trimmed)) return trimmed;

  const urlMatch = trimmed.match(/flashscore\.com\/(?:match\/[^/?#]+\/[^/?#]+\/)?([A-Za-z0-9]{6,16})/i);
  if (urlMatch?.[1]) return urlMatch[1];

  const trailingMatch = trimmed.match(/\/([A-Za-z0-9]{6,16})\/?(?:[#?].*)?$/);
  if (trailingMatch?.[1]) return trailingMatch[1];

  throw new Error("Provide a Flashscore match ID (e.g. 4I23FiTQ) or flashscore.com/match URL.");
}

export function parseFlashscoreEventMinute(event: FlashscoreEvent): number {
  const minuteBase = readNumber(eventField(event, "minuteBase", "minute_base", "baseMinute"));
  const minuteAdded = readNumber(eventField(event, "minuteAdded", "minute_added", "addedMinute", "stoppageMinute"));
  if (minuteBase != null) {
    return (minuteBase + (minuteAdded ?? 0)) * 60;
  }

  const minuteText = readString(
    eventField(event, "minute", "eventMinute", "minuteText", "minuteLabel", "time"),
  );
  if (minuteText) {
    const stoppage = minuteText.match(/^(\d{1,3})\s*\+\s*(\d{1,2})'?$/);
    if (stoppage) {
      return (Number.parseInt(stoppage[1]!, 10) + Number.parseInt(stoppage[2]!, 10)) * 60;
    }
    const mmss = minuteText.match(/^(\d{1,3}):(\d{2})'?$/);
    if (mmss) {
      return Number.parseInt(mmss[1]!, 10) * 60 + Number.parseInt(mmss[2]!, 10);
    }
    const minuteOnly = minuteText.match(/^(\d{1,3})'?$/);
    if (minuteOnly) {
      return Number.parseInt(minuteOnly[1]!, 10) * 60;
    }
  }

  const minuteNumber = readNumber(eventField(event, "minuteNumber", "minute_number", "elapsedMinute"));
  if (minuteNumber != null) {
    return minuteNumber * 60;
  }

  return 0;
}

function categorizeFlashscoreEvent(type: string, typeLabel?: string): EventCategory {
  const normalized = `${type} ${typeLabel ?? ""}`.toLowerCase();
  if (normalized.includes("own goal") || normalized.includes("penalty")) return "penalty";
  if (normalized.includes("goal")) return "goal";
  if (normalized.includes("yellow") || normalized.includes("red") || normalized.includes("card")) {
    return "card";
  }
  if (normalized.includes("substitution") || normalized.includes("sub_")) return "substitution";
  return "other";
}

function buildCommentaryText(body: string, timestamp: string): string {
  if (body.startsWith(`${timestamp} —`) || body.startsWith(`${timestamp} -`)) {
    return body;
  }
  return `${timestamp} — ${body}`;
}

function formatFlashscoreEventBody(
  event: FlashscoreEvent,
  context: { homeTeam?: string; awayTeam?: string },
): { body: string; eventType: string; eventCategory: EventCategory } | undefined {
  const rawType = readString(eventField(event, "type", "eventType", "event_type")) ?? "";
  const typeLabel =
    readString(eventField(event, "typeLabel", "type_label", "eventTypeLabel", "event_type_label")) ??
    rawType;
  if (!typeLabel.trim()) return undefined;

  const player =
    readString(eventField(event, "playerName", "player_name", "player")) ??
    readString(eventField(event, "assistPlayerName", "assist_player_name"));
  const side = readString(eventField(event, "side", "teamSide", "team_side", "team"))?.toLowerCase();
  const isHome = side === "home" || event.isHome === true || event.is_home === true;
  const teamName = isHome ? context.homeTeam : side === "away" ? context.awayTeam : undefined;
  const eventCategory = categorizeFlashscoreEvent(rawType, typeLabel);

  const homeScore = readNumber(
    eventField(event, "homeScoreAfter", "home_score_after", "homeScore", "home_score", "scoreHome"),
  );
  const awayScore = readNumber(
    eventField(event, "awayScoreAfter", "away_score_after", "awayScore", "away_score", "scoreAway"),
  );

  const normalized = `${rawType} ${typeLabel}`.toLowerCase();
  let body: string | undefined;

  if (normalized.includes("goal") || normalized.includes("penalty")) {
    body = player ? `Goal! ${player} scores` : "Goal!";
    if (homeScore != null && awayScore != null) {
      body += ` — Score ${homeScore}-${awayScore}`;
    }
  } else if (normalized.includes("red")) {
    body = player ? `Red card for ${player}` : "Red card";
  } else if (normalized.includes("yellow") || normalized.includes("card")) {
    body = player ? `Yellow card for ${player}` : "Yellow card";
  } else if (normalized.includes("substitution") || normalized.includes("sub")) {
    body = player ? `Substitution — ${player}` : "Substitution";
  } else {
    body = player ? `${typeLabel} — ${player}` : typeLabel;
  }

  if (teamName && body && !body.startsWith(`${teamName}:`)) {
    body = `${teamName}: ${body}`;
  }

  return { body, eventType: typeLabel, eventCategory };
}

function isMatchSummaryRecord(recordType: string | undefined): boolean {
  return recordType === "match_basic" || recordType === "match_detail" || recordType === "match-full";
}

function collectFlashscoreEvents(
  items: Record<string, unknown>[],
  matchId: string,
): FlashscoreEvent[] {
  const events: FlashscoreEvent[] = [];

  for (const item of items) {
    const recordType = asString(item.recordType);
    const itemMatchId = asString(item.matchId) ?? matchId;

    if (recordType === "match_events" && itemMatchId === matchId) {
      events.push(item);
      continue;
    }

    if (!isMatchSummaryRecord(recordType) || itemMatchId !== matchId) continue;

    const nested = item.events;
    if (Array.isArray(nested)) {
      for (const event of nested) {
        if (event && typeof event === "object") {
          events.push(event as FlashscoreEvent);
        }
      }
    }
  }

  return events;
}

function findFlashscoreMatchSummary(
  items: Record<string, unknown>[],
  matchId: string,
): Record<string, unknown> | undefined {
  const preferred = items.find((item) => {
    const recordType = asString(item.recordType);
    return isMatchSummaryRecord(recordType) && asString(item.matchId) === matchId;
  });
  if (preferred) return preferred;

  return items.find((item) => isMatchSummaryRecord(asString(item.recordType)));
}

export function flashscoreSummaryToLiveMatch(
  summary: Record<string, unknown>,
  matchId: string,
): LiveMatch {
  const statusCategory = asString(summary.statusCategory);
  const status = asString(summary.status);

  return {
    matchId: asString(summary.matchId) ?? matchId,
    sourceUrl: asString(summary.sourceUrl),
    homeTeamName: asString(summary.homeTeamName) ?? "Home",
    awayTeamName: asString(summary.awayTeamName) ?? "Away",
    homeScore: readNumber(summary.homeScore),
    awayScore: readNumber(summary.awayScore),
    status:
      statusCategory === "finished" || status?.toLowerCase().includes("finished")
        ? "finished"
        : statusCategory === "live" || status?.toLowerCase().includes("half")
          ? "live"
          : "scheduled",
    statusCategory,
    competitionName: asString(summary.competitionName),
    eventsAvailable: true,
  };
}

export function extractFlashscoreEventLines(
  items: Record<string, unknown>[],
  matchId: string,
): LiveScoreLine[] {
  const summary = findFlashscoreMatchSummary(items, matchId);
  const homeTeam = summary ? asString(summary.homeTeamName) : undefined;
  const awayTeam = summary ? asString(summary.awayTeamName) : undefined;
  const events = collectFlashscoreEvents(items, matchId);
  const lines: LiveScoreLine[] = [];

  for (let index = 0; index < events.length; index += 1) {
    const event = events[index]!;
    const formatted = formatFlashscoreEventBody(event, { homeTeam, awayTeam });
    if (!formatted || !isMajorTimelineLine({ ...formatted, text: formatted.body })) continue;

    const minuteSeconds = parseFlashscoreEventMinute(event);
    const minute = String(Math.floor(minuteSeconds / 60));
    const timestamp = `${minute}'`;
    const eventId =
      readString(eventField(event, "eventId", "event_id", "dedupeKey")) ?? String(index);

    lines.push({
      dedupeKey: `flashscore:${matchId}:${eventId}:${formatted.eventType}:${timestamp}`,
      timestamp,
      minute,
      gameElapsedPrecision: "minute",
      sortKey: minuteSeconds * 100 + index,
      text: buildCommentaryText(formatted.body, timestamp),
      eventType: formatted.eventType,
      eventCategory: formatted.eventCategory,
    });
  }

  return lines.sort((a, b) => a.sortKey - b.sortKey || a.timestamp.localeCompare(b.timestamp));
}

export async function fetchFlashscoreMatchItems(
  matchIdOrUrl: string,
): Promise<{ matchId: string; items: Record<string, unknown>[] }> {
  const trimmed = matchIdOrUrl.trim();
  const matchId = resolveFlashscoreMatchId(trimmed);
  const useTargetUrl = /flashscore\.com/i.test(trimmed);

  const items = await runApifyActor(FLASHSCORE_ACTOR, {
    mode: "matchDetails",
    sports: ["football"],
    ...(useTargetUrl ? { targetUrls: [trimmed] } : { matchIds: [matchId] }),
    include: {
      events: true,
      commentary: false,
      statistics: false,
      lineups: false,
      h2h: false,
      highlights: false,
      momentum: false,
      odds: false,
      news: false,
    },
    maxItems: 500,
    maxConcurrency: 2,
  });

  return { matchId, items };
}

export async function fetchFlashscoreEventsForMatch(matchIdOrUrl: string): Promise<{
  match: LiveMatch;
  lines: LiveScoreLine[];
  dataNote: string;
}> {
  const { matchId, items } = await fetchFlashscoreMatchItems(matchIdOrUrl);
  const summary = findFlashscoreMatchSummary(items, matchId);
  if (!summary) {
    throw new Error(`Apify Flashscore returned no match summary for matchId ${matchId}`);
  }

  const match = flashscoreSummaryToLiveMatch(summary, matchId);
  const lines = extractFlashscoreEventLines(items, matchId);

  const matchLabel = `${match.homeTeamName} vs ${match.awayTeamName}`;
  let dataNote = `Flashscore timeline via Apify: ${lines.length} events with match-minute timestamps.`;
  if (lines.length === 0) {
    dataNote = `Flashscore has no timeline events for ${matchLabel} yet.`;
  }

  return { match, lines, dataNote };
}

export { isApifyConfigured } from "@/lib/apify-shared";
