/**
 * 家計簿Webアプリ - 初期セットアップスクリプト
 *
 * 使い方：
 * 1. https://script.google.com/ で新規プロジェクトを作成
 * 2. このファイルの内容をコピーして貼り付け
 * 3. setup() 関数を選択して実行（初回のみ）
 * 4. 実行後、ログに表示されるスプレッドシートのURLとIDを確認
 *    （IDは以降 Script Properties に自動保存されるので、
 *     通常はこの値を別途メモしておく必要はありません）
 */

const SHEET_NAME_TRANSACTIONS = 'Transactions';
const SHEET_NAME_CATEGORIES = 'Categories';

// Transactions シートのヘッダー定義
// [1行目: 日本語ラベル, 2行目: 列名(プロパティ名)]
const TRANSACTIONS_HEADERS = [
  ['ID', 'id'],
  ['日付', 'date'],
  ['金額', 'amount'],
  ['カテゴリ', 'category'],
  ['摘要', 'memo'],
  ['支払い方法', 'payment'],
  ['タグ', 'tag'],
  ['登録元', 'source'],
  ['登録日時', 'createdAt'],
  ['更新日時', 'updatedAt'],
];

// Categories シートのヘッダー定義
const CATEGORIES_HEADERS = [
  ['カテゴリ名', 'name'],
  ['種別', 'type'],
  ['表示順', 'order'],
];

// デフォルトで用意しておく初期カテゴリ（自由に編集可能な運用の初期値）
const DEFAULT_CATEGORIES = [
  ['食費', 'expense', 1],
  ['日用品', 'expense', 2],
  ['交通費', 'expense', 3],
  ['交際費', 'expense', 4],
  ['趣味・娯楽', 'expense', 5],
  ['住居費', 'expense', 6],
  ['水道光熱費', 'expense', 7],
  ['通信費', 'expense', 8],
  ['医療費', 'expense', 9],
  ['その他支出', 'expense', 10],
  ['給与', 'income', 1],
  ['その他収入', 'income', 2],
];

/**
 * 初回セットアップ：スプレッドシート作成 + シート初期化 + IDをScript Propertiesに保存
 */
function setup() {
  const existingId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (existingId) {
    const url = SpreadsheetApp.openById(existingId).getUrl();
    Logger.log('既にセットアップ済みです。');
    Logger.log('Spreadsheet ID: ' + existingId);
    Logger.log('URL: ' + url);
    return;
  }

  const ss = SpreadsheetApp.create('家計簿データ_' + formatDateForName_(new Date()));
  const spreadsheetId = ss.getId();

  setupTransactionsSheet_(ss);
  setupCategoriesSheet_(ss);

  // デフォルトで作られる「シート1」を削除
  const defaultSheet = ss.getSheetByName('シート1');
  if (defaultSheet) {
    ss.deleteSheet(defaultSheet);
  }

  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', spreadsheetId);

  Logger.log('セットアップ完了');
  Logger.log('Spreadsheet ID: ' + spreadsheetId);
  Logger.log('URL: ' + ss.getUrl());
}

function setupTransactionsSheet_(ss) {
  const sheet = ss.insertSheet(SHEET_NAME_TRANSACTIONS);
  const labels = TRANSACTIONS_HEADERS.map(function (h) { return h[0]; });
  const keys = TRANSACTIONS_HEADERS.map(function (h) { return h[1]; });

  sheet.getRange(1, 1, 1, labels.length).setValues([labels]);
  sheet.getRange(2, 1, 1, keys.length).setValues([keys]);

  sheet.getRange(1, 1, 1, labels.length).setFontWeight('bold');
  sheet.getRange(2, 1, 1, keys.length).setFontWeight('bold').setFontColor('#666666');
  sheet.setFrozenRows(2);

  // 列幅の目安調整
  sheet.setColumnWidth(1, 90);  // ID
  sheet.setColumnWidth(2, 90);  // 日付
  sheet.setColumnWidth(3, 90);  // 金額
  sheet.setColumnWidth(4, 100); // カテゴリ
  sheet.setColumnWidth(5, 180); // 摘要
  sheet.setColumnWidth(6, 100); // 支払い方法
  sheet.setColumnWidth(7, 100); // タグ
  sheet.setColumnWidth(8, 80);  // 登録元
  sheet.setColumnWidth(9, 140); // 登録日時
  sheet.setColumnWidth(10, 140); // 更新日時
}

function setupCategoriesSheet_(ss) {
  const sheet = ss.insertSheet(SHEET_NAME_CATEGORIES);
  const labels = CATEGORIES_HEADERS.map(function (h) { return h[0]; });
  const keys = CATEGORIES_HEADERS.map(function (h) { return h[1]; });

  sheet.getRange(1, 1, 1, labels.length).setValues([labels]);
  sheet.getRange(2, 1, 1, keys.length).setValues([keys]);

  sheet.getRange(1, 1, 1, labels.length).setFontWeight('bold');
  sheet.getRange(2, 1, 1, keys.length).setFontWeight('bold').setFontColor('#666666');
  sheet.setFrozenRows(2);

  sheet.setColumnWidth(1, 120);
  sheet.setColumnWidth(2, 90);
  sheet.setColumnWidth(3, 80);

  // 初期カテゴリを3行目以降に投入
  if (DEFAULT_CATEGORIES.length > 0) {
    sheet.getRange(3, 1, DEFAULT_CATEGORIES.length, 3).setValues(DEFAULT_CATEGORIES);
  }
}

function formatDateForName_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss');
}

/**
 * 動作確認用：現在のスプレッドシートIDをログ表示するだけの関数
 */
function checkSpreadsheetId() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  Logger.log('SPREADSHEET_ID: ' + id);
}
