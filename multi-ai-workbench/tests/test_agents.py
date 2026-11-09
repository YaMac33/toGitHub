from __future__ import annotations

import pytest

from multi_ai_workbench.agents import (
    AGENT_ROLES,
    AgentTask,
    CodingAgent,
    ExternalCLIAgent,
    GenericAgent,
    ResearchAgent,
    ReviewAgent,
)
from multi_ai_workbench.core.config import ExternalAgentSettings
from multi_ai_workbench.core.exceptions import AgentNotFoundError, ProviderRateLimitError
from multi_ai_workbench.core.models import GenerationParams
from multi_ai_workbench.core.usage import InMemoryUsageStore
from multi_ai_workbench.orchestration.orchestrator import Orchestrator

from conftest import FakeProvider


class TestAgentExecution:
    def test_success(self):
        provider = FakeProvider("anthropic", default_model="claude-x")
        result = CodingAgent(provider).run(AgentTask(instruction="FizzBuzzを書いて", task_id="task-1"))
        assert result.success is True
        assert result.output == "anthropic-output"
        assert (result.task_id, result.role, result.provider, result.model) == ("task-1", "coding", "anthropic", "claude-x")
        (req,) = provider.requests
        assert req.system_prompt == CodingAgent.default_system_prompt
        assert req.task_id == "task-1"
        assert "FizzBuzz" in req.prompt

    def test_overrides(self):
        provider = FakeProvider()
        agent = ReviewAgent(provider, name="r1", model="m2", system_prompt="custom", params=GenerationParams(max_output_tokens=7))
        agent.run(AgentTask(instruction="x"))
        (req,) = provider.requests
        assert (req.model, req.system_prompt, req.params.max_output_tokens) == ("m2", "custom", 7)

    def test_provider_error_becomes_failed_result(self):
        def boom(req):
            raise ProviderRateLimitError("openai")

        result = ReviewAgent(FakeProvider("openai", handler=boom)).run(AgentTask(instruction="x"))
        assert result.success is False
        assert result.error_type == "ProviderRateLimitError"
        assert result.output is None

    def test_missing_key_becomes_failed_result(self, settings, catalog):
        orch = Orchestrator(settings, catalog, InMemoryUsageStore())
        result = orch.agent("coding").run(AgentTask(instruction="x"))
        assert result.success is False
        assert result.error_type == "MissingAPIKeyError"


class TestPrompts:
    @pytest.mark.parametrize("agent_cls,marker", [(CodingAgent, "実装タスク"), (ReviewAgent, "レビュー依頼"), (ResearchAgent, "調査テーマ")])
    def test_role_specific_prompt_includes_context(self, agent_cls, marker):
        provider = FakeProvider()
        agent_cls(provider).run(AgentTask(instruction="指示", context={"前工程": "前工程の成果物"}))
        prompt = provider.requests[0].prompt
        assert marker in prompt and "指示" in prompt and "前工程の成果物" in prompt

    def test_review_prompt_lists_security(self):
        provider = FakeProvider()
        ReviewAgent(provider).run(AgentTask(instruction="x"))
        assert "セキュリティ" in provider.requests[0].prompt

    def test_roles_have_distinct_system_prompts(self):
        prompts = {cls.default_system_prompt for cls in AGENT_ROLES.values()}
        assert len(prompts) == len(AGENT_ROLES)


class TestRoleProviderSeparation:
    def test_same_role_on_different_providers(self):
        for name in ("anthropic", "openai", "gemini"):
            result = CodingAgent(FakeProvider(name)).run(AgentTask(instruction="x"))
            assert (result.role, result.provider) == ("coding", name)

    def test_orchestrator_uses_configured_provider(self, settings, catalog):
        orch = Orchestrator(settings, catalog, InMemoryUsageStore())
        assert orch.agent("coding").provider.name == "anthropic"
        assert orch.agent("review").provider.name == "openai"
        assert orch.agent("research").provider.name == "gemini"

    def test_switch_provider_by_config(self, settings, catalog):
        settings.agents["coding"].provider = "openai"
        orch = Orchestrator(settings, catalog, InMemoryUsageStore())
        agent = orch.agent("coding")
        assert isinstance(agent, CodingAgent)
        assert agent.provider.name == "openai"

    def test_injected_providers(self, settings, catalog):
        fake = FakeProvider("anthropic")
        orch = Orchestrator(settings, catalog, InMemoryUsageStore(), providers={"anthropic": fake})
        result = orch.agent("coding").run(AgentTask(instruction="x"))
        assert result.success and fake.requests

    def test_force_provider_uses_its_default_model(self, settings, catalog):
        orch = Orchestrator(settings, catalog, InMemoryUsageStore(), force_provider="mock")
        agent = orch.agent("review")
        assert agent.provider.name == "mock"
        result = agent.run(AgentTask(instruction="x"))
        assert result.success and result.model == "mock-echo"

    def test_unknown_role_falls_back_to_generic(self, settings, catalog):
        settings.agents["coding"].role = "translator"
        settings.agents["coding"].system_prompt = "翻訳者として振る舞う"
        orch = Orchestrator(settings, catalog, InMemoryUsageStore())
        agent = orch.agent("coding")
        assert isinstance(agent, GenericAgent)
        assert agent.system_prompt == "翻訳者として振る舞う"

    def test_unknown_agent(self, settings, catalog):
        with pytest.raises(AgentNotFoundError):
            Orchestrator(settings, catalog, InMemoryUsageStore()).agent("ghost")


class TestExternalAgents:
    def test_detection_and_no_auto_run(self):
        agent = ExternalCLIAgent("x", ExternalAgentSettings(command="definitely-not-installed-cli-xyz"))
        assert agent.is_installed() is False
        with pytest.raises(NotImplementedError):
            agent.run("do something")

    def test_configured_external_agents(self, settings, catalog):
        names = {a.name for a in Orchestrator(settings, catalog, InMemoryUsageStore()).external_agents()}
        assert {"claude-code", "codex", "gemini-cli"} <= names
