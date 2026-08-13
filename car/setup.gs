/**
 * 公用車利用履歴管理アプリ ─ スプレッドシート初期化スクリプト
 *
 * 【使い方】
 *  1. 新規のGASプロジェクトにこのファイルを貼り付ける
 *  2. 関数 setup() を実行する（初回は認可ダイアログが出るので許可）
 *  3. 実行ログに出力されるスプレッドシートURLを開いて確認
 *
 *  作成されるシート:
 *    ① 利用履歴       … メインデータ
 *    ② 車両マスタ     … 車両の一覧（入力画面から追加可）
 *    ③ 点検項目マスタ … 点検チェックリストの項目定義
 *    ④ IDカウンタ     … 利用日ごとの連番管理（裏方）
 */

// ============================================================
// 定数定義（本体アプリ側からも参照する想定）
// ============================================================

const SS_NAME = '公用車利用履歴管理';

const SHEET = {
  LOG:       '利用履歴',
  VEHICLE:   '車両マスタ',
  INSPECT:   '点検項目マスタ',
  COUNTER:   'IDカウンタ',
};

/** 利用履歴シートの列定義（順序がそのまま列順になる） */
const LOG_HEADERS = [
  'ID',
  '利用日',
  '車両ID',
  '車両名',
  '利用者氏名',
  '行先',
  '走行距離(km)',
  '給油量(L)',
  'アルコール(出発前)',
  '確認者(出発前)',
  'アルコール(帰着後)',
  '確認者(帰着後)',
  '点検結果',
  '点検備考',
  '登録日時',
  '登録者',
];

const VEHICLE_HEADERS = ['車両ID', '車両名', 'ナンバープレート', '登録日', '有効'];
const INSPECT_HEADERS = ['項目ID', '項目名', '表示順'];
const COUNTER_HEADERS = ['日付キー', '発行済件数'];

/** 判定値の選択肢 */
const ALC_OPTIONS = ['OK', 'NG'];
const INSPECT_OPTIONS = ['良', '否'];

// ============================================================
// メイン処理
// ============================================================

/**
 * スプレッドシートを新規作成し、全シート・サンプルデータを投入する。
 */
function setup() {
  const ss = SpreadsheetApp.create(SS_NAME);

  buildLogSheet_(ss);
  buildVehicleSheet_(ss);
  buildInspectSheet_(ss);
  buildCounterSheet_(ss);

  // 初期作成時の「シート1」を削除
  const defaultSheet = ss.getSheetByName('シート1') || ss.getSheetByName('Sheet1');
  if (defaultSheet) ss.deleteSheet(defaultSheet);

  // 本体アプリから参照できるようスクリプトプロパティに保存
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());

  Logger.log('=== セットアップ完了 ===');
  Logger.log('スプレッドシートID: ' + ss.getId());
  Logger.log('URL: ' + ss.getUrl());
}

// ============================================================
// ① 利用履歴シート
// ============================================================

function buildLogSheet_(ss) {
  const sh = ss.insertSheet(SHEET.LOG, 0);

  sh.getRange(1, 1, 1, LOG_HEADERS.length)
    .setValues([LOG_HEADERS])
    .setFontWeight('bold')
    .setBackground('#37474f')
    .setFontColor('#ffffff')
    .setHorizontalAlignment('center');

  sh.setFrozenRows(1);

  const rows = sampleLogRows_();
  sh.getRange(2, 1, rows.length, LOG_HEADERS.length).setValues(rows);

  // 書式設定
  sh.getRange('B:B').setNumberFormat('yyyy/mm/dd');           // 利用日
  sh.getRange('G:H').setNumberFormat('#,##0.0');              // 走行距離・給油量
  sh.getRange('O:O').setNumberFormat('yyyy/mm/dd hh:mm');     // 登録日時

  // 列幅
  const widths = [100, 95, 70, 130, 100, 160, 90, 80, 120, 100, 120, 100, 260, 200, 130, 100];
  widths.forEach((w, i) => sh.setColumnWidth(i + 1, w));

  // 入力規則（アルコール判定 OK/NG）
  const alcRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(ALC_OPTIONS, true)
    .setAllowInvalid(false)
    .build();
  sh.getRange('I2:I1000').setDataValidation(alcRule);
  sh.getRange('K2:K1000').setDataValidation(alcRule);

  // 条件付き書式（NGを赤で強調）
  const ngRule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('NG')
    .setBackground('#ffcdd2')
    .setFontColor('#b71c1c')
    .setRanges([sh.getRange('I2:I1000'), sh.getRange('K2:K1000')])
    .build();

  // 点検結果に「否」が含まれる行を強調
  const inspectNgRule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextContains('"否"')
    .setBackground('#fff3e0')
    .setRanges([sh.getRange('M2:M1000')])
    .build();

  sh.setConditionalFormatRules([ngRule, inspectNgRule]);
}

