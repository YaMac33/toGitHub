// ==============================
// orders → 公開用シート同期
// ==============================

function syncPublicSheet() {
  const sourceSs = SpreadsheetApp.getActiveSpreadsheet();
  const sourceSheet = sourceSs.getSheetByName(SHEET_NAME_ORDERS);

  if (!sourceSheet) {
    throw new Error('元シートが見つかりません: ' + SHEET_NAME_ORDERS);
  }

  const values = sourceSheet.getDataRange().getValues();
  const sourceHeaders = (values.length > 0 ? values[0] : []).map(function(header) {
    return String(header || '').trim();
  });

  const indexes = PUBLIC_HEADERS.map(function(header) {
    const index = sourceHeaders.indexOf(header);

    if (index === -1) {
      throw new Error('元シートに列が見つかりません: ' + header);
    }

    return index;
  });

  const statusIndex = sourceHeaders.indexOf('状態');

  if (statusIndex === -1) {
    throw new Error('元シートに列が見つかりません: 状態');
  }

  const output = [
    PUBLIC_HEADERS
  ].concat(
    values.slice(1)
      .filter(function(row) {
        return String(row[statusIndex] || '').trim() === '有効';
      })
      .map(function(row) {
        return indexes.map(function(index) {
          return row[index];
        });
      })
  );

  const publicSs = getPublicSpreadsheet_();
  let publicSheet = publicSs.getSheetByName(PUBLIC_SHEET_NAME);

  if (!publicSheet) {
    publicSheet = publicSs.insertSheet(PUBLIC_SHEET_NAME);
  }

  publicSheet.clearContents();

  publicSheet
    .getRange(1, 1, output.length, output[0].length)
    .setValues(output);
}

function getPublicSpreadsheet_() {
  return SpreadsheetApp.openById(getPublicSpreadsheetId_());
}

function getPublicSpreadsheetId_() {
  const spreadsheetId = String(PUBLIC_SPREADSHEET_ID || '').trim();
  const match = spreadsheetId.match(/[-\w]{25,}/);

  if (!match) {
    throw new Error('公開用スプレッドシートIDが設定されていません。');
  }

  return match[0];
}