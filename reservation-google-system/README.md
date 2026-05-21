# Googleサービスだけで動く予約申請・承認・カレンダー表示システム

Googleサイトを予約ポータルにし、Googleフォーム、Googleスプレッドシート、Googleカレンダー、Google Apps Scriptで完結する最小実用版です。利用者はGoogleサイト上で予約状況を確認し、Googleフォームから申請します。管理者は回答先スプレッドシートの「ステータス」を変更するだけで、承認、却下、取消の通知とGoogleカレンダー登録を自動処理できます。

## ファイル構成

```text
/reservation-google-system/
  README.md
  setup-checklist.md
  google-sites-pages.md
  form-fields.md
  spreadsheet-columns.md
  Code.gs
  Index.html
  Style.html
  Script.html
```

## 全体構成

```text
利用者向け
├─ Googleサイト
│  ├─ 予約状況ページ
│  │  └ GAS Webアプリを埋め込み
│  └─ 予約申請ページ
│     └ Googleフォームを埋め込み
│
管理者向け
├─ Googleスプレッドシート
│  └─ 申請一覧
│     ├─ ステータス
│     ├─ 管理メモ
│     └─ カレンダーイベントID
│
自動処理
└─ Google Apps Script
   ├─ 受付メール
   ├─ 承認メール
   ├─ 却下メール
   ├─ 取消通知メール
   ├─ 重複チェック
   ├─ Googleカレンダー登録
   └─ 予約状況Webアプリ
```

## 重要な前提

- フォーム回答先スプレッドシートのシート名は `申請一覧` にします。
- Apps Scriptプロジェクトのタイムゾーンは `Asia/Tokyo` にします。
- GoogleカレンダーIDは `Code.gs` の `CONFIG.CALENDAR_ID` に設定します。
- ステータスは `未処理`、`承認`、`却下`、`取消` を使います。
- `Code.gs`、`Index.html`、`Style.html`、`Script.html` はApps Scriptエディタに同名ファイルとして貼り付けます。

## FullCalendarについて

この最小版の画面は、GAS Webアプリ内のHTMLでFullCalendarを使います。外部CDNへ依存しないように、FullCalendarのglobal bundleを `Script.html` に同梱しています。

FullCalendarを更新したい場合は、`Script.html` 冒頭のFullCalendar bundle部分を新しいglobal bundleに差し替えてください。予約データ、申請、承認、カレンダー登録、メール送信は外部サーバーを使いません。

FullCalendarはMIT Licenseのライブラリです。`Script.html` 冒頭に著作権表示とライセンス参照を残しています。

## セットアップ手順

### 1. Googleカレンダーを用意する

1. Googleカレンダーで予約管理用カレンダーを作成します。
2. カレンダーの設定画面を開きます。
3. 「カレンダーの統合」にあるカレンダーIDをコピーします。
4. `Code.gs` の `CONFIG.CALENDAR_ID` に貼り付けます。

例:

```javascript
CALENDAR_ID: 'xxxxx@group.calendar.google.com'
```

### 2. Googleフォームを作成する

`form-fields.md` の通りにフォーム項目を作成します。

フォーム項目:

- メールアドレス
- 氏名
- 所属
- 利用場所
- 希望日
- 開始時刻
- 終了時刻
- 利用目的
- 備考

回答先はGoogleスプレッドシートにし、シート名を `申請一覧` に変更します。

### 3. 回答先スプレッドシートを整える

フォーム回答列の右側に、次の管理列を追加します。

- ステータス
- 管理メモ
- カレンダーイベントID
- 処理日時
- 処理結果
- 重複チェック結果

Apps Scriptの `setupSheet` を実行すると、不足している管理列、ステータスのプルダウン、簡易説明シートを自動作成できます。

### 4. Apps Scriptを作成する

1. 回答先スプレッドシートで「拡張機能」→「Apps Script」を開きます。
2. `Code.gs` を貼り付けます。
3. HTMLファイルを3つ追加します。
   - `Index.html`
   - `Style.html`
   - `Script.html`
4. 各ファイルに、このフォルダ内の同名ファイルの内容を貼り付けます。
5. プロジェクト設定でタイムゾーンを `Asia/Tokyo` にします。
6. `Code.gs` の `CONFIG.CALENDAR_ID` を自分のカレンダーIDに変更します。
7. `setupSheet` を手動実行して権限を承認します。

### 5. トリガーを設定する

Apps Scriptの「トリガー」から次を追加します。

| 実行する関数 | イベントのソース | イベントの種類 |
|---|---|---|
| `handleFormSubmit` | スプレッドシートから | フォーム送信時 |
| `handleStatusEdit` | スプレッドシートから | 編集時 |

`handleStatusEdit` は、ステータス列が編集された場合だけ処理します。

### 6. Webアプリとしてデプロイする

1. Apps Scriptで「デプロイ」→「新しいデプロイ」を選びます。
2. 種類は「ウェブアプリ」にします。
3. 実行するユーザーは「自分」にします。
4. アクセスできるユーザーは運用方針に合わせて選びます。
   - 組織内だけ: 組織のユーザー
   - 公開ポータル: 全員
5. デプロイ後に表示されるWebアプリURLをコピーします。
6. Googleサイトの「予約状況」ページに埋め込みます。

### 7. Googleサイトを作成する

`google-sites-pages.md` の構成でページを作ります。

- トップページ
- 予約状況
- 予約申請
- 利用ルール
- 管理者向け

「予約状況」ページにはGAS WebアプリURLを埋め込み、「予約申請」ページにはGoogleフォームを埋め込みます。

## 運用フロー

1. 利用者がGoogleフォームから予約申請します。
2. GASがステータスを `未処理` にし、受付メールを送信します。
3. 管理者がスプレッドシートで申請内容を確認します。
4. 管理者が `ステータス` を変更します。
5. `承認` の場合、GASが重複チェック後にGoogleカレンダーへ登録し、承認メールを送信します。
6. `却下` の場合、GASが却下メールを送信します。
7. `取消` の場合、GASがカレンダー予定を削除または取消表示にし、取消通知メールを送信します。

## 表示設定

`Code.gs` の `VIEW_CONFIG` で、予約状況Webアプリに表示する情報を調整できます。

```javascript
const VIEW_CONFIG = {
  listMode: 'standard',
  showName: false,
  showDepartment: true,
  showEmail: false,
  showPurpose: true,
  showNote: false,
  showAdminMemo: false,
  showProcessedAt: false,
  visibleStatuses: ['承認']
};
```

利用者向け公開画面では、`showEmail` と `showAdminMemo` は通常 `false` にしてください。

## 二重処理対策

- 承認済み行に `カレンダーイベントID` がある場合、再承認してもイベントを二重作成しません。
- `処理結果` に通知済みの記録がある場合、同じステータスの再編集ではメールを二重送信しません。
- ステータス列以外の編集では自動処理しません。
- 同時処理を避けるため、GASの `LockService` を使っています。

## 取消方式

`Code.gs` の `CONFIG.CANCEL_MODE` で変更できます。

```javascript
CANCEL_MODE: 'delete'
```

- `delete`: Googleカレンダーの予定を削除します。
- `mark`: 予定は残し、タイトルに `【取消】` を付けます。

監査履歴をカレンダー上にも残したい場合は `mark` を選んでください。
