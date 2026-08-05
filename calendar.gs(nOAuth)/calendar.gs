/** ===== 設定 ===== */
const SHEET_NAME = 'Calendar';
const CATEGORY_SHEET_NAME = 'Categories'; // 分類管理シート
const HEADER_ROW = 2;       // 英字の列名がある行
const DATA_START_ROW = 3;   // データ開始行
const LAST_COL = 12;        // A〜L列


// 分類バッジ用パレット(Categoriesシートの並び順に割り当て、超過分は循環)
const CATEGORY_PALETTE = [
  '#2438c8', // 青
  '#0d7a63', // 緑
  '#7b3ba8', // 紫
  '#c2410c', // オレンジ
  '#0e7490', // ティール
  '#be185d', // マゼンタ
  '#a16207', // 濃い黄土
  '#4338ca', // インディゴ
  '#15803d', // 緑(明)
  '#9f1239'  // 赤茶
];




/** ===== 共通 ===== */
function tz_() {
  return Session.getScriptTimeZone();
}


function getSheet_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sh) throw new Error('シート「' + SHEET_NAME + '」が見つかりません');
  return sh;
}


// 2行目を読んで「列名 → 列インデックス(0始まり)」のマップを作る
function getColMap_(sh) {
  const header = sh.getRange(HEADER_ROW, 1, 1, LAST_COL).getValues()[0];
  const map = {};
  header.forEach(function (name, i) {
    if (name !== '') map[String(name).trim()] = i;
  });
  return map;
}


function getRows_(sh) {
  const last = sh.getLastRow();
  if (last < DATA_START_ROW) return [];
  return sh.getRange(DATA_START_ROW, 1, last - DATA_START_ROW + 1, LAST_COL).getValues();
}


// A列(id)を基準に、データが入っている最終行を返す
function getLastDataRow_(sh) {
  const colA = sh.getRange(DATA_START_ROW, 1, sh.getMaxRows() - DATA_START_ROW + 1, 1).getValues();
  let last = DATA_START_ROW - 1;
  for (let i = 0; i < colA.length; i++) {
    if (colA[i][0] !== '') last = DATA_START_ROW + i;
  }
  return last;
}


// id から行番号を引く(見つからなければ -1)
function findRowNo_(rows, map, id) {
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][map.id]) === String(id)) return DATA_START_ROW + i;
  }
  return -1;
}




/** ===== 日付ユーティリティ ===== */
// セル値・文字列のどちらでも Date に変換する
function toDate_(v) {
  if (!v && v !== 0) return null;
  if (Object.prototype.toString.call(v) === '[object Date]') return v;
  const s = String(v).trim();
  if (!s) return null;
  const d = new Date(s.replace(/-/g, '/'));   // 'yyyy-MM-dd' も受け付ける
  return isNaN(d.getTime()) ? null : d;
}


function startOfDay_(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}


function addDays_(d, n) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}


function toBool_(v) {
  if (v === true) return true;
  if (v === false || v === '' || v == null) return false;
  const s = String(v).trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'yes';
}


// 「日」と「時刻」の2つのセルから1つの Date を組み立てる。
// timeVal が空なら日付のみ(0:00)。
function combineDayTime_(dayVal, timeVal) {
  const day = toDate_(dayVal);
  if (!day) return null;
  const base = startOfDay_(day);
  const hm = parseTime_(timeVal);
  if (!hm) return base;
  return new Date(base.getFullYear(), base.getMonth(), base.getDate(), hm.h, hm.m);
}


// 時刻セルを {h, m} に変換。Date(1899/12/30基準の時刻値)・'HH:mm'文字列の両対応。
function parseTime_(v) {
  if (v === '' || v == null) return null;
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return { h: v.getHours(), m: v.getMinutes() };
  }
  const s = String(v).trim();
  if (!s) return null;
  const m = s.match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return { h: parseInt(m[1], 10), m: parseInt(m[2], 10) };
}


// Date → 'yyyy/MM/dd'
function fmtDay_(d) {
  return d ? Utilities.formatDate(d, tz_(), 'yyyy/MM/dd') : '';
}


// Date → 'HH:mm'
function fmtTime_(d) {
  return d ? Utilities.formatDate(d, tz_(), 'HH:mm') : '';
}


// Date → 'yyyy/MM/dd HH:mm'(created/updated用)
function fmtDateTime_(v) {
  const d = toDate_(v);
  return d ? Utilities.formatDate(d, tz_(), 'yyyy/MM/dd HH:mm') : '';
}




