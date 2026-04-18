window.addEventListener("DOMContentLoaded", function () {
  "use strict";

  var elements = {
    pageTitle: document.getElementById("pageTitle"),
    pageSubtitle: document.getElementById("pageSubtitle"),
    pagePeriod: document.getElementById("metaPeriod"),
    pageParticipants: document.getElementById("metaParticipants"),
    pageNote: document.getElementById("metaNote"),
    overview: document.getElementById("overview"),
    categoryFilters: document.getElementById("categoryFilters"),
    searchInput: document.getElementById("searchInput"),
    tableStatus: document.getElementById("tableStatus"),
    tableHost: document.getElementById("table"),
    printButton: document.getElementById("printButton"),
    clearFiltersButton: document.getElementById("clearFiltersButton")
  };

  var source = window.KOUTEI_DATA || {};
  var meta = source.meta || {};
  var rows = Array.isArray(source.itinerary) ? source.itinerary : [];
  var normalizedRows = rows
    .map(normalizeRow)
    .filter(function (row) {
      return row.date && row.title;
    })
    .sort(compareRows);

  var state = {
    table: null,
    categories: collectCategories(normalizedRows),
    activeCategory: "",
    searchTerm: ""
  };

  renderHeaderMeta(meta, normalizedRows, elements);
  setupPrintButton(elements.printButton);

  if (!normalizedRows.length) {
    renderEmptyState(elements.tableHost);
    hideElement(elements.overview);
    return;
  }

  renderOverview(buildSummary(normalizedRows), elements.overview);
  renderCategoryFilters(state.categories, elements.categoryFilters);
  bindControls(elements, state, normalizedRows);
  createTable(elements.tableHost, normalizedRows, state);
  updateTableFilters(state);
});

function createTable(host, rows, state) {
  if (!host) return;

  if (!window.Tabulator) {
    renderFallbackTable(host, rows);
    return;
  }

  state.table = new Tabulator(host, {
    data: rows,
    index: "id",
    layout: "fitColumns",
    responsiveLayout: "collapse",
    responsiveLayoutCollapseStartOpen: false,
    height: "auto",
    placeholder: "表示できる行程がありません",
    movableColumns: false,
    groupBy: "date",
    groupStartOpen: true,
    groupHeader: function (value, count, data) {
      var firstRow = data && data.length ? data[0] : null;
      var dayLabel = firstRow && firstRow.dayLabel ? " / " + firstRow.dayLabel : "";
      return (
        "<div class=\"group-header\">" +
        "<span class=\"group-header__date\">" +
        escapeHtml(firstRow ? firstRow.dateLabel : value) +
        "</span>" +
        "<span class=\"group-header__meta\">" +
        escapeHtml(count + "件" + dayLabel) +
        "</span>" +
        "</div>"
      );
    },
    columns: [
      {
        title: "日",
        field: "day_no",
        width: 72,
        hozAlign: "center",
        headerHozAlign: "center",
        formatter: function (cell) {
          var value = cell.getValue();
          return value ? escapeHtml(String(value)) : "-";
        }
      },
      {
        title: "時間",
        field: "timeRange",
        minWidth: 118,
        width: 128,
        formatter: "textarea"
      },
      {
        title: "区分",
        field: "category",
        minWidth: 108,
        width: 118,
        formatter: function (cell) {
          var row = cell.getRow().getData();
          return (
            "<span class=\"category-pill\">" +
            escapeHtml(row.category || "未設定") +
            "</span>"
          );
        }
      },
      {
        title: "内容",
        field: "title",
        minWidth: 240,
        widthGrow: 2,
        formatter: "textarea"
      },
      {
        title: "詳細",
        field: "detail",
        minWidth: 220,
        widthGrow: 2,
        formatter: "textarea"
      },
      {
        title: "距離",
        field: "distance",
        width: 110,
        hozAlign: "right",
        headerHozAlign: "right"
      },
      {
        title: "備考",
        field: "note",
        minWidth: 200,
        widthGrow: 2,
        formatter: "textarea"
      }
    ],
    rowFormatter: function (row) {
      var element = row.getElement();
      var data = row.getData();
      if (!element || !data) return;

      element.dataset.category = data.categoryKey || "other";
      element.classList.toggle("is-move-row", data.categoryKey === "move");
    },
    dataFiltered: function (filters, rowsAfterFilter) {
      updateTableStatus(state, rowsAfterFilter.length, filters.length);
    },
    dataLoaded: function (loadedRows) {
      updateTableStatus(state, loadedRows.length, 0);
    }
  });
}

