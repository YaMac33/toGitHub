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
    return { sheet: sheetName, rows: 0, cols: 0, values: [], formats: [], fetchedAt: nowIso() };
  }


  const range = sheet.getRange(1, 1, lastRow, lastCol);


  // getDisplayValues: 日付・通貨などシート表示どおりの文字列で取得
  const values = range.getDisplayValues();


  // ---- 書式情報を取得 ----
  const bgColors    = range.getBackgrounds();       // 背景色(塗りつぶし)
  const fontColors  = range.getFontColors();        // 文字色
  const fontLines   = range.getFontLines();         // 'none' | 'line-through' | 'underline'
  const fontWeights = range.getFontWeights();       // 'normal' | 'bold'
  const fontStyles  = range.getFontStyles();        // 'normal' | 'italic'


  // セルごとに書式オブジェクトへまとめる
  const formats = values.map((row, r) =>
    row.map((_, c) => ({
      bg:        bgColors[r][c],
      color:     fontColors[r][c],
      line:      fontLines[r][c],
      weight:    fontWeights[r][c],
      style:     fontStyles[r][c]
    }))
  );


  return {
    sheet: sheetName,
    rows: lastRow,
    cols: lastCol,
    values: values,
    formats: formats,
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


/** ============ 固定行数・固定列数の記憶(ユーザー単位・サーバー側) ============ */


function saveFreezeConfig(rows, cols) {
  const props = PropertiesService.getUserProperties();
  props.setProperty('freezeRows', String(rows));
  props.setProperty('freezeCols', String(cols));
}


function getFreezeConfig() {
  const props = PropertiesService.getUserProperties();
  const rows = parseInt(props.getProperty('freezeRows'), 10);
  const cols = parseInt(props.getProperty('freezeCols'), 10);
  return {
    rows: Number.isFinite(rows) ? rows : 2,
    cols: Number.isFinite(cols) ? cols : 1
  };
}

