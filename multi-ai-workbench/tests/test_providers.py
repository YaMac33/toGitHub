"""プロバイダーのテスト。実際のAPI通信は行わず、SDKクライアントをモックに差し替える。

SDKの例外クラスは実物を使い、エラー変換が実際のSDKと整合していることを確認する。
"""

from __future__ import annotations

import logging
from types import SimpleNamespace as NS
from typing import Any

import pytest

from multi_ai_workbench.core.config import BudgetSettings, ProviderSettings
from multi_ai_workbench.core.exceptions import (
    BudgetExceededError,
    MissingAPIKeyError,
    ProviderAPIError,
    ProviderAuthenticationError,
    ProviderDisabledError,
    ProviderNotFoundError,
    ProviderRateLimitError,
    ProviderTimeoutError,
)
from multi_ai_workbench.core.interfaces import LLMProvider
from multi_ai_workbench.core.models import (
    GenerationParams,
    GenerationRequest,
    Message,
    Role,
    UsageSource,
)
from multi_ai_workbench.core.usage import BudgetGuard, InMemoryUsageStore, UsageRecord, UsageStatus
from multi_ai_workbench.providers import create_provider, get_provider_class, registered_provider_types
from multi_ai_workbench.providers.base import BaseProvider
from multi_ai_workbench.providers.mock_provider import MockProvider
from multi_ai_workbench.utils.logging import SecretMaskingFormatter, mask_secrets

httpx2 = pytest.importorskip("httpx2")
anthropic = pytest.importorskip("anthropic")
openai = pytest.importorskip("openai")
genai_errors = pytest.importorskip("google.genai.errors")
genai_types = pytest.importorskip("google.genai.types")

DUMMY_KEYS = {
    "ANTHROPIC_API_KEY": "sk-ant-test-dummy-key-0001",
    "OPENAI_API_KEY": "sk-test-dummy-key-000000000002",
    "GEMINI_API_KEY": "AIzaTestDummyKey000000000000003",
}


def _http_response(status: int) -> Any:
    return httpx2.Response(status, request=httpx2.Request("POST", "https://api.example.invalid"))


class Recorder:
    """呼び出し引数を記録し、順に結果（例外なら送出）を返す。"""

    def __init__(self, *results: Any) -> None:
        self.results = list(results)
        self.calls: list[dict[str, Any]] = []

    def __call__(self, **kwargs: Any) -> Any:
        self.calls.append(kwargs)
        result = self.results.pop(0) if len(self.results) > 1 else self.results[0]
        if isinstance(result, BaseException):
            raise result
        return result


def anthropic_response(text="こんにちは", inp=12, out=7):
    return NS(id="msg_1", content=[NS(type="text", text=text)], usage=NS(input_tokens=inp, output_tokens=out), stop_reason="end_turn")


def openai_response(text="hello", inp=20, out=9):
    return NS(id="resp_1", output_text=text, usage=NS(input_tokens=inp, output_tokens=out), status="completed", incomplete_details=None)


def gemini_response(text="gemini", inp=30, out=11, thoughts=4):
    meta = NS(prompt_token_count=inp, candidates_token_count=out, thoughts_token_count=thoughts)
    return NS(text=text, usage_metadata=meta, candidates=[NS(finish_reason="STOP")], response_id="g1")


def anthropic_client(recorder: Recorder):
    return NS(messages=NS(create=recorder))


def openai_client(recorder: Recorder):
    return NS(responses=NS(create=recorder))


def gemini_client(recorder: Recorder):
    return NS(models=NS(generate_content=recorder))


CLIENT_BUILDERS = {
    "anthropic": (anthropic_client, anthropic_response),
    "openai": (openai_client, openai_response),
    "gemini": (gemini_client, gemini_response),
}


@pytest.fixture
def store() -> InMemoryUsageStore:
    return InMemoryUsageStore()


@pytest.fixture
def sleeps() -> list[float]:
    return []


