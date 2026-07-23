/**
 * ============================================================
 * スケジュールビューア - Code.gs
 * ============================================================
 * 実装ステップ 1: CONFIG / データ取得関数
 * 実装ステップ 2: ID 自動発行(インストール型トリガー + LockService)
 * ------------------------------------------------------------
 * ※ doGet / ics 出力 / HTML テンプレート連携は後続ステップで追加します。
 */


/* ============================================================
 * 1. 設定(CONFIG)
 * ============================================================
 * 将来「誰でもアクセスできる公開ページ」に切り替える際も、
 * 原則ここだけを変更すれば済むように設定値を集約しています。
 */
const CONFIG = {

  // スプレッドシートID。
  // 空文字 '' の場合はスクリプトが紐づくスプレッドシートを使用します。
  // (スプレッドシートから「拡張機能 > Apps Script」で作る場合は空文字のままでOK)
  SPREADSHEET_ID: '',

  // 対象シート名
  SHEET_NAME: 'スケジュール',

  // ヘッダー行の行番号(1始まり)
  HEADER_ROW: 1,

  // 列名の定義(スプレッドシートのヘッダー文字列と一致させる)
  COLUMNS: {
    ID:     'ID',
    YEAR:   '年',
    MONTH:  '月',
    DAY:    '日',
    START:  '開始時刻',
    END:    '終了時刻',
    ZENTAI: '全体イベント',
    BUSHO:  '部署イベント',
    NOTE:   '備考',
  },

  // 公開ページ化したときに「表示してよい列」の制御。
  // 今は個人用のため全て true。将来 NOTE を false にすれば備考を隠せます。
  VISIBLE_COLUMNS: {
    ID:     true,
    YEAR:   true,
    MONTH:  true,
    DAY:    true,
    START:  true,
    END:    true,
    ZENTAI: true,
    BUSHO:  true,
    NOTE:   true,
  },

  // カテゴリの表示設定(色凡例にも使用)
  CATEGORY: {
    zentai: { label: '全体イベント', color: '#3B6FB6' },
    busho:  { label: '部署イベント', color: '#3F9E6C' },
    none:   { label: '未分類',       color: '#9AA0A6' },
  },

  // ビュー関連の既定値
  VIEW: {
    DEFAULT: 'week',              // 'month' | 'week' | 'day' | 'list'
    SCROLL_START_HOUR: 8.5,       // タイムテーブルの初期スクロール位置(8:30)
    MONTH_MAX_EVENTS_PER_DAY: 2,  // 月表示は2件まで、3件目以降は「+N件」
    LIST_SORT: 'dateAsc',         // 一覧のデフォルトソート(日付昇順)
  },

  // ID 自動発行の設定
  ID: {
    SEQ_DIGITS: 2,  // 連番の桁数(10件超は 26072310、100件超は自動的に3桁)
  },
};


/* ============================================================
 * 2. 共通ユーティリティ
 * ============================================================ */

/**
 * タイムゾーンを取得します。
 * @return {string} 例: 'Asia/Tokyo'
 */
function getTimeZone_() {
  return Session.getScriptTimeZone();
}

/**
 * 対象のスプレッドシートを取得します。
 * @return {GoogleAppsScript.Spreadsheet.Spreadsheet}
 */
function getSpreadsheet_() {
  if (CONFIG.SPREADSHEET_ID) {
    return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  }
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error('スプレッドシートを取得できません。CONFIG.SPREADSHEET_ID を設定してください。');
  }
  return ss;
}

/**
 * 対象シートを取得します。
 * @return {GoogleAppsScript.Spreadsheet.Sheet}
 */
function getSheet_() {
  const sheet = getSpreadsheet_().getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    throw new Error('シート「' + CONFIG.SHEET_NAME + '」が見つかりません。');
  }
  return sheet;
}

/**
 * ヘッダー行から「列キー → 0始まりの列インデックス」の対応表を作ります。
 * 見つからない列は -1 になります。
 * @param {Array} headerRow ヘッダー行の値配列
 * @return {Object} 例: { ID: 0, YEAR: 1, ... }
 */
function buildColumnIndex_(headerRow) {
  const normalized = headerRow.map(function (h) {
    return String(h == null ? '' : h).trim();
  });

  const index = {};
  Object.keys(CONFIG.COLUMNS).forEach(function (key) {
    index[key] = normalized.indexOf(CONFIG.COLUMNS[key]);
  });
  return index;
}

