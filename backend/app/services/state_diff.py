from __future__ import annotations

from dataclasses import dataclass

from app.models import GameSnapshot


@dataclass
class StateChange:
    trigger: str
    summary: str


def detect_changes(previous: GameSnapshot | None, current: GameSnapshot) -> list[StateChange]:
    if previous is None:
        return [
            StateChange(
                trigger="session_start",
                summary=_opening_summary(current),
            )
        ]

    changes: list[StateChange] = []

    if _scores_changed(previous, current):
        changes.append(
            StateChange(
                trigger="score_change",
                summary=_score_change_summary(previous, current),
            )
        )

    if previous.status != current.status and current.status:
        changes.append(
            StateChange(
                trigger="status_change",
                summary=f"Game status: {current.status}",
            )
        )

    if previous.leaders != current.leaders and current.leaders:
        changes.append(
            StateChange(
                trigger="leaders_update",
                summary=f"Stat leaders update: {current.leaders[:240]}",
            )
        )

    if not changes and previous.raw_text != current.raw_text:
        changes.append(
            StateChange(
                trigger="tick",
                summary=(
                    "Minor game update — keep the broadcast alive with a stat, momentum take, "
                    "or fun fact from the context. Do not just repeat the score."
                ),
            )
        )

    return changes


def _scores_changed(previous: GameSnapshot, current: GameSnapshot) -> bool:
    return (
        previous.score_home != current.score_home
        or previous.score_away != current.score_away
    ) and any(v is not None for v in (current.score_home, current.score_away))


def _opening_summary(snapshot: GameSnapshot) -> str:
    score = ""
    if snapshot.score_home is not None and snapshot.score_away is not None:
        score = f"Current score {snapshot.score_away}–{snapshot.score_home}. "
    status = snapshot.status or "Game underway"
    return (
        f"{score}{status}. Open the broadcast — welcome listeners and set the scene "
        f"for this matchup."
    )


def _score_change_summary(previous: GameSnapshot, current: GameSnapshot) -> str:
    away = current.score_away if current.score_away is not None else "?"
    home = current.score_home if current.score_home is not None else "?"
    status = current.status or "in progress"

    parts = [f"Scoring play — score now {away}–{home} ({status})."]

    prev_away = previous.score_away or 0
    prev_home = previous.score_home or 0
    cur_away = current.score_away or 0
    cur_home = current.score_home or 0

    if cur_away == cur_home and prev_away != prev_home:
        parts.append("Level again — dead heat on the scoreboard.")
    elif cur_away != cur_home and prev_away == prev_home:
        parts.append("First blood — someone breaks the deadlock.")
    elif (cur_away > cur_home) != (prev_away > prev_home):
        parts.append("Lead change — momentum just swung.")

    diff = abs(cur_away - cur_home)
    if diff <= 1:
        parts.append("Nail-biter — one score separates them.")
    elif diff >= 3:
        parts.append("One side is pulling away.")

    return " ".join(parts)