@pytest.fixture
def make(settings, catalog, store, sleeps):
    def _make(name: str, client: Any = None, **kwargs: Any) -> BaseProvider:
        kwargs.setdefault("catalog", catalog)
        return create_provider(name, settings, usage_store=store, client=client, sleep=sleeps.append, **kwargs)

    return _make


# --------------------------------------------------------------------------
# 共通インターフェース
# --------------------------------------------------------------------------


class TestCommonInterface:
    @pytest.mark.parametrize("name", ["anthropic", "openai", "gemini", "mock"])
    def test_all_providers_satisfy_protocol(self, make, name):
        provider = make(name)
        assert isinstance(provider, LLMProvider)
        assert provider.default_model

    def test_registry(self):
        assert {"anthropic", "openai", "gemini", "mock"} <= set(registered_provider_types())
        with pytest.raises(ProviderNotFoundError):
            get_provider_class("nope")

    def test_unknown_provider_name(self, settings):
        with pytest.raises(ProviderNotFoundError):
            create_provider("nope", settings)

    def test_provider_type_alias(self, settings, catalog):
        # 同じ実装を別名・別既定モデルで登録できる
        settings.providers["openai_sub"] = ProviderSettings(type="openai", api_key_env="OPENAI_API_KEY", default_model="gpt-5-mini")
        provider = create_provider("openai_sub", settings, catalog=catalog)
        assert type(provider).name == "openai"
        assert provider.instance_name == "openai_sub"

    @pytest.mark.parametrize("name", ["anthropic", "openai", "gemini"])
    def test_same_request_works_on_every_provider(self, make, store, name):
        build_client, build_resp = CLIENT_BUILDERS[name]
        provider = make(name, client=build_client(Recorder(build_resp())))
        resp = provider.generate(GenerationRequest(prompt="質問", system_prompt="sys", task_id="t-1"))
        assert resp.provider == name
        assert resp.model == provider.default_model
        assert resp.usage.source == UsageSource.REPORTED
        assert resp.task_id == "t-1"
        (record,) = store.load()
        assert record.provider == name and record.task_id == "t-1"
        assert record.status == UsageStatus.SUCCESS


# --------------------------------------------------------------------------
# APIキー
# --------------------------------------------------------------------------


class TestApiKeyHandling:
    @pytest.mark.parametrize("name,env", [("anthropic", "ANTHROPIC_API_KEY"), ("openai", "OPENAI_API_KEY"), ("gemini", "GEMINI_API_KEY")])
    def test_missing_key_raises_before_any_call(self, make, store, name, env):
        provider = make(name)
        assert provider.is_configured() is False
        with pytest.raises(MissingAPIKeyError) as excinfo:
            provider.generate(GenerationRequest(prompt="hi"))
        assert env in str(excinfo.value)
        assert provider._client is None  # SDKクライアントすら生成していない
        assert store.load() == []  # 呼び出していないので記録もしない

    def test_mock_needs_no_key(self, make):
        assert make("mock").is_configured() is True

    @pytest.mark.parametrize("name,client_type", [("anthropic", "Anthropic"), ("openai", "OpenAI"), ("gemini", "Client")])
    def test_real_sdk_client_created_with_timeout_and_no_sdk_retries(self, make, isolated_env, name, client_type):
        isolated_env.update(DUMMY_KEYS)
        provider = make(name)
        assert provider.is_configured() is True
        client = provider.get_client()  # 生成のみで通信はしない
        assert type(client).__name__ == client_type
        if name in ("anthropic", "openai"):
            assert client.max_retries == 0
            assert client.timeout == provider.settings.timeout_seconds

    def test_disabled_provider(self, make, isolated_env):
        isolated_env.update(DUMMY_KEYS)
        provider = make("anthropic")
        provider.settings.enabled = False
        with pytest.raises(ProviderDisabledError):
            provider.generate(GenerationRequest(prompt="hi"))


# --------------------------------------------------------------------------
# プロバイダー別のリクエスト変換
# --------------------------------------------------------------------------


