# Sportscaster Hackathon MVP

Live AI sports commentary synced to highlight video. The **Next.js app** (`web/`) is the primary demo: it maps ESPN or LiveScore events to video timestamps, generates broadcaster lines via Cursor Cloud Agents (or templates), and speaks them with ElevenLabs TTS.

An optional **Python FastAPI backend** (`backend/`) provides a legacy WebSocket polling path via the [ESPN MCP Server](https://apify.com/mrbridge/espn-mcp-server) on Apify.

## Architecture (Next.js app — recommended)

```
┌──────────────────────────────────────────────────────────────────┐
│                    Next.js app (web/)                             │
│  Sportcast UI · /live/watch · /highlight · /admin                 │
│  Video (MP4 / R2 URLs) + timeline markers + commentary sidebar    │
└─────────────────────────────┬────────────────────────────────────┘
                              │ Route handlers
┌─────────────────────────────▼────────────────────────────────────┐
│  /api/timeline      ESPN public API or bundled static markers     │
│  /api/commentary    Cursor Cloud Agents → OpenAI → template       │
│  /api/tts           ElevenLabs (skipped when video has native audio)│
│  /api/admin/*       LiveScore imports, OCR alignment, cache       │
└─────────────────────────────┬────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
   ESPN site API        LiveScore API         Convex (optional)
   (demo timelines)     (imported matches)    (auth + commentary cache)
```

### Data flow (watch page)

1. **`/api/timeline`** builds event markers:
   - **Demo replays** (Georgia, Chelsea): fetch ESPN `summary` JSON and map scoring plays to highlight timestamps (sequential sync).
   - **Hobby horsing demo**: bundled static markers + pre-cached commentary (no ESPN).
   - **Imported full matches**: LiveScore events aligned to video via OCR clock anchors.
2. On **`timeupdate`**, the player fires each marker; commentary text is resolved from Convex cache → Cursor API → OpenAI → template.
3. **`/api/tts`** speaks lines via ElevenLabs — **except** on ESPN highlight demos, which play the original broadcast audio from the video (markers and sidebar text still update).
4. **`/highlight`** serves short vertical clips from cached demo/imported events.

### Demo modes

| Match | Video | Stats / timeline | Audio |
|-------|-------|------------------|-------|
| Georgia @ Ole Miss | Highlight reel (R2) | ESPN public API | Original broadcast audio |
| Chelsea vs Newcastle | Highlight reel (R2) | ESPN public API | Original broadcast audio |
| Hobby horsing | Short clip (R2) | Bundled static markers | AI commentary + ElevenLabs TTS |
| Imported full match | Admin-imported MP4 | LiveScore + OCR alignment | AI commentary + ElevenLabs TTS |

Local copies of Georgia and Chelsea MP4s live in `samples/` (symlinked to `web/public/samples/`). The app streams from `files.zortos.me` by default.

## Quick start (Next.js)

Everything runs in the **Next.js app**. No Python server needed for the demo.

```bash
cd web
npm install
cp .env.local.example .env.local   # optional keys — see below
npm run dev
```

Open http://localhost:3000/live → pick a match → **press play**.

Georgia and Chelsea work out of the box (native audio, ESPN markers). For AI voice on hobby horsing or imported matches, add `ELEVENLABS_API_KEY`. For richer AI lines, add `CURSOR_API_KEY`.

### Env vars (`web/.env.local`)

| Variable | Required | Purpose |
|----------|----------|---------|
| `ELEVENLABS_API_KEY` | For AI voice | Text-to-speech (not used on ESPN highlight demos) |
| `ELEVENLABS_VOICE_ID` | No | Default `JBFqnCBsd6RMkjVDRZzb` |
| `ELEVENLABS_MODEL` | No | Default `eleven_flash_v2_5` |
| `CURSOR_API_KEY` | No | AI commentary via Cursor Cloud Agents API (template fallback always works) |
| `CURSOR_COMMENTARY_MODEL` | No | Default `composer-2.5`. Use a real API model ID from `GET /v1/models` — not UI slugs like `composer-2.5-fast`. |
| `CURSOR_AUTOMATION_WEBHOOK_URL` | No | Optional fire-and-forget automation trigger |
| `CURSOR_AUTOMATION_TOKEN` | No | Bearer token for automation webhook (`crsr_...`) |
| `OPENAI_API_KEY` | No | Fallback commentary if Cursor fails |
| `OPENAI_MODEL` | No | Default `gpt-4o-mini` |
| `ADMIN_ENABLED` | No | `true` to expose `/admin` in production (Railway). Off by default in production; on in local dev. |
| `APIFY_TOKEN` | No | Flashscore/FotMob event enrichment for admin imports |
| `NEXT_PUBLIC_CONVEX_URL` | No | Auth + commentary cache (empty = demo mode, no auth) |
| `NEXT_PUBLIC_DISABLE_CONVEX_AUTH` | No | `true` to skip sign-in even when Convex is configured |
| `CACHE_WEBHOOK_SECRET` | No | Protects Convex cache ingest webhook (set in Convex dashboard too) |
| `CONVEX_SITE_URL` | No | Convex site URL for auth (set by `npx convex dev`) |

See [automations/sportscaster-commentary.md](automations/sportscaster-commentary.md) for Cursor Automation setup.

### Valid Cloud Agents API models (your account)

Query live list: `curl -u "$CURSOR_API_KEY:" https://api.cursor.com/v1/models`

| API `model.id` | Best for | Notes |
|----------------|----------|-------|
| `composer-2.5` | **Recommended** — fast, cheap commentary | Add `params: [{ id: "fast", value: "true" }]` (default) |
| `claude-haiku-4-5` | Cheaper automation runs | Good for bulk cache via webhook |
| `gemini-3.5-flash` | Fast, low cost | No extra params |
| `gpt-5.3-codex` | Higher quality, more expensive | Default fast variant |
| `claude-sonnet-4-6` | Balanced quality | Supports thinking/effort params |
| `default` | Auto routing | Omit `model` or set `CURSOR_COMMENTARY_MODEL=default` |

**Invalid:** `composer-2.5-fast` as a single string — that's a UI label. Use `composer-2.5` + `fast: true` param instead.

**Cursor Automations (webhook UI):** Model is chosen in [cursor.com/automations](https://cursor.com/automations) when you create the automation — the webhook POST does **not** override it. All automations run in Max Mode.

## Quick start (legacy Python backend)

Optional WebSocket polling server using Apify ESPN MCP. Not required for the Next.js demo.

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # add APIFY_TOKEN, CURSOR_API_KEY, etc.
uvicorn app.main:app --reload
```

### Create a session

```bash
curl -X POST http://localhost:8000/sessions \
  -H 'Content-Type: application/json' \
  -d '{
    "sport": "basketball",
    "league": "mens-college-basketball",
    "event_id": "401706957",
    "poll_interval_seconds": 45,
    "video_source": {
      "type": "youtube",
      "url": "https://www.youtube.com/watch?v=EXAMPLE"
    }
  }'
```

### Connect WebSocket

```
ws://localhost:8000/ws/sessions/{session_id}
```

Events: `commentary` (text + optional audio base64), `game_state`, `heartbeat`.

### Backend environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `APIFY_TOKEN` | Yes | ESPN MCP on Apify |
| `CURSOR_API_KEY` | For LLM | Commentary via Cursor Cloud Agents API |
| `OPENAI_API_KEY` | Fallback + TTS | Commentary fallback + `tts-1` |
| `ESPN_MCP_URL` | No | Default: Apify standby MCP endpoint |

## Cost rough estimate (hackathon)

- ESPN public API: free (demo timelines).
- LiveScore public API: free (admin imports).
- ESPN MCP (Python backend only): ~$0.005–0.01 per poll → ~$0.50–2/hour at 45s intervals.
- Cursor Cloud Agents: varies by model; `composer-2.5` + fast param is cheapest for live lines.
- ElevenLabs: pay per character; `eleven_flash_v2_5` is lowest latency.

## Project layout

```
web/                        # Next.js app (primary)
  src/app/                  # Pages: /live, /highlight, /admin, /matches
  src/app/api/              # timeline, commentary, tts, admin routes
  src/lib/                  # ESPN/LiveScore clients, cursor-commentary, sync
  convex/                   # Optional auth + commentary cache
  public/samples -> ../../samples

samples/                    # Local MP4 highlight reels (+ DEMO.md)
demo/                       # Standalone ElevenLabs TTS benchmark (see demo/README.md)
backend/                    # Legacy FastAPI + ESPN MCP polling
  app/
    main.py                 # FastAPI app, routes, WebSocket
    services/
      espn_client.py        # Apify MCP tool calls
      game_session.py       # Session lifecycle + polling loop
      commentary_engine.py  # LLM prompts + generation
automations/                # Cursor Automation prompt templates
```

## Next steps after MVP

- **Play-by-play sync**: use ESPN scoring plays + wall-clock alignment for full broadcasts.
- **Multi-voice personas**: home/away/analyst via TTS voice IDs.
- **Niche leagues off ESPN**: add a second stats adapter (league API, manual JSON feed, or vision on stream).
- **Low-latency TTS**: streaming TTS (ElevenLabs, Cartesia) for sub-second speech start.
