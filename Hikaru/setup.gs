/**
 * 初期セットアップ
 * この setup() を一度だけ実行すると、単価マスタ用のスプレッドシートを新規作成し、
 * ヘッダーとダミーデータを投入したうえで、そのIDをスクリプトプロパティに保存します。
 * 実行後、ログに出力されるURLからシートを開いて実データを入力してください。
 */

const SPREADSHEET_NAME = '料金試算マスタ';
const MASTER_SHEET_NAME = '単価マスタ';
const PROP_SPREADSHEET_ID = 'MASTER_SPREADSHEET_ID';

const HEADERS = ['サービス名', '種別', '項目名', '単価', '表示順', '備考'];
const TYPE_BASE = '基本料';
const TYPE_CHECK = 'チェック';
const TYPE_QTY = '数量';

const DUMMY_ROWS = [
  ['〇〇フォーム', TYPE_BASE, '基本利用料', 50000, 10, '選択すると常に計上されます'],
  ['〇〇フォーム', TYPE_CHECK, 'オプションA', 5000, 20, ''],
  ['〇〇フォーム', TYPE_CHECK, 'オプションB', 12000, 30, ''],
  ['〇〇フォーム', TYPE_CHECK, 'オプションC', 8000, 40, ''],
  ['〇〇フォーム', TYPE_QTY, '追加アカウント', 1000, 50, '単価×数量で計算されます'],
  ['〇〇フォーム', TYPE_QTY, '追加フォーム', 3000, 60, ''],
  ['△△ラボ', TYPE_BASE, '基本利用料', 80000, 10, ''],
  ['△△ラボ', TYPE_CHECK, 'オプションX', 15000, 20, ''],
  ['△△ラボ', TYPE_CHECK, 'オプションY', 9000, 30, ''],
  ['△△ラボ', TYPE_QTY, '追加ライセンス', 2500, 40, ''],
];

function setup() {
  const ss = SpreadsheetApp.create(SPREADSHEET_NAME);
  const sheet = ss.getSheets()[0];
  sheet.setName(MASTER_SHEET_NAME);

  // ヘッダー
  sheet.getRange(1, 1, 1, HEADERS.length)
    .setValues([HEADERS])
    .setFontWeight('bold')
    .setBackground('#16202E')
    .setFontColor('#FFFFFF')
    .setVerticalAlignment('middle');

  // ダミーデータ
  sheet.getRange(2, 1, DUMMY_ROWS.length, HEADERS.length).setValues(DUMMY_ROWS);

  // 書式
  sheet.setFrozenRows(1);
  sheet.getRange(2, 4, sheet.getMaxRows() - 1, 1).setNumberFormat('#,##0');
  sheet.setColumnWidth(1, 160); // サービス名
  sheet.setColumnWidth(2, 90);  // 種別
  sheet.setColumnWidth(3, 200); // 項目名
  sheet.setColumnWidth(4, 100); // 単価
  sheet.setColumnWidth(5, 80);  // 表示順
  sheet.setColumnWidth(6, 280); // 備考
  sheet.getRange(1, 1, sheet.getMaxRows(), HEADERS.length)
    .setBorder(true, true, true, true, true, true, '#D5DCE5', SpreadsheetApp.BorderStyle.SOLID);

  // 「種別」列に入力規則
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList([TYPE_BASE, TYPE_CHECK, TYPE_QTY], true)
    .setAllowInvalid(false)
    .setHelpText('基本料 / チェック / 数量 のいずれかを選択してください。')
    .build();
  sheet.getRange(2, 2, sheet.getMaxRows() - 1, 1).setDataValidation(rule);

  // 使い方メモ
  const guide = ss.insertSheet('使い方');
  guide.getRange(1, 1, 8, 1).setValues([
    ['単価マスタの入力ルール'],
    [''],
    ['・1行が1項目です。行を追加するだけで、どのサービスの試算にも対応できます。'],
    ['・サービス名 … Webアプリのプルダウンに表示されます。同じ名前でまとめられます。'],
    ['・種別 … 基本料／チェック／数量 のいずれか。'],
    ['　　基本料：そのサービスを選ぶと自動で計上されます（1サービスにつき1行を想定）。'],
    ['　　チェック：チェックを入れると単価がそのまま加算されます。'],
    ['　　数量：入力した数量×単価が加算されます。'],
  ]);
  guide.getRange(1, 1).setFontWeight('bold').setFontSize(13);
  guide.setColumnWidth(1, 640);

  // WebアプリからこのシートIDを参照できるよう保存
  PropertiesService.getScriptProperties().setProperty(PROP_SPREADSHEET_ID, ss.getId());

  Logger.log('セットアップが完了しました。');
  Logger.log('スプレッドシートURL: ' + ss.getUrl());
  return ss.getUrl();
}
