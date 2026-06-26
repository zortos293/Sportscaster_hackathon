# Demo matches

## 1. Georgia @ Ole Miss (College Football)

| | |
|---|---|
| **File** | `georgia-ole-miss-2024.mp4` |
| **ESPN event_id** | `401628414` |
| **Slug** | `georgia-ole-miss` |
| **Final** | Ole Miss 28, Georgia 10 |

## 2. Chelsea vs Newcastle (Premier League)

| | |
|---|---|
| **File** | `chelsea-newcastle-2024.mp4` |
| **ESPN event_id** | `704359` |
| **Slug** | `chelsea-newcastle` |
| **Final** | Chelsea 2, Newcastle 1 |

## Watch in the app

1. Start backend: `cd backend && uvicorn app.main:app --reload --port 8000`
2. Start frontend: `cd web && npm run dev`
3. Sign in → Dashboard → pick a match

Direct URLs:
- http://localhost:3000/dashboard/watch/georgia-ole-miss
- http://localhost:3000/dashboard/watch/chelsea-newcastle