/** ===== 分類(Categories) ===== */
// Categoriesシートの2行目以降・A列を上から読み、分類名の配列を返す(空許容)。
function getCategoryList_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(CATEGORY_SHEET_NAME);
  if (!sh) return [];
  const last = sh.getLastRow();
  if (last < DATA_START_ROW) return [];
  const vals = sh.getRange(DATA_START_ROW - 1 + 1, 1, last - (DATA_START_ROW - 1), 1).getValues();
  const out = [];
  vals.forEach(function (r) {
    const name = String(r[0] || '').trim();
    if (name) out.push(name);
  });
  return out;
}


// 分類名 → パレット色(並び順で割り当て、超過分は循環)。未登録名は既定色。
function colorForIndex_(i) {
  return CATEGORY_PALETTE[i % CATEGORY_PALETTE.length];
}


// カンマ区切りの category 文字列を正規化する。
// 各分類名の前後空白を除去し、空要素を捨て、重複を除いてカンマ区切りで返す。
// 例: ' 議長 , 全体 ,議長 ' → '議長,全体'
function normalizeCategory_(raw) {
  const parts = String(raw || '').split(',');
  const seen = {};
  const out = [];
  parts.forEach(function (p) {
    const name = String(p).trim();
    if (!name) return;
    if (seen[name]) return;
    seen[name] = true;
    out.push(name);
  });
  return out.join(',');
}




/** ===== 重なり判定 ===== */
// 重なり判定用の実効期間。終了は「含まない(exclusive)」形に正規化する
function effRange_(startDate, endDate, allDay) {
  let s = startDate;
  if (!s) return null;
  let e = endDate || s;


  if (allDay) {
    s = startOfDay_(s);
    e = addDays_(startOfDay_(e), 1);          // inclusive → exclusive
  } else if (e.getTime() <= s.getTime()) {
    e = new Date(s.getTime() + 60 * 1000);    // 幅ゼロの予定に最低1分を与える
  }
  return { start: s, end: e };
}




/** ===== 入力の検証・正規化 ===== */
// フロントからは start_day/start_time/end_day/end_time が届く。
// 時刻が両方空なら終日とみなす(日付のみ入力→終日)。
function normalizeInput_(data) {
  const title = String(data.title || '').trim();
  if (!title) throw new Error('予定名を入力してください');


  let allDay = toBool_(data.all_day);


  const startTimeStr = String(data.start_time || '').trim();
  const endTimeStr = String(data.end_time || '').trim();


  // 日付のみ入力(時刻が両方空)なら自動で終日と判断
  if (!startTimeStr && !endTimeStr) allDay = true;


  let s, e;
  if (allDay) {
    s = combineDayTime_(data.start_day, '');
    if (!s) throw new Error('開始日が不正です');
    e = combineDayTime_(data.end_day, '') || s;
    s = startOfDay_(s);
    e = startOfDay_(e);
    if (e.getTime() < s.getTime()) e = s;     // 逆転していたら1日扱いに寄せる
  } else {
    s = combineDayTime_(data.start_day, startTimeStr);
    if (!s) throw new Error('開始日時が不正です');
    // 終了日が空なら開始日を流用(日またぎでなければ同日扱い)
    const endDay = String(data.end_day || '').trim() ? data.end_day : data.start_day;
    e = combineDayTime_(endDay, endTimeStr) || s;
    if (e.getTime() < s.getTime()) {
      throw new Error('終了日時が開始日時より前になっています');
    }
  }


  // 分類はカンマ区切りの複数値を許容。正規化して保存する(Categories未登録でも拒否しない)
  const category = normalizeCategory_(data.category);


  return {
    title: title,
    place: String(data.place || '').trim(),
    allDay: allDay,
    start: s,
    end: e,
    category: category,
    memo: String(data.memo || '')
  };
}




/** ===== ID採番 ===== */
// ID = 開始日のYYMMDD + 同じ開始日の連番2桁
// 例:開始日2026/07/28の4件目 → 26072804
// 1日に100件を超えたときだけ3桁に伸ばす(頭2桁固定だと重複するため)
function seqStr_(n) {
  return n < 100 ? ('0' + n).slice(-2) : String(n);
}


function newId_(sh, map, startDate) {
  const prefix = Utilities.formatDate(startDate, tz_(), 'yyMMdd');
  let max = 0;
  getRows_(sh).forEach(function (r) {
    const id = String(r[map.id]);
    if (id.indexOf(prefix) === 0) {
      const n = parseInt(id.slice(prefix.length), 10);
      if (!isNaN(n) && n > max) max = n;
    }
  });
  return prefix + seqStr_(max + 1);
}


