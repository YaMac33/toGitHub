/** ============ エントリポイント ============ */

function doGet() {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('シートビューア')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** html内で <?!= include('Stylesheet') ?> のように呼ぶためのヘルパー */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/** ============ データ取得 ============ */

function getSheetNames() {
  return SpreadsheetApp.getActiveSpreadsheet()
    .getSheets()
    .filter(s => !s.isSheetHidden())
    .map(s => s.getName());
}

function getSheetData(sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) throw new Error('シートが見つかりません: ' + sheetName);

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if (lastRow === 0 || lastCol === 0) {
    return { sheet: sheetName, rows: 0, cols: 0, values: [], fetchedAt: nowIso() };
  }

  // getDisplayValues: 日付・通貨などシート表示どおりの文字列で取得
  const values = sheet.getRange(1, 1, lastRow, lastCol).getDisplayValues();

  return {
    sheet: sheetName,
    rows: lastRow,
    cols: lastCol,
    values: values,
    fetchedAt: nowIso()
  };
}

function nowIso() {
  return new Date().toISOString();
}

/** ============ 前回選択シートの記憶(ユーザー単位・サーバー側) ============ */

function saveLastSheet(sheetName) {
  PropertiesService.getUserProperties().setProperty('lastSheet', sheetName);
}

function getLastSheet() {
  return PropertiesService.getUserProperties().getProperty('lastSheet') || '';
}
