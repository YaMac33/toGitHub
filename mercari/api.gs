/**
 * ============================================================
 * メルカリ売上管理表 - API層
 * ============================================================
 * HTMLフロントエンド（index.html）から google.script.run 経由で
 * 呼び出される関数群。
 *
 * ※ 定数 CONFIG / SCHEMA、計算関数 calcFee() / lookupShippingCost()
 *    は setup.gs で定義済みのものを利用します。
 * ============================================================
 */


/* ============================================================
 * Webアプリのエントリポイント
 * ============================================================ */

/**
 * WebアプリとしてアクセスされたときにHTMLを返す
 */
function doGet() {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('メルカリ売上管理')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}


/**
 * HTML内で他ファイル（CSS/JS）を読み込むためのヘルパー
 * 使い方: <?!= include('style'); ?>
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}


/* ============================================================
 * 読み取り系API
 * ============================================================ */

/**
 * 画面初期表示に必要なデータを一括で返す
 * @return {Object} { shippingOptions, feeRate, recentSales }
 */
function getInitialData() {
  return {
    shippingOptions: getShippingOptions(),
    feeRate: CONFIG.FEE_RATE,
    recentSales: getRecentSales(50),
  };
}


/**
 * 送料マスタを「配送方法 → サイズ区分の配列」の形に整形して返す
 * 連動プルダウンの選択肢として使用する
 * @return {Object} 例: { "らくらくメルカリ便": [{size:"ネコポス", cost:210}, ...], ... }
 */
function getShippingOptions() {
  const sheet = getSpreadsheet_()
                              .getSheetByName(CONFIG.SHEET_SHIPPING);
  if (!sheet) return {};

  const lastRow = sheet.getLastRow();
  if (lastRow < CONFIG.DATA_START_ROW) return {};

  const values = sheet.getRange(
    CONFIG.DATA_START_ROW, 1,
    lastRow - CONFIG.DATA_START_ROW + 1, 3
  ).getValues();

  const result = {};
  values.forEach(function(row) {
    const method = String(row[0]).trim();
    const size   = String(row[1]).trim();
    const cost   = Number(row[2]) || 0;
    if (!method || !size) return;

    if (!result[method]) result[method] = [];
    result[method].push({ size: size, cost: cost });
  });

  return result;
}


/**
 * 直近の売上データを取得する（新しい順）
 * @param {number} limit 取得件数
 * @return {Array<Object>} 売上データの配列
 */
function getRecentSales(limit) {
  const sheet = getSpreadsheet_()
                              .getSheetByName(CONFIG.SHEET_SALES);
  if (!sheet) return [];

  const lastRow = sheet.getLastRow();
  if (lastRow < CONFIG.DATA_START_ROW) return [];

  const keys = SCHEMA.Sales.en;
  const numRows = lastRow - CONFIG.DATA_START_ROW + 1;
  const values = sheet.getRange(
    CONFIG.DATA_START_ROW, 1, numRows, keys.length
  ).getValues();

  const rows = values.map(function(row, i) {
    const obj = { rowIndex: CONFIG.DATA_START_ROW + i };
    keys.forEach(function(key, c) {
      obj[key] = (key === 'saleDate') ? formatDate_(row[c]) : row[c];
    });
    return obj;
  });

  // 新しい順に並べ替えて件数を絞る
  rows.reverse();
  return limit ? rows.slice(0, limit) : rows;
}


/* ============================================================
 * 書き込み系API
 * ============================================================ */

/**
 * 売上を1件登録する
 * @param {Object} data { itemName, price, shippingMethod, sizeCategory, saleDate }
 * @return {Object} { success, message, record }
 */
