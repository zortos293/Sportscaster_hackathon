const sampleLines = [
  "And we're underway here at the stadium!",
  "Smith picks up the ball on the left flank, looking for space.",
  "He cuts inside, beats one defender — this is getting interesting.",
  "SHOOT! What a strike! The keeper had no chance!",
  "GOAL! The crowd erupts! What a moment!",
];

const linesInput = document.getElementById("lines-input");
const queueManualBtn = document.getElementById("queue-manual-btn");
const generateBtn = document.getElementById("generate-btn");
const batchSizeSelect = document.getElementById("batch-size");
const loadSampleBtn = document.getElementById("load-sample");
const autoPlayCheckbox = document.getElementById("auto-play");
const linesList = document.getElementById("lines-list");
const runStatus = document.getElementById("run-status");
const summary = document.getElementById("summary");
const voiceIdEl = document.getElementById("voice-id");
const modelIdEl = document.getElementById("model-id");
const apifyStatusEl = document.getElementById("data-source-status");
const loadMatchesBtn = document.getElementById("load-matches");
const matchSelect = document.getElementById("match-select");
const matchSourceSelect = document.getElementById("match-source");
const gameIdLabel = document.getElementById("game-id-label");
const fetchMatchBtn = document.getElementById("fetch-match-btn");
const loadDemoBtn = document.getElementById("load-demo-btn");
const pollLiveCheckbox = document.getElementById("poll-live");
const apifyHint = document.getElementById("apify-hint");
const gameIdInput = document.getElementById("game-id-input");
const commentaryOnlyCheckbox = document.getElementById("commentary-only");
const lineTypeSelect = document.getElementById("line-type");
const lineTypeLabel = document.getElementById("line-type-label");
const feedOnlyLabel = document.getElementById("feed-only-label");
const feedOnlyWrap = document.getElementById("feed-only-wrap");
const dataNoteEl = document.getElementById("data-note");

const DEFAULT_LIVESCORE_COMMENTARY_HINT =
  'Uses the free <a href="https://www.livescore.com" target="_blank" rel="noreferrer">LiveScore</a> public API — full text commentary with timestamps. Try event ID <code>1417944</code> (Japan vs Sweden).';
const DEFAULT_LIVESCORE_EVENTS_HINT =
  'Uses LiveScore incident data — goals, cards, and penalties with timestamps. Works for most finished matches, including lower leagues (e.g. event ID <code>1750868</code>).';
const DEFAULT_LIVESCORE_HINT = DEFAULT_LIVESCORE_COMMENTARY_HINT;
const DEFAULT_APIFY_HINT =
  'Uses <a href="https://apify.com/zen-studio/bet365-sports-data" target="_blank" rel="noreferrer">Bet365 Sports Data Scraper</a> on Apify. Requires <code>APIFY_TOKEN</code> in <code>.env</code>.';

/** @type {Map<number, { text: string, timestamp?: string, ttfaMs?: number, totalMs?: number, audioBase64?: string, dedupeKey?: string, status?: string, eventType?: string, eventCategory?: string }>} */
const lineState = new Map();

/** @type {{ matchId: string, sourceUrl?: string, homeTeamName: string, awayTeamName: string, homeScore?: number, awayScore?: number, status?: string, competitionName?: string }[]} */
let liveMatches = [];

/** @type {Set<string>} */
const knownLineKeys = new Set();

/** @type {ReturnType<typeof setInterval> | null} */
let pollTimer = null;

let lineNumberOffset = 0;
let apifyConfigured = false;
let apifyQuotaBlocked = false;
let matchSource = "livescore";

function getMatchSource() {
  return matchSourceSelect?.value === "apify" ? "apify" : "livescore";
}

function getLineType() {
  return lineTypeSelect?.value === "events" ? "events" : "commentary";
}

function updateLineTypeUi() {
  const isEvents = getLineType() === "events";
  const isLiveScore = matchSource === "livescore";

  if (lineTypeLabel) lineTypeLabel.hidden = !isLiveScore;
  if (lineTypeSelect) lineTypeSelect.hidden = !isLiveScore;
  if (feedOnlyWrap) feedOnlyWrap.hidden = !isLiveScore;
  if (feedOnlyLabel) {
    feedOnlyLabel.textContent = isEvents
      ? "Only show matches with events"
      : "Only show matches with text commentary";
  }

  if (isLiveScore) {
    showApifyHint(isEvents ? DEFAULT_LIVESCORE_EVENTS_HINT : DEFAULT_LIVESCORE_COMMENTARY_HINT);
  }

  if (liveMatches.length > 0) {
    populateMatchSelect(liveMatches);
    selectFirstVisibleMatch();
  }
}

