function sanitizeText(value) {
  return String(value == null ? '' : value)
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/[<>]/g, '')
    .trim();
}

function validateEmail(email) {
  var text = normalizeEmail(email);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
}

function isPositiveInteger(value) {
  var number = Number(value);
  return Number.isInteger(number) && number > 0;
}

function isZeroOrPositiveInteger_(value) {
  var number = Number(value);
  return Number.isInteger(number) && number >= 0;
}

function validateItems(items) {
  var errors = [];
  if (!Array.isArray(items) || items.length === 0) {
    errors.push('メニューが選択されていません。');
    return errors;
  }

  var positiveCount = 0;
  items.forEach(function (item, index) {
    if (!item || typeof item !== 'object') {
      errors.push('メニュー情報が不正です。');
      return;
    }

    if (!sanitizeText(item.menuId)) {
      errors.push((index + 1) + '番目のメニューIDが空です。');
    }

    if (!isZeroOrPositiveInteger_(item.quantity)) {
      errors.push((index + 1) + '番目の個数は0以上の整数で入力してください。');
    }

    if (Number(item.quantity) > 0) {
      positiveCount += Number(item.quantity);
    }
  });

  if (positiveCount < 1) {
    errors.push('メニューの合計個数が1以上になるように入力してください。');
  }

  return errors;
}

function validateOrderPayload(payload) {
  var errors = [];
  if (!payload || typeof payload !== 'object') {
    return ['注文データが不正です。'];
  }

  if (!sanitizeText(payload.department)) errors.push('担当部署を入力してください。');
  if (!sanitizeText(payload.applicantName)) errors.push('注文担当者名を入力してください。');
  if (!sanitizeText(payload.email)) {
    errors.push('メールアドレスを入力してください。');
  } else if (!validateEmail(payload.email)) {
    errors.push('メールアドレスの形式を確認してください。');
  }
  if (!formatDate(payload.deliveryDate)) errors.push('受取日を選択してください。');

  return errors.concat(validateItems(payload.items));
}

function validateChangePayload(payload) {
  var errors = [];
  if (!payload || typeof payload !== 'object') {
    return ['変更データが不正です。'];
  }

  if (!sanitizeText(payload.targetOrderId)) errors.push('注文IDを入力してください。');
  if (!sanitizeText(payload.department)) errors.push('担当部署を入力してください。');
  if (!sanitizeText(payload.applicantName)) errors.push('注文担当者名を入力してください。');
  if (!sanitizeText(payload.email)) {
    errors.push('メールアドレスを入力してください。');
  } else if (!validateEmail(payload.email)) {
    errors.push('メールアドレスの形式を確認してください。');
  }
  if (!formatDate(payload.newDeliveryDate)) errors.push('変更後受取日を選択してください。');

  return errors.concat(validateItems(payload.items));
}

function validateCancelPayload(payload) {
  var errors = [];
  if (!payload || typeof payload !== 'object') {
    return ['キャンセルデータが不正です。'];
  }

  if (!sanitizeText(payload.targetOrderId)) errors.push('注文IDを入力してください。');
  if (!sanitizeText(payload.department)) errors.push('担当部署を入力してください。');
  if (!sanitizeText(payload.applicantName)) errors.push('注文担当者名を入力してください。');
  if (!sanitizeText(payload.email)) {
    errors.push('メールアドレスを入力してください。');
  } else if (!validateEmail(payload.email)) {
    errors.push('メールアドレスの形式を確認してください。');
  }

  return errors;
}

function throwIfValidationErrors_(errors, email, orderId) {
  if (!errors || errors.length === 0) return;
  var message = errors.join(' / ');
  logEvent('VALIDATION_ERROR', message, email, orderId, '');
  throw new Error(message);
}
