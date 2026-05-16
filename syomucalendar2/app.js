(function () {
  "use strict";

  var state = {
    schedules: [],
    filtered: [],
    calendar: null,
    selectedDate: "",
    elements: {}
  };

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    cacheElements();
    bindEvents();

    var rawSchedules = getSchedules();
    if (!rawSchedules) {
      showDataError();
      renderSummary([]);
      renderOverviewList([]);
      renderHistoryList([]);
      return;
    }

    state.schedules = rawSchedules.map(normalizeSchedule);
    populateDynamicFilters(state.schedules);
    renderSummary(state.schedules);
    renderCalendar();
    applyFilters();
  }

  function cacheElements() {
    state.elements = {
      errorMessage: document.getElementById("errorMessage"),
      calendarScreen: document.getElementById("calendarScreen"),
      overviewScreen: document.getElementById("overviewScreen"),
      historyScreen: document.getElementById("historyScreen"),
      overviewViewLink: document.getElementById("overviewViewLink"),
      calendarViewLink: document.getElementById("calendarViewLink"),
      historyViewLink: document.getElementById("historyViewLink"),
      summaryCards: document.getElementById("summaryCards"),
      keywordFilter: document.getElementById("keywordFilter"),
      statusFilter: document.getElementById("statusFilter"),
      categoryFilter: document.getElementById("categoryFilter"),
      staffFilter: document.getElementById("staffFilter"),
      documentFilter: document.getElementById("documentFilter"),
      greetingFilter: document.getElementById("greetingFilter"),
      showHistoryFilter: document.getElementById("showHistoryFilter"),
      resetFilters: document.getElementById("resetFilters"),
      overviewCount: document.getElementById("overviewCount"),
      overviewList: document.getElementById("overviewList"),
      historyCount: document.getElementById("historyCount"),
      historyList: document.getElementById("historyList"),
      modal: document.getElementById("detailModal"),
      modalTitle: document.getElementById("modalTitle"),
      modalStatus: document.getElementById("modalStatus"),
      modalBody: document.getElementById("modalBody"),
      closeModal: document.getElementById("closeModal")
    };
  }

  function bindEvents() {
    [
      "keywordFilter",
      "statusFilter",
      "categoryFilter",
      "staffFilter",
      "documentFilter",
      "greetingFilter",
      "showHistoryFilter"
    ].forEach(function (key) {
      state.elements[key].addEventListener("input", applyFilters);
      state.elements[key].addEventListener("change", applyFilters);
    });

    state.elements.resetFilters.addEventListener("click", resetFilters);
    state.elements.closeModal.addEventListener("click", closeModal);
    window.addEventListener("hashchange", renderRoute);
    state.elements.modal.addEventListener("click", function (event) {
      if (event.target === state.elements.modal) {
        closeModal();
      }
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closeModal();
      }
    });
  }

  function getSchedules() {
    if (!window.APP_DATA || !Array.isArray(window.APP_DATA.schedules)) {
      return null;
    }
    return window.APP_DATA.schedules;
  }

  function normalizeSchedule(item) {
    var normalized = Object.assign({}, item);
    normalized.schedule_date = normalizeDate(item.schedule_date);
    normalized.entered_date = normalizeDate(item.entered_date);
    normalized.reply_date = normalizeDate(item.reply_date);
    normalized.updated_at = normalizeDate(item.updated_at);
    normalized.event_start_time = normalizeTime(item.event_start_time);
    normalized.event_end_time = normalizeTime(item.event_end_time);
    normalized.outsource_start_time = normalizeTime(item.outsource_start_time);
    normalized.outsource_end_time = normalizeTime(item.outsource_end_time);
    normalized.driver_leave_time = normalizeTime(item.driver_leave_time);
    normalized.in_time = normalizeTime(item.in_time);
    normalized.out_time = normalizeTime(item.out_time);
    normalized.outsource_hours = toNumber(item.outsource_hours);
    normalized.holiday_operation_hours = toNumber(item.holiday_operation_hours);
    normalized.overtime_operation_hours = toNumber(item.overtime_operation_hours);
    normalized.sort_order = toNumber(item.sort_order);
    normalized.status = text(item.status) || "active";
    normalized.change_type = text(item.change_type);
    return normalized;
  }

  function renderCalendar() {
    var calendarElement = document.getElementById("calendar");
    if (!calendarElement) {
      return;
    }
    if (!window.FullCalendar || !window.FullCalendar.Calendar) {
      calendarElement.innerHTML = '<div class="empty-state">FullCalendarを読み込めませんでした。app/lib/fullcalendar/index.global.min.js を確認してください。</div>';
      return;
    }

    state.calendar = new FullCalendar.Calendar(calendarElement, {
      initialView: "dayGridMonth",
      initialDate: getInitialCalendarDate(),
      locale: "ja",
      height: "auto",
      headerToolbar: {
        left: "prev,next today",
        center: "title",
        right: "dayGridMonth,timeGridWeek,timeGridDay"
      },
      buttonText: {
        today: "今日",
        month: "月",
        week: "週",
        day: "日"
      },
      events: [],
      eventClick: function (info) {
        openModal(info.event.extendedProps.schedule);
      },
      dateClick: function (info) {
        state.selectedDate = normalizeDateOnly(info.dateStr);
        renderOverviewList(state.filtered);
        window.location.hash = "#overview";
        renderRoute();
        scrollToOverviewDate(state.selectedDate);
      }
    });
    state.calendar.render();
    renderRoute();
  }

  function toCalendarEvent(schedule) {
    var title = schedule.event_start_time
      ? schedule.event_start_time + " " + display(schedule.event_title)
      : display(schedule.event_title);
    var event = {
      id: schedule.schedule_id,
      title: title,
      classNames: [getEventClass(schedule)],
      extendedProps: {
        schedule: schedule
      }
    };

    if (schedule.event_start_time) {
      event.start = schedule.schedule_date + "T" + schedule.event_start_time + ":00";
      if (schedule.event_end_time) {
        event.end = schedule.schedule_date + "T" + schedule.event_end_time + ":00";
      }
    } else {
      event.start = schedule.schedule_date;
      event.allDay = true;
    }

    return event;
  }

  function applyFilters() {
    var filters = getFilterValues();
    state.filtered = state.schedules.filter(function (schedule) {
      if (!filters.showHistory && schedule.status !== "active") {
        return false;
      }
      if (filters.keyword && !matchesKeyword(schedule, filters.keyword)) {
        return false;
      }
      if (filters.status && schedule.status !== filters.status) {
        return false;
      }
      if (filters.category && schedule.operation_category !== filters.category) {
        return false;
      }
      if (filters.staff && schedule.staff_name !== filters.staff) {
        return false;
      }
      if (filters.document && schedule.document_required_flag !== filters.document) {
        return false;
      }
      if (filters.greeting && schedule.greeting_required_flag !== filters.greeting) {
        return false;
      }
      return true;
    });

    if (state.calendar) {
      state.calendar.removeAllEvents();
      state.filtered.forEach(function (schedule) {
        if (schedule.schedule_date) {
          state.calendar.addEvent(toCalendarEvent(schedule));
        }
      });
    }

    renderOverviewList(state.filtered);
    renderHistoryList(getHistorySchedules(state.schedules));
  }

  function getFilterValues() {
    return {
      keyword: text(state.elements.keywordFilter.value).toLowerCase(),
      status: state.elements.statusFilter.value,
      category: state.elements.categoryFilter.value,
      staff: state.elements.staffFilter.value,
      document: state.elements.documentFilter.value,
      greeting: state.elements.greetingFilter.value,
      showHistory: state.elements.showHistoryFilter.checked
    };
  }

  function matchesKeyword(schedule, keyword) {
    return [
      "event_title",
      "location",
      "chair_movement",
      "vice_chair_movement",
      "attendant",
      "driver_name",
      "staff_name",
      "note",
      "transfer_time_note",
      "change_reason",
      "change_history_note"
    ].some(function (key) {
      return text(schedule[key]).toLowerCase().indexOf(keyword) !== -1;
    });
  }

  function renderSummary(schedules) {
    var summary = calculateSummary(schedules);
    var cards = [
      ["有効予定件数", summary.active + "件"],
      ["取消予定件数", summary.cancelled + "件"],
      ["変更履歴件数", summary.changedHistory + "件"],
      ["文書対応が必要な件数", summary.documentRequired + "件"],
      ["挨拶対応が必要な件数", summary.greetingRequired + "件"],
      ["休日運行時間の合計", formatHours(summary.holidayHours)],
      ["時間外運行時間の合計", formatHours(summary.overtimeHours)],
      ["宿泊運行件数", summary.overnight + "件"]
    ];

    state.elements.summaryCards.innerHTML = cards.map(function (card) {
      return '<article class="summary-card"><div class="label">' +
        escapeHtml(card[0]) +
        '</div><div class="value">' +
        escapeHtml(card[1]) +
        "</div></article>";
    }).join("");
  }

  function renderRoute() {
    var route = window.location.hash || "#calendar";
    var isOverview = route === "#overview";
    var isHistory = route === "#history";
    state.elements.calendarScreen.hidden = isOverview || isHistory;
    state.elements.overviewScreen.hidden = !isOverview;
    state.elements.historyScreen.hidden = !isHistory;
    state.elements.overviewViewLink.classList.toggle("active", isOverview);
    state.elements.calendarViewLink.classList.toggle("active", !isOverview && !isHistory);
    state.elements.historyViewLink.classList.toggle("active", isHistory);
    if (!isOverview && !isHistory && state.calendar) {
      setTimeout(function () {
        state.calendar.updateSize();
      }, 0);
    }
    if (isOverview) {
      renderOverviewList(state.filtered);
    }
    if (isHistory) {
      renderHistoryList(getHistorySchedules(state.schedules));
    }
  }

  function calculateSummary(schedules) {
    return schedules.reduce(function (acc, schedule) {
      if (schedule.status === "active") {
        acc.active += 1;
      }
      if (schedule.status === "cancelled") {
        acc.cancelled += 1;
      }
      if (schedule.status === "changed" || schedule.change_type === "replace") {
        acc.changedHistory += 1;
      }
      if (schedule.document_required_flag === "要") {
        acc.documentRequired += 1;
      }
      if (schedule.greeting_required_flag === "要") {
        acc.greetingRequired += 1;
      }
      acc.holidayHours += schedule.holiday_operation_hours || 0;
      acc.overtimeHours += schedule.overtime_operation_hours || 0;
      if (String(schedule.overnight_operation_flag) === "1") {
        acc.overnight += 1;
      }
      return acc;
    }, {
      active: 0,
      cancelled: 0,
      changedHistory: 0,
      documentRequired: 0,
      greetingRequired: 0,
      holidayHours: 0,
      overtimeHours: 0,
      overnight: 0
    });
  }

  function renderOverviewList(schedules) {
    state.elements.overviewCount.textContent = schedules.length + "件";
    if (!schedules.length) {
      state.elements.overviewList.className = "day-overview-list empty-state";
      state.elements.overviewList.textContent = "予定はありません。";
      return;
    }

    var groups = groupByDate(schedules.slice().sort(compareSchedules));
    state.elements.overviewList.className = "day-overview-list";
    state.elements.overviewList.innerHTML = groups.map(function (group) {
      return '<section class="day-overview-row ' + (group.date === state.selectedDate ? "selected" : "") + '" data-date="' + escapeHtml(group.date) + '">' +
        '<div class="day-heading"><div class="day-date">' + escapeHtml(display(group.date)) + '</div><div class="day-count">' + group.items.length + '件</div></div>' +
        '<div class="day-cards">' +
        group.items.map(function (schedule) {
          return '<article class="overview-card ' + escapeHtml(schedule.status) + '" data-id="' + escapeHtml(schedule.schedule_id) + '">' +
            '<div class="overview-card-head"><div><div class="overview-time">' + escapeHtml(display(schedule.event_start_time)) + ' - ' + escapeHtml(display(schedule.event_end_time)) +
            '</div><div class="overview-title">' + escapeHtml(display(schedule.event_title)) + '</div></div><span class="badge ' + escapeHtml(schedule.status) + '">' +
            escapeHtml(statusLabel(schedule.status)) + '</span></div>' +
            '<div class="overview-grid">' +
            meta("場所", schedule.location) +
            meta("議長", schedule.chair_movement) +
            meta("副議長", schedule.vice_chair_movement) +
            meta("随行者", schedule.attendant) +
            meta("運転者", schedule.driver_name) +
            meta("担当者", schedule.staff_name) +
            meta("委託", display(schedule.outsource_start_time) + " - " + display(schedule.outsource_end_time)) +
            meta("入り/出る", display(schedule.in_time) + " / " + display(schedule.out_time)) +
            meta("区分", schedule.operation_category) +
            meta("文書", schedule.document_required_flag) +
            meta("挨拶", schedule.greeting_required_flag) +
            meta("備考", schedule.note) +
            '</div></article>';
        }).join("") +
        "</div></section>";
    }).join("");

    Array.prototype.forEach.call(state.elements.overviewList.querySelectorAll(".overview-card"), function (card) {
      card.addEventListener("click", function () {
        var schedule = state.schedules.find(function (item) {
          return item.schedule_id === card.dataset.id;
        });
        openModal(schedule);
      });
    });
  }

  function groupByDate(schedules) {
    var map = {};
    schedules.forEach(function (schedule) {
      var date = schedule.schedule_date || "日付未設定";
      if (!map[date]) {
        map[date] = [];
      }
      map[date].push(schedule);
    });
    return Object.keys(map).sort().map(function (date) {
      return {
        date: date,
        items: map[date].sort(compareSchedules)
      };
    });
  }

  function scrollToOverviewDate(date) {
    setTimeout(function () {
      var row = Array.prototype.find.call(state.elements.overviewList.querySelectorAll(".day-overview-row"), function (item) {
        return item.dataset.date === date;
      });
      if (row) {
        row.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 0);
  }

  function getSchedulesForDate(date) {
    return state.filtered
      .filter(function (schedule) {
        return schedule.schedule_date === date;
      })
      .sort(compareSchedules);
  }

  function renderHistoryList(schedules) {
    state.elements.historyCount.textContent = schedules.length + "件";
    if (!schedules.length) {
      state.elements.historyList.className = "history-list empty-state";
      state.elements.historyList.textContent = "履歴はありません。";
      return;
    }

    state.elements.historyList.className = "history-list";
    state.elements.historyList.innerHTML = schedules.map(function (schedule) {
      var relation = getHistoryRelation(schedule);
      return '<article class="history-card"><div class="history-main"><div><div class="history-title">' +
        escapeHtml(display(schedule.schedule_date) + " " + display(schedule.event_title)) +
        '</div><div class="history-meta">' +
        badge(statusLabel(schedule.status), schedule.status) +
        badge(changeTypeLabel(schedule.change_type), "changed") +
        meta("変更理由", schedule.change_reason) +
        meta("変更前スケジュールID", schedule.previous_schedule_id) +
        meta("変更履歴メモ", schedule.change_history_note) +
        '</div><div class="history-meta">' +
        escapeHtml(relation) +
        "</div></div></div></article>";
    }).join("");
  }

  function getHistorySchedules(schedules) {
    return schedules
      .filter(function (schedule) {
        return schedule.status === "changed" ||
          schedule.status === "cancelled" ||
          schedule.change_type === "replace";
      })
      .sort(compareSchedules);
  }

  function getHistoryRelation(schedule) {
    if (schedule.previous_schedule_id) {
      return "変更前：" + schedule.previous_schedule_id + " / 変更後：" + display(schedule.schedule_id);
    }
    var replacement = state.schedules.find(function (item) {
      return item.previous_schedule_id === schedule.schedule_id;
    });
    if (replacement) {
      return "変更前：" + display(schedule.schedule_id) + " / 変更後：" + display(replacement.schedule_id);
    }
    return "関連付け：—";
  }

  function openModal(schedule) {
    if (!schedule) {
      return;
    }

    state.elements.modalTitle.textContent = display(schedule.event_title);
    state.elements.modalStatus.textContent = statusLabel(schedule.status);
    state.elements.modalStatus.className = "badge " + schedule.status;
    state.elements.modalBody.innerHTML = getDetailItems(schedule).map(function (item) {
      return '<div class="detail-item ' + (item.wide ? "wide" : "") + '"><div class="detail-label">' +
        escapeHtml(item.label) +
        '</div><div class="detail-value">' +
        escapeHtml(display(item.value)) +
        "</div></div>";
    }).join("");
    state.elements.modal.hidden = false;
  }

  function closeModal() {
    state.elements.modal.hidden = true;
  }

  function getDetailItems(schedule) {
    return [
      ["行事名称", schedule.event_title, true],
      ["日付", schedule.schedule_date],
      ["開催時刻", schedule.event_start_time],
      ["終了時刻", schedule.event_end_time],
      ["場所", schedule.location],
      ["議長動向", schedule.chair_movement],
      ["副議長動向", schedule.vice_chair_movement],
      ["随行者", schedule.attendant],
      ["運転者", schedule.driver_name],
      ["委託始業", schedule.outsource_start_time],
      ["委託終業", schedule.outsource_end_time],
      ["委託時間", formatHours(schedule.outsource_hours)],
      ["運転員退庁時間", schedule.driver_leave_time],
      ["区分", schedule.operation_category],
      ["基本運行", flagLabel(schedule.basic_operation_flag)],
      ["休日運行時間", formatHours(schedule.holiday_operation_hours)],
      ["時間外運行時間", formatHours(schedule.overtime_operation_hours)],
      ["宿泊運行", flagLabel(schedule.overnight_operation_flag)],
      ["送迎時間等", schedule.transfer_time_note, true],
      ["入り時刻", schedule.in_time],
      ["出る時刻", schedule.out_time],
      ["文書", schedule.document_required_flag],
      ["挨拶", schedule.greeting_required_flag],
      ["祝儀・会費等", schedule.fee_note],
      ["回答日", schedule.reply_date],
      ["担当者", schedule.staff_name],
      ["備考", schedule.note, true],
      ["状態", statusLabel(schedule.status)],
      ["変更区分", changeTypeLabel(schedule.change_type)],
      ["変更理由", schedule.change_reason, true],
      ["変更前スケジュールID", schedule.previous_schedule_id],
      ["変更履歴メモ", schedule.change_history_note, true],
      ["更新日", schedule.updated_at]
    ].map(function (item) {
      return {
        label: item[0],
        value: item[1],
        wide: Boolean(item[2])
      };
    });
  }

  function populateDynamicFilters(schedules) {
    addOptions(state.elements.categoryFilter, uniqueValues(schedules, "operation_category"));
    addOptions(state.elements.staffFilter, uniqueValues(schedules, "staff_name"));
  }

  function addOptions(select, values) {
    values.forEach(function (value) {
      var option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    });
  }

  function resetFilters() {
    state.elements.keywordFilter.value = "";
    state.elements.statusFilter.value = "";
    state.elements.categoryFilter.value = "";
    state.elements.staffFilter.value = "";
    state.elements.documentFilter.value = "";
    state.elements.greetingFilter.value = "";
    state.elements.showHistoryFilter.checked = false;
    applyFilters();
  }

  function showDataError() {
    state.elements.errorMessage.hidden = false;
  }

  function uniqueValues(items, key) {
    var values = items.map(function (item) {
      return text(item[key]);
    }).filter(Boolean);
    return Array.from(new Set(values)).sort(function (a, b) {
      return a.localeCompare(b, "ja");
    });
  }

  function getInitialCalendarDate() {
    var first = state.schedules
      .filter(function (schedule) {
        return schedule.schedule_date && schedule.status === "active";
      })
      .sort(compareSchedules)[0] || state.schedules.filter(function (schedule) {
        return schedule.schedule_date;
      }).sort(compareSchedules)[0];
    return first ? first.schedule_date : undefined;
  }

  function compareSchedules(a, b) {
    return (a.sort_order - b.sort_order) ||
      text(a.event_start_time).localeCompare(text(b.event_start_time)) ||
      text(a.schedule_id).localeCompare(text(b.schedule_id));
  }

  function getEventClass(schedule) {
    var category = text(schedule.operation_category);
    if (schedule.status === "cancelled") {
      return "event-cancelled";
    }
    if (schedule.status === "changed") {
      return "event-changed";
    }
    if (category.indexOf("宿泊") !== -1) {
      return "event-overnight";
    }
    if (category.indexOf("休日") !== -1) {
      return "event-holiday";
    }
    if (category.indexOf("時間外") !== -1) {
      return "event-overtime";
    }
    return "event-basic";
  }

  function normalizeDate(value) {
    var valueText = text(value);
    if (!valueText) {
      return "";
    }
    return valueText.replace(/\//g, "-");
  }

  function normalizeDateOnly(value) {
    return normalizeDate(text(value).split("T")[0]);
  }

  function normalizeTime(value) {
    var valueText = text(value);
    var decimal = Number(valueText);
    if (valueText && isFinite(decimal) && decimal > 0 && decimal < 1) {
      var totalMinutes = Math.round(decimal * 24 * 60);
      var hours = Math.floor(totalMinutes / 60) % 24;
      var minutes = totalMinutes % 60;
      return pad2(hours) + ":" + pad2(minutes);
    }
    var match = valueText.match(/^(\d{1,2}):(\d{2})/);
    if (match) {
      return pad2(Number(match[1])) + ":" + match[2];
    }
    return valueText;
  }

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function toNumber(value) {
    var number = Number(value);
    return isFinite(number) ? number : 0;
  }

  function text(value) {
    return value === null || value === undefined ? "" : String(value).trim();
  }

  function display(value) {
    var valueText = text(value);
    return valueText || "—";
  }

  function statusLabel(value) {
    return {
      active: "有効",
      cancelled: "取消",
      changed: "変更済",
      history: "履歴"
    }[value] || display(value);
  }

  function changeTypeLabel(value) {
    return {
      new: "新規",
      edit: "修正",
      cancel: "取消",
      replace: "差替"
    }[value] || display(value);
  }

  function flagLabel(value) {
    return String(value) === "1" ? "あり" : "なし";
  }

  function formatHours(value) {
    var number = toNumber(value);
    return number ? number.toLocaleString("ja-JP", { maximumFractionDigits: 2 }) + "時間" : "0時間";
  }

  function meta(label, value) {
    return '<span>' + escapeHtml(label) + "：" + escapeHtml(display(value)) + "</span>";
  }

  function badge(value, className) {
    return '<span class="badge ' + escapeHtml(className || "") + '">' + escapeHtml(display(value)) + "</span>";
  }

  function badgeClass(value) {
    if (value === "要") {
      return "required";
    }
    if (value === "済") {
      return "done";
    }
    return "";
  }

  function escapeHtml(value) {
    return text(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

})();
