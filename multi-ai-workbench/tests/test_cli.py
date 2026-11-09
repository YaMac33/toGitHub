"""CLI のテスト。--home で一時プロジェクトを指定し、実際の logs/ を汚さない。"""

from __future__ import annotations

import io

import pytest

from multi_ai_workbench.cli.commands import EXIT_ERROR, EXIT_MISSING_KEY, EXIT_OK, run
from multi_ai_workbench.main import main


@pytest.fixture
def cli(project_dir):
    def _run(*args: str) -> tuple[int, str]:
        out = io.StringIO()
        code = run(["--home", str(project_dir), *args], out=out)
        return code, out.getvalue()

    return _run


@pytest.mark.parametrize("command", ["status", "providers", "models", "usage", "agents", "workflows"])
def test_commands_work_without_api_keys(cli, command):
    code, out = cli(command)
    assert code == EXIT_OK, out
    assert out.strip()


def test_status_reports_key_state(cli, isolated_env):
    isolated_env["OPENAI_API_KEY"] = "sk-test-should-never-be-printed-000"
    code, out = cli("status")
    assert "ANTHROPIC_API_KEY" in out and "未設定" in out and "設定済み" in out
    assert "sk-test-should-never-be-printed" not in out


def test_models_shows_unset_pricing(cli):
    _, out = cli("models")
    assert "claude-sonnet-5-5" in out and "未設定" in out and "unverified" in out


def test_ask_mock_and_usage(cli):
    code, out = cli("ask", "ping", "--provider", "mock")
    assert code == EXIT_OK and "ping" in out and "estimated" in out
    code, out = cli("usage", "--recent", "5")
    assert code == EXIT_OK and "mock" in out and "estimated" in out


def test_ask_without_key(cli):
    code, out = cli("ask", "hello", "--provider", "anthropic")
    assert code == EXIT_MISSING_KEY
    assert "ANTHROPIC_API_KEY" in out


def test_ask_with_agent(cli):
    code, out = cli("ask", "関数を書いて", "--agent", "coding", "--provider", "mock")
    assert code == EXIT_OK and "role=coding" in out


def test_ask_requires_provider(cli):
    code, out = cli("ask", "hello")
    assert code == EXIT_ERROR


def test_unknown_provider(cli):
    code, out = cli("ask", "x", "--provider", "nope")
    assert code == EXIT_ERROR and "nope" in out


def test_run_workflow_mock(cli):
    code, out = cli("run", "dev_pipeline", "TODO API", "--mock")
    assert code == EXIT_OK
    assert "succeeded" in out and "code_review" in out


def test_run_workflow_without_keys(cli):
    code, out = cli("run", "multi_review", "x")
    assert code == EXIT_ERROR and "MissingAPIKeyError" not in out and "未設定" in out


def test_usage_empty(cli):
    code, out = cli("usage")
    assert code == EXIT_OK and "利用記録はありません" in out


def test_main_entry(project_dir, capsys):
    assert main(["--home", str(project_dir), "providers"]) == EXIT_OK
    assert "anthropic" in capsys.readouterr().out
