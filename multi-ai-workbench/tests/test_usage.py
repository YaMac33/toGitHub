from __future__ import annotations

from datetime import datetime, timezone

import pytest

from multi_ai_workbench.core.config import BudgetSettings
from multi_ai_workbench.core.exceptions import BudgetExceededError
from multi_ai_workbench.core.models import ModelInfo, TokenUsage, UsageSource
from multi_ai_workbench.core.usage import (
    BudgetGuard,
    InMemoryUsageStore,
    JsonlUsageStore,
    UsageRecord,
    UsageStatus,
    calculate_cost,
    estimate_tokens,
    monthly_spend_usd,
    summarize_usage,
)


def _model(inp, out) -> ModelInfo:
    return ModelInfo(id="m", provider="p", input_price_per_mtok=inp, output_price_per_mtok=out)


def _record(**kw) -> UsageRecord:
    base = dict(provider="anthropic", model="m1", input_tokens=100, output_tokens=50, cost_usd=0.01, pricing_configured=True)
    base.update(kw)
    return UsageRecord(**base)


class TestCost:
    def test_calculation(self):
        cost = calculate_cost(TokenUsage(input_tokens=1000, output_tokens=500), _model(3.0, 15.0))
        assert cost.pricing_configured
        assert cost.input_cost_usd == pytest.approx(0.003)
        assert cost.output_cost_usd == pytest.approx(0.0075)
        assert cost.total_usd == pytest.approx(0.0105)
        assert cost.display() == "$0.010500"

    @pytest.mark.parametrize("model", [None, _model(None, None), _model(3.0, None)])
    def test_unset_pricing_is_not_zero(self, model):
        cost = calculate_cost(TokenUsage(input_tokens=1000, output_tokens=500), model)
        assert cost.pricing_configured is False
        assert cost.total_usd is None
        assert cost.display() == "料金未設定"

    def test_explicit_zero_price_is_configured(self):
        cost = calculate_cost(TokenUsage(input_tokens=1000, output_tokens=500), _model(0.0, 0.0))
        assert cost.pricing_configured is True
        assert cost.total_usd == 0.0


class TestEstimateTokens:
    def test_empty(self):
        assert estimate_tokens("") == 0

    def test_ascii(self):
        assert estimate_tokens("abcdefgh") == 2

    def test_japanese_counts_per_char(self):
        assert estimate_tokens("日本語") == 3


class TestStores:
    def test_jsonl_roundtrip(self, tmp_path):
        store = JsonlUsageStore(tmp_path / "logs" / "usage.jsonl")
        assert store.load() == []
        store.append(_record(task_id="t1"))
        store.append(_record(task_id="t2", status=UsageStatus.ERROR, error_type="X"))
        records = store.load()
        assert [r.task_id for r in records] == ["t1", "t2"]
        assert records[1].status == UsageStatus.ERROR

    def test_jsonl_skips_corrupted_lines(self, tmp_path):
        path = tmp_path / "usage.jsonl"
        store = JsonlUsageStore(path)
        store.append(_record(task_id="ok"))
        with path.open("a", encoding="utf-8") as f:
            f.write("{broken json\n")
        store.append(_record(task_id="ok2"))
        assert [r.task_id for r in store.load()] == ["ok", "ok2"]

    def test_record_keeps_reported_vs_estimated(self, tmp_path):
        store = JsonlUsageStore(tmp_path / "u.jsonl")
        store.append(_record(usage_source=UsageSource.ESTIMATED))
        assert store.load()[0].usage_source == UsageSource.ESTIMATED


class TestSummary:
    def test_group_by_month_provider_model(self):
        nov = datetime(2026, 11, 1, tzinfo=timezone.utc)
        oct_ = datetime(2026, 10, 1, tzinfo=timezone.utc)
        records = [
            _record(timestamp=nov),
            _record(timestamp=nov),
            _record(timestamp=nov, provider="openai", model="g", cost_usd=None, pricing_configured=False),
            _record(timestamp=oct_),
            _record(timestamp=nov, status=UsageStatus.ERROR, input_tokens=0, output_tokens=0, cost_usd=None),
        ]
        summaries = {tuple(s.group.values()): s for s in summarize_usage(records)}
        claude_nov = summaries[("2026-11", "anthropic", "m1")]
        assert claude_nov.calls == 3 and claude_nov.errors == 1
        assert claude_nov.input_tokens == 200
        assert claude_nov.priced_cost_usd == pytest.approx(0.02)
        assert summaries[("2026-11", "openai", "g")].cost_display() == "料金未設定"
        assert ("2026-10", "anthropic", "m1") in summaries

    def test_mixed_priced_and_unpriced(self):
        records = [_record(), _record(cost_usd=None, pricing_configured=False)]
        (summary,) = summarize_usage(records, ["provider"])
        assert summary.unpriced_calls == 1
        assert "料金未設定 1件" in summary.cost_display()

    def test_model_key_is_qualified_without_provider(self):
        (summary,) = summarize_usage([_record()], ["model"])
        assert summary.group == {"model": "anthropic/m1"}


class TestBudget:
    def test_not_enforced_by_default(self):
        store = InMemoryUsageStore()
        store.append(_record(cost_usd=100.0))
        BudgetGuard(BudgetSettings(monthly_limit_usd=1.0), store).check()

    def test_enforced_limit(self):
        now = datetime(2026, 11, 9, tzinfo=timezone.utc)
        store = InMemoryUsageStore()
        store.append(_record(timestamp=now, cost_usd=0.6))
        store.append(_record(timestamp=datetime(2026, 10, 9, tzinfo=timezone.utc), cost_usd=5.0))
        guard = BudgetGuard(BudgetSettings(monthly_limit_usd=1.0, enforce=True), store)
        guard.check(now)  # 今月は 0.6 < 1.0
        store.append(_record(timestamp=now, cost_usd=0.5))
        assert monthly_spend_usd(store.load(), "2026-11") == pytest.approx(1.1)
        with pytest.raises(BudgetExceededError):
            guard.check(now)