// 更新時:開始日が変わったときだけIDを振り直す(同じ日のままなら据え置き)
function reissueId_(sh, map, oldId, startDate) {
  const prefix = Utilities.formatDate(startDate, tz_(), 'yyMMdd');
  if (String(oldId).indexOf(prefix) === 0) return String(oldId);
  return newId_(sh, map, startDate);
}




/** ===== 書式・変換 ===== */
// 書き込み後の表示形式を整える(12列構成)
function applyFormat_(sh, rowNo, allDay) {
  sh.getRange(rowNo, 1).setNumberFormat('@');                 // id は文字列として保持
  sh.getRange(rowNo, 4).setNumberFormat('yyyy/mm/dd');        // start_day
  sh.getRange(rowNo, 5).setNumberFormat('hh:mm');             // start_time
  sh.getRange(rowNo, 6).setNumberFormat('yyyy/mm/dd');        // end_day
  sh.getRange(rowNo, 7).setNumberFormat('hh:mm');             // end_time
  sh.getRange(rowNo, 11, 1, 2).setNumberFormat('yyyy/mm/dd hh:mm'); // created / updated
}


// 1行のセル値を、フロントへ渡すオブジェクトに変換する
// ★注記: category はカンマ区切り文字列のまま返す(フロント側で配列化する)
// ★変更: フロントは ev.created / ev.updated を参照するため、別名でも同じ値を返す
function toObject_(row, map) {
  const allDay = toBool_(row[map.all_day]);
  const startDate = combineDayTime_(row[map.start_day], allDay ? '' : row[map.start_time]);
  const endDate = combineDayTime_(row[map.end_day], allDay ? '' : row[map.end_time]);
  const createdStr = fmtDateTime_(row[map.created_at]);
  const updatedStr = fmtDateTime_(row[map.updated_at]);
  return {
    id: String(row[map.id]),
    title: String(row[map.title] || ''),
    place: String(row[map.place] || ''),
    start_day: fmtDay_(startDate),
    start_time: allDay ? '' : fmtTime_(startDate),
    end_day: fmtDay_(endDate),
    end_time: allDay ? '' : fmtTime_(endDate),
    all_day: allDay,
    category: String(row[map.category] || ''),
    memo: String(row[map.memo] || ''),
    created_at: createdStr,
    updated_at: updatedStr,
    created: createdStr,   // ★フロント互換
    updated: updatedStr    // ★フロント互換
  };
}




/** ===== 予定API ===== */


// 指定期間と「重なる」予定をすべて返す(月跨ぎの終日予定も拾える)
// rangeStart / rangeEnd は 'yyyy/MM/dd HH:mm' 形式の文字列
function getEvents(rangeStart, rangeEnd) {
  const rs = toDate_(rangeStart);
  const re = toDate_(rangeEnd);
  if (!rs || !re) throw new Error('取得期間が不正です');


  const sh = getSheet_();
  const map = getColMap_(sh);
  const out = [];


  getRows_(sh).forEach(function (r) {
    if (r[map.id] === '') return;
    const allDay = toBool_(r[map.all_day]);
    const s = combineDayTime_(r[map.start_day], allDay ? '' : r[map.start_time]);
    const e = combineDayTime_(r[map.end_day], allDay ? '' : r[map.end_time]);
    const eff = effRange_(s, e, allDay);
    if (!eff) return;
    if (eff.start.getTime() < re.getTime() && eff.end.getTime() > rs.getTime()) {
      const o = toObject_(r, map);
      o._sort = eff.start.getTime();
      out.push(o);
    }
  });


  // 開始が早い順。同時刻なら終日を先に
  out.sort(function (a, b) {
    if (a._sort !== b._sort) return a._sort - b._sort;
    return (b.all_day ? 1 : 0) - (a.all_day ? 1 : 0);
  });
  out.forEach(function (o) { delete o._sort; });


  return out;
}


function getItem(id) {
  const sh = getSheet_();
  const map = getColMap_(sh);
  const rows = getRows_(sh);
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][map.id]) === String(id)) return toObject_(rows[i], map);
  }
  return null;
}


