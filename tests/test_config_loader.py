"""Tests for nanobot.config.loader — load/save/migrate."""

from __future__ import annotations

import json

import pytest

from nanobot.config.loader import load_config, save_config
from nanobot.config.schema import Config

# ---------------------------------------------------------------------------
# load_config
# ---------------------------------------------------------------------------

class TestLoadConfig:
    def test_load_returns_default_when_no_file(self, tmp_path):
        path = tmp_path / "config.json"
        cfg = load_config(path)
        assert isinstance(cfg, Config)

    def test_load_reads_existing_file(self, tmp_path):
        path = tmp_path / "config.json"
        data = {
            "agents": {
                "defaults": {
                    "model": "openai/gpt-4o",
                    "maxTokens": 1234,
                }
            }
        }
        path.write_text(json.dumps(data))
        cfg = load_config(path)
        assert cfg.agents.defaults.model == "openai/gpt-4o"
        assert cfg.agents.defaults.max_tokens == 1234

    def test_load_rejects_invalid_json(self, tmp_path):
        from nanobot.config.errors import ConfigLoadError

        path = tmp_path / "config.json"
        path.write_text("{ not valid json }")
        with pytest.raises(ConfigLoadError):
            load_config(path)

    def test_load_handles_partial_config(self, tmp_path):
        path = tmp_path / "config.json"
        path.write_text(json.dumps({"agents": {"defaults": {"temperature": 0.3}}}))
        cfg = load_config(path)
        assert cfg.agents.defaults.temperature == 0.3
        # Other fields should still have defaults
        assert cfg.agents.defaults.max_tokens > 0

    def test_load_web_config(self, tmp_path):
        path = tmp_path / "config.json"
        data = {
            "web": {
                "enabled": True,
                "host": "0.0.0.0",
                "port": 9090,
                "auth": {"enabled": True, "token": "tok123"},
            }
        }
        path.write_text(json.dumps(data))
        cfg = load_config(path)
        assert cfg.web.enabled is True
        assert cfg.web.host == "0.0.0.0"
        assert cfg.web.port == 9090
        assert cfg.web.auth.enabled is True
        assert cfg.web.auth.token == "tok123"

    def test_load_providers(self, tmp_path):
        path = tmp_path / "config.json"
        data = {"providers": {"openai": {"apiKey": "sk-test"}}}
        path.write_text(json.dumps(data))
        cfg = load_config(path)
        assert cfg.providers.openai.api_key == "sk-test"


# ---------------------------------------------------------------------------
# save_config
# ---------------------------------------------------------------------------

class TestSaveConfig:
    def test_save_creates_file(self, tmp_path):
        path = tmp_path / "config.json"
        cfg = Config()
        save_config(cfg, path)
        assert path.exists()

    def test_save_writes_valid_json(self, tmp_path):
        path = tmp_path / "config.json"
        cfg = Config()
        save_config(cfg, path)
        data = json.loads(path.read_text())
        assert isinstance(data, dict)

    def test_save_uses_camelcase_keys(self, tmp_path):
        path = tmp_path / "config.json"
        cfg = Config()
        cfg.agents.defaults.max_tokens = 9999
        save_config(cfg, path)
        data = json.loads(path.read_text())
        # Should be camelCase in the file
        assert data["agents"]["defaults"]["maxTokens"] == 9999

    def test_save_creates_parent_dirs(self, tmp_path):
        path = tmp_path / "nested" / "deep" / "config.json"
        cfg = Config()
        save_config(cfg, path)
        assert path.exists()

    def test_roundtrip_load_save_load(self, tmp_path):
        path = tmp_path / "config.json"
        cfg = Config()
        cfg.agents.defaults.model = "openai/gpt-4o"
        cfg.agents.defaults.temperature = 0.42
        cfg.web.auth.token = "roundtrip-token"
        save_config(cfg, path)

        cfg2 = load_config(path)
        assert cfg2.agents.defaults.model == "openai/gpt-4o"
        assert cfg2.agents.defaults.temperature == pytest.approx(0.42)
        assert cfg2.web.auth.token == "roundtrip-token"

    def test_save_web_auth_config(self, tmp_path):
        path = tmp_path / "config.json"
        cfg = Config()
        cfg.web.enabled = True
        cfg.web.auth.enabled = True
        cfg.web.auth.token = "my-secret"
        save_config(cfg, path)

        data = json.loads(path.read_text())
        assert data["web"]["auth"]["token"] == "my-secret"
        assert data["web"]["auth"]["enabled"] is True


# ---------------------------------------------------------------------------
# Config migration
# ---------------------------------------------------------------------------

class TestMigration:
    def test_migrate_exec_restrict_to_workspace(self, tmp_path):
        """Old format: tools.exec.restrictToWorkspace → tools.restrictToWorkspace"""
        path = tmp_path / "config.json"
        old_data = {
            "tools": {
                "exec": {"restrictToWorkspace": True}
            }
        }
        path.write_text(json.dumps(old_data))
        cfg = load_config(path)
        assert cfg.tools.restrict_to_workspace is True
