# Development Guide

This guide provides detailed information for developers working on the jojo-swe/nanobot fork.

## Development Environment Setup

### Prerequisites

- Python 3.11 or higher
- Git
- An LLM provider API key (OpenRouter recommended)

### Quick Setup

1. **Clone and install**
   ```bash
   git clone https://github.com/jojo-swe/nanobot.git
   cd nanobot
   pip install -e .
   ```

2. **Configure API keys**
   ```bash
   pocketbot onboard
   # Edit ~/.nanobot/config.json to add your API key
   ```

3. **Test installation**
   ```bash
   pocketbot agent -m "Hello!"
   ```

## Architecture Overview

### Core Components

```
nanobot/
├── agent/          # 🧠 Core agent logic
│   ├── loop.py     #    Agent loop (LLM ↔ tool execution)
│   ├── context.py  #    Prompt builder
│   ├── memory.py   #    Persistent memory
│   ├── skills.py   #    Skills loader
│   ├── subagent.py #    Background task execution
│   └── tools/      #    Built-in tools
├── web/            # 🌐 Web UI server and static files
├── channels/       # 📱 Chat platform integrations
├── bus/            # 🚌 Message routing system
├── providers/      # 🤖 LLM provider abstractions
├── config/         # ⚙️ Configuration management
├── session/        # 💬 Conversation session handling
└── cli/            # 🖥️ Command-line interface
```

### Key Design Principles

1. **Modular Architecture** - Each component is independent and replaceable
2. **Message Bus** - All communication flows through a central message bus
3. **Provider Abstraction** - LLM providers are pluggable via a registry system
4. **Session Management** - Conversations are maintained per user/channel
5. **Tool System** - Agent capabilities are extensible through tools

## Development Workflow

### 1. Making Changes

```bash
# Create a feature branch
git checkout -b feature/your-feature

# Make your changes
# ...

# Test your changes
pocketbot agent -m "Test your changes"

# Run linting
ruff check nanobot/
ruff format nanobot/
```


### 2. Testing

```bash
# Test CLI commands
pocketbot status
pocketbot web  # Test web UI
pocketbot agent

# Test with different configurations
# Edit ~/.nanobot/config.json to test different scenarios
```

### 3. Debugging

```bash
# Enable verbose logging
pocketbot agent --logs

# Test specific components
python -m nanobot.agent.loop
python -m nanobot.web.server
```

## Web UI Development

### Architecture

The web UI consists of:

- **FastAPI Server** (`nanobot/web/server.py`) - WebSocket and REST API
- **Static Frontend** (`nanobot/web/static/`) - HTML/CSS/JS interface
- **WebSocket Communication** - Real-time bidirectional messaging

### Development

1. **Start the web server**
   ```bash
   pocketbot web --host localhost --port 8080 --verbose
   ```

2. **Access the UI**
   - Open `http://localhost:8080` in your browser
   - Check browser console for debugging

3. **Frontend Development**
   - Edit `nanobot/web/static/index.html`
   - Changes are reflected on server restart
   - Use browser dev tools for debugging

### Adding Web Features

1. **New API Endpoints** - Add to `nanobot/web/server.py`
2. **UI Components** - Modify `nanobot/web/static/index.html`
3. **WebSocket Events** - Extend the WebSocket message handling

## Agent Development

### Agent Loop

The agent loop (`nanobot/agent/loop.py`) is the core execution engine:

1. **Context Building** - Gathers relevant context and tools
2. **LLM Interaction** - Sends prompts and receives responses
3. **Tool Execution** - Executes tools based on LLM decisions
4. **Response Processing** - Formats and returns results

### Adding Tools

1. **Create tool function** in `nanobot/agent/tools/`
2. **Register tool** in the tools registry
3. **Add documentation** for the tool
4. **Test the tool** with various inputs

### Memory System

The memory system (`nanobot/agent/memory.py`) provides:

- **Short-term memory** - Current conversation context
- **Long-term memory** - Persistent information storage
- **Memory retrieval** - Context-aware memory access

## Channel Development

### Adding a New Channel

1. **Create channel module** in `nanobot/channels/`
2. **Implement base interface** - Connect, send, receive
3. **Add configuration** to `nanobot/config/schema.py`
4. **Register channel** in the channel registry
5. **Add documentation** and examples

### Channel Architecture

Channels follow a consistent pattern:

- **Connection Management** - Handle platform-specific authentication
- **Message Processing** - Convert platform messages to internal format
- **Response Handling** - Convert internal responses to platform format
- **Error Handling** - Graceful handling of platform errors

## Provider Development

### Adding a New LLM Provider

1. **Add provider spec** to `nanobot/providers/registry.py`
2. **Add config field** to `nanobot/config/schema.py`
3. **Test provider** with different models
4. **Add documentation** for API key setup

### Provider Registry

The provider registry (`nanobot/providers/registry.py`) handles:

- **Provider Discovery** - Automatic provider detection
- **Model Routing** - Intelligent model-to-provider mapping
- **Configuration** - Environment variable and config handling

## Configuration System

### Configuration Structure

```json
{
  "providers": {},
  "agents": {},
  "channels": {},
  "web": {},
  "tools": {}
}
```

### Adding Configuration Options

1. **Add schema** to `nanobot/config/schema.py`
2. **Add validation** rules
3. **Update documentation**
4. **Test configuration** loading

## Debugging and Troubleshooting

### Common Issues

1. **API Key Problems**
   - Check `~/.nanobot/config.json`
   - Verify API key format
   - Test with curl or API documentation

2. **Connection Issues**
   - Check network connectivity
   - Verify firewall settings
   - Test with different ports

3. **Memory Issues**
   - Check available disk space
   - Verify memory configuration
   - Clear cache if needed

### Debug Mode

```bash
# Enable debug logging
export NANOBOT_DEBUG=1
pocketbot agent --logs

# Test specific components
python -c "from nanobot.config.loader import load_config; print(load_config())"
```

## Performance Optimization

### Profiling

```bash
# Profile agent execution
python -m cProfile -o profile.stats your_script.py

# Analyze memory usage
python -m memory_profiler your_script.py
```

### Optimization Tips

1. **Reduce Context Size** - Limit memory and tool context
2. **Cache Responses** - Cache frequent API calls
3. **Batch Operations** - Group similar operations
4. **Async Operations** - Use async for I/O operations

## Testing Strategy

### Unit Testing

```bash
# Run tests (when available)
pytest tests/

# Test specific modules
pytest tests/test_agent.py
```

### Integration Testing

1. **Test all channels** - Verify each platform works
2. **Test providers** - Verify LLM providers function
3. **Test web UI** - Verify web interface works
4. **End-to-end tests** - Test complete workflows

## Release Process

### Version Management

This fork uses semantic versioning with fork identifier:
`{original_version}+jojo`

### Release Checklist

1. **Update version** in `pyproject.toml`
2. **Update CHANGELOG.md** with changes
3. **Test all features** work correctly
4. **Update documentation** if needed
5. **Create git tag** with version number

## Contributing Back to Upstream

If you develop features that could benefit the original project:

1. **Check upstream** - Ensure feature doesn't already exist
2. **Create PR** - Submit to original HKUDS/nanobot
3. **Coordinate** - Discuss with upstream maintainers
4. **Maintain compatibility** - Keep fork compatible with upstream

## Additional Resources

- **Original Project**: [HKUDS/nanobot](https://github.com/HKUDS/nanobot)
- **Documentation**: See other `.md` files in this repository
- **Issues**: Report bugs via GitHub Issues
- **Discussions**: Use GitHub Discussions for questions
