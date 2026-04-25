# Local Chat App

Node.js + Express + HTML/CSS/JavaScriptで作った、ローカル学習用の小さなチャットアプリです。

## 起動方法

```bash
cd chat-app
npm install
node server/server.js
```

ブラウザで次のURLを開きます。

```text
http://localhost:3000
```

## ログインユーザー

| ユーザー名 | パスワード |
| --- | --- |
| userA | passA |
| userB | passB |

## 使い方

1. `userA/passA` または `userB/passB` でログインします。
2. チャット画面でメッセージを入力して送信します。
3. メッセージは `server/data/messages.json` に保存されます。
4. 画面は3秒ごとに `GET /api/messages` で新着メッセージを取得します。

## API

### POST /api/login

リクエスト:

```json
{
  "username": "userA",
  "password": "passA"
}
```

成功時:

```json
{
  "ok": true,
  "user": {
    "id": "userA",
    "name": "userA"
  }
}
```

失敗時:

```json
{
  "ok": false,
  "message": "ログイン失敗"
}
```

### GET /api/messages

`server/data/messages.json` の内容を返します。

### POST /api/messages

リクエスト:

```json
{
  "userId": "userA",
  "userName": "userA",
  "text": "こんにちは"
}
```

サーバー側で `id` と `time` を付けて保存します。

## 注意

このアプリはローカル利用・学習用です。本番向けの認証、暗号化、アクセス制御は実装していません。
