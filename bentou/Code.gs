function doPost(e) {
  const lock = LockService.getScriptLock();
  let locked = false;

  try {
    lock.waitLock(10000);
    locked = true;

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const orderSheet = ss.getSheetByName('orders');

    if (!orderSheet) {
      return createJsonResponse_({
        ok: false,
        message: 'orders シートが見つかりません。'
      });
    }

    const data = JSON.parse(e.postData.contents);

    const department = String(data.department || '').trim();
    const name = String(data.name || '').trim();
    const contact = String(data.contact || '').trim();
    const note = String(data.note || '').trim();
    const items = Array.isArray(data.items) ? data.items : [];

    if (!department) {
      return createJsonResponse_({
        ok: false,
        message: '部署が未入力です。'
      });
    }

    if (!name) {
      return createJsonResponse_({
        ok: false,
        message: '名前が未入力です。'
      });
    }

    if (items.length === 0) {
      return createJsonResponse_({
        ok: false,
        message: '注文メニューがありません。'
      });
    }

    const menuMap = getMenuMap_(ss);
    const sizeMap = getSizeOptionMap_(ss);
    const validItems = [];

    items.forEach(function(item) {
      const menuName = String(item.menu || '').trim();
      const requestedSize = String(item.size || '').trim();
      const quantity = Number(item.quantity);

      if (!menuName) return;
      if (!Number.isInteger(quantity) || quantity <= 0) return;

      const menu = menuMap[menuName];

      if (!menu) {
        throw new Error('menus シートに存在しないメニューです: ' + menuName);
      }

      if (!menu.visible) {
        throw new Error('非表示のメニューが送信されました: ' + menuName);
      }

      let sizeName = '';
      let sizeAdjustment = 0;

      if (menu.sizeEnabled) {
        sizeName = requestedSize || '普通';

        const sizeOption = sizeMap[sizeName];

        if (!sizeOption) {
          throw new Error('size_options シートに存在しないサイズです: ' + sizeName);
        }

        if (!sizeOption.visible) {
          throw new Error('非表示のサイズが送信されました: ' + sizeName);
        }

        sizeAdjustment = sizeOption.adjustment;
      }

      const basePrice = menu.basePrice;
      const unitPrice = basePrice + sizeAdjustment;

      validItems.push({
        menu: menuName,
        size: sizeName,
        basePrice: basePrice,
        sizeAdjustment: sizeAdjustment,
        unitPrice: unitPrice,
        quantity: quantity
      });
    });

    if (validItems.length === 0) {
      return createJsonResponse_({
        ok: false,
        message: '有効な注文メニューがありません。'
      });
    }

    const timestamp = new Date();

    const rows = validItems.map(function(item) {
      return [
        timestamp,
        department,
        name,
        contact,
        item.menu,
        item.size,
        item.basePrice,
        item.sizeAdjustment,
        item.unitPrice,
        item.quantity,
        '有効',
        note
      ];
    });

    const startRow = orderSheet.getLastRow() + 1;
    const numRows = rows.length;

    orderSheet
      .getRange(startRow, 1, numRows, 1)
      .setNumberFormat('yyyy/MM/dd HH:mm:ss');

    orderSheet
      .getRange(startRow, 4, numRows, 1)
      .setNumberFormat('@');

    orderSheet
      .getRange(startRow, 1, numRows, 12)
      .setValues(rows);

    try {
      if (typeof syncPublicSheet === 'function') {
        syncPublicSheet();
      } else {
        Logger.log('syncPublicSheet が定義されていないため、公開用シートの同期をスキップしました。');
      }
    } catch (syncError) {
      Logger.log('公開用シートの同期に失敗しました: ' + formatErrorForLog_(syncError));
    }

    return createJsonResponse_({
      ok: true,
      insertedRows: rows.length
    });

  } catch (error) {
    return createJsonResponse_({
      ok: false,
      message: error.message
    });

  } finally {
    if (locked) {
      lock.releaseLock();
    }
  }
}

function doGet(e) {
  try {
    const publicSs = getPublicSpreadsheet_();
    const publicSheet = publicSs.getSheetByName(PUBLIC_SHEET_NAME);

    if (!publicSheet) {
      throw new Error('公開用シートが見つかりません: ' + PUBLIC_SHEET_NAME);
    }

    const values = publicSheet.getDataRange().getValues();
    const headers = values.length > 0
      ? values[0].map(function(header) {
        return String(header || '').trim();
      })
      : [];

    const indexes = getPublicOrderColumnIndexes_(headers);
    const orders = [];

    values.slice(1).forEach(function(row) {
      const hasValue = row.some(function(cell) {
        return cell !== '' && cell !== null;
      });

      if (!hasValue) {
        return;
      }

      const unitPrice = toFiniteNumber_(row[indexes.unitPrice], 0);
      const quantity = toFiniteNumber_(row[indexes.quantity], 0);

      orders.push({
        timestamp: formatDateTime_(row[indexes.timestamp]),
        department: String(row[indexes.department] || '').trim(),
        menu: String(row[indexes.menu] || '').trim(),
        size: String(row[indexes.size] || '').trim(),
        basePrice: toFiniteNumber_(row[indexes.basePrice], 0),
        sizeAdjustment: toFiniteNumber_(row[indexes.sizeAdjustment], 0),
        unitPrice: unitPrice,
        quantity: quantity,
        subtotal: unitPrice * quantity
      });
    });

    return createJsonResponse_({
      ok: true,
      data: {
        orders: orders,
        updatedAt: formatDateTime_(new Date())
      }
    });

  } catch (error) {
    return createJsonResponse_({
      ok: false,
      message: error.message
    });
  }
}

