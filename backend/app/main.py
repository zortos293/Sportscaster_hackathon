from __future__ import annotations

import logging

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.models import CreateSessionRequest, SessionResponse
from app.services.game_session import session_manager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="AI Sportscaster",
    description="Live commentary backend powered by ESPN MCP + LLM + TTS",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/sessions", response_model=SessionResponse)
async def create_session(request: CreateSessionRequest) -> SessionResponse:
    session = session_manager.create(request)
    return SessionResponse(
        session_id=session.session_id,
        sport=request.sport,
        league=request.league,
        event_id=request.event_id,
        poll_interval_seconds=session.poll_interval,
        video_source=request.video_source,
        status=session.status,
    )


@app.get("/sessions")
async def list_sessions() -> list[SessionResponse]:
    return [
        SessionResponse(
            session_id=s.session_id,
            sport=s.request.sport,
            league=s.request.league,
            event_id=s.request.event_id,
            poll_interval_seconds=s.poll_interval,
            video_source=s.request.video_source,
            status=s.status,
        )
        for s in session_manager.list_sessions()
    ]


@app.post("/sessions/{session_id}/stop")
async def stop_session(session_id: str) -> dict[str, str]:
    session = session_manager.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    await session.stop()
    return {"status": "stopped", "session_id": session_id}


@app.websocket("/ws/sessions/{session_id}")
async def session_websocket(websocket: WebSocket, session_id: str) -> None:
    await websocket.accept()
    try:
        session = await session_manager.attach_websocket(session_id, websocket)
    except KeyError:
        await websocket.send_json({"type": "error", "message": "Session not found"})
        await websocket.close(code=4404)
        return

    try:
        while True:
            # Keep connection alive; client may send pings or control messages later.
            await websocket.receive_text()
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected: %s", session_id)
    finally:
        await session.unsubscribe(websocket)
