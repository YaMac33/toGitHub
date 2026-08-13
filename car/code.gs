/**
 * 公用車利用履歴管理アプリ ─ バックエンド本体
 *
 * 【重要】setup.gs と同じGASプロジェクトに配置すること。
 *   SS_NAME / SHEET / LOG_HEADERS などの定数は setup.gs 側で
 *   宣言済みのものをそのまま使用します（再宣言するとエラーになります）。
 *
 * 【エンドポイント】
 *   入力画面（QR経由）: .../exec?page=input&vehicleId=V003
 *   入力画面（手動）  : .../exec?page=input
 *   一覧・検索画面    : .../exec?page=list
 *   ※ page 未指定時は入力画面を表示
 */

const TZ = 'Asia/Tokyo';

// ============================================================
// ルーティング
// ============================================================

function doGet(e) {
  const params = (e && e.parameter) ? e.parameter : {};
  const page = params.page || 'input';

  let file, title;
  if (page === 'list') {
    file = 'list';
    title = '公用車 利用履歴 一覧・検索';
  } else {
    file = 'input';
    title = '公用車 利用履歴 入力';
  }

  const tpl = HtmlService.createTemplateFromFile(file);
  // テンプレート側で <?= vehicleId ?> として参照できる
  tpl.vehicleId = params.vehicleId || '';

  return tpl.evaluate()
    .setTitle(title)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** HTML内から他ファイルを取り込む場合に使用（CSS/JSの分割用） */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/** 現在のWebアプリURLを返す（画面間リンク用） */
function getWebAppUrl() {
  return ScriptApp.getService().getUrl();
}

// ============================================================
// 共通ヘルパー
// ============================================================

function getSs_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) {
    throw new Error('SPREADSHEET_ID が未設定です。setup() を先に実行してください。');
  }
  return SpreadsheetApp.openById(id);
}

function getSheet_(name) {
  const sh = getSs_().getSheetByName(name);
  if (!sh) throw new Error('シートが見つかりません: ' + name);
  return sh;
}

/** ヘッダー名 → 列インデックス(0始まり) のマップを返す */
function colIndex_(headers) {
  const map = {};
  headers.forEach((h, i) => { map[h] = i; });
  return map;
}

/** Date または 'yyyy-MM-dd' 文字列 → 'yyMMdd' */
function toDateKey_(dateLike) {
  const d = toDate_(dateLike);
  return Utilities.formatDate(d, TZ, 'yyMMdd');
}

/** 各種入力を Date に正規化（時刻は0:00に丸める） */
function toDate_(dateLike) {
  if (dateLike instanceof Date) {
    return new Date(dateLike.getFullYear(), dateLike.getMonth(), dateLike.getDate());
  }
  const s = String(dateLike).trim();
  const m = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (!m) throw new Error('日付の形式が不正です: ' + s);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function formatDate_(d, fmt) {
  if (!(d instanceof Date) || isNaN(d.getTime())) return '';
  return Utilities.formatDate(d, TZ, fmt || 'yyyy/MM/dd');
}

// ============================================================
// ID発番
// ============================================================

/**
 * 利用日を基準に ID を採番する（例: 260814001）。
 * IDカウンタシートを更新するため LockService で排他制御する。
 */
function issueId_(useDate) {
  const key = toDateKey_(useDate);
  const sh = getSheet_(SHEET.COUNTER);
  const values = sh.getDataRange().getValues();

  let rowNum = -1;
  let count = 0;
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]).trim() === key) {
      rowNum = i + 1;
      count = Number(values[i][1]) || 0;
      break;
    }
  }

  const next = count + 1;
  if (next > 999) {
    throw new Error('同一日の登録件数が上限(999件)に達しました: ' + key);
  }

  if (rowNum > 0) {
    sh.getRange(rowNum, 2).setValue(next);
  } else {
    sh.appendRow([key, next]);
    sh.getRange(sh.getLastRow(), 1).setNumberFormat('@').setValue(key);
  }

  return key + ('00' + next).slice(-3);
}

// ============================================================
// マスタ取得
// ============================================================

/** 有効な車両の一覧を返す */
function getVehicles_(includeDisabled) {
  const sh = getSheet_(SHEET.VEHICLE);
  const values = sh.getDataRange().getValues();
  const c = colIndex_(VEHICLE_HEADERS);
  const list = [];

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (!row[c['車両ID']]) continue;
    const active = row[c['有効']] === true || row[c['有効']] === 'TRUE';
    if (!includeDisabled && !active) continue;
    list.push({
      vehicleId: String(row[c['車両ID']]).trim(),
      name:      String(row[c['車両名']]).trim(),
      plate:     String(row[c['ナンバープレート']]).trim(),
      active:    active,
    });
  }
  return list;
}

