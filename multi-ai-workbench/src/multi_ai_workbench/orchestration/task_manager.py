"""タスクの入力・出力・実行状態・エラーの管理。

現在はメモリ上で管理する。将来の永続化（SQLite 等）や Web UI からの進捗表示は、
TaskManager を差し替える/購読することで対応できるようにしている。
"""

from __future__ import annotations

import threading
from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, Field

from multi_ai_workbench.agents.base import AgentResult, new_task_id
from multi_ai_workbench.core.models import CostEstimate, TokenUsage, utc_now


class TaskStatus(StrEnum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    SKIPPED = "skipped"


class TaskRecord(BaseModel):
    task_id: str = Field(default_factory=new_task_id)
    workflow_id: str | None = None
    step: str
    agent: str
    instruction: str
    status: TaskStatus = TaskStatus.PENDING
    provider: str | None = None
    model: str | None = None
    output: str | None = None
    error: str | None = None
    error_type: str | None = None
    usage: TokenUsage | None = None
    cost: CostEstimate | None = None
    created_at: datetime = Field(default_factory=utc_now)
    started_at: datetime | None = None
    finished_at: datetime | None = None

    @property
    def duration_seconds(self) -> float | None:
        if self.started_at and self.finished_at:
            return (self.finished_at - self.started_at).total_seconds()
        return None


class TaskManager:
    def __init__(self) -> None:
        self._tasks: dict[str, TaskRecord] = {}
        self._lock = threading.Lock()

    def create(self, *, step: str, agent: str, instruction: str, workflow_id: str | None = None) -> TaskRecord:
        record = TaskRecord(step=step, agent=agent, instruction=instruction, workflow_id=workflow_id)
        with self._lock:
            self._tasks[record.task_id] = record
        return record

    def get(self, task_id: str) -> TaskRecord:
        with self._lock:
            return self._tasks[task_id]

    def list(self, workflow_id: str | None = None) -> list[TaskRecord]:
        with self._lock:
            return [t for t in self._tasks.values() if workflow_id is None or t.workflow_id == workflow_id]

    def mark_running(self, task_id: str) -> None:
        with self._lock:
            record = self._tasks[task_id]
            record.status = TaskStatus.RUNNING
            record.started_at = utc_now()

    def mark_finished(self, task_id: str, result: AgentResult) -> None:
        with self._lock:
            record = self._tasks[task_id]
            record.status = TaskStatus.SUCCEEDED if result.success else TaskStatus.FAILED
            record.provider = result.provider
            record.model = result.model
            record.output = result.output
            record.error = result.error
            record.error_type = result.error_type
            record.usage = result.usage
            record.cost = result.cost
            record.finished_at = utc_now()

    def mark_failed(self, task_id: str, error: BaseException) -> None:
        with self._lock:
            record = self._tasks[task_id]
            record.status = TaskStatus.FAILED
            record.error = str(error)
            record.error_type = type(error).__name__
            record.finished_at = utc_now()

    def mark_skipped(self, task_id: str, reason: str) -> None:
        with self._lock:
            record = self._tasks[task_id]
            record.status = TaskStatus.SKIPPED
            record.error = reason
            record.finished_at = utc_now()
