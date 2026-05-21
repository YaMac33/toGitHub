/**
 * Googleサービスだけで動く予約申請・承認・カレンダー表示システム
 *
 * Apps Scriptプロジェクトのタイムゾーンは Asia/Tokyo にしてください。
 * CONFIG.CALENDAR_ID は運用するGoogleカレンダーIDに変更してください。
 */

const CONFIG = {
  TIME_ZONE: 'Asia/Tokyo',
  SHEET_NAME: '申請一覧',
  STATUS_SHEET_NAME: 'ステータス管理',
  CALENDAR_ID: 'YOUR_CALENDAR_ID_HERE',
  CANCEL_MODE: 'delete', // delete または mark
  LOCK_WAIT_MS: 30000,
  APP_TITLE: '予約状況',
  MAIL_SENDER_NAME: '予約管理',
  FORM_COLUMNS: [
    'タイムスタンプ',
    'メールアドレス',
    '氏名',
    '所属',
    '利用場所',
    '希望日',
    '開始時刻',
    '終了時刻',
    '利用目的',
    '備考'
  ],
  MANAGEMENT_COLUMNS: [
    'ステータス',
    '管理メモ',
    'カレンダーイベントID',
    '処理日時',
    '処理結果',
    '重複チェック結果'
  ],
  COLS: {
    timestamp: 'タイムスタンプ',
    email: 'メールアドレス',
    name: '氏名',
    department: '所属',
    location: '利用場所',
    date: '希望日',
    startTime: '開始時刻',
    endTime: '終了時刻',
    purpose: '利用目的',
    note: '備考',
    status: 'ステータス',
    adminMemo: '管理メモ',
    eventId: 'カレンダーイベントID',
    processedAt: '処理日時',
    result: '処理結果',
    conflict: '重複チェック結果'
  },
  STATUS: {
    PENDING: '未処理',
    APPROVED: '承認',
    REJECTED: '却下',
    CANCELLED: '取消'
  }
};

const VIEW_CONFIG = {
  listMode: 'standard', // simple, standard, detail
  showName: false,
  showDepartment: true,
  showEmail: false,
  showPurpose: true,
  showNote: false,
  showAdminMemo: false,
  showProcessedAt: false,
  visibleStatuses: ['承認'],
  allowClientDetailMode: true
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('予約管理')
    .addItem('初期設定を実行', 'setupSheet')
    .addItem('選択行を処理', 'processActiveRow')
    .addToUi();
}

function setupSheet() {
  const sheet = getOrCreateSheet_();
  ensureBaseHeaders_(sheet);
  ensureManagementColumns_(sheet);
  setupStatusValidation_(sheet);
  setupStatusSheet_();
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, Math.max(sheet.getLastColumn(), 1));
}

function handleFormSubmit(e) {
  const lock = LockService.getDocumentLock();
  lock.waitLock(CONFIG.LOCK_WAIT_MS);

  try {
    const sheet = e && e.range ? e.range.getSheet() : getOrCreateSheet_();
    if (sheet.getName() !== CONFIG.SHEET_NAME) return;

    ensureManagementColumns_(sheet);
    const row = e && e.range ? e.range.getRow() : sheet.getLastRow();
    if (row <= 1) return;

    const record = getRecordByRow_(sheet, row);
    const updates = {};

    if (!normalizeText_(record[CONFIG.COLS.status])) {
      updates[CONFIG.COLS.status] = CONFIG.STATUS.PENDING;
    }

    try {
      sendReceiptMail_(record);
      updates[CONFIG.COLS.processedAt] = formatNow_();
      updates[CONFIG.COLS.result] = '受付メール送信済み';
    } catch (mailError) {
      updates[CONFIG.COLS.processedAt] = formatNow_();
      updates[CONFIG.COLS.result] = '受付メール送信失敗: ' + getErrorMessage_(mailError);
    }

    writeRowFields_(sheet, row, updates);
  } finally {
    lock.releaseLock();
  }
}

