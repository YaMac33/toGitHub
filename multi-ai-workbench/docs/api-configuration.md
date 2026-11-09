# APIキーとモデル・料金の設定

## 基本ルール

- APIキーは**環境変数**または**プロジェクト直下の `.env`** でのみ設定します
- ソースコードや `config/*.yaml` にキーを書かないでください。`settings.yaml` に書くのは、キーを格納する環境変数の名前（`api_key_env`）だけです
- `.env` は `.gitignore` 済みです。コミット前に `git status` で `.env` が含まれていないことを確認してください
- 同じ名前の環境変数がすでにある場合は、そちらが優先されます（`.env` で上書きされません）
- キーはログ、エラーメッセージ、`multi-ai status` の出力に表示されません

```dotenv
# .env
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GEMINI_API_KEY=
```

設定したら、`multi-ai status` で「APIキー: 設定済み」「判定: 利用可」になることを確認します。
`status` は API と通信しないため、キーが有効かどうか（無効なキーでないか）までは確認できません。
最初の動作確認は、短い質問で行ってください。

```powershell
multi-ai ask "1+1は?" --provider anthropic --max-tokens 50
```

## Anthropic（Claude API）

1. Anthropic Console（console.anthropic.com）でアカウントを作成し、課金を設定する
2. 「API Keys」でキーを発行し、`ANTHROPIC_API_KEY` に設定する

- 使用API: Messages API（公式SDK `anthropic`）
- **Claude Code のサブスクリプションと API の課金は別です。** Claude Code にログインしていても、このアプリから API を使うには APIキーが必要です。このアプリは、Claude Code の認証情報を API の代わりに使うことはしません
- 現行SDK（2.x）は `temperature` / `top_p` に対応していません。指定しても無視されます（警告ログが出ます）

## OpenAI

1. OpenAI Platform（platform.openai.com）でアカウントを作成し、課金を設定する
2. 「API keys」でキーを発行し、`OPENAI_API_KEY` に設定する

- 使用API: Responses API（公式SDK `openai`）
- `stop_sequences` には対応していないため、指定しても無視されます
- 推論系のモデルの中には `temperature` を受け付けないものがあります。エラーになった場合は、指定を外してください

## Google（Gemini API）

1. Google AI Studio（aistudio.google.com）で APIキーを発行する
2. `GEMINI_API_KEY` に設定する

- 使用SDK: `google-genai`
- 出力トークン数には思考（thinking）トークンも含めて記録します

## モデルの設定（config/models.yaml）

```yaml
models:
  - id: claude-sonnet-5-5          # APIに渡すモデルID
    provider: anthropic            # settings.yaml の実装名と一致させる
    display_name: Claude Sonnet 5.5
    status: verified               # verified / unverified / placeholder / offline
    input_price_per_mtok: null     # USD／100万入力トークン（null = 料金未設定）
    output_price_per_mtok: null    # USD／100万出力トークン
    context_window: null           # トークン数
    max_output_tokens: null
    capabilities: [text, vision, tools, reasoning]
    notes: "確認元や注意事項"
```

### 初期設定の状態

| プロバイダー | モデル | status | 根拠 |
|---|---|---|---|
| anthropic | claude-opus-5-5, claude-sonnet-5-5, claude-haiku-5-5 | verified | Claude Code 実行環境の情報で確認（2026-11） |
| openai | gpt-5, gpt-5-mini | **unverified** | 以前は存在が確認されていたモデル。現在も提供されているかは未確認 |
| gemini | gemini-2.5-pro, gemini-2.5-flash | **unverified** | 同上 |
| mock | mock-echo | offline | APIを呼ばない |

**OpenAI と Gemini は、APIキーを設定したら、最初に各社の公式ドキュメントで現在のモデルIDを確認し、
`models.yaml` と `settings.yaml` の `default_model` を更新してください。** 確認できたら `status: verified` に変更します。

### 料金の設定

初期状態では、すべてのモデルの料金が `null`（料金未設定）です。各社の公式料金ページで確認して記入してください。

- 単位は **USD／100万トークン** です（例: 100万入力トークンあたり $3 なら `3.0`）
- 未設定のモデルの呼び出しは「料金未設定」と記録され、合計金額には含まれません（0円とは扱いません）
- 料金は、記録した**時点**の単価で計算されます。単価を後から変更しても、過去の記録は再計算されません
- キャッシュ利用時の割引や、バッチ処理の料金は考慮していません（今後の拡張予定）

## タイムアウト・リトライ（config/settings.yaml）

```yaml
providers:
  anthropic:
    timeout_seconds: 120            # 1回のAPI呼び出しのタイムアウト
    max_retries: 2                  # 再試行の上限（0〜10）。初回を含めて最大3回
    retry_base_delay_seconds: 1.0   # 1秒、2秒、4秒…と待ち時間を倍にしていく
```

再試行するのは、タイムアウト、接続エラー、429（レート制限）、5xx のときだけです。
認証エラーやリクエストの誤り（4xx）は再試行しません。

## 利用料金の上限

```yaml
budget:
  monthly_limit_usd: 10.0
  enforce: true      # 今月の推定料金が上限に達したら、API呼び出しの前に拒否する
```

上限の判定には、料金が設定されたモデルの記録しか使えません。上限を使う場合は、利用するモデルの単価を必ず設定してください。
