"""FastAPI web server for nanobot web UI."""

from __future__ import annotations

import asyncio
import json
import uuid
from pathlib import Path
from typing import Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
from loguru import logger

from nanobot.bus.events import InboundMessage
from nanobot.bus.queue import MessageBus


STATIC_DIR = Path(__file__).parent / "static"


def create_app(
    bus: MessageBus,
    agent_loop: Any = None,
    config: Any = None,
) -> FastAPI:
    """
    Create the FastAPI application for nanobot web UI.

    Args:
        bus: The message bus for agent communication.
        agent_loop: The AgentLoop instance.
        config: The nanobot Config object.

    Returns:
        Configured FastAPI application.
    """
    app = FastAPI(title="nanobot", docs_url="/api/docs")

    # Track active WebSocket connections: ws_id -> WebSocket
    connections: dict[str, WebSocket] = {}
    # Map ws_id -> pending response futures
    pending: dict[str, asyncio.Future] = {}

    # -----------------------------------------------------------------------
    # REST endpoints
    # -----------------------------------------------------------------------

    @app.get("/", response_class=HTMLResponse)
    async def index():
        """Serve the web UI."""
        index_path = STATIC_DIR / "index.html"
        if index_path.exists():
            return HTMLResponse(index_path.read_text(encoding="utf-8"))
        return HTMLResponse("<h1>nanobot</h1><p>Static files not found.</p>")

    @app.get("/api/status")
    async def api_status():
        """Get nanobot status."""
        return {
            "status": "running",
            "version": _get_version(),
            "connections": len(connections),
            "model": config.agents.defaults.model if config else "unknown",
        }

    @app.get("/api/config")
    async def api_config():
        """Get safe (non-secret) configuration info."""
        if not config:
            return {"error": "Config not available"}
        return {
            "model": config.agents.defaults.model,
            "max_tokens": config.agents.defaults.max_tokens,
            "temperature": config.agents.defaults.temperature,
            "memory_window": config.agents.defaults.memory_window,
            "workspace": str(config.workspace_path),
        }

    # -----------------------------------------------------------------------
    # WebSocket chat endpoint
    # -----------------------------------------------------------------------

    @app.websocket("/ws/chat")
    async def websocket_chat(ws: WebSocket):
        await ws.accept()
        ws_id = str(uuid.uuid4())[:8]
        connections[ws_id] = ws
        session_key = f"web:{ws_id}"
        logger.info(f"WebSocket connected: {ws_id}")

        try:
            # Send welcome
            await ws.send_json({
                "type": "connected",
                "session_id": ws_id,
            })

            while True:
                raw = await ws.receive_text()
                try:
                    data = json.loads(raw)
                except json.JSONDecodeError:
                    data = {"content": raw}

                msg_type = data.get("type", "message")
                content = data.get("content", "").strip()

                if msg_type == "ping":
                    await ws.send_json({"type": "pong"})
                    continue

                if not content:
                    continue

                # Send typing indicator
                await ws.send_json({"type": "typing", "status": True})

                try:
                    if agent_loop:
                        response_text = await agent_loop.process_direct(
                            content,
                            session_key=session_key,
                            channel="web",
                            chat_id=ws_id,
                        )
                    else:
                        # Fallback: publish to bus and wait
                        response_text = await _process_via_bus(
                            bus, content, session_key, ws_id, pending
                        )

                    await ws.send_json({
                        "type": "message",
                        "role": "assistant",
                        "content": response_text or "",
                        "timestamp": _timestamp(),
                    })
                except Exception as e:
                    logger.error(f"Error processing web message: {e}")
                    await ws.send_json({
                        "type": "error",
                        "content": f"Error: {str(e)}",
                    })
                finally:
                    await ws.send_json({"type": "typing", "status": False})

        except WebSocketDisconnect:
            logger.info(f"WebSocket disconnected: {ws_id}")
        except Exception as e:
            logger.error(f"WebSocket error ({ws_id}): {e}")
        finally:
            connections.pop(ws_id, None)
            pending.pop(ws_id, None)

    return app


async def _process_via_bus(
    bus: MessageBus,
    content: str,
    session_key: str,
    ws_id: str,
    pending: dict[str, asyncio.Future],
) -> str:
    """Fallback: route through the message bus when no direct agent access."""
    future: asyncio.Future = asyncio.get_event_loop().create_future()
    pending[ws_id] = future

    await bus.publish_inbound(InboundMessage(
        channel="web",
        sender_id="web_user",
        chat_id=ws_id,
        content=content,
    ))

    try:
        result = await asyncio.wait_for(future, timeout=120.0)
        return result
    except asyncio.TimeoutError:
        return "Request timed out. Please try again."
    finally:
        pending.pop(ws_id, None)


def _get_version() -> str:
    try:
        from nanobot import __version__
        return __version__
    except ImportError:
        return "unknown"


def _timestamp() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()
