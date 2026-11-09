"""multi-ai コマンドの実装（標準ライブラリ argparse のみ使用）。

APIキーを必要としないコマンド: status / providers / models / usage / agents / workflows
APIキーを必要とするコマンド  : ask / run（ただし --provider mock / --mock ならキー不要）
"""

from __future__ import annotations

import argparse
import sys
import unicodedata
from collections.abc import Sequence
from pathlib import Path
from typing import TextIO

from multi_ai_workbench import __version__
from multi_ai_workbench.agents import AgentTask
from multi_ai_workbench.core.config import is_sdk_installed
from multi_ai_workbench.core.exceptions import MissingAPIKeyError, WorkbenchError
from multi_ai_workbench.core.models import GenerationParams
from multi_ai_workbench.core.usage import GroupKey, summarize_usage
from multi_ai_workbench.orchestration.orchestrator import Orchestrator
from multi_ai_workbench.orchestration.task_manager import TaskStatus
from multi_ai_workbench.providers import registered_provider_types
from multi_ai_workbench.utils.logging import mask_secrets, setup_logging

EXIT_OK = 0
EXIT_ERROR = 1
EXIT_MISSING_KEY = 3

# --------------------------------------------------------------------------
# 表示ヘルパー
# --------------------------------------------------------------------------


def _width(text: str) -> int:
    return sum(2 if unicodedata.east_asian_width(c) in ("W", "F") else 1 for c in text)


def _pad(text: str, width: int) -> str:
    return text + " " * (width - _width(text))


def print_table(headers: Sequence[str], rows: Sequence[Sequence[object]], out: TextIO) -> None:
    cells = [[str(c) for c in headers]] + [["" if c is None else str(c) for c in row] for row in rows]
    widths = [max(_width(r[i]) for r in cells) for i in range(len(headers))]
    for idx, row in enumerate(cells):
        out.write("  ".join(_pad(c, w) for c, w in zip(row, widths)).rstrip() + "\n")
        if idx == 0:
            out.write("  ".join("-" * w for w in widths) + "\n")


def _yes_no(value: bool | None, na: str = "-") -> str:
    if value is None:
        return na
    return "OK" if value else "NG"


# --------------------------------------------------------------------------
# コマンド
# --------------------------------------------------------------------------


def cmd_status(orch: Orchestrator, args: argparse.Namespace, out: TextIO) -> int:
    s = orch.settings
    env_file = s.project_root / ".env"
    out.write(f"Multi AI Workbench {__version__}\n")
    out.write(f"  プロジェクトルート : {s.project_root}\n")
    out.write(f"  .env               : {'あり' if env_file.is_file() else 'なし（環境変数のみ参照）'}\n")
    out.write(f"  利用記録           : {s.usage_file_path}\n")
    limit = s.budget.monthly_limit_usd
    budget = "上限なし" if limit is None else f"${limit:.2f}/月 ({'有効' if s.budget.enforce else '記録のみ'})"
    out.write(f"  利用料金上限       : {budget}\n\n")

    out.write("プロバイダー（API通信は行っていません）\n")
    rows = []
    for d in orch.diagnose():
        key = "不要" if not d.api_key_required else ("設定済み" if d.api_key_set else "未設定")
        rows.append(
            [
                d.name,
                "有効" if d.enabled else "無効",
                d.api_key_env or "-",
                key,
                _yes_no(d.sdk_installed),
                d.default_model,
                "利用可" if d.available else "利用不可",
            ]
        )
    print_table(["名前", "状態", "環境変数", "APIキー", "SDK", "既定モデル", "判定"], rows, out)

    issues = [(d.name, i) for d in orch.diagnose() for i in d.issues]
    if issues:
        out.write("\n注意事項\n")
        for name, issue in issues:
            out.write(f"  - {name}: {issue}\n")

    out.write("\n外部CLIエージェント（検出のみ・自動起動なし）\n")
    rows = [[a.name, a.command, "検出" if a.is_installed() else "未検出", a.description or ""] for a in orch.external_agents()]
    print_table(["名前", "コマンド", "状態", "説明"], rows, out)
    return EXIT_OK


