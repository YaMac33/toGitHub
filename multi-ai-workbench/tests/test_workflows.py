from __future__ import annotations

import threading

import pytest

from multi_ai_workbench.agents import CodingAgent, ResearchAgent, ReviewAgent
from multi_ai_workbench.core.exceptions import AgentNotFoundError, ProviderAPIError, WorkflowError
from multi_ai_workbench.core.usage import InMemoryUsageStore
from multi_ai_workbench.orchestration.orchestrator import Orchestrator
from multi_ai_workbench.orchestration.task_manager import TaskManager, TaskStatus
from multi_ai_workbench.workflows import (
    ParallelWorkflow,
    SequentialWorkflow,
    WorkflowStatus,
    WorkflowStep,
    render_instruction,
)

from conftest import FakeProvider

STEPS = [
    WorkflowStep(name="requirements", agent="research", instruction="要件分析: {input}"),
    WorkflowStep(name="design_review", agent="review", instruction="設計レビュー"),
    WorkflowStep(name="implementation", agent="coding", instruction="実装"),
    WorkflowStep(name="code_review", agent="review", instruction="コードレビュー"),
]


def _agents(**providers: FakeProvider):
    p = {"research": FakeProvider("gemini"), "review": FakeProvider("openai"), "coding": FakeProvider("anthropic")}
    p.update(providers)
    return (
        {"research": ResearchAgent(p["research"]), "review": ReviewAgent(p["review"]), "coding": CodingAgent(p["coding"])},
        p,
    )


def _fail(req):
    raise ProviderAPIError("anthropic", "server down", retryable=True)


class TestSequential:
    def test_runs_in_order_and_passes_outputs(self):
        calls: list[str] = []

        def tracking(name):
            def handler(req):
                calls.append(name)
                return f"<{name} result #{len(calls)}>"
            return handler

        agents, providers = _agents(
            research=FakeProvider("gemini", handler=tracking("research")),
            review=FakeProvider("openai", handler=tracking("review")),
            coding=FakeProvider("anthropic", handler=tracking("coding")),
        )
        result = SequentialWorkflow("dev", STEPS, agents).run("TODOアプリ")

        assert result.status == WorkflowStatus.SUCCEEDED
        assert calls == ["research", "review", "coding", "review"]
        assert [t.step for t in result.tasks] == ["requirements", "design_review", "implementation", "code_review"]
        assert all(t.status == TaskStatus.SUCCEEDED for t in result.tasks)

        # {input} は1ステップ目に埋め込まれ、以降のステップには context として渡る
        first_prompt = providers["research"].requests[0].prompt
        assert "要件分析: TODOアプリ" in first_prompt
        coding_prompt = providers["coding"].requests[0].prompt
        assert "TODOアプリ" in coding_prompt
        assert "<research result #1>" in coding_prompt and "<review result #2>" in coding_prompt
        assert result.final_output == "<review result #4>"

    def test_task_records_capture_io_and_usage(self):
        agents, _ = _agents()
        result = SequentialWorkflow("dev", STEPS, agents).run("x")
        task = result.tasks[2]
        assert task.instruction == "実装"
        assert task.output == "anthropic-output"
        assert task.provider == "anthropic" and task.model == "fake-model"
        assert task.usage.input_tokens == 10
        assert task.started_at and task.finished_at and task.duration_seconds >= 0
        assert task.workflow_id == result.workflow_id
        # タスクIDはプロバイダーへのリクエスト（=利用記録）まで引き継がれる
        assert result.cost_summary() == "$0.004000"

    def test_stop_on_failure_skips_rest(self):
        agents, _ = _agents(coding=FakeProvider("anthropic", handler=_fail))
        result = SequentialWorkflow("dev", STEPS, agents).run("x")
        statuses = [t.status for t in result.tasks]
        assert statuses == [TaskStatus.SUCCEEDED, TaskStatus.SUCCEEDED, TaskStatus.FAILED, TaskStatus.SKIPPED]
        assert result.status == WorkflowStatus.PARTIAL
        assert "server down" in result.tasks[2].error
        assert "implementation" in result.tasks[3].error

    def test_continue_on_failure(self):
        agents, providers = _agents(coding=FakeProvider("anthropic", handler=_fail))
        result = SequentialWorkflow("dev", STEPS, agents, stop_on_failure=False).run("x")
        assert result.tasks[3].status == TaskStatus.SUCCEEDED
        assert len(providers["review"].requests) == 2

    def test_all_failed(self):
        agents, _ = _agents(research=FakeProvider("gemini", handler=_fail))
        result = SequentialWorkflow("dev", STEPS[:1], agents).run("x")
        assert result.status == WorkflowStatus.FAILED
        assert result.cost_summary() == "-"

    def test_unexpected_exception_is_contained(self):
        def bug(req):
            raise KeyError("bug")

        agents, _ = _agents(research=FakeProvider("gemini", handler=bug))
        result = SequentialWorkflow("dev", STEPS, agents).run("x")
        assert result.tasks[0].status == TaskStatus.FAILED
        assert result.tasks[0].error_type == "KeyError"

    def test_validation(self):
        agents, _ = _agents()
        with pytest.raises(AgentNotFoundError):
            SequentialWorkflow("dev", [WorkflowStep(name="a", agent="ghost", instruction="x")], agents)
        with pytest.raises(WorkflowError):
            SequentialWorkflow("dev", [STEPS[0], STEPS[0]], agents)
        with pytest.raises(WorkflowError):
            SequentialWorkflow("dev", [], agents)

    def test_input_with_braces_is_safe(self):
        assert render_instruction("review: {input}", "def f(): return {'a': 1}") == "review: def f(): return {'a': 1}"


