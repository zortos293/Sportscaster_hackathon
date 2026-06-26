from __future__ import annotations

import logging

from openai import AsyncOpenAI

from app.config import settings
from app.models import GameSnapshot
from app.services.state_diff import StateChange

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a live sports broadcaster on air — not a news reader. You NEVER go silent. Even between big plays, you fill dead air with energy, stats, storylines, and personality.

Your booth has character: you're opinionated (within reason), witty, and deeply invested in this game.

Broadcast style:
- Lead with emotion on big moments; weave stats and matchup notes on quieter beats.
- Drop team stats, player nuggets, and history naturally — like a prepared pro.
- Vary your calls — never sound like a score ticker twice in a row.
- Match energy to the moment; color commentary can be conversational.
- Use team and player names from the context when available.
- Sound like a real mic — contractions, rhythm, occasional interjections.

Hard rules:
- 1–2 spoken sentences (max ~45 words; big scoring moments may stretch to ~55).
- No bullet points, markdown, labels, or stage directions.
- Never invent stats, players, or events not in the context.
- Stay fully in character for the requested persona."""

_TRIGGER_GUIDANCE: dict[str, str] = {
    "session_start": (
        "Open the broadcast — welcome listeners, name the matchup, mention venue or a storyline "
        "from the context. Tease what's at stake."
    ),
    "score_change": (
        "SCORING MOMENT — react first, describe the play, land the score naturally. Peak energy."
    ),
    "status_change": (
        "Period or phase shift — recap where we are, preview what's next, reference momentum."
    ),
    "leaders_update": (
        "Stat spotlight — deliver ONE standout performance from the leaders data conversationally."
    ),
    "tick": (
        "Between-plays banter — keep the booth alive. Mix a stat, momentum take, or fun fact "
        "from the context. Do NOT just restate the score."
    ),
}


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

        recent = "\n".join(f"- {line}" for line in recent_lines[-4:]) or "(none yet)"
        trigger_guide = _TRIGGER_GUIDANCE.get(
            change.trigger,
            "Deliver vivid, in-the-moment live commentary with personality.",
        )
        leaders_block = f"\nStat leaders: {snapshot.leaders}" if snapshot.leaders else ""
        user_prompt = f"""Persona: {persona}
Trigger: {change.trigger}
Change summary: {change.summary}

{trigger_guide}

Latest game context:
{snapshot.raw_text[:3000]}{leaders_block}

Recent commentary (do not repeat phrasing or structure):
{recent}

Deliver the next live on-air line. Keep talking — the booth stays hot."""

        try:
            response = await self._client.chat.completions.create(
                model=settings.openai_model,
                temperature=0.95,
                max_tokens=150,
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
        away = snapshot.score_away if snapshot.score_away is not None else "?"
        home = snapshot.score_home if snapshot.score_home is not None else "?"

        if change.trigger == "score_change":
            return (
                f"And there it is — we're on the board! "
                f"It's {away} to {home}, and this crowd is feeling it!"
            )
        if change.trigger == "session_start":
            return (
                "Good evening, welcome to AI Sportscaster! "
                "We've got a great one on tap — stay with us for every twist."
            )
        if change.trigger == "status_change" and snapshot.status:
            return f"We're {snapshot.status.lower()} — buckle up, the drama isn't over yet."
        if change.trigger == "leaders_update" and snapshot.leaders:
            return f"Stat check — {snapshot.leaders.split('|')[0].strip()}."
        if change.trigger == "tick" and snapshot.leaders:
            return f"While the action settles — {snapshot.leaders.split('|')[0].strip()}."
        if snapshot.status:
            return f"We're {snapshot.status.lower()} — the tension is building, stay tuned."
        return "Action picking up on the field — we'll keep you right on top of it."
