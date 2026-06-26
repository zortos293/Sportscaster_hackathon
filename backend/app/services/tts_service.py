from __future__ import annotations

import base64
import logging

from openai import AsyncOpenAI

from app.config import settings

logger = logging.getLogger(__name__)


class TTSService:
    def __init__(self) -> None:
        self._client = AsyncOpenAI(api_key=settings.openai_api_key or None)

    async def synthesize(self, text: str) -> tuple[str, str] | None:
        if not settings.openai_api_key or not text.strip():
            return None

        try:
            response = await self._client.audio.speech.create(
                model="tts-1",
                voice=settings.tts_voice,
                input=text[:4096],
                response_format="mp3",
            )
            audio_bytes = response.content
            encoded = base64.b64encode(audio_bytes).decode("ascii")
            return encoded, "audio/mpeg"
        except Exception:
            logger.exception("TTS synthesis failed")
            return None