class TestParallel:
    def test_runs_concurrently_and_keeps_order(self):
        # 3つが同時に到達しないと解除されないバリア → 逐次実行ならタイムアウトで失敗する
        barrier = threading.Barrier(3, timeout=5)

        def handler_for(name):
            def handler(req):
                barrier.wait()
                return f"{name} review"
            return handler

        providers = {n: FakeProvider(n, handler=handler_for(n)) for n in ("anthropic", "openai", "gemini")}
        agents = {f"review_{n}": ReviewAgent(p, name=f"review_{n}") for n, p in providers.items()}
        names = list(agents)
        result = ParallelWorkflow("multi", names, agents, instruction="レビュー: {input}", max_workers=3).run("設計書")

        assert result.status == WorkflowStatus.SUCCEEDED
        assert [t.agent for t in result.tasks] == names
        assert [t.output for t in result.tasks] == ["anthropic review", "openai review", "gemini review"]
        for p in providers.values():
            assert "レビュー: 設計書" in p.requests[0].prompt

    def test_partial_failure(self):
        providers = {"a": FakeProvider("anthropic"), "b": FakeProvider("openai", handler=_fail)}
        agents = {n: ReviewAgent(p, name=n) for n, p in providers.items()}
        result = ParallelWorkflow("multi", ["a", "b"], agents).run("x")
        assert result.status == WorkflowStatus.PARTIAL
        assert [t.status for t in result.tasks] == [TaskStatus.SUCCEEDED, TaskStatus.FAILED]

    def test_input_passed_as_context_without_placeholder(self):
        provider = FakeProvider()
        ParallelWorkflow("m", ["a"], {"a": ReviewAgent(provider)}, instruction="比較して").run("対象テキスト")
        assert "対象テキスト" in provider.requests[0].prompt

    def test_validation(self):
        with pytest.raises(WorkflowError):
            ParallelWorkflow("m", [], {})
        with pytest.raises(AgentNotFoundError):
            ParallelWorkflow("m", ["ghost"], {})


class TestTaskManager:
    def test_shared_across_workflows(self):
        tm = TaskManager()
        agents, _ = _agents()
        r1 = SequentialWorkflow("dev", STEPS[:2], agents, task_manager=tm).run("x")
        r2 = ParallelWorkflow("p", ["review"], agents, task_manager=tm).run("y")
        assert len(tm.list()) == 3
        assert len(tm.list(r1.workflow_id)) == 2
        assert len(tm.list(r2.workflow_id)) == 1


class TestOrchestratorWorkflows:
    @pytest.mark.parametrize("name,count", [("dev_pipeline", 4), ("multi_review", 3)])
    def test_configured_workflows_dry_run(self, settings, catalog, name, count):
        store = InMemoryUsageStore()
        orch = Orchestrator(settings, catalog, store, force_provider="mock")
        result = orch.run_workflow(name, "TODO API")
        assert result.status == WorkflowStatus.SUCCEEDED
        assert len(result.tasks) == count
        # 各タスクのIDが利用記録に残る
        assert {r.task_id for r in store.load()} == {t.task_id for t in result.tasks}

    def test_without_keys_fails_gracefully(self, settings, catalog):
        result = Orchestrator(settings, catalog, InMemoryUsageStore()).run_workflow("multi_review", "x")
        assert result.status == WorkflowStatus.FAILED
        assert {t.error_type for t in result.tasks} == {"MissingAPIKeyError"}

    def test_unknown_workflow(self, settings, catalog):
        with pytest.raises(WorkflowError):
            Orchestrator(settings, catalog, InMemoryUsageStore()).run_workflow("nope", "x")
