function pad2_(value) {
  return String(value).padStart(2, '0');
}

function getTimeZone_() {
  try {
    return Session.getScriptTimeZone() || BENTO_TIMEZONE;
  } catch (error) {
    return BENTO_TIMEZONE;
  }
}

function formatDate(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, getTimeZone_(), 'yyyy-MM-dd');
  }
  var text = String(value).trim();
  var match = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (!match) return text;
  return match[1] + '-' + pad2_(match[2]) + '-' + pad2_(match[3]);
}

function formatDateTime(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, getTimeZone_(), 'yyyy-MM-dd HH:mm:ss');
  }
  var date = parseDateTime(value);
  if (!date) return String(value).trim();
  return Utilities.formatDate(date, getTimeZone_(), 'yyyy-MM-dd HH:mm:ss');
}

function formatYen(value) {
  var number = Number(value) || 0;
  return number.toLocaleString('ja-JP') + '円';
}

function statusLabel(status) {
  var labels = {};
  labels[BENTO_STATUS.ACTIVE] = '有効';
  labels[BENTO_STATUS.CHANGED] = '変更済み';
  labels[BENTO_STATUS.CANCELED] = 'キャンセル済み';
  labels[BENTO_STATUS.REJECTED] = '締切後・無効';
  return labels[status] || String(status || '');
}

function parseDateTime(value) {
  if (!value) return null;
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return value;
  }

  var text = String(value).trim().replace(/\//g, '-');
  var match = text.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/
  );
  if (!match) return null;

  return new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4] || 0),
    Number(match[5] || 0),
    Number(match[6] || 0)
  );
}

function nowString() {
  return Utilities.formatDate(new Date(), getTimeZone_(), 'yyyy-MM-dd HH:mm:ss');
}

function toBoolean(value) {
  if (value === true) return true;
  if (value === false) return false;
  var text = String(value || '').trim().toUpperCase();
  return text === 'TRUE' || text === '1' || text === 'YES' || text === 'Y';
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function truncateText_(value, maxLength) {
  var text = String(value == null ? '' : value);
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

function createOrderIdCandidate_(deliveryDate, randomLength) {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var code = '';
  for (var i = 0; i < randomLength; i += 1) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return 'ORDER-' + formatDate(deliveryDate).replace(/-/g, '') + '-' + code;
}
