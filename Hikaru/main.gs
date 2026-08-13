/**
 * Webアプリ本体
 * setup.gs で作成したスプレッドシートの「単価マスタ」を読み込み、フロントに渡します。
 */

function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('料金試算')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * マスタを読み込み、サービス単位にまとめて返します。
 * 戻り値: [{ name: 'サービス名', items: [{ type, label, price, note }] }]
 *   type は 'base'（基本料） / 'check'（チェック） / 'qty'（数量）
 */
function getMasterData() {
  const sheet = openMasterSheet_();
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    throw new Error('単価マスタにデータがありません。スプレッドシートに項目を入力してください。');
  }

  const header = values[0].map(function (v) { return String(v).trim(); });
  const col = {
    service: header.indexOf('サービス名'),
    type: header.indexOf('種別'),
    label: header.indexOf('項目名'),
    price: header.indexOf('単価'),
    order: header.indexOf('表示順'),
    note: header.indexOf('備考'),
  };
  Object.keys(col).forEach(function (key) {
    if (col[key] < 0) {
      throw new Error('単価マスタの見出し行が想定と異なります。1行目に「サービス名／種別／項目名／単価／表示順／備考」が必要です。');
    }
  });

  const typeMap = { '基本料': 'base', 'チェック': 'check', '数量': 'qty' };
  const services = [];
  const index = {};

  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var serviceName = String(row[col.service]).trim();
    var label = String(row[col.label]).trim();
    var type = typeMap[String(row[col.type]).trim()];
    if (!serviceName || !label || !type) continue;

    if (!index[serviceName]) {
      index[serviceName] = { name: serviceName, items: [] };
      services.push(index[serviceName]);
    }
    index[serviceName].items.push({
      type: type,
      label: label,
      price: Number(row[col.price]) || 0,
      note: String(row[col.note] || '').trim(),
      order: Number(row[col.order]) || 0,
      seq: i,
    });
  }

  services.forEach(function (service) {
    service.items.sort(function (a, b) {
      return a.order === b.order ? a.seq - b.seq : a.order - b.order;
    });
    service.items.forEach(function (item) {
      delete item.order;
      delete item.seq;
    });
  });

  if (!services.length) {
    throw new Error('有効な行が見つかりません。サービス名・種別・項目名がすべて入力されているか確認してください。');
  }
  return services;
}

function openMasterSheet_() {
  const id = PropertiesService.getScriptProperties().getProperty(PROP_SPREADSHEET_ID);
  var ss = null;
  if (id) {
    ss = SpreadsheetApp.openById(id);
  } else {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  }
  if (!ss) {
    throw new Error('マスタのスプレッドシートが見つかりません。先に setup() を実行してください。');
  }
  const sheet = ss.getSheetByName(MASTER_SHEET_NAME);
  if (!sheet) {
    throw new Error('「' + MASTER_SHEET_NAME + '」シートが見つかりません。');
  }
  return sheet;
}
