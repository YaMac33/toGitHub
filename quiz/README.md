# 一問一答Webアプリ（内部README）

## ■ 概要
Googleフォームを入力UIとして使用し、送信されたJSONデータをスプレッドシートに蓄積し、Apps Scriptで整形・GitHubに自動反映することで、GitHub Pages上の一問一答Webアプリの問題データ（data.js）を自動更新する仕組み。

---

## ■ 全体構成

Googleフォーム
  ↓（JSON文字列）
スプレッドシート（RAW保存）
  ↓（Apps Script）
data.js生成
  ↓（GitHub API）
リポジトリ更新
  ↓
GitHub Pagesに反映

---

## ■ 使用技術

- HTML / CSS / JavaScript（フロント）
- JSON（問題データ）
- Googleフォーム（入力）
- Googleスプレッドシート（データ保存）
- Google Apps Script（データ変換＋GitHub連携）
- GitHub API（ファイル更新）
- GitHub Pages（公開）

---

## ■ データ仕様（最終形式）

{
  "id": "queue-01",
  "question": "待ち行列 → 基本モデルは？",
  "answer": ["M/M/1", "mm1"],
  "explanation": "到着ポアソン・サービス指数分布"
}

---

## ■ フォーム仕様

### 入力欄
- 1項目のみ
  - JSON貼り付け欄

### 入力例

{
  "id": "queue-01",
  "question": "待ち行列 → 基本モデルは？",
  "answer": ["M/M/1", "mm1"],
  "explanation": "到着ポアソン・サービス指数分布"
}

---

## ■ スプレッドシート仕様

| A列 | B列 |
|----|----|
| タイムスタンプ | RAW |

- 1行目：ヘッダー
- 2行目以降：データ
- B列にJSON文字列をそのまま保存

---

## ■ GAS仕様

### 役割
1. B列のJSONを全件取得
2. JSON.parseで配列化
3. data.js生成
4. GitHub APIで上書き

---

### スクリプトプロパティ

GITHUB_TOKEN
GITHUB_OWNER
GITHUB_REPO
GITHUB_PATH
GITHUB_BRANCH

---

### トリガー

- イベント：フォーム送信時
- ソース：スプレッドシート
- 関数：onFormSubmit

---

## ■ GitHub仕様

### 対象ファイル

data.js

### 初期状態

[]

---

### 更新方法
- GitHub REST API
- PUT /repos/{owner}/{repo}/contents/data.js

---

## ■ フロント仕様

### 機能

- 問題ランダム表示
- テキスト入力回答
- 完全一致判定
- 正誤表示
- 解説表示
- wrong管理
- correct昇格（2回連続正解）
- localStorageで履歴保持

---

## ■ データフロー

入力（フォーム）
  ↓
RAW保存（スプシ）
  ↓
JSON配列化（GAS）
  ↓
GitHub更新
  ↓
Webアプリ反映

---

## ■ エラー対策

### JSON破損
- try-catchでスキップ

### 空データ
- 無視

### API制限
- 全件まとめて更新

---

## ■ 設計思想

- 入力と表示の完全分離
- データはJSONで一元管理
- UIは極力シンプル
- 自動化優先
- 手動編集不要

---

## ■ 今後の拡張

- id重複チェック
- 自動id生成
- バリデーション強化
- 難易度管理
- タグ検索
- 学習履歴分析

---

## ■ 注意事項

- JSON形式は厳守
- GitHubトークンは公開しない
- data.jsは必ず存在させる
- スプシ構造は変更しない

---

## ■ 一言

この仕組みは「入力＝フォーム」「処理＝GAS」「表示＝GitHub Pages」という役割分離によって、最小コストで拡張性の高い学習システムを実現している。
