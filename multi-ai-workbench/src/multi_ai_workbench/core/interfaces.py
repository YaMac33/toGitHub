"""モジュール間の境界となるインターフェース (Protocol)。

エージェントやワークフローは具体クラスではなくこれらに依存する。
そのため、テストでは任意のフェイク実装を差し込める。
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Protocol, runtime_checkable

from multi_ai_workbench.core.models import GenerationRequest, GenerationResponse

if TYPE_CHECKING:
    from multi_ai_workbench.core.usage import UsageRecord


@runtime_checkable
class LLMProvider(Protocol):
    """全APIプロバイダー共通のテキスト生成インターフェース。"""

    name: str

    @property
    def default_model(self) -> str: ...

    def is_configured(self) -> bool:
        """APIキーなど、呼び出しに必要な設定が揃っているか（API通信はしない）。"""
        ...

    def generate(self, request: GenerationRequest) -> GenerationResponse: ...


class UsageStore(Protocol):
    """利用記録の保存先。JSONL 以外（SQLite 等）へ差し替え可能にするための境界。"""

    def append(self, record: UsageRecord) -> None: ...

    def load(self) -> list[UsageRecord]: ...


class ExternalAgent(Protocol):
    """Claude Code / Codex CLI / Gemini CLI などローカルで動く外部エージェント。

    APIプロバイダー (LLMProvider) とは独立した概念。
    """

    name: str
    command: str

    def is_installed(self) -> bool: ...