function handleStatusEdit(e) {
  if (!e || !e.range) return;

  const range = e.range;
  const sheet = range.getSheet();
  if (sheet.getName() !== CONFIG.SHEET_NAME) return;

  ensureManagementColumns_(sheet);
  const headerMap = getHeaderMap_(sheet);
  const statusColumn = headerMap[CONFIG.COLS.status];
  if (!statusColumn) return;

  const rangeStartColumn = range.getColumn();
  const rangeEndColumn = range.getLastColumn();
  if (statusColumn < rangeStartColumn || statusColumn > rangeEndColumn) return;
  if (range.getRow() <= 1 && range.getLastRow() <= 1) return;
  if (range.getNumRows() === 1 && range.getNumColumns() === 1 && e.oldValue === e.value) return;

  const lock = LockService.getDocumentLock();
  lock.waitLock(CONFIG.LOCK_WAIT_MS);

  try {
    const startRow = Math.max(range.getRow(), 2);
    const endRow = range.getLastRow();
    for (let row = startRow; row <= endRow; row++) {
      processStatusRowSafely_(sheet, row);
    }
  } finally {
    lock.releaseLock();
  }
}

function processActiveRow() {
  const sheet = SpreadsheetApp.getActiveSheet();
  if (!sheet || sheet.getName() !== CONFIG.SHEET_NAME) {
    throw new Error('申請一覧シートで処理したい行を選択してください。');
  }

  const row = SpreadsheetApp.getActiveRange().getRow();
  if (row <= 1) {
    throw new Error('ヘッダー行ではなく、申請データの行を選択してください。');
  }

  const lock = LockService.getDocumentLock();
  lock.waitLock(CONFIG.LOCK_WAIT_MS);
  try {
    ensureManagementColumns_(sheet);
    processStatusRowSafely_(sheet, row);
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  const template = HtmlService.createTemplateFromFile('Index');
  template.initialPayload = JSON.stringify(getReservationPayload_());
  return template
    .evaluate()
    .setTitle(CONFIG.APP_TITLE)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getReservationPayload() {
  return getReservationPayload_();
}

function processStatusRowSafely_(sheet, row) {
  try {
    processStatusRow_(sheet, row);
  } catch (error) {
    writeRowFields_(sheet, row, {
      [CONFIG.COLS.processedAt]: formatNow_(),
      [CONFIG.COLS.result]: 'エラー: ' + getErrorMessage_(error)
    });
  }
}

function processStatusRow_(sheet, row) {
  const record = getRecordByRow_(sheet, row);
  const status = normalizeStatus_(record[CONFIG.COLS.status]);

  if (!status) return;

  if (status === CONFIG.STATUS.PENDING) {
    writeRowFields_(sheet, row, {
      [CONFIG.COLS.processedAt]: formatNow_(),
      [CONFIG.COLS.result]: '未処理: 管理者の確認待ち'
    });
    return;
  }

  if (status === CONFIG.STATUS.APPROVED) {
    approveReservation_(sheet, row, record);
    return;
  }

  if (status === CONFIG.STATUS.REJECTED) {
    rejectReservation_(sheet, row, record);
    return;
  }

  if (status === CONFIG.STATUS.CANCELLED) {
    cancelReservation_(sheet, row, record);
    return;
  }

  throw new Error('未対応のステータスです: ' + status);
}

function approveReservation_(sheet, row, record) {
  const existingEventId = normalizeText_(record[CONFIG.COLS.eventId]);
  if (existingEventId) {
    writeRowFields_(sheet, row, {
      [CONFIG.COLS.processedAt]: formatNow_(),
      [CONFIG.COLS.result]: '承認済み: カレンダーイベントIDがあるため再処理しません',
      [CONFIG.COLS.conflict]: '既存イベントIDあり'
    });
    return;
  }

  const period = parseReservationPeriod_(record);
  const calendar = getCalendar_();
  const conflicts = findConflicts_(calendar, period.start, period.end, record[CONFIG.COLS.location]);

  if (conflicts.length > 0) {
    writeRowFields_(sheet, row, {
      [CONFIG.COLS.processedAt]: formatNow_(),
      [CONFIG.COLS.result]: '承認エラー: 同じ利用場所・時間帯の予定と重複しています',
      [CONFIG.COLS.conflict]: conflicts.join('\n')
    });
    return;
  }

  const event = createCalendarEvent_(calendar, record, period, row);
  writeRowFields_(sheet, row, {
    [CONFIG.COLS.eventId]: event.getId(),
    [CONFIG.COLS.processedAt]: formatNow_(),
    [CONFIG.COLS.result]: 'カレンダー登録済み'
  });

  try {
    const updatedRecord = getRecordByRow_(sheet, row);
    sendApprovalMail_(updatedRecord, period);
    writeRowFields_(sheet, row, {
      [CONFIG.COLS.processedAt]: formatNow_(),
      [CONFIG.COLS.result]: '承認済み: カレンダー登録・承認メール送信済み',
      [CONFIG.COLS.conflict]: '重複なし'
    });
  } catch (mailError) {
    writeRowFields_(sheet, row, {
      [CONFIG.COLS.processedAt]: formatNow_(),
      [CONFIG.COLS.result]: 'カレンダー登録済み、承認メール送信失敗: ' + getErrorMessage_(mailError),
      [CONFIG.COLS.conflict]: '重複なし'
    });
  }
}

function rejectReservation_(sheet, row, record) {
  const result = normalizeText_(record[CONFIG.COLS.result]);
  if (result.indexOf('却下通知送信済み') !== -1) {
    writeRowFields_(sheet, row, {
      [CONFIG.COLS.processedAt]: formatNow_(),
      [CONFIG.COLS.result]: '却下通知送信済み: 再処理しません'
    });
    return;
  }

  sendRejectionMail_(record);

  const eventId = normalizeText_(record[CONFIG.COLS.eventId]);
  const note = eventId
    ? '却下通知送信済み。カレンダーイベントIDがあります。予定を消す場合はステータスを取消にしてください。'
    : '却下通知送信済み';

  writeRowFields_(sheet, row, {
    [CONFIG.COLS.processedAt]: formatNow_(),
    [CONFIG.COLS.result]: note
  });
}

function cancelReservation_(sheet, row, record) {
  const result = normalizeText_(record[CONFIG.COLS.result]);
  if (result.indexOf('取消通知送信済み') !== -1) {
    writeRowFields_(sheet, row, {
      [CONFIG.COLS.processedAt]: formatNow_(),
      [CONFIG.COLS.result]: '取消通知送信済み: 再処理しません'
    });
    return;
  }

  const eventId = normalizeText_(record[CONFIG.COLS.eventId]);
  let calendarResult = 'カレンダーイベントIDなし';

  if (eventId) {
    const calendar = getCalendar_();
    const event = calendar.getEventById(eventId);
    if (event) {
      if (CONFIG.CANCEL_MODE === 'mark') {
        if (event.getTitle().indexOf('【取消】') !== 0) {
          event.setTitle('【取消】' + event.getTitle());
        }
        event.setDescription(event.getDescription() + '\n\n取消処理日時: ' + formatNow_());
        try {
          event.setColor(CalendarApp.EventColor.GRAY);
        } catch (colorError) {
          // 色設定が使えない環境でも取消処理自体は継続します。
        }
        calendarResult = 'カレンダー予定を取消表示に変更済み';
      } else {
        event.deleteEvent();
        calendarResult = 'カレンダー予定を削除済み';
      }
    } else {
      calendarResult = 'カレンダー予定が見つかりません';
    }
  }

  sendCancellationMail_(record, calendarResult);
  writeRowFields_(sheet, row, {
    [CONFIG.COLS.processedAt]: formatNow_(),
    [CONFIG.COLS.result]: '取消通知送信済み: ' + calendarResult
  });
}

function createCalendarEvent_(calendar, record, period, row) {
  const location = normalizeText_(record[CONFIG.COLS.location]);
  const purpose = normalizeText_(record[CONFIG.COLS.purpose]);
  const title = '【予約】' + location + ' ' + truncate_(purpose, 30);
  const description = [
    '予約申請から自動登録された予定です。',
    '',
    '申請行: ' + row,
    '氏名: ' + displayValue_(record[CONFIG.COLS.name]),
    '所属: ' + displayValue_(record[CONFIG.COLS.department]),
    'メールアドレス: ' + displayValue_(record[CONFIG.COLS.email]),
    '利用場所: ' + displayValue_(record[CONFIG.COLS.location]),
    '利用目的: ' + displayValue_(record[CONFIG.COLS.purpose]),
    '備考: ' + displayValue_(record[CONFIG.COLS.note])
  ].join('\n');

  return calendar.createEvent(title, period.start, period.end, {
    location: location,
    description: description
  });
}

function findConflicts_(calendar, start, end, location) {
  const targetLocation = normalizeComparable_(location);
  const events = calendar.getEvents(start, end);

  return events
    .filter(function(event) {
      if (event.getTitle().indexOf('【取消】') === 0) return false;

      const eventStart = event.getStartTime();
      const eventEnd = event.getEndTime();
      if (!isOverlapping_(start, end, eventStart, eventEnd)) return false;

      const eventLocation = normalizeComparable_(event.getLocation());
      const eventTitle = normalizeComparable_(event.getTitle());
      if (!targetLocation) return true;
      if (eventLocation) return eventLocation === targetLocation;
      return eventTitle.indexOf(targetLocation) !== -1;
    })
    .map(function(event) {
      return [
        formatDateTime_(event.getStartTime()),
        '-',
        formatTime_(event.getEndTime()),
        event.getTitle(),
        event.getLocation() ? '(' + event.getLocation() + ')' : ''
      ].join(' ');
    });
}

function isOverlapping_(startA, endA, startB, endB) {
  return startA < endB && startB < endA;
}

function getReservationPayload_() {
  const sheet = getOrCreateSheet_();
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();

  if (lastRow <= 1 || lastColumn === 0) {
    return {
      generatedAt: formatNow_(),
      viewConfig: VIEW_CONFIG,
      events: [],
      locations: []
    };
  }

  const headers = getHeaders_(sheet);
  const values = sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues();
  const events = [];
  const locations = {};

  values.forEach(function(rowValues, index) {
    const record = rowValuesToRecord_(headers, rowValues);
    const status = normalizeStatus_(record[CONFIG.COLS.status]);
    if (VIEW_CONFIG.visibleStatuses.indexOf(status) === -1) return;

    try {
      const period = parseReservationPeriod_(record);
      const item = sanitizeReservationForView_(record, period, index + 2);
      events.push(item);
      if (item.location) locations[item.location] = true;
    } catch (error) {
      // 表示用データでは、日時が読めない行はスキップします。
    }
  });

  return {
    generatedAt: formatNow_(),
    viewConfig: VIEW_CONFIG,
    events: events,
    locations: Object.keys(locations).sort()
  };
}

function sanitizeReservationForView_(record, period, row) {
  const item = {
    id: String(row),
    row: row,
    date: formatDate_(period.start),
    start: formatDateTimeForJson_(period.start),
    end: formatDateTimeForJson_(period.end),
    startTime: formatTime_(period.start),
    endTime: formatTime_(period.end),
    location: displayValue_(record[CONFIG.COLS.location]),
    status: displayValue_(record[CONFIG.COLS.status])
  };

  if (VIEW_CONFIG.showPurpose) item.purpose = displayValue_(record[CONFIG.COLS.purpose]);
  if (VIEW_CONFIG.showName) item.name = displayValue_(record[CONFIG.COLS.name]);
  if (VIEW_CONFIG.showDepartment) item.department = displayValue_(record[CONFIG.COLS.department]);
  if (VIEW_CONFIG.showEmail) item.email = displayValue_(record[CONFIG.COLS.email]);
  if (VIEW_CONFIG.showNote) item.note = displayValue_(record[CONFIG.COLS.note]);
  if (VIEW_CONFIG.showAdminMemo) item.adminMemo = displayValue_(record[CONFIG.COLS.adminMemo]);
  if (VIEW_CONFIG.showProcessedAt) item.processedAt = displayValue_(record[CONFIG.COLS.processedAt]);

  return item;
}

function sendReceiptMail_(record) {
  const email = requireEmail_(record);
  const name = displayValue_(record[CONFIG.COLS.name]) || '申請者';
  const body = [
    name + ' 様',
    '',
    '予約申請を受け付けました。',
    'この時点では予約は確定していません。',
    '管理者が申請内容と予約状況を確認し、承認メールの送信をもって予約確定となります。',
    '',
    '【申請内容】',
    buildReservationSummary_(record),
    '',
    '内容に誤りがある場合は、管理者へご連絡ください。',
    '',
    '予約管理'
  ].join('\n');

  MailApp.sendEmail({
    to: email,
    subject: '【予約申請受付】予約申請を受け付けました',
    body: body,
    name: CONFIG.MAIL_SENDER_NAME
  });
}

function sendApprovalMail_(record, period) {
  const email = requireEmail_(record);
  const name = displayValue_(record[CONFIG.COLS.name]) || '申請者';
  const body = [
    name + ' 様',
    '',
    '予約申請を承認しました。',
    '本メールの送信をもって予約確定となります。',
    '',
    '【確定した予約内容】',
    buildReservationSummary_(record, period),
    '',
    '利用時間には準備と片付けを含め、時間内に終了するようご協力ください。',
    '変更または取消が必要になった場合は、速やかに管理者へご連絡ください。',
    '',
    '予約管理'
  ].join('\n');

  MailApp.sendEmail({
    to: email,
    subject: '【予約承認】予約が確定しました',
    body: body,
    name: CONFIG.MAIL_SENDER_NAME
  });
}

function sendRejectionMail_(record) {
  const email = requireEmail_(record);
  const name = displayValue_(record[CONFIG.COLS.name]) || '申請者';
  const adminMemo = displayValue_(record[CONFIG.COLS.adminMemo]);
  const body = [
    name + ' 様',
    '',
    '予約申請を確認しましたが、今回は承認できませんでした。',
    'この申請は予約確定にはなりません。',
    '',
    '【申請内容】',
    buildReservationSummary_(record),
    '',
    adminMemo ? '【管理者からの連絡事項】\n' + adminMemo + '\n' : '',
    '必要に応じて、内容を調整のうえ再度申請してください。',
    '',
    '予約管理'
  ].join('\n');

  MailApp.sendEmail({
    to: email,
    subject: '【予約却下】予約申請について',
    body: body,
    name: CONFIG.MAIL_SENDER_NAME
  });
}

function sendCancellationMail_(record, calendarResult) {
  const email = requireEmail_(record);
  const name = displayValue_(record[CONFIG.COLS.name]) || '申請者';
  const body = [
    name + ' 様',
    '',
    '予約の取消処理を行いました。',
    '対象の予約は利用できません。',
    '',
    '【取消対象】',
    buildReservationSummary_(record),
    '',
    '【処理内容】',
    calendarResult,
    '',
    'ご不明な点がある場合は、管理者へご連絡ください。',
    '',
    '予約管理'
  ].join('\n');

  MailApp.sendEmail({
    to: email,
    subject: '【予約取消】予約の取消について',
    body: body,
    name: CONFIG.MAIL_SENDER_NAME
  });
}

function buildReservationSummary_(record, period) {
  let startText = displayValue_(record[CONFIG.COLS.startTime]);
  let endText = displayValue_(record[CONFIG.COLS.endTime]);
  let dateText = displayValue_(record[CONFIG.COLS.date]);

  if (period) {
    dateText = formatDateJapanese_(period.start);
    startText = formatTime_(period.start);
    endText = formatTime_(period.end);
  }

  return [
    '利用場所: ' + displayValue_(record[CONFIG.COLS.location]),
    '利用日: ' + dateText,
    '時間: ' + startText + ' - ' + endText,
    '氏名: ' + displayValue_(record[CONFIG.COLS.name]),
    '所属: ' + displayValue_(record[CONFIG.COLS.department]),
    '利用目的: ' + displayValue_(record[CONFIG.COLS.purpose]),
    '備考: ' + displayValue_(record[CONFIG.COLS.note])
  ].join('\n');
}

function parseReservationPeriod_(record) {
  const datePart = parseDatePart_(record[CONFIG.COLS.date]);
  const startPart = parseTimePart_(record[CONFIG.COLS.startTime]);
  const endPart = parseTimePart_(record[CONFIG.COLS.endTime]);

  const start = new Date(datePart.year, datePart.month - 1, datePart.day, startPart.hour, startPart.minute, 0);
  const end = new Date(datePart.year, datePart.month - 1, datePart.day, endPart.hour, endPart.minute, 0);

  if (!(start instanceof Date) || isNaN(start.getTime())) {
    throw new Error('開始日時を解釈できません。');
  }

  if (!(end instanceof Date) || isNaN(end.getTime())) {
    throw new Error('終了日時を解釈できません。');
  }

  if (end <= start) {
    throw new Error('終了時刻は開始時刻より後にしてください。');
  }

  return {
    start: start,
    end: end
  };
}

function parseDatePart_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return {
      year: Number(Utilities.formatDate(value, CONFIG.TIME_ZONE, 'yyyy')),
      month: Number(Utilities.formatDate(value, CONFIG.TIME_ZONE, 'M')),
      day: Number(Utilities.formatDate(value, CONFIG.TIME_ZONE, 'd'))
    };
  }

  if (typeof value === 'number') {
    const date = new Date(Math.round((value - 25569) * 86400 * 1000));
    return parseDatePart_(date);
  }

  const text = toHalfWidth_(String(value || '').trim())
    .replace(/[（(].*?[）)]/g, '')
    .replace(/年|\.|-/g, '/')
    .replace(/月/g, '/')
    .replace(/日/g, '')
    .replace(/\s+/g, '');

  let match = text.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (match) {
    return {
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3])
    };
  }

  match = text.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (match) {
    const now = new Date();
    return {
      year: Number(Utilities.formatDate(now, CONFIG.TIME_ZONE, 'yyyy')),
      month: Number(match[1]),
      day: Number(match[2])
    };
  }

  match = text.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (match) {
    return {
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3])
    };
  }

  throw new Error('希望日を解釈できません: ' + value);
}