/** 点検項目マスタを表示順で返す */
function getInspectItems_() {
  const sh = getSheet_(SHEET.INSPECT);
  const values = sh.getDataRange().getValues();
  const c = colIndex_(INSPECT_HEADERS);
  const list = [];

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (!row[c['項目名']]) continue;
    list.push({
      itemId: String(row[c['項目ID']]).trim(),
      name:   String(row[c['項目名']]).trim(),
      order:  Number(row[c['表示順']]) || 999,
    });
  }
  list.sort((a, b) => a.order - b.order);
  return list;
}

/**
 * 指定車両の直近の利用記録を返す（前回走行距離の参考表示用）。
 * 該当なしの場合は null。
 */
function getLastRecord_(vehicleId) {
  if (!vehicleId) return null;

  const sh = getSheet_(SHEET.LOG);
  const last = sh.getLastRow();
  if (last < 2) return null;

  const values = sh.getRange(2, 1, last - 1, LOG_HEADERS.length).getValues();
  const c = colIndex_(LOG_HEADERS);

  let found = null;
  // 下から探索（新しい行が下にある想定）
  for (let i = values.length - 1; i >= 0; i--) {
    if (String(values[i][c['車両ID']]).trim() === vehicleId) {
      found = values[i];
      break;
    }
  }
  if (!found) return null;

  return {
    id:        String(found[c['ID']]),
    useDate:   formatDate_(found[c['利用日']]),
    distance:  found[c['走行距離(km)']],
    user:      String(found[c['利用者氏名']]),
    destination: String(found[c['行先']]),
  };
}

// ============================================================
// 入力画面用API
// ============================================================

/**
 * 入力フォームの初期化データを一括で返す。
 * @param {string} vehicleId QRから渡された車両ID（無い場合は空文字）
 */
function getInputInitData(vehicleId) {
  const vid = String(vehicleId || '').trim();
  const vehicles = getVehicles_(false);
  const fixed = vid ? vehicles.filter(v => v.vehicleId === vid)[0] || null : null;

  return {
    vehicles:     vehicles,
    inspectItems: getInspectItems_(),
    fixedVehicle: fixed,
    // QRのIDがマスタに無い場合はフロント側で警告表示させる
    unknownVehicleId: (vid && !fixed) ? vid : '',
    lastRecord:   fixed ? getLastRecord_(fixed.vehicleId) : null,
    today:        formatDate_(new Date(), 'yyyy-MM-dd'),
    alcOptions:     ALC_OPTIONS,
    inspectOptions: INSPECT_OPTIONS,
  };
}

/** 車両を切り替えたときに前回記録だけを取り直す */
function getLastRecordFor(vehicleId) {
  return getLastRecord_(String(vehicleId || '').trim());
}

/**
 * 利用履歴を保存する。
 * @param {Object} p フォームからの入力値
 * @return {Object} { id, message }
 */
function saveRecord(p) {
  const errors = validateRecord_(p);
  if (errors.length) {
    throw new Error('入力内容に不備があります:\n・' + errors.join('\n・'));
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) {
    throw new Error('他の処理が実行中です。しばらく待って再度お試しください。');
  }

  try {
    const useDate = toDate_(p.useDate);
    const id = issueId_(useDate);

    const vehicle = getVehicles_(true).filter(v => v.vehicleId === p.vehicleId)[0];
    const vehicleName = vehicle ? vehicle.name : '';

    const row = [];
    const c = colIndex_(LOG_HEADERS);
    row[c['ID']]                  = id;
    row[c['利用日']]              = useDate;
    row[c['車両ID']]              = p.vehicleId;
    row[c['車両名']]              = vehicleName;
    row[c['利用者氏名']]          = String(p.userName).trim();
    row[c['行先']]                = String(p.destination).trim();
    row[c['走行距離(km)']]        = Number(p.distance);
    row[c['給油量(L)']]           = (p.fuel === '' || p.fuel == null) ? '' : Number(p.fuel);
    row[c['アルコール(出発前)']]  = p.alcBefore;
    row[c['確認者(出発前)']]      = String(p.alcBeforeChecker).trim();
    row[c['アルコール(帰着後)']]  = p.alcAfter;
    row[c['確認者(帰着後)']]      = String(p.alcAfterChecker).trim();
    row[c['点検結果']]            = JSON.stringify(p.inspect || {});
    row[c['点検備考']]            = String(p.inspectNote || '').trim();
    row[c['登録日時']]            = new Date();
    row[c['登録者']]              = String(p.registrant || p.userName).trim();

    const sh = getSheet_(SHEET.LOG);
    sh.appendRow(row);

    return { id: id, message: '登録しました（ID: ' + id + '）' };
  } finally {
    lock.releaseLock();
  }
}