/**
 * サンプルの利用履歴データ。
 * 個人名・行先などは placeholder（〇〇）で記載。
 */
function sampleLogRows_() {
  const d = (y, m, day) => new Date(y, m - 1, day);
  const t = (y, m, day, h, mi) => new Date(y, m - 1, day, h, mi);

  /** 点検結果JSONを組み立てるヘルパー */
  const insp = (tire, oil, light, brake, washer) => JSON.stringify({
    'タイヤー': tire, 'オイル': oil, '灯火類': light,
    'ブレーキ': brake, 'ワイパー液': washer,
  });

  const ALL_OK = insp('良', '良', '良', '良', '良');

  return [
    ['260810001', d(2026, 8, 10), 'V001', '公用車1号車（〇〇）', '〇〇 太郎', '〇〇市役所',
      24.5, '', 'OK', '〇〇 課長', 'OK', '〇〇 課長', ALL_OK, '', t(2026, 8, 10, 16, 42), '〇〇 太郎'],

    ['260810002', d(2026, 8, 10), 'V003', '公用車3号車（〇〇）', '〇〇 花子', '〇〇小学校',
      12.0, '', 'OK', '〇〇 係長', 'OK', '〇〇 係長', ALL_OK, '', t(2026, 8, 10, 17, 5), '〇〇 花子'],

    ['260811001', d(2026, 8, 11), 'V002', '公用車2号車（〇〇）', '〇〇 一郎', '〇〇県庁',
      86.3, 32.5, 'OK', '〇〇 課長', 'OK', '〇〇 課長', ALL_OK, '帰路に給油（〇〇スタンド）',
      t(2026, 8, 11, 18, 20), '〇〇 一郎'],

    ['260812001', d(2026, 8, 12), 'V001', '公用車1号車（〇〇）', '〇〇 太郎', '〇〇公民館',
      8.2, '', 'OK', '〇〇 係長', 'OK', '〇〇 係長', ALL_OK, '', t(2026, 8, 12, 11, 30), '〇〇 太郎'],

    ['260812002', d(2026, 8, 12), 'V005', '公用車5号車（〇〇）', '〇〇 次郎', '〇〇地区 現地確認',
      31.7, '', 'OK', '〇〇 課長', 'OK', '〇〇 課長',
      insp('良', '良', '良', '良', '否'), 'ウォッシャー液が残量わずか。補充を依頼済み。',
      t(2026, 8, 12, 15, 55), '〇〇 次郎'],

    ['260812003', d(2026, 8, 12), 'V008', '公用車8号車（〇〇）', '〇〇 三郎', '〇〇環境センター',
      45.1, '', 'OK', '〇〇 係長', 'OK', '〇〇 係長', ALL_OK, '', t(2026, 8, 12, 17, 10), '〇〇 三郎'],

    ['260813001', d(2026, 8, 13), 'V003', '公用車3号車（〇〇）', '〇〇 花子', '〇〇保育園ほか2箇所',
      19.8, '', 'OK', '〇〇 課長', 'OK', '〇〇 課長', ALL_OK, '', t(2026, 8, 13, 16, 0), '〇〇 花子'],

    ['260814001', d(2026, 8, 14), 'V002', '公用車2号車（〇〇）', '〇〇 一郎', '〇〇合同庁舎',
      52.4, '', 'OK', '〇〇 課長', 'OK', '〇〇 課長',
      insp('否', '良', '良', '良', '良'), '右前タイヤの空気圧が低め。整備担当へ連絡済み。',
      t(2026, 8, 14, 14, 25), '〇〇 一郎'],

    ['260814002', d(2026, 8, 14), 'V001', '公用車1号車（〇〇）', '〇〇 太郎', '〇〇団地 訪問',
      6.9, '', 'OK', '〇〇 係長', 'OK', '〇〇 係長', ALL_OK, '', t(2026, 8, 14, 16, 48), '〇〇 太郎'],
  ];
}

// ============================================================
// ② 車両マスタシート
// ============================================================