function selectFirstVisibleMatch() {
  const firstOption = matchSelect.querySelector("option");
  if (firstOption?.value) {
    matchSelect.value = firstOption.value;
    gameIdInput.value = firstOption.value;
  }
  updateFetchButton();
}

function updateSourceUi() {
  matchSource = getMatchSource();
  const isLiveScore = matchSource === "livescore";

  if (gameIdLabel) {
    gameIdLabel.textContent = isLiveScore ? "Event ID override (optional)" : "Bet365 game ID";
  }
  if (gameIdInput) {
    gameIdInput.placeholder = isLiveScore
      ? "Optional — overrides dropdown if filled"
      : "e.g. 4679449 (Barcelona vs Newcastle)";
    if (isLiveScore && gameIdInput.value && !liveMatches.length) {
      gameIdInput.value = "";
    }
  }

  loadMatchesBtn.disabled = !isLiveScore && (apifyQuotaBlocked || !apifyConfigured);
  apifyStatusEl.textContent = isLiveScore ? "LiveScore" : apifyConfigured ? "Apify" : "Apify off";
  updateLineTypeUi();
  if (!isLiveScore) resetApifyHint();
  updateFetchButton();
}

/** @type {{ lineNumber: number, url: string }[]} */
const playbackQueue = [];
let isPlaying = false;
let activeRun = false;

