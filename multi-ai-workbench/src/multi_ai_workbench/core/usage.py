"""トークン使用量・利用料金の計算と記録。

- calculate_cost   : models.yaml の単価から推定料金を算出（単価未設定なら「料金未設定」）
- estimate_tokens  : APIが使用量を返さない場合の概算（UsageSource.ESTIMATED として区別）
- JsonlUsageStore  : 利用記録を JSON Lines で追記保存
- summarize_usage  : 月別・プロバイダー別・モデル別などで集計
- BudgetGuard      : 月間上限の確認（settings.yaml の budget.enforce で有効化）
"""

from __future__ import annotations

import json
import math
import threading
from collections.abc import Iterable, Sequence
from datetime import datetime
from enum import StrEnum
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field

from multi_ai_workbench.core.config import BudgetSettings
from multi_ai_workbench.core.exceptions import BudgetExceededError
from multi_ai_workbench.core.interfaces import UsageStore
from multi_ai_workbench.core.models import (
    CostEstimate,
    ModelInfo,
    TokenUsage,
    UsageSource,
    utc_now,
)
from multi_ai_workbench.utils.logging import get_logger

logger = get_logger(__name__)

TOKENS_PER_MILLION = 1_000_000


def calculate_cost(usage: TokenUsage, model: ModelInfo | None) -> CostEstimate:
    if model is None or not model.pricing_configured:
        return CostEstimate(pricing_configured=False)
    assert model.input_price_per_mtok is not None and model.output_price_per_mtok is not None
    input_cost = usage.input_tokens * model.input_price_per_mtok / TOKENS_PER_MILLION
    output_cost = usage.output_tokens * model.output_price_per_mtok / TOKENS_PER_MILLION
    return CostEstimate(
        input_cost_usd=input_cost,
        output_cost_usd=output_cost,
        total_usd=input_cost + output_cost,
        pricing_configured=True,
    )


def estimate_tokens(text: str) -> int:
    """非常に粗いトークン数推定。

    英語は約4文字/トークン、日本語などは約1文字/トークンとして混在文を概算する。
    実測値ではないため、必ず UsageSource.ESTIMATED と組み合わせて使う。
    """
    if not text:
        return 0
    ascii_chars = sum(1 for c in text if c.isascii())
    other_chars = len(text) - ascii_chars
    return max(1, math.ceil(ascii_chars / 4 + other_chars))


class UsageStatus(StrEnum):
    SUCCESS = "success"
    ERROR = "error"


class UsageRecord(BaseModel):
    timestamp: datetime = Field(default_factory=utc_now)
    provider: str
    model: str
    task_id: str | None = None
    input_tokens: int = 0
    output_tokens: int = 0
    usage_source: UsageSource = UsageSource.REPORTED
    cost_usd: float | None = None  # None = 料金未設定（0 とは区別）
    pricing_configured: bool = False
    status: UsageStatus = UsageStatus.SUCCESS
    error_type: str | None = None
    latency_ms: int | None = None

    @property
    def month(self) -> str:
        return self.timestamp.strftime("%Y-%m")

    def cost_display(self) -> str:
        if self.status == UsageStatus.ERROR:
            return "-"
        if self.cost_usd is None:
            return "料金未設定"
        return f"${self.cost_usd:.6f}"


class JsonlUsageStore:
    """1行1レコードの JSON Lines。追記のみなので壊れにくく、集計も容易。"""

    def __init__(self, path: Path) -> None:
        self.path = path
        self._lock = threading.Lock()

    def append(self, record: UsageRecord) -> None:
        line = record.model_dump_json()
        with self._lock:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            with self.path.open("a", encoding="utf-8") as f:
                f.write(line + "\n")

    def load(self) -> list[UsageRecord]:
        if not self.path.is_file():
            return []
        records: list[UsageRecord] = []
        with self.path.open(encoding="utf-8") as f:
            for lineno, line in enumerate(f, start=1):
                line = line.strip()
                if not line:
                    continue
                try:
                    records.append(UsageRecord.model_validate_json(line))
                except ValueError:
                    logger.warning("利用記録の %d 行目を読み込めませんでした（スキップ）", lineno)
        return records


class InMemoryUsageStore:
    """テスト・一時利用向け。"""

    def __init__(self) -> None:
        self.records: list[UsageRecord] = []
        self._lock = threading.Lock()

    def append(self, record: UsageRecord) -> None:
        with self._lock:
            self.records.append(record)

    def load(self) -> list[UsageRecord]:
        with self._lock:
            return list(self.records)


# --------------------------------------------------------------------------
# 集計
# --------------------------------------------------------------------------

GroupKey = Literal["month", "provider", "model"]


class UsageSummary(BaseModel):
    group: dict[str, str]
    calls: int = 0
    errors: int = 0
    input_tokens: int = 0
    output_tokens: int = 0
    estimated_token_calls: int = 0  # トークン数が推定値だった呼び出し数
    priced_cost_usd: float = 0.0  # 料金設定済みの呼び出しの合計
    unpriced_calls: int = 0  # 料金未設定の成功呼び出し数

    def cost_display(self) -> str:
        if self.calls - self.errors == 0:
            return "-"
        if self.unpriced_calls == self.calls - self.errors:
            return "料金未設定"
        text = f"${self.priced_cost_usd:.6f}"
        if self.unpriced_calls:
            text += f" (+料金未設定 {self.unpriced_calls}件)"
        return text


def _group_value(record: UsageRecord, key: GroupKey, group_by: Sequence[GroupKey]) -> str:
    if key == "month":
        return record.month
    if key == "provider":
        return record.provider
    # モデルIDはプロバイダー間で重複し得るため、provider で分けていない場合は修飾する
    return record.model if "provider" in group_by else f"{record.provider}/{record.model}"


def summarize_usage(
    records: Iterable[UsageRecord],
    group_by: Sequence[GroupKey] = ("month", "provider", "model"),
) -> list[UsageSummary]:
    buckets: dict[tuple[str, ...], UsageSummary] = {}
    for r in records:
        values = tuple(_group_value(r, k, group_by) for k in group_by)
        summary = buckets.get(values)
        if summary is None:
            summary = UsageSummary(group=dict(zip(group_by, values)))
            buckets[values] = summary
        summary.calls += 1
        if r.status == UsageStatus.ERROR:
            summary.errors += 1
            continue
        summary.input_tokens += r.input_tokens
        summary.output_tokens += r.output_tokens
        if r.usage_source == UsageSource.ESTIMATED:
            summary.estimated_token_calls += 1
        if r.cost_usd is None:
            summary.unpriced_calls += 1
        else:
            summary.priced_cost_usd += r.cost_usd
    return [buckets[k] for k in sorted(buckets)]


def monthly_spend_usd(records: Iterable[UsageRecord], month: str) -> float:
    return sum(
        r.cost_usd for r in records if r.month == month and r.cost_usd is not None
    )


class BudgetGuard:
    """月間の推定利用料金が上限に達していれば API 呼び出し前に止める。

    料金未設定の呼び出しは合計に含められないため、上限管理を厳密に行うには
    models.yaml の単価設定が前提となる。
    """

    def __init__(self, settings: BudgetSettings, store: UsageStore) -> None:
        self.settings = settings
        self.store = store

    def check(self, now: datetime | None = None) -> None:
        limit = self.settings.monthly_limit_usd
        if not self.settings.enforce or limit is None:
            return
        month = (now or utc_now()).strftime("%Y-%m")
        spent = monthly_spend_usd(self.store.load(), month)
        if spent >= limit:
            raise BudgetExceededError(spent, limit)
