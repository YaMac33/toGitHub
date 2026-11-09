"""Parallel Workflow: 複数のエージェントが同じタスクを独立に実行する。

例: Claude / OpenAI / Gemini に同じ設計書をレビューさせ、結果を比較する。
各社SDKの同期クライアントをそのまま使えるよう、スレッドプールで並列化している。
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from concurrent.futures import ThreadPoolExecutor

from multi_ai_workbench.agents.base import AgentTask, BaseAgent
from multi_ai_workbench.core.exceptions import WorkflowError
from multi_ai_workbench.core.models import utc_now
from multi_ai_workbench.orchestration.task_manager import TaskManager, TaskRecord
from multi_ai_workbench.workflows.base import (
    INPUT_PLACEHOLDER,
    BaseWorkflow,
    WorkflowResult,
    render_instruction,
    status_from_tasks,
)


class ParallelWorkflow(BaseWorkflow):
    type = "parallel"

    def __init__(
        self,
        name: str,
        agent_names: Sequence[str],
        agents: Mapping[str, BaseAgent],
        *,
        instruction: str = INPUT_PLACEHOLDER,
        max_workers: int = 4,
        task_manager: TaskManager | None = None,
    ) -> None:
        super().__init__(name, agents, task_manager=task_manager)
        if not agent_names:
            raise WorkflowError("エージェントが指定されていません")
        for agent_name in agent_names:
            self._agent(agent_name)
        self.agent_names = list(agent_names)
        self.instruction = instruction
        self.max_workers = max(1, max_workers)

    def run(self, user_input: str) -> WorkflowResult:
        workflow_id = self._new_workflow_id()
        started_at = utc_now()
        instruction = render_instruction(self.instruction, user_input)
        context = {} if INPUT_PLACEHOLDER in self.instruction else {"対象": user_input}

        records = [
            self.task_manager.create(
                step=agent_name,
                agent=agent_name,
                instruction=instruction,
                workflow_id=workflow_id,
            )
            for agent_name in self.agent_names
        ]

        def run_one(record: TaskRecord) -> TaskRecord:
            task = AgentTask(instruction=instruction, context=context, task_id=record.task_id)
            return self._execute(record, self._agent(record.agent), task)

        with ThreadPoolExecutor(max_workers=min(self.max_workers, len(records))) as pool:
            # map は入力順で結果を返すため、表示順がエージェント定義順で安定する
            tasks = list(pool.map(run_one, records))

        return WorkflowResult(
            workflow_id=workflow_id,
            name=self.name,
            type=self.type,
            status=status_from_tasks(tasks),
            tasks=tasks,
            started_at=started_at,
        )