class TestAnthropic:
    def test_request_mapping(self, make, caplog):
        rec = Recorder(anthropic_response())
        provider = make("anthropic", client=anthropic_client(rec))
        request = GenerationRequest(
            messages=[Message(role=Role.USER, content="a"), Message(role=Role.ASSISTANT, content="b")],
            prompt="c",
            system_prompt="system!",
            model="claude-haiku-5-5",
            params=GenerationParams(max_output_tokens=99, temperature=0.3, stop_sequences=["END"]),
        )
        with caplog.at_level(logging.WARNING, logger="multi_ai_workbench"):
            resp = provider.generate(request)
        (call,) = rec.calls
        assert call["model"] == "claude-haiku-5-5"
        assert call["system"] == "system!"
        assert call["max_tokens"] == 99
        assert call["stop_sequences"] == ["END"]
        assert [m["role"] for m in call["messages"]] == ["user", "assistant", "user"]
        assert "temperature" not in call  # anthropic SDK 2.x は非対応
        assert "temperature" in caplog.text
        assert resp.text == "こんにちは"
        assert (resp.usage.input_tokens, resp.usage.output_tokens) == (12, 7)
        assert resp.finish_reason == "end_turn"

    def test_default_max_tokens_from_settings(self, make, settings):
        rec = Recorder(anthropic_response())
        make("anthropic", client=anthropic_client(rec)).generate(GenerationRequest(prompt="x"))
        assert rec.calls[0]["max_tokens"] == settings.defaults.max_output_tokens


class TestOpenAI:
    def test_request_mapping(self, make):
        rec = Recorder(openai_response())
        provider = make("openai", client=openai_client(rec))
        resp = provider.generate(
            GenerationRequest(prompt="q", system_prompt="be brief", params=GenerationParams(max_output_tokens=50, temperature=0.2, top_p=0.9))
        )
        (call,) = rec.calls
        assert call["instructions"] == "be brief"
        assert call["input"] == [{"role": "user", "content": "q"}]
        assert (call["max_output_tokens"], call["temperature"], call["top_p"]) == (50, 0.2, 0.9)
        assert resp.text == "hello"
        assert resp.finish_reason == "completed"

    def test_unset_params_are_not_sent(self, make, settings):
        settings.defaults.max_output_tokens = None
        rec = Recorder(openai_response())
        make("openai", client=openai_client(rec)).generate(GenerationRequest(prompt="q"))
        assert set(rec.calls[0]) == {"model", "input"}


class TestGemini:
    def test_request_mapping(self, make):
        rec = Recorder(gemini_response())
        provider = make("gemini", client=gemini_client(rec))
        resp = provider.generate(
            GenerationRequest(
                messages=[Message(role=Role.USER, content="a"), Message(role=Role.ASSISTANT, content="b")],
                prompt="c",
                system_prompt="sys",
                params=GenerationParams(max_output_tokens=10, temperature=0.5),
            )
        )
        (call,) = rec.calls
        assert [c.role for c in call["contents"]] == ["user", "model", "user"]
        assert isinstance(call["config"], genai_types.GenerateContentConfig)
        assert call["config"].system_instruction == "sys"
        assert call["config"].max_output_tokens == 10
        assert resp.usage.input_tokens == 30
        assert resp.usage.output_tokens == 15  # 候補 11 + 思考 4

    def test_timeout_is_milliseconds(self, make, isolated_env):
        isolated_env.update(DUMMY_KEYS)
        provider = make("gemini")
        client = provider.get_client()
        assert client._api_client._http_options.timeout == int(provider.settings.timeout_seconds * 1000)


# --------------------------------------------------------------------------
# エラー処理・リトライ
# --------------------------------------------------------------------------


