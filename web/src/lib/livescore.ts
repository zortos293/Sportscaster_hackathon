const PUBLIC_API = "https://prod-cdn-public-api.livescore.com/v1/api/app";
const MEV_API = "https://prod-cdn-mev-api.livescore.com/v1/api/app";
const COMMENTARY_API = "https://prod-cdn-commentary-api.livescore.com/v1/api/app";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export type EventCategory =
  | "goal"
  | "card"
  | "substitution"
  | "penalty"
  | "offside"
  | "other";

export type LiveMatch = {
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
};

export type LiveScoreLine = {
  dedupeKey: string;
  text: string;
  timestamp: string;
  minute?: string;
  sortKey: number;
  eventType?: string;
  eventCategory?: EventCategory;
};

interface LiveScoreStage {
  Sid?: string;
  Snm?: string;
  Scd?: string;
  Ccd?: string;
  CompN?: string;
  Cnm?: string;
  Events?: LiveScoreEvent[];
}

interface LiveScoreTeam {
  Nm?: string;
  ID?: string;
}

interface LiveScoreEvent {
  Eid?: string;
  T1?: LiveScoreTeam | LiveScoreTeam[];
  T2?: LiveScoreTeam | LiveScoreTeam[];
  Tr1?: string;
  Tr2?: string;
  Eps?: string;
  Esid?: number;
  Epr?: number;
  Ccd?: string;
  Scd?: string;
  Snm?: string;
  CompN?: string;
  Cnm?: string;
  Esd?: number;
}

interface LiveScoreComment {
  Txt?: string;
  Min?: number;
  MinEx?: number;
  IT?: number;
}

interface LiveScoreCommentaryResponse {
  Eid?: string;
  Com?: LiveScoreComment[];
  Els?: { Txt?: string };
}

interface LiveScoreIncident {
  Min?: number;
  MinEx?: number;
  Nm?: number;
  Pn?: string;
  IT?: number;
  Sc?: number[];
  Sor?: number;
  Incs?: LiveScoreIncident[];
}

interface LiveScoreIncidentsResponse {
  Eid?: string;
  Incs?: Record<string, LiveScoreIncident[]>;
}

interface LiveScoreScoreboard {
  Eid?: string;
  T1?: LiveScoreTeam | LiveScoreTeam[];
  T2?: LiveScoreTeam | LiveScoreTeam[];
  Tr1?: string;
  Tr2?: string;
}

function countryCode(): string {
  return process.env.LIVESCORE_COUNTRY_CODE?.trim() || "GB";
}

function tzOffsetHours(): number {
  const raw = process.env.LIVESCORE_TZ_OFFSET;
  if (raw?.trim()) return Number(raw);
  return -Math.round(new Date().getTimezoneOffset() / 60);
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
      Origin: "https://www.livescore.com",
    },
  });

  if (!response.ok) {
    throw new Error(`LiveScore API ${response.status} for ${url}`);
  }

  return (await response.json()) as T;
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function resolveEventId(matchUrl?: string, matchId?: string): string {
  if (matchId?.trim()) return matchId.trim();

  if (matchUrl?.trim()) {
    const fromPath = matchUrl.match(/\/(\d{5,})\/?(?:\?|$)/);
    if (fromPath?.[1]) return fromPath[1];
  }

  throw new Error("Provide matchId (LiveScore event ID) or a LiveScore match URL");
}

function normalizeTeam(team: LiveScoreTeam | LiveScoreTeam[] | undefined): LiveScoreTeam | undefined {
  if (Array.isArray(team)) return team[0];
  return team;
}

function formatYmd(date: Date): string {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("");
}

function isLiveEvent(event: LiveScoreEvent): boolean {
  if (event.Epr === 1) return true;
  const esid = event.Esid;
  if (esid === 2 || esid === 3 || esid === 10 || esid === 13) return true;
  const eps = event.Eps?.toUpperCase() ?? "";
  if (eps && !["FT", "NS", "CAN", "POST", "ABD"].includes(eps) && eps !== "HT") {
    return eps.includes("'") || eps.includes("+");
  }
  return false;
}

