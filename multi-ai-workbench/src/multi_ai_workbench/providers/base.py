"""全プロバイダー共通の処理（テンプレートメソッド）。

各プロバイダー実装が書くのは次の3つだけ:
  _create_client(api_key)                    公式SDKクライアントの生成
  _call(client, request, model, params)      1回分のAPI呼び出しと共通形式への変換
  _translate_error(exc)                      SDK例外 → ProviderAPIError

APIキー確認・リトライ・タイムアウト設定・トークン推定・料金計算・利用記録・
予算チェックはここで共通に行うため、プロバイダーを追加してもワークフロー側の
修正は不要。
"""

from __future__ import annotations

import importlib
import threading
import time
from abc import ABC, abstractmethod
from collections.abc import Callable
from dataclasses import dataclass
from types import ModuleType
from typing import Any, ClassVar

from multi_ai_workbench.core.config import ModelCatalog, ProviderSettings, get_api_key
from multi_ai_workbench.core.exceptions import (
    MissingAPIKeyError,
    ProviderAPIError,
    ProviderAuthenticationError,
    ProviderDisabledError,
    ProviderRateLimitError,
    ProviderSDKNotInstalledError,
    ProviderTimeoutError,
    WorkbenchError,
)
from multi_ai_workbench.core.interfaces import UsageStore
from multi_ai_workbench.core.models import (
    GenerationParams,
    GenerationRequest,
    GenerationResponse,
    ModelInfo,
    TokenUsage,
    UsageSource,
)
from multi_ai_workbench.core.usage import (
    BudgetGuard,
    UsageRecord,
    UsageStatus,
    calculate_cost,
    estimate_tokens,
)
from multi_ai_workbench.utils.logging import get_logger, mask_secrets, register_secret

logger = get_logger(__name__)

# max_output_tokens が設定のどこにも無い場合の最終フォールバック
FALLBACK_MAX_OUTPUT_TOKENS = 1024


@dataclass
class ProviderResult:
    """_call の戻り値。usage が None の場合は BaseProvider が推定する。"""

    text: str
    usage: TokenUsage | None = None
    finish_reason: str | None = None
    response_id: str | None = None


