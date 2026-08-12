/**
 * 家計簿Webアプリ - GAS本体（HtmlService配信版）
 *
 * 【GASプロジェクトの構成】
 *   コード.gs   … このファイルの内容
 *   index.html  … フロント（HTMLファイルとして追加）
 *
 * 【index.html の追加方法】
 *   GASエディタ左の「ファイル」→「＋」→「HTML」→ ファイル名を index にする
 *
 * 【デプロイ方法】
 *   1. 右上「デプロイ」→「新しいデプロイ」
 *   2. 種類：ウェブアプリ
 *   3. 実行ユーザー：自分
 *   4. アクセスできるユーザー：自分のみ（本人利用のため）
 *   5. 発行されたURLを開くと家計簿画面が表示されます
 *
 * 【初回セットアップ】
 *   setup() を一度だけ実行してスプレッドシートを作成してください（setup.gs）
 */

const SHEET_NAME_TRANSACTIONS = 'Transactions';
const SHEET_NAME_CATEGORIES = 'Categories';
const HEADER_ROW = 2;     // 列名(プロパティ名)が入っている行
const DATA_START_ROW = 3; // データ開始行

// ------------------------------
// 画面配信
// ------------------------------

function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('家計簿')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ==============================
// 以下、google.script.run から呼ばれる公開関数
// ==============================

/** 指定月の取引一覧を返す（month: 'YYYY-MM'、省略時は全件） */
function apiListTransactions(month) {
  const sheet = getSheet_(SHEET_NAME_TRANSACTIONS);
  const rows = readObjects_(sheet);
  const filtered = month
    ? rows.filter(function (r) { return String(r.date).indexOf(month) === 0; })
    : rows;
  return filtered.sort(byDateDesc_);
}

/** カテゴリ一覧を返す */
function apiListCategories() {
  const sheet = getSheet_(SHEET_NAME_CATEGORIES);
  return readObjects_(sheet).sort(function (a, b) {
    if (a.type !== b.type) return a.type === 'income' ? 1 : -1;
    return Number(a.order) - Number(b.order);
  });
}

/** 取引を1件追加 */
function apiAddTransaction(payload) {
  const sheet = getSheet_(SHEET_NAME_TRANSACTIONS);
  const now = isoString_(new Date());
  const record = {
    id: generateTransactionId_(payload.date),
    date: payload.date,
    amount: Number(payload.amount),
    category: payload.category || '',
    memo: payload.memo || '',
    payment: payload.payment || '',
    tag: payload.tag || '',
    source: payload.source || 'manual',
    createdAt: now,
    updatedAt: now,
  };
  appendObject_(sheet, record);
  return record;
}

/** 取引を更新 */
function apiUpdateTransaction(payload) {
  const sheet = getSheet_(SHEET_NAME_TRANSACTIONS);
  const rows = readObjects_(sheet);
  const idx = rows.findIndex(function (r) { return String(r.id) === String(payload.id); });
  if (idx === -1) throw new Error('取引が見つかりません: ' + payload.id);

  const keys = getKeys_(sheet);
  const updated = Object.assign({}, rows[idx], {
    date: payload.date !== undefined ? payload.date : rows[idx].date,
    amount: payload.amount !== undefined ? Number(payload.amount) : rows[idx].amount,
    category: payload.category !== undefined ? payload.category : rows[idx].category,
    memo: payload.memo !== undefined ? payload.memo : rows[idx].memo,
    payment: payload.payment !== undefined ? payload.payment : rows[idx].payment,
    tag: payload.tag !== undefined ? payload.tag : rows[idx].tag,
    updatedAt: isoString_(new Date()),
  });

  writeRow_(sheet, idx + DATA_START_ROW, keys, updated);
  return updated;
}

/** 取引を削除 */
function apiDeleteTransaction(id) {
  const sheet = getSheet_(SHEET_NAME_TRANSACTIONS);
  const rows = readObjects_(sheet);
  const idx = rows.findIndex(function (r) { return String(r.id) === String(id); });
  if (idx === -1) throw new Error('取引が見つかりません: ' + id);
  sheet.deleteRow(idx + DATA_START_ROW);
  return true;
}

/** CSV一括登録 rows: [{date, amount, category, memo, payment, tag}, ...] */
function apiBulkAddTransactions(rows) {
  if (!rows || rows.length === 0) return [];
  const sheet = getSheet_(SHEET_NAME_TRANSACTIONS);
  const now = isoString_(new Date());
  const counters = buildDailyCounters_(sheet);

  const records = rows.map(function (row) {
    const ymd = toYYMMDD_(row.date);
    counters[ymd] = (counters[ymd] || 0) + 1;
    if (counters[ymd] > 99) throw new Error('同一日の取引が99件を超えました: ' + ymd);
    const seq = ('00' + counters[ymd]).slice(-2);
    return {
      id: ymd + seq,
      date: row.date,
      amount: Number(row.amount),
      category: row.category || '',
      memo: row.memo || '',
      payment: row.payment || '',
      tag: row.tag || '',
      source: 'csv',
      createdAt: now,
      updatedAt: now,
    };
  });

  const keys = getKeys_(sheet);
  const values = records.map(function (r) { return keys.map(function (k) { return r[k]; }); });
  sheet.getRange(sheet.getLastRow() + 1, 1, values.length, keys.length).setValues(values);
  return records;
}

