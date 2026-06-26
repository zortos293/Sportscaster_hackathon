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
                summary=(
                    f"Score moved to {current.score_away or '?'}–{current.score_home or '?'} "
                    f"({current.status or 'in progress'})"
                ),
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
                summary="Minor game update; keep energy with a short situational line.",
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
    return f"{score}{status}. Welcome listeners to AI Sportscaster."
