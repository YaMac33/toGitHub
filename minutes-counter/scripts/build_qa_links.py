from __future__ import annotations

from typing import Any


def build_qa_links(speeches: list[dict[str, Any]]) -> list[dict[str, Any]]:
    links: list[dict[str, Any]] = []
    current_questioner: dict[str, Any] | None = None
    current_source_url: str | None = None

    for speech in speeches:
        source_url = speech.get("source_url")
        if source_url != current_source_url:
            current_source_url = source_url
            current_questioner = None

        role_type = speech.get("role_type")
        if role_type == "questioner":
            current_questioner = speech
            continue

        if role_type != "answerer":
            continue

        link_number = len(links) + 1
        links.append(
            {
                "qa_link_id": f"qa_{link_number:06d}",
                "source_url": speech.get("source_url"),
                "questioner_speech_id": current_questioner.get("speech_id") if current_questioner else None,
                "answer_speech_id": speech.get("speech_id"),
                "questioner_label": current_questioner.get("speaker_label") if current_questioner else None,
                "questioner_name": current_questioner.get("speaker_name") if current_questioner else None,
                "answerer_label": speech.get("speaker_label"),
                "answerer_name": speech.get("speaker_name"),
            }
        )

    return links