class BaseProvider(ABC):
    name: ClassVar[str]
    # 公式SDKの import 名（不要なら None）
    sdk_module: ClassVar[str | None] = None
    sdk_package: ClassVar[str | None] = None

    def __init__(
        self,
        settings: ProviderSettings,
        *,
        instance_name: str | None = None,
        catalog: ModelCatalog | None = None,
        usage_store: UsageStore | None = None,
        budget_guard: BudgetGuard | None = None,
        defaults: GenerationParams | None = None,
        client: Any = None,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self.settings = settings
        # settings.yaml 上のキー名（同じ実装を別名で複数登録する場合に区別する）
        self.instance_name = instance_name or self.name
        self.catalog = catalog
        self.usage_store = usage_store
        self.budget_guard = budget_guard
        self.defaults = defaults or GenerationParams()
        self._client = client  # テストではモッククライアントを直接注入できる
        self._client_lock = threading.Lock()
        self._sleep = sleep

    # ------------------------------------------------------------------ 状態

    @property
    def default_model(self) -> str:
        return self.settings.default_model

    def is_configured(self) -> bool:
        if not self.settings.enabled:
            return False
        return not self.settings.requires_api_key or get_api_key(self.settings) is not None

    def model_info(self, model: str) -> ModelInfo | None:
        return self.catalog.get(self.name, model) if self.catalog else None

    # ------------------------------------------------------------ クライアント

    def _require_api_key(self) -> str | None:
        if not self.settings.requires_api_key:
            return None
        key = get_api_key(self.settings)
        if key is None:
            assert self.settings.api_key_env is not None
            raise MissingAPIKeyError(self.instance_name, self.settings.api_key_env)
        value = key.get_secret_value()
        register_secret(value)
        return value

    def get_client(self) -> Any:
        """SDKクライアントを遅延生成する。APIキーが無ければここで MissingAPIKeyError。"""
        if self._client is not None:
            return self._client
        with self._client_lock:
            if self._client is None:
                api_key = self._require_api_key()
                self._client = self._create_client(api_key)
        return self._client

    def _import_sdk(self) -> ModuleType:
        assert self.sdk_module is not None
        try:
            return importlib.import_module(self.sdk_module)
        except ImportError as exc:
            raise ProviderSDKNotInstalledError(
                self.instance_name, self.sdk_package or self.sdk_module
            ) from exc

    @abstractmethod
    def _create_client(self, api_key: str | None) -> Any: ...

    @abstractmethod
    def _call(
        self,
        client: Any,
        request: GenerationRequest,
        model: str,
        params: GenerationParams,
    ) -> ProviderResult: ...

    def _translate_error(self, exc: Exception) -> ProviderAPIError:
        return ProviderAPIError(
            self.instance_name, f"{type(exc).__name__}: {mask_secrets(str(exc))}"
        )

    # -------------------------------------------------------------- 生成本体

    def generate(self, request: GenerationRequest) -> GenerationResponse:
        if not self.settings.enabled:
            raise ProviderDisabledError(self.instance_name)

        model = request.model or self.default_model
        params = request.params.merged_over(self.defaults)
        info = self.model_info(model)
        if self.catalog is not None and info is None:
            logger.warning(
                "モデル %s/%s は models.yaml に未登録です（料金は「料金未設定」扱い）",
                self.name,
                model,
            )

        if self.budget_guard is not None:
            self.budget_guard.check()

        # APIキー未設定ならネットワークに出る前にここで止まる
        client = self.get_client()

        started = time.monotonic()
        result = self._call_with_retry(client, request, model, params)
        latency_ms = int((time.monotonic() - started) * 1000)

        usage = result.usage or self._estimate_usage(request, result.text)
        cost = calculate_cost(usage, info)
        response = GenerationResponse(
            provider=self.instance_name,
            model=model,
            text=result.text,
            usage=usage,
            cost=cost,
            finish_reason=result.finish_reason,
            response_id=result.response_id,
            latency_ms=latency_ms,
            task_id=request.task_id,
            model_in_catalog=info is not None,
        )
        self._record(
            UsageRecord(
                provider=self.instance_name,
                model=model,
                task_id=request.task_id,
                input_tokens=usage.input_tokens,
                output_tokens=usage.output_tokens,
                usage_source=usage.source,
                cost_usd=cost.total_usd,
                pricing_configured=cost.pricing_configured,
                latency_ms=latency_ms,
            )
        )
        # プロンプト本文や応答本文はログに出さない（メタデータのみ）
        logger.info(
            "generate ok provider=%s model=%s task=%s in=%d out=%d source=%s cost=%s latency=%dms",
            self.instance_name,
            model,
            request.task_id,
            usage.input_tokens,
            usage.output_tokens,
            usage.source,
            cost.display(),
            latency_ms,
        )
        return response

    def _call_with_retry(
        self,
        client: Any,
        request: GenerationRequest,
        model: str,
        params: GenerationParams,
    ) -> ProviderResult:
        attempts = self.settings.max_retries + 1
        for attempt in range(1, attempts + 1):
            try:
                return self._call(client, request, model, params)
            except ProviderAPIError as exc:
                error: ProviderAPIError = exc
                cause: BaseException | None = exc.__cause__
            except WorkbenchError:
                raise
            except Exception as exc:  # SDK固有の例外を共通形式へ
                error = self._translate_error(exc)
                cause = exc

            if not error.retryable or attempt >= attempts:
                self._record(
                    UsageRecord(
                        provider=self.instance_name,
                        model=model,
                        task_id=request.task_id,
                        usage_source=UsageSource.UNAVAILABLE,
                        status=UsageStatus.ERROR,
                        error_type=type(error).__name__,
                    )
                )
                # 例外は呼び出し側へ送出するため、ここでは WARNING として記録のみ
                logger.warning("generate failed provider=%s model=%s: %s", self.instance_name, model, error)
                if cause is not None and cause is not error:
                    raise error from cause
                raise error

            delay = self.settings.retry_base_delay_seconds * (2 ** (attempt - 1))
            logger.warning(
                "再試行 %d/%d provider=%s (%.1f秒後): %s",
                attempt,
                attempts - 1,
                self.instance_name,
                delay,
                error,
            )
            self._sleep(delay)
        raise AssertionError("unreachable")  # pragma: no cover

    @staticmethod
    def _estimate_usage(request: GenerationRequest, output_text: str) -> TokenUsage:
        prompt_text = (request.system_prompt or "") + "".join(
            m.content for m in request.to_messages()
        )
        return TokenUsage(
            input_tokens=estimate_tokens(prompt_text),
            output_tokens=estimate_tokens(output_text),
            source=UsageSource.ESTIMATED,
        )

    def _record(self, record: UsageRecord) -> None:
        if self.usage_store is None:
            return
        try:
            self.usage_store.append(record)
        except OSError as exc:  # 記録失敗で本処理を止めない
            logger.warning("利用記録の保存に失敗しました: %s", exc)


def translate_stainless_error(provider: str, sdk: ModuleType, exc: Exception) -> ProviderAPIError:
    """anthropic / openai SDK は同じ例外階層を持つため共通で変換する。

    APITimeoutError は APIConnectionError のサブクラスなので先に判定する。
    """
    if isinstance(exc, sdk.APITimeoutError):
        return ProviderTimeoutError(provider)
    if isinstance(exc, sdk.AuthenticationError):
        return ProviderAuthenticationError(provider)
    if isinstance(exc, sdk.RateLimitError):
        return ProviderRateLimitError(provider)
    if isinstance(exc, sdk.APIConnectionError):
        return ProviderAPIError(provider, "接続エラー", retryable=True)
    if isinstance(exc, sdk.APIStatusError):
        status = exc.status_code
        message = mask_secrets(getattr(exc, "message", None) or str(exc))
        return ProviderAPIError(
            provider,
            f"HTTP {status}: {message}",
            retryable=status >= 500 or status == 409,
            status_code=status,
        )
    return ProviderAPIError(provider, f"{type(exc).__name__}: {mask_secrets(str(exc))}")
