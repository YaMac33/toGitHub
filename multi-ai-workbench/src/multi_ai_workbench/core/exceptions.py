"""Multi AI Workbench の例外階層。

すべての例外は WorkbenchError を継承するため、呼び出し側は
``except WorkbenchError`` でまとめて捕捉できる。
メッセージには APIキーを含めないこと（プロバイダー層で mask_secrets 済み）。
"""

from __future__ import annotations


class WorkbenchError(Exception):
    """基底例外。"""


class ConfigError(WorkbenchError):
    """設定ファイルの欠落・不正。"""


class ProviderNotFoundError(WorkbenchError):
    def __init__(self, name: str, available: list[str] | None = None) -> None:
        hint = f"（登録済み: {', '.join(available)}）" if available else ""
        super().__init__(f"プロバイダー '{name}' は登録されていません{hint}")
        self.name = name


class ProviderDisabledError(WorkbenchError):
    def __init__(self, name: str) -> None:
        super().__init__(
            f"プロバイダー '{name}' は無効化されています（config/settings.yaml の enabled を確認）"
        )
        self.name = name


class AgentNotFoundError(WorkbenchError):
    def __init__(self, name: str, available: list[str] | None = None) -> None:
        hint = f"（定義済み: {', '.join(available)}）" if available else ""
        super().__init__(f"エージェント '{name}' は定義されていません{hint}")
        self.name = name


class MissingAPIKeyError(WorkbenchError):
    """APIキー未設定。API呼び出しが必要な処理でのみ送出される。"""

    def __init__(self, provider: str, env_var: str) -> None:
        super().__init__(
            f"{provider} のAPIキーが未設定です。環境変数 {env_var} を設定してください"
            f"（.env.example を .env にコピーして記入できます）。"
        )
        self.provider = provider
        self.env_var = env_var


class ProviderSDKNotInstalledError(WorkbenchError):
    def __init__(self, provider: str, package: str) -> None:
        super().__init__(
            f"{provider} のSDK '{package}' がインストールされていません"
            f"（pip install {package}）"
        )
        self.provider = provider
        self.package = package


class ProviderAPIError(WorkbenchError):
    """プロバイダーAPI呼び出しの失敗。

    retryable が True のものだけが BaseProvider のリトライ対象になる。
    """

    def __init__(
        self,
        provider: str,
        message: str,
        *,
        retryable: bool = False,
        status_code: int | None = None,
    ) -> None:
        super().__init__(f"[{provider}] {message}")
        self.provider = provider
        self.retryable = retryable
        self.status_code = status_code


class ProviderAuthenticationError(ProviderAPIError):
    def __init__(self, provider: str, message: str = "認証に失敗しました（APIキーを確認）") -> None:
        super().__init__(provider, message, retryable=False, status_code=401)


class ProviderRateLimitError(ProviderAPIError):
    def __init__(self, provider: str, message: str = "レート制限に達しました") -> None:
        super().__init__(provider, message, retryable=True, status_code=429)


class ProviderTimeoutError(ProviderAPIError):
    def __init__(self, provider: str, message: str = "タイムアウトしました") -> None:
        super().__init__(provider, message, retryable=True)


class BudgetExceededError(WorkbenchError):
    def __init__(self, spent_usd: float, limit_usd: float) -> None:
        super().__init__(
            f"今月の推定利用料金 ${spent_usd:.4f} が上限 ${limit_usd:.4f} に達しています"
        )
        self.spent_usd = spent_usd
        self.limit_usd = limit_usd


class WorkflowError(WorkbenchError):
    """ワークフロー定義の不正など。"""
