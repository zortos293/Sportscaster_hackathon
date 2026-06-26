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
5. **Model:** `composer-2.5` or your preferred fast model.
6. **Instructions:** paste the prompt block below.

### Automation instructions (copy into Cursor)

```
You are the AI Sportscaster commentary engine.

When the webhook payload arrives, read:
- persona
- gameTitle
- momentType (opening, score, key_play, period, stat_spotlight, color)
- score
- playDescription
- context (stats / facts)
- recentLines (avoid repeating phrasing)

Write exactly 1–2 spoken broadcast sentences (max ~45 words; big moments up to ~55).
Lead with emotion on scoring plays; weave stats naturally on color/stat moments.
Never invent stats not in the payload.
Stay in character for the persona.
Output ONLY the spoken line — no markdown, quotes, or labels.
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

## 5. Webhook payload shape (optional)

If you trigger the automation externally, POST JSON like:

```json
{
  "persona": "energetic college football play-by-play announcer",
  "gameTitle": "Georgia @ Ole Miss",
  "momentType": "score",
  "score": "10-28",
  "playDescription": "Caden Davis 32 Yd Field Goal",
  "context": "Ole Miss Rebels Passing Yards leader: Jaxson Dart (199 YDS)",
  "recentLines": ["Welcome to AI Sportscaster!"]
}
```

The app's `/api/commentary` route sends the same fields when `CURSOR_AUTOMATION_WEBHOOK_URL` is configured (async trigger only; commentary text still comes from the Cloud Agents API when `CURSOR_API_KEY` is set).

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
