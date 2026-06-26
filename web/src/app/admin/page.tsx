"use client";

import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { isConvexEnabled } from "@/lib/env";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type ImportedHighlightStatus = {
  id: string;
  matchId: string;
  title: string;
  subtitle: string;
  feedType: "full_match";
  alignmentStatus?: string;
  alignmentConfidence?: number;
  alignmentStatusMessage?: string;
  eventsLineCount: number;
  cacheable: boolean;
  cached: boolean;
  lineCount: number;
  cachedAt: number | null;
  source: string | null;
};

type CacheResponse = {
  ok?: boolean;
  results?: Array<{
    title: string;
    lineCount: number;
    error?: string;
  }>;
  result?: {
    title: string;
    lineCount: number;
    error?: string;
  };
};

type DeleteHighlightResponse = {
  ok?: boolean;
  error?: string;
  result?: {
    gameId: string;
    videoDeleted: boolean;
  };
};

type FullMatchImportProgress = {
  gameId: string;
  title: string;
  status: string;
  statusMessage?: string;
  confidence?: number;
  durationSeconds?: number;
  updatedAt?: number;
};

type FullMatchImportsResponse = {
  imports?: FullMatchImportProgress[];
  error?: string;
};

type StatusResponse = {
  games: ImportedHighlightStatus[];
  commentaryConfigured: boolean;
  error?: string;
};

function formatCachedAt(timestamp: number | null): string {
  if (!timestamp) return "Not cached";
  return new Date(timestamp).toLocaleString();
}

function fullMatchGameId(liveScoreMatchId: string): string {
  return `fm-${liveScoreMatchId.trim()}`;
}

function progressPercent(status: string): number {
  switch (status) {
    case "starting":
      return 8;
    case "importing":
      return 25;
    case "ocr":
      return 60;
    case "aligning":
      return 82;
    case "aligned":
      return 100;
    case "error":
      return 100;
    default:
      return 15;
  }
}

function progressLabel(status: string): string {
  switch (status) {
    case "starting":
      return "Starting";
    case "importing":
      return "Downloading";
    case "ocr":
      return "Reading clock";
    case "aligning":
      return "Aligning moments";
    case "aligned":
      return "Complete";
    case "error":
      return "Failed";
    default:
      return status || "Working";
  }
}

