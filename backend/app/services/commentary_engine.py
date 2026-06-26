from __future__ import annotations

import logging

from openai import AsyncOpenAI

from app.config import settings
from app.models import GameSnapshot
from app.services.state_diff import StateChange

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a live sports broadcaster doing play-by-play for a niche sports audience.
Rules:
- Write 1-2 spoken sentences only (max 35 words unless it's a big score swing).
- Sound natural on radio/TV; no bullet points, markdown, or stage directions.
- Use team/player names from the context when available.
- Never invent stats not present in the context.
- Match the requested persona tone."""


class CommentaryEngine:
    def __init__(self) -> None:
        self._client = AsyncOpenAI(api_key=settings.openai_api_key or None)

    async def generate(
        self,
        *,
        persona: str,
        change: StateChange,
        snapshot: GameSnapshot,
        recent_lines: list[str],
    ) -> str:
        if not settings.openai_api_key:
            return self._fallback_line(change, snapshot)

        recent = "\n".join(f"- {line}" for line in recent_lines[-3:]) or "(none)"
        user_prompt = f"""Persona: {persona}
Trigger: {change.trigger}
Change summary: {change.summary}

Latest game context:
{snapshot.raw_text[:2500]}

Recent commentary (avoid repeating):
{recent}

Write the next live line."""

        try:
            response = await self._client.chat.completions.create(
                model=settings.openai_model,
                temperature=0.9,
                max_tokens=120,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
            )
            text = (response.choices[0].message.content or "").strip()
            return text or self._fallback_line(change, snapshot)
        except Exception:
            logger.exception("Commentary generation failed")
            return self._fallback_line(change, snapshot)

    def _fallback_line(self, change: StateChange, snapshot: GameSnapshot) -> str:
        if change.trigger == "score_change":
            return (
                f"And we're on the board! It's now {snapshot.score_away or '?'} to "
                f"{snapshot.score_home or '?'}."
            )
        if change.trigger == "session_start":
            return "Welcome to AI Sportscaster — we're tracking every twist of this matchup."
        if snapshot.status:
            return f"We're {snapshot.status.lower()} — stay with us."
        return "Action picking up — we'll keep you posted."
