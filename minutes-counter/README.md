# 会議録発言・質疑答弁カウンター

公開会議録ページのURLを `sources.csv` に登録し、発言開始記号 `○` `◆` `◎` を使って機械的に発言回数と質疑答弁回数を集計する静的ツールです。OpenAI APIやAI分類は使いません。

## できること

- 発言者ラベル別、発言者氏名別、記号別の発言回数を確認できます。
- `◎` の発言を答弁として、直近の `◆` の発言者に紐づけます。
- 答弁者別の答弁回数、質疑者ごとの答弁者別回数を確認できます。
- 直近の質疑者がない `◎` は未紐づけ答弁として一覧表示します。
- 発言一覧を検索できます。

## sources.csv

`minutes-counter/sources.csv` に次の列でURLを登録します。

```csv
url,enabled,note
https://ssp.kaigiroku.net/tenant/narashino/SpMinuteView.html?power_user=false&tenant_id=161&council_id=718&schedule_id=3&view_years=,1,
```

- `url`: 公開会議録ページのURL
- `enabled`: `1` の行だけ処理対象
- `note`: 任意メモ

同じURLが複数ある場合は1回だけ処理します。

## ローカル実行

依存パッケージを入れてからデータを生成します。

```bash
pip install requests beautifulsoup4 lxml
python minutes-counter/scripts/build_data.py
```

生成されるファイルは次のとおりです。

- `minutes-counter/data/raw/*.json`
- `minutes-counter/data/speeches.js`
- `minutes-counter/data/qa_links.js`
- `minutes-counter/data/summary.js`

## GitHub Actions

`minutes-counter/.github/workflows/update-minutes.yml` は `workflow_dispatch` に対応しています。あわせて、GitHubが実際に認識するリポジトリ直下の `.github/workflows/update-minutes.yml` にも同じワークフローを置いています。

GitHubのActions画面から `Update minutes counter data` を手動実行すると、Python 3.12で `build_data.py` を実行し、`minutes-counter/data/*.js` と `minutes-counter/data/raw/*` に変更があればコミットします。

## GitHub Pagesで見る

GitHub Pagesをリポジトリのルートから公開している場合の表示URL例です。

```text
https://YaMac33.github.io/toGitHub/minutes-counter/app/
```

`app/index.html` は `../data/*.js` を読み込むだけの静的HTMLなので、GitHub Pages上でそのまま動きます。

## 裏側APIについて

対象例の `SpMinuteView.html` は初期HTML内に本文がなく、JavaScriptで `table#lst-minute` に本文を表示するタイプです。そのため、単純なHTML取得だけでは本文を取得できない場合があります。

現在の `scripts/fetch_minutes.py` は、URLから `tenant_id`、`council_id`、`schedule_id`、`view_years` などのクエリパラメータを抽出し、初期HTMLに本文がない場合は分かりやすいエラーを出します。裏側APIのURLやパラメータが特定できたら、`fetch_minutes_from_backend_api()` に取得処理を追加してください。

## 分割ルール

発言開始は行頭の記号だけを見ます。

- `○` → `chair`
- `◆` → `questioner`
- `◎` → `answerer`
- その他 → `unknown`

例:

```text
○議長（〇〇〇〇君）
◆２０番（〇〇〇〇君）
◎都市環境部長（〇〇〇〇君）
```

`speaker_label` は `議長`、`２０番`、`都市環境部長` などです。`speaker_name` は括弧内から `君` などを除いた文字列です。

## 質疑者→答弁者の紐づけルール

1. `role_type == questioner` の発言が出たら、現在の質疑者として保持します。
2. `role_type == answerer` の発言が出たら、直近の質疑者に紐づけます。
3. `chair` の発言は紐づけに使いません。
4. 現在の質疑者がない状態の `answerer` は未紐づけ答弁にします。
5. 実際の答弁者は `◎` の発言者を正とします。

## 未紐づけ答弁の確認

画面の「未紐づけ答弁一覧」に、`answer_speech_id`、答弁者ラベル、答弁者氏名、本文冒頭が表示されます。取得・分割結果を確認し、必要に応じて元会議録や発言開始記号の扱いを見直してください。
