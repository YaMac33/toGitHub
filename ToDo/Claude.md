# 業務ToDo（着手可能 / 待ち 管理アプリ）

地方議会事務局の業務ToDoを管理する単一ファイルWebアプリ。
締切（期限）順ではなく「着手可能になった順」でタスクを見せることを目的とする。

## このプロジェクトの肝

タスクには「期限（deadline）」とは別に「いつ着手できるようになるか（着手可能条件）」がある。
この2つを混同しないこと。並び順を決めるのは着手可能状態であって、期限は表示と各グループ内の整列キーにすぎない。

着手可能条件は3種類あり、組み合わせ可能：
1. 条件なし … すぐ着手可能
2. 前提タスクの完了後 … `dependsOn` に挙げた全タスクが `done`
3. 指定日以降 … `startDate` が到来済み

**判定ルール（`statusOf`）**：`done` なら完了。そうでなく「前提タスク未完了 または 着手可能日が未来」なら **待ち（wait）**。両方クリアして初めて **着手可能（go）**。

画面は上から「① 着手可能 → ② 待ち → ③ 完了」の3グループ。各グループ内は期限の昇順。
待ちタスクには理由を表示：日付待ちは「📅 M/D から」、タスク待ちは「⏳ ◯◯ 待ち」、両方あれば両方。

## ファイル構成

- `index.html` — アプリ本体。UI・ロジック・スタイルを1ファイルに同梱。ビルド工程なし。
- `data.js` — タスクデータ。`window.TODO_DATA = { version, updatedAt, tasks:[...] }` 形式の**プレーンなJavaScript**。
- `CLAUDE.md` / `README.md` — ドキュメント。

### data.js のタスク項目
```js
{ id: "t1", title: "…", deadline: "2026-06-18", startDate: "", dependsOn: ["t2"], done: false }
```
- `deadline` / `startDate` … `"YYYY-MM-DD"`。未設定は `""`。
- `dependsOn` … 前提タスクの `id` 配列。
- `id` は重複しない文字列。新規はアプリ側で `"t"+Date.now().toString(36)` を採番。

## アーキテクチャ上の制約（変更時に必ず守る）

- **単一ファイル構成を維持する。** フレームワーク・バンドラ・npm依存を導入しない。素のHTML/CSS/JSのみ。
- **data.js は JSON にしない。** 庁内にJSONを扱いにくい環境があるため、あえてJS変数代入形式。読み込みは `new Function("window", text)` でサンドボックス実行してパースする（`parseDataJs`）。書き出しは `serialize()` で同形式を再生成。
- **保存は File System Access API。** `showOpenFilePicker` でユーザーが選んだ `data.js` を `createWritable()` で直接上書き。`data.js` はリポジトリではなく共有フォルダに置く運用（＝中身がGitHub Pages上で公開されない）。
- ファイル参照は IndexedDB（`todoFS` / `kv`）に保持し、次回「再接続」をワンクリックで出す。
- **API非対応ブラウザ（Firefox / Safari）でも壊れない**よう全て try/catch でガードし、未対応時は警告表示＋「ダウンロード」フォールバックで動く。
- localStorage / IndexedDB へのアクセスは必ず try/catch で囲む（`lsSafe`, `idbGet/idbSet` 参照）。タスクデータ自体はブラウザに永続させない（真実の在り処は data.js）。
- HTMLエスケープは `esc()` を必ず通す。`<form>` は使わない（onClick/onChange のみ）。
- UI文言は日本語。

## ローカルでの動作確認

File System Access API は **https または localhost でしか有効にならない**。`file://`（ダブルクリック起動）では保存できない。
```
npx serve .      # もしくは VS Code の Live Server 拡張
```
で配信し、Chrome / Edge で開いて確認すること。

## デプロイ

`index.html` を GitHub Pages（https配信）に置く。`data.js` は共有フォルダに置き、アプリの「データを開く」で接続する。
`index.html` と `data.js` を同じ階層に置く構成も可能だが、その場合 data.js の中身が公開される点に注意。

## 既知の制約・今後の検討余地

- 対応ブラウザは Chrome / Edge のみ。
- ネットワークドライブ（UNCパス・割り当てドライブ）は書き込みが弾かれる場合がある。
- 同時編集は後勝ち（最後に保存した人で上書き）。必要なら「保存前に最新を読み直して差分警告」を追加する余地あり。