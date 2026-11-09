"""APIプロバイダー。モジュールの import 時に registry へ自動登録される。

公式SDKはここでは import しない（API呼び出し時に遅延 import）。
"""

from multi_ai_workbench.providers import (  # noqa: F401  登録のための import
    anthropic_provider,
    gemini_provider,
    mock_provider,
    openai_provider,
)
from multi_ai_workbench.providers.base import BaseProvider, ProviderResult
from multi_ai_workbench.providers.registry import (
    create_provider,
    get_provider_class,
    register_provider,
    registered_provider_types,
)

__all__ = [
    "BaseProvider",
    "ProviderResult",
    "create_provider",
    "get_provider_class",
    "register_provider",
    "registered_provider_types",
]