/**
 * 値が空(未入力)かどうかを判定します。
 * @param {*} value
 * @return {boolean}
 */
function isBlank_(value) {
  return value === null || value === undefined || String(value).trim() === '';
}

/**
 * 数値に変換します。変換できない場合は null。
 * @param {*} value
 * @return {number|null}
 */
function toNumberOrNull_(value) {
  if (isBlank_(value)) return null;
  const n = Number(value);
  return isNaN(n) ? null : n;
}

/**
 * 数値を指定桁数でゼロ埋めします。
 * 桁数を超える場合はそのままの桁数で返します(例: 100 → '100')。
 * @param {number} num
 * @param {number} digits
 * @return {string}
 */
function zeroPad_(num, digits) {
  let s = String(num);
  while (s.length < digits) {
    s = '0' + s;
  }
  return s;
}

/**
 * 時刻セルの値を 'HH:mm' 形式の文字列に変換します。
 * 基本は時刻型(Date)ですが、文字列で入力された場合の保険も入れています。
 * 変換できない場合は null を返します。
 * @param {*} value
 * @return {string|null}
 */
function parseTimeToHHmm_(value) {
  if (isBlank_(value)) return null;

  // 時刻型セル(Date オブジェクト)の場合
  if (Object.prototype.toString.call(value) === '[object Date]') {
    if (isNaN(value.getTime())) return null;
    return Utilities.formatDate(value, getTimeZone_(), 'HH:mm');
  }

  const text = String(value).trim();

  // '9:00' '9：00' '9時00' などに対応
  const matched = text.match(/^(\d{1,2})\s*[:：時]\s*(\d{1,2})/);
  if (matched) {
    const hour = Number(matched[1]);
    const minute = Number(matched[2]);
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return zeroPad_(hour, 2) + ':' + zeroPad_(minute, 2);
    }
  }

  // '9' のように時のみの入力
  const hourOnly = text.match(/^(\d{1,2})$/);
  if (hourOnly) {
    const hour = Number(hourOnly[1]);
    if (hour >= 0 && hour <= 23) {
      return zeroPad_(hour, 2) + ':00';
    }
  }

  return null;
}

/**
 * 'HH:mm' を「0時からの経過分」に変換します。
 * @param {string|null} hhmm
 * @return {number|null}
 */
function hhmmToMinutes_(hhmm) {
  if (!hhmm) return null;
  const parts = hhmm.split(':');
  return Number(parts[0]) * 60 + Number(parts[1]);
}

/**
 * 年月日から 'yyyy-MM-dd' 形式の文字列を作ります。
 * @param {number} year
 * @param {number} month
 * @param {number} day
 * @return {string}
 */
function toDateKey_(year, month, day) {
  return zeroPad_(year, 4) + '-' + zeroPad_(month, 2) + '-' + zeroPad_(day, 2);
}

/**
 * 年月日から ID の先頭6桁(YYMMDD)を作ります。
 * @param {number} year 例: 2026
 * @param {number} month 例: 7
 * @param {number} day 例: 23
 * @return {string} 例: '260723'
 */
function toIdPrefix_(year, month, day) {
  const yy = zeroPad_(year % 100, 2);
  return yy + zeroPad_(month, 2) + zeroPad_(day, 2);
}

/**
 * 実在する日付かどうかを判定します(例: 2月30日を弾く)。
 * @param {number|null} year
 * @param {number|null} month
 * @param {number|null} day
 * @return {boolean}
 */
function isValidDate_(year, month, day) {
  if (year === null || month === null || day === null) return false;
  if (year < 1900 || year > 2999) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
}


/* ============================================================
 * 3. データ取得
 * ============================================================ */

/**
 * シートの生データ(ヘッダー + 全行)と列インデックスをまとめて取得します。
 * @return {{sheet: Object, values: Array, header: Array, rows: Array, colIndex: Object}}
 */
