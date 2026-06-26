import type { EventCategory, LiveMatch, LiveScoreLine } from "@/lib/livescore";

const SOFASCORE_API_BASE =
  process.env.SOFASCORE_API_BASE?.trim() || "https://api.sofascore.com/api/v1";

const SOFASCORE_USER_AGENT =
  process.env.SOFASCORE_USER_AGENT?.trim() ||
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

type SofaScoreTeam = {
  id?: number;
  name?: string;
  shortName?: string;
};

type SofaScoreEvent = {
  id?: number;
  slug?: string;
  customId?: string;
  homeTeam?: SofaScoreTeam;
  awayTeam?: SofaScoreTeam;
  homeScore?: { current?: number; display?: number };
  awayScore?: { current?: number; display?: number };
  status?: { type?: string; description?: string };
  tournament?: { name?: string; uniqueTournament?: { name?: string } };
};

type SofaScorePlayer = {
  name?: string;
  shortName?: string;
};

export type SofaScoreShot = {
  id?: number;
  isHome?: boolean;
  shotType?: string;
  goalType?: string;
  situation?: string;
  time?: number;
  addedTime?: number;
  timeSeconds?: number;
  player?: SofaScorePlayer;
  playerName?: string;
};

type SofaScoreIncident = {
  id?: number;
  isHome?: boolean;
  incidentType?: string;
  incidentClass?: string;
  time?: number;
  addedTime?: number;
  timeSeconds?: number;
  player?: SofaScorePlayer;
  playerName?: string;
  reason?: string;
};

export function resolveSofaScoreEventId(value: string): string {
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return trimmed;

  const eventPath = trimmed.match(/\/event\/(\d+)/i);
  if (eventPath?.[1]) return eventPath[1]!;

  throw new Error(
    "SofaScore event ID must be numeric. Open the match on sofascore.com and copy the ID from scheduled-events JSON or browser network calls to /event/{id}/.",
  );
}

