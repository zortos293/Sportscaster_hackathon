from __future__ import annotations

import base64
import logging

import httpx
from openai import AsyncOpenAI

from app.config import settings

logger = logging.getLogger(__name__)


class TTSService:
    def __init__(self) -> None:
        self._openai = AsyncOpenAI(api_key=settings.openai_api_key or None)

    async def synthesize(self, text: str) -> tuple[str, str] | None:
        if not text.strip():
            return None

        if settings.elevenlabs_api_key:
            result = await self._synthesize_elevenlabs(text)
            if result:
                return result

        if settings.openai_api_key and settings.openai_api_key != "your_openai_key_here":
            return await self._synthesize_openai(text)

        return None

    async def _synthesize_elevenlabs(self, text: str) -> tuple[str, str] | None:
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{settings.elevenlabs_voice_id}"
        headers = {
            "xi-api-key": settings.elevenlabs_api_key,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg",
        }
        payload = {
            "text": text[:2500],
            "model_id": settings.elevenlabs_model,
        }

        try:
            async with httpx.AsyncClient(timeout=45.0) as client:
                response = await client.post(url, headers=headers, json=payload)
                response.raise_for_status()
                encoded = base64.b64encode(response.content).decode("ascii")
                return encoded, "audio/mpeg"
        except Exception:
            logger.exception("ElevenLabs TTS failed")
            return None

    async def _synthesize_openai(self, text: str) -> tuple[str, str] | None:
        try:
            response = await self._openai.audio.speech.create(
                model="tts-1",
                voice=settings.tts_voice,
                input=text[:4096],
                response_format="mp3",
            )
            encoded = base64.b64encode(response.content).decode("ascii")
            return encoded, "audio/mpeg"
        except Exception:
            logger.exception("OpenAI TTS failed")
            return None
