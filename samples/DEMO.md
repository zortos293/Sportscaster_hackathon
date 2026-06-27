# Demo matches

These MP4s are **highlight reels** (not full 90-minute broadcasts). The app maps events to the video using **sequential highlight sync** — each key moment lines up with the next clip in order.

## 1. Georgia @ Ole Miss (College Football)

| | |
|---|---|
| **File** | `https://files.zortos.me/georgia-ole-miss-2024.mp4` (local copy: `samples/georgia-ole-miss-2024.mp4`) |
| **ESPN event_id** | `401628414` |
| **Slug** | `georgia-ole-miss` |
| **Final** | Ole Miss 28, Georgia 10 |
| **Audio** | Original broadcast audio from the highlight reel (no AI TTS overlay) |
| **Timeline** | ESPN public API scoring plays → sequential highlight sync |

## 2. Chelsea vs Newcastle (Premier League)

| | |
|---|---|
| **File** | `https://files.zortos.me/chelsea-newcastle-2024.mp4` (local copy: `samples/chelsea-newcastle-2024.mp4`) |
| **ESPN event_id** | `704359` |
| **Slug** | `chelsea-newcastle` |
| **Final** | Chelsea 2, Newcastle 1 |
| **Audio** | Original broadcast audio from the highlight reel (no AI TTS overlay) |
| **Timeline** | ESPN public API scoring plays → sequential highlight sync |

## 3. Germany Hobby Horsing Championship

| | |
|---|---|
| **File** | `https://files.zortos.me/hobby-horsing-germany-O8nZkXfng4A.mp4` |
| **Slug** | `hobby-horsing-germany` |
| **Timeline** | Bundled static markers (no ESPN) |
| **Audio** | Pre-cached AI commentary + ElevenLabs TTS (`ELEVENLABS_API_KEY` required for voice) |

## Watch in the app

1. Start frontend: `cd web && npm run dev`
2. Open Live → pick a demo match, or Matches for the full catalog

Direct URLs:

- http://localhost:3000/live/watch/hobby-horsing-germany
- http://localhost:3000/live/watch/georgia-ole-miss
- http://localhost:3000/live/watch/chelsea-newcastle
- http://localhost:3000/highlight
