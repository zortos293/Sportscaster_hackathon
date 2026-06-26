# Sportscaster commentary — Cursor Automation

Use this when you want commentary generation to run as a **Cursor Automation** (cloud agent) instead of calling OpenAI directly.

The app integrates with Cursor in two ways:

| Method | Use case | Sync? |
|--------|----------|-------|
| **Cloud Agents API** (`CURSOR_API_KEY`) | Live + prefetch commentary in the app | Yes — app polls run result |
| **Automation webhook** (`CURSOR_AUTOMATION_WEBHOOK_URL`) | Optional sidecar / logging / batch jobs | No — fire-and-forget |

For the watch page, configure the **Cloud Agents API** key. The webhook is optional.

## 1. Create the automation (Cursor UI)

1. Open [cursor.com/automations](https://cursor.com/automations) or use `/automate` in the Agents Window.
2. **Trigger:** Webhook (optional — only if you want external triggers).
3. **Repository:** None — this automation only generates spoken lines, no code changes.
4. **Tools:** Disable PR creation and Slack unless you want notifications.
5. **Model:** `Composer 2.5` (fast) — cheapest Cursor option for short text generation. Alternatives: `Haiku 4.5`, `Gemini 3.5 Flash`. Automations always run in **Max Mode** (no toggle off).
6. **Instructions:** paste the prompt block below.

### Automation instructions (copy into Cursor)

```
You are the AI Sportscaster commentary engine — a live sports broadcaster on air, not a news reader.

When a webhook payload arrives, check the `action` field (if present):

---

## A) Live moment — no `action`, or watch-page payload

Read:
- persona
- gameTitle
- momentType (opening, score, key_play, period, stat_spotlight, color)
- period (optional)
- score (away-home, e.g. "2-1")
- playDescription
- context / facts (optional stats — never invent beyond these)
- recentLines (avoid repeating phrasing or structure)

Write exactly 1–2 spoken broadcast sentences (max ~45 words; big scoring moments up to ~55).
- Lead with emotion on scoring plays.
- Weave stats naturally on color/stat moments.
- Vary openings — never sound robotic.
- No bullet points, markdown, quotes, labels, or stage directions.

Output ONLY the spoken line — nothing else.

---

## B) Admin bulk cache — `action: "bulk_cache_matches"`

The app sends LiveScore fixtures to cache in Convex. Process every game in `games[]` in one run — do not spawn separate agents per line.

For each game object read:
- gameId, matchId, title, subtitle, persona
- homeTeamName, awayTeamName, homeScore, awayScore, status, feed
- rawLines[] — each has: dedupeKey, timestamp, text, eventType, eventCategory

For every rawLine in each game:
1. Strip leading timestamps from `text` if present (e.g. "45' — …").
2. Map eventCategory → kind:
   - goal, penalty → score
   - card, substitution, offside → key_play
   - otherwise → color
3. Convert `text` into 1–2 spoken broadcast sentences using the persona and match context.
4. Vary phrasing across lines in the same game — no repeated openings.
5. Never invent stats, players, or events not in the raw line.

Build cached lines with:
- eventKey = rawLine.dedupeKey
- eventId = matchId
- kind = mapped kind above
- description = cleaned raw text
- videoAt = minute from timestamp × 60 (use 0 if unknown)
- text = your spoken line
- source = "webhook"

After converting ALL lines for a game, POST once to `convexIngestUrl`:

Headers:
- Content-Type: application/json
- Authorization: Bearer {CACHE_WEBHOOK_SECRET} — only if convexWebhookSecretConfigured is true

Body:
{
  "gameId": "<gameId>",
  "title": "<title>",
  "subtitle": "<subtitle>",
  "source": "webhook",
  "lines": [ ...all converted lines for this game... ]
}

Process every game in the payload. Confirm each POST succeeded before finishing.

---

## Rules (both modes)

- Stay fully in character for the persona.
- Never invent stats or facts not in the payload.
- Sound like a real mic — contractions, rhythm, occasional interjections on big moments.
- British football tone when persona mentions Premier League; otherwise match the persona given.
```

7. Save and activate. Copy the webhook URL + auth token (`crsr_...` only — not the full `Authorization: Bearer` header).

## 2. App environment variables

### Web (`.env.local`)

```bash
# Primary — Cloud Agents API (sync commentary)
CURSOR_API_KEY=cursor_...
CURSOR_COMMENTARY_MODEL=composer-2.5

# Optional — reuse one agent per watch session (set automatically by the app)
# CURSOR_COMMENTARY_AGENT_ID=

# Optional — fire-and-forget automation webhook (does not return text to the app)
CURSOR_AUTOMATION_WEBHOOK_URL=https://api2.cursor.sh/automations/webhook/8b8198f2-714c-11f1-8cbf-12b154d6cb29
# CURSOR_AUTOMATION_TOKEN=crsr_...
```

### Backend (`backend/.env`) — live ESPN polling sessions

```bash
CURSOR_API_KEY=cursor_...
CURSOR_COMMENTARY_MODEL=composer-2.5
CURSOR_COMMENTARY_TIMEOUT_MS=45000
```

Generate API keys at [Cursor Dashboard → Integrations / API Keys](https://cursor.com/dashboard/integrations).

## 3. Priority order

Commentary providers are tried in this order:

1. **Cursor Cloud Agents API** — if `CURSOR_API_KEY` is set
2. **OpenAI** — if `OPENAI_API_KEY` is set (legacy fallback)
3. **Template** — always available offline

TTS remains ElevenLabs (or OpenAI TTS fallback) — unchanged.

## 4. Session agent reuse

The watch page passes `cursorAgentId` between commentary calls so follow-up lines use the same cloud agent (`POST /v1/agents/{id}/runs`). This keeps recent-context awareness and avoids cold-starting a new agent for every highlight.

## 5. Webhook payload shapes

### Live moment (watch page — webhook-only mode)

POST JSON like:

```json
{
  "persona": "British Premier League football commentator with building excitement",
  "gameTitle": "Morocco vs Haiti",
  "momentType": "score",
  "period": "2nd Half",
  "score": "4-2",
  "playDescription": "En-Nesyri scores from the penalty spot",
  "context": "Morocco leading the group",
  "facts": ["Morocco unbeaten in group stage"],
  "recentLines": ["Welcome to AI Sportscaster!"]
}
```

Response: output ONLY the spoken line (automation does not return HTTP body to the app — use `CURSOR_API_KEY` for sync playback).

### Bulk cache (`/admin` — webhook-only mode)

Triggered when `CURSOR_API_KEY` is not set. One webhook fires for all matches:

```json
{
  "action": "bulk_cache_matches",
  "convexIngestUrl": "https://your-deployment.convex.site/webhook/cache-matches",
  "convexWebhookSecretConfigured": true,
  "persona": "British Premier League football commentator with building excitement",
  "games": [
    {
      "gameId": "ls-123456",
      "matchId": "123456",
      "title": "Morocco vs Haiti",
      "subtitle": "World Cup · Live",
      "rawLines": [
        {
          "dedupeKey": "goal-45-en-nesyri",
          "timestamp": "45",
          "text": "45' — Penalty! En-Nesyri converts.",
          "eventType": "goal",
          "eventCategory": "goal"
        }
      ]
    }
  ]
}
```

The automation converts all lines and POSTs each game to `convexIngestUrl`. When `CURSOR_API_KEY` **is** set, the app uses one Cloud Agent batch run instead (webhook is skipped).

### Webhook rate limits (important)

Each webhook call starts a **new cloud agent run** (Max Mode billing). The app fires dozens of commentary events per game — if every one hit the webhook, Cursor returns `resource_exhausted`.

The app therefore:

- Triggers webhooks only for **major moments**: `opening`, `score`, `key_play`, `period`
- Skips filler events: `color`, `stat_spotlight`
- Enforces a minimum gap (default **90s**) between webhook calls
- Pauses webhooks for **5 minutes** after a quota error

Tune with:

```bash
CURSOR_AUTOMATION_WEBHOOK_MIN_INTERVAL_SECONDS=90
CURSOR_AUTOMATION_WEBHOOK_COOLDOWN_SECONDS=300
```

For spoken lines on the watch page, use **`CURSOR_API_KEY`** (Cloud Agents API) — one agent session, reused per broadcast — not the webhook.

## 6. Models (Cloud Agents API vs Automations)

There are **two separate model pickers**:

| Path | Where model is set | Env var |
|------|-------------------|---------|
| **Sync API** (`CURSOR_API_KEY`) | Code / `CURSOR_COMMENTARY_MODEL` | `composer-2.5` |
| **Automation webhook** | Cursor UI → Automations → model dropdown | N/A — not in webhook payload |

List valid API model IDs:

```bash
curl -u "$CURSOR_API_KEY:" https://api.cursor.com/v1/models
```

On your account, available IDs include: `composer-2.5`, `claude-haiku-4-5`, `claude-sonnet-4-6`, `gpt-5.3-codex`, `gpt-5.5`, `gemini-3.5-flash`, `default` (auto), and others.

**Fast Composer** (recommended for commentary):

```json
{ "id": "composer-2.5", "params": [{ "id": "fast", "value": "true" }] }
```

**Do not use** `composer-2.5-fast` as `model.id` — the API returns `invalid_model`.

Automations always run in **Max Mode** (larger context, higher cost). Pick a cheaper model in the automation UI for webhook-only bulk jobs.