function formatMs(ms) {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function setStatus(text, className) {
  runStatus.textContent = text;
  runStatus.className = `status-pill ${className}`;
}

function displayLineNumber(serverLineNumber) {
  return lineNumberOffset + serverLineNumber;
}

function getLineStatus(line) {
  if (line.audioBase64) return "ready";
  if (line.status === "generating") return "generating";
  return "pending";
}

function getPendingLines() {
  return [...lineState.entries()]
    .filter(([, line]) => getLineStatus(line) === "pending")
    .sort((a, b) => a[0] - b[0])
    .map(([lineNumber, line]) => ({ lineNumber, ...line }));
}

function updateGenerateButton() {
  const pendingCount = getPendingLines().length;
  generateBtn.disabled = pendingCount === 0 || activeRun;
  generateBtn.textContent =
    pendingCount === 0 ? "Generate audio" : `Generate audio (${pendingCount} pending)`;
}

function resetSummary() {
  summary.hidden = true;
}

function parseInputLines() {
  return linesInput.value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function renderLines() {
  if (lineState.size === 0) {
    linesList.className = "lines-list empty-state";
    linesList.textContent =
      "Fetch match lines or queue manual lines, then click Generate audio.";
    updateGenerateButton();
    return;
  }

  linesList.className = "lines-list";
  linesList.innerHTML = "";

  for (const [lineNumber, line] of [...lineState.entries()].sort((a, b) => a[0] - b[0])) {
    const status = getLineStatus(line);
    const card = document.createElement("article");
    card.className = `line-card ${status}`;
    card.dataset.line = String(lineNumber);

    const ttfa = line.ttfaMs != null ? formatMs(line.ttfaMs) : "—";
    const total = line.totalMs != null ? formatMs(line.totalMs) : "—";
    const statusLabel =
      status === "ready" ? "Ready" : status === "generating" ? "Generating" : "Pending";
    const eventBadge = line.eventType
      ? `<span class="event-badge ${escapeHtml(line.eventCategory ?? "other")}">${escapeHtml(line.eventType)}</span>`
      : "";

    card.innerHTML = `
      <div class="line-top">
        <span class="line-number">${line.timestamp ? `<span class="timestamp">${escapeHtml(line.timestamp)}</span> · ` : ""}Line ${lineNumber} · <span class="status-badge ${status}">${statusLabel}</span>${eventBadge}</span>
        <div class="line-actions">
          <button type="button" class="play-btn" data-play="${lineNumber}" ${line.audioBase64 ? "" : "disabled"}>
            Play
          </button>
        </div>
      </div>
      <p class="line-text">${escapeHtml(line.text)}</p>
      <div class="line-meta">
        <span>TTFA <strong>${ttfa}</strong></span>
        <span>Total <strong>${total}</strong></span>
        <span>${line.text.length} chars</span>
      </div>
    `;

    linesList.appendChild(card);
  }

  linesList.querySelectorAll("[data-play]").forEach((button) => {
    button.addEventListener("click", () => {
      const lineNumber = Number(button.getAttribute("data-play"));
      playLine(lineNumber, true);
    });
  });

  updateGenerateButton();
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function enqueuePlayback(lineNumber, audioBase64) {
  const blob = base64ToBlob(audioBase64, "audio/mpeg");
  const url = URL.createObjectURL(blob);
  playbackQueue.push({ lineNumber, url });

  if (autoPlayCheckbox.checked) {
    drainPlaybackQueue();
  }
}

async function drainPlaybackQueue() {
  if (isPlaying || playbackQueue.length === 0) return;

  isPlaying = true;
  setStatus("Playing commentary", "playing");

  while (playbackQueue.length > 0) {
    const item = playbackQueue.shift();
    if (!item) break;

    highlightPlayingLine(item.lineNumber);

    await new Promise((resolve) => {
      const audio = new Audio(item.url);
      audio.addEventListener("ended", () => {
        URL.revokeObjectURL(item.url);
        resolve();
      });
      audio.addEventListener("error", () => {
        URL.revokeObjectURL(item.url);
        resolve();
      });
      audio.play().catch(resolve);
    });
  }

  clearPlayingHighlight();
  isPlaying = false;

  if (activeRun) {
    setStatus("Generating", "running");
  } else {
    const pending = getPendingLines().length;
    setStatus(pending > 0 ? `${pending} pending` : "Done", pending > 0 ? "idle" : "done");
  }
}

function highlightPlayingLine(lineNumber) {
  linesList.querySelectorAll(".line-card").forEach((card) => {
    card.classList.remove("playing");
    if (card.dataset.line === String(lineNumber)) {
      card.classList.add("playing");
    }
  });
}

function clearPlayingHighlight() {
  linesList.querySelectorAll(".line-card.playing").forEach((card) => {
    card.classList.remove("playing");
  });
}

function playLine(lineNumber, interruptQueue = false) {
  const line = lineState.get(lineNumber);
  if (!line?.audioBase64) return;

  if (interruptQueue) {
    playbackQueue.splice(0, playbackQueue.length).forEach((item) => {
      URL.revokeObjectURL(item.url);
    });
    isPlaying = false;
  }

  const blob = base64ToBlob(line.audioBase64, "audio/mpeg");
  const url = URL.createObjectURL(blob);
  playbackQueue.unshift({ lineNumber, url });
  drainPlaybackQueue();
}

function base64ToBlob(base64, mimeType) {
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new Blob([bytes], { type: mimeType });
}

function renderSummary(data) {
  summary.hidden = false;
  document.getElementById("summary-ttfa-avg").textContent = formatMs(data.ttfa.avg);
  document.getElementById("summary-stream-avg").textContent = formatMs(data.stream.avg);
  document.getElementById("summary-duration").textContent = formatMs(data.benchmarkTotalMs);
  document.getElementById("summary-throughput").textContent =
    `${data.throughputCharsPerSec.toFixed(1)} chars/sec`;
}

async function consumeSseResponse(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";

    for (const chunk of chunks) {
      const linesInChunk = chunk.split("\n");
      const eventLine = linesInChunk.find((line) => line.startsWith("event: "));
      const dataLine = linesInChunk.find((line) => line.startsWith("data: "));
      if (!eventLine || !dataLine) continue;

      const event = eventLine.slice(7);
      const data = JSON.parse(dataLine.slice(6));
      handleEvent(event, data);
    }
  }
}

function showDataNote(message) {
  if (!message) {
    dataNoteEl.hidden = true;
    dataNoteEl.textContent = "";
    return;
  }
  dataNoteEl.hidden = false;
  dataNoteEl.textContent = message;
}

function addPendingLines(newLines, { replace = false } = {}) {
  if (replace) {
    lineState.clear();
    knownLineKeys.clear();
    playbackQueue.splice(0, playbackQueue.length);
    resetSummary();
  }

  let nextNumber = lineState.size === 0 ? 1 : Math.max(...lineState.keys()) + 1;
  let added = 0;

  for (const line of newLines) {
    const key = line.dedupeKey ?? `manual:${line.text}`;
    if (knownLineKeys.has(key)) continue;

    knownLineKeys.add(key);
    lineState.set(nextNumber, {
      text: line.text,
      timestamp: line.timestamp,
      dedupeKey: line.dedupeKey,
      eventType: line.eventType,
      eventCategory: line.eventCategory,
      status: "pending",
    });
    nextNumber += 1;
    added += 1;
  }

  renderLines();
  return added;
}

function queueManualLines() {
  const lines = parseInputLines();
  if (lines.length === 0) {
    alert("Add at least one commentary line.");
    return;
  }

  const added = addPendingLines(
    lines.map((text) => ({ text })),
    { replace: false },
  );

  if (added === 0) {
    alert("Those lines are already queued.");
    return;
  }

  setStatus(`${getPendingLines().length} pending`, "idle");
}

async function generateNextBatch() {
  const pending = getPendingLines();
  const batchSize = Number(batchSizeSelect.value);

  if (pending.length === 0) {
    alert("No pending lines. Fetch or queue lines first.");
    return;
  }

  const batch = pending.slice(0, batchSize);
  lineNumberOffset = batch[0].lineNumber - 1;

  batch.forEach(({ lineNumber }) => {
    const line = lineState.get(lineNumber);
    if (!line) return;
    line.status = "generating";
    lineState.set(lineNumber, line);
  });
  renderLines();

  activeRun = true;
  generateBtn.disabled = true;
  queueManualBtn.disabled = true;
  fetchMatchBtn.disabled = true;
  setStatus(`Generating ${batch.length} line(s)`, "running");

  const response = await fetch("/api/commentary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      lines: batch.map(({ text, dedupeKey, timestamp, eventType, eventCategory }) => ({
        text,
        dedupeKey,
        timestamp,
        eventType,
        eventCategory,
      })),
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Request failed" }));
    batch.forEach(({ lineNumber }) => {
      const line = lineState.get(lineNumber);
      if (line) {
        line.status = "pending";
        lineState.set(lineNumber, line);
      }
    });
    renderLines();
    setStatus("Error", "error");
    alert(error.error ?? "Request failed");
    activeRun = false;
    updateGenerateButton();
    queueManualBtn.disabled = false;
    updateFetchButton();
    return;
  }

  await consumeSseResponse(response);

  activeRun = false;
  queueManualBtn.disabled = false;
  updateFetchButton();
  updateGenerateButton();

  if (!isPlaying) {
    const remaining = getPendingLines().length;
    setStatus(remaining > 0 ? `${remaining} pending` : "Done", remaining > 0 ? "idle" : "done");
  }
}