/** 保存前のサーバー側バリデーション */
function validateRecord_(p) {
  const e = [];
  if (!p) return ['データが送信されていません'];

  if (!p.useDate)      e.push('利用日を入力してください');
  if (!p.vehicleId)    e.push('車両を選択してください');
  if (!String(p.userName || '').trim())    e.push('利用者氏名を入力してください');
  if (!String(p.destination || '').trim()) e.push('行先を入力してください');

  const dist = Number(p.distance);
  if (p.distance === '' || p.distance == null || isNaN(dist)) {
    e.push('走行距離を数値で入力してください');
  } else if (dist < 0) {
    e.push('走行距離に負の値は入力できません');
  } else if (dist > 2000) {
    e.push('走行距離が異常な値です（2000kmを超えています）');
  }

  if (p.fuel !== '' && p.fuel != null) {
    const fuel = Number(p.fuel);
    if (isNaN(fuel) || fuel < 0) e.push('給油量は0以上の数値で入力してください');
    else if (fuel > 200) e.push('給油量が異常な値です（200Lを超えています）');
  }

  if (ALC_OPTIONS.indexOf(p.alcBefore) < 0) e.push('出発前のアルコールチェック結果を選択してください');
  if (!String(p.alcBeforeChecker || '').trim()) e.push('出発前の確認者氏名を入力してください');
  if (ALC_OPTIONS.indexOf(p.alcAfter) < 0) e.push('帰着後のアルコールチェック結果を選択してください');
  if (!String(p.alcAfterChecker || '').trim()) e.push('帰着後の確認者氏名を入力してください');

  // 点検は全項目の入力を必須とする
  const items = getInspectItems_();
  const insp = p.inspect || {};
  items.forEach(function (it) {
    if (INSPECT_OPTIONS.indexOf(insp[it.name]) < 0) {
      e.push('点検項目「' + it.name + '」を選択してください');
    }
  });

  // 未来日は不可（当日まで）
  try {
    const d = toDate_(p.useDate);
    const today = toDate_(new Date());
    if (d.getTime() > today.getTime()) e.push('利用日に未来の日付は指定できません');
  } catch (err) {
    e.push('利用日の形式が不正です');
  }

  return e;
}

/**
 * 入力画面から新規車両を登録する。
 * 車両IDは V001 形式で自動採番。
 */
function registerVehicle(p) {
  const name  = String((p && p.name) || '').trim();
  const plate = String((p && p.plate) || '').trim();
  if (!name)  throw new Error('車両名を入力してください');
  if (!plate) throw new Error('ナンバープレートを入力してください');

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw new Error('他の処理が実行中です。再度お試しください。');

  try {
    const existing = getVehicles_(true);
    if (existing.some(v => v.name === name)) {
      throw new Error('同じ車両名がすでに登録されています: ' + name);
    }

    // 既存の最大番号 + 1
    let max = 0;
    existing.forEach(function (v) {
      const m = v.vehicleId.match(/^V(\d+)$/);
      if (m) max = Math.max(max, Number(m[1]));
    });
    const newId = 'V' + ('00' + (max + 1)).slice(-3);

    const sh = getSheet_(SHEET.VEHICLE);
    sh.appendRow([newId, name, plate, new Date(), true]);
    sh.getRange(sh.getLastRow(), 5).insertCheckboxes().setValue(true);

    return { vehicleId: newId, name: name, plate: plate, active: true };
  } finally {
    lock.releaseLock();
  }
}

// ============================================================
// 一覧・検索画面用API
// ============================================================

/** 検索画面の初期化データ */
function getListInitData() {
  return {
    vehicles:     getVehicles_(true),
    inspectItems: getInspectItems_(),
  };
}

/**
 * 利用履歴を検索する。
 * @param {Object} q { dateFrom, dateTo, vehicleId, userName, keyword, onlyIssue }
 * @return {Object} { records, total, inspectItems }
 */
