"""
Fork identity and path constants for pocketbot.

This module centralizes all fork-specific branding and path defaults.
When syncing with upstream, only this file needs fork-specific updates.
The internal package name remains 'nanobot' for upstream compatibility.
"""

import os
from pathlib import Path

# --- Fork identity ---
APP_NAME = "pocketbot"
APP_DISPLAY = "PocketBot"
APP_EMOJI = "\U0001f916"  # 🤖
APP_DESCRIPTION = "Pocket-sized personal AI assistant"
UPSTREAM_REPO = "HKUDS/nanobot"
FORK_REPO = "jojo-swe/pocketbot"

# --- Data directory ---
# All user data lives under this directory.
# Reads from POCKETBOT_HOME env var, falls back to ~/.pocketbot.
# For backward compat, if ~/.pocketbot doesn't exist but ~/.nanobot does,
# we use ~/.nanobot (migration path).


def resolve_data_dir() -> Path:
    """Resolve the data directory, with backward compatibility."""
    env = os.environ.get("POCKETBOT_HOME")
    if env:
        return Path(env).expanduser()

    new_path = Path.home() / ".pocketbot"
    old_path = Path.home() / ".nanobot"

    # Prefer new path if it exists, or if neither exists (fresh install)
    if new_path.exists() or not old_path.exists():
        return new_path
    # Backward compat: use old path if it exists and new doesn't
    return old_path


DATA_DIR = resolve_data_dir()
CONFIG_PATH = DATA_DIR / "config.json"
WORKSPACE_DEFAULT = DATA_DIR / "workspace"
SESSIONS_DIR = DATA_DIR / "sessions"
HISTORY_DIR = DATA_DIR / "history"
MEDIA_DIR = DATA_DIR / "media"
BRIDGE_DIR = DATA_DIR / "bridge"
