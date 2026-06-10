/**
 * 議員資料要求フォーム（議員 → 議長／議会事務局）
 * Google Apps Script Web アプリ
 *
 * --- 構成 ---
 *  シート「申請データ」: 受付番号 / 送信日時 / 氏名 / メールアドレス / 資料の内容 / 担当部署 / 調整状況 / 用途 / 希望提出期限
 *  シート「議員名簿」  : メールアドレス / 氏名   ← 登録済みアドレスのみ送信可
 *  シート「設定」      : 項目 / 値             ← 議会事務局の通知先アドレス等
 */

// =============================================================
// 定数
// =============================================================
var SHEET_DATA     = '申請データ';
var SHEET_MEMBERS  = '議員名簿';
var SHEET_SETTINGS = '設定';
var TZ             = 'Asia/Tokyo';
var KEY_NOTIFY     = '議会事務局通知先メールアドレス';

// 申請データの列順（1始まり）
var COL = {
  RECEIPT:  1, // 受付番号
  DATETIME: 2, // 送信日時
  NAME:     3, // 氏名
  EMAIL:    4, // メールアドレス
  CONTENT:  5, // 資料の内容
  DEPT:     6, // 担当部署
  ADJUST:   7, // 調整状況（未調整／調整済）
  PURPOSE:  8, // 用途
  DEADLINE: 9  // 希望提出期限
};

// 調整状況の選択肢
var ADJUST_VALUES = ['未調整', '調整済'];
var ADJUST_DEFAULT = '未調整';

// =============================================================
// ルーティング
// =============================================================
function doGet(e) {
  var page = (e && e.parameter && e.parameter.page) ? e.parameter.page : 'form';
  var file = (page === 'history') ? 'history' : 'index';
  var title = (page === 'history') ? '資料要求 申請照会' : '議員資料要求フォーム';

  return HtmlService.createHtmlOutputFromFile(file)
    .setTitle(title)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// HTML から WebアプリのベースURLを参照するため
function getAppUrl() {
  return ScriptApp.getService().getUrl();
}

// =============================================================
// 申請の登録（フォーム送信）
// =============================================================
/**
 * @param {Object} f { name, email, content, dept, adjust, purpose, deadline }
 * @return {Object} { ok:true, receiptNumber, datetime } | { ok:false, message }
 */
function submitRequest(f) {
  try {
    f = f || {};
    var name     = String(f.name     || '').trim();
    var email    = String(f.email    || '').trim();
    var content  = String(f.content  || '').trim();
    var dept     = String(f.dept     || '').trim();
    var adjust   = String(f.adjust   || '').trim();
    var purpose  = String(f.purpose  || '').trim();
    var deadline = String(f.deadline || '').trim();

    // 調整状況：許可値以外はデフォルトに丸める
    if (ADJUST_VALUES.indexOf(adjust) === -1) adjust = ADJUST_DEFAULT;

    // 必須チェック
    if (!name || !email || !content || !dept || !purpose || !deadline) {
      return { ok: false, message: '未入力の項目があります。すべての項目を入力してください。' };
    }
    // 形式チェック（簡易）
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { ok: false, message: 'メールアドレスの形式が正しくありません。' };
    }
    // 登録済みアドレス照合
    if (!isRegisteredEmail(email)) {
      return { ok: false, message: '登録されていないメールアドレスです。' };
    }

    var ss   = SpreadsheetApp.getActiveSpreadsheet();
    var data = getOrCreateDataSheet_(ss);

    // 受付番号の採番と書き込みは排他制御
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    var receipt, now, datetimeStr;
    try {
      now = new Date();
      datetimeStr = Utilities.formatDate(now, TZ, 'yyyy/MM/dd HH:mm:ss');
      receipt = generateReceiptNumber_(data, now);

      var row = [];
      row[COL.RECEIPT  - 1] = receipt;
      row[COL.DATETIME - 1] = datetimeStr;
      row[COL.NAME     - 1] = name;
      row[COL.EMAIL    - 1] = email;
      row[COL.CONTENT  - 1] = content;
      row[COL.DEPT     - 1] = dept;
      row[COL.ADJUST   - 1] = adjust;
      row[COL.PURPOSE  - 1] = purpose;
      row[COL.DEADLINE - 1] = deadline;
      data.appendRow(row);
      SpreadsheetApp.flush();
    } finally {
      lock.releaseLock();
    }

    // メール送信（失敗しても申請自体は受付済みとする）
    var payload = {
      receipt: receipt, datetime: datetimeStr, name: name, email: email,
      content: content, dept: dept, adjust: adjust, purpose: purpose, deadline: deadline
    };
    try { sendApplicantMail_(payload); } catch (err) { logError_('議員宛メール', err); }
    try { sendOfficeMail_(payload);    } catch (err) { logError_('事務局宛メール', err); }

    return { ok: true, receiptNumber: receipt, datetime: datetimeStr };

  } catch (err) {
    logError_('submitRequest', err);
    return { ok: false, message: 'システムエラーが発生しました。時間をおいて再度お試しください。' };
  }
}

// =============================================================
// 過去申請の照会
// =============================================================
/**
 * @param {string} email
 * @return {Object} { ok:true, items:[...] } | { ok:false, message }
 */