function handleEvent(event, data) {
  switch (event) {
    case "line-start": {
      const lineNumber = displayLineNumber(data.lineNumber);
      const existing = lineState.get(lineNumber);
      lineState.set(lineNumber, {
        ...existing,
        text: data.text,
        dedupeKey: data.dedupeKey ?? existing?.dedupeKey,
        timestamp: data.timestamp ?? existing?.timestamp,
        eventType: data.eventType ?? existing?.eventType,
        eventCategory: data.eventCategory ?? existing?.eventCategory,
        status: "generating",
      });
      renderLines();
      break;
    }
    case "line-ttfa": {
      const lineNumber = displayLineNumber(data.lineNumber);
      const line = lineState.get(lineNumber);
      if (line) {
        line.ttfaMs = data.ttfaMs;
        lineState.set(lineNumber, line);
        renderLines();
      }
      break;
    }
    case "line-audio": {
      const lineNumber = displayLineNumber(data.lineNumber);
      const line = lineState.get(lineNumber) ?? { text: "" };
      line.ttfaMs = data.ttfaMs;
      line.totalMs = data.totalMs;
      line.audioBase64 = data.audioBase64;
      line.status = "ready";
      if (data.dedupeKey) line.dedupeKey = data.dedupeKey;
      lineState.set(lineNumber, line);
      renderLines();
      enqueuePlayback(lineNumber, data.audioBase64);
      break;
    }
    case "summary":
      renderSummary(data);
      break;
    case "error":
      setStatus("Error", "error");
      alert(data.message);
      break;
    default:
      break;
  }
}

