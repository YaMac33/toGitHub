"""アプリケーションの入口となるファサード。

設定・モデルカタログ・利用記録・プロバイダー・エージェント・ワークフローを束ね、
CLI（将来は Web UI / GUI）からはこのクラスだけを使えばよいようにしている。
"""

from __future__ import annotations

import threading
from collections.abc import Mapping
from pathlib import Path

from multi_ai_workbench.agents import AGENT_ROLES, BaseAgent, ExternalCLIAgent, GenericAgent
from multi_ai_workbench.core.config import (
    ModelCatalog,
    ProviderDiagnosis,
    Settings,
    diagnose_providers,
    load_model_catalog,
    load_settings,
)
from multi_ai_workbench.core.exceptions import AgentNotFoundError, WorkflowError
from multi_ai_workbench.core.interfaces import LLMProvider, UsageStore
from multi_ai_workbench.core.models import GenerationParams, GenerationRequest, GenerationResponse
from multi_ai_workbench.core.usage import BudgetGuard, JsonlUsageStore
from multi_ai_workbench.orchestration.task_manager import TaskManager
from multi_ai_workbench.providers import create_provider
from multi_ai_workbench.workflows import (
    BaseWorkflow,
    ParallelWorkflow,
    SequentialWorkflow,
    WorkflowResult,
    WorkflowStep,
)


class Orchestrator:
    def __init__(
        self,
        settings: Settings,
        catalog: ModelCatalog,
        usage_store: UsageStore | None = None,
        *,
        providers: Mapping[str, LLMProvider] | None = None,
        force_provider: str | None = None,
    ) -> None:
        """
        providers      : プロバイダーを外から差し込む（テスト用）。未指定分は設定から生成
        force_provider : 全エージェントをこのプロバイダーで実行する（例: "mock" でドライラン）
        """
        self.settings = settings
        self.catalog = catalog
        self.usage_store: UsageStore = usage_store or JsonlUsageStore(settings.usage_file_path)
        self.budget_guard = BudgetGuard(settings.budget, self.usage_store)
        self.force_provider = force_provider
        self.task_manager = TaskManager()
        self._providers: dict[str, LLMProvider] = dict(providers or {})
        self._lock = threading.Lock()

    @classmethod
    def from_config(cls, project_root: Path | None = None, **kwargs: object) -> Orchestrator:
        settings = load_settings(project_root)
        catalog = load_model_catalog(settings.project_root)
        return cls(settings, catalog, **kwargs)  # type: ignore[arg-type]

    # ------------------------------------------------------------- 診断・一覧

    def diagnose(self) -> list[ProviderDiagnosis]:
        """APIキー・SDK・モデル設定の状態（API通信なし）。"""
        return diagnose_providers(self.settings, self.catalog)

    def external_agents(self) -> list[ExternalCLIAgent]:
        return [ExternalCLIAgent(name, s) for name, s in self.settings.external_agents.items()]

    # ------------------------------------------------------- プロバイダー

    def provider(self, name: str) -> LLMProvider:
        """プロバイダーを取得する。生成のみでAPIキーは要求しない（呼び出し時に確認）。"""
        with self._lock:
            if name not in self._providers:
                self._providers[name] = create_provider(
                    name,
                    self.settings,
                    catalog=self.catalog,
                    usage_store=self.usage_store,
                    budget_guard=self.budget_guard,
                )
            return self._providers[name]

    def ask(
        self,
        prompt: str,
        *,
        provider: str | None = None,
        model: str | None = None,
        system_prompt: str | None = None,
        params: GenerationParams | None = None,
        task_id: str | None = None,
    ) -> GenerationResponse:
        name = provider or self.force_provider
        if name is None:
            raise WorkflowError("プロバイダーを指定してください")
        request = GenerationRequest(
            prompt=prompt,
            model=model,
            system_prompt=system_prompt,
            params=params or GenerationParams(),
            task_id=task_id,
        )
        return self.provider(name).generate(request)

    # ---------------------------------------------------------- エージェント

    def agent(self, name: str) -> BaseAgent:
        if name not in self.settings.agents:
            raise AgentNotFoundError(name, sorted(self.settings.agents))
        cfg = self.settings.agents[name]
        role = cfg.role or name
        agent_cls = AGENT_ROLES.get(role, GenericAgent)
        if self.force_provider:
            # 強制プロバイダーではエージェント固有のモデル指定は意味を持たないため既定モデルを使う
            provider_name, model = self.force_provider, None
        else:
            provider_name, model = cfg.provider, cfg.model
        return agent_cls(
            self.provider(provider_name),
            name=name,
            model=model,
            system_prompt=cfg.system_prompt,
            params=cfg.params,
        )

    # ---------------------------------------------------------- ワークフロー

    def build_workflow(self, name: str) -> BaseWorkflow:
        if name not in self.settings.workflows:
            raise WorkflowError(
                f"ワークフロー '{name}' は定義されていません（定義済み: {', '.join(sorted(self.settings.workflows))}）"
            )
        wf = self.settings.workflows[name]
        if wf.type == "sequential":
            steps = [WorkflowStep(**s.model_dump()) for s in wf.steps]
            agents = {s.agent: self.agent(s.agent) for s in steps}
            return SequentialWorkflow(
                name,
                steps,
                agents,
                stop_on_failure=wf.stop_on_failure,
                task_manager=self.task_manager,
            )
        agents = {a: self.agent(a) for a in wf.agents}
        return ParallelWorkflow(
            name,
            wf.agents,
            agents,
            instruction=wf.instruction,
            max_workers=wf.max_workers,
            task_manager=self.task_manager,
        )

    def run_workflow(self, name: str, user_input: str) -> WorkflowResult:
        return self.build_workflow(name).run(user_input)
