"""共通フィクスチャ。

- 全テストで APIキーの環境変数を取り除き、実際のAPI呼び出しが起こらないようにする
- 実プロジェクトの config/ を一時ディレクトリへコピーして使い、logs/ を汚さない
"""

from __future__ import annotations

import logging
import os
import shutil
from collections.abc import Callable, Iterator
from pathlib import Path

import pytest
import yaml

from multi_ai_workbench.core.config import (
    ModelCatalog,
    Settings,
    load_model_catalog,
    load_settings,
)
from multi_ai_workbench.core.models import (
    CostEstimate,
    GenerationRequest,
    GenerationResponse,
    TokenUsage,
)

PROJECT_ROOT = Path(__file__).resolve().parents[1]
API_KEY_ENVS = ("ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GEMINI_API_KEY")


@pytest.fixture(autouse=True)
def isolated_env(monkeypatch: pytest.MonkeyPatch) -> dict[str, str]:
    """os.environ をキー抜きのコピーに差し替える（.env 読み込みの副作用もテスト内に閉じる）。"""
    env = {k: v for k, v in os.environ.items() if k not in API_KEY_ENVS and k != "MULTI_AI_WORKBENCH_HOME"}
    monkeypatch.setattr(os, "environ", env)
    return env


@pytest.fixture(autouse=True)
def _close_log_handlers() -> Iterator[None]:
    yield
    logger = logging.getLogger("multi_ai_workbench")
    for handler in list(logger.handlers):
        logger.removeHandler(handler)
        handler.close()


@pytest.fixture
def project_dir(tmp_path: Path) -> Path:
    """実プロジェクトの設定をコピーした一時プロジェクト。"""
    shutil.copytree(PROJECT_ROOT / "config", tmp_path / "config")
    return tmp_path


@pytest.fixture
def settings(project_dir: Path) -> Settings:
    return load_settings(project_dir, load_env=False)


@pytest.fixture
def catalog(project_dir: Path) -> ModelCatalog:
    return load_model_catalog(project_dir)


@pytest.fixture
def priced_catalog(project_dir: Path) -> ModelCatalog:
    """料金計算の検証用に、各社のテスト用モデルへ単価を設定したカタログ。"""
    path = project_dir / "config" / "models.yaml"
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    data["models"] += [
        {"id": "test-priced", "provider": p, "status": "placeholder",
         "input_price_per_mtok": 3.0, "output_price_per_mtok": 15.0}
        for p in ("anthropic", "openai", "gemini")
    ]
    path.write_text(yaml.safe_dump(data, allow_unicode=True), encoding="utf-8")
    return load_model_catalog(project_dir)


Handler = Callable[[GenerationRequest], str]


class FakeProvider:
    """LLMProvider プロトコルを満たすテスト用プロバイダー。handler が例外を投げれば失敗を再現できる。"""

    def __init__(
        self,
        name: str = "fake",
        default_model: str = "fake-model",
        handler: Handler | None = None,
    ) -> None:
        self.name = name
        self._default_model = default_model
        self.handler = handler or (lambda req: f"{name}-output")
        self.requests: list[GenerationRequest] = []

    @property
    def default_model(self) -> str:
        return self._default_model

    def is_configured(self) -> bool:
        return True

    def generate(self, request: GenerationRequest) -> GenerationResponse:
        self.requests.append(request)
        text = self.handler(request)
        return GenerationResponse(
            provider=self.name,
            model=request.model or self.default_model,
            text=text,
            usage=TokenUsage(input_tokens=10, output_tokens=5),
            cost=CostEstimate(total_usd=0.001, pricing_configured=True),
            task_id=request.task_id,
        )


@pytest.fixture
def fake_provider_factory() -> Callable[..., FakeProvider]:
    return FakeProvider
