# アーキテクチャ

## 設計思想

1. **プロバイダーの違いは境界の内側に閉じ込める**
   各社SDKの型・パラメータ・例外は `providers/*_provider.py` の中だけで扱い、外には共通モデル
   （`GenerationRequest` / `GenerationResponse` / `TokenUsage` / `ProviderAPIError`）だけを出す。
2. **役割（エージェント）と実行するAI（プロバイダー）を分離する**
   エージェントは `LLMProvider` プロトコルにのみ依存する。どのAIを使うかは `settings.yaml` で決める。
3. **APIキーが必要な処理と、不要な処理を分ける**
   設定の読み込み・診断・一覧表示・利用記録の集計は、キーもSDKも通信もなしで動く。
   キーが必要になるのは `BaseProvider.get_client()` の時点だけで、未設定ならそこで止まる。
4. **安全側に倒す**
   リトライには上限を設け、タイムアウトも必ず設定する。料金が不明なものは0として扱わない。
   ログに機密情報を出さない。AIによる自律的なファイル編集はまだ行わない。
5. **最初はシンプルに**
   CLI は argparse、並列実行は ThreadPoolExecutor、利用記録は JSON Lines。
   置き換えが必要になったときに差し替えられるよう、境界は Protocol で定義しておく。

## レイヤー構成と依存方向

```
cli  →  orchestration.orchestrator  →  workflows  →  agents  →  core.interfaces.LLMProvider
                                     →  providers (registry)  →  providers.base  →  core.*
```

- 上位の層は下位の層に依存するが、逆方向の依存はない
- `workflows` は `agents` に、`agents` は `LLMProvider` プロトコルに依存する。特定のプロバイダー実装には依存しない
- `orchestration/__init__.py` は循環 import を避けるため、`task_manager` だけを公開する

## モジュールの責務

### core/

| モジュール | 責務 |
|---|---|
| `config.py` | `settings.yaml` / `models.yaml` / `.env` の読み込みと検証（Pydantic）、`ModelCatalog`、APIキーの取得（`SecretStr`）、プロバイダー診断（通信なし） |
| `models.py` | プロバイダー共通のデータモデル。`GenerationParams`, `GenerationRequest`, `GenerationResponse`, `TokenUsage`（実測／推定の区別）, `CostEstimate`（未設定と0の区別）, `ModelInfo` |
| `interfaces.py` | `LLMProvider` / `UsageStore` / `ExternalAgent` の Protocol |
| `exceptions.py` | 例外の階層。`WorkbenchError` を頂点に、`MissingAPIKeyError`、`ProviderAPIError`（`retryable` を持つ）、`BudgetExceededError` など |
| `usage.py` | 料金計算、トークン推定、`UsageRecord`、`JsonlUsageStore`、月別・プロバイダー別・モデル別の集計、`BudgetGuard` |

### providers/

| モジュール | 責務 |
|---|---|
| `base.py` | `BaseProvider`（テンプレートメソッド）。有効・無効の確認、モデルとパラメータの解決、予算確認、APIキー確認、SDKクライアントの遅延生成、上限付きリトライ（指数バックオフ）、使用量が返らないときの推定、料金計算、利用記録、メタデータのログ |
| `anthropic_provider.py` | Messages API。SDK 2.x は `temperature` / `top_p` に対応していないため、指定されても警告して無視する |
| `openai_provider.py` | Responses API。`stop_sequences` には対応していないため、指定されても警告して無視する |
| `gemini_provider.py` | google-genai。タイムアウトはミリ秒で指定し、出力トークンに思考トークンを加算する |
| `mock_provider.py` | オフライン用。入力をそのまま返し、トークン数は推定値で記録する |
| `registry.py` | 実装名 → クラスの登録と、設定からの生成（`type` による別名に対応） |

**SDKクライアントの設定**: 3社とも SDK 側のリトライを無効化し（`max_retries=0`、Gemini は `attempts=1`）、
`BaseProvider` の `max_retries` に一本化している。リトライの回数と上限の管理を1か所にまとめるためである。
タイムアウトは `settings.yaml` の `timeout_seconds` から設定する。

**エラーの扱い**: SDK の例外は `_translate_error` で共通の例外に変換する。

| 例外 | 再試行 |
|---|---|
| タイムアウト | する |
| 接続エラー | する |
| 429（レート制限） | する |
| 5xx | する |
| 401 / 403（認証） | しない |
| その他の 4xx | しない |
| 想定外の例外 | しない |

想定外の例外は、型名を残したまま `ProviderAPIError` に包む。

### agents/

