/**
 * 家計簿Webアプリ - API本体（Web App）
 *
 * デプロイ方法：
 * 1. GASエディタ右上「デプロイ」→「新しいデプロイ」
 * 2. 種類：ウェブアプリ
 * 3. 実行ユーザー：自分
 * 4. アクセスできるユーザー：全員（フロントHTMLから匿名fetchするため）
 * 5. デプロイ後に発行される「ウェブアプリURL」をフロント側のAPI_URLに設定
 *
 * エンドポイント仕様：
 * GET  ?action=list&month=YYYY-MM        -> 指定月の取引一覧
 * GET  ?action=categories                -> カテゴリ一覧
 * POST { action:'add', ... }             -> 取引追加
 * POST { action:'update', id, ... }      -> 取引編集
 * POST { action:'delete', id }           -> 取引削除
 * POST { action:'bulkAdd', rows:[...] }  -> CSV一括登録
 * POST { action:'addCategory', ... }     -> カテゴリ追加
 * POST { action:'updateCategory', ... }  -> カテゴリ編集
 * POST { action:'deleteCategory', name } -> カテゴリ削除
 */

const SHEET_NAME_TRANSACTIONS = 'Transactions';
const SHEET_NAME_CATEGORIES = 'Categories';
const HEADER_ROW = 2;   // 列名(プロパティ名)が入っている行
const DATA_START_ROW = 3; // データ開始行

// ------------------------------
// エントリポイント
// ------------------------------

