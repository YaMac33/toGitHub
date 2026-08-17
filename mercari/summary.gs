/**
 * ============================================================
 * メルカリ売上管理表 - 月別集計
 * ============================================================
 * 売上シートを読み取り、年月ごとに集計して Summary シートへ
 * 書き出します。あわせて収入推移の折れ線グラフを生成します。
 *
 * ※ 定数 CONFIG / SCHEMA、ヘルパー getSpreadsheet_() は
 *    setup.gs で定義済みのものを利用します。
 * ============================================================
 */


/**
 * 月別集計を更新する（メニューまたは画面から実行）
 * @return {Object} { success, message, rows }
 */
function updateSummary() {
  try {
    const ss = getSpreadsheet_();
    const summary = aggregateByMonth_();

    const sheet = ss.getSheetByName(CONFIG.SHEET_SUMMARY);
    if (!sheet) throw new Error('集計シートが見つかりません。setupAll() を実行してください。');

    writeSummarySheet_(sheet, summary);
    buildSummaryChart_(sheet, summary.length);

    return {
      success: true,
      message: summary.length + 'か月分を集計しました',
      rows: summary,
    };

  } catch (err) {
    return { success: false, message: err.message, rows: [] };
  }
}


/**
 * 集計結果を取得する（画面表示用。シートへの書き込みは行わない）
 * @return {Array<Object>} 年月ごとの集計データ（新しい順）
 */
function getSummary() {
  const rows = aggregateByMonth_();
  return rows.slice().reverse();
}


/* ============================================================
 * 集計処理
 * ============================================================ */

/**
 * 売上シートを年月単位で集計する
 * @return {Array<Object>} 年月の昇順で並んだ集計データ
 * @private
 */
function aggregateByMonth_() {
  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName(CONFIG.SHEET_SALES);
  if (!sheet) throw new Error('売上シートが見つかりません');

  const lastRow = sheet.getLastRow();
  if (lastRow < CONFIG.DATA_START_ROW) return [];

  const keys = SCHEMA.Sales.en;
  const values = sheet.getRange(
    CONFIG.DATA_START_ROW, 1,
    lastRow - CONFIG.DATA_START_ROW + 1, keys.length
  ).getValues();

  // 列位置をキー名から引く（列順が変わっても壊れないように）
  const col = {
    price:        keys.indexOf('price'),
    fee:          keys.indexOf('fee'),
    shippingCost: keys.indexOf('shippingCost'),
    income:       keys.indexOf('income'),
    saleDate:     keys.indexOf('saleDate'),
  };

  const tz = ss.getSpreadsheetTimeZone();
  const buckets = {};

  values.forEach(function(row) {
    const yearMonth = toYearMonth_(row[col.saleDate], tz);
    if (!yearMonth) return; // 日付が無い行はスキップ

    if (!buckets[yearMonth]) {
      buckets[yearMonth] = {
        yearMonth: yearMonth,
        count: 0,
        totalPrice: 0,
        totalFee: 0,
        totalShipping: 0,
        totalIncome: 0,
      };
    }

    const b = buckets[yearMonth];
    b.count += 1;
    b.totalPrice    += Number(row[col.price]) || 0;
    b.totalFee      += Number(row[col.fee]) || 0;
    b.totalShipping += Number(row[col.shippingCost]) || 0;
    b.totalIncome   += Number(row[col.income]) || 0;
  });

  // 年月の昇順に並べる
  return Object.keys(buckets).sort().map(function(k) { return buckets[k]; });
}


/**
 * 日付値を「yyyy/MM」形式の文字列に変換する
 * @private
 */
function toYearMonth_(value, tz) {
  if (!value) return '';

  let date;
  if (Object.prototype.toString.call(value) === '[object Date]') {
    date = value;
  } else {
    date = new Date(value);
  }
  if (isNaN(date.getTime())) return '';

  return Utilities.formatDate(date, tz, 'yyyy/MM');
}


/* ============================================================
 * シートへの書き出し
 * ============================================================ */

/**
 * Summaryシートに集計結果を書き込む
 * @private
 */
function writeSummarySheet_(sheet, summary) {
  const keys = SCHEMA.Summary.en;

  // 既存のデータ行だけをクリア（ヘッダー2行は残す）
  const lastRow = sheet.getLastRow();
  if (lastRow >= CONFIG.DATA_START_ROW) {
    sheet.getRange(
      CONFIG.DATA_START_ROW, 1,
      lastRow - CONFIG.DATA_START_ROW + 1, sheet.getLastColumn()
    ).clearContent();
  }

  if (!summary.length) return;

  const rows = summary.map(function(s) {
    return [s.yearMonth, s.count, s.totalPrice, s.totalFee, s.totalShipping, s.totalIncome];
  });

  sheet.getRange(CONFIG.DATA_START_ROW, 1, rows.length, keys.length).setValues(rows);

  // 金額列を通貨表示に（C〜F列）
  sheet.getRange(CONFIG.DATA_START_ROW, 3, rows.length, 4).setNumberFormat('¥#,##0');
  sheet.getRange(CONFIG.DATA_START_ROW, 1, rows.length, 2).setHorizontalAlignment('center');

  // 総合計行を末尾に追加
  const totalRow = CONFIG.DATA_START_ROW + rows.length;
  const totals = ['合計', 0, 0, 0, 0, 0];
  summary.forEach(function(s) {
    totals[1] += s.count;
    totals[2] += s.totalPrice;
    totals[3] += s.totalFee;
    totals[4] += s.totalShipping;
    totals[5] += s.totalIncome;
  });

  sheet.getRange(totalRow, 1, 1, totals.length).setValues([totals]);
  sheet.getRange(totalRow, 1, 1, totals.length)
       .setFontWeight('bold')
       .setBorder(true, null, null, null, null, null, '#14212b', SpreadsheetApp.BorderStyle.DOUBLE);
  sheet.getRange(totalRow, 3, 1, 4).setNumberFormat('¥#,##0');
  sheet.getRange(totalRow, 1, 1, 2).setHorizontalAlignment('center');
}


/**
 * 収入推移の折れ線グラフを作成する（既存グラフは作り直す）
 * @private
 */
function buildSummaryChart_(sheet, dataCount) {
  // 既存のグラフを削除
  sheet.getCharts().forEach(function(chart) {
    sheet.removeChart(chart);
  });

  if (dataCount < 1) return;

  const lastDataRow = CONFIG.DATA_START_ROW + dataCount - 1;

  const chart = sheet.newChart()
    .setChartType(Charts.ChartType.COLUMN)
    // 年月（A列）※ヘッダー2行目の英語キーは含めない
    .addRange(sheet.getRange(CONFIG.DATA_START_ROW, 1, dataCount, 1))
    // 合計売上（C列）と合計収入（F列）
    .addRange(sheet.getRange(CONFIG.DATA_START_ROW, 3, dataCount, 1))
    .addRange(sheet.getRange(CONFIG.DATA_START_ROW, 6, dataCount, 1))
    .setPosition(CONFIG.DATA_START_ROW, 8, 0, 0)
    .setOption('title', '月別 売上と収入の推移')
    .setOption('width', 620)
    .setOption('height', 360)
    .setOption('legend', { position: 'top' })
    .setOption('colors', ['#8c9aa3', '#0b6b50'])
    .setOption('series', {
      0: { labelInLegend: '合計売上' },
      1: { labelInLegend: '合計収入' },
    })
    .setOption('vAxis', { format: '¥#,##0', minValue: 0 })
    .build();

  sheet.insertChart(chart);
}
