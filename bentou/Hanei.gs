const PUBLIC_SPREADSHEET_ID = '1rx1_QIHQMr2B5f-Bqo-YOyu7O0QOF4rqwKt2yAgr7pA/edit?gid=0#gid=0';

const SOURCE_SHEET_NAME = 'orders';
const PUBLIC_SHEET_NAME = '公開用';

const PUBLIC_HEADERS = [
  'タイムスタンプ',
  '部署',
  'メニュー',
  'サイズ',
  '基本単価',
  'サイズ加算額',
  '単価',
  '数量'
];

function syncPublicSheet() {
  const sourceSs = SpreadsheetApp.getActiveSpreadsheet();
  const sourceSheet = sourceSs.getSheetByName(SOURCE_SHEET_NAME);

  if (!sourceSheet) {
    throw new Error('元シートが見つかりません: ' + SOURCE_SHEET_NAME);
  }

  const values = sourceSheet.getDataRange().getValues();
  const sourceHeaders = (values.length > 0 ? values[0] : []).map(header => String(header || '').trim());

  const indexes = PUBLIC_HEADERS.map(header => {
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
    PUBLIC_HEADERS,
    ...values.slice(1)
      .filter(row => String(row[statusIndex] || '').trim() === '有効')
      .map(row => indexes.map(index => row[index]))
  ];

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