function buildVehicleSheet_(ss) {
  const sh = ss.insertSheet(SHEET.VEHICLE, 1);

  sh.getRange(1, 1, 1, VEHICLE_HEADERS.length)
    .setValues([VEHICLE_HEADERS])
    .setFontWeight('bold')
    .setBackground('#1565c0')
    .setFontColor('#ffffff')
    .setHorizontalAlignment('center');

  sh.setFrozenRows(1);

  const today = new Date(2026, 3, 1);
  const rows = [];
  for (let i = 1; i <= 12; i++) {
    const id = 'V' + ('00' + i).slice(-3);
    rows.push([
      id,
      '公用車' + i + '号車（〇〇）',
      '〇〇 500 あ ' + (1000 + i * 7),
      today,
      true,
    ]);
  }

  sh.getRange(2, 1, rows.length, VEHICLE_HEADERS.length).setValues(rows);

  sh.getRange('D:D').setNumberFormat('yyyy/mm/dd');
  sh.getRange('E2:E1000').insertCheckboxes();

  [90, 190, 170, 110, 70].forEach((w, i) => sh.setColumnWidth(i + 1, w));

  // 運用メモ
  sh.getRange('G1').setValue('【メモ】')
    .setFontWeight('bold');
  sh.getRange('G2').setValue(
    '・「有効」のチェックを外すと入力画面の選択肢から除外されます（過去履歴は残ります）\n' +
    '・QRコードのURL: .../exec?page=input&vehicleId=V001 のように車両IDを付与'
  ).setWrap(true);
  sh.setColumnWidth(7, 420);
}

// ============================================================
// ③ 点検項目マスタシート
// ============================================================

function buildInspectSheet_(ss) {
  const sh = ss.insertSheet(SHEET.INSPECT, 2);

  sh.getRange(1, 1, 1, INSPECT_HEADERS.length)
    .setValues([INSPECT_HEADERS])
    .setFontWeight('bold')
    .setBackground('#2e7d32')
    .setFontColor('#ffffff')
    .setHorizontalAlignment('center');

  sh.setFrozenRows(1);

  const rows = [
    ['C001', 'タイヤー',   1],
    ['C002', 'オイル',     2],
    ['C003', '灯火類',     3],
    ['C004', 'ブレーキ',   4],
    ['C005', 'ワイパー液', 5],
  ];
  sh.getRange(2, 1, rows.length, INSPECT_HEADERS.length).setValues(rows);

  [90, 180, 80].forEach((w, i) => sh.setColumnWidth(i + 1, w));

  sh.getRange('E1').setValue('【メモ】').setFontWeight('bold');
  sh.getRange('E2').setValue(
    '・この表に行を追加／削除するだけで、入力フォームの点検チェック欄が自動で増減します\n' +
    '・選択肢は「' + INSPECT_OPTIONS.join('／') + '」の2択\n' +
    '・利用履歴シートの「点検結果」列にはJSON形式で保存されます'
  ).setWrap(true);
  sh.setColumnWidth(5, 420);
}

// ============================================================
// ④ IDカウンタシート
// ============================================================

function buildCounterSheet_(ss) {
  const sh = ss.insertSheet(SHEET.COUNTER, 3);

  sh.getRange(1, 1, 1, COUNTER_HEADERS.length)
    .setValues([COUNTER_HEADERS])
    .setFontWeight('bold')
    .setBackground('#6d4c41')
    .setFontColor('#ffffff')
    .setHorizontalAlignment('center');

  sh.setFrozenRows(1);

  // サンプル履歴に対応した発行済件数
  const rows = [
    ['260810', 2],
    ['260811', 1],
    ['260812', 3],
    ['260813', 1],
    ['260814', 2],
  ];
  sh.getRange(2, 1, rows.length, COUNTER_HEADERS.length).setValues(rows);

  sh.getRange('A:A').setNumberFormat('@');  // 文字列として保持（先頭0対策）
  [110, 110].forEach((w, i) => sh.setColumnWidth(i + 1, w));

  sh.getRange('D1').setValue('【メモ】').setFontWeight('bold');
  sh.getRange('D2').setValue(
    '・日付キーは「利用日」の西暦下2桁+月2桁+日2桁（例: 260814）\n' +
    '・ID = 日付キー + 当日連番3桁（例: 260814001）\n' +
    '・このシートは自動更新されるため、原則手動編集しないこと'
  ).setWrap(true);
  sh.setColumnWidth(4, 420);
}

// ============================================================
// 動作確認用ユーティリティ
// ============================================================

/**
 * 作成済みスプレッドシートのURLをログ出力する。
 */
function showSpreadsheetUrl() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) {
    Logger.log('SPREADSHEET_ID が未設定です。先に setup() を実行してください。');
    return;
  }
  Logger.log(SpreadsheetApp.openById(id).getUrl());
}

/**
 * 【注意】全シートを削除して作り直したい場合に使用。
 * 既存のスプレッドシート自体は残るため、不要なら手動でゴミ箱へ。
 */
function resetAll() {
  PropertiesService.getScriptProperties().deleteProperty('SPREADSHEET_ID');
  Logger.log('SPREADSHEET_ID をクリアしました。setup() を再実行してください。');
}
