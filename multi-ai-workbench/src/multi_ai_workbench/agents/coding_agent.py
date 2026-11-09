from __future__ import annotations

from multi_ai_workbench.agents.base import AgentTask, BaseAgent


class CodingAgent(BaseAgent):
    """コードの生成・修正を担当。

    初期段階ではコードを「テキストとして提案する」だけで、ファイルの自動編集は行わない。
    """

    role = "coding"
    default_system_prompt = (
        "あなたは熟練のソフトウェアエンジニアです。要件を満たす、読みやすく保守しやすいコードを書いてください。"
        "コードはMarkdownのコードブロックで示し、前提・設計判断・未対応事項を簡潔に添えてください。"
        "不明点がある場合は妥当な仮定を置き、その仮定を明記してください。"
    )

    def build_prompt(self, task: AgentTask) -> str:
        parts = [f"# 実装タスク\n{task.instruction.strip()}"]
        for title, body in task.context.items():
            parts.append(f"## 参考: {title}\n{body.strip()}")
        parts.append("## 出力形式\n1. 実装方針（箇条書き）\n2. コード\n3. 前提・未対応事項")
        return "\n\n".join(parts)