function addSale(data) {
  try {
    const validated = validateSaleInput_(data);

    const calc = calcIncome(
      validated.price,
      validated.shippingMethod,
      validated.sizeCategory
    );

    const sheet = getSpreadsheet_()
                                .getSheetByName(CONFIG.SHEET_SALES);
    if (!sheet) throw new Error('売上シートが見つかりません。setupAll() を実行してください。');

    const row = [
      validated.itemName,
      validated.price,
      validated.shippingMethod,
      validated.sizeCategory,
      calc.fee,
      calc.shippingCost,
      calc.income,
      validated.saleDate,
    ];

    const targetRow = Math.max(sheet.getLastRow() + 1, CONFIG.DATA_START_ROW);
    sheet.getRange(targetRow, 1, 1, row.length).setValues([row]);

    // 表示形式を適用
    sheet.getRange(targetRow, 2, 1, 1).setNumberFormat('¥#,##0');
    sheet.getRange(targetRow, 5, 1, 3).setNumberFormat('¥#,##0');
    sheet.getRange(targetRow, 8, 1, 1).setNumberFormat('yyyy/mm/dd');

    return {
      success: true,
      message: '登録しました',
      record: {
        rowIndex: targetRow,
        itemName: validated.itemName,
        price: validated.price,
        shippingMethod: validated.shippingMethod,
        sizeCategory: validated.sizeCategory,
        fee: calc.fee,
        shippingCost: calc.shippingCost,
        income: calc.income,
        saleDate: formatDate_(validated.saleDate),
      },
    };

  } catch (err) {
    return { success: false, message: err.message };
  }
}


/**
 * 売上を1件削除する
 * @param {number} rowIndex 対象の行番号
 * @return {Object} { success, message }
 */
function deleteSale(rowIndex) {
  try {
    const row = Number(rowIndex);
    if (!row || row < CONFIG.DATA_START_ROW) {
      throw new Error('削除対象の行が不正です');
    }

    const sheet = getSpreadsheet_()
                                .getSheetByName(CONFIG.SHEET_SALES);
    if (!sheet) throw new Error('売上シートが見つかりません');
    if (row > sheet.getLastRow()) throw new Error('対象の行が存在しません');

    sheet.deleteRow(row);
    return { success: true, message: '削除しました' };

  } catch (err) {
    return { success: false, message: err.message };
  }
}


/**
 * 送料マスタを再読み込みして返す
 * （マスタを手で更新した後、画面から呼び出す用）
 */
function reloadShippingOptions() {
  return { success: true, shippingOptions: getShippingOptions() };
}


/* ============================================================
 * 内部ヘルパー
 * ============================================================ */

/**
 * 入力値を検証して正規化する
 * @private
 */
function validateSaleInput_(data) {
  if (!data) throw new Error('入力データがありません');

  const itemName = String(data.itemName || '').trim();
  if (!itemName) throw new Error('商品名を入力してください');
  if (itemName.length > 200) throw new Error('商品名が長すぎます');

  const price = Number(data.price);
  if (!isFinite(price) || price <= 0) {
    throw new Error('販売価格は1以上の数値で入力してください');
  }
  if (!Number.isInteger(price)) {
    throw new Error('販売価格は整数で入力してください');
  }

  const shippingMethod = String(data.shippingMethod || '').trim();
  const sizeCategory   = String(data.sizeCategory || '').trim();
  if (!shippingMethod) throw new Error('配送方法を選択してください');
  if (!sizeCategory)   throw new Error('サイズ区分を選択してください');

  // 送料マスタに存在する組み合わせかチェック
  const options = getShippingOptions();
  const list = options[shippingMethod];
  if (!list) throw new Error('配送方法が送料マスタに存在しません：' + shippingMethod);

  const matched = list.some(function(o) { return o.size === sizeCategory; });
  if (!matched) {
    throw new Error('サイズ区分が送料マスタに存在しません：' + sizeCategory);
  }

  // 販売日（未指定なら今日）
  let saleDate;
  if (data.saleDate) {
    saleDate = new Date(data.saleDate);
    if (isNaN(saleDate.getTime())) throw new Error('販売日の形式が不正です');
  } else {
    saleDate = new Date();
  }

  return {
    itemName: itemName,
    price: price,
    shippingMethod: shippingMethod,
    sizeCategory: sizeCategory,
    saleDate: saleDate,
  };
}


/**
 * 日付を yyyy/MM/dd 形式の文字列に変換する
 * （Dateオブジェクトはgoogle.script.run経由で渡せないため）
 * @private
 */
function formatDate_(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) !== '[object Date]') {
    return String(value);
  }
  const tz = getSpreadsheet_().getSpreadsheetTimeZone();
  return Utilities.formatDate(value, tz, 'yyyy/MM/dd');
}
