"""pocketbot CLI checks that are not covered by the upstream command suite."""

import re

from typer.testing import CliRunner

from nanobot.cli.commands import app

runner = CliRunner()
_ANSI_ESCAPE = re.compile(r"\x1b\[[0-9;]*m")


def test_web_command_is_registered():
    result = runner.invoke(app, ["web", "--help"])
    # Rich styles the leading hyphen separately, so "--host" is not contiguous
    # until the color codes are removed.
    stdout = _ANSI_ESCAPE.sub("", result.stdout)

    assert result.exit_code == 0
    assert "pocketbot web UI" in stdout
    assert "--host" in stdout
    assert "--port" in stdout
