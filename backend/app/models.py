from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class VideoSourceType(str, Enum):
    NONE = "none"
    YOUTUBE = "youtube"
    TWITCH = "twitch"
    HLS = "hls"
    FILE = "file"


class VideoSource(BaseModel):
    type: VideoSourceType = VideoSourceType.NONE
    url: str | None = None


class CreateSessionRequest(BaseModel):
    sport: str = Field(..., examples=["basketball"])
    league: str = Field(..., examples=["mens-college-basketball"])
    event_id: str = Field(..., description="ESPN eventId from scoreboard or URL")
    poll_interval_seconds: int | None = Field(default=None, ge=15, le=300)
    video_source: VideoSource = Field(default_factory=VideoSource)
    persona: str = Field(
        default="enthusiastic niche-sports broadcaster",
        description="Commentary voice/style hint for the LLM",
    )


class SessionResponse(BaseModel):
    session_id: str
    sport: str
    league: str
    event_id: str
    poll_interval_seconds: int
    video_source: VideoSource
    status: str


class GameSnapshot(BaseModel):
    raw_text: str
    score_home: int | None = None
    score_away: int | None = None
    status: str | None = None
    period: str | None = None
    leaders: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class CommentaryEvent(BaseModel):
    type: str = "commentary"
    text: str
    trigger: str
    audio_base64: str | None = None
    audio_mime: str | None = None


class GameStateEvent(BaseModel):
    type: str = "game_state"
    snapshot: GameSnapshot


class HeartbeatEvent(BaseModel):
    type: str = "heartbeat"
    session_id: str
