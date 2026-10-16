"""pocketbot CLI checks that are not covered by the upstream command suite."""

from typer.testing import CliRunner

from nanobot.cli.commands import app

runner = CliRunner()


def test_web_command_is_registered():
    result = runner.invoke(app, ["web", "--help"])

    assert result.exit_code == 0
    assert "pocketbot web UI" in result.stdout
    assert "--host" in result.stdout
    assert "--port" in result.stdout
