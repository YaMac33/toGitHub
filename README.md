
```
project/
├─ source.xlsm                 ← 正本データ（Excel）
│
└─ app/
    ├─ index.html
    │
    ├─ pages/
    │  ├─ members/
    │  │  ├─ members.html
    │  │  └─ member_detail.html
    │  ├─ meetings/
    │  │  ├─ meetings.html
    │  │  └─ meeting_detail.html
    │  ├─ items/
    │  │  ├─ items.html
    │  │  └─ item_detail.html
    │  ├─ questions/
    │  │  └─ questions.html
    │  └─ readme/
    │     └─ readme.html
    │
    ├─ js/
    │  ├─ core/
    │  │  ├─ utils.js
    │  │  ├─ formatters.js
    │  │  └─ app.js
    │  │
    │  ├─ members/
    │  │  ├─ view_members.js
    │  │  └─ view_member_detail.js
    │  │
    │  ├─ meetings/
    │  │  ├─ view_meetings.js
    │  │  └─ view_meeting_detail.js
    │  │
    │  ├─ items/
    │  │  ├─ view_items.js
    │  │  └─ view_item_detail.js
    │  │
    │  └─ questions/
    │     └─ （なし）
    │
    ├─ data/
    │  ├─ members/
    │  │  ├─ members.js
    │  │  ├─ office_terms.js
    │  │  ├─ parties.js
    │  │  ├─ member_parties.js
    │  │  └─ contacts.js
    │  │
    │  ├─ committees/
    │  │  ├─ committees.js
    │  │  ├─ member_committees.js
    │  │  ├─ special_committees.js
    │  │  ├─ special_committee_instances.js
    │  │  ├─ special_committee_meetings.js
    │  │  └─ special_committee_members.js
    │  │
    │  ├─ meetings/
    │  │  ├─ meetings.js
    │  │  ├─ event_types.js
    │  │  └─ events.js
    │  │
    │  ├─ items/
    │  │  ├─ items.js
    │  │  ├─ item_actions.js
    │  │  └─ council_terms.js
    │  │
    │  ├─ councils/
    │  │  ├─ councils.js
    │  │  └─ member_councils.js
    │  │
    │  └─ questions/
    │     └─ questions.js
    │
    └─ source/
      └─ （なし or 未使用）

```

# 議員管理システム（内部向けREADME）

---

# 1. 概要

本システムは、市議会議員の情報をExcelで管理し、Webアプリとして参照する仕組みです。
```
Excel（正本データ）
↓
VBAでJS生成
↓
HTML + JavaScriptで表示（LG環境対応）
```
■ 特徴
- サーバ不要（LGWAN環境対応）
- Excelが正本（非エンジニアでも運用可能）
- 履歴ベース設計（在任・会派・委員会など）
- IDでデータを紐づけ（DB的構造）

---

# 2. システム構成

■ ディレクトリ構成
```
project/
├─ source.xlsm                 ← 正本データ（Excel）
│
└─ app/
    ├─ index.html
    │
    ├─ pages/
    │  ├─ members/
    │  │  ├─ members.html
    │  │  └─ member_detail.html
    │  ├─ meetings/
    │  │  ├─ meetings.html
    │  │  └─ meeting_detail.html
    │  ├─ items/
    │  │  ├─ items.html
    │  │  └─ item_detail.html
    │  ├─ questions/
    │  │  └─ questions.html
    │  └─ readme/
    │     └─ readme.html
    │
    ├─ js/
    │  ├─ core/
    │  │  ├─ utils.js
    │  │  ├─ formatters.js
    │  │  └─ app.js
    │  │
    │  ├─ members/
    │  │  ├─ view_members.js
    │  │  └─ view_member_detail.js
    │  │
    │  ├─ meetings/
    │  │  ├─ view_meetings.js
    │  │  └─ view_meeting_detail.js
    │  │
    │  ├─ items/
    │  │  ├─ view_items.js
    │  │  └─ view_item_detail.js
    │  │
    │  └─ questions/
    │     └─ （なし）
    │
    ├─ data/
    │  ├─ members/
    │  │  ├─ members.js
    │  │  ├─ office_terms.js
    │  │  ├─ parties.js
    │  │  ├─ member_parties.js
    │  │  └─ contacts.js
    │  │
    │  ├─ committees/
    │  │  ├─ committees.js
    │  │  ├─ member_committees.js
    │  │  ├─ special_committees.js
    │  │  ├─ special_committee_instances.js
    │  │  ├─ special_committee_meetings.js
    │  │  └─ special_committee_members.js
    │  │
    │  ├─ meetings/
    │  │  ├─ meetings.js
    │  │  ├─ event_types.js
    │  │  └─ events.js
    │  │
    │  ├─ items/
    │  │  ├─ items.js
    │  │  ├─ item_actions.js
    │  │  └─ council_terms.js
    │  │
    │  ├─ councils/
    │  │  ├─ councils.js
    │  │  └─ member_councils.js
    │  │
    │  └─ questions/
    │     └─ questions.js
    │
    └─ source/
      └─ （なし or 未使用）
```
---

