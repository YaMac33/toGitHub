// ==============================
// menus / size_options 読み取り
// ==============================

function getMenuMap_(ss) {
  const sheet = ss.getSheetByName(SHEET_NAME_MENUS);

  if (!sheet) {
    throw new Error(SHEET_NAME_MENUS + ' シートが見つかりません。');
  }

  const values = sheet.getDataRange().getValues();
  const headers = getSheetHeaders_(values);
  const indexes = getMenuColumnIndexes_(headers);

  const map = {};

  for (let i = 1; i < values.length; i++) {
    const row = values[i];

    const category = String(row[indexes.category] || '').trim();
    const menuName = String(row[indexes.menu] || '').trim();
    const basePrice = Number(row[indexes.basePrice]);
    const sizeEnabled = toBoolean_(row[indexes.sizeEnabled]);
    const visible = toBoolean_(row[indexes.visible]);
    const order = Number(row[indexes.order]);

    if (!menuName) continue;

    map[menuName] = {
      category: category,
      basePrice: Number.isFinite(basePrice) ? basePrice : 0,
      sizeEnabled: sizeEnabled,
      visible: visible,
      order: Number.isFinite(order) ? order : 0
    };
  }

  return map;
}

function getSizeOptionMap_(ss) {
  const sheet = ss.getSheetByName(SHEET_NAME_SIZE_OPTIONS);

  if (!sheet) {
    throw new Error(SHEET_NAME_SIZE_OPTIONS + ' シートが見つかりません。');
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

function getMenusForJson_(ss) {
  const sheet = ss.getSheetByName(SHEET_NAME_MENUS);

  if (!sheet) {
    throw new Error(SHEET_NAME_MENUS + ' シートが見つかりません。');
  }

  const values = sheet.getDataRange().getValues();
  const headers = getSheetHeaders_(values);
  const indexes = getMenuColumnIndexes_(headers);

  const menus = [];

  for (let i = 1; i < values.length; i++) {
    const row = values[i];

    const category = String(row[indexes.category] || '').trim();
    const menuName = String(row[indexes.menu] || '').trim();
    const basePrice = Number(row[indexes.basePrice]);
    const sizeEnabled = toBoolean_(row[indexes.sizeEnabled]);
    const visible = toBoolean_(row[indexes.visible]);
    const order = Number(row[indexes.order]);

    if (!menuName) continue;

    menus.push({
      category: category,
      name: menuName,
      basePrice: Number.isFinite(basePrice) ? basePrice : 0,
      sizeEnabled: sizeEnabled,
      visible: visible,
      order: Number.isFinite(order) ? order : 0
    });
  }

  menus.sort(function(a, b) {
    return a.order - b.order;
  });

  return menus;
}

function getSizeOptionsForJson_(ss) {
  const sheet = ss.getSheetByName(SHEET_NAME_SIZE_OPTIONS);

  if (!sheet) {
    throw new Error(SHEET_NAME_SIZE_OPTIONS + ' シートが見つかりません。');
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

function getSheetHeaders_(values) {
  if (!values || values.length === 0) {
    return [];
  }

  return values[0].map(function(header) {
    return String(header || '').trim();
  });
}

function getMenuColumnIndexes_(headers) {
  return {
    category: getRequiredColumnIndex_(headers, '分類'),
    menu: getRequiredColumnIndex_(headers, 'メニュー'),
    basePrice: getRequiredColumnIndex_(headers, '基本単価'),
    sizeEnabled: getRequiredColumnIndex_(headers, 'サイズ変更対象'),
    visible: getRequiredColumnIndex_(headers, '表示'),
    order: getRequiredColumnIndex_(headers, '並び順')
  };
}

function getRequiredColumnIndex_(headers, headerName) {
  const index = headers.indexOf(headerName);

  if (index === -1) {
    throw new Error('列が見つかりません: ' + headerName);
  }

  return index;
}