function readSheetData_() {
  const sheet = getSheet_();
  const values = sheet.getDataRange().getValues();

  if (values.length < CONFIG.HEADER_ROW) {
    throw new Error('シートにヘッダー行がありません。');
  }

  const header = values[CONFIG.HEADER_ROW - 1];
  const rows = values.slice(CONFIG.HEADER_ROW);
  const colIndex = buildColumnIndex_(header);

  // 必須列の存在チェック
  const required = ['ID', 'YEAR', 'MONTH', 'DAY'];
  const missing = required.filter(function (key) {
    return colIndex[key] === -1;
  });
  if (missing.length > 0) {
    const names = missing.map(function (key) { return CONFIG.COLUMNS[key]; });
    throw new Error('必要な列が見つかりません: ' + names.join(', '));
  }

  return {
    sheet: sheet,
    values: values,
    header: header,
    rows: rows,
    colIndex: colIndex,
  };
}

/**
 * 1行分の生データを、扱いやすいイベントオブジェクトに変換します。
 * 予定行でない(年月日が全て空)場合は null を返します。
 *
 * @param {Array} row シートの1行分の値
 * @param {Object} colIndex 列インデックス
 * @param {number} sheetRowNumber シート上の実際の行番号(1始まり)
 * @return {Object|null}
 */
function buildEvent_(row, colIndex, sheetRowNumber) {
  const get = function (key) {
    const idx = colIndex[key];
    return idx === -1 ? '' : row[idx];
  };

  const year  = toNumberOrNull_(get('YEAR'));
  const month = toNumberOrNull_(get('MONTH'));
  const day   = toNumberOrNull_(get('DAY'));

  // 年・月・日がいずれも空なら予定行ではない
  if (year === null && month === null && day === null) {
    return null;
  }

  const zentai = String(get('ZENTAI') || '').trim();
  const busho  = String(get('BUSHO') || '').trim();

  // カテゴリ判定(どちらか一方に予定名が入る想定)
  let category = 'none';
  let title = '';
  if (zentai) {
    category = 'zentai';
    title = zentai;
  } else if (busho) {
    category = 'busho';
    title = busho;
  }

  const start = parseTimeToHHmm_(get('START'));
  const end   = parseTimeToHHmm_(get('END'));
  const dateComplete = isValidDate_(year, month, day);

  return {
    row: sheetRowNumber,
    id: String(get('ID') || '').trim(),
    year: year,
    month: month,
    day: day,
    // 年月日が揃っていない行は dateKey を null にして、ビュー側で除外できるようにする
    dateKey: dateComplete ? toDateKey_(year, month, day) : null,
    dateComplete: dateComplete,
    start: start,
    end: end,
    startMinutes: hhmmToMinutes_(start),
    endMinutes: hhmmToMinutes_(end),
    // 開始・終了の両方が空欄なら終日イベント
    allDay: (start === null && end === null),
    category: category,
    title: title,
    // 公開ページ化を見据え、VISIBLE_COLUMNS で出し分け
    note: CONFIG.VISIBLE_COLUMNS.NOTE ? String(get('NOTE') || '').trim() : '',
  };
}

/**
 * 全予定を取得し、日付昇順(同日内は終日 → 開始時刻順)で並べて返します。
 * ビュー側・ics 出力側の共通データソースになります。
 *
 * @return {Array<Object>} イベントオブジェクトの配列
 */
function getEvents_() {
  const data = readSheetData_();
  const events = [];

  data.rows.forEach(function (row, i) {
    const sheetRowNumber = CONFIG.HEADER_ROW + i + 1;
    const event = buildEvent_(row, data.colIndex, sheetRowNumber);
    if (event) {
      events.push(event);
    }
  });

  return sortEvents_(events);
}

/**
 * イベント配列を日付昇順に並べ替えます。
 * 同日内は「終日イベントを先頭 → 開始時刻の早い順」とします。
 * @param {Array<Object>} events
 * @return {Array<Object>}
 */
function sortEvents_(events) {
  return events.slice().sort(function (a, b) {
    // 日付が不完全な行は末尾へ
    if (a.dateKey === null && b.dateKey === null) return a.row - b.row;
    if (a.dateKey === null) return 1;
    if (b.dateKey === null) return -1;

    if (a.dateKey !== b.dateKey) {
      return a.dateKey < b.dateKey ? -1 : 1;
    }

    // 終日イベントを先に
    if (a.allDay !== b.allDay) {
      return a.allDay ? -1 : 1;
    }

    const aStart = a.startMinutes === null ? 0 : a.startMinutes;
    const bStart = b.startMinutes === null ? 0 : b.startMinutes;
    if (aStart !== bStart) return aStart - bStart;

    return a.row - b.row;
  });
}