function bindControls(elements, state, rows) {
  if (elements.searchInput) {
    elements.searchInput.addEventListener("input", function (event) {
      state.searchTerm = String(event.target.value || "").trim().toLowerCase();
      updateTableFilters(state);
    });
  }

  if (elements.categoryFilters) {
    elements.categoryFilters.addEventListener("click", function (event) {
      var button = event.target.closest("[data-category]");
      if (!button) return;

      var category = String(button.getAttribute("data-category") || "");
      state.activeCategory = category === state.activeCategory ? "" : category;
      syncCategoryButtons(elements.categoryFilters, state.activeCategory);
      updateTableFilters(state);
    });
  }

  if (elements.clearFiltersButton) {
    elements.clearFiltersButton.addEventListener("click", function () {
      state.activeCategory = "";
      state.searchTerm = "";

      if (elements.searchInput) {
        elements.searchInput.value = "";
      }

      syncCategoryButtons(elements.categoryFilters, "");
      updateTableFilters(state);
    });
  }

  updateTableStatus(state, rows.length, 0);
}

function updateTableFilters(state) {
  if (!state.table) {
    return;
  }

  var hasCategory = Boolean(state.activeCategory);
  var hasSearch = Boolean(state.searchTerm);

  if (!hasCategory && !hasSearch) {
    state.table.clearFilter(true);
    updateTableStatus(state, state.table.getDataCount("active"), 0);
    return;
  }

  state.table.setFilter(function (row) {
    var matchesCategory = !hasCategory || row.categoryKey === state.activeCategory;
    var matchesSearch = !hasSearch || row.searchText.indexOf(state.searchTerm) !== -1;
    return matchesCategory && matchesSearch;
  });

  updateTableStatus(
    state,
    state.table.getDataCount("active"),
    (hasCategory ? 1 : 0) + (hasSearch ? 1 : 0)
  );
}

function updateTableStatus(state, rowCount, filterCount) {
  var label = document.getElementById("tableStatus");
  if (!label) return;

  var filterText = filterCount ? " / 絞り込み中" : "";
  label.textContent = rowCount + " 件を表示" + filterText;
}

function renderHeaderMeta(meta, rows, elements) {
  var title = safeText(meta.title) || "行程一覧";
  var subtitle = safeText(meta.subtitle);
  var participants = safeText(meta.participants);
  var note = safeText(meta.note);
  var inferredPeriod = inferPeriod(rows);
  var start = normalizeDate(meta.period_start) || inferredPeriod.start;
  var end = normalizeDate(meta.period_end) || inferredPeriod.end;
  var periodText = buildPeriodText(start, end);

  if (elements.pageTitle) {
    elements.pageTitle.textContent = title;
    document.title = title;
  }

  toggleText(elements.pageSubtitle, subtitle);
  toggleText(elements.pagePeriod, periodText);
  toggleText(elements.pageParticipants, participants);
  toggleText(elements.pageNote, note);
}

function renderOverview(summary, container) {
  if (!container) return;

  var cards = [
    {
      label: "日数",
      value: summary.totalDays + "日",
      detail: summary.periodText || "-"
    },
    {
      label: "行程件数",
      value: summary.totalRows + "件",
      detail: "1日平均 " + formatAverage(summary.totalRows, summary.totalDays) + "件"
    },
    {
      label: "移動件数",
      value: summary.moveCount + "件",
      detail: summary.moveDuration ? "移動時間 " + formatDuration(summary.moveDuration) : "移動時間の記載なし"
    },
    {
      label: "総移動距離",
      value: summary.distanceCount ? formatDistance(summary.totalDistance) : "-",
      detail: summary.distanceCount ? summary.distanceCount + "件に距離情報あり" : "距離情報なし"
    }
  ];

  container.innerHTML = cards
    .map(function (card) {
      return (
        "<article class=\"overview-card\">" +
        "<p class=\"overview-label\">" + escapeHtml(card.label) + "</p>" +
        "<p class=\"overview-value\">" + escapeHtml(card.value) + "</p>" +
        "<p class=\"overview-detail\">" + escapeHtml(card.detail) + "</p>" +
        "</article>"
      );
    })
    .join("");

  showElement(container);
}

function renderCategoryFilters(categories, container) {
  if (!container) return;

  container.innerHTML = categories
    .map(function (category) {
      return (
        "<button type=\"button\" class=\"filter-chip\" data-category=\"" +
        escapeHtml(category.key) +
        "\" aria-pressed=\"false" +
        "\">" +
        escapeHtml(category.label) +
        "</button>"
      );
    })
    .join("");
}

