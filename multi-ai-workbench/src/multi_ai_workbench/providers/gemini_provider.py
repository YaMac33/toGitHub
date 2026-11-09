"""Google Gemini API (google-genai SDK)。

- HttpOptions.timeout はミリ秒指定
- SDK 側のリトライは attempts=1 で無効化し、BaseProvider の上限付きリトライに一本化
- 出力トークンには思考トークン (thoughts_token_count) も含める（課金対象のため）
"""

from __future__ import annotations

import importlib
from typing import Any

from multi_ai_workbench.core.exceptions import (
    ProviderAPIError,
    ProviderAuthenticationError,
    ProviderRateLimitError,
    ProviderTimeoutError,
)
from multi_ai_workbench.core.models import GenerationParams, GenerationRequest, Role, TokenUsage
from multi_ai_workbench.providers.base import BaseProvider, ProviderResult
from multi_ai_workbench.providers.registry import register_provider
from multi_ai_workbench.utils.logging import mask_secrets


@register_provider
class GeminiProvider(BaseProvider):
    name = "gemini"
    sdk_module = "google.genai"
    sdk_package = "google-genai"

    def _types(self) -> Any:
        self._import_sdk()
        return importlib.import_module("google.genai.types")

    def _create_client(self, api_key: str | None) -> Any:
        genai = self._import_sdk()
        types = self._types()
        return genai.Client(
            api_key=api_key,
            http_options=types.HttpOptions(
                timeout=int(self.settings.timeout_seconds * 1000),
                retry_options=types.HttpRetryOptions(attempts=1),
            ),
        )

    def _call(
        self,
        client: Any,
        request: GenerationRequest,
        model: str,
        params: GenerationParams,
    ) -> ProviderResult:
        types = self._types()
        contents = [
            types.Content(
                role="model" if m.role == Role.ASSISTANT else "user",
                parts=[types.Part(text=m.content)],
            )
            for m in request.to_messages()
        ]
        config = types.GenerateContentConfig(
            system_instruction=request.system_prompt or None,
            max_output_tokens=params.max_output_tokens,
            temperature=params.temperature,
            top_p=params.top_p,
            stop_sequences=params.stop_sequences,
        )

        resp = client.models.generate_content(model=model, contents=contents, config=config)

        usage = None
        meta = getattr(resp, "usage_metadata", None)
        if meta is not None and meta.prompt_token_count is not None:
            usage = TokenUsage(
                input_tokens=meta.prompt_token_count or 0,
                output_tokens=(meta.candidates_token_count or 0)
                + (getattr(meta, "thoughts_token_count", None) or 0),
            )
        finish_reason = None
        candidates = getattr(resp, "candidates", None) or []
        if candidates and getattr(candidates[0], "finish_reason", None) is not None:
            finish_reason = str(candidates[0].finish_reason)
        return ProviderResult(
            text=resp.text or "",
            usage=usage,
            finish_reason=finish_reason,
            response_id=getattr(resp, "response_id", None),
        )

    def _translate_error(self, exc: Exception) -> ProviderAPIError:
        provider = self.instance_name
        errors = importlib.import_module("google.genai.errors")
        if isinstance(exc, errors.APIError):
            code = getattr(exc, "code", None) or 0
            if code == 429:
                return ProviderRateLimitError(provider)
            if code in (401, 403):
                return ProviderAuthenticationError(provider)
            if code in (408, 504):
                return ProviderTimeoutError(provider)
            return ProviderAPIError(
                provider,
                f"HTTP {code}: {mask_secrets(getattr(exc, 'message', None) or str(exc))}",
                retryable=code >= 500,
                status_code=code or None,
            )
        # google-genai は httpx2（httpx のフォーク）を使う。どちらが入っていても判定できるようにする
        for module_name in ("httpx2", "httpx"):
            try:
                http = importlib.import_module(module_name)
            except ImportError:
                continue
            if isinstance(exc, http.TimeoutException):
                return ProviderTimeoutError(provider)
            if isinstance(exc, http.TransportError):
                return ProviderAPIError(provider, "接続エラー", retryable=True)
        if isinstance(exc, TimeoutError):
            return ProviderTimeoutError(provider)
        return ProviderAPIError(provider, f"{type(exc).__name__}: {mask_secrets(str(exc))}")