function matchSortRank(event: LiveScoreEvent): number {
  if (isLiveEvent(event)) return 0;
  if (event.Epr === 0 || event.Eps === "NS") return 2;
  return 1;
}

async function fetchStageMatches(url: string): Promise<Array<{ event: LiveScoreEvent; stage: LiveScoreStage }>> {
  const payload = await fetchJson<{ Stages?: LiveScoreStage[] }>(url);
  const rows: Array<{ event: LiveScoreEvent; stage: LiveScoreStage }> = [];

  for (const stage of payload.Stages ?? []) {
    for (const event of stage.Events ?? []) {
      rows.push({ event, stage });
    }
  }

  return rows;
}

export function buildMatchUrl(event: LiveScoreEvent, stage?: LiveScoreStage): string {
  const eid = event.Eid ?? "";
  const t1 = normalizeTeam(event.T1);
  const t2 = normalizeTeam(event.T2);
  const home = t1?.Nm ?? "home";
  const away = t2?.Nm ?? "away";
  const ccd = event.Ccd ?? stage?.Ccd ?? "international";
  const scd = event.Scd ?? stage?.Scd ?? "football";
  return `https://www.livescore.com/en/football/${ccd}/${scd}/${slugify(home)}-vs-${slugify(away)}/${eid}/`;
}

