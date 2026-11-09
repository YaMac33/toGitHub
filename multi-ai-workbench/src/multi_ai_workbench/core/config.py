"""設定管理。

- config/settings.yaml : アプリ・プロバイダー・エージェント・ワークフロー設定
- config/models.yaml   : モデルカタログ（モデルID・料金・コンテキスト長など）
- 環境変数 / .env      : APIキー（設定ファイルには書かない）

プロジェクトルートは環境変数 MULTI_AI_WORKBENCH_HOME で上書きできる。
未指定の場合はこのパッケージを含むリポジトリ（src/ の親）を使う。
"""

from __future__ import annotations

import importlib.util
import os
from pathlib import Path
from typing import Any, Literal

import yaml
from dotenv import load_dotenv
from pydantic import BaseModel, Field, SecretStr, ValidationError, model_validator

from multi_ai_workbench.core.exceptions import ConfigError
from multi_ai_workbench.core.models import GenerationParams, ModelInfo

HOME_ENV_VAR = "MULTI_AI_WORKBENCH_HOME"
SETTINGS_FILE = "settings.yaml"
MODELS_FILE = "models.yaml"

# プロバイダー名 → 公式SDKの import 名 / pip パッケージ名
PROVIDER_SDKS: dict[str, tuple[str, str]] = {
    "anthropic": ("anthropic", "anthropic"),
    "openai": ("openai", "openai"),
    "gemini": ("google.genai", "google-genai"),
}


def default_project_root() -> Path:
    env = os.environ.get(HOME_ENV_VAR)
    if env:
        return Path(env).expanduser().resolve()
    # src/multi_ai_workbench/core/config.py → parents[3] がプロジェクトルート
    return Path(__file__).resolve().parents[3]


# --------------------------------------------------------------------------
# settings.yaml のスキーマ
# --------------------------------------------------------------------------


class AppSettings(BaseModel):
    log_level: str = "INFO"
    log_file: str | None = "logs/multi-ai.log"
    usage_file: str = "logs/usage.jsonl"


class ProviderSettings(BaseModel):
    # 実装クラスの登録名。省略時は settings.yaml のキー名と同じ。
    # 例: キー "openai_sub" に type: openai を指定し、別キー・別既定モデルで併用できる
    type: str | None = None
    enabled: bool = True
    api_key_env: str | None = None  # None = APIキー不要（mock など）
    default_model: str
    timeout_seconds: float = Field(default=60.0, gt=0)
    max_retries: int = Field(default=2, ge=0, le=10)
    retry_base_delay_seconds: float = Field(default=1.0, ge=0)

    @property
    def requires_api_key(self) -> bool:
        return bool(self.api_key_env)


class AgentSettings(BaseModel):
    role: str | None = None
    provider: str
    model: str | None = None
    system_prompt: str | None = None
    description: str | None = None
    params: GenerationParams = Field(default_factory=GenerationParams)


class WorkflowStepSettings(BaseModel):
    name: str
    agent: str
    instruction: str


class WorkflowSettings(BaseModel):
    type: Literal["sequential", "parallel"]
    description: str | None = None
    # sequential
    steps: list[WorkflowStepSettings] = Field(default_factory=list)
    stop_on_failure: bool = True
    # parallel
    agents: list[str] = Field(default_factory=list)
    instruction: str = "{input}"
    max_workers: int = Field(default=4, ge=1, le=32)

    @model_validator(mode="after")
    def _check_shape(self) -> WorkflowSettings:
        if self.type == "sequential" and not self.steps:
            raise ValueError("sequential ワークフローには steps が必要です")
        if self.type == "parallel" and not self.agents:
            raise ValueError("parallel ワークフローには agents が必要です")
        return self


class ExternalAgentSettings(BaseModel):
    command: str
    description: str | None = None


class BudgetSettings(BaseModel):
    monthly_limit_usd: float | None = Field(default=None, ge=0)
    enforce: bool = False


class Settings(BaseModel):
    app: AppSettings = Field(default_factory=AppSettings)
    defaults: GenerationParams = Field(default_factory=GenerationParams)
    providers: dict[str, ProviderSettings] = Field(default_factory=dict)
    agents: dict[str, AgentSettings] = Field(default_factory=dict)
    workflows: dict[str, WorkflowSettings] = Field(default_factory=dict)
    external_agents: dict[str, ExternalAgentSettings] = Field(default_factory=dict)
    budget: BudgetSettings = Field(default_factory=BudgetSettings)

    # 読み込み時に設定される（YAML には書かない）
    project_root: Path = Field(default_factory=default_project_root, exclude=True)

    @model_validator(mode="after")
    def _check_references(self) -> Settings:
        for name, agent in self.agents.items():
            if agent.provider not in self.providers:
                raise ValueError(f"agents.{name}.provider '{agent.provider}' が providers に存在しません")
        for wf_name, wf in self.workflows.items():
            refs = [s.agent for s in wf.steps] + list(wf.agents)
            for ref in refs:
                if ref not in self.agents:
                    raise ValueError(f"workflows.{wf_name} が未定義のエージェント '{ref}' を参照しています")
        return self

    def resolve_path(self, relative: str) -> Path:
        path = Path(relative)
        return path if path.is_absolute() else self.project_root / path

    @property
    def usage_file_path(self) -> Path:
        return self.resolve_path(self.app.usage_file)

    @property
    def log_file_path(self) -> Path | None:
        return self.resolve_path(self.app.log_file) if self.app.log_file else None


