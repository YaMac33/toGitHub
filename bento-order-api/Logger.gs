function logEvent(type, message, email, orderId, detail) {
  try {
    var sheet = getOrCreateSheet_(BENTO_SHEET_NAMES.logs);
    ensureHeaderRow_(sheet, BENTO_HEADERS.logs);

    var detailText = '';
    if (detail != null) {
      detailText = typeof detail === 'string' ? detail : JSON.stringify(detail);
    }

    sheet.appendRow([
      nowString(),
      sanitizeText(type),
      truncateText_(sanitizeText(message), 1000),
      truncateText_(sanitizeText(email), 300),
      truncateText_(sanitizeText(orderId), 100),
      truncateText_(sanitizeText(detailText), 3000)
    ]);
  } catch (error) {
    console.error('logEvent failed: ' + error.message);
  }
}
