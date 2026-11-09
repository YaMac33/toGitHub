"""エージェントの基底クラス。

エージェント = 役割（システムプロンプトとプロンプトの組み立て方）
プロバイダー = どのAIで実行するか
の2つを分離している。エージェントは LLMProvider インターフェースにだけ依存するため、
settings.yaml の agents.<name>.provider を変えるだけで実行するAIを切り替えられる。
"""

from __future__ import annotations

import uuid
from typing import ClassVar

from pydantic import BaseModel, Field

from multi_ai_workbench.core.exceptions import WorkbenchError
from multi_ai_workbench.core.interfaces import LLMProvider
from multi_ai_workbench.core.models import (
    CostEstimate,
    GenerationParams,
    GenerationRequest,
    TokenUsage,
)
from multi_ai_workbench.utils.logging import get_logger

logger = get_logger(__name__)


def new_task_id() -> str:
    return uuid.uuid4().hex[:12]


class AgentTask(BaseModel):
    """エージェントへの入力。context は「見出し → 本文」の参考情報（前ステップの出力など）。"""

    instruction: str
    context: dict[str, str] = Field(default_factory=dict)
    task_id: str = Field(default_factory=new_task_id)


class AgentResult(BaseModel):
    task_id: str
    agent: str
    role: str
    provider: str
    model: str | None = None
    success: bool
    output: str | None = None
    error: str | None = None
    error_type: str | None = None
    usage: TokenUsage | None = None
    cost: CostEstimate | None = None


class BaseAgent:
    role: ClassVar[str] = "generic"
    default_system_prompt: ClassVar[str] = (
        "あなたはソフトウェア開発を支援する有能なアシスタントです。日本語で簡潔かつ正確に回答してください。"
    )

    def __init__(
        self,
        provider: LLMProvider,
        *,
        name: str | None = None,
        model: str | None = None,
        system_prompt: str | None = None,
        params: GenerationParams | None = None,
    ) -> None:
        self.provider = provider
        self.name = name or self.role
        self.model = model
        self.system_prompt = system_prompt or self.default_system_prompt
        self.params = params or GenerationParams()

    def build_prompt(self, task: AgentTask) -> str:
        """役割ごとにオーバーライドしてプロンプトを組み立てる。"""
        parts = [task.instruction.strip()]
        for title, body in task.context.items():
            parts.append(f"## {title}\n{body.strip()}")
        return "\n\n".join(parts)

    def run(self, task: AgentTask) -> AgentResult:
        """タスクを実行する。プロバイダーのエラーは例外ではなく失敗結果として返す。"""
        model = self.model or self.provider.default_model
        base = {
            "task_id": task.task_id,
            "agent": self.name,
            "role": self.role,
            "provider": self.provider.name,
            "model": model,
        }
        try:
            request = GenerationRequest(
                prompt=self.build_prompt(task),
                system_prompt=self.system_prompt,
                model=model,
                params=self.params,
                task_id=task.task_id,
            )
            response = self.provider.generate(request)
        except WorkbenchError as exc:
            logger.warning("agent %s failed: %s", self.name, exc)
            return AgentResult(**base, success=False, error=str(exc), error_type=type(exc).__name__)
        return AgentResult(
            **base,
            success=True,
            output=response.text,
            usage=response.usage,
            cost=response.cost,
        )


class GenericAgent(BaseAgent):
    """settings.yaml で system_prompt だけを与えて任意の役割を作るためのエージェント。"""