function parseTimePart_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return {
      hour: Number(Utilities.formatDate(value, CONFIG.TIME_ZONE, 'H')),
      minute: Number(Utilities.formatDate(value, CONFIG.TIME_ZONE, 'm'))
    };
  }

  if (typeof value === 'number') {
    const fraction = value >= 1 ? value % 1 : value;
    const totalMinutes = Math.round(fraction * 24 * 60);
    return {
      hour: Math.floor(totalMinutes / 60),
      minute: totalMinutes % 60
    };
  }

  let text = toHalfWidth_(String(value || '').trim().toLowerCase());
  const isPm = /午後|pm|p\.m\./.test(text);
  const isAm = /午前|am|a\.m\./.test(text);
  text = text
    .replace(/午前|午後|am|pm|a\.m\.|p\.m\./g, '')
    .replace(/時/g, ':')
    .replace(/分/g, '')
    .replace(/\s+/g, '');

  let hour;
  let minute;
  let match = text.match(/^(\d{1,2}):(\d{1,2})$/);

  if (match) {
    hour = Number(match[1]);
    minute = Number(match[2]);
  } else if (/^\d{3,4}$/.test(text)) {
    const padded = text.padStart(4, '0');
    hour = Number(padded.slice(0, 2));
    minute = Number(padded.slice(2));
  } else if (/^\d{1,2}$/.test(text)) {
    hour = Number(text);
    minute = 0;
  } else {
    throw new Error('時刻を解釈できません: ' + value);
  }

  if (isPm && hour < 12) hour += 12;
  if (isAm && hour === 12) hour = 0;

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new Error('時刻の範囲が正しくありません: ' + value);
  }

  return {
    hour: hour,
    minute: minute
  };
}

