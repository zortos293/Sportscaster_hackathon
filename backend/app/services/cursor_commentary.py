from __future__ import annotations

import asyncio
import base64
import logging
import time
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

CURSOR_API_BASE = "https://api.cursor.com/v1"


def cursor_configured() -> bool:
    key = settings.cursor_api_key
    return bool(key and key != "your_cursor_api_key_here")


def _build_prompt(system_prompt: str, user_prompt: str) -> str:
    return f"""{system_prompt}

---

{user_prompt}

---

Reply with ONLY the spoken broadcast line — no quotes, labels, markdown, or explanation."""


def _auth_header(api_key: str) -> dict[str, str]:
    token = base64.b64encode(f"{api_key}:".encode()).decode()
    return {"Authorization": f"Basic {token}", "Content-Type": "application/json"}


async def _wait_for_run(
    client: httpx.AsyncClient,
    headers: dict[str, str],
    agent_id: str,
    run_id: str,
    timeout_ms: int,
) -> str:
    deadline = time.monotonic() + timeout_ms / 1000

    while time.monotonic() < deadline:
        response = await client.get(
            f"{CURSOR_API_BASE}/agents/{agent_id}/runs/{run_id}",
            headers=headers,
        )
        response.raise_for_status()
        run: dict[str, Any] = response.json()
        status = run.get("status", "")

        if status == "FINISHED":
            result = (run.get("result") or "").strip()
            if result:
                return result
            raise RuntimeError("Cursor run finished without commentary text")

        if status in {"ERROR", "CANCELLED", "EXPIRED"}:
            raise RuntimeError(f"Cursor run {status.lower()}")

        await asyncio.sleep(0.8)

    raise TimeoutError("Cursor commentary timed out")


async def generate_cursor_commentary(
    *,
    system_prompt: str,
    user_prompt: str,
    agent_id: str | None = None,
) -> tuple[str, str]:
    if not cursor_configured():
        raise RuntimeError("Cursor API key is not configured")

    api_key = settings.cursor_api_key
    headers = _auth_header(api_key)
    prompt_text = _build_prompt(system_prompt, user_prompt)
    model = settings.cursor_commentary_model

    async with httpx.AsyncClient(timeout=60.0) as client:
        active_agent_id = agent_id
        run_id: str | None = None

        if active_agent_id:
            try:
                response = await client.post(
                    f"{CURSOR_API_BASE}/agents/{active_agent_id}/runs",
                    headers=headers,
                    json={"prompt": {"text": prompt_text}},
                )
                response.raise_for_status()
                run_id = response.json()["run"]["id"]
            except httpx.HTTPStatusError as exc:
                if exc.response.status_code != 409:
                    raise
                active_agent_id = None

        if not active_agent_id:
            response = await client.post(
                f"{CURSOR_API_BASE}/agents",
                headers=headers,
                json={
                    "prompt": {"text": prompt_text},
                    "model": {"id": model},
                    "name": "Sportscaster commentary",
                },
            )
            response.raise_for_status()
            payload = response.json()
            active_agent_id = payload["agent"]["id"]
            run_id = payload["run"]["id"]

        assert active_agent_id and run_id
        text = await _wait_for_run(
            client,
            headers,
            active_agent_id,
            run_id,
            settings.cursor_commentary_timeout_ms,
        )
        return text, active_agent_id
