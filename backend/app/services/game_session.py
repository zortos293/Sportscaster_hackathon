from __future__ import annotations

import asyncio
import logging
import uuid
from collections import defaultdict
from typing import Any

from fastapi import WebSocket

from app.config import settings
from app.models import (
    CommentaryEvent,
    CreateSessionRequest,
    GameSnapshot,
    GameStateEvent,
    HeartbeatEvent,
)
from app.services.commentary_engine import CommentaryEngine
from app.services.espn_client import EspnClient
from app.services.state_diff import detect_changes
from app.services.tts_service import TTSService

logger = logging.getLogger(__name__)


class GameSession:
    def __init__(self, request: CreateSessionRequest) -> None:
        self.session_id = str(uuid.uuid4())
        self.request = request
        self.poll_interval = request.poll_interval_seconds or settings.poll_interval_seconds
        self.status = "created"
        self.last_snapshot: GameSnapshot | None = None
        self.recent_lines: list[str] = []
        self._task: asyncio.Task[None] | None = None
        self._subscribers: set[WebSocket] = set()
        self._espn = EspnClient()
        self._commentary = CommentaryEngine()
        self._tts = TTSService()

    async def start(self) -> None:
        if self._task and not self._task.done():
            return
        self.status = "running"
        self._task = asyncio.create_task(self._poll_loop(), name=f"session-{self.session_id}")

    async def stop(self) -> None:
        self.status = "stopped"
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

    async def subscribe(self, websocket: WebSocket) -> None:
        self._subscribers.add(websocket)

    async def unsubscribe(self, websocket: WebSocket) -> None:
        self._subscribers.discard(websocket)
        if not self._subscribers and self.status == "running":
            await self.stop()

    async def _poll_loop(self) -> None:
        while self.status == "running":
            try:
                await self._tick()
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("Poll tick failed for session %s", self.session_id)
            await asyncio.sleep(self.poll_interval)

    async def _tick(self) -> None:
        snapshot = await self._espn.get_game_summary(
            self.request.sport,
            self.request.league,
            self.request.event_id,
        )
        changes = detect_changes(self.last_snapshot, snapshot)
        self.last_snapshot = snapshot

        await self._broadcast(GameStateEvent(snapshot=snapshot).model_dump())

        for change in changes:
            line = await self._commentary.generate(
                persona=self.request.persona,
                change=change,
                snapshot=snapshot,
                recent_lines=self.recent_lines,
            )
            self.recent_lines.append(line)
            self.recent_lines = self.recent_lines[-10:]

            audio_base64 = None
            audio_mime = None
            tts_result = await self._tts.synthesize(line)
            if tts_result:
                audio_base64, audio_mime = tts_result

            event = CommentaryEvent(
                text=line,
                trigger=change.trigger,
                audio_base64=audio_base64,
                audio_mime=audio_mime,
            )
            await self._broadcast(event.model_dump())

    async def _broadcast(self, payload: dict[str, Any]) -> None:
        dead: list[WebSocket] = []
        for ws in self._subscribers:
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self._subscribers.discard(ws)


class GameSessionManager:
    def __init__(self) -> None:
        self._sessions: dict[str, GameSession] = {}

    def create(self, request: CreateSessionRequest) -> GameSession:
        session = GameSession(request)
        self._sessions[session.session_id] = session
        return session

    def get(self, session_id: str) -> GameSession | None:
        return self._sessions.get(session_id)

    def list_sessions(self) -> list[GameSession]:
        return list(self._sessions.values())

    async def attach_websocket(self, session_id: str, websocket: WebSocket) -> GameSession:
        session = self._sessions.get(session_id)
        if not session:
            raise KeyError(session_id)

        await session.subscribe(websocket)
        await session.start()

        await websocket.send_json(
            HeartbeatEvent(session_id=session_id).model_dump()
        )
        if session.last_snapshot:
            await websocket.send_json(
                GameStateEvent(snapshot=session.last_snapshot).model_dump()
            )
        return session


session_manager = GameSessionManager()
