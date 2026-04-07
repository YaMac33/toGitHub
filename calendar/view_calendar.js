window.APP_DATA = window.APP_DATA || {};

window.CALENDAR_VIEW = (function () {
  "use strict";

  const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];
  const MAX_VISIBLE_EVENTS = 3;

  const state = {
    currentView: "month",
    currentDate: null,
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

    dom.monthViewArea = document.getElementById("monthViewArea");
    dom.weekViewArea = document.getElementById("weekViewArea");
    dom.calendarGrid = document.getElementById("calendarGrid");
    dom.calendarWeekList = document.getElementById("calendarWeekList");

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
    const rawEvents = Array.isArray(window.APP_DATA.events) ? window.APP_DATA.events : [];

    state.events = rawEvents
      .map(normalizeEvent)
      .filter(function (item) {
        return !!item;
      });
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
      category: normalizeCategory(item.category),
      department_name: String(item.department_name || ""),
      location: String(item.location || ""),
      note: String(item.note || ""),
      sort_order: toNumber(item.sort_order)
    };
  }

  function render() {
    updateToolbar();
    updateViewVisibility();

    if (state.currentView === "week") {
      renderWeekView();
    } else {
      renderMonthView();
    }
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
  }

  function updateViewVisibility() {
    if (dom.monthViewArea) {
      dom.monthViewArea.classList.toggle("is-hidden", state.currentView !== "month");
    }

    if (dom.weekViewArea) {
      dom.weekViewArea.classList.toggle("is-hidden", state.currentView !== "week");
    }
  }

  function renderMonthView() {
    if (!dom.calendarGrid) {
      return;
    }

    clearElement(dom.calendarGrid);

    const baseDate = startOfDay(state.currentDate);
    const monthStart = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
    const gridStart = startOfWeek(monthStart);

    for (let i = 0; i < 42; i += 1) {
      const cellDate = addDays(gridStart, i);
      const isOtherMonth = cellDate.getMonth() !== monthStart.getMonth();
      const cell = createMonthCell(cellDate, isOtherMonth);
      dom.calendarGrid.appendChild(cell);
    }
  }

  function createMonthCell(dateObj, isOtherMonth) {
    const cell = document.createElement("div");
    cell.className = "calendar-cell";

    if (isOtherMonth) {
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
      eventsWrap.appendChild(createEventChip(eventItem, true));
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

  function renderWeekView() {
    if (!dom.calendarWeekList) {
      return;
    }

    clearElement(dom.calendarWeekList);

    const weekStart = startOfWeek(state.currentDate);

    for (let i = 0; i < 7; i += 1) {
      const rowDate = addDays(weekStart, i);
      const row = createWeekRow(rowDate);
      dom.calendarWeekList.appendChild(row);
    }
  }

  function createWeekRow(dateObj) {
    const row = document.createElement("div");
    row.className = "week-row";
    row.dataset.date = formatDate(dateObj);

    if (isSameDate(dateObj, new Date())) {
      row.classList.add("week-row--today");
    }

    if (state.selectedDate && isSameDate(dateObj, state.selectedDate)) {
      row.classList.add("week-row--selected");
    }

    const dateArea = document.createElement("div");
    dateArea.className = "week-row__date";

    const dateMain = document.createElement("div");
    dateMain.className = "week-row__date-main";
    dateMain.textContent = (dateObj.getMonth() + 1) + "月" + dateObj.getDate() + "日";

    const dateSub = document.createElement("div");
    dateSub.className = "week-row__date-sub";
    dateSub.textContent = WEEKDAY_LABELS[dateObj.getDay()] + "曜日";

    if (dateObj.getDay() === 0) {
      dateSub.classList.add("week-row__date-sub--sun");
    } else if (dateObj.getDay() === 6) {
      dateSub.classList.add("week-row__date-sub--sat");
    }

    dateArea.appendChild(dateMain);
    dateArea.appendChild(dateSub);

    const contentArea = document.createElement("div");
    contentArea.className = "week-row__content";

    const eventsWrap = document.createElement("div");
    eventsWrap.className = "week-row__events";

    const dayEvents = getEventsForDate(dateObj);
    const visibleEvents = dayEvents.slice(0, MAX_VISIBLE_EVENTS);
    const hiddenCount = Math.max(dayEvents.length - MAX_VISIBLE_EVENTS, 0);

    if (visibleEvents.length === 0) {
      const empty = document.createElement("div");
      empty.className = "week-row__empty";
      empty.textContent = "";
      eventsWrap.appendChild(empty);
    } else {
      visibleEvents.forEach(function (eventItem) {
        eventsWrap.appendChild(createEventChip(eventItem, false));
      });
    }

    if (hiddenCount > 0) {
      eventsWrap.appendChild(createMoreChip(hiddenCount));
    }

    contentArea.appendChild(eventsWrap);

    row.appendChild(dateArea);
    row.appendChild(contentArea);

    row.addEventListener("click", function (event) {
      if (event.target.closest(".event-chip")) {
        return;
      }
      state.selectedDate = startOfDay(dateObj);
      render();
    });

    return row;
  }

  function createEventChip(eventItem, isMonthView) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "event-chip category-" + sanitizeCategory(eventItem.category);
    button.title = buildEventTooltip(eventItem);

    const timeLabel = getEventTimeLabel(eventItem);

    if (timeLabel) {
      const timeSpan = document.createElement("span");
      timeSpan.className = "event-chip__time";
      timeSpan.textContent = timeLabel;
      button.appendChild(timeSpan);
    }

    const titleSpan = document.createElement("span");
    titleSpan.className = "event-chip__title";
    titleSpan.textContent = eventItem.title;
    button.appendChild(titleSpan);

    if (!isMonthView && eventItem.location) {
      button.title = buildEventTooltip(eventItem) + "\n場所: " + eventItem.location;
    }

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

    const year = state.currentDate.getFullYear();
    const month = state.currentDate.getMonth();
    if (
      state.selectedDate.getFullYear() !== year ||
      state.selectedDate.getMonth() !== month
    ) {
      state.selectedDate = new Date(year, month, 1);
    }
  }

  function getCurrentLabel() {
    if (state.currentView === "week") {
      return buildWeekLabel(state.currentDate);
    }
    return buildMonthLabel(state.currentDate);
  }

  function buildMonthLabel(dateObj) {
    const year = dateObj.getFullYear();
    const wareki = toWarekiYearText(year);
    return wareki + "年(" + year + "年)" + (dateObj.getMonth() + 1) + "月";
  }

  function buildWeekLabel(dateObj) {
    const start = startOfWeek(dateObj);
    const end = addDays(start, 6);
    const year = start.getFullYear();
    const wareki = toWarekiYearText(year);

    let endText = (end.getMonth() + 1) + "月" + end.getDate() + "日";

    if (start.getFullYear() !== end.getFullYear()) {
      endText =
        toWarekiYearText(end.getFullYear()) +
        "年(" +
        end.getFullYear() +
        "年)" +
        (end.getMonth() + 1) +
        "月" +
        end.getDate() +
        "日";
    }

    return (
      wareki +
      "年(" +
      year +
      "年)" +
      (start.getMonth() + 1) +
      "月" +
      start.getDate() +
      "日〜" +
      endText
    );
  }

  function toWarekiYearText(seirekiYear) {
    if (seirekiYear >= 2019) {
      return "令和" + (seirekiYear - 2018);
    }
    if (seirekiYear >= 1989) {
      return "平成" + (seirekiYear - 1988);
    }
    if (seirekiYear >= 1926) {
      return "昭和" + (seirekiYear - 1925);
    }
    return String(seirekiYear);
  }

  function openModal(eventItem) {
    if (!dom.eventModal || !dom.modalBody) {
      return;
    }

    clearElement(dom.modalBody);

    const detail = document.createElement("dl");
    detail.className = "modal-detail";

    appendDetailRow(detail, "件名", eventItem.title || "-");
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
      return formatDateForDisplay(eventItem.date) + "〜" + formatDateForDisplay(eventItem.end_date);
    }
    return formatDateForDisplay(eventItem.date);
  }

  function buildTimeRangeLabel(eventItem) {
    if (eventItem.is_all_day === 1) {
      return "終日";
    }

    if (eventItem.start_time && eventItem.end_time) {
      return eventItem.start_time + "〜" + eventItem.end_time;
    }

    if (eventItem.start_time) {
      return eventItem.start_time;
    }

    return "-";
  }

  function buildEventTooltip(eventItem) {
    const parts = [];

    if (eventItem.title) {
      parts.push(eventItem.title);
    }

    const dateLabel = buildDateLabel(eventItem);
    if (dateLabel && dateLabel !== "-") {
      parts.push(dateLabel);
    }

    const timeLabel = buildTimeRangeLabel(eventItem);
    if (timeLabel && timeLabel !== "-") {
      parts.push(timeLabel);
    }

    return parts.join("\n");
  }

  function getEventTimeLabel(eventItem) {
    if (eventItem.is_all_day === 1) {
      return "終日";
    }
    return eventItem.start_time || "";
  }

  function formatDateForDisplay(value) {
    const dateObj = typeof value === "string" ? parseDate(value) : value;
    if (!dateObj) {
      return "-";
    }

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

  function parseDate(value) {
    if (!value) {
      return null;
    }

    const parts = String(value).split("-");
    if (parts.length !== 3) {
      return null;
    }

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
    return (
      dateObj.getFullYear() +
      "-" +
      pad2(dateObj.getMonth() + 1) +
      "-" +
      pad2(dateObj.getDate())
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
      !!a &&
      !!b &&
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

  function normalizeCategory(value) {
    const safe = String(value || "OTHER").trim().toUpperCase();
    return safe || "OTHER";
  }

  function sanitizeCategory(value) {
    return String(value || "OTHER")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, "") || "OTHER";
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