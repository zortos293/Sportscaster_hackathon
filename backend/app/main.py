from __future__ import annotations

import logging
from pathlib import Path

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.demo_games import DEMO_GAMES, get_demo_game
from app.models import CreateSessionRequest, SessionResponse, VideoSource, VideoSourceType
from app.services.game_session import session_manager

SAMPLES_DIR = Path(__file__).resolve().parents[2] / "samples"

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


if SAMPLES_DIR.is_dir():
    app.mount("/media", StaticFiles(directory=SAMPLES_DIR), name="media")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/demo-games")
async def demo_games() -> list[dict]:
    return DEMO_GAMES


@app.get("/demo-games/{game_id}")
async def demo_game(game_id: str) -> dict:
    game = get_demo_game(game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Demo game not found")
    return game


@app.post("/demo-games/{game_id}/sessions", response_model=SessionResponse)
async def create_demo_session(game_id: str) -> SessionResponse:
    game = get_demo_game(game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Demo game not found")

    request = CreateSessionRequest(
        sport=game["sport"],
        league=game["league"],
        event_id=game["event_id"],
        poll_interval_seconds=30,
        video_source=VideoSource(
            type=VideoSourceType.FILE,
            url=f"/media/{game['video_file']}",
        ),
        persona=game["persona"],
    )
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
