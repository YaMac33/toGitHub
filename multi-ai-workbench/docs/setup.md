# 環境構築

## 前提

- Python **3.11 以上**（3.12.10 で動作確認済み）
- Git

### Windows で Python をインストールする

`python` と入力すると Microsoft Store が開く場合、Python はまだインストールされていません。
ユーザー単位でインストールすれば、管理者権限は不要です。

```powershell
winget install --id Python.Python.3.12 --scope user
# インストール後、新しいターミナルを開くと python が PATH に入っています
```

PATH が通っていない場合は、`%LOCALAPPDATA%\Programs\Python\Python312\python.exe` を直接指定してください。

## 手順

```powershell
cd multi-ai-workbench

# 1. 仮想環境を作る（.venv は Git 管理外）
python -m venv .venv
.\.venv\Scripts\Activate.ps1
#   PowerShell の実行ポリシーで止まる場合:
#   Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
#   または有効化せず .\.venv\Scripts\python.exe や .\.venv\Scripts\multi-ai.exe を直接使う

# 2. 依存をインストールする（-e で開発モード。ソースの変更がそのまま反映される）
python -m pip install --upgrade pip
pip install -e ".[dev]"

# 3. 動作を確認する（APIキーは不要）
multi-ai status
multi-ai providers
multi-ai models
multi-ai ask "hello" --provider mock
multi-ai run dev_pipeline "TODOアプリのAPI" --mock

# 4. テストを実行する（APIキー不要・通信なし）
pytest
```

macOS / Linux の場合は、`.\.venv\Scripts\Activate.ps1` を `source .venv/bin/activate` に読み替えてください。

## APIキーの設定（任意）

使いたいプロバイダーのキーだけを設定します。詳しくは [api-configuration.md](api-configuration.md) を参照してください。

```powershell
Copy-Item .env.example .env
notepad .env
multi-ai status
```

## プロジェクトルートの指定

設定ファイル（`config/`）、`.env`、`logs/` は、プロジェクトルートを基準に探します。
既定のプロジェクトルートは、インストール元のディレクトリ（`src/` の親）です。
別のディレクトリの設定を使いたい場合は、次のどちらかで指定します。

```powershell
multi-ai --home D:\path\to\another-workbench status
$env:MULTI_AI_WORKBENCH_HOME = "D:\path\to\another-workbench"
```

## 補足

- **初回の SDK 読み込み**: 各社SDKは大きいため、初めて import するときや `pytest` の収集時に十数秒かかることがあります。`status` などの軽いコマンドは SDK を読み込まないので、すぐに終わります
- **ログ**: 実行ログは `logs/multi-ai.log`、利用記録は `logs/usage.jsonl` に出力されます。どちらも Git 管理外です。コンソールにも警告を表示したい場合は `multi-ai -v ...` を使います
- **文字化け**: パイプで別のプログラムに渡したときに日本語が化ける場合は、`$env:PYTHONIOENCODING = "utf-8"` を設定してください