function addItem(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = getSheet_();
    const map = getColMap_(sh);
    const v = normalizeInput_(data);
    const now = new Date();
    const id = newId_(sh, map, v.start);


    const row = new Array(LAST_COL).fill('');
    row[map.id] = id;
    row[map.title] = v.title;
    row[map.place] = v.place;
    row[map.start_day] = startOfDay_(v.start);
    row[map.start_time] = v.allDay ? '' : fmtTime_(v.start);
    row[map.end_day] = startOfDay_(v.end);
    row[map.end_time] = v.allDay ? '' : fmtTime_(v.end);
    row[map.all_day] = v.allDay;
    row[map.category] = v.category;
    row[map.memo] = v.memo;
    row[map.created_at] = now;
    row[map.updated_at] = now;


    const targetRow = getLastDataRow_(sh) + 1;
    // 書き込む前にA列を文字列書式にしておく(後からでは数値として取り込まれてしまう)
    sh.getRange(targetRow, 1).setNumberFormat('@');
    sh.getRange(targetRow, 1, 1, LAST_COL).setValues([row]);
    applyFormat_(sh, targetRow, v.allDay);


    return id;
  } finally {
    lock.releaseLock();
  }
}


// 戻り値は更新後のID(開始日を変えた場合は新しいIDになる)
function updateItem(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = getSheet_();
    const map = getColMap_(sh);
    const rows = getRows_(sh);
    const rowNo = findRowNo_(rows, map, data.id);
    if (rowNo === -1) throw new Error('ID ' + data.id + ' が見つかりません');


    const v = normalizeInput_(data);
    const values = rows[rowNo - DATA_START_ROW].slice();
    values[map.id] = reissueId_(sh, map, data.id, v.start);  // 開始日ベースのIDを保つ
    values[map.title] = v.title;
    values[map.place] = v.place;
    values[map.start_day] = startOfDay_(v.start);
    values[map.start_time] = v.allDay ? '' : fmtTime_(v.start);
    values[map.end_day] = startOfDay_(v.end);
    values[map.end_time] = v.allDay ? '' : fmtTime_(v.end);
    values[map.all_day] = v.allDay;
    values[map.category] = v.category;
    values[map.memo] = v.memo;
    values[map.updated_at] = new Date();   // created_at は触らない


    sh.getRange(rowNo, 1).setNumberFormat('@');
    sh.getRange(rowNo, 1, 1, LAST_COL).setValues([values]);
    applyFormat_(sh, rowNo, v.allDay);


    return String(values[map.id]);
  } finally {
    lock.releaseLock();
  }
}


function deleteItem(id) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = getSheet_();
    const map = getColMap_(sh);
    const rowNo = findRowNo_(getRows_(sh), map, id);
    if (rowNo === -1) throw new Error('ID ' + id + ' が見つかりません');
    sh.deleteRow(rowNo);
    return true;
  } finally {
    lock.releaseLock();
  }
}


// フロントの分類プルダウン・バッジ色の元になるデータを渡す。
// [{ name:'仕事', color:'#2438c8' }, ...] の形。分類が空なら空配列。
function getCategories() {
  return getCategoryList_().map(function (name, i) {
    return { name: name, color: colorForIndex_(i) };
  });
}




/** ===== フロント向けラッパー ★追加 =====
 * index.html は createEvent / updateEvent / deleteEvent という名前で呼ぶ。
 * google.script.run は存在しない関数名だと例外になり
 * withFailureHandler も発火しない(=画面が無反応になる)ため、
 * 実装本体(addItem / updateItem / deleteItem)に橋渡しする。
 */
function createEvent(data) {
  return addItem(data);
}


function updateEvent(id, data) {
  data.id = id;          // updateItem は data.id を見る
  return updateItem(data);
}


function deleteEvent(id) {
  return deleteItem(id);
}




/** ===== 祝日 ===== */
const HOLIDAY_API_URL = 'https://holidays-jp.github.io/api/v1/date.json';
const HOLIDAY_CACHE_KEY = 'holidays_jp_v1';
const HOLIDAY_CACHE_SEC = 21600; // 6時間


// 季節行事などで祝日に混ざることがある名称の除外リスト
const HOLIDAY_EXCLUDE = ['節分', 'ひな祭り', '雛祭り', '母の日', '父の日', '七夕', '七五三'];


