# Contributing to nanobot

Thank you for your interest in contributing to this fork of nanobot! This document provides guidelines for contributing to the jojo-swe/nanobot fork.

## Getting Started

### Prerequisites

- Python 3.11 or higher
- Git
- A GitHub account

### Development Setup

1. **Fork the repository**
   ```bash
   # Fork this repository on GitHub, then clone your fork
   git clone https://github.com/YOUR_USERNAME/nanobot.git
   cd nanobot
   ```

2. **Set up development environment**
   ```bash
   # Install in development mode
   pip install -e .
   
   # Install development dependencies
   pip install -e ".[dev]"
   ```

3. **Configure your API keys**
   ```bash
   # Initialize configuration
   nanobot onboard
   
   # Edit ~/.nanobot/config.json to add your API keys
   ```

4. **Verify installation**
   ```bash
   nanobot status
   ```

## Development Workflow

### 1. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

### 2. Make Changes

- Follow the existing code style
- Add tests for new functionality
- Update documentation as needed
- Keep changes focused and minimal

### 3. Test Your Changes

```bash
# Run linting
ruff check nanobot/

# Run tests (if available)
pytest

# Test the CLI manually
nanobot agent -m "Hello, test!"
```

### 4. Submit a Pull Request

1. Push your branch to your fork
2. Open a pull request against this repository
3. Provide a clear description of your changes
4. Link any relevant issues

## Code Style

We use [ruff](https://github.com/astral-sh/ruff) for linting and formatting:

```bash
# Check for issues
ruff check nanobot/

# Auto-fix formatting
ruff format nanobot/
```

### Guidelines

- Use Python 3.11+ features
- Follow PEP 8 style guidelines
- Keep functions and classes small and focused
- Add type hints where appropriate
- Write clear, descriptive commit messages

## Areas for Contribution

### High Priority

- **Web UI improvements**
  - Enhanced UI/UX features
  - Additional themes or styling
  - Mobile responsiveness improvements
  - Real-time collaboration features

- **Documentation**
  - Improve existing documentation
  - Add more examples and tutorials
  - Fix typos and clarify unclear sections

- **Bug Fixes**
  - Fix reported issues
  - Improve error handling
  - Enhance stability

### Medium Priority

- **New Chat Integrations**
  - Additional chat platforms
  - Improved existing integrations
  - Unified chat interface

- **Performance**
  - Optimize startup time
  - Reduce memory usage
  - Improve response times

- **Features**
  - New agent tools
  - Enhanced memory system
  - Better configuration management

### Low Priority

- **Experimental Features**
  - Multi-modal support (images, voice)
  - Advanced reasoning capabilities
  - Plugin system

## Fork-Specific Considerations

### Maintaining Compatibility

This fork aims to maintain compatibility with the original HKUDS/nanobot project. When contributing:

1. **Preserve core functionality** - Don't break existing features
2. **Fork-specific features** - Clearly mark any fork-only additions
3. **Upstream sync awareness** - Be mindful of future upstream changes
4. **Documentation** - Update fork-specific documentation

### Version Strategy

This fork uses `{original_version}+jojo` versioning. When making changes:

- Bug fixes: Increment patch version
- New features: Increment minor version
- Breaking changes: Increment major version

## Testing

### Running Tests

```bash
# Run all tests
pytest

# Run specific test file
pytest tests/test_agent.py

# Run with coverage
pytest --cov=nanobot
```

### Writing Tests

- Add tests for new functionality
- Test edge cases and error conditions
- Use descriptive test names
- Mock external dependencies

## Documentation

### Updating Documentation

- README.md: Main project documentation
- FORK.md: Fork-specific information
- CHANGELOG.md: Version history
- Inline code comments: Complex logic explanations

### Documentation Style

- Use clear, concise language
- Include code examples
- Add screenshots for UI features
- Keep documentation up-to-date

## Release Process

This fork follows semantic versioning. Releases are made when:

- Significant new features are added
- Important bugs are fixed
- Security vulnerabilities are patched

## Community

### Getting Help

- **GitHub Issues**: Report bugs and request features
- **GitHub Discussions**: General questions and ideas
- **FORK.md**: Detailed fork information

### Code of Conduct

Be respectful and constructive in all interactions:
- Welcome newcomers
- Provide helpful feedback
- Focus on what's best for the community
- Show empathy toward other community members

## Acknowledgments

Thank you to:

- The original HKUDS/nanobot contributors
- Everyone who contributes to this fork
- The broader AI agent community

## License

By contributing to this project, you agree that your contributions will be licensed under the same MIT license as the original project.
