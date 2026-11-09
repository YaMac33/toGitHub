"""Anthropic Claude API (Messages API)。

注意: anthropic SDK 2.x の messages.create は temperature / top_p を受け付けない。
指定された場合は警告ログを出して無視する。
"""

from __future__ import annotations

from typing import Any

from multi_ai_workbench.core.exceptions import ProviderAPIError
from multi_ai_workbench.core.models import GenerationParams, GenerationRequest, TokenUsage
from multi_ai_workbench.providers.base import (
    FALLBACK_MAX_OUTPUT_TOKENS,
    BaseProvider,
    ProviderResult,
    translate_stainless_error,
)
from multi_ai_workbench.providers.registry import register_provider
from multi_ai_workbench.utils.logging import get_logger

logger = get_logger(__name__)


@register_provider
class AnthropicProvider(BaseProvider):
    name = "anthropic"
    sdk_module = "anthropic"
    sdk_package = "anthropic"

    def _create_client(self, api_key: str | None) -> Any:
        sdk = self._import_sdk()
        # リトライは BaseProvider が上限付きで行うため SDK 側は無効化
        return sdk.Anthropic(
            api_key=api_key,
            timeout=self.settings.timeout_seconds,
            max_retries=0,
        )

    def _call(
        self,
        client: Any,
        request: GenerationRequest,
        model: str,
        params: GenerationParams,
    ) -> ProviderResult:
        if params.temperature is not None or params.top_p is not None:
            logger.warning("anthropic: temperature / top_p は現行SDKで非対応のため無視します")

        kwargs: dict[str, Any] = {
            "model": model,
            "max_tokens": params.max_output_tokens or FALLBACK_MAX_OUTPUT_TOKENS,
            "messages": [
                {"role": m.role.value, "content": m.content} for m in request.to_messages()
            ],
        }
        if request.system_prompt:
            kwargs["system"] = request.system_prompt
        if params.stop_sequences:
            kwargs["stop_sequences"] = params.stop_sequences

        resp = client.messages.create(**kwargs)

        text = "".join(
            block.text for block in resp.content if getattr(block, "type", None) == "text"
        )
        usage = None
        if getattr(resp, "usage", None) is not None:
            usage = TokenUsage(
                input_tokens=resp.usage.input_tokens or 0,
                output_tokens=resp.usage.output_tokens or 0,
            )
        return ProviderResult(
            text=text,
            usage=usage,
            finish_reason=getattr(resp, "stop_reason", None),
            response_id=getattr(resp, "id", None),
        )

    def _translate_error(self, exc: Exception) -> ProviderAPIError:
        return translate_stainless_error(self.instance_name, self._import_sdk(), exc)