function getCalendar_() {
  if (!CONFIG.CALENDAR_ID || CONFIG.CALENDAR_ID === 'YOUR_CALENDAR_ID_HERE') {
    throw new Error('CONFIG.CALENDAR_ID にGoogleカレンダーIDを設定してください。');
  }

  const calendar = CalendarApp.getCalendarById(CONFIG.CALENDAR_ID);
  if (!calendar) {
    throw new Error('Googleカレンダーが見つかりません: ' + CONFIG.CALENDAR_ID);
  }

  return calendar;
}

function getOrCreateSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(CONFIG.SHEET_NAME);
  }
  return sheet;
}

function ensureBaseHeaders_(sheet) {
  if (sheet.getLastRow() > 0 && sheet.getLastColumn() > 0) return;
  sheet.getRange(1, 1, 1, CONFIG.FORM_COLUMNS.length).setValues([CONFIG.FORM_COLUMNS]);
}

function ensureManagementColumns_(sheet) {
  ensureBaseHeaders_(sheet);
  const headers = getHeaders_(sheet);
  const missing = CONFIG.MANAGEMENT_COLUMNS.filter(function(name) {
    return headers.indexOf(name) === -1;
  });

  if (missing.length === 0) return;

  const startColumn = sheet.getLastColumn() + 1;
  sheet.getRange(1, startColumn, 1, missing.length).setValues([missing]);
}

