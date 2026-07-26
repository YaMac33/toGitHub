/** ===== 設定 ===== */
const SHEET_NAME = 'Calendar';
const HEADER_ROW = 2;       // 英字の列名がある行
const DATA_START_ROW = 3;   // データ開始行
const LAST_COL = 9;         // A〜I列
const CATEGORIES = ['仕事', '私用', 'その他'];

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

// Date → 文字列(終日は日付のみ)
function fmt_(v, allDay) {
  const d = toDate_(v);
  if (!d) return '';
  return Utilities.formatDate(d, tz_(), allDay ? 'yyyy/MM/dd' : 'yyyy/MM/dd HH:mm');
}

function toBool_(v) {
  if (v === true) return true;
  if (v === false || v === '' || v == null) return false;
  const s = String(v).trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'yes';
}

// 重なり判定用の実効期間。終了は「含まない(exclusive)」形に正規化する
function effRange_(startAt, endAt, allDay) {
  let s = toDate_(startAt);
  if (!s) return null;
  let e = toDate_(endAt) || s;

  if (allDay) {
    s = startOfDay_(s);
    e = addDays_(startOfDay_(e), 1);          // inclusive → exclusive
  } else if (e.getTime() <= s.getTime()) {
    e = new Date(s.getTime() + 60 * 1000);    // 幅ゼロの予定に最低1分を与える
  }
  return { start: s, end: e };
}

/** ===== 入力の検証・正規化 ===== */
function normalizeInput_(data) {
  const title = String(data.title || '').trim();
  if (!title) throw new Error('予定名を入力してください');

  const allDay = toBool_(data.all_day);

  let s = toDate_(data.start_at);
  if (!s) throw new Error('開始日時が不正です');
  let e = toDate_(data.end_at) || s;

  if (allDay) {
    s = startOfDay_(s);
    e = startOfDay_(e);
    if (e.getTime() < s.getTime()) e = s;     // 逆転していたら1日扱いに寄せる
  } else if (e.getTime() < s.getTime()) {
    throw new Error('終了日時が開始日時より前になっています');
  }

  let category = String(data.category || '').trim();
  if (CATEGORIES.indexOf(category) === -1) category = 'その他';

  return {
    title: title,
    allDay: allDay,
    start: s,
    end: e,
    category: category,
    memo: String(data.memo || '')
  };
}

// ID採番:開始日のYYMMDD + 同じ開始日の連番2桁(同prefixの最大値+1)
// 例:開始日7/28の4件目 → 26072804
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
  return prefix + ('0' + (max + 1)).slice(-2);
}

// 書き込み後の表示形式を整える
function applyFormat_(sh, rowNo, allDay) {
  const dateFmt = allDay ? 'yyyy/mm/dd' : 'yyyy/mm/dd hh:mm';
  sh.getRange(rowNo, 1).setNumberFormat('@');              // id は文字列として保持
  sh.getRange(rowNo, 3, 1, 2).setNumberFormat(dateFmt);    // start_at / end_at
  sh.getRange(rowNo, 8, 1, 2).setNumberFormat('yyyy/mm/dd hh:mm'); // created / updated
}

function toObject_(row, map) {
  const allDay = toBool_(row[map.all_day]);
  return {
    id: String(row[map.id]),
    title: String(row[map.title] || ''),
    start_at: fmt_(row[map.start_at], allDay),
    end_at: fmt_(row[map.end_at], allDay),
    all_day: allDay,
    category: String(row[map.category] || ''),
    memo: String(row[map.memo] || ''),
    created_at: fmt_(row[map.created_at], false),
    updated_at: fmt_(row[map.updated_at], false)
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
    const eff = effRange_(r[map.start_at], r[map.end_at], allDay);
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
    row[map.start_at] = v.start;
    row[map.end_at] = v.end;
    row[map.all_day] = v.allDay;
    row[map.category] = v.category;
    row[map.memo] = v.memo;
    row[map.created_at] = now;
    row[map.updated_at] = now;

    const targetRow = getLastDataRow_(sh) + 1;
    sh.getRange(targetRow, 1, 1, LAST_COL).setValues([row]);
    applyFormat_(sh, targetRow, v.allDay);

    return id;
  } finally {
    lock.releaseLock();
  }
}

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
    values[map.title] = v.title;
    values[map.start_at] = v.start;
    values[map.end_at] = v.end;
    values[map.all_day] = v.allDay;
    values[map.category] = v.category;
    values[map.memo] = v.memo;
    values[map.updated_at] = new Date();   // created_at は触らない
    // id は変更しない(登録時点の開始日を含んだ通し番号のまま固定)

    sh.getRange(rowNo, 1, 1, LAST_COL).setValues([values]);
    applyFormat_(sh, rowNo, v.allDay);

    return true;
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

