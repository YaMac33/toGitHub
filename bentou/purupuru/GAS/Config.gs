// ==============================
// 共通設定
// ==============================

const SHEET_NAME_ORDERS = 'orders';
const SHEET_NAME_MENUS = 'menus';
const PUBLIC_SHEET_NAME = '公開用';

// menus / orders を読む・書く元スプレッドシート。
// 空欄の場合は、このGASプロジェクトが紐づいているスプレッドシートを使います。
const SOURCE_SPREADSHEET_ID = '1eOXPn1uIxAEXMwE055P2qji25NXI1cEiLT2H4Sf8U3E';

// 公開用スプレッドシート
// URLのままでもOK。getPublicSpreadsheetId_() でIDだけ抽出します。
const PUBLIC_SPREADSHEET_ID = '1QOCKKHsGPwNjZThJ9jAdRQO3nw6MjzP5hb0sruMKC6g';

// Slack Webhook URLはスクリプトプロパティに保存する
const SLACK_WEBHOOK_URL_PROPERTY_KEY = 'SLACK_WEBHOOK_URL';

const PUBLIC_HEADERS = [
  'タイムスタンプ',
  '部署',
  'メニュー',
  'サイズ',
  '単価',
  '数量'
];

const ORDER_HEADERS_COUNT = 12;
