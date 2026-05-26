// ==============================
// 共通ユーティリティ
// ==============================

function toBoolean_(value) {
  if (value === true) return true;
  if (value === false) return false;

  const text = String(value || '').trim().toUpperCase();

  return text === 'TRUE' ||
    text === '1' ||
    text === 'YES' ||
    text === '有効' ||
    text === '表示';
}

function toFiniteNumber_(value, defaultValue) {
  const number = Number(value);
  return Number.isFinite(number) ? number : defaultValue;
}

function formatDateTime_(value) {
  if (value === '' || value === null || value === undefined) {
    return '';
  }

  const date = Object.prototype.toString.call(value) === '[object Date]'
    ? value
    : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return Utilities.formatDate(date, getScriptTimeZone_(), 'yyyy/MM/dd HH:mm:ss');
}

function getScriptTimeZone_() {
  return Session.getScriptTimeZone() || 'Asia/Tokyo';
}

function formatErrorForLog_(error) {
  if (!error) {
    return '';
  }

  return error.stack || error.message || String(error);
}

function formatYen_(value) {
  const number = Number(value);
  const amount = Number.isFinite(number) ? number : 0;

  return amount.toLocaleString('ja-JP') + '円';
}

function createJsonResponse_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}