function stripHtml(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function formatLiveScoreClock(min?: number, minEx?: number): string {
  if (typeof min !== "number") return "00:00";
  if (typeof minEx === "number" && minEx > 0) {
    return `${String(min).padStart(2, "0")}+${String(minEx).padStart(2, "0")}`;
  }
  return `${String(min).padStart(2, "0")}:00`;
}

const GOAL_INCIDENT_TYPES = new Set([36, 37, 38]);

function incidentTypeLabel(incidentType?: number): string {
  switch (incidentType) {
    case 36:
      return "Goal";
    case 37:
      return "Own Goal";
    case 38:
      return "Penalty";
    case 43:
      return "Yellow Card";
    case 44:
      return "Second Yellow";
    case 45:
      return "Red Card";
    case 63:
      return "Assist";
    default:
      return "Event";
  }
}

function categorizeFromIncidentType(incidentType?: number, text?: string): EventCategory {
  if (incidentType != null) {
    if (GOAL_INCIDENT_TYPES.has(incidentType)) return incidentType === 38 ? "penalty" : "goal";
    if (incidentType === 43 || incidentType === 44 || incidentType === 45) return "card";
    if (incidentType === 63) return "other";
  }
  return categorizeFromText(text ?? "", incidentType);
}

function categorizeFromText(text: string, incidentType?: number): EventCategory {
  const lower = text.toLowerCase();
  if (incidentType === 36 || lower.includes("goal") || lower.includes("scores")) return "goal";
  if (incidentType === 43 || lower.includes("yellow card")) return "card";
  if (lower.includes("red card") || lower.includes("sent off")) return "card";
  if (incidentType === 3 || lower.startsWith("substitution")) return "substitution";
  if (lower.includes("penalty")) return "penalty";
  if (lower.includes("offside")) return "offside";
  return "other";
}

function inferEventType(text: string, incidentType?: number): string {
  if (incidentType != null && incidentType !== 63) {
    return incidentTypeLabel(incidentType);
  }
  const category = categorizeFromText(text, incidentType);
  switch (category) {
    case "goal":
      return "Goal";
    case "card":
      return text.toLowerCase().includes("red") ? "Red Card" : "Yellow Card";
    case "substitution":
      return "Substitution";
    case "penalty":
      return "Penalty";
    case "offside":
      return "Offside";
    default:
      return "Commentary";
  }
}

function resolveTeamNameFromIncident(
  teamNumber: number | undefined,
  homeTeam?: string,
  awayTeam?: string,
): string | undefined {
  if (teamNumber === 1) return homeTeam;
  if (teamNumber === 2) return awayTeam;
  return undefined;
}

function formatScore(home?: number, away?: number): string | undefined {
  if (home == null || away == null) return undefined;
  return `${home}-${away}`;
}

function formatIncidentBody(
  incident: LiveScoreIncident,
  context: { homeTeam?: string; awayTeam?: string },
  assistPlayer?: string,
): string | undefined {
  const player = incident.Pn?.trim();
  const teamName = resolveTeamNameFromIncident(incident.Nm, context.homeTeam, context.awayTeam);
  const scoreText = Array.isArray(incident.Sc)
    ? formatScore(incident.Sc[0], incident.Sc[1])
    : undefined;

  let body: string | undefined;
  switch (incident.IT) {
    case 36:
      body = player ? `Goal! ${player} scores` : "Goal!";
      if (assistPlayer) body += `, assisted by ${assistPlayer}`;
      if (scoreText) body += ` — Score ${scoreText}`;
      break;
    case 37:
      body = player ? `Own goal by ${player}` : "Own goal";
      if (scoreText) body += ` — Score ${scoreText}`;
      break;
    case 38:
      body = player ? `Penalty! ${player} converts` : "Penalty scored";
      if (scoreText) body += ` — Score ${scoreText}`;
      break;
    case 43:
      body = player ? `Yellow card for ${player}` : "Yellow card";
      break;
    case 44:
      body = player ? `Second yellow for ${player} — sent off` : "Second yellow card — sent off";
      break;
    case 45:
      body = player ? `Red card for ${player}` : "Red card";
      break;
    default:
      return undefined;
  }

  if (teamName) body = `${teamName}: ${body}`;
  return body;
}

function flattenLiveScoreIncidents(incs?: Record<string, LiveScoreIncident[]>): LiveScoreIncident[] {
  const rows: LiveScoreIncident[] = [];

  for (const periodIncidents of Object.values(incs ?? {})) {
    for (const incident of periodIncidents ?? []) {
      if (Array.isArray(incident.Incs) && incident.Incs.length > 0) {
        const goal = incident.Incs.find((child) => GOAL_INCIDENT_TYPES.has(child.IT ?? -1));
        const assist = incident.Incs.find((child) => child.IT === 63);
        if (goal) {
          rows.push({
            ...goal,
            Min: goal.Min ?? incident.Min,
            MinEx: goal.MinEx ?? incident.MinEx,
            Nm: goal.Nm ?? incident.Nm,
            Sc: goal.Sc ?? incident.Sc,
            Sor: goal.Sor ?? incident.Sor,
            _assistPlayer: assist?.Pn,
          } as LiveScoreIncident & { _assistPlayer?: string });
          continue;
        }
        rows.push(...incident.Incs.filter((child) => child.IT !== 63));
        continue;
      }

      if (incident.IT === 63) continue;
      if (incident.IT != null && typeof incident.Min === "number") {
        rows.push(incident);
      }
    }
  }

  return rows;
}

export function extractLiveScoreIncidentLines(
  payload: LiveScoreIncidentsResponse,
  scoreboard?: LiveScoreScoreboard,
): LiveScoreLine[] {
  const eventId = payload.Eid ?? scoreboard?.Eid ?? "unknown";
  const homeTeam = normalizeTeam(scoreboard?.T1)?.Nm;
  const awayTeam = normalizeTeam(scoreboard?.T2)?.Nm;
  const context = { homeTeam, awayTeam };
  const incidents = flattenLiveScoreIncidents(payload.Incs);

  const lines: LiveScoreLine[] = [];

  for (let index = 0; index < incidents.length; index++) {
    const incident = incidents[index] as LiveScoreIncident & { _assistPlayer?: string };
    const assistPlayer = incident._assistPlayer;
    const body = formatIncidentBody(incident, context, assistPlayer);
    if (!body) continue;

    const timestamp = formatLiveScoreClock(incident.Min, incident.MinEx);
    const eventType = inferEventType(body, incident.IT);
    const sortKey =
      (typeof incident.Min === "number" ? incident.Min : 0) * 10_000 +
      (typeof incident.MinEx === "number" ? incident.MinEx : 0) * 100 +
      (typeof incident.Sor === "number" ? incident.Sor : index);

    lines.push({
      dedupeKey: `livescore-event:${eventId}:${index}:${timestamp}:${incident.IT}:${body.slice(0, 40)}`,
      timestamp,
      minute: typeof incident.Min === "number" ? String(incident.Min) : undefined,
      sortKey,
      text: buildCommentaryText(body, timestamp),
      eventType,
      eventCategory: categorizeFromIncidentType(incident.IT, body),
    });
  }

  return lines.sort(
    (a, b) => a.sortKey - b.sortKey || a.timestamp.localeCompare(b.timestamp),
  );
}

function buildCommentaryText(body: string, timestamp: string): string {
  if (body.startsWith(`${timestamp} —`) || body.startsWith(`${timestamp} -`)) {
    return body;
  }
  return `${timestamp} — ${body}`;
}

export function extractLiveScoreCommentaryLines(
  payload: LiveScoreCommentaryResponse,
): LiveScoreLine[] {
  const eventId = payload.Eid ?? "unknown";
  const comments = Array.isArray(payload.Com) ? [...payload.Com] : [];
  comments.reverse();

  const lines: LiveScoreLine[] = [];

  for (let index = 0; index < comments.length; index++) {
    const comment = comments[index];
    const rawText = typeof comment.Txt === "string" ? stripHtml(comment.Txt) : "";
    if (!rawText) continue;

    const timestamp = formatLiveScoreClock(comment.Min, comment.MinEx);
    const eventType = inferEventType(rawText, comment.IT);
    const sortKey =
      (typeof comment.Min === "number" ? comment.Min : 0) * 10_000 +
      (typeof comment.MinEx === "number" ? comment.MinEx : 0) * 100 +
      index;

    lines.push({
      dedupeKey: `livescore:${eventId}:${index}:${timestamp}:${rawText.slice(0, 40)}`,
      timestamp,
      minute: typeof comment.Min === "number" ? String(comment.Min) : undefined,
      sortKey,
      text: buildCommentaryText(rawText, timestamp),
      eventType,
      eventCategory: categorizeFromText(rawText, comment.IT),
    });
  }

  return lines.sort(
    (a, b) => a.sortKey - b.sortKey || a.timestamp.localeCompare(b.timestamp),
  );
}

const LIKELY_COMMENTARY = /world cup|premier league|champions league|europa league|conference league|la liga|bundesliga|serie a|ligue 1|mls|fa cup|copa del rey|copa america|nations league|euro 20|european championship/i;
const UNLIKELY_COMMENTARY = /division|friendlies|u19|u20|u21|u23|youth|amateur|regional|reserve|women/i;

function shouldCheckCommentary(match: LiveMatch): boolean {
  const comp = match.competitionName ?? "";
  if (UNLIKELY_COMMENTARY.test(comp)) return false;
  if (LIKELY_COMMENTARY.test(comp)) return true;
  return false;
}

async function probeCommentaryLineCount(eventId: string): Promise<number> {
  try {
    const payload = await fetchJson<LiveScoreCommentaryResponse>(
      `${COMMENTARY_API}/event/${eventId}/comments?locale=en`,
    );
    return payload.Com?.length ?? 0;
  } catch {
    return 0;
  }
}

async function probeEventsLineCount(eventId: string): Promise<number> {
  try {
    const payload = await fetchJson<LiveScoreIncidentsResponse>(
      `${PUBLIC_API}/incidents/soccer/${eventId}?locale=en`,
    );
    return extractLiveScoreIncidentLines(payload).length;
  } catch {
    return 0;
  }
}

async function enrichMatchesWithCommentary(matches: LiveMatch[]): Promise<LiveMatch[]> {
  const concurrency = 10;
  const enriched = [...matches];
  const commentaryIndices = matches
    .map((match, index) => ({ match, index }))
    .filter(({ match }) => shouldCheckCommentary(match));

  for (let i = 0; i < commentaryIndices.length; i += concurrency) {
    const batch = commentaryIndices.slice(i, i + concurrency);
    await Promise.all(
      batch.map(async ({ match, index }) => {
        const count = await probeCommentaryLineCount(match.matchId);
        enriched[index] = {
          ...enriched[index],
          commentaryAvailable: count > 0,
          commentaryLineCount: count,
        };
      }),
    );
  }

  for (let i = 0; i < enriched.length; i += concurrency) {
    const batch = enriched.slice(i, i + concurrency);
    await Promise.all(
      batch.map(async (match, offset) => {
        const index = i + offset;
        const count = await probeEventsLineCount(match.matchId);
        enriched[index] = {
          ...enriched[index],
          eventsAvailable: count > 0,
          eventsLineCount: count,
        };
      }),
    );
  }

  for (let i = 0; i < enriched.length; i++) {
    if (enriched[i].commentaryAvailable == null) {
      enriched[i] = {
        ...enriched[i],
        commentaryAvailable: false,
        commentaryLineCount: 0,
      };
    }
    if (enriched[i].eventsAvailable == null) {
      enriched[i] = {
        ...enriched[i],
        eventsAvailable: false,
        eventsLineCount: 0,
      };
    }
  }

  return enriched.sort((a, b) => {
    const aHas = (a.commentaryAvailable ? 2 : 0) + (a.eventsAvailable ? 1 : 0);
    const bHas = (b.commentaryAvailable ? 2 : 0) + (b.eventsAvailable ? 1 : 0);
    if (aHas !== bHas) return bHas - aHas;
    const aLines = Math.max(a.commentaryLineCount ?? 0, a.eventsLineCount ?? 0);
    const bLines = Math.max(b.commentaryLineCount ?? 0, b.eventsLineCount ?? 0);
    if (aLines !== bLines) return bLines - aLines;
    return 0;
  });
}

function mapLiveEvent(
  event: LiveScoreEvent,
  stage?: LiveScoreStage,
): LiveMatch | undefined {
  if (!event.Eid) return undefined;

  const t1 = normalizeTeam(event.T1);
  const t2 = normalizeTeam(event.T2);
  const competitionName =
    event.CompN ?? stage?.CompN ?? stage?.Snm ?? event.Snm ?? stage?.Cnm ?? event.Cnm;

  return {
    matchId: event.Eid,
    sourceUrl: buildMatchUrl(event, stage),
    homeTeamName: t1?.Nm ?? "Home",
    awayTeamName: t2?.Nm ?? "Away",
    homeScore: event.Tr1 != null && event.Tr1 !== "" ? Number(event.Tr1) : undefined,
    awayScore: event.Tr2 != null && event.Tr2 !== "" ? Number(event.Tr2) : undefined,
    status: event.Eps ?? (event.Epr === 1 ? "live" : event.Epr === 2 ? "finished" : undefined),
    statusCategory: event.Eps,
    competitionName,
  };
}

export async function fetchLiveScoreMatches(): Promise<LiveMatch[]> {
  const offset = tzOffsetHours();
  const cc = countryCode();
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);

  const urls = [
    `${MEV_API}/live/soccer/${offset}?countryCode=${cc}&locale=en`,
    `${MEV_API}/date/soccer/${formatYmd(today)}/${offset}?countryCode=${cc}&locale=en`,
    `${MEV_API}/date/soccer/${formatYmd(yesterday)}/${offset}?countryCode=${cc}&locale=en`,
  ];

  const seen = new Map<string, { event: LiveScoreEvent; stage: LiveScoreStage }>();

  for (const url of urls) {
    const rows = await fetchStageMatches(url);
    for (const row of rows) {
      if (!row.event.Eid || seen.has(row.event.Eid)) continue;
      seen.set(row.event.Eid, row);
    }
  }

  const sorted = [...seen.values()].sort((a, b) => {
    const rankDiff = matchSortRank(a.event) - matchSortRank(b.event);
    if (rankDiff !== 0) return rankDiff;

    const compA = a.stage.CompN ?? a.stage.Snm ?? "";
    const compB = b.stage.CompN ?? b.stage.Snm ?? "";
    if (compA !== compB) return compA.localeCompare(compB);

    const kickA = a.event.Esd ?? 0;
    const kickB = b.event.Esd ?? 0;
    if (kickA !== kickB) return kickB - kickA;

    return a.event.Eid!.localeCompare(b.event.Eid!);
  });

  return sorted
    .map(({ event, stage }) => mapLiveEvent(event, stage))
    .filter((match): match is LiveMatch => Boolean(match));
}