function formatApifyQuotaMessage(payload) {
  const upgradeUrl = payload.upgradeUrl ?? "https://console.apify.com/billing/subscription";
  return (
    `<strong>Apify free plan limit reached</strong> — the Bet365 actor allows 5 runs on the free tier and yours are used up. ` +
    `Each click on Load/Fetch uses another run and returns nothing. ` +
    `<a href="${upgradeUrl}" target="_blank" rel="noreferrer">Upgrade Apify</a> or use <strong>Load demo match</strong> below to test ElevenLabs without Apify.`
  );
}

function setApifyQuotaBlocked(blocked, payload) {
  apifyQuotaBlocked = blocked;
  loadMatchesBtn.disabled = blocked || !apifyConfigured;
  if (blocked) {
    stopPolling();
    pollLiveCheckbox.checked = false;
    pollLiveCheckbox.disabled = true;
    showApifyHint(formatApifyQuotaMessage(payload ?? {}), { isError: true });
  } else {
    pollLiveCheckbox.disabled = false;
  }
  updateFetchButton();
}

function showApifyHint(message, { isError = false } = {}) {
  apifyHint.hidden = false;
  apifyHint.className = isError ? "hint error" : "hint";
  apifyHint.innerHTML = message;
}

function resetApifyHint() {
  if (matchSource === "livescore") {
    showApifyHint(
      getLineType() === "events" ? DEFAULT_LIVESCORE_EVENTS_HINT : DEFAULT_LIVESCORE_COMMENTARY_HINT,
    );
    return;
  }
  showApifyHint(DEFAULT_APIFY_HINT);
}

function updateFetchButton() {
  if (matchSource === "apify" && apifyQuotaBlocked) {
    fetchMatchBtn.disabled = true;
    return;
  }
  const hasManualId = gameIdInput.value.trim().length > 0;
  const hasSelection = Boolean(matchSelect.value);
  fetchMatchBtn.disabled = !hasManualId && !hasSelection;
}

function getVisibleMatches() {
  if (commentaryOnlyCheckbox?.checked) {
    if (getLineType() === "events") {
      const withEvents = liveMatches.filter((m) => m.eventsAvailable);
      if (withEvents.length > 0) return withEvents;
    } else {
      const withCommentary = liveMatches.filter((m) => m.commentaryAvailable);
      if (withCommentary.length > 0) return withCommentary;
    }
  }
  return liveMatches;
}

function populateMatchSelect(matches) {
  matchSelect.innerHTML = "";

  const list = getVisibleMatches();

  if (list.length === 0) {
    const emptyMessage =
      getLineType() === "events"
        ? "No matches with events — uncheck filter or pick any match"
        : "No matches with commentary — uncheck filter or use event ID 1417944";
    matchSelect.innerHTML = `<option value="">${emptyMessage}</option>`;
    matchSelect.disabled = true;
    return;
  }

  const groups = new Map();
  for (const match of list) {
    const groupName = match.competitionName ?? "Other";
    if (!groups.has(groupName)) groups.set(groupName, []);
    groups.get(groupName).push(match);
  }

  for (const [groupName, groupMatches] of groups) {
    const optgroup = document.createElement("optgroup");
    optgroup.label = `${groupName} (${groupMatches.length})`;

    for (const match of groupMatches) {
      const option = document.createElement("option");
      option.value = match.matchId;
      option.textContent = formatMatchLabel(match);
      optgroup.appendChild(option);
    }

    matchSelect.appendChild(optgroup);
  }

  matchSelect.disabled = false;
}

function getMatchRequest() {
  const selected = getSelectedMatch();
  if (selected && matchSelect.value) {
    return {
      matchId: selected.matchId,
      matchUrl: selected.sourceUrl,
    };
  }

  const manualId = gameIdInput.value.trim();
  if (!manualId) return null;

  if (matchSource === "livescore" && manualId.includes("livescore.com")) {
    return { matchUrl: manualId };
  }
  return { matchId: manualId };
}

function getCommentaryEndpoint() {
  if (matchSource === "livescore") {
    return getLineType() === "events" ? "/api/livescore/events" : "/api/livescore/commentary";
  }
  return "/api/apify/commentary";
}

function getLiveMatchesEndpoint() {
  return matchSource === "livescore" ? "/api/livescore/live-matches" : "/api/apify/live-matches";
}

