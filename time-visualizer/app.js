(function () {
  "use strict";

  var MAX_FILES = 100;
  var records = [];
  var importedFiles = [];
  var els = {};
  var weekdayLabels = ["日", "月", "火", "水", "木", "金", "土"];

  document.addEventListener("DOMContentLoaded", function () {
    cacheElements();
    bindEvents();
    render();
  });

  function cacheElements() {
    els.csvInput = document.getElementById("csvInput");
    els.clearButton = document.getElementById("clearButton");
    els.messagePanel = document.getElementById("messagePanel");
    els.fileCount = document.getElementById("fileCount");
    els.recordCount = document.getElementById("recordCount");
    els.fromDate = document.getElementById("fromDate");
    els.toDate = document.getElementById("toDate");
    els.categoryFilter = document.getElementById("categoryFilter");
    els.statusFilter = document.getElementById("statusFilter");
    els.totalWork = document.getElementById("totalWork");
    els.totalPause = document.getElementById("totalPause");
    els.dailyAverage = document.getElementById("dailyAverage");
    els.topCategory = document.getElementById("topCategory");
    els.dailyRangeLabel = document.getElementById("dailyRangeLabel");
    els.dailyChart = document.getElementById("dailyChart");
    els.categoryChart = document.getElementById("categoryChart");
    els.weekdayChart = document.getElementById("weekdayChart");
    els.statusChart = document.getElementById("statusChart");
    els.categoryTableCount = document.getElementById("categoryTableCount");
    els.categoryTable = document.getElementById("categoryTable");
    els.logTableCount = document.getElementById("logTableCount");
    els.logTable = document.getElementById("logTable");
  }

  function bindEvents() {
    els.csvInput.addEventListener("change", handleFiles);
    els.clearButton.addEventListener("click", clearData);
    els.fromDate.addEventListener("change", render);
    els.toDate.addEventListener("change", render);
    els.categoryFilter.addEventListener("change", render);
    els.statusFilter.addEventListener("change", render);
  }

  function handleFiles(event) {
    var files = Array.prototype.slice.call(event.target.files || []);
    hideMessage();

    if (!files.length) {
      return;
    }
    if (files.length > MAX_FILES) {
      showMessage("CSVファイルは100個まで選択できます。", true);
      els.csvInput.value = "";
      return;
    }

    Promise.all(files.map(readFileAsText)).then(function (fileTexts) {
      var nextRecords = [];
      var errors = [];

      fileTexts.forEach(function (item) {
        try {
          var parsed = parseTimeTrackerCsv(item.text, item.name);
          nextRecords = nextRecords.concat(parsed);
        } catch (error) {
          errors.push(item.name + ": " + error.message);
        }
      });

      records = normalizeRecords(nextRecords);
      importedFiles = files.map(function (file) {
        return file.name;
      });

      applyInitialDateRange();
      populateCategoryFilter();
      render();

      if (errors.length) {
        showMessage("一部のCSVを読み込めませんでした。 " + errors.join(" / "), true);
      } else {
        showMessage(records.length + "件のログを読み込みました。", false);
      }
    }).catch(function (error) {
      showMessage("CSVの読み込みに失敗しました。 " + error.message, true);
    }).finally(function () {
      els.csvInput.value = "";
    });
  }

  function readFileAsText(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        resolve({
          name: file.name,
          text: String(reader.result || "")
        });
      };
      reader.onerror = function () {
        reject(new Error(file.name + " を読み込めませんでした。"));
      };
      reader.readAsText(file, "utf-8");
    });
  }

  function parseTimeTrackerCsv(text, fileName) {
    var cleaned = String(text || "").replace(/^\uFEFF/, "");
    var rows = parseCsv(cleaned);
    if (!rows.length) {
      return [];
    }

    var header = rows[0].map(function (name) {
      return String(name || "").trim();
    });
    var required = ["log_id", "work_date", "work_category", "work_category_custom", "started_at", "ended_at", "work_minutes", "pause_minutes", "status"];
    var indexes = {};

    required.forEach(function (column) {
      indexes[column] = header.indexOf(column);
    });

    if (indexes.log_id === -1 || indexes.work_date === -1 || indexes.work_category === -1) {
      throw new Error("time-tracker形式のCSVではありません。");
    }

    return rows.slice(1).filter(function (row) {
      return row.some(function (cell) {
        return String(cell || "").trim() !== "";
      });
    }).map(function (row, rowIndex) {
      var record = {};
      required.forEach(function (column) {
        var index = indexes[column];
        record[column] = index >= 0 ? String(row[index] || "").trim() : "";
      });
      record.source_file = fileName;
      record.source_row = rowIndex + 2;
      return record;
    });
  }

  function parseCsv(text) {
    var rows = [];
    var row = [];
    var cell = "";
    var inQuotes = false;

    for (var i = 0; i < text.length; i += 1) {
      var char = text.charAt(i);
      var next = text.charAt(i + 1);

      if (inQuotes) {
        if (char === '"' && next === '"') {
          cell += '"';
          i += 1;
        } else if (char === '"') {
          inQuotes = false;
        } else {
          cell += char;
        }
      } else if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        row.push(cell);
        cell = "";
      } else if (char === "\r") {
        if (next === "\n") {
          i += 1;
        }
        row.push(cell);
        rows.push(row);
        row = [];
        cell = "";
      } else if (char === "\n") {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = "";
      } else {
        cell += char;
      }
    }

    row.push(cell);
    rows.push(row);
    return rows;
  }

  function normalizeRecords(rawRecords) {
    return rawRecords.map(function (record) {
      var category = record.work_category || "";
      var custom = record.work_category_custom || "";
      var displayCategory = category === "その他" && custom ? "その他：" + custom : category;
      var workMinutes = toNumber(record.work_minutes);
      var pauseMinutes = toNumber(record.pause_minutes);
      var startedDate = parseDateTime(record.started_at);
      var endedDate = parseDateTime(record.ended_at);
      var workDate = record.work_date || formatDate(startedDate);

      return {
        log_id: record.log_id,
        work_date: workDate,
        work_category: category,
        work_category_custom: custom,
        display_category: displayCategory || "未分類",
        started_at: record.started_at,
        ended_at: record.ended_at,
        work_minutes: workMinutes,
        pause_minutes: pauseMinutes,
        status: record.status || "",
        source_file: record.source_file,
        source_row: record.source_row,
        started_time: safeTime(startedDate),
        ended_time: safeTime(endedDate)
      };
    }).filter(function (record) {
      return record.log_id || record.work_date || record.display_category !== "未分類";
    });
  }

  function clearData() {
    records = [];
    importedFiles = [];
    els.fromDate.value = "";
    els.toDate.value = "";
    els.categoryFilter.value = "";
    els.statusFilter.value = "";
    populateCategoryFilter();
    hideMessage();
    render();
  }

  function applyInitialDateRange() {
    var dates = records.map(function (record) {
      return record.work_date;
    }).filter(Boolean).sort();
    els.fromDate.value = dates[0] || "";
    els.toDate.value = dates[dates.length - 1] || "";
  }

  function populateCategoryFilter() {
    var current = els.categoryFilter.value;
    var categories = unique(records.map(function (record) {
      return record.display_category;
    })).sort();

    els.categoryFilter.innerHTML = '<option value="">すべて</option>' + categories.map(function (category) {
      return '<option value="' + escapeHtml(category) + '">' + escapeHtml(category) + "</option>";
    }).join("");

    if (categories.indexOf(current) >= 0) {
      els.categoryFilter.value = current;
    }
  }

  function render() {
    var filtered = getFilteredRecords();
    var categorySummary = summarizeBy(filtered, "display_category", "work_minutes");
    var dailySummary = summarizeBy(filtered, "work_date", "work_minutes");

    els.fileCount.textContent = String(importedFiles.length);
    els.recordCount.textContent = String(filtered.length);
    renderSummary(filtered, categorySummary, dailySummary);
    renderDailyChart(dailySummary);
    renderCategoryChart(categorySummary);
    renderWeekdayChart(filtered);
    renderStatusChart(filtered);
    renderCategoryTable(categorySummary, filtered);
    renderLogTable(filtered);
  }

  function getFilteredRecords() {
    var from = els.fromDate.value;
    var to = els.toDate.value;
    var category = els.categoryFilter.value;
    var status = els.statusFilter.value;

    return records.filter(function (record) {
      if (from && record.work_date < from) {
        return false;
      }
      if (to && record.work_date > to) {
        return false;
      }
      if (category && record.display_category !== category) {
        return false;
      }
      if (status && record.status !== status) {
        return false;
      }
      return true;
    });
  }

  function renderSummary(filtered, categorySummary, dailySummary) {
    var totalWork = sum(filtered, "work_minutes");
    var totalPause = sum(filtered, "pause_minutes");
    var activeDays = Object.keys(dailySummary).length;
    var top = Object.keys(categorySummary).sort(function (a, b) {
      return categorySummary[b] - categorySummary[a];
    })[0];

    els.totalWork.textContent = formatMinutes(totalWork);
    els.totalPause.textContent = formatMinutes(totalPause);
    els.dailyAverage.textContent = activeDays ? formatMinutes(Math.round(totalWork / activeDays)) : "0時間00分";
    els.topCategory.textContent = top ? top + "（" + formatMinutes(categorySummary[top]) + "）" : "-";
  }

  function renderDailyChart(summary) {
    var dates = Object.keys(summary).sort();
    if (!dates.length) {
      els.dailyRangeLabel.textContent = "-";
      els.dailyChart.innerHTML = '<div class="empty-state">日別データはありません。</div>';
      return;
    }

    var max = Math.max.apply(null, dates.map(function (date) {
      return summary[date];
    }));

    els.dailyRangeLabel.textContent = dates[0] + " 〜 " + dates[dates.length - 1];
    els.dailyChart.innerHTML = dates.map(function (date) {
      var minutes = summary[date];
      var height = max ? Math.max(4, Math.round((minutes / max) * 250)) : 4;
      return '<div class="daily-column" title="' + escapeHtml(date + " " + formatMinutes(minutes)) + '">' +
        '<div class="daily-bar" style="height:' + height + 'px"></div>' +
        '<div class="daily-label">' + escapeHtml(date.slice(5)) + '</div>' +
        "</div>";
    }).join("");
  }

  function renderCategoryChart(summary) {
    var entries = objectEntries(summary).sort(function (a, b) {
      return b.value - a.value;
    }).slice(0, 12);
    renderBarList(els.categoryChart, entries, false);
  }

  function renderWeekdayChart(filtered) {
    var summary = {};
    weekdayLabels.forEach(function (label) {
      summary[label] = 0;
    });
    filtered.forEach(function (record) {
      var date = parseDate(record.work_date);
      var label = isFinite(date.getTime()) ? weekdayLabels[date.getDay()] : "不明";
      summary[label] = (summary[label] || 0) + record.work_minutes;
    });
    var entries = weekdayLabels.map(function (label) {
      return {
        key: label,
        value: summary[label] || 0
      };
    });
    renderBarList(els.weekdayChart, entries, true);
  }

  function renderBarList(container, entries, compact) {
    var max = entries.reduce(function (currentMax, item) {
      return Math.max(currentMax, item.value);
    }, 0);

    if (!entries.length || max === 0) {
      container.innerHTML = '<div class="empty-state">表示できるデータはありません。</div>';
      return;
    }

    container.innerHTML = entries.map(function (item) {
      var width = max ? Math.max(2, Math.round((item.value / max) * 100)) : 0;
      return '<div class="bar-row ' + (compact ? "compact-label" : "") + '">' +
        '<div class="bar-name" title="' + escapeHtml(item.key) + '">' + escapeHtml(item.key) + '</div>' +
        '<div class="bar-track"><div class="bar-fill" style="width:' + width + '%"></div></div>' +
        '<div class="bar-value">' + escapeHtml(formatMinutes(item.value)) + '</div>' +
        "</div>";
    }).join("");
  }

  function renderStatusChart(filtered) {
    var summary = {};
    filtered.forEach(function (record) {
      summary[record.status || "unknown"] = (summary[record.status || "unknown"] || 0) + 1;
    });
    var statuses = ["done", "working", "paused", "unknown"];
    var html = statuses.filter(function (status) {
      return summary[status];
    }).map(function (status) {
      return '<div class="status-item">' +
        '<span class="status-badge ' + escapeHtml(status) + '">' + escapeHtml(statusLabel(status)) + '</span>' +
        '<strong>' + escapeHtml(summary[status]) + '件</strong>' +
        "</div>";
    }).join("");
    els.statusChart.innerHTML = html || '<div class="empty-state">表示できるデータはありません。</div>';
  }

  function renderCategoryTable(summary, filtered) {
    var pauseSummary = summarizeBy(filtered, "display_category", "pause_minutes");
    var countSummary = countBy(filtered, "display_category");
    var totalWork = sum(filtered, "work_minutes");
    var entries = objectEntries(summary).sort(function (a, b) {
      return b.value - a.value;
    });
    els.categoryTableCount.textContent = entries.length + "件";

    if (!entries.length) {
      els.categoryTable.innerHTML = '<div class="empty-state">カテゴリ集計はありません。</div>';
      return;
    }

    var rows = entries.map(function (item) {
      var share = totalWork ? Math.round((item.value / totalWork) * 10) / 10 : 0;
      var count = countSummary[item.key] || 0;
      var average = count ? Math.round(item.value / count) : 0;
      return "<tr>" +
        "<td>" + escapeHtml(item.key) + "</td>" +
        "<td>" + escapeHtml(String(count)) + "件</td>" +
        "<td>" + escapeHtml(formatMinutes(item.value)) + "</td>" +
        "<td>" + escapeHtml(formatMinutes(pauseSummary[item.key] || 0)) + "</td>" +
        "<td>" + escapeHtml(formatMinutes(average)) + "</td>" +
        "<td>" + escapeHtml(String(share)) + "%</td>" +
        "</tr>";
    }).join("");

    els.categoryTable.innerHTML = '<table><thead><tr><th>カテゴリ</th><th>件数</th><th>実作業時間</th><th>停止時間</th><th>1件平均</th><th>構成比</th></tr></thead><tbody>' + rows + "</tbody></table>";
  }

  function renderLogTable(filtered) {
    var sorted = filtered.slice().sort(function (a, b) {
      return (b.started_time || 0) - (a.started_time || 0);
    }).slice(0, 100);
    els.logTableCount.textContent = "最新" + sorted.length + "件 / 対象" + filtered.length + "件";

    if (!sorted.length) {
      els.logTable.innerHTML = '<div class="empty-state">読み込みログはありません。</div>';
      return;
    }

    var rows = sorted.map(function (record) {
      return "<tr>" +
        "<td>" + escapeHtml(record.work_date || "") + "</td>" +
        "<td>" + escapeHtml(timeRange(record)) + "</td>" +
        "<td>" + escapeHtml(record.display_category) + "</td>" +
        '<td><span class="status-badge ' + escapeHtml(record.status) + '">' + escapeHtml(statusLabel(record.status)) + "</span></td>" +
        "<td>" + escapeHtml(formatMinutes(record.work_minutes)) + "</td>" +
        "<td>" + escapeHtml(formatMinutes(record.pause_minutes)) + "</td>" +
        "<td>" + escapeHtml(record.source_file || "") + "</td>" +
        "</tr>";
    }).join("");

    els.logTable.innerHTML = '<table><thead><tr><th>日付</th><th>時間帯</th><th>カテゴリ</th><th>状態</th><th>実作業</th><th>停止</th><th>読込元</th></tr></thead><tbody>' + rows + "</tbody></table>";
  }

  function summarizeBy(list, key, valueKey) {
    return list.reduce(function (summary, item) {
      var group = item[key] || "未分類";
      summary[group] = (summary[group] || 0) + (Number(item[valueKey]) || 0);
      return summary;
    }, {});
  }

  function countBy(list, key) {
    return list.reduce(function (summary, item) {
      var group = item[key] || "未分類";
      summary[group] = (summary[group] || 0) + 1;
      return summary;
    }, {});
  }

  function sum(list, key) {
    return list.reduce(function (total, item) {
      return total + (Number(item[key]) || 0);
    }, 0);
  }

  function objectEntries(object) {
    return Object.keys(object).map(function (key) {
      return {
        key: key,
        value: object[key]
      };
    });
  }

  function unique(values) {
    return values.filter(function (value, index, array) {
      return value && array.indexOf(value) === index;
    });
  }

  function toNumber(value) {
    var number = Number(value);
    return isFinite(number) && number > 0 ? number : 0;
  }

  function parseDate(value) {
    var parts = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!parts) {
      return new Date(NaN);
    }
    return new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]));
  }

  function parseDateTime(value) {
    var parts = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
    if (!parts) {
      return new Date(NaN);
    }
    return new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]), Number(parts[4]), Number(parts[5]), Number(parts[6]));
  }

  function safeTime(date) {
    var time = date instanceof Date ? date.getTime() : NaN;
    return isFinite(time) ? time : 0;
  }

  function formatDate(date) {
    if (!isFinite(date.getTime())) {
      return "";
    }
    return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
  }

  function formatMinutes(minutes) {
    var safe = Math.max(0, Math.round(Number(minutes) || 0));
    var hours = Math.floor(safe / 60);
    var mins = safe % 60;
    return hours + "時間" + pad(mins) + "分";
  }

  function timeRange(record) {
    var start = record.started_at ? record.started_at.slice(11, 16) : "--:--";
    var end = record.ended_at ? record.ended_at.slice(11, 16) : "--:--";
    return start + " - " + end;
  }

  function statusLabel(status) {
    if (status === "done") {
      return "終了済み";
    }
    if (status === "working") {
      return "作業中";
    }
    if (status === "paused") {
      return "一時停止中";
    }
    return "不明";
  }

  function showMessage(message, isError) {
    els.messagePanel.hidden = false;
    els.messagePanel.className = "message-panel" + (isError ? " error" : "");
    els.messagePanel.textContent = message;
  }

  function hideMessage() {
    els.messagePanel.hidden = true;
    els.messagePanel.textContent = "";
  }

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function escapeHtml(value) {
    return String(value === null || typeof value === "undefined" ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
})();
