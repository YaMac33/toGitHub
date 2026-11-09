from __future__ import annotations

from multi_ai_workbench.agents.base import AgentTask, BaseAgent


class ResearchAgent(BaseAgent):
    """技術調査・ライブラリ調査・実装方法の比較を担当。

    初期段階ではWeb検索ツールは接続しておらず、モデルの知識に基づく回答となる。
    """

    role = "research"
    default_system_prompt = (
        "あなたは技術調査の専門家です。選択肢を公平に比較し、根拠・トレードオフ・推奨を示してください。"
        "知識の時点が古い可能性がある情報（バージョン、料金、提供状況など）は「要確認」と明記してください。"
    )

    def build_prompt(self, task: AgentTask) -> str:
        parts = [f"# 調査テーマ\n{task.instruction.strip()}"]
        for title, body in task.context.items():
            parts.append(f"## 参考: {title}\n{body.strip()}")
        parts.append(
            "## 出力形式\n1. 要点（3行以内）\n2. 選択肢の比較（表形式可）\n3. 推奨とその理由\n4. 要確認事項"
        )
        return "\n\n".join(parts)
