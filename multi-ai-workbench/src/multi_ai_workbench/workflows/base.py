"""ワークフローの共通部分。

ワークフローはエージェント名 → BaseAgent の対応表を受け取り、どのプロバイダーで
動いているかは関知しない。各タスクの状態は TaskManager に記録する。
初期段階では、AI同士の自己反復や自律的なファイル編集は行わない。
"""

from __future__ import annotations

import uuid
from abc import ABC, abstractmethod
from collections.abc import Mapping
from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, Field

from multi_ai_workbench.agents.base import AgentTask, BaseAgent
from multi_ai_workbench.core.exceptions import AgentNotFoundError
from multi_ai_workbench.core.models import utc_now
from multi_ai_workbench.orchestration.task_manager import TaskManager, TaskRecord, TaskStatus
from multi_ai_workbench.utils.logging import get_logger

logger = get_logger(__name__)

INPUT_PLACEHOLDER = "{input}"


def render_instruction(template: str, user_input: str) -> str:
    # str.format はコード中の { } と衝突するため単純置換にする
    return template.replace(INPUT_PLACEHOLDER, user_input)


class WorkflowStatus(StrEnum):
    SUCCEEDED = "succeeded"
    PARTIAL = "partial"  # 一部のタスクのみ成功
    FAILED = "failed"


class WorkflowResult(BaseModel):
    workflow_id: str
    name: str
    type: str
    status: WorkflowStatus
    tasks: list[TaskRecord]
    started_at: datetime
    finished_at: datetime = Field(default_factory=utc_now)

    @property
    def final_output(self) -> str | None:
        """最後に成功したタスクの出力（sequential の最終成果物）。"""
        for task in reversed(self.tasks):
            if task.status == TaskStatus.SUCCEEDED:
                return task.output
        return None

    def cost_summary(self) -> str:
        priced = [t.cost.total_usd for t in self.tasks if t.cost and t.cost.total_usd is not None]
        unpriced = sum(
            1
            for t in self.tasks
            if t.status == TaskStatus.SUCCEEDED and (t.cost is None or t.cost.total_usd is None)
        )
        if not priced:
            return "料金未設定" if unpriced else "-"
        text = f"${sum(priced):.6f}"
        if unpriced:
            text += f" (+料金未設定 {unpriced}件)"
        return text


def status_from_tasks(tasks: list[TaskRecord]) -> WorkflowStatus:
    succeeded = sum(1 for t in tasks if t.status == TaskStatus.SUCCEEDED)
    if succeeded == len(tasks):
        return WorkflowStatus.SUCCEEDED
    if succeeded == 0:
        return WorkflowStatus.FAILED
    return WorkflowStatus.PARTIAL


class BaseWorkflow(ABC):
    type: str = "base"

    def __init__(
        self,
        name: str,
        agents: Mapping[str, BaseAgent],
        *,
        task_manager: TaskManager | None = None,
    ) -> None:
        self.name = name
        self.agents = agents
        self.task_manager = task_manager or TaskManager()

    @abstractmethod
    def run(self, user_input: str) -> WorkflowResult: ...

    def _new_workflow_id(self) -> str:
        return uuid.uuid4().hex[:12]

    def _agent(self, name: str) -> BaseAgent:
        try:
            return self.agents[name]
        except KeyError:
            raise AgentNotFoundError(name, sorted(self.agents)) from None

    def _execute(self, record: TaskRecord, agent: BaseAgent, task: AgentTask) -> TaskRecord:
        """1タスクを実行し、結果を TaskManager に反映する。予期しない例外もタスク失敗として扱う。"""
        self.task_manager.mark_running(record.task_id)
        try:
            result = agent.run(task)
        except Exception as exc:  # noqa: BLE001 - 1タスクの失敗でワークフロー全体を落とさない
            logger.exception("task %s (%s) で予期しない例外", record.task_id, record.step)
            self.task_manager.mark_failed(record.task_id, exc)
        else:
            self.task_manager.mark_finished(record.task_id, result)
        return self.task_manager.get(record.task_id)