function getSelectedMatch() {
  const matchId = matchSelect.value;
  if (!matchId) return null;
  return liveMatches.find((match) => match.matchId === matchId) ?? null;
}

function formatMatchLabel(match) {
  const score =
    match.homeScore != null && match.awayScore != null
      ? ` (${match.homeScore}-${match.awayScore})`
      : "";
  const status = match.status ? ` — ${match.status}` : "";
  const competition = match.competitionName ? ` · ${match.competitionName}` : "";
  const isEvents = getLineType() === "events";
  const feedCount = isEvents ? match.eventsLineCount : match.commentaryLineCount;
  const feedAvailable = isEvents ? match.eventsAvailable : match.commentaryAvailable;
  const feedLabel = isEvents ? "events" : "lines";
  const lines =
    feedCount != null && feedCount > 0
      ? ` · ${feedCount} ${feedLabel}`
      : feedAvailable === false
        ? isEvents
          ? " · no events"
          : " · no commentary"
        : "";
  return `${match.homeTeamName} vs ${match.awayTeamName}${score}${status}${competition}${lines}`;
}

async function loadLiveMatches() {
  if (matchSource === "apify" && !apifyConfigured) {
    alert("Add APIFY_TOKEN to .env first, or switch to LiveScore.");
    return;
  }

  loadMatchesBtn.disabled = true;
  loadMatchesBtn.textContent = "Loading…";
  matchSelect.innerHTML = '<option value="">Checking match feeds…</option>';
  matchSelect.disabled = true;

  try {
    const response = await fetch(getLiveMatchesEndpoint());
    const payload = await response.json();
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(
          "Server API not found — restart with: npm run dev (then refresh this page)",
        );
      }
      if (payload.quotaExceeded) {
        setApifyQuotaBlocked(true, payload);
        matchSelect.innerHTML = '<option value="">Apify quota exceeded</option>';
        matchSelect.disabled = true;
        return;
      }
      throw new Error(payload.error ?? "Failed to load live matches");
    }

    liveMatches = payload.matches ?? [];
    resetApifyHint();

    populateMatchSelect(liveMatches);

    if (liveMatches.length > 0) {
      selectFirstVisibleMatch();
      const count = payload.count ?? liveMatches.length;
      const liveCount = payload.liveCount ?? 0;
      const commentaryCount =
        payload.commentaryCount ??
        liveMatches.filter((m) => m.commentaryAvailable).length;
      const eventsCount =
        payload.eventsCount ?? liveMatches.filter((m) => m.eventsAvailable).length;
      showApifyHint(
        `Loaded <strong>${count}</strong> matches — <strong>${commentaryCount}</strong> with text commentary, <strong>${eventsCount}</strong> with events. Use <em>Line source</em> to switch.`,
      );
    }

    updateFetchButton();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("Free plan allows") || message.includes("used all 5")) {
      setApifyQuotaBlocked(true, { upgradeUrl: "https://console.apify.com/billing/subscription" });
    } else {
      showApifyHint(message, { isError: true });
    }
    matchSelect.innerHTML = '<option value="">Could not load matches</option>';
    matchSelect.disabled = true;
    updateFetchButton();
  } finally {
    loadMatchesBtn.disabled = matchSource === "apify" && apifyQuotaBlocked;
    loadMatchesBtn.textContent = "Load matches";
  }
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

async function loadDemoMatch() {
  setStatus("Loading demo", "running");
  loadDemoBtn.disabled = true;

  try {
    const response = await fetch("/api/demo/commentary");
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error ?? "Failed to load demo match");
    }

    const added = addPendingLines(payload.lines ?? [], { replace: true });
    showDataNote(payload.dataNote);
    if (!apifyQuotaBlocked) {
      resetApifyHint();
    }
    setStatus(added > 0 ? `${getPendingLines().length} pending` : "No lines", "idle");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    showApifyHint(message, { isError: true });
    setStatus("Demo failed", "error");
  } finally {
    loadDemoBtn.disabled = false;
  }
}

