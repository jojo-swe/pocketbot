# Fork Information

This repository is a fork of [HKUDS/nanobot](https://github.com/HKUDS/nanobot), maintained by [jojo-swe](https://github.com/jojo-swe).

## Fork Relationship

- **Original Repository**: [HKUDS/nanobot](https://github.com/HKUDS/nanobot)
- **Fork Repository**: [jojo-swe/nanobot](https://github.com/jojo-swe/nanobot)
- **Fork Created**: February 2026

## Purpose of Fork

This fork was created to:

1. **Experiment with web interface** - Add a modern web UI for the nanobot assistant
2. **Personal development** - Provide a playground for testing new features and improvements
3. **Learning and research** - Explore AI agent architecture and implementation

## Fork-Specific Changes

### Web UI Feature
- **Added**: FastAPI-based web server with WebSocket chat interface
- **Files**: `nanobot/web/` module with static HTML/CSS/JS interface
- **Command**: `nanobot web` to start the web server
- **Features**: Real-time chat, Markdown rendering, responsive design

### Configuration Updates
- Added `web` configuration section for server settings
- Optional authentication support via bearer tokens
- Configurable host and port settings

### Dependencies
- Added `fastapi>=0.110.0` for web framework
- Added `uvicorn[standard]>=0.27.0` for ASGI server

## Version Strategy

This fork uses a modified versioning scheme to distinguish it from the original:
- Format: `{original_version}+jojo`
- Example: `0.1.3.post7+jojo`

This ensures:
- Clear identification of fork versions
- Ability to track upstream version compatibility
- Semantic versioning compliance

## Upstream Synchronization

### Keeping Updated with Original

To sync changes from the upstream repository:

```bash
# Add upstream remote (if not already added)
git remote add upstream https://github.com/HKUDS/nanobot.git

# Fetch upstream changes
git fetch upstream

# Merge upstream changes into your branch
git merge upstream/main

# Resolve any conflicts (especially in modified files)
# Test changes to ensure compatibility

# Push updated fork
git push origin main
```

### Handling Merge Conflicts

Common conflict areas:
- `pyproject.toml` - Version and metadata differences
- `README.md` - Documentation updates
- Modified source files - Feature implementations

Resolution strategy:
1. Preserve fork-specific changes
2. Integrate upstream improvements
3. Test thoroughly after merging

## Contributing to This Fork

### Development Setup

1. Clone this fork:
```bash
git clone https://github.com/jojo-swe/nanobot.git
cd nanobot
```

2. Install in development mode:
```bash
pip install -e .
```

3. Configure your API keys in `~/.nanobot/config.json`

### Submitting Changes

1. Fork this repository (if you haven't already)
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Test thoroughly
5. Submit a pull request to this repository

### Areas for Contribution

- Web UI improvements and features
- Additional chat integrations
- Performance optimizations
- Documentation enhancements
- Bug fixes and stability improvements

## Relationship with Original Project

This fork aims to:
- **Maintain compatibility** with the original project's core functionality
- **Preserve the lightweight** and minimal design philosophy
- **Give proper attribution** to the original authors and contributors
- **Contribute back** useful improvements when appropriate

## License

This fork maintains the same MIT license as the original project. All original work remains under the MIT license, and fork-specific additions are also licensed under MIT.

## Acknowledgments

- **Original Project**: HKUDS/nanobot team and contributors
- **Inspiration**: OpenClaw project for the original concept
- **Community**: All users and contributors who make nanobot possible

## Contact

For questions about this fork:
- Create an issue in this repository
- Discussion: [GitHub Discussions](https://github.com/jojo-swe/nanobot/discussions)
- Maintainer: [@jojo-swe](https://github.com/jojo-swe)

For questions about the original project:
- Please use the original [HKUDS/nanobot](https://github.com/HKUDS/nanobot) repository
