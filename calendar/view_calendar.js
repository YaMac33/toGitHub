window.APP_DATA = window.APP_DATA || {};

window.CALENDAR_VIEW = (function () {
  "use strict";

  const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];
  const MAX_VISIBLE_EVENTS = 3;

  const state = {
    currentView: "month",
    currentDate: new Date(),
    selectedDate: null,
    events: []
  };

  const dom = {};

  function init() {
    cacheDom();
    bindEvents();
    loadEvents();

    const today = startOfDay(new Date());
    state.currentDate = today;
    state.selectedDate = today;

    render();
  }

  function cacheDom() {
    dom.prevButton = document.getElementById("prevButton");
    dom.todayButton = document.getElementById("todayButton");
    dom.nextButton = document.getElementById("nextButton");
    dom.monthViewButton = document.getElementById("monthViewButton");
    dom.weekViewButton = document.getElementById("weekViewButton");
    dom.currentLabel = document.getElementById("currentLabel");
    dom.calendarGrid = document.getElementById("calendarGrid");

    dom.eventModal = document.getElementById("eventModal");
    dom.modalCloseButton = document.getElementById("modalCloseButton");
    dom.modalBody = document.getElementById("modalBody");
  }

  function bindEvents() {
    if (dom.prevButton) {
      dom.prevButton.addEventListener("click", handlePrev);
    }

    if (dom.todayButton) {
      dom.todayButton.addEventListener("click", handleToday);
    }

    if (dom.nextButton) {
      dom.nextButton.addEventListener("click", handleNext);
    }

    if (dom.monthViewButton) {
      dom.monthViewButton.addEventListener("click", function () {
        setView("month");
      });
    }

    if (dom.weekViewButton) {
      dom.weekViewButton.addEventListener("click", function () {
        setView("week");
      });
    }

    if (dom.modalCloseButton) {
      dom.modalCloseButton.addEventListener("click", closeModal);
    }

    if (dom.eventModal) {
      dom.eventModal.addEventListener("click", function (event) {
        const target = event.target;
        if (target && target.getAttribute("data-close-modal") === "true") {
          closeModal();
        }
      });
    }

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closeModal();
      }
    });
  }

  function loadEvents() {
    if (Array.isArray(window.APP_DATA.events)) {
      state.events = window.APP_DATA.events
        .map(normalizeEvent)
        .filter(function (item) {
          return !!item;
        });
    } else {
      state.events = [];
    }
  }

  function normalizeEvent(item) {
    if (!item || !item.date || !item.title) {
      return null;
    }

    const startDate = parseDate(item.date);
    if (!startDate) {
      return null;
    }

    const endDate = item.end_date ? parseDate(item.end_date) : startDate;
    const safeEndDate = endDate || startDate;

    return {
      event_id: String(item.event_id || ""),
      date: formatDate(startDate),
      end_date: formatDate(safeEndDate),
      title: String(item.title || ""),
      start_time: normalizeTime(item.start_time),
      end_time: normalizeTime(item.end_time),
      is_all_day: toNumber(item.is_all_day) === 1 ? 1 : 0,
      category: String(item.category || "OTHER").trim().toUpperCase() || "OTHER",
      department_name: String(item.department_name || ""),
      location: String(item.location || ""),
      note: String(item.note || ""),
      sort_order: toNumber(item.sort_order)
    };
  }

  function render() {
    updateToolbar();
    renderCalendar();
  }

  function updateToolbar() {
    if (dom.currentLabel) {
      dom.currentLabel.textContent = getCurrentLabel();
    }

    if (dom.monthViewButton) {
      const isMonth = state.currentView === "month";
      dom.monthViewButton.classList.toggle("toolbar-button--active", isMonth);
      dom.monthViewButton.setAttribute("aria-pressed", String(isMonth));
    }

    if (dom.weekViewButton) {
      const isWeek = state.currentView === "week";
      dom.weekViewButton.classList.toggle("toolbar-button--active", isWeek);
      dom.weekViewButton.setAttribute("aria-pressed", String(isWeek));
    }

    if (dom.calendarGrid) {
      dom.calendarGrid.classList.toggle("calendar-grid--month", state.currentView === "month");
      dom.calendarGrid.classList.toggle("calendar-grid--week", state.currentView === "week");
    }
  }

  function renderCalendar() {
    if (!dom.calendarGrid) {
      return;
    }

    clearElement(dom.calendarGrid);

    if (state.currentView === "week") {
      renderWeekView();
    } else {
      renderMonthView();
    }
  }

  function renderMonthView() {
    const baseDate = startOfDay(state.currentDate);
    const monthStart = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
    const gridStart = startOfWeek(monthStart);

    for (let i = 0; i < 42; i += 1) {
      const cellDate = addDays(gridStart, i);
      const cell = createDateCell(cellDate, {
        isOtherMonth: cellDate.getMonth() !== monthStart.getMonth()
      });
      dom.calendarGrid.appendChild(cell);
    }
  }

  function renderWeekView() {
    const weekStart = startOfWeek(state.currentDate);

    for (let i = 0; i < 7; i += 1) {
      const cellDate = addDays(weekStart, i);
      const cell = createDateCell(cellDate, {
        isOtherMonth: false
      });
      dom.calendarGrid.appendChild(cell);
    }
  }

  function createDateCell(dateObj, options) {
    const cell = document.createElement("div");
    cell.className = "calendar-cell";

    if (options && options.isOtherMonth) {
      cell.classList.add("calendar-cell--other-month");
    }

    if (isSameDate(dateObj, new Date())) {
      cell.classList.add("calendar-cell--today");
    }

    if (state.selectedDate && isSameDate(dateObj, state.selectedDate)) {
      cell.classList.add("calendar-cell--selected");
    }

    cell.dataset.date = formatDate(dateObj);

    const header = document.createElement("div");
    header.className = "calendar-cell__header";

    const dateEl = document.createElement("div");
    dateEl.className = "calendar-cell__date";
    dateEl.textContent = String(dateObj.getDate());

    header.appendChild(dateEl);
    cell.appendChild(header);

    const eventsWrap = document.createElement("div");
    eventsWrap.className = "calendar-cell__events";

    const dayEvents = getEventsForDate(dateObj);
    const visibleEvents = dayEvents.slice(0, MAX_VISIBLE_EVENTS);
    const hiddenCount = Math.max(dayEvents.length - MAX_VISIBLE_EVENTS, 0);

    visibleEvents.forEach(function (eventItem) {
      const chip = createEventChip(eventItem);
      eventsWrap.appendChild(chip);
    });

    if (hiddenCount > 0) {
      eventsWrap.appendChild(createMoreChip(hiddenCount));
    }

    cell.appendChild(eventsWrap);

    cell.addEventListener("click", function (event) {
      if (event.target.closest(".event-chip")) {
        return;
      }
      state.selectedDate = startOfDay(dateObj);
      render();
    });

    return cell;
  }

  function createEventChip(eventItem) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "event-chip category-" + sanitizeCategory(eventItem.category);
    button.title = buildEventTooltip(eventItem);

    const timeSpan = document.createElement("span");
    timeSpan.className = "event-chip__time";
    timeSpan.textContent = getEventTimeLabel(eventItem);

    const titleSpan = document.createElement("span");
    titleSpan.className = "event-chip__title";
    titleSpan.textContent = eventItem.title;

    button.appendChild(timeSpan);
    button.appendChild(titleSpan);

    button.addEventListener("click", function (event) {
      event.stopPropagation();
      openModal(eventItem);
    });

    return button;
  }

  function createMoreChip(hiddenCount) {
    const div = document.createElement("div");
    div.className = "event-chip event-chip--more";
    div.textContent = "他" + hiddenCount + "件";
    return div;
  }

  function getEventsForDate(dateObj) {
    const target = formatDate(dateObj);

    return state.events
      .filter(function (eventItem) {
        return isDateInRange(target, eventItem.date, eventItem.end_date);
      })
      .sort(compareEvents);
  }

  function compareEvents(a, b) {
    if (a.is_all_day !== b.is_all_day) {
      return b.is_all_day - a.is_all_day;
    }

    if (a.sort_order !== b.sort_order) {
      return a.sort_order - b.sort_order;
    }

    if (a.start_time !== b.start_time) {
      if (!a.start_time && b.start_time) return -1;
      if (a.start_time && !b.start_time) return 1;
      return a.start_time.localeCompare(b.start_time);
    }

    return a.title.localeCompare(b.title, "ja");
  }

  function handlePrev() {
    if (state.currentView === "week") {
      state.currentDate = addDays(state.currentDate, -7);
    } else {
      state.currentDate = new Date(
        state.currentDate.getFullYear(),
        state.currentDate.getMonth() - 1,
        1
      );
    }
    syncSelectedDateToCurrentRange();
    render();
  }

  function handleNext() {
    if (state.currentView === "week") {
      state.currentDate = addDays(state.currentDate, 7);
    } else {
      state.currentDate = new Date(
        state.currentDate.getFullYear(),
        state.currentDate.getMonth() + 1,
        1
      );
    }
    syncSelectedDateToCurrentRange();
    render();
  }

  function handleToday() {
    const today = startOfDay(new Date());
    state.currentDate = today;
    state.selectedDate = today;
    render();
  }

  function setView(viewName) {
    if (viewName !== "month" && viewName !== "week") {
      return;
    }

    state.currentView = viewName;

    if (state.selectedDate) {
      state.currentDate = startOfDay(state.selectedDate);
    } else {
      state.currentDate = startOfDay(state.currentDate);
    }

    render();
  }

  function syncSelectedDateToCurrentRange() {
    if (!state.selectedDate) {
      return;
    }

    if (state.currentView === "week") {
      const start = startOfWeek(state.currentDate);
      const end = addDays(start, 6);
      if (!isDateInRange(formatDate(state.selectedDate), formatDate(start), formatDate(end))) {
        state.selectedDate = startOfDay(state.currentDate);
      }
      return;
    }

    const month = state.currentDate.getMonth();
    const year = state.currentDate.getFullYear();
    if (
      state.selectedDate.getFullYear() !== year ||
      state.selectedDate.getMonth() !== month
    ) {
      state.selectedDate = new Date(year, month, 1);
    }
  }

  function getCurrentLabel() {
    if (state.currentView === "week") {
      const start = startOfWeek(state.currentDate);
      const end = addDays(start, 6);
      return (
        start.getFullYear() +
        "年" +
        (start.getMonth() + 1) +
        "月" +
        start.getDate() +
        "日 ～ " +
        end.getFullYear() +
        "年" +
        (end.getMonth() + 1) +
        "月" +
        end.getDate() +
        "日"
      );
    }

    return state.currentDate.getFullYear() + "年" + (state.currentDate.getMonth() + 1) + "月";
  }

  function openModal(eventItem) {
    if (!dom.eventModal || !dom.modalBody) {
      return;
    }

    clearElement(dom.modalBody);

    const detail = document.createElement("dl");
    detail.className = "modal-detail";

    appendDetailRow(detail, "件名", eventItem.title);
    appendDetailRow(detail, "日付", buildDateLabel(eventItem));
    appendDetailRow(detail, "時間", buildTimeRangeLabel(eventItem));
    appendDetailRow(detail, "分類", eventItem.category || "-");
    appendDetailRow(detail, "担当部署", eventItem.department_name || "-");
    appendDetailRow(detail, "場所", eventItem.location || "-");
    appendDetailRow(detail, "詳細", eventItem.note || "-");

    dom.modalBody.appendChild(detail);
    dom.eventModal.classList.add("is-open");
    dom.eventModal.setAttribute("aria-hidden", "false");
  }

  function closeModal() {
    if (!dom.eventModal) {
      return;
    }
    dom.eventModal.classList.remove("is-open");
    dom.eventModal.setAttribute("aria-hidden", "true");
  }

  function appendDetailRow(container, label, value) {
    const row = document.createElement("div");
    row.className = "modal-detail__row";

    const dt = document.createElement("dt");
    dt.className = "modal-detail__label";
    dt.textContent = label;

    const dd = document.createElement("dd");
    dd.className = "modal-detail__value";
    dd.textContent = value;

    row.appendChild(dt);
    row.appendChild(dd);
    container.appendChild(row);
  }

  function buildDateLabel(eventItem) {
    if (eventItem.date && eventItem.end_date && eventItem.date !== eventItem.end_date) {
      return formatDateForDisplay(eventItem.date) + " ～ " + formatDateForDisplay(eventItem.end_date);
    }
    return formatDateForDisplay(eventItem.date);
  }

  function buildTimeRangeLabel(eventItem) {
    if (eventItem.is_all_day === 1) {
      return "終日";
    }

    if (eventItem.start_time && eventItem.end_time) {
      return eventItem.start_time + " ～ " + eventItem.end_time;
    }

    if (eventItem.start_time) {
      return eventItem.start_time;
    }

    return "-";
  }

  function buildEventTooltip(eventItem) {
    const pieces = [];
    pieces.push(eventItem.title);

    const dateLabel = buildDateLabel(eventItem);
    if (dateLabel) {
      pieces.push(dateLabel);
    }

    const timeLabel = buildTimeRangeLabel(eventItem);
    if (timeLabel && timeLabel !== "-") {
      pieces.push(timeLabel);
    }

    return pieces.join("\n");
  }

  function getEventTimeLabel(eventItem) {
    if (eventItem.is_all_day === 1) {
      return "終日";
    }
    return eventItem.start_time || "";
  }

  function sanitizeCategory(value) {
    const safe = String(value || "OTHER").trim().toUpperCase();
    return safe.replace(/[^A-Z0-9_-]/g, "") || "OTHER";
  }

  function parseDate(value) {
    if (!value) return null;

    const parts = String(value).split("-");
    if (parts.length !== 3) return null;

    const year = Number(parts[0]);
    const month = Number(parts[1]) - 1;
    const day = Number(parts[2]);

    const dateObj = new Date(year, month, day);
    if (
      dateObj.getFullYear() !== year ||
      dateObj.getMonth() !== month ||
      dateObj.getDate() !== day
    ) {
      return null;
    }

    return startOfDay(dateObj);
  }

  function formatDate(dateObj) {
    const year = dateObj.getFullYear();
    const month = pad2(dateObj.getMonth() + 1);
    const day = pad2(dateObj.getDate());
    return year + "-" + month + "-" + day;
  }

  function formatDateForDisplay(value) {
    const dateObj = typeof value === "string" ? parseDate(value) : value;
    if (!dateObj) return "-";

    return (
      dateObj.getFullYear() +
      "年" +
      (dateObj.getMonth() + 1) +
      "月" +
      dateObj.getDate() +
      "日" +
      "（" +
      WEEKDAY_LABELS[dateObj.getDay()] +
      "）"
    );
  }

  function startOfDay(dateObj) {
    return new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
  }

  function startOfWeek(dateObj) {
    const base = startOfDay(dateObj);
    return addDays(base, -base.getDay());
  }

  function addDays(dateObj, days) {
    const result = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
    result.setDate(result.getDate() + days);
    return startOfDay(result);
  }

  function isSameDate(a, b) {
    return (
      a &&
      b &&
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  function isDateInRange(target, start, end) {
    return target >= start && target <= end;
  }

  function normalizeTime(value) {
    return String(value || "").trim();
  }

  function toNumber(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  }

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function clearElement(element) {
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  return {
    init: init
  };
})();