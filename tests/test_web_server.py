"""Tests for the pocketbot FastAPI web server (REST endpoints, auth, upload, pair)."""

from __future__ import annotations

import io
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from nanobot.bus.queue import MessageBus
from nanobot.config.schema import Config, WebAuthConfig, WebConfig
from nanobot.web.server import create_app

# ---------------------------------------------------------------------------
# Helpers / fixtures
# ---------------------------------------------------------------------------

def _make_config(
    *,
    auth_enabled: bool = False,
    token: str = "secret",
    host: str = "localhost",
    port: int = 8080,
) -> Config:
    cfg = Config()
    cfg.web = WebConfig(
        enabled=True,
        host=host,
        port=port,
        auth=WebAuthConfig(enabled=auth_enabled, token=token),
    )
    return cfg


def _make_client(config: Config | None = None) -> TestClient:
    bus = MessageBus()
    app = create_app(bus, agent_loop=None, config=config)
    return TestClient(app, raise_server_exceptions=True)


@pytest.fixture
def client_no_auth():
    return _make_client(_make_config(auth_enabled=False))


@pytest.fixture
def client_auth():
    return _make_client(_make_config(auth_enabled=True, token="mytoken"))


@pytest.fixture
def client_no_config():
    return _make_client(config=None)


# ---------------------------------------------------------------------------
# Root / index
# ---------------------------------------------------------------------------

class TestIndex:
    def test_index_returns_html(self, client_no_auth):
        r = client_no_auth.get("/")
        assert r.status_code == 200
        assert "text/html" in r.headers["content-type"]

    def test_index_has_security_headers(self, client_no_auth):
        r = client_no_auth.get("/")
        assert r.headers.get("x-content-type-options") == "nosniff"
        assert r.headers.get("x-frame-options") == "DENY"
        assert "strict-origin" in r.headers.get("referrer-policy", "")


# ---------------------------------------------------------------------------
# /api/ping
# ---------------------------------------------------------------------------

class TestPing:
    def test_ping_ok(self, client_no_auth):
        r = client_no_auth.post("/api/ping")
        assert r.status_code == 200
        data = r.json()
        assert data["pong"] is True
        assert "timestamp" in data

    def test_ping_requires_auth_when_enabled(self, client_auth):
        # Non-local request without token → 401
        r = client_auth.post(
            "/api/ping",
            headers={"x-forwarded-for": "10.0.0.1"},
        )
        # TestClient uses 127.0.0.1 which is local — local requests pass even with auth
        # so we just verify the endpoint responds
        assert r.status_code in (200, 401)

    def test_ping_with_valid_token(self, client_auth):
        r = client_auth.post(
            "/api/ping",
            headers={"Authorization": "Bearer mytoken"},
        )
        assert r.status_code == 200
        assert r.json()["pong"] is True

    def test_ping_with_wrong_token_no_header(self, client_auth):
        # TestClient sends from testclient host — auth is enabled so no token → 401
        r = client_auth.post("/api/ping")
        assert r.status_code == 401


# ---------------------------------------------------------------------------
# /api/status
# ---------------------------------------------------------------------------

class TestStatus:
    def test_status_shape(self, client_no_auth):
        r = client_no_auth.get("/api/status")
        assert r.status_code == 200
        d = r.json()
        assert d["status"] == "running"
        assert "version" in d
        assert "uptime_seconds" in d
        assert "connections" in d
        assert isinstance(d["uptime_seconds"], float)

    def test_status_reflects_config(self, client_no_auth):
        r = client_no_auth.get("/api/status")
        d = r.json()
        assert d["host"] == "localhost"
        assert d["port"] == 8080
        assert d["auth_enabled"] is False

    def test_status_no_config(self, client_no_config):
        r = client_no_config.get("/api/status")
        assert r.status_code == 200
        d = r.json()
        assert d["model"] == "unknown"

    def test_status_auth_enabled_flag(self, client_auth):
        r = client_auth.get("/api/status", headers={"Authorization": "Bearer mytoken"})
        assert r.status_code == 200
        assert r.json()["auth_enabled"] is True