function setupStatusValidation_(sheet) {
  const headerMap = getHeaderMap_(sheet);
  const statusColumn = headerMap[CONFIG.COLS.status];
  if (!statusColumn) return;

  const statuses = [
    CONFIG.STATUS.PENDING,
    CONFIG.STATUS.APPROVED,
    CONFIG.STATUS.REJECTED,
    CONFIG.STATUS.CANCELLED
  ];
  const validation = SpreadsheetApp
    .newDataValidation()
    .requireValueInList(statuses, true)
    .setAllowInvalid(false)
    .build();

  const maxRows = Math.max(sheet.getMaxRows() - 1, 1);
  sheet.getRange(2, statusColumn, maxRows, 1).setDataValidation(validation);
}

function setupStatusSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(CONFIG.STATUS_SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(CONFIG.STATUS_SHEET_NAME);
  }

  sheet.clear();
  sheet.getRange(1, 1, 5, 2).setValues([
    ['ステータス', '意味'],
    ['未処理', '申請受付済み、管理者確認待ち'],
    ['承認', '重複チェック後、カレンダー登録と承認メール送信'],
    ['却下', '却下メール送信'],
    ['取消', 'カレンダー予定の削除または取消表示、取消通知メール送信']
  ]);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 2);
}

function getRecordByRow_(sheet, row) {
  const headers = getHeaders_(sheet);
  const values = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
  return rowValuesToRecord_(headers, values);
}