/* ============================================================
 * 4. ID 自動発行
 * ============================================================
 * 形式: YYMMDD + 連番2桁 (例: 26072301)
 *
 * 発行対象:
 *   年・月・日が揃っている行のうち、
 *     (a) ID が空欄
 *     (b) ID の形式が不正
 *     (c) ID の先頭6桁が行の年月日と一致しない(= 日付が変更された)
 *     (d) 他の行と ID が重複している
 *
 * 排他制御:
 *   LockService により、貼り付け・同時編集時の重複発行を防ぎます。
 */

/**
 * ID 文字列を分解します。形式に合わない場合は null を返します。
 * @param {string} id
 * @return {{prefix: string, seq: number}|null}
 */
function parseId_(id) {
  const text = String(id || '').trim();
  const matched = text.match(/^(\d{6})(\d{2,})$/);
  if (!matched) return null;
  return {
    prefix: matched[1],
    seq: Number(matched[2]),
  };
}

/**
 * シート全体を走査して、ID が未発行・または日付と不整合な行に ID を発行します。
 * トリガーから呼ばれるほか、手動実行でも使えます。
 *
 * @return {number} 発行(更新)した件数
 */
function assignIds() {
  const lock = LockService.getScriptLock();

  // 最大 30 秒待機。取得できなければ今回はスキップ(次の編集時に再実行されます)
  if (!lock.tryLock(30000)) {
    console.warn('ID発行: ロックを取得できなかったためスキップしました。');
    return 0;
  }

  try {
    return assignIdsCore_();
  } finally {
    lock.releaseLock();
  }
}

/**
 * ID 発行の本体処理(ロック内で実行される想定)。
 * @return {number} 発行(更新)した件数
 */
function assignIdsCore_() {
  const data = readSheetData_();
  const colIndex = data.colIndex;
  const idCol = colIndex.ID;

  if (data.rows.length === 0) return 0;

  // 行ごとの状態を組み立てる
  const entries = data.rows.map(function (row, i) {
    const year  = toNumberOrNull_(row[colIndex.YEAR]);
    const month = toNumberOrNull_(row[colIndex.MONTH]);
    const day   = toNumberOrNull_(row[colIndex.DAY]);
    const eligible = isValidDate_(year, month, day);

    return {
      rowOffset: i,
      currentId: String(row[idCol] || '').trim(),
      eligible: eligible,                                   // 年月日が揃っている行のみ発行対象
      prefix: eligible ? toIdPrefix_(year, month, day) : null,
      newId: null,
    };
  });

  // --- 第1パス: そのまま維持できる ID を確定し、使用済み連番を記録 ---
  const usedSeq = {};  // prefix -> { seq: true }
  const seenId = {};   // ID 重複検出用

  entries.forEach(function (entry) {
    if (!entry.eligible || !entry.currentId) return;

    const parsed = parseId_(entry.currentId);
    if (!parsed) return;                        // 形式不正 → 再発行
    if (parsed.prefix !== entry.prefix) return; // 日付が変更された → 再発行
    if (seenId[entry.currentId]) return;        // 重複 → 先勝ちで、後の行を再発行

    seenId[entry.currentId] = true;
    if (!usedSeq[parsed.prefix]) usedSeq[parsed.prefix] = {};
    usedSeq[parsed.prefix][parsed.seq] = true;
    entry.newId = entry.currentId; // 維持
  });

  // --- 第2パス: 未確定の行に「同日の最大連番 + 1」で採番 ---
  const maxSeq = {}; // prefix -> 現在の最大連番
  Object.keys(usedSeq).forEach(function (prefix) {
    maxSeq[prefix] = Object.keys(usedSeq[prefix]).reduce(function (max, seqStr) {
      return Math.max(max, Number(seqStr));
    }, 0);
  });

  let changedCount = 0;

  entries.forEach(function (entry) {
    if (!entry.eligible) {
      // 年月日が揃っていない行には発行しない(既存 ID はそのまま残す)
      entry.newId = entry.currentId;
      return;
    }
    if (entry.newId !== null) return; // 第1パスで維持が確定済み

    const prefix = entry.prefix;
    const next = (maxSeq[prefix] || 0) + 1;
    maxSeq[prefix] = next;

    entry.newId = prefix + zeroPad_(next, CONFIG.ID.SEQ_DIGITS);
    if (entry.newId !== entry.currentId) {
      changedCount++;
    }
  });

  if (changedCount === 0) return 0;

  // --- 書き込み ---
  // ID が数値として解釈されないよう、書式を文字列(@)にしてから書き込みます。
  // ※ スクリプトによる書き込みではトリガーは再発火しないため、ループしません。
  const idRange = data.sheet.getRange(
    CONFIG.HEADER_ROW + 1,
    idCol + 1,
    entries.length,
    1
  );
  idRange.setNumberFormat('@');
  idRange.setValues(entries.map(function (entry) {
    return [entry.newId];
  }));

  console.log('ID発行: ' + changedCount + ' 件を更新しました。');
  return changedCount;
}


