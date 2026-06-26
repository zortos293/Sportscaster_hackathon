import {
  buildBatchCommentaryUserPrompt,
  COMMENTARY_SYSTEM_PROMPT,
} from "@/lib/commentary-prompts";
import {
  cursorAutomationWebhookConfigured,
  cursorCommentaryConfigured,
  generateCursorBatchCommentary,
  getCursorAutomationWebhookConfig,
  parseBatchCommentaryJson,
  triggerCursorAutomationWebhook,
} from "@/lib/cursor-commentary";
import {
  fetchLiveScoreCommentary,
  fetchLiveScoreEvents,
  fetchLiveScoreMatchesWithCommentary,
  liveScoreGameId,
  type LiveMatch,
  type LiveScoreLine,
  matchSubtitle,
  matchTitle,
} from "@/lib/livescore";
import { eventCacheKey, type CachedCommentaryLine } from "@/lib/match-cache";
import { getFullMatchTimeline, listFullMatchImports } from "@/lib/full-match-server";
import { type TimelineEvent, type TimelineEventKind } from "@/lib/timeline";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";

export type CacheMatchResult = {
  gameId: string;
  title: string;
  lineCount: number;
  source: string;
  cachedAt: number;
  async?: boolean;
  error?: string;
};

export type MatchCacheStatus = {
  id: string;
  matchId: string;
  title: string;
  subtitle: string;
  feedType: "demo" | "livescore" | "full_match";
  finalScore?: string;
  videoMode?: string;
  videoFile?: string;
  alignmentStatus?: string;
  alignmentConfidence?: number;
  alignmentStatusMessage?: string;
  homeTeamName: string;
  awayTeamName: string;
  homeScore?: number;
  awayScore?: number;
  status?: string;
  commentaryAvailable: boolean;
  commentaryLineCount: number;
  eventsAvailable: boolean;
  eventsLineCount: number;
  cacheable: boolean;
  cached: boolean;
  lineCount: number;
  cachedAt: number | null;
  source: string | null;
};

const DEFAULT_PERSONA =
  "British Premier League football commentator with building excitement";