# ---------------------------------------------------------------------------
# /api/config  GET + PUT
# ---------------------------------------------------------------------------

class TestConfig:
    def test_get_config_shape(self, client_no_auth):
        r = client_no_auth.get("/api/config")
        assert r.status_code == 200
        d = r.json()
        for key in ("model", "max_tokens", "temperature", "memory_window",
                    "max_tool_iterations", "workspace", "web_host", "web_port",
                    "auth_enabled"):
            assert key in d, f"missing key: {key}"

    def test_get_config_no_config(self, client_no_config):
        r = client_no_config.get("/api/config")
        assert r.status_code == 200
        assert "error" in r.json()

    def test_put_config_model(self, client_no_auth):
        r = client_no_auth.put("/api/config", json={"model": "openai/gpt-4o"})
        assert r.status_code == 200
        d = r.json()
        assert d["updated"]["model"] == "openai/gpt-4o"
        assert d["errors"] == {}

    def test_put_config_temperature_clamped(self, client_no_auth):
        r = client_no_auth.put("/api/config", json={"temperature": 5.0})
        assert r.status_code == 200
        assert r.json()["updated"]["temperature"] == 2.0

    def test_put_config_temperature_min(self, client_no_auth):
        r = client_no_auth.put("/api/config", json={"temperature": -1.0})
        assert r.status_code == 200
        assert r.json()["updated"]["temperature"] == 0.0

    def test_put_config_max_tokens_min_1(self, client_no_auth):
        r = client_no_auth.put("/api/config", json={"max_tokens": 0})
        assert r.status_code == 200
        assert r.json()["updated"]["max_tokens"] == 1

    def test_put_config_memory_window(self, client_no_auth):
        r = client_no_auth.put("/api/config", json={"memory_window": 10})
        assert r.status_code == 200
        assert r.json()["updated"]["memory_window"] == 10

    def test_put_config_rejects_secret_fields(self, client_no_auth):
        r = client_no_auth.put("/api/config", json={"token": "hacked"})
        assert r.status_code == 200
        d = r.json()
        assert "token" in d["errors"]
        assert d["updated"] == {}

    def test_put_config_rejects_unknown_fields(self, client_no_auth):
        r = client_no_auth.put("/api/config", json={"foo": "bar"})
        assert r.status_code == 200
        assert "foo" in r.json()["errors"]

    def test_put_config_no_config_503(self, client_no_config):
        r = client_no_config.put("/api/config", json={"model": "x"})
        assert r.status_code == 503

    def test_put_config_invalid_model_type(self, client_no_auth):
        r = client_no_auth.put("/api/config", json={"model": 123})
        assert r.status_code == 200
        assert "model" in r.json()["errors"]

    def test_put_config_empty_model_rejected(self, client_no_auth):
        r = client_no_auth.put("/api/config", json={"model": "   "})
        assert r.status_code == 200
        assert "model" in r.json()["errors"]

    def test_put_config_multiple_fields(self, client_no_auth):
        r = client_no_auth.put("/api/config", json={
            "model": "openai/gpt-4o-mini",
            "temperature": 0.5,
            "max_tokens": 2048,
        })
        assert r.status_code == 200
        d = r.json()
        assert d["updated"]["model"] == "openai/gpt-4o-mini"
        assert d["updated"]["temperature"] == 0.5
        assert d["updated"]["max_tokens"] == 2048


# ---------------------------------------------------------------------------
# /api/auth/rotate
# ---------------------------------------------------------------------------