/* ============================================================
 * 5. トリガー設定
 * ============================================================
 * インストール型トリガーを使用します。
 *   - onEdit  : セル単体の編集を検知
 *   - onChange: 行の挿入・削除、貼り付けなど構造的な変更を検知
 * 両方を登録することで、複数行の貼り付けにも対応します。
 */

/**
 * 【初回のみ手動実行】インストール型トリガーを登録します。
 * 重複を避けるため、既存の同名トリガーを削除してから登録します。
 */
function setupTriggers() {
  const ss = getSpreadsheet_();
  const handlerNames = ['handleEdit', 'handleChange'];

  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (handlerNames.indexOf(trigger.getHandlerFunction()) !== -1) {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('handleEdit')
    .forSpreadsheet(ss)
    .onEdit()
    .create();

  ScriptApp.newTrigger('handleChange')
    .forSpreadsheet(ss)
    .onChange()
    .create();

  console.log('トリガーを登録しました(handleEdit / handleChange)。');
}

/**
 * 【任意】登録済みトリガーを全て削除します。
 */
function removeTriggers() {
  const handlerNames = ['handleEdit', 'handleChange'];
  let count = 0;

  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (handlerNames.indexOf(trigger.getHandlerFunction()) !== -1) {
      ScriptApp.deleteTrigger(trigger);
      count++;
    }
  });

  console.log('トリガーを ' + count + ' 件削除しました。');
}

/**
 * onEdit(インストール型)ハンドラ
 * @param {Object} e イベントオブジェクト
 */
function handleEdit(e) {
  if (!isTargetSheetEvent_(e)) return;
  assignIds();
}

/**
 * onChange(インストール型)ハンドラ
 * 貼り付け・行挿入・行削除などを検知します。
 * @param {Object} e イベントオブジェクト
 */
function handleChange(e) {
  const targetTypes = ['EDIT', 'INSERT_ROW', 'REMOVE_ROW', 'PASTE', 'OTHER'];
  if (e && e.changeType && targetTypes.indexOf(e.changeType) === -1) {
    return;
  }
  assignIds();
}

/**
 * イベントが対象シートで発生したものかを判定します。
 * 判定できない場合は安全側に倒して true を返します。
 * @param {Object} e
 * @return {boolean}
 */
function isTargetSheetEvent_(e) {
  try {
    if (!e || !e.range) return true;
    return e.range.getSheet().getName() === CONFIG.SHEET_NAME;
  } catch (err) {
    return true;
  }
}


/* ============================================================
 * 6. 動作確認用(手動実行)
 * ============================================================ */

/**
 * 【動作確認用】データ取得結果をログに出力します。
 */
function debugLogEvents() {
  const events = getEvents_();
  console.log('取得件数: ' + events.length);

  events.slice(0, 20).forEach(function (ev) {
    console.log([
      'row=' + ev.row,
      'id=' + (ev.id || '(未発行)'),
      'date=' + (ev.dateKey || '(日付不完全)'),
      'time=' + (ev.allDay ? '終日' : (ev.start || '-') + '〜' + (ev.end || '-')),
      'category=' + ev.category,
      'title=' + (ev.title || '(無題)'),
    ].join(' | '));
  });
}

/**
 * 【動作確認用】シート構成のチェックを行います。
 * 列名の不一致などをここで早期に発見できます。
 */
function debugCheckSheet() {
  const data = readSheetData_();
  console.log('シート名: ' + data.sheet.getName());
  console.log('データ行数: ' + data.rows.length);
  console.log('列インデックス: ' + JSON.stringify(data.colIndex));

  Object.keys(data.colIndex).forEach(function (key) {
    if (data.colIndex[key] === -1) {
      console.warn('列が見つかりません: ' + CONFIG.COLUMNS[key]);
    }
  });
}
