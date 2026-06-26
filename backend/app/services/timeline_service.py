from __future__ import annotations

import logging
from dataclasses import dataclass

import httpx

from app.models import GameSnapshot

logger = logging.getLogger(__name__)

FOOTBALL_QUARTER_SECONDS = 15 * 60
SOCCER_MATCH_SECONDS = 90 * 60


@dataclass
class TimelineEvent:
    id: str
    video_at: float
    game_elapsed: float
    score_home: int
    score_away: int
    description: str
    period_label: str


def parse_football_clock(period: int, clock_display: str) -> float:
    parts = clock_display.strip().split(":")
    minutes = int(parts[0])
    seconds = int(parts[1]) if len(parts) > 1 else 0
    remaining = minutes * 60 + seconds
    elapsed_in_quarter = FOOTBALL_QUARTER_SECONDS - remaining
    return (period - 1) * FOOTBALL_QUARTER_SECONDS + max(elapsed_in_quarter, 0)


def map_game_time_to_video(
    game_elapsed: float,
    max_game_elapsed: float,
    video_duration: float,
    *,
    intro_seconds: float = 8.0,
    outro_seconds: float = 12.0,
) -> float:
    usable = max(video_duration - intro_seconds - outro_seconds, 1.0)
    ratio = min(max(game_elapsed / max(max_game_elapsed, 1.0), 0.0), 1.0)
    return intro_seconds + ratio * usable


async def fetch_summary_payload(sport: str, league: str, event_id: str) -> dict:
    url = f"https://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/summary"
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.get(url, params={"event": event_id})
        response.raise_for_status()
        return response.json()


def build_timeline(
    payload: dict,
    *,
    sport: str,
    video_duration: float,
) -> list[TimelineEvent]:
    if sport == "soccer":
        return _build_soccer_timeline(payload, video_duration)
    return _build_football_timeline(payload, video_duration)


def _build_football_timeline(payload: dict, video_duration: float) -> list[TimelineEvent]:
    scoring_plays = payload.get("scoringPlays") or []
    raw_events: list[tuple[float, dict]] = []

    for index, play in enumerate(scoring_plays):
        period = play.get("period", {}).get("number", 1)
        clock = play.get("clock", {}).get("displayValue", "15:00")
        elapsed = parse_football_clock(period, clock)
        raw_events.append((elapsed, play))

    max_elapsed = max((e for e, _ in raw_events), default=FOOTBALL_QUARTER_SECONDS * 4)

    events: list[TimelineEvent] = [
        TimelineEvent(
            id="opening",
            video_at=3.0,
            game_elapsed=0.0,
            score_home=0,
            score_away=0,
            description="Opening kickoff — welcome to AI Sportscaster.",
            period_label="1st Quarter",
        )
    ]

    for index, (elapsed, play) in enumerate(raw_events):
        period = play.get("period", {}).get("number", 1)
        events.append(
            TimelineEvent(
                id=f"score-{index}",
                video_at=map_game_time_to_video(elapsed, max_elapsed, video_duration),
                game_elapsed=elapsed,
                score_home=int(play.get("homeScore", 0)),
                score_away=int(play.get("awayScore", 0)),
                description=(play.get("text") or "Scoring play").strip(),
                period_label=f"Q{period}",
            )
        )

    events.sort(key=lambda item: item.video_at)
    return events


def _build_soccer_timeline(payload: dict, video_duration: float) -> list[TimelineEvent]:
    goals = [
        event
        for event in (payload.get("keyEvents") or [])
        if event.get("scoringPlay") and event.get("type", {}).get("type", "").startswith("goal")
    ]

    raw_events: list[tuple[float, dict]] = []
    for play in goals:
        elapsed = float(play.get("clock", {}).get("value", 0))
        raw_events.append((elapsed, play))

    max_elapsed = max((e for e, _ in raw_events), default=SOCCER_MATCH_SECONDS)

    events: list[TimelineEvent] = [
        TimelineEvent(
            id="opening",
            video_at=3.0,
            game_elapsed=0.0,
            score_home=0,
            score_away=0,
            description="Kickoff at Stamford Bridge — AI commentary is on the mic.",
            period_label="1st Half",
        )
    ]

    for index, (elapsed, play) in enumerate(raw_events):
        period = play.get("period", {}).get("number", 1)
        text = play.get("shortText") or play.get("text") or "Goal"
        # Parse score from goal text when possible
        score_home, score_away = _parse_score_from_goal_text(play.get("text", ""))
        events.append(
            TimelineEvent(
                id=f"goal-{index}",
                video_at=map_game_time_to_video(elapsed, max_elapsed, video_duration),
                game_elapsed=elapsed,
                score_home=score_home,
                score_away=score_away,
                description=text.strip(),
                period_label="1st Half" if period == 1 else "2nd Half",
            )
        )

    events.sort(key=lambda item: item.video_at)
    return events


def _parse_score_from_goal_text(text: str) -> tuple[int, int]:
    import re

    match = re.search(r"(\d+)\s*,\s*.*?(\d+)", text)
    if match:
        return int(match.group(2)), int(match.group(1))
    return 0, 0


def snapshot_from_timeline_event(event: TimelineEvent, sport: str, league: str, event_id: str) -> GameSnapshot:
    return GameSnapshot(
        raw_text=f"{event.description}\nScore: {event.score_away}-{event.score_home} ({event.period_label})",
        score_home=event.score_home,
        score_away=event.score_away,
        status=event.period_label,
        period=event.period_label,
        leaders=None,
        metadata={
            "source": "video_timeline",
            "event_id": event_id,
            "sport": sport,
            "league": league,
            "video_at": event.video_at,
        },
    )