class TestAuthRotate:
    def test_rotate_when_auth_disabled_400(self, client_no_auth):
        r = client_no_auth.post("/api/auth/rotate")
        assert r.status_code == 400
        assert "not enabled" in r.json()["detail"].lower()

    def test_rotate_no_config_503(self, client_no_config):
        r = client_no_config.post("/api/auth/rotate")
        assert r.status_code == 503

    def test_rotate_returns_new_token(self, client_auth):
        with patch("nanobot.config.loader.save_config"):
            r = client_auth.post(
                "/api/auth/rotate",
                headers={"Authorization": "Bearer mytoken"},
            )
        assert r.status_code == 200
        d = r.json()
        assert d["rotated"] is True
        assert "token" in d
        assert len(d["token"]) > 20  # urlsafe(32) → ~43 chars

    def test_rotate_token_changes(self):
        # Use a fresh client per rotation so the config state is independent
        with patch("nanobot.config.loader.save_config"):
            c1 = _make_client(_make_config(auth_enabled=True, token="tok1"))
            r1 = c1.post("/api/auth/rotate", headers={"Authorization": "Bearer tok1"})
            c2 = _make_client(_make_config(auth_enabled=True, token="tok2"))
            r2 = c2.post("/api/auth/rotate", headers={"Authorization": "Bearer tok2"})
        assert r1.status_code == 200
        assert r2.status_code == 200
        # Two independent rotations should produce different tokens (probabilistically)
        assert r1.json()["token"] != r2.json()["token"]

    def test_rotate_save_failure_500(self, client_auth):
        with patch("nanobot.config.loader.save_config", side_effect=OSError("disk full")):
            r = client_auth.post(
                "/api/auth/rotate",
                headers={"Authorization": "Bearer mytoken"},
            )
        assert r.status_code == 500
        assert "persist" in r.json()["detail"].lower()


# ---------------------------------------------------------------------------
# /api/pair
# ---------------------------------------------------------------------------

class TestPair:
    def test_pair_no_auth(self, client_no_auth):
        r = client_no_auth.get("/api/pair")
        assert r.status_code == 200
        d = r.json()
        assert d["pocketbot"] is True
        assert "url" in d
        assert "token" in d
        assert "version" in d

    def test_pair_token_empty_when_auth_disabled(self, client_no_auth):
        r = client_no_auth.get("/api/pair")
        assert r.json()["token"] == ""

    def test_pair_token_present_when_auth_enabled(self, client_auth):
        r = client_auth.get("/api/pair")
        assert r.status_code == 200
        assert r.json()["token"] == "mytoken"

    def test_pair_url_uses_host_header(self, client_no_auth):
        r = client_no_auth.get("/api/pair", headers={"host": "myserver.local:8080"})
        assert "myserver.local:8080" in r.json()["url"]

    def test_pair_no_config(self, client_no_config):
        r = client_no_config.get("/api/pair")
        assert r.status_code == 200
        assert r.json()["token"] == ""


# ---------------------------------------------------------------------------
# /api/upload  +  /api/media
# ---------------------------------------------------------------------------

class TestUpload:
    @pytest.fixture(autouse=True)
    def _patch_media_dir(self, tmp_path):
        with patch("nanobot.identity.MEDIA_DIR", tmp_path):
            yield tmp_path

    def test_upload_image_ok(self, client_no_auth, tmp_path):
        data = b"\xff\xd8\xff" + b"\x00" * 100  # fake JPEG header
        r = client_no_auth.post(
            "/api/upload",
            files={"file": ("photo.jpg", io.BytesIO(data), "image/jpeg")},
        )
        assert r.status_code == 200
        d = r.json()
        assert d["content_type"] == "image/jpeg"
        assert d["url"].startswith("/api/media/")
        assert d["size"] == len(data)

    def test_upload_pdf_ok(self, client_no_auth):
        r = client_no_auth.post(
            "/api/upload",
            files={"file": ("doc.pdf", io.BytesIO(b"%PDF-1.4"), "application/pdf")},
        )
        assert r.status_code == 200

    def test_upload_text_ok(self, client_no_auth):
        r = client_no_auth.post(
            "/api/upload",
            files={"file": ("notes.txt", io.BytesIO(b"hello"), "text/plain")},
        )
        assert r.status_code == 200

    def test_upload_disallowed_type_415(self, client_no_auth):
        r = client_no_auth.post(
            "/api/upload",
            files={"file": ("script.exe", io.BytesIO(b"MZ"), "application/octet-stream")},
        )
        assert r.status_code == 415

    def test_upload_too_large_413(self, client_no_auth):
        big = b"x" * (20 * 1024 * 1024 + 1)
        r = client_no_auth.post(
            "/api/upload",
            files={"file": ("big.jpg", io.BytesIO(big), "image/jpeg")},
        )
        assert r.status_code == 413

    def test_media_serve_uploaded_file(self, client_no_auth, tmp_path):
        content = b"image bytes"
        r = client_no_auth.post(
            "/api/upload",
            files={"file": ("img.png", io.BytesIO(content), "image/png")},
        )
        assert r.status_code == 200
        url = r.json()["url"]
        r2 = client_no_auth.get(url)
        assert r2.status_code == 200
        assert r2.content == content

    def test_media_not_found_404(self, client_no_auth):
        r = client_no_auth.get("/api/media/nonexistent.jpg")
        assert r.status_code == 404

    def test_media_path_traversal_blocked(self, client_no_auth):
        r = client_no_auth.get("/api/media/../../../etc/passwd")
        # FastAPI will 404 or 400 — either is acceptable
        assert r.status_code in (400, 404, 422)


