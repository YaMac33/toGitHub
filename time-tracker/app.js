(function () {
  "use strict";

  var STORAGE_KEY = "workTimeLogs";
  var categories = ["会議", "打合せ", "議会対応", "窓口対応", "電話対応", "資料作成", "作業", "訪問", "現場", "その他"];
  var shortcutMap = {
    "1": "会議",
    "2": "打合せ",
    "3": "議会対応",
    "4": "窓口対応",
    "5": "電話対応",
    "6": "資料作成",
    "7": "作業",
    "8": "訪問",
    "9": "現場",
    "0": "その他"
  };
  var timerId = null;

  var els = {};

  document.addEventListener("DOMContentLoaded", function () {
    cacheElements();
    buildCategoryButtons();
    bindEvents();
    renderFromStorage();
    startTimer();
  });

  function cacheElements() {
    els.todayDate = document.getElementById("todayDate");
    els.categoryButtons = document.getElementById("categoryButtons");
    els.otherInputPanel = document.getElementById("otherInputPanel");
    els.otherCategoryInput = document.getElementById("otherCategoryInput");
    els.otherStartButton = document.getElementById("otherStartButton");
    els.otherCancelButton = document.getElementById("otherCancelButton");
    els.otherError = document.getElementById("otherError");
    els.currentPanel = document.getElementById("currentPanel");
    els.statusBadge = document.getElementById("statusBadge");
    els.currentEmpty = document.getElementById("currentEmpty");
    els.currentDetails = document.getElementById("currentDetails");
    els.currentCategory = document.getElementById("currentCategory");
    els.currentStart = document.getElementById("currentStart");
    els.currentStatus = document.getElementById("currentStatus");
    els.currentWorkTime = document.getElementById("currentWorkTime");
    els.currentPauseTime = document.getElementById("currentPauseTime");
    els.currentTotalTime = document.getElementById("currentTotalTime");
    els.pauseButton = document.getElementById("pauseButton");
    els.resumeButton = document.getElementById("resumeButton");
    els.endButton = document.getElementById("endButton");
    els.todayList = document.getElementById("todayList");
    els.todayCount = document.getElementById("todayCount");
    els.historyList = document.getElementById("historyList");
    els.historyCount = document.getElementById("historyCount");
    els.csvButton = document.getElementById("csvButton");
    els.deleteButton = document.getElementById("deleteButton");
  }

  function buildCategoryButtons() {
    els.categoryButtons.innerHTML = "";
    categories.forEach(function (category, index) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "category-button";
      button.dataset.category = category;
      button.innerHTML = '<span class="category-shortcut">' + (index === 9 ? "0" : String(index + 1)) + "</span>" + escapeHtml(category);
      button.addEventListener("click", function () {
        handleCategorySelect(category);
      });
      els.categoryButtons.appendChild(button);
    });
  }

  function bindEvents() {
    els.otherStartButton.addEventListener("click", startOtherCategory);
    els.otherCancelButton.addEventListener("click", hideOtherInput);
    els.otherCategoryInput.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        startOtherCategory();
      }
    });
    els.pauseButton.addEventListener("click", pauseCurrentLog);
    els.resumeButton.addEventListener("click", resumeCurrentLog);
    els.endButton.addEventListener("click", endCurrentLog);
    els.csvButton.addEventListener("click", exportCsv);
    els.deleteButton.addEventListener("click", deleteAllData);
    document.addEventListener("keydown", handleShortcut);
  }

  // localStorage 読み込み。空や壊れたJSONでも安全に空配列へ戻す。
  function loadLogs() {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    try {
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      localStorage.setItem(STORAGE_KEY, "[]");
      return [];
    }
  }

  // localStorage 書き込み。保存形式はログオブジェクト配列。
  function saveLogs(logs) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
  }

  function renderFromStorage() {
    var logs = loadLogs();
    var current = getCurrentLog(logs);
    renderToday();
    renderCurrent(current);
    renderControls(current);
    renderTodayLogs(logs);
    renderHistory(logs);
  }

  function renderToday() {
    els.todayDate.textContent = formatDate(new Date());
  }

  function handleCategorySelect(category) {
    if (category === "その他") {
      showOtherInput();
      return;
    }
    startLog(category, "");
  }

  function showOtherInput() {
    els.otherInputPanel.hidden = false;
    els.otherError.textContent = "";
    els.otherCategoryInput.value = "";
    window.setTimeout(function () {
      els.otherCategoryInput.focus();
    }, 0);
  }

  function hideOtherInput() {
    els.otherInputPanel.hidden = true;
    els.otherError.textContent = "";
    els.otherCategoryInput.value = "";
  }

  function startOtherCategory() {
    var custom = els.otherCategoryInput.value.trim();
    if (!custom) {
      els.otherError.textContent = "その他のカテゴリ名を入力してください";
      els.otherCategoryInput.focus();
      return;
    }
    hideOtherInput();
    startLog("その他", custom);
  }

  // ログ開始処理。作業中または停止中のログがあれば先に終了してから新規開始する。
  function startLog(category, customCategory) {
    var logs = loadLogs();
    var current = getCurrentLog(logs);
    var now = new Date();
    var nowText = formatDateTime(now);

    if (current) {
      finalizeLog(current, now);
    }

    logs.push({
      log_id: createLogId(now),
      work_date: formatDate(now),
      work_category: category,
      work_category_custom: customCategory || "",
      started_at: nowText,
      ended_at: "",
      status: "working",
      segments: [
        {
          start_at: nowText,
          end_at: ""
        }
      ],
      work_minutes: "",
      pause_minutes: ""
    });

    saveLogs(logs);
    renderFromStorage();
  }

  // 停止処理。working の最新 segment だけを現在時刻で閉じる。
  function pauseCurrentLog() {
    var logs = loadLogs();
    var current = getCurrentLog(logs);
    if (!current || current.status !== "working") {
      return;
    }
    closeLastOpenSegment(current, new Date());
    current.status = "paused";
    saveLogs(logs);
    renderFromStorage();
  }

  // 再開処理。paused のログに新しい作業区間を追加する。
  function resumeCurrentLog() {
    var logs = loadLogs();
    var current = getCurrentLog(logs);
    if (!current || current.status !== "paused") {
      return;
    }
    current.segments = normalizeSegments(current.segments);
    current.segments.push({
      start_at: formatDateTime(new Date()),
      end_at: ""
    });
    current.status = "working";
    saveLogs(logs);
    renderFromStorage();
  }

  // 終了処理。working は開いている segment を閉じ、paused はそのままログ全体を終了する。
  function endCurrentLog() {
    var logs = loadLogs();
    var current = getCurrentLog(logs);
    if (!current || (current.status !== "working" && current.status !== "paused")) {
      return;
    }
    finalizeLog(current, new Date());
    saveLogs(logs);
    renderFromStorage();
  }

  function finalizeLog(log, now) {
    if (log.status === "working") {
      closeLastOpenSegment(log, now);
    }
    log.ended_at = formatDateTime(now);
    log.status = "done";
    var totals = calculateTimes(log, now);
    log.work_minutes = Math.round(totals.workSeconds / 60);
    log.pause_minutes = Math.round(totals.pauseSeconds / 60);
  }

  function closeLastOpenSegment(log, now) {
    log.segments = normalizeSegments(log.segments);
    if (!log.segments.length) {
      return;
    }
    var last = log.segments[log.segments.length - 1];
    if (!last.end_at) {
      last.end_at = formatDateTime(now);
    }
  }

  function getCurrentLog(logs) {
    var activeLogs = logs.filter(function (log) {
      return log && (log.status === "working" || log.status === "paused");
    });
    if (!activeLogs.length) {
      return null;
    }
    activeLogs.sort(function (a, b) {
      return parseDateTime(b.started_at).getTime() - parseDateTime(a.started_at).getTime();
    });
    return activeLogs[0];
  }

  function renderCurrent(current) {
    els.currentPanel.className = "current-panel status-none";
    els.statusBadge.className = "status-badge";

    if (!current) {
      els.currentEmpty.hidden = false;
      els.currentDetails.hidden = true;
      els.statusBadge.textContent = "未開始";
      return;
    }

    var totals = calculateTimes(current, new Date());
    var displayCategory = getDisplayCategory(current);

    els.currentPanel.classList.add(current.status === "working" ? "status-working" : "status-paused");
    els.statusBadge.classList.add(current.status);
    els.statusBadge.textContent = statusLabel(current.status);
    els.currentEmpty.hidden = true;
    els.currentDetails.hidden = false;
    els.currentCategory.textContent = displayCategory;
    els.currentStart.textContent = current.started_at || "-";
    els.currentStatus.textContent = statusLabel(current.status);
    els.currentWorkTime.textContent = formatDuration(totals.workSeconds);
    els.currentPauseTime.textContent = formatDuration(totals.pauseSeconds);
    els.currentTotalTime.textContent = formatDuration(totals.totalSeconds);
  }

  function renderControls(current) {
    var status = current ? current.status : "";
    var categoryDisabled = false;
    Array.prototype.forEach.call(els.categoryButtons.querySelectorAll("button"), function (button) {
      button.disabled = categoryDisabled;
    });
    els.pauseButton.disabled = status !== "working";
    els.resumeButton.disabled = status !== "paused";
    els.endButton.disabled = status !== "working" && status !== "paused";
  }

  function renderTodayLogs(logs) {
    var today = formatDate(new Date());
    var todayDone = logs.filter(function (log) {
      return log.work_date === today && log.status === "done";
    }).sort(sortNewestFirst);

    els.todayCount.textContent = todayDone.length + "件";
    if (!todayDone.length) {
      els.todayList.innerHTML = '<div class="empty-list">本日の終了済み記録はありません。</div>';
      return;
    }

    els.todayList.innerHTML = todayDone.map(function (log) {
      return '<div class="log-item">' +
        '<div class="log-time">' + escapeHtml(formatTimeRange(log)) + '</div>' +
        '<div class="log-category">' + escapeHtml(getDisplayCategory(log)) + '</div>' +
        '<div class="minutes">実作業 ' + escapeHtml(minutesText(log.work_minutes)) + '</div>' +
        '<div class="minutes">停止 ' + escapeHtml(minutesText(log.pause_minutes)) + '</div>' +
        '</div>';
    }).join("");
  }

  function renderHistory(logs) {
    var sorted = logs.slice().sort(sortNewestFirst);
    var latest = sorted.slice(0, 50);
    els.historyCount.textContent = "全" + logs.length + "件 / 最新" + latest.length + "件";

    if (!latest.length) {
      els.historyList.innerHTML = '<div class="empty-list">履歴はまだありません。</div>';
      return;
    }

    var rows = latest.map(function (log) {
      var totals = calculateTimes(log, new Date());
      var workMinutes = log.status === "done" ? log.work_minutes : Math.round(totals.workSeconds / 60);
      var pauseMinutes = log.status === "done" ? log.pause_minutes : Math.round(totals.pauseSeconds / 60);
      return "<tr>" +
        "<td>" + escapeHtml(log.work_date || "") + "</td>" +
        "<td>" + escapeHtml(formatTimeRange(log)) + "</td>" +
        "<td>" + escapeHtml(getDisplayCategory(log)) + "</td>" +
        '<td><span class="status-text ' + escapeHtml(log.status || "") + '">' + escapeHtml(statusLabel(log.status)) + "</span></td>" +
        "<td>" + escapeHtml(minutesText(workMinutes)) + "</td>" +
        "<td>" + escapeHtml(minutesText(pauseMinutes)) + "</td>" +
        "</tr>";
    }).join("");

    els.historyList.innerHTML = '<table class="history-table">' +
      "<thead><tr><th>日付</th><th>時間帯</th><th>カテゴリ</th><th>状態</th><th>実作業</th><th>停止</th></tr></thead>" +
      "<tbody>" + rows + "</tbody></table>";
  }

  // 時間計算処理。segments は実作業時間のみなので、停止時間は総経過から差し引いて求める。
  function calculateTimes(log, now) {
    var started = parseDateTime(log.started_at);
    var ended = log.ended_at ? parseDateTime(log.ended_at) : now;
    var totalSeconds = Math.max(0, Math.floor((safeTime(ended) - safeTime(started)) / 1000));
    var workSeconds = 0;

    normalizeSegments(log.segments).forEach(function (segment) {
      var start = parseDateTime(segment.start_at);
      var end = segment.end_at ? parseDateTime(segment.end_at) : now;
      var diff = Math.floor((safeTime(end) - safeTime(start)) / 1000);
      if (isFinite(diff) && diff > 0) {
        workSeconds += diff;
      }
    });

    var pauseSeconds = Math.max(0, totalSeconds - workSeconds);
    return {
      workSeconds: workSeconds,
      pauseSeconds: pauseSeconds,
      totalSeconds: totalSeconds
    };
  }

  // CSV出力処理。UTF-8 BOM付き、値はCSV仕様に合わせてエスケープする。
  function exportCsv() {
    var logs = loadLogs();
    var columns = ["log_id", "work_date", "work_category", "work_category_custom", "started_at", "ended_at", "work_minutes", "pause_minutes", "status"];
    var lines = [columns.join(",")];
    logs.forEach(function (log) {
      lines.push(columns.map(function (column) {
        return csvEscape(log[column]);
      }).join(","));
    });

    var blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = "work_time_logs_" + formatFileTimestamp(new Date()) + ".csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function deleteAllData() {
    if (!confirm("すべての記録を削除します。元に戻せません。よろしいですか？")) {
      return;
    }
    saveLogs([]);
    renderFromStorage();
  }

  function handleShortcut(event) {
    var target = event.target;
    var tagName = target && target.tagName ? target.tagName.toLowerCase() : "";
    if (tagName === "input" || tagName === "textarea" || target.isContentEditable) {
      return;
    }

    var key = event.key.toUpperCase();
    if (shortcutMap[event.key]) {
      event.preventDefault();
      handleCategorySelect(shortcutMap[event.key]);
      return;
    }
    if (key === "S" && !els.pauseButton.disabled) {
      event.preventDefault();
      pauseCurrentLog();
    } else if (key === "R" && !els.resumeButton.disabled) {
      event.preventDefault();
      resumeCurrentLog();
    } else if (key === "E" && !els.endButton.disabled) {
      event.preventDefault();
      endCurrentLog();
    }
  }

  function startTimer() {
    if (timerId) {
      window.clearInterval(timerId);
    }
    timerId = window.setInterval(function () {
      var current = getCurrentLog(loadLogs());
      if (current) {
        renderCurrent(current);
      }
    }, 1000);
  }

  function normalizeSegments(segments) {
    return Array.isArray(segments) ? segments : [];
  }

  function getDisplayCategory(log) {
    if (!log) {
      return "";
    }
    if (log.work_category === "その他" && log.work_category_custom) {
      return "その他：" + log.work_category_custom;
    }
    return log.work_category || "";
  }

  function sortNewestFirst(a, b) {
    return safeTime(parseDateTime(b.started_at)) - safeTime(parseDateTime(a.started_at));
  }

  function statusLabel(status) {
    if (status === "working") {
      return "作業中";
    }
    if (status === "paused") {
      return "一時停止中";
    }
    if (status === "done") {
      return "終了済み";
    }
    return "未開始";
  }

  function formatTimeRange(log) {
    var start = log.started_at ? log.started_at.slice(11, 16) : "--:--";
    var end = log.ended_at ? log.ended_at.slice(11, 16) : "--:--";
    return start + " - " + end;
  }

  function minutesText(value) {
    if (value === "" || value === null || typeof value === "undefined") {
      return "";
    }
    var number = Number(value);
    return isFinite(number) ? String(number) + "分" : "";
  }

  function createLogId(date) {
    return formatIdTimestamp(date) + "-" + Math.random().toString(36).slice(2, 8);
  }

  function parseDateTime(value) {
    if (!value || typeof value !== "string") {
      return new Date(NaN);
    }
    var parts = value.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
    if (!parts) {
      return new Date(NaN);
    }
    return new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]), Number(parts[4]), Number(parts[5]), Number(parts[6]));
  }

  function safeTime(date) {
    var time = date instanceof Date ? date.getTime() : NaN;
    return isFinite(time) ? time : 0;
  }

  function formatDateTime(date) {
    return formatDate(date) + " " + pad(date.getHours()) + ":" + pad(date.getMinutes()) + ":" + pad(date.getSeconds());
  }

  function formatDate(date) {
    return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
  }

  function formatDuration(seconds) {
    var safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
    var hours = Math.floor(safeSeconds / 3600);
    var minutes = Math.floor((safeSeconds % 3600) / 60);
    var secs = safeSeconds % 60;
    return pad(hours) + ":" + pad(minutes) + ":" + pad(secs);
  }

  function formatIdTimestamp(date) {
    return String(date.getFullYear()) + pad(date.getMonth() + 1) + pad(date.getDate()) + "-" + pad(date.getHours()) + pad(date.getMinutes()) + pad(date.getSeconds());
  }

  function formatFileTimestamp(date) {
    return String(date.getFullYear()) + pad(date.getMonth() + 1) + pad(date.getDate()) + "_" + pad(date.getHours()) + pad(date.getMinutes()) + pad(date.getSeconds());
  }

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function csvEscape(value) {
    var text = value === null || typeof value === "undefined" ? "" : String(value);
    if (/[",\r\n]/.test(text)) {
      return '"' + text.replace(/"/g, '""') + '"';
    }
    return text;
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
