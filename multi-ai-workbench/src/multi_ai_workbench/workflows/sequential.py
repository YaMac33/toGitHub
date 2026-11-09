"""Sequential Workflow: 複数のエージェントが順番にタスクを実行する。

例: 要件分析 → 設計レビュー → コード生成 → コードレビュー
各ステップには、ユーザー入力とそれまでに成功したステップの出力が context として渡される。
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence

from pydantic import BaseModel

from multi_ai_workbench.agents.base import AgentTask, BaseAgent
from multi_ai_workbench.core.exceptions import WorkflowError
from multi_ai_workbench.core.models import utc_now
from multi_ai_workbench.orchestration.task_manager import TaskManager, TaskStatus
from multi_ai_workbench.workflows.base import (
    INPUT_PLACEHOLDER,
    BaseWorkflow,
    WorkflowResult,
    render_instruction,
    status_from_tasks,
)


class WorkflowStep(BaseModel):
    name: str
    agent: str
    instruction: str


class SequentialWorkflow(BaseWorkflow):
    type = "sequential"

    def __init__(
        self,
        name: str,
        steps: Sequence[WorkflowStep],
        agents: Mapping[str, BaseAgent],
        *,
        stop_on_failure: bool = True,
        task_manager: TaskManager | None = None,
    ) -> None:
        super().__init__(name, agents, task_manager=task_manager)
        if not steps:
            raise WorkflowError("ステップが空です")
        names = [s.name for s in steps]
        if len(names) != len(set(names)):
            raise WorkflowError(f"ステップ名が重複しています: {names}")
        for step in steps:
            self._agent(step.agent)  # 未定義のエージェントは実行前に検出
        self.steps = list(steps)
        self.stop_on_failure = stop_on_failure

    def run(self, user_input: str) -> WorkflowResult:
        workflow_id = self._new_workflow_id()
        started_at = utc_now()
        records = [
            self.task_manager.create(
                step=step.name,
                agent=step.agent,
                instruction=render_instruction(step.instruction, user_input),
                workflow_id=workflow_id,
            )
            for step in self.steps
        ]

        outputs: dict[str, str] = {}
        halted_by: str | None = None
        for step, record in zip(self.steps, records):
            if halted_by is not None:
                self.task_manager.mark_skipped(record.task_id, f"前のステップ '{halted_by}' が失敗したためスキップ")
                continue

            context: dict[str, str] = {}
            if INPUT_PLACEHOLDER not in step.instruction:
                context["ユーザー入力"] = user_input
            for prev_name, prev_output in outputs.items():
                context[f"{prev_name} の出力"] = prev_output

            task = AgentTask(instruction=record.instruction, context=context, task_id=record.task_id)
            finished = self._execute(record, self._agent(step.agent), task)

            if finished.status == TaskStatus.SUCCEEDED:
                outputs[step.name] = finished.output or ""
            elif self.stop_on_failure:
                halted_by = step.name

        tasks = [self.task_manager.get(r.task_id) for r in records]
        return WorkflowResult(
            workflow_id=workflow_id,
            name=self.name,
            type=self.type,
            status=status_from_tasks(tasks),
            tasks=tasks,
            started_at=started_at,
        )
