window.CALENDAR2_APP = (function () {
  "use strict";

  const CATEGORY_META = {
    TERM: { label: "会期", color: "#2859b8", soft: "#e8efff" },
    MEETING: { label: "本会議", color: "#1d6f5f", soft: "#e0f4ef" },
    COMMITTEE: { label: "委員会", color: "#c97a1f", soft: "#fff1dd" },
    QUESTION: { label: "一般質問", color: "#bb473b", soft: "#fde9e5" },
    RESERVE: { label: "予約", color: "#00808a", soft: "#e1f6f8" },
    HOLIDAY: { label: "休日", color: "#8b5cf6", soft: "#f0eaff" },
    OTHER: { label: "その他", color: "#5b6b73", soft: "#ebf0f2" }
  };

  const state = {
    calendar: null,
    normalizedEvents: [],
    activeCategories: new Set(),
    currentRange: null
  };

  const dom = {};

  function init() {
    if (!window.FullCalendar || !window.FullCalendar.Calendar) {
      return;
    }

    cacheDom();
    state.normalizedEvents = loadEvents();
    state.activeCategories = new Set(collectCategories(state.normalizedEvents));

    renderCategoryFilters();
    renderCategoryLegend();
    renderEventCount();
    renderEmptyDetail();
    createCalendar();
    bindEvents();
    updateMetrics();
  }

  function cacheDom() {
    dom.calendar = document.getElementById("calendar");
    dom.categoryFilters = document.getElementById("categoryFilters");
    dom.categoryLegend = document.getElementById("categoryLegend");
    dom.detailCard = document.getElementById("detailCard");
    dom.eventCountLabel = document.getElementById("eventCountLabel");
    dom.rangeLabel = document.getElementById("rangeLabel");
    dom.visibleCountLabel = document.getElementById("visibleCountLabel");
    dom.activeCategoryLabel = document.getElementById("activeCategoryLabel");
  }

  function bindEvents() {
    if (!dom.categoryFilters) {
      return;
    }

    dom.categoryFilters.addEventListener("change", function (event) {
      const target = event.target;
      if (!target || target.type !== "checkbox") {
        return;
      }

      const category = String(target.value || "").toUpperCase();
      if (!category) {
        return;
      }

      if (target.checked) {
        state.activeCategories.add(category);
      } else {
        state.activeCategories.delete(category);
      }

      if (state.calendar) {
        state.calendar.refetchEvents();
      }

      updateMetrics();
      renderEmptyDetail();
    });
  }

  function createCalendar() {
    if (!dom.calendar) {
      return;
    }

    state.calendar = new FullCalendar.Calendar(dom.calendar, {
      locale: "ja",
      initialView: "dayGridMonth",
      initialDate: getInitialDate(state.normalizedEvents),
      height: "auto",
      firstDay: 0,
      navLinks: true,
      nowIndicator: true,
      dayMaxEvents: 3,
      expandRows: true,
      stickyHeaderDates: true,
      eventTimeFormat: { hour: "2-digit", minute: "2-digit", hour12: false },
      headerToolbar: {
        left: "prev,next today",
        center: "title",
        right: "dayGridMonth,timeGridWeek,listMonth"
      },
      views: {
        dayGridMonth: { buttonText: "月" },
        timeGridWeek: { buttonText: "週" },
        listMonth: { buttonText: "一覧" }
      },
      buttonText: {
        today: "今日"
      },
      plugins: [
        FullCalendar.DayGrid.default,
        FullCalendar.TimeGrid.default,
        FullCalendar.List.default,
        FullCalendar.Interaction.default
      ],
      noEventsContent: "表示できる予定がありません",
      events: function (_fetchInfo, successCallback) {
        successCallback(getCalendarEvents());
      },
      eventDidMount: function (info) {
        decorateEventElement(info);
      },
      eventClick: function (info) {
        info.jsEvent.preventDefault();
        renderEventDetail(info.event.extendedProps.source || null);
      },
      dateClick: function (info) {
        renderDateDetail(info.date);
      },
      datesSet: function (info) {
        state.currentRange = {
          start: startOfDay(info.view.currentStart || info.start),
          endExclusive: startOfDay(info.view.currentEnd || info.end),
          viewType: info.view.type
        };
        updateMetrics();
      }
    });

    state.calendar.render();
  }

  function loadEvents() {
    const source = window.APP_DATA && Array.isArray(window.APP_DATA.events)
      ? window.APP_DATA.events
      : [];

    return source
      .map(normalizeEvent)
      .filter(Boolean)
      .sort(compareEvents);
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
    const category = normalizeCategory(item.category);

    return {
      id: String(item.event_id || ""),
      title: String(item.title || ""),
      startDate: startDate,
      endDate: safeEndDate,
      startDateText: formatDate(startDate),
      endDateText: formatDate(safeEndDate),
      startTime: normalizeTime(item.start_time),
      endTime: normalizeTime(item.end_time),
      isAllDay: Number(item.is_all_day) === 1,
      category: category,
      departmentName: String(item.department_name || ""),
      location: String(item.location || ""),
      note: String(item.note || ""),
      sortOrder: toNumber(item.sort_order)
    };
  }

  function getCalendarEvents() {
    return getFilteredEvents().map(function (item) {
      const meta = getCategoryMeta(item.category);
      const eventInput = {
        id: item.id,
        title: item.title,
        allDay: item.isAllDay,
        classNames: [
          "event-category",
          "event-category-" + item.category.toLowerCase()
        ],
        extendedProps: {
          source: item
        },
        backgroundColor: meta.soft,
        borderColor: meta.color,
        textColor: "#173026"
      };

      if (item.isAllDay) {
        eventInput.start = item.startDateText;
        if (item.startDateText !== item.endDateText) {
          eventInput.end = formatDate(addDays(item.endDate, 1));
        }
      } else {
        eventInput.start = item.startDateText + "T" + (item.startTime || "00:00");
        if (item.endDateText !== item.startDateText) {
          eventInput.end = item.endDateText + "T" + (item.endTime || "23:59");
        } else if (item.endTime) {
          eventInput.end = item.endDateText + "T" + item.endTime;
        }
      }

      return eventInput;
    });
  }

  function getFilteredEvents() {
    return state.normalizedEvents.filter(function (item) {
      return state.activeCategories.has(item.category);
    });
  }

  function renderCategoryFilters() {
    if (!dom.categoryFilters) {
      return;
    }

    clearElement(dom.categoryFilters);

    collectCategories(state.normalizedEvents).forEach(function (category) {
      const meta = getCategoryMeta(category);
      const label = document.createElement("label");
      label.className = "filter-chip";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = category;
      checkbox.checked = state.activeCategories.has(category);

      const text = document.createElement("span");
      text.textContent = meta.label;
      text.style.setProperty("--chip-color", meta.color);

      label.appendChild(checkbox);
      label.appendChild(text);
      dom.categoryFilters.appendChild(label);
    });
  }

  function renderCategoryLegend() {
    if (!dom.categoryLegend) {
      return;
    }

    clearElement(dom.categoryLegend);

    collectCategories(state.normalizedEvents).forEach(function (category) {
      const meta = getCategoryMeta(category);
      const item = document.createElement("div");
      item.className = "legend-item";

      const dot = document.createElement("span");
      dot.className = "legend-dot";
      dot.style.setProperty("--chip-color", meta.color);

      const name = document.createElement("span");
      name.className = "legend-item__name";
      name.textContent = meta.label;

      const code = document.createElement("span");
      code.className = "legend-item__code";
      code.textContent = category;

      item.appendChild(dot);
      item.appendChild(name);
      item.appendChild(code);
      dom.categoryLegend.appendChild(item);
    });
  }

  function renderEventCount() {
    if (dom.eventCountLabel) {
      dom.eventCountLabel.textContent = "予定 " + state.normalizedEvents.length + " 件";
    }
  }

  function updateMetrics() {
    const filtered = getFilteredEvents();
    const activeCount = state.activeCategories.size;
    const visibleCount = state.currentRange
      ? countEventsInRange(filtered, state.currentRange.start, state.currentRange.endExclusive)
      : filtered.length;

    if (dom.visibleCountLabel) {
      dom.visibleCountLabel.textContent = visibleCount + " 件";
    }

    if (dom.activeCategoryLabel) {
      dom.activeCategoryLabel.textContent = String(activeCount);
    }

    if (dom.rangeLabel) {
      dom.rangeLabel.textContent = state.currentRange
        ? buildRangeLabel(state.currentRange)
        : "-";
    }
  }

  function renderEmptyDetail() {
    if (!dom.detailCard) {
      return;
    }

    dom.detailCard.innerHTML = "";

    const wrapper = document.createElement("div");
    wrapper.className = "detail-empty";

    const title = document.createElement("strong");
    title.textContent = "予定を選択してください";

    const text = document.createElement("p");
    text.textContent = state.activeCategories.size === 0
      ? "カテゴリがすべてオフです。少なくとも 1 つ選ぶと予定が表示されます。"
      : "カレンダー上の予定、または日付をクリックするとここに内容が出ます。";

    wrapper.appendChild(title);
    wrapper.appendChild(text);
    dom.detailCard.appendChild(wrapper);
  }

  function renderEventDetail(item) {
    if (!dom.detailCard || !item) {
      return;
    }

    const meta = getCategoryMeta(item.category);
    dom.detailCard.innerHTML = "";

    const block = document.createElement("div");
    block.className = "detail-block";

    const title = document.createElement("h3");
    title.className = "detail-title";
    title.textContent = item.title;

    const tags = document.createElement("div");
    tags.className = "detail-tags";
    tags.appendChild(createDetailTag(meta.label, meta.color, true));
    tags.appendChild(createDetailTag(buildDateLabel(item)));
    tags.appendChild(createDetailTag(buildTimeLabel(item)));

    const grid = document.createElement("div");
    grid.className = "detail-grid";
    grid.appendChild(createDetailRow("部署", item.departmentName || "-"));
    grid.appendChild(createDetailRow("場所", item.location || "-"));
    grid.appendChild(createDetailRow("備考", item.note || "-"));

    block.appendChild(title);
    block.appendChild(tags);
    block.appendChild(grid);
    dom.detailCard.appendChild(block);
  }

  function renderDateDetail(date) {
    if (!dom.detailCard || !date) {
      return;
    }

    const dateText = formatDisplayDate(date);
    const items = getFilteredEvents().filter(function (item) {
      return isDateWithinEvent(date, item);
    });

    dom.detailCard.innerHTML = "";

    const block = document.createElement("div");
    block.className = "detail-block";

    const title = document.createElement("h3");
    title.className = "detail-title";
    title.textContent = dateText;

    const tags = document.createElement("div");
    tags.className = "detail-tags";
    tags.appendChild(createDetailTag("該当予定 " + items.length + " 件"));

    const list = document.createElement("div");
    list.className = "detail-list";

    if (items.length === 0) {
      list.appendChild(createDetailRow("予定", "この日に表示対象の予定はありません。"));
    } else {
      items.forEach(function (item) {
        const meta = getCategoryMeta(item.category);
        const entry = document.createElement("div");
        entry.className = "detail-list__item";
        entry.style.setProperty("--chip-color", meta.color);

        const heading = document.createElement("h4");
        heading.className = "detail-list__heading";
        heading.textContent = item.title;

        const body = document.createElement("p");
        body.className = "detail-list__meta";
        body.textContent = [
          meta.label,
          buildTimeLabel(item),
          item.location || "",
          item.departmentName || ""
        ].filter(Boolean).join(" / ");

        entry.appendChild(heading);
        entry.appendChild(body);
        entry.addEventListener("click", function () {
          renderEventDetail(item);
        });
        list.appendChild(entry);
      });
    }

    block.appendChild(title);
    block.appendChild(tags);
    block.appendChild(list);
    dom.detailCard.appendChild(block);
  }

  function createDetailTag(text, color, isCategory) {
    const tag = document.createElement("span");
    tag.className = "detail-tag" + (isCategory ? " detail-tag--category" : "");
    tag.textContent = text;
    if (color) {
      tag.style.setProperty("--chip-color", color);
    }
    return tag;
  }

  function createDetailRow(label, value) {
    const row = document.createElement("div");
    row.className = "detail-row";

    const labelEl = document.createElement("span");
    labelEl.className = "detail-row__label";
    labelEl.textContent = label;

    const valueEl = document.createElement("div");
    valueEl.className = "detail-row__value";
    valueEl.textContent = value;

    row.appendChild(labelEl);
    row.appendChild(valueEl);
    return row;
  }

  function decorateEventElement(info) {
    const source = info.event.extendedProps.source;
    if (!source || !info.el) {
      return;
    }

    const meta = getCategoryMeta(source.category);
    info.el.style.setProperty("--event-accent", meta.color);
    info.el.style.setProperty("--event-soft", meta.soft);
    info.el.style.setProperty("--event-text", "#173026");
    info.el.title = buildTooltip(source);
  }

  function collectCategories(items) {
    const seen = new Set();
    const ordered = [];

    items.forEach(function (item) {
      if (!seen.has(item.category)) {
        seen.add(item.category);
        ordered.push(item.category);
      }
    });

    return ordered;
  }

  function getCategoryMeta(category) {
    return CATEGORY_META[category] || {
      label: category,
      color: "#5b6b73",
      soft: "#ebf0f2"
    };
  }

  function compareEvents(a, b) {
    if (a.startDateText !== b.startDateText) {
      return a.startDateText.localeCompare(b.startDateText);
    }

    if (a.isAllDay !== b.isAllDay) {
      return a.isAllDay ? -1 : 1;
    }

    if (a.sortOrder !== b.sortOrder) {
      return a.sortOrder - b.sortOrder;
    }

    if (a.startTime !== b.startTime) {
      return a.startTime.localeCompare(b.startTime);
    }

    return a.title.localeCompare(b.title, "ja");
  }

  function buildTooltip(item) {
    return [
      item.title,
      buildDateLabel(item),
      buildTimeLabel(item),
      item.location ? "場所: " + item.location : "",
      item.departmentName ? "部署: " + item.departmentName : ""
    ].filter(Boolean).join("\n");
  }

  function buildDateLabel(item) {
    if (item.startDateText === item.endDateText) {
      return formatDisplayDate(item.startDate);
    }

    return formatDisplayDate(item.startDate) + " - " + formatDisplayDate(item.endDate);
  }

  function buildTimeLabel(item) {
    if (item.isAllDay) {
      return "終日";
    }

    if (item.startTime && item.endTime) {
      return item.startTime + " - " + item.endTime;
    }

    if (item.startTime) {
      return item.startTime;
    }

    return "-";
  }

  function buildRangeLabel(range) {
    const endDate = addDays(range.endExclusive, -1);
    if (range.viewType === "dayGridMonth" || range.viewType === "listMonth") {
      return range.start.getFullYear() + "年" + (range.start.getMonth() + 1) + "月";
    }

    return formatDisplayDate(range.start) + " - " + formatDisplayDate(endDate);
  }

  function countEventsInRange(items, start, endExclusive) {
    return items.filter(function (item) {
      return item.startDate < endExclusive && addDays(item.endDate, 1) > start;
    }).length;
  }

  function getInitialDate(items) {
    if (items.length === 0) {
      return new Date();
    }

    const today = startOfDay(new Date());
    const todayText = formatDate(today);
    const hasTodayRelatedEvent = items.some(function (item) {
      return todayText >= item.startDateText && todayText <= item.endDateText;
    });

    return hasTodayRelatedEvent ? today : items[0].startDate;
  }

  function isDateWithinEvent(date, item) {
    const target = formatDate(startOfDay(date));
    return target >= item.startDateText && target <= item.endDateText;
  }

  function parseDate(value) {
    const parts = String(value || "").split("-");
    if (parts.length !== 3) {
      return null;
    }

    const year = Number(parts[0]);
    const month = Number(parts[1]) - 1;
    const day = Number(parts[2]);
    const date = new Date(year, month, day);

    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month ||
      date.getDate() !== day
    ) {
      return null;
    }

    return startOfDay(date);
  }

  function formatDate(date) {
    return [
      date.getFullYear(),
      pad2(date.getMonth() + 1),
      pad2(date.getDate())
    ].join("-");
  }

  function formatDisplayDate(date) {
    const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
    return (
      date.getFullYear() +
      "年" +
      (date.getMonth() + 1) +
      "月" +
      date.getDate() +
      "日 (" +
      weekdays[date.getDay()] +
      ")"
    );
  }

  function normalizeCategory(value) {
    const category = String(value || "OTHER").trim().toUpperCase();
    return category || "OTHER";
  }

  function normalizeTime(value) {
    return String(value || "").trim();
  }

  function toNumber(value) {
    const result = Number(value);
    return Number.isFinite(result) ? result : 0;
  }

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function addDays(date, days) {
    const next = startOfDay(date);
    next.setDate(next.getDate() + days);
    return next;
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
