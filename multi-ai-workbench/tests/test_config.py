from __future__ import annotations

import os
from pathlib import Path

import pytest
import yaml

from multi_ai_workbench.core.config import (
    ProviderSettings,
    diagnose_providers,
    get_api_key,
    load_model_catalog,
    load_settings,
)
from multi_ai_workbench.core.exceptions import ConfigError
from multi_ai_workbench.core.models import ModelStatus

from conftest import PROJECT_ROOT


def _edit_yaml(path: Path, mutate) -> None:
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    mutate(data)
    path.write_text(yaml.safe_dump(data, allow_unicode=True), encoding="utf-8")


class TestLoadSettings:
    def test_repository_config_is_valid(self):
        settings = load_settings(PROJECT_ROOT, load_env=False)
        catalog = load_model_catalog(PROJECT_ROOT)
        assert {"anthropic", "openai", "gemini", "mock"} <= set(settings.providers)
        assert {"coding", "review", "research"} <= set(settings.agents)
        assert {"dev_pipeline", "multi_review"} <= set(settings.workflows)
        # 各プロバイダーの既定モデルがカタログに登録されている
        for name, ps in settings.providers.items():
            assert catalog.get(name, ps.default_model) is not None, name

    def test_no_api_key_values_in_config_files(self):
        for path in (PROJECT_ROOT / "config").glob("*.yaml"):
            text = path.read_text(encoding="utf-8")
            assert "sk-" not in text and "AIza" not in text, path

    def test_paths_resolved_against_project_root(self, settings, project_dir):
        assert settings.project_root == project_dir.resolve()
        assert settings.usage_file_path == project_dir.resolve() / "logs" / "usage.jsonl"

    def test_missing_settings_file(self, tmp_path):
        with pytest.raises(ConfigError, match="見つかりません"):
            load_settings(tmp_path, load_env=False)

    def test_invalid_yaml(self, project_dir):
        (project_dir / "config" / "settings.yaml").write_text("providers: [unclosed", encoding="utf-8")
        with pytest.raises(ConfigError, match="YAML"):
            load_settings(project_dir, load_env=False)

    def test_agent_with_unknown_provider_is_rejected(self, project_dir):
        _edit_yaml(
            project_dir / "config" / "settings.yaml",
            lambda d: d["agents"]["coding"].update(provider="unknown"),
        )
        with pytest.raises(ConfigError, match="unknown"):
            load_settings(project_dir, load_env=False)

    def test_workflow_with_unknown_agent_is_rejected(self, project_dir):
        _edit_yaml(
            project_dir / "config" / "settings.yaml",
            lambda d: d["workflows"]["dev_pipeline"]["steps"][0].update(agent="ghost"),
        )
        with pytest.raises(ConfigError, match="ghost"):
            load_settings(project_dir, load_env=False)

    def test_max_retries_upper_bound(self, project_dir):
        _edit_yaml(
            project_dir / "config" / "settings.yaml",
            lambda d: d["providers"]["openai"].update(max_retries=100),
        )
        with pytest.raises(ConfigError):
            load_settings(project_dir, load_env=False)

    def test_dotenv_is_loaded_without_overriding_existing_env(self, project_dir, isolated_env):
        (project_dir / ".env").write_text(
            "ANTHROPIC_API_KEY=from-dotenv-123456\nOPENAI_API_KEY=from-dotenv-abcdef\n", encoding="utf-8"
        )
        isolated_env["OPENAI_API_KEY"] = "from-env-xyz12345"
        load_settings(project_dir)
        assert os.environ["ANTHROPIC_API_KEY"] == "from-dotenv-123456"
        assert os.environ["OPENAI_API_KEY"] == "from-env-xyz12345"


class TestModelCatalog:
    def test_models_have_explicit_status(self, catalog):
        statuses = {m.provider: m.status for m in catalog.models()}
        assert statuses["mock"] == ModelStatus.OFFLINE
        # 確認できていないモデルは verified として扱わない
        for m in catalog.models("openai") + catalog.models("gemini"):
            assert m.status == ModelStatus.UNVERIFIED

    def test_unset_price_is_not_zero(self, catalog):
        claude = catalog.get("anthropic", "claude-sonnet-5-5")
        assert claude.input_price_per_mtok is None
        assert claude.pricing_configured is False
        mock = catalog.get("mock", "mock-echo")
        assert mock.pricing_configured is True

    def test_duplicate_model_rejected(self, project_dir):
        path = project_dir / "config" / "models.yaml"
        _edit_yaml(path, lambda d: d["models"].append(dict(d["models"][0])))
        with pytest.raises(ConfigError, match="重複"):
            load_model_catalog(project_dir)

    def test_negative_price_rejected(self, project_dir):
        path = project_dir / "config" / "models.yaml"
        _edit_yaml(path, lambda d: d["models"][0].update(input_price_per_mtok=-1))
        with pytest.raises(ConfigError):
            load_model_catalog(project_dir)


class TestApiKeys:
    def test_unset_and_blank_keys_are_none(self, isolated_env):
        ps = ProviderSettings(api_key_env="ANTHROPIC_API_KEY", default_model="m")
        assert get_api_key(ps) is None
        isolated_env["ANTHROPIC_API_KEY"] = "   "
        assert get_api_key(ps) is None

    def test_key_is_secret(self, isolated_env):
        isolated_env["ANTHROPIC_API_KEY"] = "sk-ant-secret-value-123"
        key = get_api_key(ProviderSettings(api_key_env="ANTHROPIC_API_KEY", default_model="m"))
        assert key.get_secret_value() == "sk-ant-secret-value-123"
        assert "secret-value" not in repr(key) and "secret-value" not in str(key)

    def test_provider_without_key_env_needs_no_key(self):
        ps = ProviderSettings(api_key_env=None, default_model="mock-echo")
        assert ps.requires_api_key is False
        assert get_api_key(ps) is None


class TestDiagnosis:
    def test_without_any_keys(self, settings, catalog):
        result = {d.name: d for d in diagnose_providers(settings, catalog)}
        for name in ("anthropic", "openai", "gemini"):
            assert result[name].api_key_set is False
            assert result[name].available is False
            assert any("未設定" in i for i in result[name].issues)
        assert result["mock"].available is True
        assert result["mock"].api_key_required is False

    def test_with_key(self, settings, catalog, isolated_env):
        isolated_env["ANTHROPIC_API_KEY"] = "sk-ant-dummy-for-test"
        result = {d.name: d for d in diagnose_providers(settings, catalog)}
        assert result["anthropic"].available is True
        assert result["openai"].available is False

    def test_unverified_default_model_is_reported(self, settings, catalog):
        result = {d.name: d for d in diagnose_providers(settings, catalog)}
        assert any("unverified" in i for i in result["openai"].issues)

    def test_disabled_provider(self, project_dir, catalog, isolated_env):
        _edit_yaml(
            project_dir / "config" / "settings.yaml",
            lambda d: d["providers"]["anthropic"].update(enabled=False),
        )
        isolated_env["ANTHROPIC_API_KEY"] = "sk-ant-dummy-for-test"
        settings = load_settings(project_dir, load_env=False)
        result = {d.name: d for d in diagnose_providers(settings, catalog)}
        assert result["anthropic"].available is False
