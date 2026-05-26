// ==============================
// 共通設定
// ==============================

const SHEET_NAME_ORDERS = 'orders';
const SHEET_NAME_MENUS = 'menus';
const SHEET_NAME_SIZE_OPTIONS = 'size_options';
const PUBLIC_SHEET_NAME = '公開用';

// 公開用スプレッドシート
// URLのままでもOK。getPublicSpreadsheetId_() でIDだけ抽出します。
const PUBLIC_SPREADSHEET_ID = '1WCJv6eWujP5MuRLeAnlDq691N9jSkbieWPQkAzq20ME';

// Slack Webhook URLはスクリプトプロパティに保存する
const SLACK_WEBHOOK_URL_PROPERTY_KEY = 'SLACK_WEBHOOK_URL';

const PUBLIC_HEADERS = [
  'タイムスタンプ',
  '部署',
  'メニュー',
  'サイズ',
  '基本単価',
  'サイズ加算額',
  '単価',
  '数量'
];

const ORDER_HEADERS_COUNT = 12;