class TestErrorsAndRetry:
    def test_retry_then_success(self, make, sleeps, store):
        err = anthropic.RateLimitError("rate", response=_http_response(429), body=None)
        rec = Recorder(err, err, anthropic_response())
        resp = make("anthropic", client=anthropic_client(rec)).generate(GenerationRequest(prompt="x"))
        assert resp.text == "こんにちは"
        assert len(rec.calls) == 3
        assert sleeps == [1.0, 2.0]  # 指数バックオフ
        assert [r.status for r in store.load()] == [UsageStatus.SUCCESS]

    def test_retry_limit(self, make, sleeps, store, settings):
        err = anthropic.RateLimitError("rate", response=_http_response(429), body=None)
        rec = Recorder(err)
        with pytest.raises(ProviderRateLimitError) as excinfo:
            make("anthropic", client=anthropic_client(rec)).generate(GenerationRequest(prompt="x", task_id="t9"))
        assert len(rec.calls) == settings.providers["anthropic"].max_retries + 1
        assert isinstance(excinfo.value.__cause__, anthropic.RateLimitError)
        (record,) = store.load()
        assert record.status == UsageStatus.ERROR
        assert record.error_type == "ProviderRateLimitError"
        assert record.usage_source == UsageSource.UNAVAILABLE
        assert record.task_id == "t9"

    def test_auth_error_not_retried(self, make, sleeps):
        err = anthropic.AuthenticationError("bad key", response=_http_response(401), body=None)
        rec = Recorder(err)
        with pytest.raises(ProviderAuthenticationError):
            make("anthropic", client=anthropic_client(rec)).generate(GenerationRequest(prompt="x"))
        assert len(rec.calls) == 1 and sleeps == []

    def test_openai_timeout_translated(self, make):
        err = openai.APITimeoutError(request=httpx2.Request("POST", "https://api.example.invalid"))
        rec = Recorder(err, openai_response())
        resp = make("openai", client=openai_client(rec)).generate(GenerationRequest(prompt="x"))
        assert resp.text == "hello" and len(rec.calls) == 2

    def test_openai_timeout_exhausted(self, make):
        err = openai.APITimeoutError(request=httpx2.Request("POST", "https://api.example.invalid"))
        with pytest.raises(ProviderTimeoutError):
            make("openai", client=openai_client(Recorder(err))).generate(GenerationRequest(prompt="x"))

    def test_server_error_retryable_client_error_not(self, make):
        provider = make("openai")
        e500 = openai.InternalServerError("boom", response=_http_response(500), body=None)
        e400 = openai.BadRequestError("bad", response=_http_response(400), body=None)
        assert provider._translate_error(e500).retryable is True
        translated = provider._translate_error(e400)
        assert translated.retryable is False and translated.status_code == 400

    @pytest.mark.parametrize(
        "code,expected,retryable",
        [(429, ProviderRateLimitError, True), (403, ProviderAuthenticationError, False), (503, ProviderAPIError, True), (400, ProviderAPIError, False)],
    )
    def test_gemini_error_translation(self, make, code, expected, retryable):
        exc = genai_errors.APIError(code, {"error": {"code": code, "message": "m", "status": "S"}})
        translated = make("gemini")._translate_error(exc)
        assert isinstance(translated, expected)
        assert translated.retryable is retryable

    def test_gemini_transport_timeout(self, make):
        translated = make("gemini")._translate_error(httpx2.ReadTimeout("slow"))
        assert isinstance(translated, ProviderTimeoutError)

    def test_unexpected_exception_wrapped_and_not_retried(self, make, sleeps):
        rec = Recorder(ValueError("weird"))
        with pytest.raises(ProviderAPIError, match="ValueError"):
            make("openai", client=openai_client(rec)).generate(GenerationRequest(prompt="x"))
        assert len(rec.calls) == 1


# --------------------------------------------------------------------------
# 料金・使用量
# --------------------------------------------------------------------------