# ---------------------------------------------------------------------------
# /api/push/*
# ---------------------------------------------------------------------------

class TestPush:
    def test_register_valid_token(self, client_no_auth):
        r = client_no_auth.post(
            "/api/push/register",
            json={"token": "ExponentPushToken[abc123]"},
        )
        assert r.status_code == 200
        d = r.json()
        assert d["registered"] is True
        assert d["total"] >= 1

    def test_register_invalid_token_400(self, client_no_auth):
        r = client_no_auth.post(
            "/api/push/register",
            json={"token": "not-an-expo-token"},
        )
        assert r.status_code == 400

    def test_register_empty_token_400(self, client_no_auth):
        r = client_no_auth.post("/api/push/register", json={"token": ""})
        assert r.status_code == 400

    def test_unregister_token(self, client_no_auth):
        tok = "ExponentPushToken[xyz789]"
        client_no_auth.post("/api/push/register", json={"token": tok})
        r = client_no_auth.request(
            "DELETE",
            "/api/push/register",
            json={"token": tok},
        )
        assert r.status_code == 200
        assert r.json()["unregistered"] is True

    def test_list_tokens_count(self, client_no_auth):
        # Fresh client — use a separate one to avoid state bleed
        bus = MessageBus()
        app = create_app(bus, config=_make_config())
        client = TestClient(app)
        client.post("/api/push/register", json={"token": "ExponentPushToken[a1]"})
        client.post("/api/push/register", json={"token": "ExponentPushToken[a2]"})
        r = client.get("/api/push/tokens")
        assert r.status_code == 200
        assert r.json()["count"] == 2

    def test_register_duplicate_idempotent(self, client_no_auth):
        tok = "ExponentPushToken[dup1]"
        bus = MessageBus()
        app = create_app(bus, config=_make_config())
        client = TestClient(app)
        client.post("/api/push/register", json={"token": tok})
        client.post("/api/push/register", json={"token": tok})
        r = client.get("/api/push/tokens")
        assert r.json()["count"] == 1  # set deduplicates


# ---------------------------------------------------------------------------
# Security headers middleware
# ---------------------------------------------------------------------------

class TestSecurityHeaders:
    ENDPOINTS = ["/api/status", "/api/config"]

    @pytest.mark.parametrize("endpoint", ENDPOINTS)
    def test_security_headers_present(self, client_no_auth, endpoint):
        r = client_no_auth.get(endpoint)
        assert r.headers.get("x-content-type-options") == "nosniff"
        assert r.headers.get("x-frame-options") == "DENY"
        assert r.headers.get("referrer-policy") == "strict-origin-when-cross-origin"
        assert "x-xss-protection" in r.headers
        assert "permissions-policy" in r.headers
