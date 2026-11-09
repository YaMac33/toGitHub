"""APIを呼ばないオフライン用プロバイダー。

APIキーなしで ask / ワークフローの流れを確認するためのもの。
トークン数は文字数から推定され、利用記録には usage_source=estimated として残る。
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from multi_ai_workbench.core.models import GenerationParams, GenerationRequest
from multi_ai_workbench.providers.base import BaseProvider, ProviderResult
from multi_ai_workbench.providers.registry import register_provider

Responder = Callable[[GenerationRequest, str], str]

PREVIEW_CHARS = 200


def echo_responder(request: GenerationRequest, model: str) -> str:
    last = request.to_messages()[-1].content
    preview = last if len(last) <= PREVIEW_CHARS else last[:PREVIEW_CHARS] + "..."
    return f"[mock:{model}] 受信したプロンプト（{len(last)}文字）:\n{preview}"


@register_provider
class MockProvider(BaseProvider):
    name = "mock"

    def __init__(self, *args: Any, responder: Responder | None = None, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self.responder = responder or echo_responder
        self.requests: list[GenerationRequest] = []

    def _create_client(self, api_key: str | None) -> Any:
        return object()

    def _call(
        self,
        client: Any,
        request: GenerationRequest,
        model: str,
        params: GenerationParams,
    ) -> ProviderResult:
        self.requests.append(request)
        return ProviderResult(text=self.responder(request, model), finish_reason="mock")
