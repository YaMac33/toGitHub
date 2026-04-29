from __future__ import annotations

import datetime as dt
import html
import re
from dataclasses import dataclass
from typing import Any
from urllib.parse import parse_qs, urlparse

import requests
from bs4 import BeautifulSoup


class MinuteFetchError(RuntimeError):
    """Raised when a minutes page cannot be converted into raw text."""


@dataclass
class FetchResult:
    source_url: str
    fetched_at: str
    raw_text: str
    html: str
    params: dict[str, str]
    messages: list[str]

    def to_dict(self) -> dict[str, Any]:
        return {
            "source_url": self.source_url,
            "fetched_at": self.fetched_at,
            "raw_text": self.raw_text,
            "html": self.html,
            "params": self.params,
            "messages": self.messages,
        }


def extract_query_params(url: str) -> dict[str, str]:
    parsed = urlparse(url)
    values = parse_qs(parsed.query, keep_blank_values=True)
    return {key: items[0] if items else "" for key, items in values.items()}


def fetch_minutes(url: str, timeout: int = 30) -> FetchResult:
    params = extract_query_params(url)
    messages: list[str] = []
    fetched_at = dt.datetime.now(dt.UTC).isoformat(timespec="seconds").replace("+00:00", "Z")

    try:
        response = requests.get(
            url,
            timeout=timeout,
            headers={"User-Agent": "minutes-counter/0.1 (+https://github.com/YaMac33/toGitHub)"},
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        raise MinuteFetchError(f"URLの取得に失敗しました: {url} ({exc})") from exc

    page_html = response.text
    initial_text = extract_text_from_initial_html(page_html)
    if initial_text:
        messages.append("初期HTMLから会議録本文候補を取得しました。")
        raw_text = initial_text
    else:
        messages.append(
            "初期HTMLに table#lst-minute の本文が見つかりませんでした。JavaScript後読み込み型の可能性があります。"
        )
        raw_text = fetch_minutes_from_backend_api(url, params, messages, timeout=timeout)

    if not raw_text.strip():
        hint = (
            "会議録本文を取得できませんでした。scripts/fetch_minutes.py の "
            "fetch_minutes_from_backend_api() に対象サイトの裏側API URLとパラメータを追加してください。"
        )
        raise MinuteFetchError(f"{hint} 対象URL: {url}")

    return FetchResult(
        source_url=url,
        fetched_at=fetched_at,
        raw_text=normalize_text(raw_text),
        html=page_html,
        params=params,
        messages=messages,
    )


def extract_text_from_initial_html(page_html: str) -> str:
    soup = BeautifulSoup(page_html, "lxml")
    minute_table = soup.select_one("table#lst-minute")
    if minute_table:
        text = minute_table.get_text("\n", strip=True)
        if has_speech_mark(text):
            return text

    body_text = soup.get_text("\n", strip=True)
    return body_text if has_speech_mark(body_text) else ""


def fetch_minutes_from_backend_api(
    source_url: str,
    params: dict[str, str],
    messages: list[str],
    timeout: int = 30,
) -> str:
    """Fetch dynamic minutes text.

    This project intentionally keeps the backend API adapter isolated here.
    Once the target site's API endpoint is identified, add a branch that builds
    the request from tenant_id, council_id, schedule_id, view_years, and related
    parameters, then return the extracted minutes text.
    """

    required = ["tenant_id", "council_id", "schedule_id"]
    missing = [key for key in required if key not in params]
    if missing:
        messages.append(f"裏側API探索に必要なクエリパラメータが不足しています: {', '.join(missing)}")
    else:
        messages.append(
            "裏側APIは未設定です。取得処理は fetch_minutes_from_backend_api() に追加してください。"
        )
        messages.append(
            "抽出済みパラメータ: "
            + ", ".join(f"{key}={value}" for key, value in sorted(params.items()))
        )

    return ""


def has_speech_mark(text: str) -> bool:
    return bool(re.search(r"(?m)^[\s　]*[○◆◎]", html.unescape(text or "")))


def normalize_text(text: str) -> str:
    text = html.unescape(text or "")
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"</p\s*>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", "", text)
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t　]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()