export function formatSofaScoreClock(gameElapsed: number): string {
  const totalMinutes = Math.floor(gameElapsed / 60);
  const seconds = gameElapsed % 60;
  if (seconds > 0) {
    return `${String(totalMinutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(totalMinutes).padStart(2, "0")}:00`;
}

export function parseSofaScoreClock(options: {
  timeSeconds?: number;
  time?: number;
  addedTime?: number;
}): { gameElapsed: number; precision: "minute" | "second" } {
  if (typeof options.timeSeconds === "number" && Number.isFinite(options.timeSeconds)) {
    return { gameElapsed: Math.max(0, Math.round(options.timeSeconds)), precision: "second" };
  }

  const minute = typeof options.time === "number" && Number.isFinite(options.time) ? options.time : 0;
  const extra =
    typeof options.addedTime === "number" && Number.isFinite(options.addedTime)
      ? options.addedTime
      : 0;
  return { gameElapsed: Math.max(0, (minute + extra) * 60), precision: "minute" };
}

function buildCommentaryText(body: string, timestamp: string): string {
  if (body.startsWith(`${timestamp} —`) || body.startsWith(`${timestamp} -`)) {
    return body;
  }
  return `${timestamp} — ${body}`;
}

function teamLabel(event: SofaScoreEvent, isHome?: boolean): string {
  const team = isHome ? event.homeTeam : event.awayTeam;
  return team?.name?.trim() || team?.shortName?.trim() || (isHome ? "Home" : "Away");
}

function playerLabel(entity: { player?: SofaScorePlayer; playerName?: string }): string {
  return entity.player?.name?.trim() || entity.playerName?.trim() || "Unknown player";
}

export function isSofaScoreGoalShot(shot: SofaScoreShot): boolean {
  const shotType = shot.shotType?.trim().toLowerCase();
  if (shotType === "goal") return true;

  const goalType = shot.goalType?.trim().toLowerCase();
  return goalType === "owngoal" || goalType === "own-goal" || goalType === "penalty";
}

export function extractGoalLinesFromShotmap(
  event: SofaScoreEvent,
  shots: SofaScoreShot[],
): LiveScoreLine[] {
  const eventId = String(event.id ?? "unknown");
  const lines: LiveScoreLine[] = [];

  for (const [index, shot] of shots.entries()) {
    if (!isSofaScoreGoalShot(shot)) continue;

    const timing = parseSofaScoreClock({
      timeSeconds: shot.timeSeconds,
      time: shot.time,
      addedTime: shot.addedTime,
    });
    const timestamp = formatSofaScoreClock(timing.gameElapsed);
    const player = playerLabel(shot);
    const team = teamLabel(event, shot.isHome);
    const goalType = shot.goalType?.trim().toLowerCase();
    const eventType =
      goalType === "owngoal" || goalType === "own-goal"
        ? "Own goal"
        : goalType === "penalty"
          ? "Penalty goal"
          : "Goal";
    const body = `${team}: Goal! ${player} scores`;

    lines.push({
      dedupeKey: `sofascore-shot:${eventId}:${shot.id ?? index}:${timing.gameElapsed}`,
      timestamp,
      minute: String(Math.floor(timing.gameElapsed / 60)),
      gameElapsed: timing.gameElapsed,
      gameElapsedPrecision: timing.precision,
      sortKey: timing.gameElapsed * 100 + index,
      text: buildCommentaryText(body, timestamp),
      eventType,
      eventCategory: "goal",
    });
  }

  return lines.sort((a, b) => a.sortKey - b.sortKey || a.timestamp.localeCompare(b.timestamp));
}

export function extractCardLinesFromIncidents(
  event: SofaScoreEvent,
  incidents: SofaScoreIncident[],
): LiveScoreLine[] {
  const eventId = String(event.id ?? "unknown");
  const lines: LiveScoreLine[] = [];

  for (const [index, incident] of incidents.entries()) {
    if (incident.incidentType?.trim().toLowerCase() !== "card") continue;

    const cardClass = incident.incidentClass?.trim().toLowerCase() ?? "yellow";
    const timing = parseSofaScoreClock({
      timeSeconds: incident.timeSeconds,
      time: incident.time,
      addedTime: incident.addedTime,
    });
    const timestamp = formatSofaScoreClock(timing.gameElapsed);
    const player = playerLabel(incident);
    const team = teamLabel(event, incident.isHome);
    const eventType =
      cardClass === "red"
        ? "Red card"
        : cardClass === "yellowred"
          ? "Second yellow"
          : "Yellow card";
    const body = `${team}: ${eventType} for ${player}`;

    lines.push({
      dedupeKey: `sofascore-card:${eventId}:${incident.id ?? index}:${timing.gameElapsed}:${cardClass}`,
      timestamp,
      minute: String(Math.floor(timing.gameElapsed / 60)),
      gameElapsed: timing.gameElapsed,
      gameElapsedPrecision: timing.precision,
      sortKey: timing.gameElapsed * 100 + index + 50_000,
      text: buildCommentaryText(body, timestamp),
      eventType,
      eventCategory: "card",
    });
  }

  return lines.sort((a, b) => a.sortKey - b.sortKey || a.timestamp.localeCompare(b.timestamp));
}

export function extractSofaScoreEventLines(options: {
  event: SofaScoreEvent;
  shots: SofaScoreShot[];
  incidents: SofaScoreIncident[];
}): LiveScoreLine[] {
  const goals = extractGoalLinesFromShotmap(options.event, options.shots);
  const cards = extractCardLinesFromIncidents(options.event, options.incidents);
  return [...goals, ...cards].sort(
    (a, b) => a.sortKey - b.sortKey || a.timestamp.localeCompare(b.timestamp),
  );
}

export function sofaScoreEventToLiveMatch(event: SofaScoreEvent): LiveMatch {
  const eventId = String(event.id ?? "");
  const tournament =
    event.tournament?.uniqueTournament?.name?.trim() ||
    event.tournament?.name?.trim() ||
    "SofaScore";

  return {
    matchId: eventId,
    sourceUrl: event.customId
      ? `https://www.sofascore.com/event/${event.customId}`
      : `https://www.sofascore.com/event/${eventId}`,
    homeTeamName: event.homeTeam?.name?.trim() || event.homeTeam?.shortName?.trim() || "Home",
    awayTeamName: event.awayTeam?.name?.trim() || event.awayTeam?.shortName?.trim() || "Away",
    homeScore: event.homeScore?.current ?? event.homeScore?.display,
    awayScore: event.awayScore?.current ?? event.awayScore?.display,
    status: event.status?.description,
    statusCategory: event.status?.type,
    competitionName: tournament,
    eventsAvailable: true,
  };
}

async function fetchSofaScoreJson<T>(path: string): Promise<T> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${SOFASCORE_API_BASE}${normalizedPath}`;
  const proxy = process.env.SOFASCORE_PROXY_URL?.trim();

  const response = await fetch(proxy ? `${proxy}${encodeURIComponent(url)}` : url, {
    headers: {
      "User-Agent": SOFASCORE_USER_AGENT,
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
      Referer: "https://www.sofascore.com/",
      Origin: "https://www.sofascore.com",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const hint =
      response.status === 403
        ? " SofaScore blocked the request (403). This endpoint is unofficial — try SOFASCORE_PROXY_URL, fetch from a residential IP, or paste shotmap JSON manually during development."
        : "";
    throw new Error(
      `SofaScore request failed (${response.status}) for ${normalizedPath}.${hint}${body ? ` ${body.slice(0, 180)}` : ""}`,
    );
  }

  return (await response.json()) as T;
}

export async function fetchSofaScoreEventsForMatch(eventIdOrUrl: string): Promise<{
  match: LiveMatch;
  lines: LiveScoreLine[];
  dataNote: string;
}> {
  const eventId = resolveSofaScoreEventId(eventIdOrUrl);

  const [eventPayload, shotmapPayload, incidentsPayload] = await Promise.all([
    fetchSofaScoreJson<{ event?: SofaScoreEvent }>(`/event/${eventId}`),
    fetchSofaScoreJson<{ shotmap?: SofaScoreShot[] }>(`/event/${eventId}/shotmap`).catch(
      () => ({ shotmap: [] as SofaScoreShot[] }),
    ),
    fetchSofaScoreJson<{ incidents?: SofaScoreIncident[] }>(`/event/${eventId}/incidents`).catch(
      () => ({ incidents: [] as SofaScoreIncident[] }),
    ),
  ]);

  const event = eventPayload.event;
  if (!event?.id) {
    throw new Error(`SofaScore returned no event payload for event ID ${eventId}.`);
  }

  const shots = shotmapPayload.shotmap ?? [];
  const incidents = incidentsPayload.incidents ?? [];
  const match = sofaScoreEventToLiveMatch(event);
  const lines = extractSofaScoreEventLines({ event, shots, incidents });

  const secondGoals = lines.filter(
    (line) => line.eventCategory === "goal" && line.gameElapsedPrecision === "second",
  ).length;

  let dataNote = `SofaScore shotmap/incidents: ${lines.length} major events`;
  if (secondGoals > 0) {
    dataNote += ` (${secondGoals} goals with second-precision timeSeconds).`;
  } else if (lines.some((line) => line.eventCategory === "goal")) {
    dataNote += " (goals found, but shotmap lacked timeSeconds — falling back to minute-level).";
  } else {
    dataNote += ".";
  }

  return { match, lines, dataNote };
}
