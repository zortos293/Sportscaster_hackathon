# Demo matches

These MP4s are **highlight reels** (not full 90-minute broadcasts). The app maps ESPN
events to the video using **sequential highlight sync** — each key moment lines up with
the next clip in order, with booth chatter filling gaps.

## 1. Georgia @ Ole Miss (College Football)

| | |
|---|---|
| **File** | `https://files.zortos.me/georgia-ole-miss-2024.mp4` |
| **ESPN event_id** | `401628414` |
| **Slug** | `georgia-ole-miss` |
| **Final** | Ole Miss 28, Georgia 10 |

## 2. Chelsea vs Newcastle (Premier League)

| | |
|---|---|
| **File** | `https://files.zortos.me/chelsea-newcastle-2024.mp4` |
| **ESPN event_id** | `704359` |
| **Slug** | `chelsea-newcastle` |
| **Final** | Chelsea 2, Newcastle 1 |

## 3. Germany Hobby Horsing Championship

| | |
|---|---|
| **File** | `hobby-horsing-germany-O8nZkXfng4A.mp4` (also at `https://files.zortos.me/hobby-horsing-germany-O8nZkXfng4A.mp4`) |
| **Slug** | `hobby-horsing-germany` |
| **Timeline** | Bundled fake markers + pre-cached AI commentary (no ESPN) |

## Watch in the app

1. Start frontend: `cd web && npm run dev`
2. Open Live → pick a demo match, or Highlights for short clips

Direct URLs:

- http://localhost:3000/live/watch/hobby-horsing-germany
- http://localhost:3000/live/watch/georgia-ole-miss
- http://localhost:3000/live/watch/chelsea-newcastle
- http://localhost:3000/highlight