export async function fetchLiveScoreMatchesWithCommentary(): Promise<LiveMatch[]> {
  const matches = await fetchLiveScoreMatches();
  return enrichMatchesWithCommentary(matches);
}

export async function fetchLiveScoreCommentary(
  matchUrl?: string,
  matchId?: string,
): Promise<{ matchUrl: string; lines: LiveScoreLine[]; dataNote?: string; summary?: string }> {
  const eventId = resolveEventId(matchUrl, matchId);
  const url = `${COMMENTARY_API}/event/${eventId}/comments?locale=en`;
  const payload = await fetchJson<LiveScoreCommentaryResponse>(url);
  const lines = extractLiveScoreCommentaryLines(payload);

  const scoreboardUrl = `${PUBLIC_API}/scoreboard/soccer/${eventId}?locale=en`;
  let resolvedUrl = matchUrl;
  try {
    const scoreboard = await fetchJson<LiveScoreEvent>(scoreboardUrl);
    resolvedUrl = buildMatchUrl(scoreboard);
  } catch {
    resolvedUrl = resolvedUrl ?? `https://www.livescore.com/en/football/match/${eventId}/`;
  }

  const summary = payload.Els?.Txt ? stripHtml(payload.Els.Txt) : undefined;
  let dataNote = `LiveScore commentary: ${lines.length} lines with timestamps (free public API).`;
  if (lines.length === 0) {
    dataNote =
      "LiveScore has no text commentary for this match. Try match events instead, or pick a major tournament fixture.";
  } else if (summary) {
    dataNote += " Match summary available.";
  }

  return { matchUrl: resolvedUrl, lines, dataNote, summary };
}