function doGet(e) {
  try {
    const action = e.parameter.action;

    if (action === 'list') {
      const month = e.parameter.month; // 'YYYY-MM'
      return jsonResponse_({ ok: true, data: listTransactions_(month) });
    }

    if (action === 'categories') {
      return jsonResponse_({ ok: true, data: listCategories_() });
    }

    return jsonResponse_({ ok: false, error: 'unknown action: ' + action });
  } catch (err) {
    return jsonResponse_({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;

    switch (action) {
      case 'add':
        return jsonResponse_({ ok: true, data: addTransaction_(body) });
      case 'update':
        return jsonResponse_({ ok: true, data: updateTransaction_(body) });
      case 'delete':
        deleteTransaction_(body.id);
        return jsonResponse_({ ok: true });
      case 'bulkAdd':
        return jsonResponse_({ ok: true, data: bulkAddTransactions_(body.rows) });
      case 'addCategory':
        return jsonResponse_({ ok: true, data: addCategory_(body) });
      case 'updateCategory':
        return jsonResponse_({ ok: true, data: updateCategory_(body) });
      case 'deleteCategory':
        deleteCategory_(body.name);
        return jsonResponse_({ ok: true });
      default:
        return jsonResponse_({ ok: false, error: 'unknown action: ' + action });
    }
  } catch (err) {
    return jsonResponse_({ ok: false, error: String(err) });
  }
}

// ------------------------------
// Transactions
// ------------------------------

function listTransactions_(month) {
  const sheet = getSheet_(SHEET_NAME_TRANSACTIONS);
  const rows = readObjects_(sheet);
  if (!month) return rows.sort(byDateDesc_);
  return rows.filter(function (r) { return String(r.date).indexOf(month) === 0; })
             .sort(byDateDesc_);
}

function byDateDesc_(a, b) {
  if (a.date === b.date) return String(b.id).localeCompare(String(a.id));
  return a.date < b.date ? 1 : -1;
}

function addTransaction_(body) {
  const sheet = getSheet_(SHEET_NAME_TRANSACTIONS);
  const now = new Date();
  const record = {
    id: generateTransactionId_(body.date),
    date: body.date,
    amount: Number(body.amount),
    category: body.category || '',
    memo: body.memo || '',
    payment: body.payment || '',
    tag: body.tag || '',
    source: body.source || 'manual',
    createdAt: isoString_(now),
    updatedAt: isoString_(now),
  };
  appendObject_(sheet, record);
  return record;
}

function updateTransaction_(body) {
  const sheet = getSheet_(SHEET_NAME_TRANSACTIONS);
  const rowIndex = findRowIndexById_(sheet, body.id);
  if (rowIndex === -1) throw new Error('transaction not found: ' + body.id);

  const keys = getKeys_(sheet);
  const current = readObjects_(sheet)[rowIndex - DATA_START_ROW];

  const updated = Object.assign({}, current, {
    date: body.date !== undefined ? body.date : current.date,
    amount: body.amount !== undefined ? Number(body.amount) : current.amount,
    category: body.category !== undefined ? body.category : current.category,
    memo: body.memo !== undefined ? body.memo : current.memo,
    payment: body.payment !== undefined ? body.payment : current.payment,
    tag: body.tag !== undefined ? body.tag : current.tag,
    updatedAt: isoString_(new Date()),
  });

  writeRow_(sheet, rowIndex, keys, updated);
  return updated;
}

function deleteTransaction_(id) {
  const sheet = getSheet_(SHEET_NAME_TRANSACTIONS);
  const rowIndex = findRowIndexById_(sheet, id);
  if (rowIndex === -1) throw new Error('transaction not found: ' + id);
  sheet.deleteRow(rowIndex);
}

/**
 * CSV一括登録
 * rows: [{date, amount, category, memo, payment, tag}, ...]
 * 同一リクエスト内で日付が重複しても連番が正しく振られるよう、
 * メモリ上でカウンタを保持してから最後にまとめて書き込む。
 */
function bulkAddTransactions_(rows) {
  if (!rows || rows.length === 0) return [];
  const sheet = getSheet_(SHEET_NAME_TRANSACTIONS);
  const now = isoString_(new Date());

  // 既存IDの日付ごと連番カウンタを事前に構築
  const counters = buildDailyCounters_(sheet);

  const records = rows.map(function (row) {
    const ymd = toYYMMDD_(row.date);
    counters[ymd] = (counters[ymd] || 0) + 1;
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

// ------------------------------
// Categories
// ------------------------------

function listCategories_() {
  const sheet = getSheet_(SHEET_NAME_CATEGORIES);
  return readObjects_(sheet).sort(function (a, b) {
    if (a.type !== b.type) return a.type === 'income' ? 1 : -1;
    return Number(a.order) - Number(b.order);
  });
}

function addCategory_(body) {
  const sheet = getSheet_(SHEET_NAME_CATEGORIES);
  const existing = readObjects_(sheet);
  if (existing.some(function (c) { return c.name === body.name; })) {
    throw new Error('category already exists: ' + body.name);
  }
  const maxOrder = existing
    .filter(function (c) { return c.type === body.type; })
    .reduce(function (m, c) { return Math.max(m, Number(c.order) || 0); }, 0);

  const record = {
    name: body.name,
    type: body.type,
    order: body.order !== undefined ? Number(body.order) : maxOrder + 1,
  };
  appendObject_(sheet, record);
  return record;
}

function updateCategory_(body) {
  const sheet = getSheet_(SHEET_NAME_CATEGORIES);
  const keys = getKeys_(sheet);
  const rows = readObjects_(sheet);
  const idx = rows.findIndex(function (c) { return c.name === body.originalName || c.name === body.name; });
  if (idx === -1) throw new Error('category not found: ' + body.name);

  const updated = Object.assign({}, rows[idx], {
    name: body.name !== undefined ? body.name : rows[idx].name,
    type: body.type !== undefined ? body.type : rows[idx].type,
    order: body.order !== undefined ? Number(body.order) : rows[idx].order,
  });

  writeRow_(sheet, idx + DATA_START_ROW, keys, updated);
  return updated;
}

function deleteCategory_(name) {
  const sheet = getSheet_(SHEET_NAME_CATEGORIES);
  const rows = readObjects_(sheet);
  const idx = rows.findIndex(function (c) { return c.name === name; });
  if (idx === -1) throw new Error('category not found: ' + name);
  sheet.deleteRow(idx + DATA_START_ROW);
}

// ------------------------------
// ID採番
// ------------------------------

function generateTransactionId_(dateStr) {
  const sheet = getSheet_(SHEET_NAME_TRANSACTIONS);
  const ymd = toYYMMDD_(dateStr);
  const ids = readObjects_(sheet).map(function (r) { return String(r.id); });
  const prefix = ymd;
  const seqNums = ids
    .filter(function (id) { return id.indexOf(prefix) === 0 && id.length === 8; })
    .map(function (id) { return Number(id.slice(6, 8)); });
  const nextSeq = seqNums.length > 0 ? Math.max.apply(null, seqNums) + 1 : 1;
  if (nextSeq > 99) throw new Error('同一日の取引が99件を超えました: ' + ymd);
  return prefix + ('00' + nextSeq).slice(-2);
}

/** bulkAdd用：既存シートから日付ごとの現在の最大連番を集計 */
function buildDailyCounters_(sheet) {
  const ids = readObjects_(sheet).map(function (r) { return String(r.id); });
  const counters = {};
  ids.forEach(function (id) {
    if (id.length !== 8) return;
    const ymd = id.slice(0, 6);
    const seq = Number(id.slice(6, 8));
    counters[ymd] = Math.max(counters[ymd] || 0, seq);
  });
  return counters;
}

function toYYMMDD_(dateStr) {
  // dateStr: 'YYYY-MM-DD' を想定
  const parts = String(dateStr).split('-');
  if (parts.length !== 3) throw new Error('invalid date format: ' + dateStr);
  return parts[0].slice(2) + parts[1] + parts[2];
}

// ------------------------------
// シート読み書き共通ユーティリティ
// ------------------------------

function getSheet_(name) {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!spreadsheetId) throw new Error('SPREADSHEET_ID が未設定です。setup.gs の setup() を先に実行してください。');
  const ss = SpreadsheetApp.openById(spreadsheetId);
  const sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error('シートが見つかりません: ' + name);
  return sheet;
}

function getKeys_(sheet) {
  const lastCol = sheet.getLastColumn();
  return sheet.getRange(HEADER_ROW, 1, 1, lastCol).getValues()[0];
}

/** 2行目のキーを使って3行目以降をオブジェクト配列に変換 */
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

function findRowIndexById_(sheet, id) {
  const rows = readObjects_(sheet);
  const idx = rows.findIndex(function (r) { return String(r.id) === String(id); });
  return idx === -1 ? -1 : idx + DATA_START_ROW;
}

function isoString_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