// 指定期間の祝日を [{date:'yyyyMMdd', name:'海の日'}, ...] で返す
function getHolidays(rangeStart, rangeEnd) {
  const rs = toDate_(rangeStart);
  const re = toDate_(rangeEnd);
  if (!rs || !re) throw new Error('取得期間が不正です');


  const all = fetchHolidayMap_(); // {'2026-07-20': '海の日', ...}
  const out = [];


  Object.keys(all).forEach(function (dateStr) {
    const d = new Date(dateStr.replace(/-/g, '/'));
    if (d.getTime() < rs.getTime() || d.getTime() >= re.getTime()) return;
    if (HOLIDAY_EXCLUDE.indexOf(all[dateStr]) !== -1) return;
    out.push({ date: Utilities.formatDate(d, tz_(), 'yyyyMMdd'), name: all[dateStr] });
  });


  return out;
}


// APIレスポンスをCacheServiceで数時間キャッシュしつつ取得する
function fetchHolidayMap_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(HOLIDAY_CACHE_KEY);
  if (cached) return JSON.parse(cached);


  const res = UrlFetchApp.fetch(HOLIDAY_API_URL, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('祝日APIの取得に失敗しました(' + res.getResponseCode() + ')');


  const map = JSON.parse(res.getContentText());
  // CacheServiceは1件100KB制限があるため、超える場合は分割保存する
  const json = JSON.stringify(map);
  if (json.length < 90000) {
    cache.put(HOLIDAY_CACHE_KEY, json, HOLIDAY_CACHE_SEC);
  }
  return map;
}




/** ===== Webアプリ ===== */
function doGet() {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('カレンダー')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}


function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}




/** ===== テスト用 ===== */
// 更新・削除のテストは自前で予定を作ってから操作するので、
// シートの中身に依存せず何度でも実行できる。


// 0. 現在のIDを一覧する
function test_listIds() {
  const sh = getSheet_();
  const map = getColMap_(sh);
  const lines = getRows_(sh)
    .filter(function (r) { return r[map.id] !== ''; })
    .map(function (r) {
      const allDay = toBool_(r[map.all_day]);
      const s = combineDayTime_(r[map.start_day], allDay ? '' : r[map.start_time]);
      const label = allDay ? fmtDay_(s) : fmtDay_(s) + ' ' + fmtTime_(s);
      return String(r[map.id]) + '\t' + label + '\t' + r[map.title];
    });
  Logger.log(lines.join('\n'));
}


// 1. 7月分の取得(終日複数日・月跨ぎが正しく拾えるか)
function test_getEvents_july() {
  const list = getEvents('2026/07/01 00:00', '2026/08/01 00:00');
  Logger.log('件数: ' + list.length);
  Logger.log(JSON.stringify(list, null, 2));
}


// 2. 7/31 の1日分(終日複数日が最終日にも出るか = inclusive の確認)
function test_getEvents_lastDayOfAllDay() {
  const list = getEvents('2026/07/31 00:00', '2026/08/01 00:00');
  Logger.log(list.map(function (e) { return e.id + ':' + e.title; }).join(', '));
}


// 3. 日跨ぎ時刻予定が翌日側にも出るか
function test_getEvents_overnight() {
  const list = getEvents('2026/08/03 00:00', '2026/08/04 00:00');
  Logger.log(list.map(function (e) { return e.id + ':' + e.title; }).join(', '));
}


// 4. 新規追加(通常予定・開始日ベースのID採番の確認)
function test_addItem() {
  const id = addItem({
    title: 'テスト:通常予定',
    place: '会議室A',
    start_day: '2026/08/05',
    start_time: '13:00',
    end_day: '2026/08/05',
    end_time: '14:00',
    all_day: false,
    category: '仕事',
    memo: 'テストで追加した予定'
  });
  Logger.log('追加されたID: ' + id); // 8/5の1件目なら 26080501
}


// 4b. 複数分類(カンマ区切り)が1件として保存され、正規化されるか
function test_addItem_multiCategory() {
  const id = addItem({
    title: 'テスト:複数分類',
    start_day: '2026/08/06',
    start_time: '10:00',
    end_day: '2026/08/06',
    end_time: '11:00',
    all_day: false,
    category: ' 〇〇 , 全体 ,〇〇 '  // 前後空白・重複を含む
  });
  const o = getItem(id);
  Logger.log('category(「〇〇,全体」ならOK): ' + o.category);
  deleteItem(id);
}


// 5. 終日予定の追加(inclusive:8/10〜8/12 の3日間)
function test_addItem_allDay() {
  const id = addItem({
    title: 'テスト:終日3日間',
    place: '出張先',
    start_day: '2026/08/10',
    start_time: '',
    end_day: '2026/08/12',
    end_time: '',
    all_day: true,
    category: '私用'
  });
  Logger.log('追加されたID: ' + id);
}