function rowValuesToRecord_(headers, values) {
  const record = {};
  headers.forEach(function(header, index) {
    record[header] = values[index];
  });
  return record;
}

function getHeaders_(sheet) {
  if (sheet.getLastColumn() === 0) return [];
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(value) {
    return normalizeText_(value);
  });
}

function getHeaderMap_(sheet) {
  const map = {};
  getHeaders_(sheet).forEach(function(header, index) {
    if (header) map[header] = index + 1;
  });
  return map;
}

function writeRowFields_(sheet, row, updates) {
  if (!updates || Object.keys(updates).length === 0) return;

  const headerMap = getHeaderMap_(sheet);
  Object.keys(updates).forEach(function(header) {
    const column = headerMap[header];
    if (column) {
      sheet.getRange(row, column).setValue(updates[header]);
    }
  });
}

function normalizeStatus_(value) {
  const text = normalizeText_(value);
  if (!text) return '';
  if (text === CONFIG.STATUS.PENDING) return CONFIG.STATUS.PENDING;
  if (text === CONFIG.STATUS.APPROVED) return CONFIG.STATUS.APPROVED;
  if (text === CONFIG.STATUS.REJECTED) return CONFIG.STATUS.REJECTED;
  if (text === CONFIG.STATUS.CANCELLED) return CONFIG.STATUS.CANCELLED;
  return text;
}