async function fetchMatchLines({ append = false } = {}) {
  const request = getMatchRequest();
  if (!request) {
    alert("Select a match or enter an event ID / URL.");
    return;
  }

  if (matchSource === "apify" && apifyQuotaBlocked) {
    showApifyHint(formatApifyQuotaMessage({}), { isError: true });
    return;
  }

  setStatus(append ? "Polling match" : "Fetching match", "running");
  fetchMatchBtn.disabled = true;

  try {
    const response = await fetch(getCommentaryEndpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });

    const payload = await response.json();
    if (!response.ok) {
      if (payload.quotaExceeded) {
        setApifyQuotaBlocked(true, payload);
        setStatus("Apify quota exceeded", "error");
        return;
      }
      throw new Error(payload.error ?? "Failed to fetch match lines");
    }

    const added = addPendingLines(payload.lines ?? [], { replace: !append });
    showDataNote(payload.dataNote);
    resetApifyHint();

    if (added === 0) {
      setStatus(append ? "No new lines" : "No lines found", "idle");
      if (!append && lineState.size === 0) {
        linesList.className = "lines-list empty-state";
        linesList.textContent =
          payload.lines?.length === 0
            ? "No commentary or events found for this match yet."
            : "All lines were already queued.";
      }
      return;
    }

    setStatus(`${getPendingLines().length} pending`, "idle");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    showApifyHint(message, { isError: true });
    setStatus("Fetch failed", "error");
  } finally {
    updateFetchButton();
  }
}

function startPollingIfEnabled() {
  stopPolling();
  if (!pollLiveCheckbox.checked) return;
  if (!gameIdInput.value.trim() && !matchSelect.value) return;

  pollTimer = setInterval(() => {
    fetchMatchLines({ append: true }).catch((error) => {
      console.error(error);
    });
  }, 30000);
}

async function loadConfig() {
  const response = await fetch("/api/config");
  if (!response.ok) return;
  const config = await response.json();
  voiceIdEl.textContent = config.voiceId;
  modelIdEl.textContent = config.modelId;
  apifyConfigured = Boolean(config.apifyConfigured);
  if (config.livescoreAvailable !== false) {
    matchSource = "livescore";
    if (matchSourceSelect) matchSourceSelect.value = "livescore";
  }
  updateSourceUi();
  loadMatchesBtn.disabled = matchSource === "apify" && !apifyConfigured;
  if (matchSource === "livescore") {
    loadLiveMatches().catch((error) => {
      console.error(error);
    });
  }
}

loadSampleBtn.addEventListener("click", () => {
  linesInput.value = sampleLines.join("\n");
});

loadDemoBtn.addEventListener("click", () => {
  loadDemoMatch();
});

loadMatchesBtn.addEventListener("click", () => {
  loadLiveMatches();
});

matchSourceSelect.addEventListener("change", () => {
  updateSourceUi();
  liveMatches = [];
  matchSelect.innerHTML = '<option value="">Loading matches…</option>';
  matchSelect.disabled = true;
  if (getMatchSource() === "livescore") {
    loadLiveMatches();
  } else if (apifyConfigured && !apifyQuotaBlocked) {
    loadLiveMatches();
  } else {
    matchSelect.innerHTML = '<option value="">Apify not configured</option>';
  }
});

commentaryOnlyCheckbox?.addEventListener("change", () => {
  populateMatchSelect(liveMatches);
  selectFirstVisibleMatch();
});

lineTypeSelect?.addEventListener("change", () => {
  updateLineTypeUi();
});

gameIdInput.addEventListener("input", updateFetchButton);

matchSelect.addEventListener("change", () => {
  const selected = getSelectedMatch();
  if (selected) {
    gameIdInput.value = selected.matchId;
  }
  updateFetchButton();
  if (pollLiveCheckbox.checked) startPollingIfEnabled();
});

fetchMatchBtn.addEventListener("click", () => {
  fetchMatchLines({ append: false }).then(() => startPollingIfEnabled());
});

pollLiveCheckbox.addEventListener("change", () => {
  if (pollLiveCheckbox.checked && (gameIdInput.value.trim() || matchSelect.value)) {
    startPollingIfEnabled();
  } else {
    stopPolling();
  }
});

queueManualBtn.addEventListener("click", queueManualLines);

generateBtn.addEventListener("click", () => {
  generateNextBatch().catch((error) => {
    setStatus("Error", "error");
    alert(error instanceof Error ? error.message : String(error));
    activeRun = false;
    updateGenerateButton();
    queueManualBtn.disabled = false;
    updateFetchButton();
  });
});

linesInput.value = sampleLines.join("\n");
loadConfig();
renderLines();
