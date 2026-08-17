/**
 * ============================================================
 * メルカリ売上管理表 - 初期セットアップスクリプト
 * ============================================================
 * setupAll() を実行すると、以下の3シートを作成・初期化します。
 *   1. Sales          … 売上記録（メイン入力）
 *   2. ShippingMaster … 送料マスタ（料金改定時はここを更新）
 *   3. Summary        … 月別集計
 *
 * シート構造ルール:
 *   1行目 = 日本語ヘッダー（人が見る用）
 *   2行目 = 英語キー名（コードから参照する用）
 *   3行目以降 = データ
 * ============================================================
 */


/* ============================================================
 * 設定値
 * ============================================================ */

const CONFIG = {
  // 通常は空でOK。PropertiesServiceにIDが自動保存されるため手動設定は不要。
  // 既存の特定シートに強制的に紐づけたい場合のみ、IDを直接指定する。
  SPREADSHEET_ID: '',

  // 販売手数料率（10%）
  FEE_RATE: 0.10,

  // シート名
  SHEET_SALES: 'Sales',
  SHEET_SHIPPING: 'ShippingMaster',
  SHEET_SUMMARY: 'Summary',

  // ヘッダー行の定義
  HEADER_ROW_JP: 1,
  HEADER_ROW_EN: 2,
  DATA_START_ROW: 3,

  // 配送方法の名称
  METHOD_RAKURAKU: 'らくらくメルカリ便',
  METHOD_YUYU: 'ゆうゆうメルカリ便',
};


/**
 * 新規作成したスプレッドシートのIDを保存しておくためのプロパティキー
 * （スタンドアロンスクリプトが「毎回どのシートを使うか」を覚えておく仕組み）
 */
const PROP_SPREADSHEET_ID = 'MERCARI_SPREADSHEET_ID';


/* ============================================================
 * シート定義（1行目=日本語 / 2行目=英語キー）
 * ============================================================ */

const SCHEMA = {
  Sales: {
    jp: ['商品名', '販売価格', '配送方法', 'サイズ区分', '手数料', '送料', '収入', '販売日'],
    en: ['itemName', 'price', 'shippingMethod', 'sizeCategory', 'fee', 'shippingCost', 'income', 'saleDate'],
    widths: [260, 100, 150, 180, 100, 100, 100, 120],
  },
  ShippingMaster: {
    jp: ['配送方法', 'サイズ区分', '送料'],
    en: ['shippingMethod', 'sizeCategory', 'shippingCost'],
    widths: [160, 220, 100],
  },
  Summary: {
    jp: ['年月', '件数', '合計売上', '合計手数料', '合計送料', '合計収入'],
    en: ['yearMonth', 'count', 'totalPrice', 'totalFee', 'totalShipping', 'totalIncome'],
    widths: [100, 80, 120, 120, 120, 120],
  },
};


/* ============================================================
 * 送料マスタ サンプルデータ
 * ------------------------------------------------------------
 * ⚠️ 金額は必ずメルカリ公式ヘルプの最新料金表で確認して
 *    実際の値に更新してください。改定時もここだけ直せばOK。
 * ============================================================ */

