/*
 * 弁当注文API
 *
 * このWebアプリAPIはGitHub Pagesなどの静的サイトから呼び出すためのものです。
 * 認証付きAPIではないため、個人情報や機密性の高い情報は扱わないでください。
 * 変更・キャンセル時は注文IDとメールアドレス照合、ログ記録、メール通知で運用確認します。
 */

function doGet(e) {
  return handleApiRequest_(e || {}, null);
}

function doPost(e) {
  var postBody = null;
  try {
    if (e && e.postData && e.postData.contents) {
      postBody = JSON.parse(e.postData.contents);
    }
  } catch (error) {
    postBody = null;
  }
  return handleApiRequest_(e || {}, postBody);
}

function handleApiRequest_(e, postBody) {
  var parameter = (e && e.parameter) || {};
  var callback = sanitizeText(parameter.callback || '');
  var action = sanitizeText(parameter.action || (postBody && postBody.action) || '');
  var response;

  try {
    if (!action) throw new Error('actionパラメータが指定されていません。');

    if (action === 'initial') {
      response = okResponse_(getInitialData());
    } else if (action === 'orders') {
      response = okResponse_(getOrdersPublic());
    } else if (action === 'summaries') {
      response = okResponse_(getSummaries());
    } else if (action === 'order') {
      response = okResponse_(submitOrder(readPayload_(parameter, postBody)));
    } else if (action === 'change') {
      response = okResponse_(submitChange(readPayload_(parameter, postBody)));
    } else if (action === 'cancel') {
      response = okResponse_(submitCancel(readPayload_(parameter, postBody)));
    } else {
      throw new Error('未対応のactionです: ' + action);
    }
  } catch (error) {
    logEvent('EXCEPTION_ERROR', error.message, '', '', error.stack || '');
    response = errorResponse_(error.message);
  }

  return createApiOutput_(response, callback);
}

function readPayload_(parameter, postBody) {
  if (postBody && postBody.payload) return parsePayloadValue_(postBody.payload);
  if (postBody && postBody.type) return postBody;

  var raw = parameter && parameter.payload;
  if (!raw) throw new Error('payloadパラメータが指定されていません。');
  return parsePayloadValue_(raw);
}

function parsePayloadValue_(raw) {
  if (typeof raw === 'object') return raw;

  try {
    return JSON.parse(raw);
  } catch (error) {
    try {
      return JSON.parse(decodeURIComponent(raw));
    } catch (decodeError) {
      throw new Error('payloadのJSON形式が不正です。');
    }
  }
}

function okResponse_(data) {
  return {
    ok: true,
    data: data
  };
}

function errorResponse_(message) {
  return {
    ok: false,
    error: sanitizeText(message || 'エラーが発生しました。')
  };
}

function createApiOutput_(response, callback) {
  var body = JSON.stringify(response);
  var output;

  if (callback) {
    if (!validateCallbackName_(callback)) {
      logEvent('VALIDATION_ERROR', 'callback名が不正です。', '', '', callback);
      return ContentService
        .createTextOutput(JSON.stringify(errorResponse_('callback名が不正です。')))
        .setMimeType(ContentService.MimeType.JSON);
    }

    output = ContentService.createTextOutput(callback + '(' + body + ');');
    return output.setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
}

function validateCallbackName_(callback) {
  return /^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*$/.test(callback);
}

function testInitializeSheets() {
  initializeSheets();
  Logger.log('initializeSheets completed');
}

function testGetInitialData() {
  initializeSheets();
  var data = getInitialData();
  Logger.log(JSON.stringify(data, null, 2));
  return data;
}

function testSubmitOrder() {
  initializeSheets();
  var payload = {
    type: 'order',
    department: '総務課',
    applicantName: '田中',
    email: getTestEmail_(),
    deliveryDate: '2026-05-25',
    items: [
      {
        menuId: 'B001',
        menuName: '鮭弁当',
        unitPrice: 750,
        quantity: 2,
        subtotal: 1500
      },
      {
        menuId: 'B002',
        menuName: 'のり弁当',
        unitPrice: 650,
        quantity: 1,
        subtotal: 650
      }
    ],
    totalQuantity: 3,
    totalAmount: 2150,
    note: 'テスト注文'
  };
  var result = submitOrder(payload);
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function testSubmitChange() {
  initializeSheets();
  var orderResult = testSubmitOrder();
  var targetOrderId = orderResult.orderIds[0];
  var payload = {
    type: 'change',
    targetOrderId: targetOrderId,
    department: '総務課',
    applicantName: '田中',
    email: getTestEmail_(),
    newDeliveryDate: '2026-05-25',
    items: [
      {
        menuId: 'B003',
        menuName: '唐揚げ弁当',
        unitPrice: 700,
        quantity: 1,
        subtotal: 700
      }
    ],
    totalQuantity: 1,
    totalAmount: 700,
    note: 'テスト変更'
  };
  var result = submitChange(payload);
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function testSubmitCancel() {
  initializeSheets();
  var orderResult = testSubmitOrder();
  var targetOrderId = orderResult.orderIds[0];
  var payload = {
    type: 'cancel',
    targetOrderId: targetOrderId,
    department: '総務課',
    applicantName: '田中',
    email: getTestEmail_(),
    note: 'テストキャンセル'
  };
  var result = submitCancel(payload);
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function getTestEmail_() {
  var configured = sanitizeText(getSettingValue_('TEST_EMAIL', ''));
  if (configured) return normalizeEmail(configured);

  try {
    var activeUserEmail = Session.getActiveUser().getEmail();
    if (activeUserEmail) return normalizeEmail(activeUserEmail);
  } catch (error) {
    // テスト関数用のフォールバックです。
  }

  return 'test@example.com';
}
