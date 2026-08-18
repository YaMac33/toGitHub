/**
 * カロリー収支管理アプリ - サーバーサイド
 */

// ============================================================
// エントリーポイント
// ============================================================

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('カロリー収支管理')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ============================================================
// スプレッドシートアクセス共通
// ============================================================

function getSS_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) {
    throw new Error('SPREADSHEET_ID が未設定です。setup.gs の setupSpreadsheet() を先に実行してください。');
  }
  return SpreadsheetApp.openById(id);
}

function getProfileSheet_() {
  return getSS_().getSheetByName('Profile');
}

function getDailyLogSheet_() {
  return getSS_().getSheetByName('DailyLog');
}

function getMealLogSheet_() {
  return getSS_().getSheetByName('MealLog');
}

function dateToStr_(d) {
  if (typeof d === 'string') return d;
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

// 指定日の行番号（見つからなければ -1）
function findRowByDate_(sheet, dateStr) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  const dates = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < dates.length; i++) {
    if (dateToStr_(dates[i][0]) === dateStr) return i + 2;
  }
  return -1;
}

// ============================================================
// プロフィール
// ============================================================

function getProfile() {
  const sheet = getProfileSheet_();
  const data = sheet.getRange(2, 1, 4, 2).getValues();
  const map = { '性別': 'sex', '年齢': 'age', '身長cm': 'height_cm', '目標体重kg': 'target_weight_kg' };
  const profile = {};
  data.forEach(function (row) {
    const key = map[row[0]];
    if (key) profile[key] = row[1];
  });
  return profile;
}

// ============================================================
// BMR / 収支計算
// ============================================================

// ハリス・ベネディクト改訂式
function calcBMR_(sex, age, heightCm, weightKg) {
  if (sex === '男性') {
    return 88.362 + 13.397 * weightKg + 4.799 * heightCm - 5.677 * age;
  } else {
    return 447.593 + 9.247 * weightKg + 3.098 * heightCm - 4.330 * age;
  }
}

// ============================================================
// DailyLog 取得
// ============================================================

function getDailyLogs(startDate, endDate) {
  const sheet = getDailyLogSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const values = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
  const result = [];
  values.forEach(function (row) {
    const dStr = dateToStr_(row[0]);
    if (dStr >= startDate && dStr <= endDate) {
      result.push({
        date: dStr,
        intake_kcal: row[1] || 0,
        exercise_kcal: row[2] || 0,
        weight_kg: row[3] || null,
        bmr_kcal: row[4] || null,
        balance_kcal: row[5] === '' ? null : row[5],
        updated_at: row[6] ? dateToStr_(row[6]) : ''
      });
    }
  });
  result.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  return result;
}

// 全期間の一覧（履歴編集タブ用。新しい日付が先頭）
function getAllDailyLogs() {
  const sheet = getDailyLogSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const values = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
  const result = values.map(function (row) {
    return {
      date: dateToStr_(row[0]),
      intake_kcal: row[1] || 0,
      exercise_kcal: row[2] || 0,
      weight_kg: row[3] || null,
      bmr_kcal: row[4] || null,
      balance_kcal: row[5] === '' ? null : row[5],
      updated_at: row[6] ? dateToStr_(row[6]) : ''
    };
  });
  result.sort(function (a, b) { return a.date > b.date ? -1 : 1; });
  return result;
}

function getDailyLog(dateStr) {
  const sheet = getDailyLogSheet_();
  const row = findRowByDate_(sheet, dateStr);
  if (row === -1) return null;
  const v = sheet.getRange(row, 1, 1, 7).getValues()[0];
  return {
    date: dateToStr_(v[0]), intake_kcal: v[1] || 0, exercise_kcal: v[2] || 0,
    weight_kg: v[3] || null, bmr_kcal: v[4] || null,
    balance_kcal: v[5] === '' ? null : v[5], updated_at: v[6] ? dateToStr_(v[6]) : ''
  };
}

// ============================================================
// DailyLog 書き込み（内部共通処理）
// ============================================================

// meals = [{type:'朝食', items:[{name:'卵かけご飯', kcal:300}, ...]}, ...]
function sumMealsKcal_(meals) {
  let total = 0;
  meals.forEach(function (meal) {
    (meal.items || []).forEach(function (item) {
      total += Number(item.kcal) || 0;
    });
  });
  return total;
}

// 指定日の既存MealLog行をすべて削除
function clearMealsForDate_(dateStr) {
  const sheet = getMealLogSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  const dates = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  // 下から消していかないと行番号がずれる
  for (let i = dates.length - 1; i >= 0; i--) {
    if (dateToStr_(dates[i][0]) === dateStr) {
      sheet.deleteRow(i + 2);
    }
  }
}