def cmd_providers(orch: Orchestrator, args: argparse.Namespace, out: TextIO) -> int:
    rows = []
    for name, ps in orch.settings.providers.items():
        ptype = ps.type or name
        rows.append(
            [
                name,
                ptype,
                "有効" if ps.enabled else "無効",
                ps.default_model,
                len(orch.catalog.models(ptype)),
                f"{ps.timeout_seconds:g}s",
                ps.max_retries,
                _yes_no(is_sdk_installed(ptype)),
            ]
        )
    print_table(["名前", "実装", "状態", "既定モデル", "登録モデル数", "タイムアウト", "再試行上限", "SDK"], rows, out)
    out.write(f"\n登録済みの実装: {', '.join(registered_provider_types())}\n")
    return EXIT_OK


def cmd_models(orch: Orchestrator, args: argparse.Namespace, out: TextIO) -> int:
    def price(v: float | None) -> str:
        return "未設定" if v is None else f"${v:g}"

    def num(v: int | None) -> str:
        return "未設定" if v is None else f"{v:,}"

    models = orch.catalog.models(args.provider)
    rows = [
        [
            m.provider,
            m.id,
            m.status.value,
            price(m.input_price_per_mtok),
            price(m.output_price_per_mtok),
            num(m.context_window),
            ",".join(m.capabilities),
        ]
        for m in models
    ]
    print_table(["プロバイダー", "モデルID", "状態", "入力/1M", "出力/1M", "コンテキスト長", "機能"], rows, out)
    if any(m.status.value in ("unverified", "placeholder") for m in models):
        out.write("\n※ unverified / placeholder のモデルは実在・提供状況が未確認です。利用前に公式情報で確認してください。\n")
    if any(not m.pricing_configured for m in models):
        out.write("※ 料金が「未設定」のモデルは利用記録で「料金未設定」と表示されます（0円ではありません）。\n")
    return EXIT_OK


def cmd_usage(orch: Orchestrator, args: argparse.Namespace, out: TextIO) -> int:
    records = orch.usage_store.load()
    if args.month:
        records = [r for r in records if r.month == args.month]
    if args.provider:
        records = [r for r in records if r.provider == args.provider]
    if not records:
        out.write("利用記録はありません。\n")
        return EXIT_OK

    group_by: list[GroupKey] = args.by or ["month", "provider", "model"]
    summaries = summarize_usage(records, group_by)
    rows = [
        [*(s.group[k] for k in group_by), s.calls, s.errors, f"{s.input_tokens:,}", f"{s.output_tokens:,}", s.estimated_token_calls, s.cost_display()]
        for s in summaries
    ]
    labels = {"month": "月", "provider": "プロバイダー", "model": "モデル"}
    print_table([*(labels[k] for k in group_by), "呼出", "失敗", "入力tok", "出力tok", "推定tok件数", "推定料金"], rows, out)
    out.write("\n※ 料金は models.yaml の単価に基づく推定値です。「推定tok件数」はAPIが使用量を返さず文字数から推定した件数です。\n")

    if args.recent:
        out.write(f"\n直近 {args.recent} 件\n")
        recent = sorted(records, key=lambda r: r.timestamp)[-args.recent :]
        rows = [
            [
                r.timestamp.astimezone().strftime("%Y-%m-%d %H:%M:%S"),
                r.provider,
                r.model,
                r.task_id or "-",
                r.input_tokens,
                r.output_tokens,
                r.usage_source.value,
                r.cost_display(),
                r.status.value if r.status.value == "success" else f"error({r.error_type})",
            ]
            for r in recent
        ]
        print_table(["日時", "プロバイダー", "モデル", "タスクID", "入力", "出力", "使用量の出所", "推定料金", "結果"], rows, out)
    return EXIT_OK


def _read_prompt(value: str) -> str:
    return sys.stdin.read() if value == "-" else value


