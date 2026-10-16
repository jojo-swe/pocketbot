# Changelog

All notable changes to pocketbot (fork of nanobot) will be documented in this file.

## [2026-10-16] - Sync upstream nanobot 0.3.5

### Upstream
- Merged HKUDS/nanobot `main` at `55910717` (v0.3.5) into the pocketbot fork.

### Fork
- Kept package name `pocketbot-ai`, version `0.3.5+jojo`, and the `pocketbot` command (upstream `nanobot` remains an alias).
- Default data directory stays `~/.pocketbot` via `nanobot.identity`, including `POCKETBOT_HOME` and legacy `~/.nanobot` fallback.
- Restored the pocketbot web server config (`web.host` / `web.auth`) and `pocketbot web` alongside upstream WebUI.

## [2026-02-17] - Web UI Feature Completion & Identity Centralization

### 🌐 Web UI Enhancements
- **Settings panel** - Editable model, max tokens, temperature, memory window with save/reset
- **Status & diagnostics panel** - Server status, uptime, connections, provider, auth state, ping
- **PUT /api/config endpoint** - Update safe config fields from the UI with validation and disk persistence
- **POST /api/ping endpoint** - Health-check with round-trip latency measurement
- **Enhanced /api/status** - Now includes uptime, provider name, auth state, host/port
- **Toast notifications** - Visual feedback for save success/failure, errors, and info
- **Auth enforcement** - Token-based auth for non-local REST and WebSocket access
- **WebSocket auth** - Query param `?token=xxx` for non-local WebSocket connections
- **Mobile-friendly meta tags** - PWA-capable viewport, theme-color, apple-mobile-web-app
- **Auto-resize textarea** - Input grows with content up to 200px
- **New chat button** - Clears messages and resets session visually

### 🏷️ Identity Centralization
- **New `nanobot/identity.py`** - Single source of truth for fork branding and data paths
- **Backward-compatible paths** - Auto-detects `~/.pocketbot` or falls back to `~/.nanobot`
- **Environment override** - `POCKETBOT_HOME` env var for custom data directory
- **All hardcoded paths updated** - `config/loader.py`, `utils/helpers.py`, `session/manager.py`, `cli/commands.py`, `channels/telegram.py`, `channels/discord.py`, `config/schema.py`

### 🎨 Branding
- **Color scheme renamed** - `nano-*` → `pocket-*` in Tailwind config
- **Assistant avatar** - Updated from 🐈 to 🤖 in chat messages
- **Footer simplified** - "pocketbot · WebSocket"

---

## [2026-02-16] - Web UI Release

### 🌐 Added
- **Web UI with FastAPI server** - Modern web-based chat interface
- **WebSocket chat endpoint** - Real-time bidirectional communication
- **Static HTML interface** - Responsive design with Tailwind CSS
- **Markdown rendering** - Support for formatted responses with syntax highlighting
- **Typing indicators** - Visual feedback when agent is processing
- **Session management** - Persistent conversation sessions
- **Configuration panel** - View current model and settings
- **Authentication support** - Optional bearer token authentication
- **CLI command** - `nanobot web` to start the web server

### 🔧 Configuration
- Added `web` configuration section with:
  - `host` - Server bind address (default: localhost)
  - `port` - Server port (default: 8080)
  - `auth.enabled` - Enable authentication (default: false)
  - `auth.token` - Bearer token for authentication

### 📦 Dependencies
- Added `fastapi>=0.110.0` - Web framework
- Added `uvicorn[standard]>=0.27.0` - ASGI server

### 📁 Files Added
- `nanobot/web/__init__.py` - Web module initialization
- `nanobot/web/server.py` - FastAPI server implementation
- `nanobot/web/static/index.html` - Web UI interface
- Updated `nanobot/cli/commands.py` - Added web command
- Updated `nanobot/config/schema.py` - Added web configuration schema
- Updated `pyproject.toml` - Added dependencies and static files

---

## [2026-02-14] - MCP Support

### 🔌 Added
- **MCP (Model Context Protocol) support** - Connect external tool servers
- **Stdio transport** - Local process communication via npx/uvx
- **HTTP transport** - Remote endpoint communication
- **Auto-discovery** - MCP tools automatically registered on startup
- **Claude Desktop compatibility** - Copy configs directly from MCP server docs

---

## [2026-02-13] - v0.1.3.post7

### 🔒 Security
- Enhanced security hardening
- Multiple stability improvements

---

## [2026-02-12] - Memory System Redesign

### 🧠 Improved
- **Redesigned memory system** - Less code, more reliable
- Simplified memory persistence
- Enhanced context management

---

## [2026-02-11] - CLI Enhancement & MiniMax

### ✨ Added
- **Enhanced CLI experience** - Improved user interface
- **MiniMax provider support** - Access to MiniMax models

---

## [2026-02-10] - v0.1.3.post6

### 🎉 Released
- Multiple improvements and bug fixes
- Updated roadmap documentation

---

## [2026-02-09] - Multi-Platform Support

### 💬 Added
- **Slack integration** - Socket Mode support
- **Email channel** - IMAP/SMTP support
- **QQ integration** - Bot API support

---

## [2026-02-08] - Provider Refactoring

### 🔧 Improved
- **Refactored Providers** - Simplified adding new LLM providers
- **2-step provider addition** - No more if-elif chains
- **Provider Registry** - Centralized provider configuration

---

## [2026-02-07] - v0.1.3.post5

### 🚀 Added
- **Qwen provider support** - Dashscope integration
- Multiple key improvements

---

## [2026-02-06] - Discord & Moonshot

### ✨ Added
- **Discord integration** - Full bot support with intents
- **Moonshot/Kimi provider** - Access to Kimi models
- **Enhanced security** - Additional hardening

---

## [2026-02-05] - Feishu & DeepSeek

### ✨ Added
- **Feishu channel** - WebSocket long connection support
- **DeepSeek provider** - Direct DeepSeek API access
- **Enhanced scheduled tasks** - Improved cron functionality

---

## [2026-02-04] - v0.1.3.post4

### 🚀 Added
- **Multi-provider support** - Simultaneous provider configuration
- **Docker support** - Containerized deployment

---

## [2026-02-03] - vLLM & Scheduling

### ⚡ Added
- **vLLM integration** - Local LLM server support
- **Natural language scheduling** - Enhanced task scheduling

---

## [2026-02-02] - Initial Release

### 🎉 Launch
- **nanobot v0.1.3** - Ultra-lightweight personal AI assistant
- Core agent functionality in ~4,000 lines of code
- Multi-channel support (Telegram, WhatsApp, etc.)
- Complete CLI interface
- Configuration management
- Session handling