| モジュール | 責務 |
|---|---|
| `base.py` | `AgentTask`（指示と参考情報）、`AgentResult`、`BaseAgent.run()`。プロバイダーのエラーは例外として投げず、失敗結果として返す |
| `coding_agent.py` / `review_agent.py` / `research_agent.py` | 役割ごとのシステムプロンプトとプロンプトの組み立て方 |
| `external.py` | 外部CLIエージェント。現在はインストールの検出のみ |
| `__init__.py` | `AGENT_ROLES`（役割名 → クラス）。未知の役割は `GenericAgent` として扱う |

### workflows/

| モジュール | 責務 |
|---|---|
| `base.py` | `WorkflowResult` / `WorkflowStatus`（succeeded / partial / failed）、`{input}` の置換（`str.format` は使わず、コード中の `{}` と衝突しないようにしている）、1タスクの実行と例外の封じ込め |
| `sequential.py` | ステップを順番に実行する。各ステップには、ユーザー入力とそれまでに成功したステップの出力を参考情報として渡す。`stop_on_failure` が true なら、失敗以降のステップはスキップする |
| `parallel.py` | 同じ指示を複数のエージェントに並列実行させる。結果はエージェントの定義順に並ぶ |

### orchestration/

| モジュール | 責務 |
|---|---|
| `orchestrator.py` | 設定からプロバイダー・エージェント・ワークフローを組み立てるファサード。`force_provider="mock"` でドライランできる。プロバイダーの差し込みにも対応（テスト用） |
| `task_manager.py` | `TaskRecord`（入力、出力、状態、エラー、使用量、料金、時刻）をスレッドセーフに管理する |

### cli/ ・ utils/

- `cli/commands.py`: argparse のサブコマンド。全角文字の幅を考慮して表を整形する
- `utils/logging.py`: ログ設定（コンソールは WARNING 以上、ファイルはローテーションあり）と `mask_secrets`

## データの流れ（例: `multi-ai run dev_pipeline "..."`）

1. `Orchestrator.from_config()` が設定とモデルカタログを読み込む
2. `build_workflow()` が、ステップごとにエージェントを生成する。どのプロバイダーを使うかは `agents.<名前>.provider` で決まる
3. `SequentialWorkflow.run()` が、`TaskManager` にタスクを登録して順に実行する
4. `BaseAgent.run()` がプロンプトを組み立て、`LLMProvider.generate()` を呼ぶ
5. `BaseProvider.generate()` の中で次の処理が行われる
   1. 予算を確認する
   2. APIキーを確認する
   3. API を呼ぶ（必要ならリトライする）
   4. 使用量を取得または推定する
   5. 料金を計算する
   6. `UsageStore` に記録する
6. 結果を `TaskRecord` に反映し、`WorkflowResult` として返す

## 利用記録

`logs/usage.jsonl` に、1行1レコードで次の項目を記録する。

| 項目 | 内容 |
|---|---|
| `timestamp` | UTC の日時 |
| `provider` / `model` / `task_id` | 呼び出し先と、どのタスクの呼び出しか |
| `input_tokens` / `output_tokens` | トークン数 |
| `usage_source` | `reported`（APIの実測値）/ `estimated`（推定値）/ `unavailable`（取得できなかった） |
| `cost_usd` | 推定料金。`null` は「料金未設定」で、0 とは区別する |
| `pricing_configured` | 単価が設定されていたか |
| `status` | `success` / `error` |
| `error_type` / `latency_ms` | 失敗時の例外名と、所要時間 |

`summarize_usage()` で任意のキー（`month` / `provider` / `model`）を組み合わせて集計できる。
SQLite などに移行する場合は、`UsageStore` プロトコル（`append` と `load`）を実装すればよい。

## 重要な設計判断

| 判断 | 理由 |
|---|---|
| CLI は argparse | 依存を増やさないため。Web UI を作るときも Orchestrator をそのまま使える |
| 並列実行はスレッド（asyncio を使わない） | 各社SDKの同期クライアントをそのまま使え、コードが単純になる。並列数は数個程度を想定している |
| SDK は呼び出し時に import する | SDK の import には十数秒かかることがある。キーなしで使うコマンド（status など）を軽く保つため |
| 料金は USD／100万トークンで、未設定は `null` | 各社の料金表の単位に合わせた。「未設定」を「無料」と取り違えないため |
| OpenAI と Gemini のモデルは `unverified` | 実在を確認できていないモデルIDを、確認済みとして扱わないため |
| Claude Code はAPIプロバイダーとして扱わない | サブスクリプション認証をAPIキーの代わりに使うことはしない、という方針のため |
| 利用記録は JSONL | 追記のみで壊れにくく、一部の行が壊れても他の行は読める。人が読んでもわかりやすい |
