from __future__ import annotations

import html
import re
from typing import Any


START_RE = re.compile(r"^[ \t　]*(?P<mark>[○◆◎])(?P<header>[^\n]*)", re.MULTILINE)
NAME_RE = re.compile(r"^(?P<label>.*?)（(?P<name>[^）]+)）")


def parse_speeches(raw_text: str, source_url: str, start_index: int = 1) -> list[dict[str, Any]]:
    text = normalize_minutes_text(raw_text)
    matches = list(START_RE.finditer(text))
    speeches: list[dict[str, Any]] = []

    for idx, match in enumerate(matches):
        body_start = match.end()
        body_end = matches[idx + 1].start() if idx + 1 < len(matches) else len(text)
        seq = len(speeches) + 1
        speech_number = start_index + len(speeches)
        mark = match.group("mark")
        header = clean_inline(match.group("header"))
        body = clean_body(text[body_start:body_end])
        speaker_label, speaker_name = parse_speaker(header)

        speeches.append(
            {
                "speech_id": f"speech_{speech_number:06d}",
                "source_url": source_url,
                "seq": seq,
                "mark": mark,
                "role_type": role_type_for_mark(mark),
                "speaker_label": speaker_label,
                "speaker_name": speaker_name,
                "speech_type": "発言",
                "body": body,
            }
        )

    return speeches


def normalize_minutes_text(raw_text: str) -> str:
    text = html.unescape(raw_text or "")
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"</(p|div|tr|li)\s*>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", "", text)
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t　]+", " ", text)
    text = re.sub(r"\n[ \t　]+", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def parse_speaker(header: str) -> tuple[str, str]:
    header = clean_inline(header)
    match = NAME_RE.match(header)
    if not match:
        return header, ""

    label = clean_inline(match.group("label"))
    name = clean_inline(match.group("name"))
    name = re.sub(r"(君|さん|氏|議員|委員)$", "", name).strip()
    return label, name


def role_type_for_mark(mark: str) -> str:
    return {"○": "chair", "◆": "questioner", "◎": "answerer"}.get(mark, "unknown")


def clean_inline(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").replace("　", " ")).strip()


def clean_body(value: str) -> str:
    value = normalize_minutes_text(value)
    return re.sub(r"\s+", " ", value).strip()
