from __future__ import annotations

import csv
import hashlib
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

from build_qa_links import build_qa_links
from fetch_minutes import MinuteFetchError, fetch_minutes
from parse_speeches import parse_speeches


BASE_DIR = Path(__file__).resolve().parents[1]
SOURCES_CSV = BASE_DIR / "sources.csv"
DATA_DIR = BASE_DIR / "data"
RAW_DIR = DATA_DIR / "raw"


def main() -> int:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    urls = read_enabled_urls(SOURCES_CSV)

    all_speeches: list[dict[str, Any]] = []
    raw_sources: list[dict[str, Any]] = []
    errors: list[str] = []

    for url in urls:
        try:
            result = fetch_minutes(url)
        except MinuteFetchError as exc:
            errors.append(str(exc))
            print(f"[ERROR] {exc}", file=sys.stderr)
            continue

        raw_sources.append(
            {
                "source_url": result.source_url,
                "fetched_at": result.fetched_at,
                "params": result.params,
                "messages": result.messages,
            }
        )
        save_raw_result(result.to_dict())
        speeches = parse_speeches(result.raw_text, result.source_url, start_index=len(all_speeches) + 1)
        all_speeches.extend(speeches)
        print(f"[OK] {url} speeches={len(speeches)}")

    qa_links = build_qa_links(all_speeches)
    summary = build_summary(all_speeches, qa_links, raw_sources, errors)

    write_js(DATA_DIR / "speeches.js", "speeches", all_speeches)
    write_js(DATA_DIR / "qa_links.js", "qa_links", qa_links)
    write_js(DATA_DIR / "summary.js", "summary", summary)

    if errors:
        print("[WARN] 取得できないURLがありました。summary.js の sources/errors を確認してください。", file=sys.stderr)
    return 0


def read_enabled_urls(path: Path) -> list[str]:
    if not path.exists():
        raise FileNotFoundError(f"sources.csv が見つかりません: {path}")

    urls: list[str] = []
    seen: set[str] = set()
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            url = (row.get("url") or "").strip()
            enabled = (row.get("enabled") or "").strip()
            if not url or enabled != "1" or url in seen:
                continue
            seen.add(url)
            urls.append(url)
    return urls


def save_raw_result(result: dict[str, Any]) -> None:
    source_url = result.get("source_url", "")
    digest = hashlib.sha256(source_url.encode("utf-8")).hexdigest()[:16]
    path = RAW_DIR / f"{digest}.json"
    path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_js(path: Path, key: str, value: Any) -> None:
    payload = json.dumps(value, ensure_ascii=False, indent=2)
    path.write_text(f"window.APP_DATA = window.APP_DATA || {{}};\nwindow.APP_DATA.{key} = {payload};\n", encoding="utf-8")


def build_summary(
    speeches: list[dict[str, Any]],
    qa_links: list[dict[str, Any]],
    sources: list[dict[str, Any]],
    errors: list[str],
) -> dict[str, Any]:
    unlinked = [link for link in qa_links if not link.get("questioner_speech_id")]
    return {
        "total_speeches": len(speeches),
        "total_qa_links": len(qa_links),
        "total_unlinked_answers": len(unlinked),
        "by_speaker_label": counter_rows(speeches, ["speaker_label"]),
        "by_speaker_name": counter_rows(speeches, ["speaker_name"]),
        "by_mark": counter_rows(speeches, ["mark"]),
        "by_answerer_label": counter_rows(qa_links, ["answerer_label"]),
        "by_questioner_answerer": build_questioner_answerer_summary(qa_links),
        "sources": sources,
        "errors": errors,
    }


def counter_rows(items: list[dict[str, Any]], keys: list[str]) -> list[dict[str, Any]]:
    counter: Counter[tuple[Any, ...]] = Counter()
    for item in items:
        values = tuple(item.get(key) or "" for key in keys)
        if any(values):
            counter[values] += 1

    rows: list[dict[str, Any]] = []
    for values, count in counter.most_common():
        row = {keys[index]: values[index] for index in range(len(keys))}
        row["count"] = count
        rows.append(row)
    return rows


def build_questioner_answerer_summary(qa_links: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[tuple[str, str], Counter[tuple[str, str]]] = defaultdict(Counter)
    for link in qa_links:
        if not link.get("questioner_speech_id"):
            continue
        questioner_key = (link.get("questioner_label") or "", link.get("questioner_name") or "")
        answerer_key = (link.get("answerer_label") or "", link.get("answerer_name") or "")
        grouped[questioner_key][answerer_key] += 1

    rows: list[dict[str, Any]] = []
    for (questioner_label, questioner_name), answers in sorted(grouped.items()):
        rows.append(
            {
                "questioner_label": questioner_label,
                "questioner_name": questioner_name,
                "answers": [
                    {
                        "answerer_label": answerer_label,
                        "answerer_name": answerer_name,
                        "count": count,
                    }
                    for (answerer_label, answerer_name), count in answers.most_common()
                ],
            }
        )
    return rows


if __name__ == "__main__":
    raise SystemExit(main())