# 3. データ設計

■ 基本ルール

- 1シート = 1JSファイル
- 1行 = 1レコード（オブジェクト）
- 1行目 = フィールド名（キー）
- IDでデータを紐づける
- 履歴は「開始日～終了日」で管理

---

■ 主なテーブル

【議員マスタ】
members.js
- 基本情報（氏名、生年月日など）

【在任履歴】
office_terms.js
- 任期単位で管理
- 現職/過去判定に使用

【会派】
parties.js / member_parties.js
- 会派マスタ + 所属履歴

【委員会】
committees.js / member_committees.js

【審議会】
councils.js / member_councils.js

【連絡先】
contacts.js
- 住所・電話・メール（履歴管理あり）

---

# 4. データの紐づけ（重要）

すべてIDで紐づける

- member_id → 全履歴
- party_id → 会派
- committee_id → 委員会
- council_id → 審議会

例：
```
members
  ↓ member_id
member_parties
  ↓ party_id
parties
```
---

# 5. 「現在」の考え方

以下を満たすものを「現在」とする
```
start_date <= 今日
AND
(end_date が空 or end_date >= 今日)
```
---

# 6. VBA（データ出力）

■ 実行方法
```
Alt + F8
↓
ExportAllData
```
■ 出力内容

Excel → app/data/*.js

例：
```
window.APP_DATA.members = [
  { member_id: "M001", member_name: "山田太郎" }
];
```
■ 運用方法

【初回】
```
ExportAllData（全出力）
```

【通常運用】
```
修正したシートを開く
↓
ExportActiveSheetData
```
---

# 7. 画面仕様（stable）

■ 一覧
- 議員一覧表示
- 現在状態を自動計算

表示内容：
- 現在会派
- 現在委員会（複数）
- 現在審議会（複数）

■ 検索
- 氏名
- 会派
- 在任状態

■ 詳細
一覧クリックで表示：

- 基本情報
- 現在所属
- 在任履歴
- 会派履歴
- 委員会履歴
- 審議会履歴
- 連絡先履歴

---

# 8. データ入力ルール（重要）

■ 必須ルール

- IDは一意
- IDは絶対に変更しない
- 名前で紐づけない

■ よくあるミス

- M001 と M1 の混在
- 全角スペース混入
- シート名ズレ
- ヘッダ空欄

---

# 9. トラブル対応

■ JSが表示されない
→ dataフォルダ未生成 or VBA未実行

■ 特定データだけおかしい
→ ID不整合

■ 現在判定がおかしい
→ 日付のズレ

---

# 10. 拡張性

今後追加可能：

- 議案
- 表決履歴
- 定例会
- 特別委員会

同じ設計で拡張可能

---

# 11. 設計思想（重要）
```
Excel = DB（正本）
JS = 配布データ
HTML = ビュー
```
一言で：
```
「ExcelをDBとして、ブラウザでJOINして表示するシステム」
```
---

# 12. 開発方針

- まず動かす
- 次に分離（app.js / view）
- 最後にUI強化

---

# まとめ

- サーバ不要の議員管理システム
- Excelベースで誰でも更新可能
- 履歴管理 + ID結合で柔軟性あり