function syncCategoryButtons(container, activeCategory) {
  if (!container) return;

  Array.prototype.forEach.call(
    container.querySelectorAll("[data-category]"),
    function (button) {
      var isActive = button.getAttribute("data-category") === activeCategory;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", isActive ? "true" : "false");
    }
  );
}

function renderEmptyState(container) {
  if (!container) return;

  container.innerHTML =
    "<div class=\"empty-state\">" +
    "<strong>表示できる行程データがありません</strong>" +
    "<p>data/itinerary.js の内容を確認してください。</p>" +
    "</div>";
}

function renderFallbackTable(container, rows) {
  var header = [
    "日",
    "日付",
    "時間",
    "区分",
    "内容",
    "詳細",
    "距離",
    "備考"
  ];

  var body = rows
    .map(function (row) {
      return (
        "<tr>" +
        "<td>" + escapeHtml(row.day_no || "-") + "</td>" +
        "<td>" + escapeHtml(row.dateLabel) + "</td>" +
        "<td>" + escapeHtml(row.timeRange) + "</td>" +
        "<td>" + escapeHtml(row.category) + "</td>" +
        "<td>" + escapeHtml(row.title) + "</td>" +
        "<td>" + escapeHtml(row.detail) + "</td>" +
        "<td>" + escapeHtml(row.distance) + "</td>" +
        "<td>" + escapeHtml(row.note) + "</td>" +
        "</tr>"
      );
    })
    .join("");

  container.innerHTML =
    "<div class=\"fallback-note\">Tabulator を読み込めなかったため簡易一覧を表示しています。</div>" +
    "<table class=\"fallback-table\"><thead><tr>" +
    header
      .map(function (item) {
        return "<th>" + escapeHtml(item) + "</th>";
      })
      .join("") +
    "</tr></thead><tbody>" +
    body +
    "</tbody></table>";
}

function normalizeRow(item, index) {
  if (!item) return null;

  var date = normalizeDate(item.date);
  if (!date) return null;

  var startTime = normalizeTime(item.start_time);
  var endTime = normalizeTime(item.end_time);
  var category = safeText(item.category) || "未設定";
  var categoryKey = normalizeCategoryKey(category);
  var title = safeText(item.title);

  if (!title) return null;

  return {
    id: safeText(item.schedule_id) || String(index + 1),
    day_no: safeText(item.day_no),
    dayLabel: item.day_no ? "Day " + safeText(item.day_no) : "",
    date: date,
    dateLabel: formatJapaneseDate(date),
    start_time: startTime,
    end_time: endTime,
    timeRange: buildTimeRange(startTime, endTime),
    category: category,
    categoryKey: categoryKey,
    title: title,
    detail: safeText(item.detail),
    distance: safeText(item.distance),
    note: safeText(item.note),
    sortOrder: toNumber(item.sort_order),
    searchText: [
      safeText(item.day_no),
      date,
      category,
      title,
      safeText(item.detail),
      safeText(item.distance),
      safeText(item.note)
    ]
      .join(" ")
      .toLowerCase()
  };
}

function compareRows(a, b) {
  var dateCompare = a.date.localeCompare(b.date);
  if (dateCompare !== 0) return dateCompare;

  var timeCompare = compareTime(a.start_time, b.start_time);
  if (timeCompare !== 0) return timeCompare;

  var sortCompare = a.sortOrder - b.sortOrder;
  if (sortCompare !== 0) return sortCompare;

  return a.id.localeCompare(b.id);
}

function compareTime(a, b) {
  var aValue = parseTimeToMinutes(a);
  var bValue = parseTimeToMinutes(b);

  if (aValue == null && bValue == null) return 0;
  if (aValue == null) return 1;
  if (bValue == null) return -1;
  return aValue - bValue;
}

function buildSummary(rows) {
  var daySet = new Set();
  var moveCount = 0;
  var moveDuration = 0;
  var totalDistance = 0;
  var distanceCount = 0;

  rows.forEach(function (row) {
    daySet.add(row.date);

    if (row.categoryKey === "move") {
      moveCount += 1;
      moveDuration += getDurationMinutes(row.start_time, row.end_time);
    }

    var distanceValue = parseDistance(row.distance);
    if (distanceValue != null) {
      totalDistance += distanceValue;
      distanceCount += 1;
    }
  });

  return {
    totalDays: daySet.size,
    totalRows: rows.length,
    moveCount: moveCount,
    moveDuration: moveDuration,
    totalDistance: totalDistance,
    distanceCount: distanceCount,
    periodText: buildPeriodText(rows[0] && rows[0].date, rows.length ? rows[rows.length - 1].date : "")
  };
}

