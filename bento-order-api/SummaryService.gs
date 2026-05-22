function rebuildSummaries() {
  var adminRows = getAdminRows_();
  var departmentMap = {};
  var totalMap = {};

  adminRows.forEach(function (row) {
    if (sanitizeText(row['ステータス']) !== BENTO_STATUS.ACTIVE) return;

    var deliveryDate = formatDate(row['受取日']);
    var department = sanitizeText(row['担当部署']);
    var menu = sanitizeText(row['メニュー']);
    var unitPrice = Number(row['単価']) || 0;
    var quantity = Number(row['個数']) || 0;
    var subtotal = Number(row['小計']) || unitPrice * quantity;
    var departmentKey = [deliveryDate, department, menu, unitPrice].join('|');
    var totalKey = [deliveryDate, menu, unitPrice].join('|');

    if (!departmentMap[departmentKey]) {
      departmentMap[departmentKey] = {
        deliveryDate: deliveryDate,
        department: department,
        menu: menu,
        unitPrice: unitPrice,
        totalQuantity: 0,
        totalAmount: 0
      };
    }
    if (!totalMap[totalKey]) {
      totalMap[totalKey] = {
        deliveryDate: deliveryDate,
        menu: menu,
        unitPrice: unitPrice,
        totalQuantity: 0,
        totalAmount: 0
      };
    }

    departmentMap[departmentKey].totalQuantity += quantity;
    departmentMap[departmentKey].totalAmount += subtotal;
    totalMap[totalKey].totalQuantity += quantity;
    totalMap[totalKey].totalAmount += subtotal;
  });

  var departmentRows = Object.keys(departmentMap)
    .map(function (key) {
      return departmentMap[key];
    })
    .sort(function (a, b) {
      return [a.deliveryDate, a.department, a.menu].join('|').localeCompare(
        [b.deliveryDate, b.department, b.menu].join('|'),
        'ja'
      );
    })
    .map(function (row) {
      return [
        row.deliveryDate,
        row.department,
        row.menu,
        row.unitPrice,
        row.totalQuantity,
        row.totalAmount
      ];
    });

  var totalRows = Object.keys(totalMap)
    .map(function (key) {
      return totalMap[key];
    })
    .sort(function (a, b) {
      return [a.deliveryDate, a.menu].join('|').localeCompare(
        [b.deliveryDate, b.menu].join('|'),
        'ja'
      );
    })
    .map(function (row) {
      return [
        row.deliveryDate,
        row.menu,
        row.unitPrice,
        row.totalQuantity,
        row.totalAmount
      ];
    });

  overwriteSheet_(BENTO_SHEET_NAMES.summaryDepartment, BENTO_HEADERS.summaryDepartment, departmentRows);
  overwriteSheet_(BENTO_SHEET_NAMES.summaryTotal, BENTO_HEADERS.summaryTotal, totalRows);
}

function getSummaries() {
  return {
    department: getSummaryDepartmentForApi_(),
    total: getSummaryTotalForApi_()
  };
}

function getSummaryDepartmentForApi_() {
  var rows = readObjects_(BENTO_SHEET_NAMES.summaryDepartment, BENTO_HEADERS.summaryDepartment);
  return rows.map(function (row) {
    return {
      deliveryDate: formatDate(row['受取日']),
      department: sanitizeText(row['担当部署']),
      menuName: sanitizeText(row['メニュー']),
      unitPrice: Number(row['単価']) || 0,
      totalQuantity: Number(row['合計個数']) || 0,
      totalAmount: Number(row['合計金額']) || 0
    };
  });
}

function getSummaryTotalForApi_() {
  var rows = readObjects_(BENTO_SHEET_NAMES.summaryTotal, BENTO_HEADERS.summaryTotal);
  return rows.map(function (row) {
    return {
      deliveryDate: formatDate(row['受取日']),
      menuName: sanitizeText(row['メニュー']),
      unitPrice: Number(row['単価']) || 0,
      totalQuantity: Number(row['合計個数']) || 0,
      totalAmount: Number(row['合計金額']) || 0
    };
  });
}