const SHIPPING_SAMPLE = [
  // --- らくらくメルカリ便（ヤマト運輸） ---
  [CONFIG.METHOD_RAKURAKU, 'ネコポス',                210],
  [CONFIG.METHOD_RAKURAKU, '宅急便コンパクト',        450],
  [CONFIG.METHOD_RAKURAKU, '宅急便 60サイズ',         750],
  [CONFIG.METHOD_RAKURAKU, '宅急便 80サイズ',         850],
  [CONFIG.METHOD_RAKURAKU, '宅急便 100サイズ',       1050],
  [CONFIG.METHOD_RAKURAKU, '宅急便 120サイズ',       1200],
  [CONFIG.METHOD_RAKURAKU, '宅急便 140サイズ',       1450],
  [CONFIG.METHOD_RAKURAKU, '宅急便 160サイズ',       1700],
  [CONFIG.METHOD_RAKURAKU, '宅急便 180サイズ',       2100],
  [CONFIG.METHOD_RAKURAKU, '宅急便 200サイズ',       2500],

  // --- ゆうゆうメルカリ便（日本郵便） ---
  [CONFIG.METHOD_YUYU,     'ゆうパケットポストmini',  160],
  [CONFIG.METHOD_YUYU,     'ゆうパケットポスト',      215],
  [CONFIG.METHOD_YUYU,     'ゆうパケット',            230],
  [CONFIG.METHOD_YUYU,     'ゆうパック 60サイズ',      750],
  [CONFIG.METHOD_YUYU,     'ゆうパック 80サイズ',      870],
  [CONFIG.METHOD_YUYU,     'ゆうパック 100サイズ',    1070],
  [CONFIG.METHOD_YUYU,     'ゆうパック 120サイズ',    1200],
  [CONFIG.METHOD_YUYU,     'ゆうパック 140サイズ',    1450],
  [CONFIG.METHOD_YUYU,     'ゆうパック 160サイズ',    1700],
  [CONFIG.METHOD_YUYU,     'ゆうパック 170サイズ',    1900],
];


/* ============================================================
 * メイン処理
 * ============================================================ */

/**
 * 全シートをセットアップする（これを実行する）
 * 初回実行時は新規スプレッドシートを自動作成し、そのIDを記憶する。
 * 2回目以降は同じスプレッドシートを再利用する。
 */