// 5b. 日付のみ入力→自動で終日と判定されるか(all_day を渡さない)
function test_addItem_dateOnly() {
  const id = addItem({
    title: 'テスト:日付のみ入力',
    start_day: '2026/08/15',
    end_day: '2026/08/15'
  });
  const o = getItem(id);
  Logger.log('all_day(trueならOK): ' + o.all_day + ' / ' + JSON.stringify(o));
  deleteItem(id);
}


// 5c. 日跨ぎの時刻予定を追加(終了日 > 開始日)
function test_addItem_overnight() {
  const id = addItem({
    title: 'テスト:日跨ぎ',
    start_day: '2026/08/03',
    start_time: '22:00',
    end_day: '2026/08/04',
    end_time: '02:00',
    all_day: false,
    category: '仕事'
  });
  Logger.log('追加されたID: ' + id + ' / ' + JSON.stringify(getItem(id)));
}


// 6. 更新:開始日を動かすとIDが振り直されるか(作成→更新→削除まで自己完結)
function test_updateItem() {
  const id = addItem({
    title: 'テスト:更新前',
    start_day: '2026/09/01', start_time: '10:00',
    end_day: '2026/09/01', end_time: '11:00',
    all_day: false, category: '仕事'
  });


  const sameDayId = updateItem({
    id: id,
    title: 'テスト:同じ日で更新',
    start_day: '2026/09/01', start_time: '15:00',
    end_day: '2026/09/01', end_time: '16:00',
    all_day: false, category: '仕事', memo: 'IDは据え置きのはず'
  });
  Logger.log('同日更新: ' + id + ' → ' + sameDayId + '(据え置きならOK)');


  const movedId = updateItem({
    id: sameDayId,
    title: 'テスト:別の日へ移動',
    start_day: '2026/09/03', start_time: '09:00',
    end_day: '2026/09/03', end_time: '10:00',
    all_day: false, category: '仕事', memo: 'IDが 260903xx になるはず'
  });
  Logger.log('日付変更: ' + sameDayId + ' → ' + movedId);


  deleteItem(movedId);
  Logger.log('後片付け完了');
}


// 7. 削除(作成した予定をその場で消す)
function test_deleteItem() {
  const id = addItem({
    title: 'テスト:すぐ消す予定',
    start_day: '2026/09/10', start_time: '10:00',
    end_day: '2026/09/10', end_time: '11:00',
    all_day: false, category: 'その他'
  });
  Logger.log('削除結果(' + id + '): ' + deleteItem(id));
}


// 8. 検証エラーの確認(終了 < 開始 で例外が出るか)
function test_validation() {
  try {
    addItem({
      title: 'エラーになるはず',
      start_day: '2026/08/05', start_time: '15:00',
      end_day: '2026/08/05', end_time: '14:00'
    });
    Logger.log('NG:例外が出なかった');
  } catch (e) {
    Logger.log('OK:' + e.message);
  }
}


// 9. 分類の取得(Categoriesシートの内容＋色が返るか)
function test_getCategories() {
  Logger.log(JSON.stringify(getCategories(), null, 2));
}


// 10. 祝日API:2026年7月分(海の日のみ出れば成功)
function test_getHolidays() {
  const list = getHolidays('2026/07/01 00:00', '2026/08/01 00:00');
  Logger.log(JSON.stringify(list, null, 2));
}


// 11. 祝日API:生データ確認(除外リストに何を足すべきか判断する用)
function test_fetchHolidayMap() {
  const map = fetchHolidayMap_();
  Logger.log('件数: ' + Object.keys(map).length);
  Logger.log(JSON.stringify(map, null, 2));
}


// ★追加: 12. フロント向けラッパーが通るか(作成→更新→削除)
function test_frontWrappers() {
  const id = createEvent({
    title: 'テスト:ラッパー経由',
    start_day: '2026/09/20', start_time: '10:00',
    end_day: '2026/09/20', end_time: '11:00',
    all_day: false, category: '仕事'
  });
  Logger.log('createEvent: ' + id);


  const newId = updateEvent(id, {
    title: 'テスト:ラッパー経由(更新)',
    start_day: '2026/09/20', start_time: '13:00',
    end_day: '2026/09/20', end_time: '14:00',
    all_day: false, category: '仕事'
  });
  Logger.log('updateEvent: ' + newId);


  Logger.log('deleteEvent: ' + deleteEvent(newId));
}

