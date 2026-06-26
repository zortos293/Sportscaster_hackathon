"use client";

import { useMemo, useState } from "react";
import type { CommentaryDebugEntry, TimelineDebugInfo } from "@/lib/debug-types";

type BroadcastDebugPaneProps = {
  open: boolean;
  onToggle: () => void;
  commentaryLog: CommentaryDebugEntry[];
  timelineDebug: TimelineDebugInfo | null;
  videoCurrentTime: number;
};

function formatWallTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  });
}

function formatVideoTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toFixed(1).padStart(4, "0")}`;
}

function sourceBadgeClass(source: CommentaryDebugEntry["source"]): string {
  if (source === "cursor" || source === "llm") {
    return "bg-emerald-50 text-emerald-800 ring-emerald-600/20";
  }
  if (source === "template") {
    return "bg-amber-50 text-amber-800 ring-amber-600/20";
  }
  return "bg-red-50 text-red-800 ring-red-600/20";
}

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  const [expanded, setExpanded] = useState(false);
  const text = useMemo(() => JSON.stringify(value, null, 2), [value]);

  return (
    <div className="rounded-lg ring-1 ring-black/10">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium text-neutral-700 hover:bg-neutral-950/[0.02]"
      >
        <span>{label}</span>
        <span className="font-mono text-neutral-500">{expanded ? "−" : "+"}</span>
      </button>
      {expanded ? (
        <pre className="max-h-80 overflow-auto border-t border-black/10 bg-neutral-950 p-3 text-[11px]/5 text-emerald-100">
          {text}
        </pre>
      ) : null}
    </div>
  );
}

export function BroadcastDebugPane({
  open,
  onToggle,
  commentaryLog,
  timelineDebug,
  videoCurrentTime,
}: BroadcastDebugPaneProps) {
  const [tab, setTab] = useState<"commentary" | "espn">("commentary");

  return (
    <div className="mt-8 rounded-xl ring-1 ring-black/10">
      <div className="flex items-center justify-between gap-4 border-b border-black/10 px-4 py-3 sm:px-5">
        <div>
          <p className="font-mono text-xs/5 text-violet-700">Developer</p>
          <h3 className="text-sm font-semibold text-neutral-950">Debug pane</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden font-mono text-xs tabular-nums text-neutral-500 sm:inline">
            video {formatVideoTime(videoCurrentTime)}
          </span>
          <button
            type="button"
            onClick={onToggle}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-violet-700 ring-1 ring-black/10"
          >
            {open ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      {open ? (
        <div className="p-4 sm:p-5">
          <div className="mb-4 flex gap-2">
            <button
              type="button"
              onClick={() => setTab("commentary")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ring-1 ring-black/10 ${
                tab === "commentary"
                  ? "bg-violet-600 text-white ring-violet-600"
                  : "text-neutral-700"
              }`}
            >
              Commentary ({commentaryLog.length})
            </button>
            <button
              type="button"
              onClick={() => setTab("espn")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ring-1 ring-black/10 ${
                tab === "espn" ? "bg-violet-600 text-white ring-violet-600" : "text-neutral-700"
              }`}
            >
              ESPN data
            </button>
          </div>

          {tab === "commentary" ? (
            <div className="space-y-3">
              {commentaryLog.length === 0 ? (
                <p className="text-sm/6 text-neutral-600">
                  Commentary entries appear here as timeline events fire.
                </p>
              ) : (
                commentaryLog.map((entry) => (
                  <article
                    key={`${entry.id}-${entry.generatedAt}`}
                    className="rounded-lg bg-neutral-950/[0.03] p-3 ring-1 ring-black/5"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs tabular-nums text-neutral-600">
                        {formatWallTime(entry.generatedAt)}
                      </span>
                      <span className="font-mono text-xs tabular-nums text-neutral-500">
                        @ {formatVideoTime(entry.videoAt)}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ring-1 ${sourceBadgeClass(entry.source)}`}
                      >
                        {entry.source}
                      </span>
                      {entry.model ? (
                        <span className="font-mono text-[10px] text-neutral-500">{entry.model}</span>
                      ) : null}
                    </div>

                    <p className="mt-2 text-sm/6 font-medium text-neutral-950">{entry.text}</p>

                    <dl className="mt-3 grid gap-2 text-xs/5 text-neutral-600 sm:grid-cols-2">
                      <div>
                        <dt className="font-medium text-neutral-700">ESPN play</dt>
                        <dd className="mt-0.5">{entry.event.description}</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-neutral-700">Score / period</dt>
                        <dd className="mt-0.5">
                          {entry.event.scoreAway}–{entry.event.scoreHome} · {entry.event.periodLabel}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-medium text-neutral-700">Moment type</dt>
                        <dd className="mt-0.5 font-mono text-xs">{entry.event.kind}</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-neutral-700">Event id</dt>
                        <dd className="mt-0.5 font-mono">{entry.event.id}</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-neutral-700">Game elapsed</dt>
                        <dd className="mt-0.5 font-mono">{entry.event.gameElapsed}s</dd>
                      </div>
                    </dl>

                      {entry.userPrompt ? (
                        <details className="mt-3">
                          <summary className="cursor-pointer text-xs font-medium text-violet-700">
                            LLM prompt
                          </summary>
                          <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-neutral-950 p-3 text-[11px]/5 text-emerald-100">
                            {entry.userPrompt}
                          </pre>
                        </details>
                      ) : null}
                  </article>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {!timelineDebug ? (
                <p className="text-sm/6 text-neutral-600">
                  ESPN data loads when the video timeline is built.
                </p>
              ) : (
                <>
                  <dl className="grid gap-3 text-sm/6 sm:grid-cols-2">
                    <div>
                      <dt className="text-xs font-medium text-neutral-700">Sync mode</dt>
                      <dd className="mt-0.5 font-mono text-xs text-neutral-950">
                        {timelineDebug.videoMode ?? "highlights"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-neutral-700">Fetched at</dt>
                      <dd className="mt-0.5 font-mono text-xs tabular-nums text-neutral-950">
                        {formatWallTime(timelineDebug.fetchedAt)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-neutral-700">Timeline events</dt>
                      <dd className="mt-0.5 font-mono text-xs text-neutral-950">
                        {timelineDebug.events.length}
                      </dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-xs font-medium text-neutral-700">ESPN URL</dt>
                      <dd className="mt-0.5 break-all font-mono text-xs text-violet-700">
                        <a href={timelineDebug.espnUrl} target="_blank" rel="noreferrer">
                          {timelineDebug.espnUrl}
                        </a>
                      </dd>
                    </div>
                  </dl>

                  <JsonBlock label="Mapped timeline events" value={timelineDebug.events} />
                  <JsonBlock label="ESPN summary (scoring / key events)" value={timelineDebug.summary} />
                  <JsonBlock label="Full ESPN API response" value={timelineDebug.payload} />
                </>
              )}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
