import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ApifyQuotaError,
  fetchCommentaryLines,
  fetchLiveFootballMatches,
  getApifyActorId,
  isApifyConfigured,
  isApifyQuotaError,
} from "./apify.js";
import { fetchDemoCommentaryLines } from "./demo.js";
import {
  fetchLiveScoreCommentary,
  fetchLiveScoreEvents,
  fetchLiveScoreMatchesWithCommentary,
} from "./livescore.js";
import { castLinesOverSse } from "./cast.js";
import { getModelId, getVoiceId } from "./config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");
const port = Number(process.env.PORT ?? 3000);

const mimeTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf-8"));
}

function parseCastLines(body: unknown): Array<{ text: string; dedupeKey?: string; timestamp?: string }> {
  if (!body || typeof body !== "object" || !("lines" in body)) {
    throw new Error("Request body must include a lines array");
  }

  const { lines } = body as { lines: unknown };
  if (!Array.isArray(lines)) {
    throw new Error("lines must be an array");
  }

  const parsed = lines
    .map((line) => {
      if (typeof line === "string") {
        const text = line.trim();
        return text ? { text } : null;
      }
      if (!line || typeof line !== "object" || !("text" in line)) return null;
      const entry = line as { text?: unknown; dedupeKey?: unknown; timestamp?: unknown };
      const text = typeof entry.text === "string" ? entry.text.trim() : "";
      if (!text) return null;
      return {
        text,
        dedupeKey: typeof entry.dedupeKey === "string" ? entry.dedupeKey : undefined,
        timestamp: typeof entry.timestamp === "string" ? entry.timestamp : undefined,
      };
    })
    .filter((line): line is { text: string; dedupeKey?: string; timestamp?: string } => line !== null);

  if (parsed.length === 0) {
    throw new Error("Provide at least one line to generate");
  }

  return parsed;
}

function parseMatchRequest(body: unknown): { matchUrl?: string; matchId?: string } {
  if (!body || typeof body !== "object") {
    throw new Error("Request body must be a JSON object");
  }

  const { matchUrl, matchId } = body as { matchUrl?: unknown; matchId?: unknown };
  const url = typeof matchUrl === "string" ? matchUrl.trim() : undefined;
  const id = typeof matchId === "string" ? matchId.trim() : undefined;

  if (!url && !id) {
    throw new Error("Provide matchUrl or matchId");
  }

  return { matchUrl: url, matchId: id };
}

async function serveStatic(pathname: string, res: ServerResponse): Promise<boolean> {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const filePath = join(publicDir, safePath);

  if (!filePath.startsWith(publicDir)) {
    sendJson(res, 403, { error: "Forbidden" });
    return true;
  }

  try {
    const content = await readFile(filePath);
    const ext = extname(filePath);
    res.writeHead(200, { "Content-Type": mimeTypes[ext] ?? "application/octet-stream" });
    res.end(content);
    return true;
  } catch {
    return false;
  }
}

async function handleCommentary(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const body = await readJsonBody(req);
    const lines = parseCastLines(body);
    await castLinesOverSse(res, lines, { source: "manual" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    sendJson(res, 400, { error: message });
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  if (req.method === "GET" && url.pathname === "/api/config") {
    sendJson(res, 200, {
      voiceId: getVoiceId(),
      modelId: getModelId(),
      apifyConfigured: isApifyConfigured(),
      apifyActor: getApifyActorId(),
      livescoreAvailable: true,
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/apify/live-matches") {
    try {
      if (!isApifyConfigured()) {
        sendJson(res, 400, { error: "APIFY_TOKEN is missing. Add it to .env." });
        return;
      }

      const matches = await fetchLiveFootballMatches();
      sendJson(res, 200, { matches });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const status = isApifyQuotaError(error) ? 402 : 500;
      sendJson(res, status, {
        error: message,
        quotaExceeded: isApifyQuotaError(error),
        upgradeUrl: error instanceof ApifyQuotaError ? error.upgradeUrl : undefined,
      });
    }
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/livescore/live-matches") {
    try {
      const matches = await fetchLiveScoreMatchesWithCommentary();
      const liveCount = matches.filter((match) => {
        const status = match.status?.toLowerCase() ?? "";
        return status.includes("'") || status === "ht" || status === "live";
      }).length;
      const commentaryCount = matches.filter((m) => m.commentaryAvailable).length;
      const eventsCount = matches.filter((m) => m.eventsAvailable).length;
      sendJson(res, 200, { matches, count: matches.length, liveCount, commentaryCount, eventsCount });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      sendJson(res, 500, { error: message });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/livescore/commentary") {
    try {
      const body = await readJsonBody(req);
      const { matchUrl, matchId } = parseMatchRequest(body);
      const result = await fetchLiveScoreCommentary(matchUrl, matchId);
      sendJson(res, 200, result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      sendJson(res, 400, { error: message });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/livescore/events") {
    try {
      const body = await readJsonBody(req);
      const { matchUrl, matchId } = parseMatchRequest(body);
      const result = await fetchLiveScoreEvents(matchUrl, matchId);
      sendJson(res, 200, result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      sendJson(res, 400, { error: message });
    }
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/demo/commentary") {
    try {
      const result = await fetchDemoCommentaryLines();
      sendJson(res, 200, result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      sendJson(res, 500, { error: message });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/apify/commentary") {
    try {
      if (!isApifyConfigured()) {
        sendJson(res, 400, { error: "APIFY_TOKEN is missing. Add it to .env." });
        return;
      }

      const body = await readJsonBody(req);
      const { matchUrl, matchId } = parseMatchRequest(body);
      const result = await fetchCommentaryLines(matchUrl, matchId);
      sendJson(res, 200, result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const status = isApifyQuotaError(error) ? 402 : 400;
      sendJson(res, status, {
        error: message,
        quotaExceeded: isApifyQuotaError(error),
        upgradeUrl: error instanceof ApifyQuotaError ? error.upgradeUrl : undefined,
      });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/commentary") {
    await handleCommentary(req, res);
    return;
  }

  if (req.method === "GET") {
    const served = await serveStatic(url.pathname, res);
    if (served) return;
  }

  sendJson(res, 404, { error: "Not found" });
});

server.listen(port, () => {
  console.log(`Commentary benchmark UI running at http://localhost:${port}`);
});