function collectCategories(rows) {
  var seen = new Map();

  rows.forEach(function (row) {
    if (!seen.has(row.categoryKey)) {
      seen.set(row.categoryKey, {
        key: row.categoryKey,
        label: row.category
      });
    }
  });

  return Array.from(seen.values()).sort(function (a, b) {
    return a.label.localeCompare(b.label, "ja");
  });
}

function inferPeriod(rows) {
  if (!rows.length) {
    return { start: "", end: "" };
  }

  return {
    start: rows[0].date,
    end: rows[rows.length - 1].date
  };
}

function setupPrintButton(button) {
  if (!button) return;

  if (typeof window.print !== "function") {
    button.hidden = true;
    return;
  }

  button.addEventListener("click", function () {
    window.print();
  });
}

function buildTimeRange(start, end) {
  if (start && end) return start + " - " + end;
  if (start) return start + " -";
  if (end) return "- " + end;
  return "-";
}

function normalizeCategoryKey(category) {
  var text = String(category || "").toLowerCase();

  if (text.indexOf("移動") !== -1 || text.indexOf("move") !== -1) {
    return "move";
  }

  if (text.indexOf("食") !== -1 || text.indexOf("meal") !== -1) {
    return "meal";
  }

  if (text.indexOf("宿") !== -1 || text.indexOf("hotel") !== -1) {
    return "stay";
  }

  if (text.indexOf("視") !== -1 || text.indexOf("察") !== -1 || text.indexOf("meeting") !== -1) {
    return "visit";
  }

  return buildCategoryKey(text);
}

function buildCategoryKey(value) {
  var source = String(value || "").trim();
  if (!source) return "other";

  var ascii = source
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (ascii) {
    return ascii;
  }

  return (
    "cat-" +
    Array.from(source)
      .map(function (char) {
        return char.charCodeAt(0).toString(16);
      })
      .join("-")
  );
}

function normalizeDate(value) {
  var text = safeText(value).replace(/\./g, "/").replace(/-/g, "/");
  if (!text) return "";

  var match = text.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!match) return "";

  var year = match[1];
  var month = match[2].padStart(2, "0");
  var day = match[3].padStart(2, "0");
  return year + "-" + month + "-" + day;
}

function normalizeTime(value) {
  var text = safeText(value);
  if (!text) return "";

  var match = text.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return "";

  return match[1].padStart(2, "0") + ":" + match[2];
}

function parseTimeToMinutes(value) {
  if (!value) return null;
  var parts = String(value).split(":");
  if (parts.length !== 2) return null;

  var hours = Number(parts[0]);
  var minutes = Number(parts[1]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;

  return hours * 60 + minutes;
}

function getDurationMinutes(start, end) {
  var startMinutes = parseTimeToMinutes(start);
  var endMinutes = parseTimeToMinutes(end);

  if (startMinutes == null || endMinutes == null || endMinutes < startMinutes) {
    return 0;
  }

  return endMinutes - startMinutes;
}

function parseDistance(value) {
  var match = String(value || "").replace(/,/g, "").match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;

  var parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildPeriodText(start, end) {
  if (!start && !end) return "";
  if (start && end && start !== end) {
    return formatJapaneseDate(start) + " - " + formatJapaneseDate(end);
  }

  return formatJapaneseDate(start || end);
}

function formatJapaneseDate(value) {
  if (!value) return "";

  var date = new Date(value + "T00:00:00");
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short"
  }).format(date);
}

function formatDuration(minutes) {
  if (!minutes) return "0分";
  var hours = Math.floor(minutes / 60);
  var remain = minutes % 60;

  if (!hours) return remain + "分";
  if (!remain) return hours + "時間";
  return hours + "時間" + remain + "分";
}

function formatDistance(value) {
  if (!Number.isFinite(value)) return "-";
  return value.toLocaleString("ja-JP", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1
  }) + "km";
}

function formatAverage(total, count) {
  if (!count) return "0.0";
  return (Math.round((total / count) * 10) / 10).toFixed(1);
}

function toNumber(value) {
  var parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

function safeText(value) {
  return String(value == null ? "" : value).trim();
}

function toggleText(element, value) {
  if (!element) return;
  if (value) {
    element.textContent = value;
    element.hidden = false;
  } else {
    element.textContent = "";
    element.hidden = true;
  }
}

function hideElement(element) {
  if (element) {
    element.hidden = true;
  }
}

function showElement(element) {
  if (element) {
    element.hidden = false;
  }
}

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