// フロントの分類プルダウン・バッジ色の元になる定数を渡す
function getCategories() {
  return CATEGORIES;
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

// 1. 7月分の取得(終日複数日・月跨ぎが正しく拾えるか)
function test_getEvents_july() {
  const list = getEvents('2026/07/01 00:00', '2026/08/01 00:00');
  Logger.log('件数: ' + list.length);
  Logger.log(JSON.stringify(list, null, 2));
}

// 2. 7/31 の1日分(終日複数日 26072504 が最終日にも出るか)
function test_getEvents_lastDayOfAllDay() {
  const list = getEvents('2026/07/31 00:00', '2026/08/01 00:00');
  Logger.log(list.map(function (e) { return e.id + ':' + e.title; }).join(', '));
  // 期待:26072504(終日複数日)が含まれる ← inclusive の確認
}

// 3. 8/2 の1日分(日跨ぎ 26072505 が翌日側にも出るか)
function test_getEvents_overnight() {
  const list = getEvents('2026/08/02 00:00', '2026/08/03 00:00');
  Logger.log(list.map(function (e) { return e.id + ':' + e.title; }).join(', '));
  // 期待:26072505(日跨ぎ)が含まれる
}

// 4. 新規追加(開始日ベースのID採番の確認)
function test_addItem() {
  const id = addItem({
    title: 'テスト:通常予定',
    start_at: '2026/08/05 13:00',
    end_at: '2026/08/05 14:00',
    all_day: false,
    category: '仕事',
    memo: 'テストで追加した予定'
  });
  Logger.log('追加されたID: ' + id); // 例:8/5の1件目なら 26080501
}

// 5. 終日予定の追加(inclusive:8/10〜8/12 の3日間)
function test_addItem_allDay() {
  const id = addItem({
    title: 'テスト:終日3日間',
    start_at: '2026/08/10',
    end_at: '2026/08/12',
    all_day: true,
    category: '私用'
  });
  Logger.log('追加されたID: ' + id);
}

// 6. 更新(IDを実際に発行されたものに書き換えて実行)
function test_updateItem() {
  const result = updateItem({
    id: '26072501',
    title: '通常予定(更新済み)',
    start_at: '2026/07/27 10:30',
    end_at: '2026/07/27 11:30',
    all_day: false,
    category: '仕事',
    memo: 'updated_at だけ変わることを確認'
  });
  Logger.log('更新結果: ' + result);
}

// 7. 削除(IDを書き換えて実行)
function test_deleteItem() {
  Logger.log('削除結果: ' + deleteItem('26072501'));
}

// 8. 検証エラーの確認(終了 < 開始 で例外が出るか)
function test_validation() {
  try {
    addItem({ title: 'エラーになるはず', start_at: '2026/08/05 15:00', end_at: '2026/08/05 14:00' });
    Logger.log('NG:例外が出なかった');
  } catch (e) {
    Logger.log('OK:' + e.message);
  }
}

// 9. 祝日API:2026年7月分(海の日のみ出れば成功。節分などが混ざっていないか目視確認)
function test_getHolidays() {
  const list = getHolidays('2026/07/01 00:00', '2026/08/01 00:00');
  Logger.log(JSON.stringify(list, null, 2));
}

// 10. 祝日API:生データ確認(除外リストに何を足すべきか判断する用)
function test_fetchHolidayMap() {
  const map = fetchHolidayMap_();
  Logger.log('件数: ' + Object.keys(map).length);
  Logger.log(JSON.stringify(map, null, 2));
}
