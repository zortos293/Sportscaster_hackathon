from __future__ import annotations

from typing import Any

DEMO_GAMES: list[dict[str, Any]] = [
    {
        "id": "georgia-ole-miss",
        "title": "Georgia @ Ole Miss",
        "subtitle": "College Football · Nov 9, 2024",
        "sport": "football",
        "league": "college-football",
        "event_id": "401628414",
        "video_file": "georgia-ole-miss-2024.mp4",
        "persona": "energetic college football play-by-play announcer",
        "final_score": "Ole Miss 28, Georgia 10",
    },
    {
        "id": "chelsea-newcastle",
        "title": "Chelsea vs Newcastle",
        "subtitle": "Premier League · Oct 27, 2024",
        "sport": "soccer",
        "league": "eng.1",
        "event_id": "704359",
        "video_file": "chelsea-newcastle-2024.mp4",
        "persona": "British Premier League football commentator with building excitement",
        "final_score": "Chelsea 2, Newcastle 1",
    },
]


def get_demo_game(game_id: str) -> dict[str, Any] | None:
    return next((game for game in DEMO_GAMES if game["id"] == game_id), None)
