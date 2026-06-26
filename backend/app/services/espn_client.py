from __future__ import annotations

import json
import logging
import re
from typing import Any

import httpx

from app.config import settings
from app.models import GameSnapshot

logger = logging.getLogger(__name__)

SCORE_PATTERN = re.compile(r"(\d+)\s*[-–]\s*(\d+)")


class EspnClient:
    """Fetch game data via Apify ESPN MCP, with direct ESPN JSON fallback."""

    def __init__(self) -> None:
        self._mcp_url = f"{settings.espn_mcp_url}?token={settings.apify_token}"
        self._request_id = 0

    async def get_game_summary(self, sport: str, league: str, event_id: str) -> GameSnapshot:
        text = await self._call_mcp_tool(
            "espn_game_summary",
            {"sport": sport, "league": league, "eventId": event_id},
        )
        if text:
            return self._snapshot_from_text(text, sport, league, event_id)

        logger.warning("MCP game summary empty; falling back to ESPN site API")
        return await self._fetch_summary_direct(sport, league, event_id)

    async def get_live_scoreboard(self, sport: str, league: str) -> str:
        text = await self._call_mcp_tool(
            "espn_live_scoreboard",
            {"sport": sport, "league": league},
        )
        if text:
            return text

        url = f"https://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/scoreboard"
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.get(url)
            response.raise_for_status()
            return json.dumps(response.json())

    async def _call_mcp_tool(self, name: str, arguments: dict[str, Any]) -> str | None:
        if not settings.apify_token:
            return None

        self._request_id += 1
        payload = {
            "jsonrpc": "2.0",
            "id": self._request_id,
            "method": "tools/call",
            "params": {"name": name, "arguments": arguments},
        }

        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(self._mcp_url, json=payload, headers=headers)
                response.raise_for_status()
                return self._extract_mcp_text(response)
        except Exception:
            logger.exception("ESPN MCP tool call failed: %s", name)
            return None

    def _extract_mcp_text(self, response: httpx.Response) -> str | None:
        content_type = response.headers.get("content-type", "")
        body = response.text.strip()
        if not body:
            return None

        if "text/event-stream" in content_type:
            for line in body.splitlines():
                if line.startswith("data:"):
                    chunk = line[5:].strip()
                    if chunk and chunk != "[DONE]":
                        parsed = self._parse_json_rpc(chunk)
                        if parsed:
                            return parsed
            return None

        try:
            data = response.json()
        except json.JSONDecodeError:
            return body

        if isinstance(data, dict):
            return self._parse_json_rpc(json.dumps(data)) or self._coerce_text(data)
        return body

    def _parse_json_rpc(self, raw: str) -> str | None:
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            return None

        if not isinstance(data, dict):
            return None

        result = data.get("result")
        if isinstance(result, dict):
            content = result.get("content")
            if isinstance(content, list):
                parts: list[str] = []
                for item in content:
                    if isinstance(item, dict) and item.get("type") == "text":
                        parts.append(str(item.get("text", "")))
                if parts:
                    return "\n".join(parts).strip()
            if "text" in result:
                return str(result["text"]).strip()

        error = data.get("error")
        if error:
            logger.error("MCP error: %s", error)
        return None

    def _coerce_text(self, data: dict[str, Any]) -> str | None:
        for key in ("mcpResponse", "text", "content"):
            value = data.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
        return None

    async def _fetch_summary_direct(self, sport: str, league: str, event_id: str) -> GameSnapshot:
        url = f"https://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/summary"
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.get(url, params={"event": event_id})
            response.raise_for_status()
            payload = response.json()

        header = payload.get("header", {})
        competitions = header.get("competitions") or []
        competition = competitions[0] if competitions else {}
        competitors = competition.get("competitors") or []

        home = next((c for c in competitors if c.get("homeAway") == "home"), {})
        away = next((c for c in competitors if c.get("homeAway") == "away"), {})

        status = competition.get("status", {}).get("type", {})
        leaders = payload.get("leaders") or []

        leader_bits: list[str] = []
        for group in leaders[:2]:
            category = group.get("displayName", "Leader")
            for leader in (group.get("leaders") or [])[:1]:
                athlete = leader.get("athlete", {})
                leader_bits.append(f"{category}: {athlete.get('displayName', 'Unknown')}")

        raw_text = (
            f"{away.get('team', {}).get('displayName', 'Away')} "
            f"{away.get('score', '?')} - {home.get('score', '?')} "
            f"{home.get('team', {}).get('displayName', 'Home')}\n"
            f"Status: {status.get('description', status.get('shortDetail', 'Unknown'))}"
        )

        return GameSnapshot(
            raw_text=raw_text,
            score_home=_safe_int(home.get("score")),
            score_away=_safe_int(away.get("score")),
            status=status.get("description") or status.get("shortDetail"),
            period=status.get("shortDetail"),
            leaders=" | ".join(leader_bits) or None,
            metadata={"source": "espn_direct", "event_id": event_id},
        )

    def _snapshot_from_text(self, text: str, sport: str, league: str, event_id: str) -> GameSnapshot:
        score_home, score_away = None, None
        match = SCORE_PATTERN.search(text)
        if match:
            score_away, score_home = int(match.group(1)), int(match.group(2))

        status = None
        for line in text.splitlines():
            lower = line.lower()
            if any(token in lower for token in ("final", "quarter", "half", "period", "live", "scheduled")):
                status = line.strip()
                break

        leaders = None
        if "top:" in text.lower() or "leaders:" in text.lower():
            leaders = text.split("LEADERS:")[-1].strip()[:400] if "LEADERS:" in text else text[:400]

        return GameSnapshot(
            raw_text=text,
            score_home=score_home,
            score_away=score_away,
            status=status,
            period=status,
            leaders=leaders,
            metadata={"source": "espn_mcp", "sport": sport, "league": league, "event_id": event_id},
        )


def _safe_int(value: Any) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None
