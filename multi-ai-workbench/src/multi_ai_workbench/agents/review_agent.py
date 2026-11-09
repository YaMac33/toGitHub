from __future__ import annotations

from multi_ai_workbench.agents.base import AgentTask, BaseAgent

REVIEW_ASPECTS = ("バグ・正しさ", "設計・保守性", "セキュリティ", "性能", "テスト容易性")


class ReviewAgent(BaseAgent):
    """コード・設計のレビューを担当。"""

    role = "review"
    default_system_prompt = (
        "あなたは厳格かつ建設的なシニアレビュアーです。根拠のある指摘だけを、重大度の高い順に挙げてください。"
        "推測に基づく指摘はその旨を明記し、問題が無い観点は無理に指摘しないでください。"
    )

    def build_prompt(self, task: AgentTask) -> str:
        parts = [f"# レビュー依頼\n{task.instruction.strip()}"]
        for title, body in task.context.items():
            parts.append(f"## レビュー対象: {title}\n{body.strip()}")
        aspects = "\n".join(f"- {a}" for a in REVIEW_ASPECTS)
        parts.append(
            f"## 観点\n{aspects}\n\n"
            "## 出力形式\n指摘ごとに「重大度(高/中/低)・箇所・問題・修正案」を記載し、最後に総評を1〜3行で。"
        )
        return "\n\n".join(parts)
