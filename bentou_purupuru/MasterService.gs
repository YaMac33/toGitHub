// ==============================
// menus / size_options 読み取り
// ==============================

function getMenuMap_(ss) {
  const sheet = ss.getSheetByName(SHEET_NAME_MENUS);

  if (!sheet) {
    throw new Error(SHEET_NAME_MENUS + ' シートが見つかりません。');
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