/**
 * カロリー収支管理アプリ - 初期セットアップ
 *
 * 【使い方】
 * 1. このプロジェクトのスクリプトエディタでこのファイルを開く
 * 2. setupSpreadsheet 関数を選択して実行（初回のみ）
 * 3. 実行ログに表示されるスプレッドシートURLを確認
 * 4. 以後、Code.gs 側は PropertiesService に保存された
 *    SPREADSHEET_ID を使ってこのシートにアクセスします
 *
 * ※ 再実行すると新しいスプレッドシートが作られてしまうため、
 *    一度実行したら基本的に再実行しないこと。
 */

// ここでプロフィールを初期登録する（必要に応じて数値を変更してから実行）
const INITIAL_PROFILE = {
  sex: '男性',
  age: 35,
  height_cm: 182,
  target_weight_kg: 75
};

function setupSpreadsheet() {
  const existingId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (existingId) {
    const msg = '既に SPREADSHEET_ID が設定されています（' + existingId + '）。' +
      '再作成したい場合は、スクリプトプロパティから SPREADSHEET_ID を削除してから再実行してください。';
    Logger.log(msg);
    return;
  }

  const ss = SpreadsheetApp.create('カロリー収支管理_DB');
  const ssId = ss.getId();
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ssId);

  // --- Profile シート ---
  const profileSheet = ss.getSheets()[0];
  profileSheet.setName('Profile');
  profileSheet.getRange('A1:B1').setValues([['項目', '値']]);
  profileSheet.getRange('A2:B5').setValues([
    ['性別', INITIAL_PROFILE.sex],
    ['年齢', INITIAL_PROFILE.age],
    ['身長cm', INITIAL_PROFILE.height_cm],
    ['目標体重kg', INITIAL_PROFILE.target_weight_kg]
  ]);
  profileSheet.setFrozenRows(1);
  profileSheet.autoResizeColumns(1, 2);

  // --- DailyLog シート ---
  const dailySheet = ss.insertSheet('DailyLog');
  dailySheet.getRange('A1:G1').setValues([[
    '日付', '摂取kcal', '運動消費kcal', '体重kg', '基礎代謝kcal', '収支kcal', '更新日時'
  ]]);
  dailySheet.setFrozenRows(1);
  dailySheet.setColumnWidth(1, 100);
  dailySheet.autoResizeColumns(2, 6);

  Logger.log('スプレッドシートを作成しました: ' + ss.getUrl());
  Logger.log('SPREADSHEET_ID: ' + ssId);
}
