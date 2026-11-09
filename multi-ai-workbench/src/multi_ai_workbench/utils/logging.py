"""ログ設定と機密情報のマスキング。

APIキーは2段構えで隠す:
1. register_secret() で登録された実際のキー文字列を完全一致で置換
2. 各社キーの典型的な形式を正規表現で置換（登録漏れ対策）
ログの Formatter と、ユーザーに表示する例外メッセージの両方で使う。
"""

from __future__ import annotations

import logging
import re
import threading
from logging.handlers import RotatingFileHandler
from pathlib import Path

MASK = "***"

_SECRET_PATTERNS = [
    re.compile(r"sk-ant-[A-Za-z0-9_\-]{8,}"),  # Anthropic
    re.compile(r"sk-(?:proj-)?[A-Za-z0-9_\-]{16,}"),  # OpenAI
    re.compile(r"AIza[0-9A-Za-z_\-]{20,}"),  # Google
    re.compile(r"(?i)(bearer\s+)[A-Za-z0-9._\-]{16,}"),
    re.compile(r"(?i)((?:x-api-key|api[_-]?key)[\"']?\s*[:=]\s*[\"']?)[^\s\"',}]{8,}"),
]

_registered: set[str] = set()
_lock = threading.Lock()


def register_secret(value: str | None) -> None:
    """マスク対象の文字列を登録する。短すぎる値は誤置換を避けるため無視する。"""
    if value and len(value) >= 8:
        with _lock:
            _registered.add(value)


def mask_secrets(text: str) -> str:
    if not text:
        return text
    with _lock:
        secrets = sorted(_registered, key=len, reverse=True)
    for secret in secrets:
        text = text.replace(secret, MASK)
    for pattern in _SECRET_PATTERNS:
        if pattern.groups:
            text = pattern.sub(lambda m: m.group(1) + MASK, text)
        else:
            text = pattern.sub(MASK, text)
    return text


class SecretMaskingFormatter(logging.Formatter):
    """整形後の文字列全体（例外トレースバック含む）をマスクする。"""

    def format(self, record: logging.LogRecord) -> str:
        return mask_secrets(super().format(record))


_FORMAT = "%(asctime)s %(levelname)s %(name)s: %(message)s"
_HANDLER_MARK = "_multi_ai_workbench_handler"


def setup_logging(
    level: str = "INFO",
    log_file: Path | None = None,
    *,
    console_level: str = "WARNING",
) -> logging.Logger:
    """パッケージのロガーを設定する。複数回呼んでもハンドラは重複しない。

    コンソール(stderr)には console_level 以上のみを出し、CLI の出力を汚さない。
    詳細はログファイルへ（ローテーションあり）。
    """
    logger = logging.getLogger("multi_ai_workbench")
    logger.setLevel(getattr(logging, level.upper(), logging.INFO))
    logger.propagate = False

    for handler in list(logger.handlers):
        if getattr(handler, _HANDLER_MARK, False):
            logger.removeHandler(handler)
            handler.close()

    formatter = SecretMaskingFormatter(_FORMAT)

    console = logging.StreamHandler()
    console.setLevel(getattr(logging, console_level.upper(), logging.WARNING))
    console.setFormatter(formatter)
    setattr(console, _HANDLER_MARK, True)
    logger.addHandler(console)

    if log_file is not None:
        log_file.parent.mkdir(parents=True, exist_ok=True)
        file_handler = RotatingFileHandler(
            log_file, maxBytes=1_000_000, backupCount=3, encoding="utf-8"
        )
        file_handler.setFormatter(formatter)
        setattr(file_handler, _HANDLER_MARK, True)
        logger.addHandler(file_handler)

    return logger


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name if name.startswith("multi_ai_workbench") else f"multi_ai_workbench.{name}")