export async function fetchLiveScoreEvents(
  matchUrl?: string,
  matchId?: string,
): Promise<{ matchUrl: string; lines: LiveScoreLine[]; dataNote?: string }> {
  const eventId = resolveEventId(matchUrl, matchId);
  const incidentsUrl = `${PUBLIC_API}/incidents/soccer/${eventId}?locale=en`;
  const scoreboardUrl = `${PUBLIC_API}/scoreboard/soccer/${eventId}?locale=en`;

  const [payload, scoreboard] = await Promise.all([
    fetchJson<LiveScoreIncidentsResponse>(incidentsUrl),
    fetchJson<LiveScoreScoreboard>(scoreboardUrl).catch(() => undefined),
  ]);

  const lines = extractLiveScoreIncidentLines(payload, scoreboard);
  const homeTeam = normalizeTeam(scoreboard?.T1)?.Nm ?? "Home";
  const awayTeam = normalizeTeam(scoreboard?.T2)?.Nm ?? "Away";

  let resolvedUrl = matchUrl;
  if (scoreboard) {
    resolvedUrl = buildMatchUrl(scoreboard);
  } else {
    resolvedUrl = resolvedUrl ?? `https://www.livescore.com/en/football/match/${eventId}/`;
  }

  let dataNote = `LiveScore match events: ${lines.length} lines with timestamps (goals, cards — free public API).`;
  if (lines.length === 0) {
    dataNote = `LiveScore has no incident timeline for ${homeTeam} vs ${awayTeam} yet. Events appear after goals/cards during or after the match.`;
  }

  return { matchUrl: resolvedUrl, lines, dataNote };
}

export function liveScoreGameId(matchId: string): string {
  return `ls-${matchId}`;
}

export function matchTitle(match: LiveMatch): string {
  const score =
    match.homeScore != null && match.awayScore != null
      ? ` (${match.homeScore}-${match.awayScore})`
      : "";
  return `${match.homeTeamName} vs ${match.awayTeamName}${score}`;
}

export function matchSubtitle(match: LiveMatch): string {
  const parts = [match.competitionName ?? "Football", match.status ?? "LiveScore"].filter(Boolean);
  return parts.join(" · ");
}