export default function AdminPage() {
  const [games, setGames] = useState<ImportedHighlightStatus[]>([]);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [busyGameId, setBusyGameId] = useState<string | null>(null);
  const [deletingGameId, setDeletingGameId] = useState<string | null>(null);
  const [cachingAll, setCachingAll] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [commentaryConfigured, setCommentaryConfigured] = useState(false);
  const [fullMatchUrl, setFullMatchUrl] = useState("");
  const [fullMatchLiveScoreId, setFullMatchLiveScoreId] = useState("");
  const [fullMatchTitle, setFullMatchTitle] = useState("");
  const [importingFullMatch, setImportingFullMatch] = useState(false);
  const [importProgress, setImportProgress] = useState<FullMatchImportProgress | null>(null);
  const [manualGameId, setManualGameId] = useState("");
  const [manualFirstHalfVideoAt, setManualFirstHalfVideoAt] = useState("");
  const [manualSecondHalfVideoAt, setManualSecondHalfVideoAt] = useState("");
  const [manualAligning, setManualAligning] = useState(false);
  const [realigningGameId, setRealigningGameId] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    setLoadingStatus(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/cache-matches");
      const data = (await response.json()) as StatusResponse;
      if (!response.ok) throw new Error(data.error ?? "Failed to load imported highlights");
      setGames(data.games.filter((game) => game.feedType === "full_match"));
      setCommentaryConfigured(data.commentaryConfigured);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load status");
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/admin/cache-matches");
        const data = (await response.json()) as StatusResponse;
        if (cancelled) return;
        if (!response.ok) throw new Error(data.error ?? "Failed to load imported highlights");
        setGames(data.games.filter((game) => game.feedType === "full_match"));
        setCommentaryConfigured(data.commentaryConfigured);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load status");
        }
      } finally {
        if (!cancelled) setLoadingStatus(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function cacheGame(gameId: string) {
    setBusyGameId(gameId);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/admin/cache-matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId }),
      });
      const data = (await response.json()) as CacheResponse;
      if (!response.ok || data.result?.error) {
        throw new Error(data.result?.error ?? "Cache request failed");
      }
      setMessage(`Cached ${data.result?.lineCount ?? 0} lines for ${data.result?.title}.`);
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cache failed");
    } finally {
      setBusyGameId(null);
    }
  }

  async function deleteHighlight(game: ImportedHighlightStatus) {
    const confirmed = window.confirm(
      `Delete "${game.title}"? This removes the import, aligned moments, cached commentary, and local video file.`,
    );
    if (!confirmed) return;

    setDeletingGameId(game.id);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/full-match?gameId=${encodeURIComponent(game.id)}`,
        { method: "DELETE" },
      );
      const data = (await response.json()) as DeleteHighlightResponse;
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Delete failed");
      }
      setMessage(
        `Deleted ${game.title}${data.result?.videoDeleted ? " and removed its local video file" : ""}.`,
      );
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeletingGameId(null);
    }
  }

  async function cacheAll() {
    setCachingAll(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/admin/cache-matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      const data = (await response.json()) as CacheResponse;
      const failed = data.results?.filter((result) => result.error) ?? [];
      if (!response.ok || failed.length > 0) {
        throw new Error(
          failed.map((result) => `${result.title}: ${result.error}`).join("; ") ||
            "Bulk cache failed",
        );
      }
      const totalLines =
        data.results?.reduce((sum, result) => sum + result.lineCount, 0) ?? 0;
      setMessage(
        `Cached ${totalLines} lines across ${data.results?.length ?? 0} imported highlight(s).`,
      );
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk cache failed");
    } finally {
      setCachingAll(false);
    }
  }

  async function refreshImportProgress(gameId: string) {
    const response = await fetch("/api/admin/full-match");
    const data = (await response.json()) as FullMatchImportsResponse;
    if (!response.ok) {
      throw new Error(data.error ?? "Failed to load import progress");
    }
    const current = data.imports?.find((item) => item.gameId === gameId);
    if (current) {
      setImportProgress(current);
    }
    return current;
  }

  async function importFullMatch() {
    const liveScoreMatchId = fullMatchLiveScoreId.trim();
    const gameId = fullMatchGameId(liveScoreMatchId);
    const title = fullMatchTitle.trim() || `LiveScore ${liveScoreMatchId}`;
    let progressTimer: number | undefined;

    setImportingFullMatch(true);
    setImportProgress({
      gameId,
      title,
      status: "starting",
      statusMessage: "Checking local tools and finding the LiveScore match",
    });
    setMessage(null);
    setError(null);
    try {
      progressTimer = window.setInterval(() => {
        void refreshImportProgress(gameId).catch(() => undefined);
      }, 2500);

      const response = await fetch("/api/admin/full-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId,
          sourceUrl: fullMatchUrl,
          liveScoreMatchId,
          title: fullMatchTitle || undefined,
        }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        result?: {
          title: string;
          eventCount?: number;
          anchorCount?: number;
          segmentCount?: number;
          alignmentMode?: string;
        };
      };
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Import failed");
      setImportProgress({
        gameId,
        title: data.result?.title ?? title,
        status: "aligned",
        statusMessage: `Aligned ${data.result?.eventCount ?? 0} moments from ${data.result?.anchorCount ?? 0} OCR anchors (${data.result?.segmentCount ?? 0} clip segments, ${data.result?.alignmentMode ?? "highlight"} mode)`,
      });
      setMessage(
        `Imported ${data.result?.title ?? "highlight"} with ${data.result?.eventCount ?? 0} aligned moments from ${data.result?.anchorCount ?? 0} OCR anchors (${data.result?.segmentCount ?? 0} clip segments, ${data.result?.alignmentMode ?? "highlight"} mode).`,
      );
      setFullMatchUrl("");
      setFullMatchLiveScoreId("");
      setFullMatchTitle("");
      await refreshStatus();
    } catch (err) {
      await refreshImportProgress(gameId)
        .then((current) => {
          if (!current) {
            setImportProgress((previous) =>
              previous?.gameId === gameId
                ? {
                    ...previous,
                    status: "error",
                    statusMessage: err instanceof Error ? err.message : "Import failed",
                  }
                : previous,
            );
          }
        })
        .catch(() => {
        setImportProgress((current) =>
          current?.gameId === gameId
            ? {
                ...current,
                status: "error",
                statusMessage: err instanceof Error ? err.message : "Import failed",
              }
            : current,
        );
        });
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      if (progressTimer != null) {
        window.clearInterval(progressTimer);
      }
      setImportingFullMatch(false);
    }
  }

  async function realignHighlight(game: ImportedHighlightStatus, reOcr = false) {
    setRealigningGameId(game.id);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/admin/full-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "realign",
          gameId: game.id,
          alignmentMode: "highlight",
          reOcr,
        }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        result?: {
          title: string;
          eventCount?: number;
          anchorCount?: number;
          segmentCount?: number;
          alignmentMode?: string;
        };
      };
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Realignment failed");
      setMessage(
        `Re-aligned ${data.result?.title ?? game.title}: ${data.result?.eventCount ?? 0} moments from ${data.result?.anchorCount ?? 0} anchors (${data.result?.segmentCount ?? 0} clip segments, ${data.result?.alignmentMode ?? "highlight"} mode).`,
      );
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Realignment failed");
    } finally {
      setRealigningGameId(null);
    }
  }

  async function manualAlignFullMatch() {
    setManualAligning(true);
    setMessage(null);
    setError(null);
    try {
      const firstHalfVideoAt = Number.parseFloat(manualFirstHalfVideoAt);
      const secondHalfVideoAt = manualSecondHalfVideoAt.trim()
        ? Number.parseFloat(manualSecondHalfVideoAt)
        : undefined;
      if (!Number.isFinite(firstHalfVideoAt)) {
        throw new Error("Enter the video second where first-half kickoff starts.");
      }
      if (secondHalfVideoAt != null && !Number.isFinite(secondHalfVideoAt)) {
        throw new Error("Second-half kickoff must be a video second.");
      }

      const response = await fetch("/api/admin/full-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "manual-align",
          gameId: manualGameId,
          firstHalfVideoAt,
          secondHalfVideoAt,
        }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        result?: { title: string; eventCount?: number };
      };
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Manual alignment failed");
      setMessage(
        `Manual alignment saved for ${data.result?.title ?? manualGameId} with ${data.result?.eventCount ?? 0} moments.`,
      );
      setManualGameId("");
      setManualFirstHalfVideoAt("");
      setManualSecondHalfVideoAt("");
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Manual alignment failed");
    } finally {
      setManualAligning(false);
    }
  }

  const cachedCount = games.filter((game) => game.cached).length;
  const cacheableCount = games.filter((game) => game.cacheable).length;

  function renderGameCard(game: ImportedHighlightStatus) {
    return (
      <article key={game.id} className="rounded-xl p-5 ring-1 ring-black/10 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-mono text-sm/6 text-emerald-700">{game.subtitle}</p>
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
                Imported highlight
              </span>
            </div>
            <h2 className="mt-1 text-xl font-semibold text-neutral-950">{game.title}</h2>
            <p className="mt-1 text-sm/6 text-neutral-500">
              LiveScore {game.matchId} · OCR confidence{" "}
              {game.alignmentConfidence != null
                ? `${Math.round(game.alignmentConfidence * 100)}%`
                : "—"}
            </p>
            <dl className="mt-3 grid gap-1 text-sm/6 text-neutral-600">
              <div className="flex gap-2">
                <dt className="text-neutral-500">Timeline</dt>
                <dd>
                  {game.eventsLineCount} aligned moments · {game.alignmentStatus ?? "pending"}
                </dd>
              </div>
              {game.alignmentStatusMessage ? (
                <div className="flex gap-2">
                  <dt className="text-neutral-500">Alignment</dt>
                  <dd>{game.alignmentStatusMessage}</dd>
                </div>
              ) : null}
              <div className="flex gap-2">
                <dt className="text-neutral-500">Cache</dt>
                <dd>{game.cached ? `${game.lineCount} lines` : game.cacheable ? "Ready" : "No feed"}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-neutral-500">Updated</dt>
                <dd>{formatCachedAt(game.cachedAt)}</dd>
              </div>
              {game.source ? (
                <div className="flex gap-2">
                  <dt className="text-neutral-500">Source</dt>
                  <dd>{game.source}</dd>
                </div>
              ) : null}
            </dl>
          </div>
          <div className="flex shrink-0 flex-col gap-2">
            <button
              type="button"
              onClick={() => void cacheGame(game.id)}
              disabled={
                busyGameId === game.id ||
                deletingGameId === game.id ||
                cachingAll ||
                !isConvexEnabled() ||
                !commentaryConfigured ||
                !game.cacheable
              }
              className="rounded-lg px-4 py-2.5 text-sm/6 font-medium text-neutral-950 ring-1 ring-black/10 disabled:opacity-50"
            >
              {busyGameId === game.id ? "Caching…" : "Cache commentary"}
            </button>
            <Link
              href={`/dashboard/watch/${game.id}`}
              className="rounded-lg px-4 py-2.5 text-center text-sm/6 font-medium text-emerald-700 ring-1 ring-black/10"
            >
              Watch broadcast
            </Link>
            <button
              type="button"
              onClick={() => void realignHighlight(game)}
              disabled={
                realigningGameId === game.id ||
                deletingGameId === game.id ||
                busyGameId === game.id ||
                game.alignmentStatus !== "aligned"
              }
              className="rounded-lg px-4 py-2.5 text-center text-sm/6 font-medium text-neutral-950 ring-1 ring-black/10 disabled:opacity-50"
            >
              {realigningGameId === game.id ? "Re-aligning…" : "Re-align markers"}
            </button>
            <button
              type="button"
              onClick={() => void realignHighlight(game, true)}
              disabled={
                realigningGameId === game.id ||
                deletingGameId === game.id ||
                busyGameId === game.id ||
                game.alignmentStatus !== "aligned"
              }
              className="rounded-lg px-4 py-2.5 text-center text-sm/6 font-medium text-neutral-700 ring-1 ring-black/10 disabled:opacity-50"
            >
              Re-align with re-OCR
            </button>
            <button
              type="button"
              onClick={() => void deleteHighlight(game)}
              disabled={deletingGameId === game.id || busyGameId === game.id}
              className="rounded-lg px-4 py-2.5 text-center text-sm/6 font-medium text-red-700 ring-1 ring-red-200 disabled:opacity-50"
            >
              {deletingGameId === game.id ? "Deleting…" : "Delete highlight"}
            </button>
          </div>
        </div>
      </article>
    );
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-8 sm:py-10 lg:px-8 lg:py-12">
        <div className="max-w-3xl">
          <p className="font-mono text-sm/6 text-emerald-700">Admin</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance text-neutral-950 sm:text-4xl">
            Imported highlights
          </h1>
          <p className="mt-4 max-w-[48ch] text-base/7 text-pretty text-neutral-600 sm:text-sm/6">
            Import your own highlight videos, align them by OCR clock and LiveScore match ID,
            then cache Cursor commentary for playback.
          </p>
        </div>

        {!isConvexEnabled() ? (
          <div className="mt-8 rounded-xl p-5 ring-1 ring-amber-200">
            <p className="text-sm/6 text-amber-900">
              Convex is not configured. Run <code className="font-mono text-xs">npx convex dev</code>{" "}
              in <code className="font-mono text-xs">web/</code> and set{" "}
              <code className="font-mono text-xs">NEXT_PUBLIC_CONVEX_URL</code>.
            </p>
          </div>
        ) : null}

        {!commentaryConfigured ? (
          <div className="mt-4 rounded-xl p-5 ring-1 ring-amber-200">
            <p className="text-sm/6 text-amber-900">
              Cursor commentary is not configured. Set{" "}
              <code className="font-mono text-xs">CURSOR_API_KEY</code> for synchronous caching.
            </p>
          </div>
        ) : null}

        <section className="mt-8 rounded-xl p-5 ring-1 ring-black/10 sm:p-6">
          <h2 className="text-lg font-semibold text-neutral-950">Import highlight video</h2>
          <p className="mt-1 text-sm/6 text-neutral-600">
            Download a YouTube/VOD highlight video locally, OCR the scoreboard clock, and align
            LiveScore events by minute. Requires <code className="font-mono text-xs">yt-dlp</code>,{" "}
            <code className="font-mono text-xs">ffmpeg</code>, and{" "}
            <code className="font-mono text-xs">tesseract</code>.
          </p>

          <div className="mt-5 grid gap-4">
            <label className="grid gap-1 text-sm/6 font-medium text-neutral-700">
              YouTube or VOD URL
              <input
                value={fullMatchUrl}
                onChange={(event) => setFullMatchUrl(event.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="rounded-lg px-3 py-2 text-base/7 font-normal text-neutral-950 ring-1 ring-black/10 outline-none focus:ring-2 focus:ring-emerald-600 sm:text-sm/6"
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1 text-sm/6 font-medium text-neutral-700">
                LiveScore match ID
                <input
                  value={fullMatchLiveScoreId}
                  onChange={(event) => setFullMatchLiveScoreId(event.target.value)}
                  placeholder="1234567"
                  className="rounded-lg px-3 py-2 text-base/7 font-normal text-neutral-950 ring-1 ring-black/10 outline-none focus:ring-2 focus:ring-emerald-600 sm:text-sm/6"
                />
              </label>
              <label className="grid gap-1 text-sm/6 font-medium text-neutral-700">
                Title (optional)
                <input
                  value={fullMatchTitle}
                  onChange={(event) => setFullMatchTitle(event.target.value)}
                  placeholder="Team A vs Team B"
                  className="rounded-lg px-3 py-2 text-base/7 font-normal text-neutral-950 ring-1 ring-black/10 outline-none focus:ring-2 focus:ring-emerald-600 sm:text-sm/6"
                />
              </label>
            </div>
            <button
              type="button"
              onClick={() => void importFullMatch()}
              disabled={
                importingFullMatch ||
                !isConvexEnabled() ||
                !fullMatchUrl.trim() ||
                !fullMatchLiveScoreId.trim()
              }
              className="w-fit rounded-lg bg-neutral-950 px-4 py-2.5 text-base/7 font-medium text-white disabled:opacity-50 sm:text-sm/6"
            >
              {importingFullMatch ? "Importing and aligning…" : "Import highlight"}
            </button>
            {importProgress ? (
              <div className="rounded-xl bg-neutral-950/[0.03] p-4 ring-1 ring-black/10">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm/6 font-semibold text-neutral-950">
                      {progressLabel(importProgress.status)} · {importProgress.title}
                    </p>
                    <p className="mt-1 text-sm/6 text-neutral-600">
                      {importProgress.statusMessage ?? "Working on the import…"}
                    </p>
                    {importProgress.updatedAt ? (
                      <p className="mt-1 text-xs/5 text-neutral-500">
                        Updated {new Date(importProgress.updatedAt).toLocaleTimeString()}
                      </p>
                    ) : null}
                  </div>
                  <span
                    className={`w-fit rounded-full px-2 py-0.5 text-xs font-medium ${
                      importProgress.status === "error"
                        ? "bg-red-50 text-red-700 ring-1 ring-red-200"
                        : importProgress.status === "aligned"
                          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                          : "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                    }`}
                  >
                    {progressPercent(importProgress.status)}%
                  </span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-200">
                  <div
                    className={`h-full rounded-full transition-all ${
                      importProgress.status === "error" ? "bg-red-500" : "bg-emerald-600"
                    }`}
                    style={{ width: `${progressPercent(importProgress.status)}%` }}
                  />
                </div>
                {importingFullMatch ? (
                  <p className="mt-2 text-xs/5 text-neutral-500">
                    This can take a while for long videos. You can leave this page open while OCR
                    samples the clock.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="mt-6 border-t border-black/10 pt-5">
            <h3 className="text-sm/6 font-semibold text-neutral-950">Manual offset fallback</h3>
            <p className="mt-1 text-sm/6 text-neutral-600">
              If OCR misses the clock, enter the imported game ID and video seconds for kickoff.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <input
                value={manualGameId}
                onChange={(event) => setManualGameId(event.target.value)}
                placeholder="fm-1234567"
                className="rounded-lg px-3 py-2 text-base/7 font-normal text-neutral-950 ring-1 ring-black/10 outline-none focus:ring-2 focus:ring-emerald-600 sm:text-sm/6"
              />
              <input
                value={manualFirstHalfVideoAt}
                onChange={(event) => setManualFirstHalfVideoAt(event.target.value)}
                placeholder="Kickoff second"
                className="rounded-lg px-3 py-2 text-base/7 font-normal text-neutral-950 ring-1 ring-black/10 outline-none focus:ring-2 focus:ring-emerald-600 sm:text-sm/6"
              />
              <input
                value={manualSecondHalfVideoAt}
                onChange={(event) => setManualSecondHalfVideoAt(event.target.value)}
                placeholder="Second-half second"
                className="rounded-lg px-3 py-2 text-base/7 font-normal text-neutral-950 ring-1 ring-black/10 outline-none focus:ring-2 focus:ring-emerald-600 sm:text-sm/6"
              />
            </div>
            <button
              type="button"
              onClick={() => void manualAlignFullMatch()}
              disabled={
                manualAligning ||
                !isConvexEnabled() ||
                !manualGameId.trim() ||
                !manualFirstHalfVideoAt.trim()
              }
              className="mt-4 rounded-lg px-4 py-2.5 text-base/7 font-medium text-neutral-950 ring-1 ring-black/10 disabled:opacity-50 sm:text-sm/6"
            >
              {manualAligning ? "Saving manual alignment…" : "Save manual alignment"}
            </button>
          </div>
        </section>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl p-5 ring-1 ring-black/10">
            <p className="text-sm/6 text-neutral-600">Imported</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-neutral-950">
              {loadingStatus ? "…" : games.length}
            </p>
          </div>
          <div className="rounded-xl p-5 ring-1 ring-black/10">
            <p className="text-sm/6 text-neutral-600">Cacheable</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-neutral-950">
              {loadingStatus ? "…" : cacheableCount}
            </p>
          </div>
          <div className="rounded-xl p-5 ring-1 ring-black/10">
            <p className="text-sm/6 text-neutral-600">Cached</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-neutral-950">
              {cachedCount}
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            onClick={() => void cacheAll()}
            disabled={cachingAll || !isConvexEnabled() || !commentaryConfigured}
            className="rounded-lg bg-emerald-700 px-4 py-2.5 text-base/7 font-medium text-white disabled:opacity-50 sm:text-sm/6"
          >
            {cachingAll ? "Caching highlights…" : "Cache imported highlights"}
          </button>
          <button
            type="button"
            onClick={() => void refreshStatus()}
            disabled={loadingStatus}
            className="rounded-lg px-4 py-2.5 text-base/7 font-medium text-neutral-700 ring-1 ring-black/10 sm:text-sm/6"
          >
            Refresh
          </button>
          <Link
            href="/dashboard"
            className="rounded-lg px-4 py-2.5 text-center text-base/7 font-medium text-emerald-700 sm:text-sm/6"
          >
            Back to dashboard
          </Link>
        </div>

        {message ? (
          <p className="mt-6 rounded-xl bg-emerald-50 px-4 py-3 text-sm/6 text-emerald-900 ring-1 ring-emerald-200">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm/6 text-red-800 ring-1 ring-red-200">
            {error}
          </p>
        ) : null}

        <section className="mt-10">
          <h2 className="text-lg font-semibold text-neutral-950">Imported highlights</h2>
          {loadingStatus && games.length === 0 ? (
            <p className="mt-4 text-sm/6 text-neutral-600">Loading imports…</p>
          ) : null}
          {!loadingStatus && games.length === 0 ? (
            <p className="mt-4 text-sm/6 text-neutral-600">
              No imported highlights yet. Add a YouTube/VOD URL above to create one.
            </p>
          ) : null}
          <div className="mt-4 grid gap-4">{games.map(renderGameCard)}</div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
