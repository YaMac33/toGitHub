# 弁当注文システム

部署単位で弁当を注文できる、GitHub Pages公開向けの静的Webアプリです。

Google SitesやGoogleフォームは使わず、HTML / CSS / JavaScriptだけで動作します。現時点ではGoogle Apps ScriptやGoogle Sheetsとは接続しておらず、`js/api.js` のモックAPIで注文、変更、キャンセル、注文一覧、集計を動かしています。

## 公開想定

このフォルダをそのままGitHub Pagesに配置して公開できます。ビルドツール、npm、外部CDNは使っていません。

## 現在の状態

- ダミーメニュー、受取日、注文データで動作
- 注文フォーム、変更・キャンセルフォームを実装済み
- 注文一覧の絞り込みを実装済み
- ACTIVEの注文のみを対象にした集計を実装済み
- API通信部分は `js/api.js` に分離済み

## GAS接続について

まだGAS WebアプリAPIとは接続していません。

後で本番接続する場合は、`js/config.example.js` を `js/config.js` にコピーし、GAS WebアプリURLを設定する想定です。その際、`index.html` の設定ファイル読み込み先も `js/config.js` に変更してください。

```js
const APP_CONFIG = {
  API_BASE_URL: "https://script.google.com/macros/s/xxxxxxxx/exec",
  USE_MOCK_API: false
};
```

## ファイル構成

```text
bento-order-app/
├─ index.html
├─ README.md
├─ css/
│  └─ style.css
├─ js/
│  ├─ app.js
│  ├─ api.js
│  ├─ state.js
│  ├─ render.js
│  ├─ validators.js
│  ├─ formatters.js
│  └─ config.example.js
└─ assets/
   └─ .gitkeep
```

## ローカルでの確認方法

`index.html` をブラウザで直接開いて確認できます。

ローカルサーバーで確認したい場合は、任意の静的ファイルサーバーで `bento-order-app` フォルダを公開してください。ビルドは不要です。

## 今後の接続予定

- GAS API接続
- Google Sheets保存
- メール通知
- 締切判定