/** カテゴリを追加 */
function apiAddCategory(payload) {
  const sheet = getSheet_(SHEET_NAME_CATEGORIES);
  const existing = readObjects_(sheet);
  if (existing.some(function (c) { return c.name === payload.name; })) {
    throw new Error('同じ名前のカテゴリが既にあります: ' + payload.name);
  }
  const maxOrder = existing
    .filter(function (c) { return c.type === payload.type; })
    .reduce(function (m, c) { return Math.max(m, Number(c.order) || 0); }, 0);

  const record = { name: payload.name, type: payload.type, order: maxOrder + 1 };
  appendObject_(sheet, record);
  return record;
}

/** カテゴリを削除 */
function apiDeleteCategory(name) {
  const sheet = getSheet_(SHEET_NAME_CATEGORIES);
  const rows = readObjects_(sheet);
  const idx = rows.findIndex(function (c) { return c.name === name; });
  if (idx === -1) throw new Error('カテゴリが見つかりません: ' + name);
  sheet.deleteRow(idx + DATA_START_ROW);
  return true;
}

/** 起動時に一括で必要データを取得（通信回数を減らすため） */
function apiGetInitialData(month) {
  return {
    transactions: apiListTransactions(month),
    categories: apiListCategories(),
  };
}

// ------------------------------
// ID採番
// ------------------------------

function generateTransactionId_(dateStr) {
  const sheet = getSheet_(SHEET_NAME_TRANSACTIONS);
  const ymd = toYYMMDD_(dateStr);
  const ids = readObjects_(sheet).map(function (r) { return String(r.id); });
  const seqNums = ids
    .filter(function (id) { return id.indexOf(ymd) === 0 && id.length === 8; })
    .map(function (id) { return Number(id.slice(6, 8)); });
  const nextSeq = seqNums.length > 0 ? Math.max.apply(null, seqNums) + 1 : 1;
  if (nextSeq > 99) throw new Error('同一日の取引が99件を超えました: ' + ymd);
  return ymd + ('00' + nextSeq).slice(-2);
}

function buildDailyCounters_(sheet) {
  const counters = {};
  readObjects_(sheet).forEach(function (r) {
    const id = String(r.id);
    if (id.length !== 8) return;
    const ymd = id.slice(0, 6);
    const seq = Number(id.slice(6, 8));
    counters[ymd] = Math.max(counters[ymd] || 0, seq);
  });
  return counters;
}

function toYYMMDD_(dateStr) {
  const parts = String(dateStr).split('-');
  if (parts.length !== 3) throw new Error('日付の形式が不正です: ' + dateStr);
  return parts[0].slice(2) + parts[1] + parts[2];
}

function byDateDesc_(a, b) {
  if (a.date === b.date) return String(b.id).localeCompare(String(a.id));
  return a.date < b.date ? 1 : -1;
}

// ------------------------------
// シート読み書き共通ユーティリティ
// ------------------------------

function getSheet_(name) {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!spreadsheetId) throw new Error('SPREADSHEET_ID が未設定です。setup() を先に実行してください。');
  const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(name);
  if (!sheet) throw new Error('シートが見つかりません: ' + name);
  return sheet;
}

function getKeys_(sheet) {
  return sheet.getRange(HEADER_ROW, 1, 1, sheet.getLastColumn()).getValues()[0];
}

function readObjects_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < DATA_START_ROW) return [];
  const keys = getKeys_(sheet);
  const values = sheet.getRange(DATA_START_ROW, 1, lastRow - DATA_START_ROW + 1, keys.length).getValues();
  return values.map(function (row) {
    const obj = {};
    keys.forEach(function (key, i) { obj[key] = normalizeValue_(row[i]); });
    return obj;
  });
}

function normalizeValue_(value) {
  if (value instanceof Date) return isoString_(value);
  return value;
}

function appendObject_(sheet, obj) {
  const keys = getKeys_(sheet);
  const row = keys.map(function (k) { return obj[k]; });
  sheet.getRange(sheet.getLastRow() + 1, 1, 1, row.length).setValues([row]);
}

function writeRow_(sheet, rowIndex, keys, obj) {
  const row = keys.map(function (k) { return obj[k]; });
  sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
}

function isoString_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
}
