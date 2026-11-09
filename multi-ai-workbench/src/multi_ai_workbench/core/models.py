"""プロバイダー横断で使うデータモデル。

プロバイダー固有の型はここに持ち込まず、各 provider 実装で
これらの共通モデルへ変換する。
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, Field, model_validator


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Role(StrEnum):
    USER = "user"
    ASSISTANT = "assistant"


class Message(BaseModel):
    role: Role
    content: str


class GenerationParams(BaseModel):
    """生成パラメータ。None はプロバイダー既定値を使うことを意味する。"""

    max_output_tokens: int | None = Field(default=None, gt=0)
    temperature: float | None = Field(default=None, ge=0.0, le=2.0)
    top_p: float | None = Field(default=None, gt=0.0, le=1.0)
    stop_sequences: list[str] | None = None

    def merged_over(self, base: GenerationParams) -> GenerationParams:
        """self の非 None 値で base を上書きした新しいインスタンスを返す。"""
        data = base.model_dump()
        data.update({k: v for k, v in self.model_dump().items() if v is not None})
        return GenerationParams(**data)


class GenerationRequest(BaseModel):
    """テキスト生成リクエスト。prompt か messages のどちらかを指定する。"""

    prompt: str | None = None
    messages: list[Message] | None = None
    system_prompt: str | None = None
    model: str | None = None  # None ならプロバイダーの default_model
    params: GenerationParams = Field(default_factory=GenerationParams)
    task_id: str | None = None

    @model_validator(mode="after")
    def _require_input(self) -> GenerationRequest:
        if not self.prompt and not self.messages:
            raise ValueError("prompt か messages のどちらかを指定してください")
        return self

    def to_messages(self) -> list[Message]:
        msgs = list(self.messages or [])
        if self.prompt:
            msgs.append(Message(role=Role.USER, content=self.prompt))
        return msgs


class UsageSource(StrEnum):
    REPORTED = "reported"  # APIレスポンスが返した実測値
    ESTIMATED = "estimated"  # 文字数などからの推定値
    UNAVAILABLE = "unavailable"  # 取得不能（エラー時など）


class TokenUsage(BaseModel):
    input_tokens: int = Field(default=0, ge=0)
    output_tokens: int = Field(default=0, ge=0)
    source: UsageSource = UsageSource.REPORTED

    @property
    def total_tokens(self) -> int:
        return self.input_tokens + self.output_tokens


class CostEstimate(BaseModel):
    """モデル単価から計算した推定料金 (USD)。

    pricing_configured が False のとき total_usd は None。
    「料金未設定」と「0ドル」を区別するため、0 で埋めないこと。
    """

    input_cost_usd: float | None = None
    output_cost_usd: float | None = None
    total_usd: float | None = None
    pricing_configured: bool = False
    currency: Literal["USD"] = "USD"

    def display(self) -> str:
        if not self.pricing_configured or self.total_usd is None:
            return "料金未設定"
        return f"${self.total_usd:.6f}"


class ModelStatus(StrEnum):
    VERIFIED = "verified"
    UNVERIFIED = "unverified"
    PLACEHOLDER = "placeholder"
    OFFLINE = "offline"


class ModelInfo(BaseModel):
    """config/models.yaml の1エントリ。"""

    id: str
    provider: str
    display_name: str | None = None
    status: ModelStatus = ModelStatus.UNVERIFIED
    input_price_per_mtok: float | None = Field(default=None, ge=0)
    output_price_per_mtok: float | None = Field(default=None, ge=0)
    context_window: int | None = Field(default=None, gt=0)
    max_output_tokens: int | None = Field(default=None, gt=0)
    capabilities: list[str] = Field(default_factory=list)
    notes: str | None = None

    @property
    def pricing_configured(self) -> bool:
        return self.input_price_per_mtok is not None and self.output_price_per_mtok is not None


class GenerationResponse(BaseModel):
    provider: str
    model: str
    text: str
    usage: TokenUsage
    cost: CostEstimate
    finish_reason: str | None = None
    response_id: str | None = None
    latency_ms: int | None = None
    task_id: str | None = None
    model_in_catalog: bool = True
    created_at: datetime = Field(default_factory=utc_now)
