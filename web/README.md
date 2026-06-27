# Sportscaster Web App

Next.js frontend and API for AI sports commentary synced to highlight video.

## Getting started

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

Open http://localhost:3000.

## Routes

| Path | Description |
|------|-------------|
| `/live` | Featured demo + Continue Watching |
| `/live/watch/[gameId]` | Broadcast player with timeline markers |
| `/matches` | Demo replays + imported highlights catalog |
| `/highlight` | Short-form vertical highlight feed |
| `/admin` | Import full matches, cache commentary (dev by default; set `ADMIN_ENABLED=true` in production) |

Demo game IDs: `georgia-ole-miss`, `chelsea-newcastle`, `hobby-horsing-germany`.

## API routes

| Route | Purpose |
|-------|---------|
| `GET /api/timeline?gameId=&duration=` | Build event markers from ESPN, static demo, or imported alignment |
| `POST /api/commentary` | Generate a broadcaster line (Cursor → OpenAI → template) |
| `POST /api/tts` | ElevenLabs speech synthesis |
| `GET /api/commentary/status` | Which providers are configured |
| `GET /api/admin/*` | Full-match import, cache management (admin only) |

## Environment

Copy `.env.local.example` to `.env.local`. See the root [README](../README.md) for the full variable list.

Minimum for a working demo: **none** — Georgia and Chelsea play with native highlight audio and ESPN markers. Add `ELEVENLABS_API_KEY` for AI voice on hobby horsing or imported matches; add `CURSOR_API_KEY` for richer AI lines.

## Optional: Convex

For auth and persistent commentary cache:

```bash
npx convex dev
```

Paste `NEXT_PUBLIC_CONVEX_URL` and `CONVEX_SITE_URL` into `.env.local`.

## Scripts

```bash
npm run dev      # development server
npm run build    # production build
npm run start    # production server
npm run test     # vitest
npm run lint     # eslint
```

## Related docs

- [Root README](../README.md) — architecture and env vars
- [samples/DEMO.md](../samples/DEMO.md) — demo match details
- [automations/sportscaster-commentary.md](../automations/sportscaster-commentary.md) — Cursor Automation setup