function normalizeText_(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\u3000/g, ' ').trim();
}

function normalizeComparable_(value) {
  return toHalfWidth_(normalizeText_(value)).replace(/\s+/g, '').toLowerCase();
}

function toHalfWidth_(value) {
  return String(value || '')
    .replace(/[０-９]/g, function(char) {
      return String.fromCharCode(char.charCodeAt(0) - 0xFEE0);
    })
    .replace(/[Ａ-Ｚａ-ｚ]/g, function(char) {
      return String.fromCharCode(char.charCodeAt(0) - 0xFEE0);
    })
    .replace(/：/g, ':');
}

function requireEmail_(record) {
  const email = normalizeText_(record[CONFIG.COLS.email]);
  if (!email) {
    throw new Error('メールアドレスが空です。');
  }
  return email;
}

function displayValue_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, CONFIG.TIME_ZONE, 'yyyy/MM/dd HH:mm');
  }
  return normalizeText_(value);
}

function formatNow_() {
  return Utilities.formatDate(new Date(), CONFIG.TIME_ZONE, 'yyyy/MM/dd HH:mm:ss');
}

function formatDate_(date) {
  return Utilities.formatDate(date, CONFIG.TIME_ZONE, 'yyyy-MM-dd');
}

function formatDateJapanese_(date) {
  return Utilities.formatDate(date, CONFIG.TIME_ZONE, 'yyyy年M月d日');
}

function formatTime_(date) {
  return Utilities.formatDate(date, CONFIG.TIME_ZONE, 'HH:mm');
}

function formatDateTime_(date) {
  return Utilities.formatDate(date, CONFIG.TIME_ZONE, 'yyyy/MM/dd HH:mm');
}

function formatDateTimeForJson_(date) {
  return Utilities.formatDate(date, CONFIG.TIME_ZONE, "yyyy-MM-dd'T'HH:mm:ss");
}

function truncate_(value, length) {
  const text = normalizeText_(value);
  if (text.length <= length) return text;
  return text.slice(0, length) + '...';
}

function getErrorMessage_(error) {
  if (!error) return '不明なエラー';
  return error.message || String(error);
}

