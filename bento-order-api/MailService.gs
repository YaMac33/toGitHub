function isMailEnabled_() {
  return toBoolean(getSettingValue_('MAIL_ENABLED', 'TRUE'));
}

function getMailFromName_() {
  return sanitizeText(getSettingValue_('MAIL_FROM_NAME', '弁当注文システム'));
}

function sendEmailSafe_(to, subject, body, orderId) {
  if (!isMailEnabled_()) {
    logEvent('MAIL_SKIPPED', 'MAIL_ENABLEDがFALSEのためメール送信をスキップしました。', to, orderId, subject);
    return;
  }

  try {
    MailApp.sendEmail({
      to: normalizeEmail(to),
      subject: subject,
      body: body,
      name: getMailFromName_()
    });
  } catch (error) {
    logEvent('MAIL_SEND_ERROR', error.message, to, orderId, {
      subject: subject,
      stack: error.stack || ''
    });
  }
}

function buildItemsMailLines_(items) {
  if (!items || items.length === 0) return '注文内容なし';
  return items
    .map(function (item) {
      return [
        '- ',
        sanitizeText(item.menuName || item.menu || ''),
        ' / 単価: ',
        formatYen(item.unitPrice),
        ' / 個数: ',
        Number(item.quantity) || 0,
        ' / 小計: ',
        formatYen(item.subtotal)
      ].join('');
    })
    .join('\n');
}

function buildDeadlineLine_(deadlineInfo) {
  if (!deadlineInfo) return '締切日時は受取日ごとの設定に従います。';
  return '締切日時: ' + deadlineInfo.deadlineText + ' まで';
}

function sendOrderReceiptMail(payload, result, deadlineInfo) {
  var subject = '弁当注文を受け付けました';
  var body = [
    '弁当注文を受け付けました。',
    '',
    '受取日: ' + payload.deliveryDate,
    '担当部署: ' + payload.department,
    '注文担当者名: ' + payload.applicantName,
    '注文ID: ' + result.orderIds.join(', '),
    '',
    '注文内容:',
    buildItemsMailLines_(result.items),
    '',
    '合計金額: ' + formatYen(result.totalAmount),
    buildDeadlineLine_(deadlineInfo),
    '',
    '変更・キャンセルには注文IDが必要です。'
  ].join('\n');

  sendEmailSafe_(payload.email, subject, body, result.orderIds.join(','));
}

function sendChangeReceiptMail(payload, result, deadlineInfo) {
  var subject = '弁当注文の変更を受け付けました';
  var body = [
    '弁当注文の変更を受け付けました。',
    '',
    '変更前注文ID: ' + payload.targetOrderId,
    '新注文ID一覧: ' + result.orderIds.join(', '),
    '変更後受取日: ' + payload.newDeliveryDate,
    '担当部署: ' + payload.department,
    '注文担当者名: ' + payload.applicantName,
    '',
    '変更後注文内容:',
    buildItemsMailLines_(result.items),
    '',
    '合計金額: ' + formatYen(result.totalAmount),
    buildDeadlineLine_(deadlineInfo)
  ].join('\n');

  sendEmailSafe_(payload.email, subject, body, result.orderIds.join(','));
}

function sendCancelReceiptMail(payload, targetRows, result) {
  var items = targetRows.map(function (row) {
    return {
      menuName: sanitizeText(row['メニュー']),
      unitPrice: Number(row['単価']) || 0,
      quantity: Number(row['個数']) || 0,
      subtotal: Number(row['小計']) || 0
    };
  });
  var first = targetRows[0] || {};
  var totalAmount = items.reduce(function (sum, item) {
    return sum + item.subtotal;
  }, 0);
  var subject = '弁当注文をキャンセルしました';
  var body = [
    '弁当注文をキャンセルしました。',
    '',
    '注文ID: ' + payload.targetOrderId,
    '受取日: ' + formatDate(first['受取日']),
    '担当部署: ' + sanitizeText(first['担当部署']),
    '',
    'キャンセル内容:',
    buildItemsMailLines_(items),
    '',
    '金額: ' + formatYen(totalAmount),
    'ステータス: ' + statusLabel(BENTO_STATUS.CANCELED),
    '処理日時: ' + result.acceptedAt
  ].join('\n');

  sendEmailSafe_(payload.email, subject, body, payload.targetOrderId);
}

function sendRejectedMail(kind, payload, deadlineInfo, reason) {
  var typeLabel = {
    order: '注文',
    change: '変更',
    cancel: 'キャンセル'
  }[kind] || '申請';
  var subject = '締切後のため弁当注文を受け付けできませんでした';
  var orderIdLine = payload.targetOrderId ? '注文ID: ' + payload.targetOrderId : '';
  var deliveryDate = payload.deliveryDate || payload.newDeliveryDate || '';
  var body = [
    '締切後のため、弁当' + typeLabel + 'を受け付けできませんでした。',
    '',
    orderIdLine,
    '受取日: ' + deliveryDate,
    '締切日時: ' + (deadlineInfo ? deadlineInfo.deadlineText : ''),
    '理由: ' + sanitizeText(reason || '締切日時を過ぎています。'),
    '',
    '申請内容の概要:',
    '担当部署: ' + sanitizeText(payload.department),
    '注文担当者名: ' + sanitizeText(payload.applicantName),
    payload.items ? buildItemsMailLines_(payload.items) : '',
    '',
    '注文・変更・キャンセルは締切までに行う必要があります。'
  ]
    .filter(function (line) {
      return line !== '';
    })
    .join('\n');

  sendEmailSafe_(payload.email, subject, body, payload.targetOrderId || '');
}
