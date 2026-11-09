"""OpenAI API (Responses API)。

注意: Responses API は stop_sequences 非対応のため、指定時は警告して無視する。
"""

from __future__ import annotations

from typing import Any

from multi_ai_workbench.core.exceptions import ProviderAPIError
from multi_ai_workbench.core.models import GenerationParams, GenerationRequest, TokenUsage
from multi_ai_workbench.providers.base import (
    BaseProvider,
    ProviderResult,
    translate_stainless_error,
)
from multi_ai_workbench.providers.registry import register_provider
from multi_ai_workbench.utils.logging import get_logger

logger = get_logger(__name__)


@register_provider
class OpenAIProvider(BaseProvider):
    name = "openai"
    sdk_module = "openai"
    sdk_package = "openai"

    def _create_client(self, api_key: str | None) -> Any:
        sdk = self._import_sdk()
        return sdk.OpenAI(
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
        if params.stop_sequences:
            logger.warning("openai: Responses API は stop_sequences 非対応のため無視します")

        kwargs: dict[str, Any] = {
            "model": model,
            "input": [
                {"role": m.role.value, "content": m.content} for m in request.to_messages()
            ],
        }
        if request.system_prompt:
            kwargs["instructions"] = request.system_prompt
        if params.max_output_tokens is not None:
            kwargs["max_output_tokens"] = params.max_output_tokens
        if params.temperature is not None:
            kwargs["temperature"] = params.temperature
        if params.top_p is not None:
            kwargs["top_p"] = params.top_p

        resp = client.responses.create(**kwargs)

        usage = None
        if getattr(resp, "usage", None) is not None:
            usage = TokenUsage(
                input_tokens=resp.usage.input_tokens or 0,
                output_tokens=resp.usage.output_tokens or 0,
            )
        finish_reason = getattr(resp, "status", None)
        details = getattr(resp, "incomplete_details", None)
        if details is not None and getattr(details, "reason", None):
            finish_reason = f"{finish_reason}:{details.reason}"
        return ProviderResult(
            text=resp.output_text or "",
            usage=usage,
            finish_reason=finish_reason,
            response_id=getattr(resp, "id", None),
        )

    def _translate_error(self, exc: Exception) -> ProviderAPIError:
        return translate_stainless_error(self.instance_name, self._import_sdk(), exc)
