import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { extractBet365CommentaryLines, type CommentaryLine } from "./apify.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const demoPath = join(__dirname, "..", "data", "demo-bet365-match.json");

let cachedDetail: Record<string, unknown> | undefined;

async function loadDemoDetail(): Promise<Record<string, unknown>> {
  if (cachedDetail) return cachedDetail;
  const raw = await readFile(demoPath, "utf-8");
  cachedDetail = JSON.parse(raw) as Record<string, unknown>;
  return cachedDetail;
}

export async function fetchDemoCommentaryLines(): Promise<{
  matchUrl: string;
  lines: CommentaryLine[];
  dataNote: string;
  demo: true;
}> {
  const detail = await loadDemoDetail();
  const lines = extractBet365CommentaryLines(detail);
  const home = String(detail.homeTeam ?? "Home");
  const away = String(detail.awayTeam ?? "Away");

  return {
    matchUrl: String(detail.webUrl ?? "demo://bet365/4679449"),
    lines,
    dataNote: `Demo data: ${home} vs ${away} (${lines.length} timestamped events). No Apify run used.`,
    demo: true,
  };
}