def cmd_ask(orch: Orchestrator, args: argparse.Namespace, out: TextIO) -> int:
    prompt = _read_prompt(args.prompt)
    params = GenerationParams(
        max_output_tokens=args.max_tokens,
        temperature=args.temperature,
        top_p=args.top_p,
    )
    if args.agent:
        if args.provider:
            orch.force_provider = args.provider
        agent = orch.agent(args.agent)
        if args.model:
            agent.model = args.model
        if args.system:
            agent.system_prompt = args.system
        agent.params = params.merged_over(agent.params)
        result = agent.run(AgentTask(instruction=prompt))
        if not result.success:
            out.write(f"エラー: {result.error}\n")
            return EXIT_MISSING_KEY if result.error_type == "MissingAPIKeyError" else EXIT_ERROR
        out.write((result.output or "") + "\n")
        out.write(
            f"\n--- agent={result.agent} role={result.role} provider={result.provider} model={result.model}"
            f" tokens(in/out)={result.usage.input_tokens if result.usage else '-'}/{result.usage.output_tokens if result.usage else '-'}"
            f" ({result.usage.source.value if result.usage else '-'}) cost={result.cost.display() if result.cost else '-'}\n"
        )
        return EXIT_OK

    if not args.provider:
        out.write("エラー: --provider か --agent を指定してください（例: --provider mock）\n")
        return EXIT_ERROR
    resp = orch.ask(prompt, provider=args.provider, model=args.model, system_prompt=args.system, params=params)
    out.write(resp.text + "\n")
    note = "" if resp.model_in_catalog else " ※models.yaml未登録"
    out.write(
        f"\n--- provider={resp.provider} model={resp.model}{note} tokens(in/out)={resp.usage.input_tokens}/{resp.usage.output_tokens}"
        f" ({resp.usage.source.value}) cost={resp.cost.display()} latency={resp.latency_ms}ms\n"
    )
    return EXIT_OK


def cmd_agents(orch: Orchestrator, args: argparse.Namespace, out: TextIO) -> int:
    rows = []
    for name, cfg in orch.settings.agents.items():
        ps = orch.settings.providers[cfg.provider]
        rows.append([name, cfg.role or name, cfg.provider, cfg.model or f"({ps.default_model})", cfg.description or ""])
    print_table(["エージェント", "役割", "プロバイダー", "モデル", "説明"], rows, out)
    out.write("\n※ 役割とプロバイダーは独立です。config/settings.yaml の agents.<名前>.provider で変更できます。\n")
    return EXIT_OK


def cmd_workflows(orch: Orchestrator, args: argparse.Namespace, out: TextIO) -> int:
    for name, wf in orch.settings.workflows.items():
        out.write(f"{name} [{wf.type}] {wf.description or ''}\n")
        if wf.type == "sequential":
            for i, step in enumerate(wf.steps, 1):
                out.write(f"  {i}. {step.name} -> {step.agent} ({orch.settings.agents[step.agent].provider})\n")
        else:
            for agent in wf.agents:
                out.write(f"  - {agent} ({orch.settings.agents[agent].provider})\n")
    return EXIT_OK


def cmd_run(orch: Orchestrator, args: argparse.Namespace, out: TextIO) -> int:
    if args.mock:
        orch.force_provider = "mock"
    result = orch.run_workflow(args.workflow, _read_prompt(args.input))
    out.write(f"ワークフロー {result.name} [{result.type}] id={result.workflow_id} 結果={result.status.value}\n\n")
    rows = [
        [
            t.step,
            t.agent,
            t.provider or "-",
            t.model or "-",
            t.status.value,
            f"{t.usage.input_tokens}/{t.usage.output_tokens}" if t.usage else "-",
            t.cost.display() if t.cost else "-",
        ]
        for t in result.tasks
    ]
    print_table(["ステップ", "エージェント", "プロバイダー", "モデル", "状態", "tok(in/out)", "推定料金"], rows, out)
    out.write(f"\n合計推定料金: {result.cost_summary()}\n")

    for t in result.tasks:
        out.write(f"\n===== {t.step} ({t.agent}) : {t.status.value} =====\n")
        if t.status == TaskStatus.SUCCEEDED:
            out.write((t.output or "") + "\n")
        elif t.error:
            out.write(f"エラー: {t.error}\n")
    return EXIT_OK if result.status.value == "succeeded" else EXIT_ERROR