function setupAll() {
  const ss = getSpreadsheet_();

  setupShippingMaster_(ss);
  setupSales_(ss);
  setupSummary_(ss);
  removeDefaultSheet_(ss);

  const message = 'セットアップ完了：3つのシートを作成しました。\n\n' +
    'スプレッドシートURL:\n' + ss.getUrl() + '\n\n' +
    '送料マスタの金額はサンプル値です。メルカリ公式の最新料金表で確認・更新してください。';

  // UIはコンテナバインド（スプレッドシートを開いた状態）でしか使えないため、
  // スタンドアロン実行時（スクリプトエディタから直接実行）はログ出力にフォールバックする
  try {
    SpreadsheetApp.getUi().alert('セットアップ完了', message, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) {
    Logger.log(message);
  }
}


/**
 * 対象のスプレッドシートを取得する共通ヘルパー
 * 優先順位：
 *   1. コンテナバインドスクリプトなら getActiveSpreadsheet()
 *   2. 過去に作成済みなら PropertiesService に保存されたIDから開く
 *   3. CONFIG.SPREADSHEET_ID が指定されていればそれを開く
 *   4. どれも無ければ新規スプレッドシートを作成し、IDを保存する
 * @private
 */
function getSpreadsheet_() {
  // 1. コンテナバインド（拡張機能 > Apps Script から開いた場合）
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;

  const props = PropertiesService.getScriptProperties();

  // 2. 過去にこのスクリプトが作成 or 指定したスプレッドシートがあれば再利用
  const storedId = props.getProperty(PROP_SPREADSHEET_ID);
  if (storedId) {
    try {
      return SpreadsheetApp.openById(storedId);
    } catch (e) {
      // 保存されていたIDのファイルが削除された等 → 作り直す
      Logger.log('保存済みのスプレッドシートを開けませんでした。新規作成します。ID: ' + storedId);
    }
  }

  // 3. 手動でIDを指定している場合はそれを使う
  if (CONFIG.SPREADSHEET_ID) {
    const manual = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    props.setProperty(PROP_SPREADSHEET_ID, CONFIG.SPREADSHEET_ID);
    return manual;
  }

  // 4. 初回実行 → 新規作成してIDを記憶
  const created = SpreadsheetApp.create('メルカリ売上管理表');
  props.setProperty(PROP_SPREADSHEET_ID, created.getId());
  Logger.log('新規スプレッドシートを作成しました: ' + created.getUrl());
  return created;
}


/* ============================================================
 * 各シートのセットアップ
 * ============================================================ */

/**
 * 送料マスタシートを作成する
 */
function setupShippingMaster_(ss) {
  const sheet = resetSheet_(ss, CONFIG.SHEET_SHIPPING);
  const schema = SCHEMA.ShippingMaster;

  writeHeaders_(sheet, schema);

  // サンプルデータを投入
  sheet.getRange(CONFIG.DATA_START_ROW, 1, SHIPPING_SAMPLE.length, 3)
       .setValues(SHIPPING_SAMPLE);

  // 送料列を通貨表示に
  sheet.getRange(CONFIG.DATA_START_ROW, 3, SHIPPING_SAMPLE.length, 1)
       .setNumberFormat('¥#,##0');

  applyLayout_(sheet, schema);
}


/**
 * 売上シートを作成する
 */
function setupSales_(ss) {
  const sheet = resetSheet_(ss, CONFIG.SHEET_SALES);
  const schema = SCHEMA.Sales;

  writeHeaders_(sheet, schema);

  // サンプル売上データ（手数料・送料・収入は計算済みの値を投入）
  const samples = [
    ['サンプル商品A（本）',       1200, CONFIG.METHOD_YUYU,     'ゆうパケット',     new Date()],
    ['サンプル商品B（Tシャツ）',  3500, CONFIG.METHOD_RAKURAKU, 'ネコポス',         new Date()],
    ['サンプル商品C（家電）',    12000, CONFIG.METHOD_RAKURAKU, '宅急便 80サイズ',  new Date()],
  ];

  const rows = samples.map(function(s) {
    const itemName = s[0];
    const price    = s[1];
    const method   = s[2];
    const size     = s[3];
    const saleDate = s[4];

    const fee      = calcFee(price);
    const shipping = lookupShippingCost(method, size);
    const income   = price - fee - shipping;

    return [itemName, price, method, size, fee, shipping, income, saleDate];
  });

  sheet.getRange(CONFIG.DATA_START_ROW, 1, rows.length, schema.en.length)
       .setValues(rows);

  // 表示形式
  sheet.getRange(CONFIG.DATA_START_ROW, 2, rows.length, 1).setNumberFormat('¥#,##0'); // 販売価格
  sheet.getRange(CONFIG.DATA_START_ROW, 5, rows.length, 3).setNumberFormat('¥#,##0'); // 手数料〜収入
  sheet.getRange(CONFIG.DATA_START_ROW, 8, rows.length, 1).setNumberFormat('yyyy/mm/dd');

  // 配送方法列にプルダウンを設定
  setMethodValidation_(sheet);

  applyLayout_(sheet, schema);
}


/**
 * 集計シートを作成する
 */
function setupSummary_(ss) {
  const sheet = resetSheet_(ss, CONFIG.SHEET_SUMMARY);
  const schema = SCHEMA.Summary;

  writeHeaders_(sheet, schema);
  applyLayout_(sheet, schema);

  // データは集計処理（別スクリプト）で書き込むため、ここでは空のまま
  sheet.getRange(CONFIG.DATA_START_ROW, 1)
       .setNote('集計データは updateSummary() の実行で生成されます。');
}


/* ============================================================
 * 計算ロジック（他のスクリプトからも使用）
 * ============================================================ */

/**
 * 販売手数料を計算する（10%・切り捨て）
 * @param {number} price 販売価格
 * @return {number} 手数料
 */
function calcFee(price) {
  return Math.floor(Number(price) * CONFIG.FEE_RATE);
}


/**
 * 送料マスタから送料を検索する
 * @param {string} method 配送方法
 * @param {string} size   サイズ区分
 * @return {number} 送料（該当なしは0）
 */
function lookupShippingCost(method, size) {
  const sheet = getSpreadsheet_()
                              .getSheetByName(CONFIG.SHEET_SHIPPING);
  if (!sheet) return 0;

  const lastRow = sheet.getLastRow();
  if (lastRow < CONFIG.DATA_START_ROW) return 0;

  const values = sheet.getRange(
    CONFIG.DATA_START_ROW, 1,
    lastRow - CONFIG.DATA_START_ROW + 1, 3
  ).getValues();

  for (let i = 0; i < values.length; i++) {
    if (values[i][0] === method && values[i][1] === size) {
      return Number(values[i][2]) || 0;
    }
  }
  return 0;
}


/**
 * 収入（純利益）を計算する
 * @param {number} price 販売価格
 * @param {string} method 配送方法
 * @param {string} size サイズ区分
 * @return {Object} {fee, shippingCost, income}
 */
function calcIncome(price, method, size) {
  const fee = calcFee(price);
  const shippingCost = lookupShippingCost(method, size);
  return {
    fee: fee,
    shippingCost: shippingCost,
    income: Number(price) - fee - shippingCost,
  };
}


/* ============================================================
 * 共通ヘルパー
 * ============================================================ */

/**
 * シートを取得する。既存があればクリア、なければ新規作成。
 */
function resetSheet_(ss, name) {
  let sheet = ss.getSheetByName(name);
  if (sheet) {
    sheet.clear();
    sheet.clearNotes();
    // 既存のデータ入力規則を解除
    sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns())
         .clearDataValidations();
  } else {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}


/**
 * 1行目に日本語ヘッダー、2行目に英語キーを書き込む
 */
function writeHeaders_(sheet, schema) {
  sheet.getRange(CONFIG.HEADER_ROW_JP, 1, 1, schema.jp.length).setValues([schema.jp]);
  sheet.getRange(CONFIG.HEADER_ROW_EN, 1, 1, schema.en.length).setValues([schema.en]);
}


/**
 * ヘッダーの書式・列幅・固定行を適用する
 */
function applyLayout_(sheet, schema) {
  const cols = schema.jp.length;

  // 1行目：日本語ヘッダー（濃色・白文字・太字）
  sheet.getRange(CONFIG.HEADER_ROW_JP, 1, 1, cols)
       .setBackground('#37474f')
       .setFontColor('#ffffff')
       .setFontWeight('bold')
       .setHorizontalAlignment('center')
       .setVerticalAlignment('middle');

  // 2行目：英語キー（薄色・グレー文字・小さめ）
  sheet.getRange(CONFIG.HEADER_ROW_EN, 1, 1, cols)
       .setBackground('#eceff1')
       .setFontColor('#78909c')
       .setFontSize(9)
       .setFontFamily('Consolas')
       .setHorizontalAlignment('center');

  // 列幅
  schema.widths.forEach(function(w, i) {
    sheet.setColumnWidth(i + 1, w);
  });

  // ヘッダー2行を固定
  sheet.setFrozenRows(CONFIG.HEADER_ROW_EN);

  // 余分な列を非表示にせず削除（見た目をすっきりさせる）
  const maxCols = sheet.getMaxColumns();
  if (maxCols > cols) {
    sheet.deleteColumns(cols + 1, maxCols - cols);
  }
}


/**
 * 売上シートの配送方法列にプルダウンを設定する
 * ※サイズ区分の連動プルダウンはHTMLフォーム側で制御するため、
 *   シート上は配送方法のみ規則を設定
 */
function setMethodValidation_(sheet) {
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList([CONFIG.METHOD_RAKURAKU, CONFIG.METHOD_YUYU], true)
    .setAllowInvalid(false)
    .build();

  sheet.getRange(CONFIG.DATA_START_ROW, 3, 500, 1).setDataValidation(rule);
}


/**
 * 初期状態の「シート1」が残っていれば削除する
 */
function removeDefaultSheet_(ss) {
  const names = ['シート1', 'Sheet1'];
  names.forEach(function(name) {
    const sheet = ss.getSheetByName(name);
    if (sheet && ss.getSheets().length > 1) {
      ss.deleteSheet(sheet);
    }
  });
}


/* ============================================================
 * メニュー登録（スプレッドシートを開いた時に実行される）
 * ============================================================ */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('メルカリ管理')
    .addItem('初期セットアップを実行', 'setupAll')
    .addToUi();
}
