"""プロバイダー実装の登録と生成。

新しいプロバイダーを追加する手順:
  1. BaseProvider を継承したクラスを作り @register_provider を付ける
  2. providers/__init__.py でそのモジュールを import する
  3. config/settings.yaml の providers と config/models.yaml にエントリを追加する
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, TypeVar

from multi_ai_workbench.core.exceptions import ProviderNotFoundError

if TYPE_CHECKING:
    from multi_ai_workbench.core.config import ModelCatalog, Settings
    from multi_ai_workbench.core.interfaces import UsageStore
    from multi_ai_workbench.core.usage import BudgetGuard
    from multi_ai_workbench.providers.base import BaseProvider

P = TypeVar("P", bound="type[BaseProvider]")

_REGISTRY: dict[str, type[BaseProvider]] = {}


def register_provider(cls: P) -> P:
    _REGISTRY[cls.name] = cls
    return cls


def get_provider_class(provider_type: str) -> type[BaseProvider]:
    try:
        return _REGISTRY[provider_type]
    except KeyError:
        raise ProviderNotFoundError(provider_type, registered_provider_types()) from None


def registered_provider_types() -> list[str]:
    return sorted(_REGISTRY)


def create_provider(
    name: str,
    settings: Settings,
    *,
    catalog: ModelCatalog | None = None,
    usage_store: UsageStore | None = None,
    budget_guard: BudgetGuard | None = None,
    **kwargs: Any,
) -> BaseProvider:
    """settings.yaml の providers.<name> からプロバイダーを生成する（API通信はしない）。"""
    if name not in settings.providers:
        raise ProviderNotFoundError(name, sorted(settings.providers))
    ps = settings.providers[name]
    cls = get_provider_class(ps.type or name)
    return cls(
        ps,
        instance_name=name,
        catalog=catalog,
        usage_store=usage_store,
        budget_guard=budget_guard,
        defaults=settings.defaults,
        **kwargs,
    )