// 指定日の食事明細を洗い替え保存
function saveMealsForDate_(dateStr, meals) {
  const sheet = getMealLogSheet_();
  clearMealsForDate_(dateStr);
  const rows = [];
  meals.forEach(function (meal) {
    (meal.items || []).forEach(function (item) {
      rows.push([dateStr, meal.type || '', item.name || '', Number(item.kcal) || 0]);
    });
  });
  if (rows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 4).setValues(rows);
  }
}

// intake/exercise/weight のうち undefined/null のものは既存値を維持する（部分更新）
// meals が渡された場合、intake はその合計で自動計算され、MealLogも洗い替えされる
function writeDailyRecord_(dateStr, intake, exercise, weight, meals) {
  const sheet = getDailyLogSheet_();
  const profile = getProfile();
  const existingRow = findRowByDate_(sheet, dateStr);

  let finalIntake = intake, finalExercise = exercise, finalWeight = weight;

  if (meals && meals.length > 0) {
    finalIntake = sumMealsKcal_(meals);
    saveMealsForDate_(dateStr, meals);
  }

  if (existingRow !== -1) {
    const existing = sheet.getRange(existingRow, 1, 1, 7).getValues()[0];
    if (finalIntake === undefined || finalIntake === null) finalIntake = existing[1];
    if (finalExercise === undefined || finalExercise === null) finalExercise = existing[2];
    if (finalWeight === undefined || finalWeight === null) finalWeight = existing[3];
  }
  finalIntake = finalIntake || 0;
  finalExercise = finalExercise || 0;

  let bmr = '', balance = '';
  if (finalWeight) {
    bmr = Math.round(calcBMR_(profile.sex, profile.age, profile.height_cm, finalWeight));
    balance = Math.round(finalIntake - (bmr + finalExercise));
  }

  const now = new Date();
  const rowData = [dateStr, finalIntake, finalExercise, finalWeight || '', bmr, balance, now];

  if (existingRow !== -1) {
    sheet.getRange(existingRow, 1, 1, 7).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }
}

// ============================================================
// JSON一括取込み（Claude連携）
// ============================================================

// Step1: 重複チェックのみ行う（実際の書き込みはしない）
function checkImportDuplicates(jsonArray) {
  const sheet = getDailyLogSheet_();
  const duplicates = [];
  jsonArray.forEach(function (item) {
    if (findRowByDate_(sheet, item.date) !== -1) duplicates.push(item.date);
  });
  return { duplicates: duplicates, total: jsonArray.length };
}

// Step2: 確認後（または重複なしの場合）に実際に書き込む
function confirmImportBatch(jsonArray) {
  jsonArray.forEach(function (item) {
    writeDailyRecord_(item.date, item.intake_kcal, item.exercise_kcal, item.weight_kg, item.meals);
  });
  return { success: true, count: jsonArray.length };
}

// ============================================================
// 手入力（体重・運動）
// ============================================================

function saveWeightManual(dateStr, weightKg) {
  writeDailyRecord_(dateStr, undefined, undefined, weightKg);
  return { success: true };
}

function saveExerciseManual(dateStr, exerciseKcal) {
  writeDailyRecord_(dateStr, undefined, exerciseKcal, undefined);
  return { success: true };
}

// ============================================================
// 履歴編集
// ============================================================

// fields = {intake_kcal, exercise_kcal, weight_kg} のうち渡された項目だけ更新
function updateDailyLog(dateStr, fields) {
  writeDailyRecord_(
    dateStr,
    fields.intake_kcal !== undefined ? fields.intake_kcal : undefined,
    fields.exercise_kcal !== undefined ? fields.exercise_kcal : undefined,
    fields.weight_kg !== undefined ? fields.weight_kg : undefined
  );
  return { success: true };
}

// 指定日の食事明細を区分ごとにグループ化して返す
// 例: [{type:'朝食', items:[{name:'卵かけご飯', kcal:300}]}, ...]
function getMealsForDate(dateStr) {
  const sheet = getMealLogSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const values = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
  const groups = {};
  const order = [];
  values.forEach(function (row) {
    if (dateToStr_(row[0]) !== dateStr) return;
    const type = row[1] || '(区分なし)';
    if (!groups[type]) { groups[type] = []; order.push(type); }
    groups[type].push({ name: row[2], kcal: row[3] });
  });
  return order.map(function (type) { return { type: type, items: groups[type] }; });
}

function deleteDailyLog(dateStr) {
  const sheet = getDailyLogSheet_();
  const row = findRowByDate_(sheet, dateStr);
  if (row !== -1) sheet.deleteRow(row);
  clearMealsForDate_(dateStr);
  return { success: true };
}