function lookupRequests(email) {
  try {
    email = String(email || '').trim();
    if (!email) return { ok: false, message: 'メールアドレスを入力してください。' };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { ok: false, message: 'メールアドレスの形式が正しくありません。' };
    }

    var ss   = SpreadsheetApp.getActiveSpreadsheet();
    var data = ss.getSheetByName(SHEET_DATA);
    if (!data || data.getLastRow() < 2) return { ok: true, items: [] };

    var target = normalizeEmail_(email);
    var values = data.getRange(2, 1, data.getLastRow() - 1, COL.DEADLINE).getValues();
    var items = [];
    for (var i = 0; i < values.length; i++) {
      var r = values[i];
      if (normalizeEmail_(r[COL.EMAIL - 1]) === target) {
        items.push({
          receipt:  String(r[COL.RECEIPT  - 1]),
          datetime: String(r[COL.DATETIME - 1]),
          content:  String(r[COL.CONTENT  - 1]),
          dept:     String(r[COL.DEPT     - 1]),
          purpose:  String(r[COL.PURPOSE  - 1]),
          deadline: String(r[COL.DEADLINE - 1])
        });
      }
    }
    items.reverse(); // 新しい順
    return { ok: true, items: items };

  } catch (err) {
    logError_('lookupRequests', err);
    return { ok: false, message: 'システムエラーが発生しました。時間をおいて再度お試しください。' };
  }
}

// =============================================================
// ヘルパー
// =============================================================
function normalizeEmail_(s) {
  return String(s || '').trim().toLowerCase();
}

function isRegisteredEmail(email) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_MEMBERS);
  if (!sh || sh.getLastRow() < 2) return false;
  var target = normalizeEmail_(email);
  var col = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < col.length; i++) {
    if (normalizeEmail_(col[i][0]) === target) return true;
  }
  return false;
}

/** YYYYMMDD-NNN（当日内の連番） */
function generateReceiptNumber_(dataSheet, now) {
  var prefix = Utilities.formatDate(now, TZ, 'yyyyMMdd') + '-';
  var max = 0;
  if (dataSheet.getLastRow() >= 2) {
    var col = dataSheet.getRange(2, COL.RECEIPT, dataSheet.getLastRow() - 1, 1).getValues();
    for (var i = 0; i < col.length; i++) {
      var v = String(col[i][0]);
      if (v.indexOf(prefix) === 0) {
        var n = parseInt(v.substring(prefix.length), 10);
        if (!isNaN(n) && n > max) max = n;
      }
    }
  }
  var seq = ('00' + (max + 1)).slice(-3);
  return prefix + seq;
}

/** 設定シートから通知先アドレス（カンマ／セミコロン区切り対応） */
function getNotifyAddresses_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_SETTINGS);
  if (!sh || sh.getLastRow() < 2) return [];
  var values = sh.getRange(1, 1, sh.getLastRow(), 2).getValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0]).trim() === KEY_NOTIFY) {
      return String(values[i][1] || '')
        .split(/[,;\s]+/)
        .map(function (s) { return s.trim(); })
        .filter(function (s) { return s; });
    }
  }
  return [];
}

function buildMailBody_(p, forOffice) {
  var lines = [];
  if (forOffice) {
    lines.push('議員より資料要求の申請がありました。');
  } else {
    lines.push('資料要求の申請を受け付けました。内容は下記のとおりです。');
  }
  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('受付番号　　：' + p.receipt);
  lines.push('送信日時　　：' + p.datetime);
  lines.push('議員氏名　　：' + p.name);
  lines.push('メール　　　：' + p.email);
  lines.push('担当部署　　：' + p.dept);
  if (forOffice) {
    lines.push('調整状況　　：' + p.adjust);
  }
  lines.push('用途　　　　：' + p.purpose);
  lines.push('希望提出期限：' + p.deadline);
  lines.push('');
  lines.push('【資料の内容】');
  lines.push(p.content);
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('');
  if (!forOffice) {
    lines.push('※本メールは送信専用です。ご返信いただいてもお答えできません。');
    lines.push('※受付番号は申請の照会時に必要です。大切に保管してください。');
  }
  return lines.join('\n');
}

function sendApplicantMail_(p) {
  MailApp.sendEmail({
    to: p.email,
    subject: '【資料要求】申請を受け付けました（受付番号 ' + p.receipt + '）',
    body: buildMailBody_(p, false)
  });
}

function sendOfficeMail_(p) {
  var to = getNotifyAddresses_();
  if (!to.length) { logError_('通知先未設定', '設定シートに通知先アドレスがありません'); return; }
  MailApp.sendEmail({
    to: to.join(','),
    subject: '【資料要求】新規申請（受付番号 ' + p.receipt + ' / ' + p.name + '）',
    body: buildMailBody_(p, true)
  });
}

function getOrCreateDataSheet_(ss) {
  var sh = ss.getSheetByName(SHEET_DATA);
  if (!sh) {
    sh = ss.insertSheet(SHEET_DATA);
    sh.appendRow(['受付番号','送信日時','氏名','メールアドレス','資料の内容','担当部署','調整状況','用途','希望提出期限']);
    sh.setFrozenRows(1);
  }
  return sh;
}

function logError_(where, err) {
  try { console.error('[' + where + '] ' + (err && err.stack ? err.stack : err)); } catch (e) {}
}

// =============================================================
// 初期セットアップ（最初に1回だけ手動実行）
// =============================================================
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  getOrCreateDataSheet_(ss);

  var members = ss.getSheetByName(SHEET_MEMBERS);
  if (!members) {
    members = ss.insertSheet(SHEET_MEMBERS);
    members.appendRow(['メールアドレス','氏名']);
    members.appendRow(['gikai-sample@example.lg.jp','見本 太郎']);
    members.setFrozenRows(1);
  }

  var settings = ss.getSheetByName(SHEET_SETTINGS);
  if (!settings) {
    settings = ss.insertSheet(SHEET_SETTINGS);
    settings.appendRow(['項目','値']);
    settings.appendRow([KEY_NOTIFY, 'jimukyoku@example.lg.jp']);
    settings.setFrozenRows(1);
  }

  SpreadsheetApp.getUi().alert('セットアップが完了しました。\n「議員名簿」「設定」シートの内容を編集してください。');
}
