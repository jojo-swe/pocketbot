"""Tests for nanobot.config.schema — Config, WebConfig, providers, etc."""

from __future__ import annotations

from nanobot.config.schema import (
    Config,
    GatewayConfig,
    ProviderConfig,
    ProvidersConfig,
    WebAuthConfig,
    WebConfig,
)

# ---------------------------------------------------------------------------
# Defaults
# ---------------------------------------------------------------------------

class TestDefaults:
    def test_config_default_workspace(self):
        c = Config()
        assert "pocketbot" in str(c.agents.defaults.workspace)

    def test_config_default_model(self):
        c = Config()
        assert c.agents.defaults.model  # non-empty

    def test_config_default_web_disabled(self):
        c = Config()
        assert c.web.enabled is False

    def test_config_default_auth_disabled(self):
        c = Config()
        assert c.web.auth.enabled is False
        assert c.web.auth.token == ""

    def test_config_default_temperature_range(self):
        c = Config()
        assert 0.0 <= c.agents.defaults.temperature <= 2.0

    def test_config_default_max_tokens_positive(self):
        c = Config()
        assert c.agents.defaults.max_tokens > 0

    def test_config_default_memory_window_positive(self):
        c = Config()
        assert c.agents.defaults.memory_window > 0

    def test_gateway_defaults(self):
        g = GatewayConfig()
        assert g.host == "127.0.0.1"
        assert g.port == 18790

    def test_web_config_defaults(self):
        w = WebConfig()
        assert w.host == "localhost"
        assert w.port == 8080
        assert w.enabled is False

    def test_agent_defaults_workspace_path(self):
        c = Config()
        wp = c.workspace_path
        assert wp.is_absolute()


# ---------------------------------------------------------------------------
# WebConfig / WebAuthConfig
# ---------------------------------------------------------------------------

class TestWebConfig:
    def test_web_auth_enabled(self):
        auth = WebAuthConfig(enabled=True, token="tok123")
        assert auth.enabled is True
        assert auth.token == "tok123"

    def test_web_config_with_auth(self):
        w = WebConfig(
            enabled=True,
            host="0.0.0.0",
            port=9000,
            auth=WebAuthConfig(enabled=True, token="abc"),
        )
        assert w.port == 9000
        assert w.auth.token == "abc"

    def test_web_config_camelcase_alias(self):
        # Pydantic should accept camelCase keys via alias_generator
        w = WebConfig.model_validate({"enabled": True, "host": "x", "port": 1234})
        assert w.port == 1234


# ---------------------------------------------------------------------------
# ProvidersConfig
# ---------------------------------------------------------------------------

class TestProviders:
    def test_all_provider_fields_exist(self):
        p = ProvidersConfig()
        for name in (
            "anthropic", "openai", "openrouter", "deepseek", "groq",
            "zhipu", "dashscope", "vllm", "gemini", "moonshot",
            "minimax", "aihubmix", "siliconflow", "openai_codex",
            "github_copilot", "custom",
        ):
            assert hasattr(p, name), f"missing provider: {name}"

    def test_provider_config_defaults(self):
        p = ProviderConfig()
        assert p.api_key in (None, "")
        assert p.api_base is None
        assert p.extra_headers is None

    def test_provider_config_with_values(self):
        p = ProviderConfig(api_key="sk-123", api_base="https://api.example.com")
        assert p.api_key == "sk-123"
        assert p.api_base == "https://api.example.com"


# ---------------------------------------------------------------------------
# Config.get_provider / get_api_key / get_api_base
# ---------------------------------------------------------------------------

class TestConfigProviderLookup:
    def test_get_provider_returns_none_when_no_keys(self):
        c = Config()
        # No API keys set — should return None (no fallback)
        result = c.get_provider("openai/gpt-4o")
        assert result is None

    def test_get_provider_with_key(self):
        c = Config()
        c.providers.openai.api_key = "sk-test"
        p = c.get_provider("openai/gpt-4o")
        assert p is not None
        assert p.api_key == "sk-test"

    def test_get_api_key_returns_none_when_no_keys(self):
        c = Config()
        assert c.get_api_key() is None

    def test_get_api_key_with_matching_provider(self):
        c = Config()
        c.providers.anthropic.api_key = "ant-key"
        key = c.get_api_key("anthropic/claude-3-5-sonnet")
        assert key == "ant-key"

    def test_get_provider_name_deepseek(self):
        c = Config()
        c.providers.deepseek.api_key = "ds-key"
        name = c.get_provider_name("deepseek/deepseek-chat")
        assert name == "deepseek"

    def test_get_provider_name_openrouter(self):
        c = Config()
        c.providers.openrouter.api_key = "or-key"
        name = c.get_provider_name("openrouter/auto")
        assert name == "openrouter"

    def test_get_api_base_custom_override(self):
        c = Config()
        c.providers.openai.api_key = "sk-x"
        c.providers.openai.api_base = "https://custom.endpoint/v1"
        base = c.get_api_base("openai/gpt-4o")
        assert base == "https://custom.endpoint/v1"

    def test_get_provider_name_none_when_no_keys(self):
        c = Config()
        assert c.get_provider_name() is None

    def test_fallback_to_first_available_key(self):
        c = Config()
        c.providers.groq.api_key = "groq-key"
        # Model doesn't match groq keywords but groq has a key → fallback
        p = c.get_provider("some/unknown-model")
        assert p is not None
        assert p.api_key == "groq-key"


# ---------------------------------------------------------------------------
# Config validation / camelCase loading
# ---------------------------------------------------------------------------

class TestConfigValidation:
    def test_config_validates_from_camelcase_dict(self):
        # Pydantic alias_generator on Base handles camelCase keys directly
        data = {
            "agents": {
                "defaults": {
                    "model": "openai/gpt-4o",
                    "maxTokens": 4096,
                    "temperature": 0.9,
                }
            }
        }
        c = Config.model_validate(data)
        assert c.agents.defaults.model == "openai/gpt-4o"
        assert c.agents.defaults.max_tokens == 4096
        assert c.agents.defaults.temperature == 0.9

    def test_config_validates_from_snakecase_dict(self):
        # snake_case keys also work (populate_by_name=True)
        data = {
            "agents": {
                "defaults": {
                    "model": "openai/gpt-4o",
                    "max_tokens": 2048,
                    "temperature": 0.5,
                }
            }
        }
        c = Config.model_validate(data)
        assert c.agents.defaults.max_tokens == 2048

    def test_config_workspace_path_expands_home(self):
        c = Config()
        c.agents.defaults.workspace = "~/.pocketbot/workspace"
        wp = c.workspace_path
        assert not str(wp).startswith("~")
        assert wp.is_absolute()
