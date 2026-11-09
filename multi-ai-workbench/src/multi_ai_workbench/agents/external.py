"""外部CLIエージェント（Claude Code / Codex CLI / Gemini CLI など）。

APIプロバイダー (providers/) とは別の概念として扱う:
- APIプロバイダー : このアプリが APIキーで直接呼び出すモデル
- 外部CLIエージェント : 利用者のマシンで独立して動く開発エージェント。認証は各ツール自身が管理する

Claude Code のサブスクリプション認証を、Anthropic APIキーの代わりにこのアプリから
利用することはしない。初期段階ではインストール有無の検出のみを行い、自動起動は行わない。
"""

from __future__ import annotations

import shutil

from multi_ai_workbench.core.config import ExternalAgentSettings


class ExternalCLIAgent:
    def __init__(self, name: str, settings: ExternalAgentSettings) -> None:
        self.name = name
        self.command = settings.command
        self.description = settings.description

    def is_installed(self) -> bool:
        return shutil.which(self.command) is not None

    def run(self, instruction: str) -> str:
        raise NotImplementedError(
            f"外部CLIエージェント '{self.name}' の自動実行は未実装です（roadmap 参照）。"
            f"現在は '{self.command}' を手動で起動して利用してください。"
        )