function getPublicOrderColumnIndexes_(headers) {
  const requiredHeaders = [
    'タイムスタンプ',
    '部署',
    'メニュー',
    'サイズ',
    '基本単価',
    'サイズ加算額',
    '単価',
    '数量'
  ];

  const indexes = {};

  requiredHeaders.forEach(function(header) {
    const index = headers.indexOf(header);

    if (index === -1) {
      throw new Error('公開用シートに列が見つかりません: ' + header);
    }

    if (header === 'タイムスタンプ') indexes.timestamp = index;
    if (header === '部署') indexes.department = index;
    if (header === 'メニュー') indexes.menu = index;
    if (header === 'サイズ') indexes.size = index;
    if (header === '基本単価') indexes.basePrice = index;
    if (header === 'サイズ加算額') indexes.sizeAdjustment = index;
    if (header === '単価') indexes.unitPrice = index;
    if (header === '数量') indexes.quantity = index;
  });

  return indexes;
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

function exportMastersJson() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const masters = {
    menus: getMenusForJson_(ss),
    sizeOptions: getSizeOptionsForJson_(ss)
  };

  const jsonText = JSON.stringify(masters, null, 2);
  const fileName = 'masters.json';

  const existingFiles = DriveApp.getFilesByName(fileName);
  while (existingFiles.hasNext()) {
    const file = existingFiles.next();
    file.setTrashed(true);
  }

  const file = DriveApp.createFile(
    fileName,
    jsonText,
    MimeType.PLAIN_TEXT
  );

  Logger.log('masters.json を出力しました。');
  Logger.log(file.getUrl());
}

function getMenusForJson_(ss) {
  const sheet = ss.getSheetByName('menus');

  if (!sheet) {
    throw new Error('menus シートが見つかりません。');
  }

  const values = sheet.getDataRange().getValues();
  const menus = [];

  for (let i = 1; i < values.length; i++) {
    const menuName = String(values[i][0] || '').trim();
    const basePrice = Number(values[i][1]);
    const sizeEnabled = toBoolean_(values[i][2]);
    const visible = toBoolean_(values[i][3]);

    if (!menuName) continue;

    menus.push({
      name: menuName,
      basePrice: Number.isFinite(basePrice) ? basePrice : 0,
      sizeEnabled: sizeEnabled,
      visible: visible
    });
  }

  return menus;
}

function getSizeOptionsForJson_(ss) {
  const sheet = ss.getSheetByName('size_options');

  if (!sheet) {
    throw new Error('size_options シートが見つかりません。');
  }

  const values = sheet.getDataRange().getValues();
  const sizeOptions = [];

  for (let i = 1; i < values.length; i++) {
    const sizeName = String(values[i][0] || '').trim();
    const adjustment = Number(values[i][1]);
    const visible = toBoolean_(values[i][2]);
    const order = Number(values[i][3]);

    if (!sizeName) continue;

    sizeOptions.push({
      name: sizeName,
      adjustment: Number.isFinite(adjustment) ? adjustment : 0,
      visible: visible,
      order: Number.isFinite(order) ? order : 0
    });
  }

  sizeOptions.sort(function(a, b) {
    return a.order - b.order;
  });

  return sizeOptions;
}

function getMenuMap_(ss) {
  const sheet = ss.getSheetByName('menus');

  if (!sheet) {
    throw new Error('menus シートが見つかりません。');
  }

  const values = sheet.getDataRange().getValues();
  const map = {};

  for (let i = 1; i < values.length; i++) {
    const menuName = String(values[i][0] || '').trim();
    const basePrice = Number(values[i][1]);
    const sizeEnabled = toBoolean_(values[i][2]);
    const visible = toBoolean_(values[i][3]);

    if (!menuName) continue;

    map[menuName] = {
      basePrice: Number.isFinite(basePrice) ? basePrice : 0,
      sizeEnabled: sizeEnabled,
      visible: visible
    };
  }

  return map;
}

function getSizeOptionMap_(ss) {
  const sheet = ss.getSheetByName('size_options');

  if (!sheet) {
    throw new Error('size_options シートが見つかりません。');
  }

  const values = sheet.getDataRange().getValues();
  const map = {};

  for (let i = 1; i < values.length; i++) {
    const sizeName = String(values[i][0] || '').trim();
    const adjustment = Number(values[i][1]);
    const visible = toBoolean_(values[i][2]);

    if (!sizeName) continue;

    map[sizeName] = {
      adjustment: Number.isFinite(adjustment) ? adjustment : 0,
      visible: visible
    };
  }

  return map;
}

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

function createJsonResponse_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