# --------------------------------------------------------------------------
# パーサー
# --------------------------------------------------------------------------


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="multi-ai", description="Multi AI Workbench CLI")
    parser.add_argument("--version", action="version", version=f"%(prog)s {__version__}")
    parser.add_argument("--home", type=Path, help="プロジェクトルート（既定: MULTI_AI_WORKBENCH_HOME かインストール元）")
    parser.add_argument("-v", "--verbose", action="store_true", help="警告ログをコンソールにも表示")
    sub = parser.add_subparsers(dest="command", required=True, metavar="COMMAND")

    sub.add_parser("status", help="設定・APIキーの有無・プロバイダーの利用可否を確認").set_defaults(func=cmd_status)
    sub.add_parser("providers", help="登録済みプロバイダーを表示").set_defaults(func=cmd_providers)

    p = sub.add_parser("models", help="設定済みモデルを表示")
    p.add_argument("--provider", help="プロバイダーで絞り込み")
    p.set_defaults(func=cmd_models)

    p = sub.add_parser("usage", help="利用状況と推定料金を表示")
    p.add_argument("--by", nargs="+", choices=["month", "provider", "model"], help="集計キー（既定: month provider model）")
    p.add_argument("--month", help="YYYY-MM で絞り込み")
    p.add_argument("--provider", help="プロバイダーで絞り込み")
    p.add_argument("--recent", type=int, metavar="N", help="直近 N 件の明細も表示")
    p.set_defaults(func=cmd_usage)

    p = sub.add_parser("ask", help="プロバイダー（またはエージェント）を指定して質問")
    p.add_argument("prompt", help="質問文（'-' で標準入力から読む）")
    p.add_argument("-p", "--provider", help="anthropic / openai / gemini / mock など")
    p.add_argument("-m", "--model", help="モデルID（省略時はプロバイダーの既定モデル）")
    p.add_argument("-a", "--agent", help="エージェント名（役割のプロンプトを使う）")
    p.add_argument("-s", "--system", help="システムプロンプト")
    p.add_argument("--max-tokens", type=int, help="最大出力トークン数")
    p.add_argument("--temperature", type=float)
    p.add_argument("--top-p", type=float)
    p.set_defaults(func=cmd_ask)

    sub.add_parser("agents", help="エージェントと割り当てプロバイダーを表示").set_defaults(func=cmd_agents)
    sub.add_parser("workflows", help="定義済みワークフローを表示").set_defaults(func=cmd_workflows)

    p = sub.add_parser("run", help="ワークフローを実行")
    p.add_argument("workflow", help="ワークフロー名")
    p.add_argument("input", help="入力（'-' で標準入力から読む）")
    p.add_argument("--mock", action="store_true", help="全エージェントを mock プロバイダーで実行（APIキー不要・API呼び出しなし）")
    p.set_defaults(func=cmd_run)
    return parser


def run(argv: Sequence[str] | None = None, out: TextIO | None = None) -> int:
    out = out or sys.stdout
    args = build_parser().parse_args(argv)
    try:
        orch = Orchestrator.from_config(args.home)
        setup_logging(
            orch.settings.app.log_level,
            orch.settings.log_file_path,
            console_level="WARNING" if args.verbose else "ERROR",
        )
        return args.func(orch, args, out)
    except MissingAPIKeyError as exc:
        out.write(f"エラー: {exc}\n状態の確認: multi-ai status\n")
        return EXIT_MISSING_KEY
    except WorkbenchError as exc:
        out.write(f"エラー: {mask_secrets(str(exc))}\n")
        return EXIT_ERROR


__all__ = ["build_parser", "run"]