# --------------------------------------------------------------------------
# models.yaml
# --------------------------------------------------------------------------


class ModelCatalog:
    """モデル情報の検索。プロバイダー名とモデルIDの組で一意。"""

    def __init__(self, models: list[ModelInfo]) -> None:
        self._models: dict[tuple[str, str], ModelInfo] = {}
        for m in models:
            key = (m.provider, m.id)
            if key in self._models:
                raise ConfigError(f"models.yaml でモデルが重複しています: {m.provider}/{m.id}")
            self._models[key] = m

    def get(self, provider: str, model_id: str) -> ModelInfo | None:
        return self._models.get((provider, model_id))

    def models(self, provider: str | None = None) -> list[ModelInfo]:
        return [m for m in self._models.values() if provider is None or m.provider == provider]

    def __len__(self) -> int:
        return len(self._models)


# --------------------------------------------------------------------------
# 読み込み
# --------------------------------------------------------------------------


def _read_yaml(path: Path) -> dict[str, Any]:
    if not path.is_file():
        raise ConfigError(f"設定ファイルが見つかりません: {path}")
    try:
        data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    except yaml.YAMLError as exc:
        raise ConfigError(f"YAML の構文エラー: {path}: {exc}") from exc
    if not isinstance(data, dict):
        raise ConfigError(f"設定ファイルの最上位はマッピングである必要があります: {path}")
    return data


def load_dotenv_file(project_root: Path) -> bool:
    """プロジェクトルートの .env を読み込む。既存の環境変数は上書きしない。"""
    env_path = project_root / ".env"
    if env_path.is_file():
        load_dotenv(env_path, override=False)
        return True
    return False


def load_settings(project_root: Path | None = None, *, load_env: bool = True) -> Settings:
    root = (project_root or default_project_root()).resolve()
    if load_env:
        load_dotenv_file(root)
    data = _read_yaml(root / "config" / SETTINGS_FILE)
    try:
        return Settings(**data, project_root=root)
    except ValidationError as exc:
        raise ConfigError(f"settings.yaml の内容が不正です:\n{exc}") from exc


def load_model_catalog(project_root: Path | None = None) -> ModelCatalog:
    root = (project_root or default_project_root()).resolve()
    data = _read_yaml(root / "config" / MODELS_FILE)
    raw_models = data.get("models") or []
    if not isinstance(raw_models, list):
        raise ConfigError("models.yaml の models はリストである必要があります")
    try:
        return ModelCatalog([ModelInfo(**m) for m in raw_models])
    except ValidationError as exc:
        raise ConfigError(f"models.yaml の内容が不正です:\n{exc}") from exc


# --------------------------------------------------------------------------
# APIキー・診断（API通信は一切行わない）
# --------------------------------------------------------------------------


def get_api_key(provider_settings: ProviderSettings) -> SecretStr | None:
    """環境変数から APIキーを取得する。空文字・空白のみは未設定扱い。"""
    if not provider_settings.api_key_env:
        return None
    value = os.environ.get(provider_settings.api_key_env, "").strip()
    return SecretStr(value) if value else None


def is_sdk_installed(provider_name: str) -> bool | None:
    """公式SDKの有無。SDK を必要としないプロバイダーは None。"""
    sdk = PROVIDER_SDKS.get(provider_name)
    if sdk is None:
        return None
    try:
        return importlib.util.find_spec(sdk[0]) is not None
    except ModuleNotFoundError:  # 親パッケージ (google) が無い場合
        return False


class ProviderDiagnosis(BaseModel):
    name: str
    enabled: bool
    api_key_env: str | None
    api_key_required: bool
    api_key_set: bool
    sdk_installed: bool | None
    default_model: str
    default_model_in_catalog: bool
    issues: list[str] = Field(default_factory=list)

    @property
    def available(self) -> bool:
        return (
            self.enabled
            and (self.api_key_set or not self.api_key_required)
            and self.sdk_installed is not False
        )


def diagnose_providers(settings: Settings, catalog: ModelCatalog) -> list[ProviderDiagnosis]:
    results: list[ProviderDiagnosis] = []
    for name, ps in settings.providers.items():
        key_set = get_api_key(ps) is not None
        provider_type = ps.type or name
        sdk = is_sdk_installed(provider_type)
        in_catalog = catalog.get(provider_type, ps.default_model) is not None
        issues: list[str] = []
        if not ps.enabled:
            issues.append("無効化されています")
        if ps.requires_api_key and not key_set:
            issues.append(f"{ps.api_key_env} が未設定")
        if sdk is False:
            issues.append(f"SDK '{PROVIDER_SDKS[provider_type][1]}' 未インストール")
        if not in_catalog:
            issues.append(f"default_model '{ps.default_model}' が models.yaml に未登録")
        else:
            info = catalog.get(provider_type, ps.default_model)
            if info and info.status in ("unverified", "placeholder"):
                issues.append(f"default_model は {info.status}（実在要確認）")
        results.append(
            ProviderDiagnosis(
                name=name,
                enabled=ps.enabled,
                api_key_env=ps.api_key_env,
                api_key_required=ps.requires_api_key,
                api_key_set=key_set,
                sdk_installed=sdk,
                default_model=ps.default_model,
                default_model_in_catalog=in_catalog,
                issues=issues,
            )
        )
    return results
