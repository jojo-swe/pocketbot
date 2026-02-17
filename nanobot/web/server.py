"""FastAPI web server for pocketbot web UI."""

from __future__ import annotations

import asyncio
import json
import time
import uuid
from pathlib import Path
from typing import Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from loguru import logger
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from nanobot.bus.events import InboundMessage
from nanobot.bus.queue import MessageBus


STATIC_DIR = Path(__file__).parent / "static"
_BOOT_TIME = time.monotonic()

# Safe settings fields that can be updated via the web UI (no secrets)
_SAFE_SETTINGS = {"model", "max_tokens", "temperature", "memory_window"}


class SecureHeadersMiddleware(BaseHTTPMiddleware):
    """Inject security headers on every HTTP response."""

    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)

    async def dispatch(self, request: Request, call_next):  # type: ignore[override]
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = (
            "camera=(), microphone=(), geolocation=()"
        )
        response.headers["X-XSS-Protection"] = "1; mode=block"
        return response


def _is_local_request(request: Request) -> bool:
    """Check if the request originates from localhost / LAN loopback."""
    host = request.client.host if request.client else ""
    return host in ("127.0.0.1", "::1", "localhost", "0:0:0:0:0:0:0:1")


def create_app(
    bus: MessageBus,
    agent_loop: Any = None,
    config: Any = None,
) -> FastAPI:
    """
    Create the FastAPI application for pocketbot web UI.

    Args:
        bus: The message bus for agent communication.
        agent_loop: The AgentLoop instance.
        config: The nanobot Config object.

    Returns:
        Configured FastAPI application.
    """
    app = FastAPI(title="pocketbot", docs_url="/api/docs")

    # Security headers on every response
    app.add_middleware(SecureHeadersMiddleware)

    # Allow companion app / other origins to call the API
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Track active WebSocket connections: ws_id -> WebSocket
    connections: dict[str, WebSocket] = {}
    # Map ws_id -> pending response futures
    pending: dict[str, asyncio.Future] = {}

    # -------------------------------------------------------------------
    # Auth dependency
    # -------------------------------------------------------------------

    def _check_auth(request: Request) -> None:
        """Enforce token auth for non-local requests when auth is enabled."""
        if not config or not config.web.auth.enabled:
            # Auth disabled — warn if non-local
            if not _is_local_request(request):
                logger.warning(
                    f"Unauthenticated non-local request from {request.client.host}. "
                    "Consider enabling web.auth in config."
                )
            return
        # Auth enabled — validate token
        auth_header = request.headers.get("authorization", "")
        token = auth_header.removeprefix("Bearer ").strip()
        if not token or token != config.web.auth.token:
            if not _is_local_request(request):
                raise HTTPException(status_code=401, detail="Unauthorized")
            # Local requests get a pass even with auth enabled
            return

    auth_dep = Depends(_check_auth)

    # -------------------------------------------------------------------
    # REST endpoints
    # -------------------------------------------------------------------

    @app.get("/", response_class=HTMLResponse)
    async def index():
        """Serve the web UI."""
        index_path = STATIC_DIR / "index.html"
        if index_path.exists():
            return HTMLResponse(index_path.read_text(encoding="utf-8"))
        return HTMLResponse("<h1>pocketbot</h1><p>Static files not found.</p>")

    @app.get("/api/status", dependencies=[auth_dep])
    async def api_status():
        """Get pocketbot status and diagnostics."""
        uptime = time.monotonic() - _BOOT_TIME
        provider_name = None
        if config:
            provider_name = config.get_provider_name()
        return {
            "status": "running",
            "version": _get_version(),
            "uptime_seconds": round(uptime, 1),
            "connections": len(connections),
            "model": config.agents.defaults.model if config else "unknown",
            "provider": provider_name or "unknown",
            "auth_enabled": config.web.auth.enabled if config else False,
            "host": config.web.host if config else "unknown",
            "port": config.web.port if config else 0,
        }

    @app.get("/api/config", dependencies=[auth_dep])
    async def api_config():
        """Get safe (non-secret) configuration info."""
        if not config:
            return {"error": "Config not available"}
        return {
            "model": config.agents.defaults.model,
            "max_tokens": config.agents.defaults.max_tokens,
            "temperature": config.agents.defaults.temperature,
            "memory_window": config.agents.defaults.memory_window,
            "max_tool_iterations": config.agents.defaults.max_tool_iterations,
            "workspace": str(config.workspace_path),
            "web_host": config.web.host,
            "web_port": config.web.port,
            "auth_enabled": config.web.auth.enabled,
        }

    @app.put("/api/config", dependencies=[auth_dep])
    async def api_config_update(request: Request):
        """Update safe (non-secret) configuration fields and persist to disk."""
        if not config:
            raise HTTPException(status_code=503, detail="Config not available")

        body = await request.json()
        updated = {}
        errors = {}

        for key, value in body.items():
            if key not in _SAFE_SETTINGS:
                errors[key] = "not an editable field"
                continue
            try:
                if key == "model" and isinstance(value, str) and value.strip():
                    config.agents.defaults.model = value.strip()
                    updated[key] = value.strip()
                elif key == "max_tokens" and isinstance(value, (int, float)):
                    val = max(1, int(value))
                    config.agents.defaults.max_tokens = val
                    updated[key] = val
                elif key == "temperature" and isinstance(value, (int, float)):
                    val = round(max(0.0, min(2.0, float(value))), 2)
                    config.agents.defaults.temperature = val
                    updated[key] = val
                elif key == "memory_window" and isinstance(value, (int, float)):
                    val = max(1, int(value))
                    config.agents.defaults.memory_window = val
                    updated[key] = val
                else:
                    errors[key] = f"invalid value: {value!r}"
            except Exception as e:
                errors[key] = str(e)

        # Persist to disk
        if updated:
            try:
                from nanobot.config.loader import save_config
                save_config(config)
            except Exception as e:
                logger.error(f"Failed to persist config: {e}")
                errors["_persist"] = str(e)

        return {"updated": updated, "errors": errors}

    @app.post("/api/ping", dependencies=[auth_dep])
    async def api_ping():
        """Simple health-check endpoint."""
        return {"pong": True, "timestamp": _timestamp()}

    # -------------------------------------------------------------------
    # Push notification support (Expo Push)
    # -------------------------------------------------------------------

    # Set of registered Expo push tokens
    push_tokens: set[str] = set()

    @app.post("/api/push/register", dependencies=[auth_dep])
    async def push_register(request: Request):
        """Register an Expo push token for notifications."""
        body = await request.json()
        token = body.get("token", "").strip()
        if not token or not token.startswith("ExponentPushToken["):
            raise HTTPException(
                status_code=400,
                detail="Invalid Expo push token",
            )
        push_tokens.add(token)
        logger.info(f"Push token registered ({len(push_tokens)} total)")
        return {"registered": True, "total": len(push_tokens)}

    @app.delete("/api/push/register", dependencies=[auth_dep])
    async def push_unregister(request: Request):
        """Unregister an Expo push token."""
        body = await request.json()
        token = body.get("token", "").strip()
        push_tokens.discard(token)
        return {"unregistered": True, "total": len(push_tokens)}

    @app.get("/api/push/tokens", dependencies=[auth_dep])
    async def push_list_tokens():
        """List registered push token count (not the tokens themselves)."""
        return {"count": len(push_tokens)}

    async def _send_push(title: str, body: str) -> None:
        """Send push notification to all registered Expo tokens."""
        if not push_tokens:
            return
        import httpx
        messages = [
            {
                "to": tok,
                "sound": "default",
                "title": title,
                "body": body[:200],
            }
            for tok in push_tokens
        ]
        try:
            async with httpx.AsyncClient() as client:
                await client.post(
                    "https://exp.host/--/api/v2/push/send",
                    json=messages,
                    headers={
                        "Content-Type": "application/json",
                    },
                    timeout=10.0,
                )
        except Exception as e:
            logger.warning(f"Push notification failed: {e}")

    # -------------------------------------------------------------------
    # WebSocket chat endpoint
    # -------------------------------------------------------------------

    @app.websocket("/ws/chat")
    async def websocket_chat(ws: WebSocket):
        # Auth check for WebSocket
        if config and config.web.auth.enabled:
            # Check query param ?token=xxx or first message auth
            token_param = ws.query_params.get("token", "")
            if token_param != config.web.auth.token:
                if not _is_local_request_ws(ws):
                    await ws.close(code=4001, reason="Unauthorized")
                    return

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
                    # Fire push for backgrounded companion apps
                    asyncio.create_task(
                        _send_push(
                            "pocketbot",
                            (response_text or "")[:200],
                        )
                    )
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


def _is_local_request_ws(ws: WebSocket) -> bool:
    """Check if a WebSocket request originates from localhost."""
    host = ws.client.host if ws.client else ""
    return host in ("127.0.0.1", "::1", "localhost", "0:0:0:0:0:0:0:1")


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
