"""Tests for nanobot.session.manager — Session and SessionManager."""

from __future__ import annotations

import pytest

from nanobot.session.manager import Session, SessionManager

# ---------------------------------------------------------------------------
# Session unit tests
# ---------------------------------------------------------------------------

class TestSession:
    def test_session_initial_state(self):
        s = Session(key="test:123")
        assert s.key == "test:123"
        assert s.messages == []

    def test_add_message(self):
        s = Session(key="k")
        s.add_message("user", "hello")
        assert len(s.messages) == 1
        assert s.messages[0]["content"] == "hello"
        assert s.messages[0]["role"] == "user"

    def test_add_multiple_messages(self):
        s = Session(key="k")
        s.add_message("user", "hi")
        s.add_message("assistant", "hello")
        assert len(s.messages) == 2

    def test_get_history_returns_role_content(self):
        s = Session(key="k")
        s.add_message("user", "ping")
        s.add_message("assistant", "pong")
        history = s.get_history()
        assert history[0]["role"] == "user"
        assert history[0]["content"] == "ping"
        assert history[1]["role"] == "assistant"

    def test_get_history_respects_max_messages(self):
        s = Session(key="k")
        for i in range(10):
            s.add_message("user", str(i))
        history = s.get_history(max_messages=3)
        assert len(history) == 3
        assert history[-1]["content"] == "9"

    def test_get_history_preserves_tool_metadata(self):
        s = Session(key="k")
        tool_calls = [{"id": "tc1", "function": {"name": "search"}}]
        s.add_message("assistant", "", tool_calls=tool_calls)
        history = s.get_history()
        assert "tool_calls" in history[0]

    def test_get_history_preserves_tool_call_id(self):
        s = Session(key="k")
        s.add_message("user", "search please")
        s.add_message(
            "assistant",
            "",
            tool_calls=[{"id": "tc1", "function": {"name": "search"}}],
        )
        s.add_message("tool", "result", tool_call_id="tc1", name="search")
        history = s.get_history()
        tool = next(message for message in history if message["role"] == "tool")
        assert tool["tool_call_id"] == "tc1"
        assert tool["name"] == "search"

    def test_clear_resets_messages(self):
        s = Session(key="k")
        s.add_message("user", "hi")
        s.clear()
        assert s.messages == []

    def test_clear_resets_last_consolidated(self):
        s = Session(key="k")
        s.add_message("user", "hi")
        s.last_consolidated = 1
        s.clear()
        assert s.last_consolidated == 0

    def test_updated_at_changes_on_add(self):
        import time
        s = Session(key="k")
        t0 = s.updated_at
        time.sleep(0.01)
        s.add_message("user", "x")
        assert s.updated_at >= t0

    def test_message_has_timestamp(self):
        s = Session(key="k")
        s.add_message("user", "hello")
        assert "timestamp" in s.messages[0]

    def test_add_message_with_extra_kwargs(self):
        s = Session(key="k")
        s.add_message("assistant", "", tool_calls=[{"id": "t1"}])
        assert s.messages[0]["tool_calls"] == [{"id": "t1"}]


# ---------------------------------------------------------------------------
# SessionManager unit tests
# ---------------------------------------------------------------------------

class TestSessionManager:
    @pytest.fixture
    def workspace(self, tmp_path):
        ws = tmp_path / "workspace"
        ws.mkdir()
        return ws

    @pytest.fixture
    def manager(self, workspace):
        return SessionManager(workspace)

    def test_get_or_create_new_session(self, manager):
        s = manager.get_or_create("telegram:123")
        assert s.key == "telegram:123"
        assert s.messages == []

    def test_get_or_create_reloads_saved_session(self, manager):
        s1 = manager.get_or_create("web:abc")
        s1.add_message("user", "hi")
        manager.save(s1)
        s2 = manager.get_or_create("web:abc")
        assert s2 is not s1
        assert len(s2.messages) == 1
        assert s2.messages[0]["content"] == "hi"

    def test_sessions_dir_is_outside_workspace(self, workspace):
        m = SessionManager(workspace)
        assert m.sessions_dir.exists()
        assert m.sessions_dir != workspace
        assert workspace not in m.sessions_dir.parents

    def test_save_and_reload(self, workspace):
        m1 = SessionManager(workspace)
        s = m1.get_or_create("test:save")
        s.add_message("user", "persisted")
        m1.save(s)

        m2 = SessionManager(workspace)
        s2 = m2.get_or_create("test:save")
        assert len(s2.messages) == 1
        assert s2.messages[0]["content"] == "persisted"

    def test_save_multiple_messages(self, workspace):
        m1 = SessionManager(workspace)
        s = m1.get_or_create("test:multi")
        for i in range(5):
            s.add_message("user", f"msg{i}")
        m1.save(s)

        m2 = SessionManager(workspace)
        s2 = m2.get_or_create("test:multi")
        assert len(s2.messages) == 5

    def test_different_keys_are_isolated(self, manager):
        s1 = manager.get_or_create("chan:1")
        s2 = manager.get_or_create("chan:2")
        s1.add_message("user", "for 1")
        assert len(s2.messages) == 0

    def test_session_file_path_safe_chars(self, workspace):
        m = SessionManager(workspace)
        s = m.get_or_create("telegram:12345")
        s.add_message("user", "hi")
        m.save(s)
        assert (m.sessions_dir / "sessions.sqlite3").is_file()

    def test_legacy_jsonl_migration_from_workspace(self, workspace):
        """JSONL sessions under the workspace are imported into SQLite."""
        import json

        legacy_dir = workspace / "sessions"
        legacy_dir.mkdir()
        key = "web:migrate"
        legacy_file = legacy_dir / "web_migrate.jsonl"
        metadata = {
            "_type": "metadata",
            "key": key,
            "created_at": "2024-01-01T00:00:00",
            "updated_at": "2024-01-01T00:00:00",
        }
        msg = {"role": "user", "content": "legacy msg", "timestamp": "2024-01-01T00:00:00"}
        legacy_file.write_text(json.dumps(metadata) + "\n" + json.dumps(msg) + "\n")

        m = SessionManager(workspace)
        s = m.get_or_create(key)
        assert len(s.messages) == 1
        assert s.messages[0]["content"] == "legacy msg"

    def test_clear_session(self, workspace):
        m = SessionManager(workspace)
        s = m.get_or_create("test:clear")
        s.add_message("user", "x")
        s.clear()
        m.save(s)

        m2 = SessionManager(workspace)
        s2 = m2.get_or_create("test:clear")
        assert s2.messages == []

    def test_session_key_with_colon(self, workspace):
        m = SessionManager(workspace)
        s = m.get_or_create("discord:guild:123:channel:456")
        s.add_message("user", "hi")
        m.save(s)

        m2 = SessionManager(workspace)
        s2 = m2.get_or_create("discord:guild:123:channel:456")
        assert len(s2.messages) == 1

    def test_list_sessions(self, workspace):
        m = SessionManager(workspace)
        s1 = m.get_or_create("chan:1")
        s1.add_message("user", "hello")
        m.save(s1)
        s2 = m.get_or_create("chan:2")
        s2.add_message("user", "world")
        m.save(s2)

        sessions = m.list_sessions()
        assert len(sessions) == 2

    def test_invalidate_removes_from_cache(self, manager):
        s = manager.get_or_create("test:inv")
        s.add_message("user", "hi")
        manager.invalidate("test:inv")
        # After invalidation, get_or_create creates a fresh session
        s2 = manager.get_or_create("test:inv")
        assert len(s2.messages) == 0