function searchRecords(q) {
  q = q || {};
  const sh = getSheet_(SHEET.LOG);
  const last = sh.getLastRow();
  const items = getInspectItems_();
  if (last < 2) return { records: [], total: 0, inspectItems: items };

  const values = sh.getRange(2, 1, last - 1, LOG_HEADERS.length).getValues();
  const c = colIndex_(LOG_HEADERS);

  const from = q.dateFrom ? toDate_(q.dateFrom).getTime() : null;
  const to   = q.dateTo   ? toDate_(q.dateTo).getTime()   : null;
  const kw   = String(q.keyword || '').trim().toLowerCase();
  const user = String(q.userName || '').trim().toLowerCase();

  const records = [];
  values.forEach(function (row) {
    if (!row[c['ID']]) return;

    const d = row[c['利用日']];
    const t = (d instanceof Date) ? toDate_(d).getTime() : null;
    if (from !== null && (t === null || t < from)) return;
    if (to   !== null && (t === null || t > to))   return;

    if (q.vehicleId && String(row[c['車両ID']]).trim() !== q.vehicleId) return;

    if (user && String(row[c['利用者氏名']]).toLowerCase().indexOf(user) < 0) return;

    if (kw) {
      const hay = [
        row[c['行先']], row[c['利用者氏名']], row[c['車両名']],
        row[c['点検備考']], row[c['ID']],
      ].join(' ').toLowerCase();
      if (hay.indexOf(kw) < 0) return;
    }

    const inspect = parseInspect_(row[c['点検結果']]);
    const hasIssue = Object.keys(inspect).some(k => inspect[k] === '否')
      || row[c['アルコール(出発前)']] === 'NG'
      || row[c['アルコール(帰着後)']] === 'NG';

    if (q.onlyIssue && !hasIssue) return;

    records.push({
      id:               String(row[c['ID']]),
      useDate:          formatDate_(d),
      vehicleId:        String(row[c['車両ID']]),
      vehicleName:      String(row[c['車両名']]),
      userName:         String(row[c['利用者氏名']]),
      destination:      String(row[c['行先']]),
      distance:         row[c['走行距離(km)']],
      fuel:             row[c['給油量(L)']],
      alcBefore:        String(row[c['アルコール(出発前)']]),
      alcBeforeChecker: String(row[c['確認者(出発前)']]),
      alcAfter:         String(row[c['アルコール(帰着後)']]),
      alcAfterChecker:  String(row[c['確認者(帰着後)']]),
      inspect:          inspect,
      inspectNote:      String(row[c['点検備考']]),
      registeredAt:     formatDate_(row[c['登録日時']], 'yyyy/MM/dd HH:mm'),
      registrant:       String(row[c['登録者']]),
      hasIssue:         hasIssue,
    });
  });

  // 新しい順（利用日 → ID）
  records.sort(function (a, b) {
    if (a.useDate !== b.useDate) return a.useDate < b.useDate ? 1 : -1;
    return a.id < b.id ? 1 : -1;
  });

  return { records: records, total: records.length, inspectItems: items };
}

function parseInspect_(raw) {
  if (!raw) return {};
  try {
    const o = JSON.parse(raw);
    return (o && typeof o === 'object') ? o : {};
  } catch (e) {
    return {};
  }
}

/**
 * 検索結果をCSV文字列で返す。
 * 点検結果は項目ごとに列展開する。
 * フロント側で Blob 化してダウンロードさせる想定（BOM付きUTF-8）。
 */
function exportCsv(q) {
  const result = searchRecords(q);
  const items = result.inspectItems;

  const header = [
    'ID', '利用日', '車両ID', '車両名', '利用者氏名', '行先',
    '走行距離(km)', '給油量(L)',
    'アルコール(出発前)', '確認者(出発前)',
    'アルコール(帰着後)', '確認者(帰着後)',
  ]
    .concat(items.map(it => '点検:' + it.name))
    .concat(['点検備考', '登録日時', '登録者']);

  const lines = [header.map(csvCell_).join(',')];

  result.records.forEach(function (r) {
    const row = [
      r.id, r.useDate, r.vehicleId, r.vehicleName, r.userName, r.destination,
      r.distance, r.fuel,
      r.alcBefore, r.alcBeforeChecker,
      r.alcAfter, r.alcAfterChecker,
    ]
      .concat(items.map(it => r.inspect[it.name] || ''))
      .concat([r.inspectNote, r.registeredAt, r.registrant]);
    lines.push(row.map(csvCell_).join(','));
  });

  return {
    csv: '\uFEFF' + lines.join('\r\n'),
    filename: '公用車利用履歴_' + Utilities.formatDate(new Date(), TZ, 'yyyyMMdd_HHmm') + '.csv',
    count: result.total,
  };
}

function csvCell_(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

// ============================================================
// 動作確認用
// ============================================================

/** 各APIがエラーなく動くかをログで確認する */
function testApis() {
  Logger.log('--- 車両マスタ ---');
  Logger.log(JSON.stringify(getVehicles_(false)));

  Logger.log('--- 点検項目 ---');
  Logger.log(JSON.stringify(getInspectItems_()));

  Logger.log('--- 入力画面初期データ(V001) ---');
  Logger.log(JSON.stringify(getInputInitData('V001')));

  Logger.log('--- 検索(全件) ---');
  const r = searchRecords({});
  Logger.log('件数: ' + r.total);

  Logger.log('--- CSV(先頭200文字) ---');
  Logger.log(exportCsv({}).csv.substring(0, 200));
}