function getConvexClient(): ConvexHttpClient | null {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL?.trim();
  if (!url || !/^https?:\/\//.test(url)) return null;
  return new ConvexHttpClient(url);
}

export function assertAdminCacheConfigured(): void {
  if (!cursorCommentaryConfigured() && !cursorAutomationWebhookConfigured()) {
    throw new Error(
      "Commentary conversion is not configured. Set CURSOR_API_KEY for synchronous cache, or CURSOR_AUTOMATION_WEBHOOK_URL + CURSOR_AUTOMATION_TOKEN for webhook-based ingestion.",
    );
  }
}

function mapEventCategoryToKind(category?: string): TimelineEventKind {
  switch (category) {
    case "goal":
    case "penalty":
      return "score";
    case "card":
    case "substitution":
    case "offside":
      return "key_play";
    default:
      return "color";
  }
}

function parseMinuteSeconds(minute?: string): number {
  if (!minute) return 0;
  const base = Number.parseInt(minute, 10);
  return Number.isFinite(base) && base >= 0 ? base * 60 : 0;
}

function stripTimestampPrefix(text: string): string {
  return text.replace(/^\d{2}(?::\d{2}|\+\d{2})\s*[—-]\s*/, "").trim();
}

function livescoreLineToTimelineEvent(
  line: LiveScoreLine,
  index: number,
  match: LiveMatch,
): TimelineEvent {
  const minute = line.minute ? Number.parseInt(line.minute, 10) : 0;
  const gameElapsed = parseMinuteSeconds(line.minute);
  return {
    id: line.dedupeKey,
    videoAt: gameElapsed + index * 0.1,
    gameElapsed,
    scoreHome: match.homeScore ?? 0,
    scoreAway: match.awayScore ?? 0,
    description: stripTimestampPrefix(line.text),
    periodLabel: Number.isFinite(minute) && minute > 45 ? "2nd Half" : "1st Half",
    kind: mapEventCategoryToKind(line.eventCategory),
    context: line.eventType,
  };
}

async function fetchRawLinesForMatch(
  match: LiveMatch,
): Promise<{ lines: LiveScoreLine[]; feed: "commentary" | "events" }> {
  if (match.commentaryAvailable) {
    const result = await fetchLiveScoreCommentary(match.sourceUrl, match.matchId);
    if (result.lines.length > 0) {
      return { lines: result.lines, feed: "commentary" };
    }
  }

  if (match.eventsAvailable) {
    const result = await fetchLiveScoreEvents(match.sourceUrl, match.matchId);
    if (result.lines.length > 0) {
      return { lines: result.lines, feed: "events" };
    }
  }

  const commentary = await fetchLiveScoreCommentary(match.sourceUrl, match.matchId);
  if (commentary.lines.length > 0) {
    return { lines: commentary.lines, feed: "commentary" };
  }

  const events = await fetchLiveScoreEvents(match.sourceUrl, match.matchId);
  if (events.lines.length > 0) {
    return { lines: events.lines, feed: "events" };
  }

  throw new Error(
    "LiveScore returned no commentary or match events for this fixture. Pick a live or finished match with goals/cards, or a major tournament with text commentary.",
  );
}

export async function buildCacheLinesFromTimelineEvents(options: {
  gameTitle: string;
  persona: string;
  eventId: string;
  events: TimelineEvent[];
  cursorAgentId?: string;
}): Promise<{ lines: CachedCommentaryLine[]; source: string; agentId?: string }> {
  assertAdminCacheConfigured();

  if (!cursorCommentaryConfigured()) {
    throw new Error(
      "CURSOR_API_KEY is required for synchronous batch caching. Webhook-only mode uses bulk_cache_matches instead.",
    );
  }

  const { gameTitle, persona, eventId, events, cursorAgentId } = options;
  const batchPrompt = buildBatchCommentaryUserPrompt({
    persona,
    gameTitle,
    items: events.map((event) => ({
      eventKey: eventCacheKey(event),
      kind: event.kind,
      description: event.description,
      scoreAway: event.scoreAway,
      scoreHome: event.scoreHome,
      periodLabel: event.periodLabel,
      context: event.context,
    })),
  });

  const result = await generateCursorBatchCommentary({
    apiKey: process.env.CURSOR_API_KEY!,
    systemPrompt: COMMENTARY_SYSTEM_PROMPT,
    userPrompt: batchPrompt,
    agentId: cursorAgentId,
  });

  const expectedKeys = events.map((event) => eventCacheKey(event));
  const convertedByKey = parseBatchCommentaryJson(result.text, expectedKeys);

  const lines: CachedCommentaryLine[] = [];
  for (const event of events) {
    const key = eventCacheKey(event);
    const text = convertedByKey.get(key);
    if (!text) {
      throw new Error(
        `Cursor batch response missing line for "${event.description.slice(0, 60)}…"`,
      );
    }
    lines.push({
      eventKey: key,
      eventId,
      kind: event.kind,
      description: event.description,
      videoAt: event.videoAt,
      text,
      source: "cursor",
    });
  }

  return { lines, source: "cursor", agentId: result.agentId };
}

export async function buildCacheLinesForMatch(
  match: LiveMatch,
  rawLines: LiveScoreLine[],
  cursorAgentId?: string,
): Promise<{ lines: CachedCommentaryLine[]; source: string; agentId?: string }> {
  assertAdminCacheConfigured();

  if (!cursorCommentaryConfigured()) {
    throw new Error(
      "CURSOR_API_KEY is required for synchronous batch caching. Webhook-only mode uses bulk_cache_matches instead.",
    );
  }

  const gameTitle = matchTitle(match);
  const persona = DEFAULT_PERSONA;
  const events = rawLines.map((rawLine, index) =>
    livescoreLineToTimelineEvent(rawLine, index, match),
  );

  const result = await buildCacheLinesFromTimelineEvents({
    gameTitle,
    persona,
    eventId: match.matchId,
    events: events.map((event, index) => ({
      ...event,
      id: rawLines[index]!.dedupeKey,
    })),
    cursorAgentId,
  });

  const lines: CachedCommentaryLine[] = result.lines.map((line, index) => ({
    ...line,
    eventKey: rawLines[index]!.dedupeKey,
    description: stripTimestampPrefix(rawLines[index]!.text),
  }));

  return { lines, source: result.source, agentId: result.agentId };
}

export async function saveGameCacheToConvex(options: {
  gameId: string;
  title: string;
  subtitle: string;
  lines: CachedCommentaryLine[];
  source: string;
}): Promise<{ lineCount: number; cachedAt: number }> {
  const client = getConvexClient();
  if (!client) {
    throw new Error(
      "NEXT_PUBLIC_CONVEX_URL is not configured. Run `npx convex dev` in web/ and set the deployment URL.",
    );
  }

  return client.mutation(api.matches.upsertMatchCache, {
    gameId: options.gameId,
    title: options.title,
    subtitle: options.subtitle,
    source: options.source,
    lines: options.lines,
  });
}

export async function saveMatchCacheToConvex(
  match: LiveMatch,
  lines: CachedCommentaryLine[],
  source: string,
): Promise<{ lineCount: number; cachedAt: number }> {
  return saveGameCacheToConvex({
    gameId: liveScoreGameId(match.matchId),
    title: matchTitle(match),
    subtitle: matchSubtitle(match),
    lines,
    source,
  });
}

export function getConvexWebhookIngestUrl(): string | undefined {
  const siteUrl = process.env.CONVEX_SITE_URL?.trim();
  if (!siteUrl) return undefined;
  return `${siteUrl.replace(/\/$/, "")}/webhook/cache-matches`;
}

export async function triggerBulkCacheWebhook(
  matches: Array<LiveMatch & { rawLines: LiveScoreLine[]; feed: string }>,
): Promise<{ triggered: boolean; error?: string }> {
  const webhook = getCursorAutomationWebhookConfig();
  if (!webhook) {
    return { triggered: false, error: "Cursor automation webhook is not configured" };
  }

  try {
    await triggerCursorAutomationWebhook({
      webhookUrl: webhook.webhookUrl,
      token: webhook.token,
      payload: {
        action: "bulk_cache_matches",
        convexIngestUrl: getConvexWebhookIngestUrl(),
        convexWebhookSecretConfigured: Boolean(process.env.CACHE_WEBHOOK_SECRET?.trim()),
        persona: DEFAULT_PERSONA,
        games: matches.map((match) => ({
          gameId: liveScoreGameId(match.matchId),
          matchId: match.matchId,
          title: matchTitle(match),
          subtitle: matchSubtitle(match),
          persona: DEFAULT_PERSONA,
          sourceUrl: match.sourceUrl,
          feed: match.feed,
          homeTeamName: match.homeTeamName,
          awayTeamName: match.awayTeamName,
          homeScore: match.homeScore,
          awayScore: match.awayScore,
          status: match.status,
          rawLines: match.rawLines.map((line) => ({
            dedupeKey: line.dedupeKey,
            timestamp: line.timestamp,
            text: line.text,
            eventType: line.eventType,
            eventCategory: line.eventCategory,
          })),
        })),
        instructions:
          "See automation instructions: action bulk_cache_matches — convert all rawLines per game, POST each game to convexIngestUrl.",
      },
    });
    return { triggered: true };
  } catch (error) {
    return {
      triggered: false,
      error: error instanceof Error ? error.message : "Webhook trigger failed",
    };
  }
}

export async function cacheGame(gameId: string, cursorAgentId?: string): Promise<CacheMatchResult> {
  if (gameId.startsWith("fm-")) {
    return cacheFullMatchGame(gameId, cursorAgentId);
  }

  return {
    gameId,
    title: gameId,
    lineCount: 0,
    source: "error",
    cachedAt: Date.now(),
    error: "Only imported highlights can be cached from this admin panel.",
  };
}

export async function cacheFullMatchGame(
  gameId: string,
  cursorAgentId?: string,
): Promise<CacheMatchResult> {
  try {
    assertAdminCacheConfigured();
    const aligned = await getFullMatchTimeline(gameId);
    if (!aligned?.importJob) {
      throw new Error("Full-match import not found");
    }
    if (aligned.events.length === 0) {
      throw new Error("Full-match import has no aligned LiveScore events yet");
    }

    const { lines, source } = await buildCacheLinesFromTimelineEvents({
      gameTitle: aligned.importJob.title,
      persona: DEFAULT_PERSONA,
      eventId: aligned.importJob.liveScoreMatchId,
      events: aligned.events,
      cursorAgentId,
    });

    const saved = await saveGameCacheToConvex({
      gameId,
      title: aligned.importJob.title,
      subtitle: aligned.importJob.subtitle,
      lines,
      source,
    });

    return {
      gameId,
      title: aligned.importJob.title,
      lineCount: saved.lineCount,
      source,
      cachedAt: saved.cachedAt,
    };
  } catch (error) {
    return {
      gameId,
      title: gameId,
      lineCount: 0,
      source: "error",
      cachedAt: Date.now(),
      error: error instanceof Error ? error.message : "Cache failed",
    };
  }
}

export async function cacheLiveScoreMatch(matchId: string): Promise<CacheMatchResult> {
  const gameId = liveScoreGameId(matchId);

  try {
    assertAdminCacheConfigured();

    const allMatches = await fetchLiveScoreMatchesWithCommentary();
    const match = allMatches.find((entry) => entry.matchId === matchId);
    if (!match) {
      return {
        gameId,
        title: matchId,
        lineCount: 0,
        source: "error",
        cachedAt: Date.now(),
        error: "Match not found in current LiveScore feed",
      };
    }

    const { lines: rawLines, feed } = await fetchRawLinesForMatch(match);

    if (!cursorCommentaryConfigured() && cursorAutomationWebhookConfigured()) {
      const webhook = await triggerBulkCacheWebhook([{ ...match, rawLines, feed }]);
      if (!webhook.triggered) {
        throw new Error(webhook.error ?? "Failed to trigger Cursor webhook");
      }
      return {
        gameId,
        title: matchTitle(match),
        lineCount: 0,
        source: "webhook",
        cachedAt: Date.now(),
        async: true,
      };
    }

    const { lines, source } = await buildCacheLinesForMatch(match, rawLines);
    const saved = await saveMatchCacheToConvex(match, lines, source);
    return {
      gameId,
      title: matchTitle(match),
      lineCount: saved.lineCount,
      source,
      cachedAt: saved.cachedAt,
    };
  } catch (error) {
    return {
      gameId,
      title: matchId,
      lineCount: 0,
      source: "error",
      cachedAt: Date.now(),
      error: error instanceof Error ? error.message : "Cache failed",
    };
  }
}

export async function cacheAllLiveScoreMatches(): Promise<{
  webhook: { triggered: boolean; error?: string };
  results: CacheMatchResult[];
}> {
  assertAdminCacheConfigured();

  const results: CacheMatchResult[] = [];
  let sharedAgentId: string | undefined;

  const fullMatchImports = await listFullMatchImports().catch(() => []);
  for (const importJob of fullMatchImports.filter((job) => job.status === "aligned")) {
    try {
      const aligned = await getFullMatchTimeline(importJob.gameId);
      if (!aligned?.events.length) continue;

      const { lines, source, agentId } = await buildCacheLinesFromTimelineEvents({
        gameTitle: importJob.title,
        persona: DEFAULT_PERSONA,
        eventId: importJob.liveScoreMatchId,
        events: aligned.events,
        cursorAgentId: sharedAgentId,
      });
      sharedAgentId = agentId ?? sharedAgentId;

      const saved = await saveGameCacheToConvex({
        gameId: importJob.gameId,
        title: importJob.title,
        subtitle: importJob.subtitle,
        lines,
        source,
      });

      results.push({
        gameId: importJob.gameId,
        title: importJob.title,
        lineCount: saved.lineCount,
        source,
        cachedAt: saved.cachedAt,
      });
    } catch (error) {
      results.push({
        gameId: importJob.gameId,
        title: importJob.title,
        lineCount: 0,
        source: "error",
        cachedAt: Date.now(),
        error: error instanceof Error ? error.message : "Cache failed",
      });
    }
  }

  return { webhook: { triggered: false }, results };
}

export async function listCachedMatchStatuses(): Promise<{
  convexEnabled: boolean;
  commentaryConfigured: boolean;
  webhookConfigured: boolean;
  games: MatchCacheStatus[];
}> {
  const client = getConvexClient();
  const caches =
    client != null ? await client.query(api.matches.listMatchCaches, {}) : [];
  const cacheByGameId = new Map(
    caches.map((entry) => [
      entry.gameId,
      { lineCount: entry.lineCount, cachedAt: entry.cachedAt, source: entry.source },
    ]),
  );

  const fullMatchImports = await listFullMatchImports().catch(() => []);
  const fullMatchGames: MatchCacheStatus[] = await Promise.all(
    fullMatchImports.map(async (importJob) => {
      const cache = cacheByGameId.get(importJob.gameId);
      const aligned = await getFullMatchTimeline(importJob.gameId).catch(() => null);
      const eventCount = aligned?.events.length ?? 0;
      return {
        id: importJob.gameId,
        matchId: importJob.liveScoreMatchId,
        title: importJob.title,
        subtitle: importJob.subtitle,
        feedType: "full_match" as const,
        videoMode: "full_match_aligned",
        videoFile: importJob.videoFile,
        alignmentStatus: importJob.status,
        alignmentConfidence: importJob.confidence,
        alignmentStatusMessage: importJob.statusMessage,
        homeTeamName: "",
        awayTeamName: "",
        commentaryAvailable: false,
        commentaryLineCount: 0,
        eventsAvailable: eventCount > 0,
        eventsLineCount: eventCount,
        cacheable: eventCount > 0 && importJob.status === "aligned",
        cached: Boolean(cache),
        lineCount: cache?.lineCount ?? 0,
        cachedAt: cache?.cachedAt ?? null,
        source: cache?.source ?? null,
      };
    }),
  );

  return {
    convexEnabled: client != null,
    commentaryConfigured: cursorCommentaryConfigured() || cursorAutomationWebhookConfigured(),
    webhookConfigured: cursorAutomationWebhookConfigured(),
    games: fullMatchGames,
  };
}