class TestUsageAndCost:
    def test_cost_with_priced_model(self, make, priced_catalog, store):
        rec = Recorder(anthropic_response(inp=1000, out=500))
        provider = make("anthropic", client=anthropic_client(rec), catalog=priced_catalog)
        resp = provider.generate(GenerationRequest(prompt="x", model="test-priced"))
        assert resp.cost.total_usd == pytest.approx(0.0105)
        assert store.load()[0].cost_usd == pytest.approx(0.0105)

    def test_unpriced_model_is_not_zero(self, make, store):
        rec = Recorder(anthropic_response())
        resp = make("anthropic", client=anthropic_client(rec)).generate(GenerationRequest(prompt="x"))
        assert resp.cost.display() == "料金未設定"
        assert store.load()[0].cost_usd is None

    def test_unknown_model_is_flagged(self, make, caplog):
        rec = Recorder(openai_response())
        with caplog.at_level(logging.WARNING, logger="multi_ai_workbench"):
            resp = make("openai", client=openai_client(rec)).generate(GenerationRequest(prompt="x", model="not-in-catalog"))
        assert resp.model_in_catalog is False
        assert resp.cost.pricing_configured is False
        assert "未登録" in caplog.text

    def test_missing_usage_is_estimated(self, make):
        resp_obj = openai_response()
        resp_obj.usage = None
        resp = make("openai", client=openai_client(Recorder(resp_obj))).generate(GenerationRequest(prompt="abcdefgh"))
        assert resp.usage.source == UsageSource.ESTIMATED
        assert resp.usage.input_tokens > 0

    def test_mock_provider(self, make, store):
        resp = make("mock").generate(GenerationRequest(prompt="ping"))
        assert "ping" in resp.text
        assert resp.usage.source == UsageSource.ESTIMATED
        assert resp.cost.display() == "$0.000000"  # 明示的に単価0
        assert store.load()[0].usage_source == UsageSource.ESTIMATED

    def test_mock_custom_responder(self, settings):
        provider = MockProvider(settings.providers["mock"], responder=lambda req, model: "custom")
        assert provider.generate(GenerationRequest(prompt="x")).text == "custom"

    def test_budget_guard_blocks_before_call(self, make, store):
        store.append(UsageRecord(provider="anthropic", model="m", cost_usd=5.0))
        guard = BudgetGuard(BudgetSettings(monthly_limit_usd=1.0, enforce=True), store)
        rec = Recorder(anthropic_response())
        provider = make("anthropic", client=anthropic_client(rec), budget_guard=guard)
        with pytest.raises(BudgetExceededError):
            provider.generate(GenerationRequest(prompt="x"))
        assert rec.calls == []


# --------------------------------------------------------------------------
# 機密情報のマスキング
# --------------------------------------------------------------------------


class TestSecretMasking:
    def test_registered_key_masked_in_errors(self, make, isolated_env):
        isolated_env.update(DUMMY_KEYS)
        provider = make("openai")
        provider.get_client()  # キーが登録される
        key = DUMMY_KEYS["OPENAI_API_KEY"]
        rec = Recorder(RuntimeError(f"failed with key={key}"))
        provider._client = openai_client(rec)
        with pytest.raises(ProviderAPIError) as excinfo:
            provider.generate(GenerationRequest(prompt="x"))
        assert key not in str(excinfo.value)

    @pytest.mark.parametrize(
        "secret",
        ["sk-ant-api03-abcdefghijklmnop", "sk-proj-abcdefghijklmnopqrstuv", "AIzaSyAbcdefghijklmnopqrstuvwxyz012"],
    )
    def test_patterns(self, secret):
        assert secret not in mask_secrets(f"error: {secret} happened")

    def test_header_style(self):
        masked = mask_secrets('headers={"x-api-key": "verysecretvalue123"}')
        assert "verysecretvalue123" not in masked

    def test_log_formatter_masks(self):
        record = logging.LogRecord("t", logging.ERROR, __file__, 1, "key=%s", ("sk-ant-api03-zzzzzzzzzzzzzz",), None)
        assert "zzzzzzzz" not in SecretMaskingFormatter("%(message)s").format(record)
