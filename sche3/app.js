window.calendarData = window.calendarData || {};

let currentDate = new Date();
let currentView = "month";
let activeFilters = new Set();
const colors = [
    "#4f46e5",
    "#0ea5e9",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#14b8a6",
    "#ec4899"
];

const WEEK_LABELS = ["日", "月", "火", "水", "木", "金", "土"];
const MAX_MONTH_EVENTS = 3;

document.addEventListener("DOMContentLoaded", () => {
    if (typeof fileList === "undefined" || !Array.isArray(fileList) || fileList.length === 0) {
        initializeApp();
        return;
    }

    let loadedCount = 0;

    fileList.forEach((fileName) => {
        const script = document.createElement("script");
        script.src = `${fileName}.js`;

        script.onload = () => {
            loadedCount++;
            if (loadedCount === fileList.length) initializeApp();
        };

        script.onerror = () => {
            console.error(`${fileName}.js の読み込みに失敗しました。`);
            loadedCount++;
            if (loadedCount === fileList.length) initializeApp();
        };

        document.body.appendChild(script);
    });
});

function initializeApp() {
    setupSidebar();
    setupEventListeners();
    renderCalendar();
}

function setupSidebar() {
    const container = document.getElementById("calendar-toggles");
    const legendList = document.getElementById("legend-list");
    container.innerHTML = "";
    legendList.innerHTML = "";

    if (typeof fileList === "undefined" || !Array.isArray(fileList)) return;

    fileList.forEach((fileName, index) => {
        activeFilters.add(fileName);

        const color = colors[index % colors.length];

        const label = document.createElement("label");
        label.className = "toggle-label";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = true;
        checkbox.value = fileName;

        const swatch = document.createElement("span");
        swatch.className = "toggle-swatch";
        swatch.style.background = color;

        const textWrap = document.createElement("span");
        textWrap.className = "toggle-text-wrap";

        const name = document.createElement("span");
        name.className = "toggle-name";
        name.textContent = fileName;

        const count = document.createElement("span");
        count.className = "toggle-count";
        count.textContent = `${Array.isArray(window.calendarData[fileName]) ? window.calendarData[fileName].length : 0}件`;

        textWrap.appendChild(name);
        textWrap.appendChild(count);

        checkbox.addEventListener("change", (e) => {
            if (e.target.checked) {
                activeFilters.add(e.target.value);
            } else {
                activeFilters.delete(e.target.value);
            }
            renderCalendar();
        });

        label.appendChild(checkbox);
        label.appendChild(swatch);
        label.appendChild(textWrap);
        container.appendChild(label);

        const legend = document.createElement("div");
        legend.className = "legend-item";
        legend.innerHTML = `<span class="legend-swatch" style="background:${color}"></span><span>${escapeHtml(fileName)}</span>`;
        legendList.appendChild(legend);
    });
}

function setupEventListeners() {
    document.getElementById("btn-prev").addEventListener("click", () => changeDate(-1));
    document.getElementById("btn-next").addEventListener("click", () => changeDate(1));
    document.getElementById("btn-today").addEventListener("click", goToToday);

    const views = ["month", "week", "day"];
    views.forEach((view) => {
        document.getElementById(`btn-${view}`).addEventListener("click", (e) => {
            currentView = view;
            views.forEach((v) => document.getElementById(`btn-${v}`).classList.remove("active"));
            e.currentTarget.classList.add("active");
            renderCalendar();
        });
    });

    document.getElementById("btn-filter-all").addEventListener("click", () => {
        if (!Array.isArray(fileList)) return;
        activeFilters = new Set(fileList);
        syncCheckboxStates(true);
        renderCalendar();
    });

    document.getElementById("btn-filter-none").addEventListener("click", () => {
        activeFilters.clear();
        syncCheckboxStates(false);
        renderCalendar();
    });

    const sidebar = document.getElementById("sidebar");
    const backdrop = document.getElementById("sidebar-backdrop");

    document.getElementById("btn-sidebar-toggle").addEventListener("click", () => {
        sidebar.classList.add("open");
        backdrop.classList.add("show");
    });

    document.getElementById("btn-sidebar-close").addEventListener("click", closeSidebar);
    backdrop.addEventListener("click", closeSidebar);

    document.getElementById("modal-close").addEventListener("click", closeModal);
    document.getElementById("event-modal").addEventListener("click", (e) => {
        if (e.target.dataset.closeModal === "true") closeModal();
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            closeModal();
            closeSidebar();
        }
    });
}

function syncCheckboxStates(isChecked) {
    document.querySelectorAll('#calendar-toggles input[type="checkbox"]').forEach((input) => {
        input.checked = isChecked;
    });
}

function closeSidebar() {
    document.getElementById("sidebar").classList.remove("open");
    document.getElementById("sidebar-backdrop").classList.remove("show");
}

function goToToday() {
    currentDate = new Date();
    renderCalendar();
}

function changeDate(direction) {
    const nextDate = new Date(currentDate);

    if (currentView === "month") {
        nextDate.setMonth(nextDate.getMonth() + direction);
    } else if (currentView === "week") {
        nextDate.setDate(nextDate.getDate() + direction * 7);
    } else {
        nextDate.setDate(nextDate.getDate() + direction);
    }

    currentDate = nextDate;
    renderCalendar();
}

function renderCalendar() {
    const viewContainer = document.getElementById("calendar-view");
    const viewTitle = document.getElementById("view-title");
    const summary = document.getElementById("view-summary");

    viewContainer.innerHTML = "";
    updateDateDisplay();

    const allEvents = getFilteredEvents();

    viewTitle.textContent =
        currentView === "month" ? "月間スケジュール" :
        currentView === "week" ? "週間スケジュール" :
        "1日スケジュール";

    summary.innerHTML = `
        <span class="summary-chip">表示中 ${allEvents.length}件</span>
        <span class="summary-chip">選択 ${activeFilters.size}件</span>
    `;

    if (currentView === "month") {
        renderMonthView(viewContainer, allEvents);
    } else if (currentView === "week") {
        renderWeekView(viewContainer, allEvents);
    } else {
        renderDayView(viewContainer, allEvents);
    }
}

function updateDateDisplay() {
    const display = document.getElementById("current-date-display");
    const y = currentDate.getFullYear();
    const m = currentDate.getMonth() + 1;
    const d = currentDate.getDate();

    if (currentView === "month") {
        display.textContent = `${y}年 ${m}月`;
    } else if (currentView === "week") {
        const start = getStartOfWeek(currentDate);
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        display.textContent = `${formatShortDate(start)} 〜 ${formatShortDate(end)}`;
    } else {
        display.textContent = `${y}年 ${m}月 ${d}日（${WEEK_LABELS[currentDate.getDay()]}）`;
    }
}

function getFilteredEvents() {
    let events = [];

    activeFilters.forEach((fileName) => {
        const sourceEvents = Array.isArray(window.calendarData[fileName]) ? window.calendarData[fileName] : [];
        const colorIndex = Array.isArray(fileList) ? fileList.indexOf(fileName) : 0;

        const normalized = sourceEvents.map((e) => ({
            ...e,
            _source: fileName,
            _color: colors[(colorIndex >= 0 ? colorIndex : 0) % colors.length]
        }));

        events = events.concat(normalized);
    });

    return events;
}

function renderMonthView(container, allEvents) {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = firstDay.getDay();
    const totalCells = Math.ceil((startOffset + lastDay.getDate()) / 7) * 7;

    const grid = document.createElement("div");
    grid.className = "calendar-grid month-grid";

    WEEK_LABELS.forEach((day, index) => {
        const dayDiv = document.createElement("div");
        dayDiv.className = `calendar-header-day ${index === 0 ? "sun" : ""} ${index === 6 ? "sat" : ""}`;
        dayDiv.textContent = day;
        grid.appendChild(dayDiv);
    });

    for (let i = 0; i < totalCells; i++) {
        const cellDate = new Date(year, month, 1 - startOffset + i);
        const isCurrentMonth = cellDate.getMonth() === month;
        const dayDiv = createDayCell(cellDate, allEvents, {
            isCurrentMonth,
            compact: true
        });
        grid.appendChild(dayDiv);
    }

    container.appendChild(grid);
}

function renderWeekView(container, allEvents) {
    const start = getStartOfWeek(currentDate);

    const grid = document.createElement("div");
    grid.className = "calendar-grid week-grid";

    WEEK_LABELS.forEach((day, index) => {
        const head = document.createElement("div");
        head.className = `calendar-header-day ${index === 0 ? "sun" : ""} ${index === 6 ? "sat" : ""}`;
        head.textContent = day;
        grid.appendChild(head);
    });

    for (let i = 0; i < 7; i++) {
        const date = new Date(start);
        date.setDate(start.getDate() + i);
        const cell = createDayCell(date, allEvents, {
            isCurrentMonth: true,
            compact: false
        });
        grid.appendChild(cell);
    }

    container.appendChild(grid);
}

function renderDayView(container, allEvents) {
    const wrapper = document.createElement("div");
    wrapper.className = "day-view-panel";

    const dateTitle = document.createElement("div");
    dateTitle.className = "day-view-head";
    dateTitle.innerHTML = `
        <h3>${formatFullDate(currentDate)}</h3>
        <p>${WEEK_LABELS[currentDate.getDay()]}曜日の予定一覧</p>
    `;

    wrapper.appendChild(dateTitle);

    const dayEvents = getEventsForDate(currentDate, allEvents);

    if (dayEvents.length === 0) {
        const empty = document.createElement("div");
        empty.className = "empty-state";
        empty.textContent = "この日の予定はありません。";
        wrapper.appendChild(empty);
    } else {
        const list = document.createElement("div");
        list.className = "day-event-list";

        dayEvents.forEach((e) => {
            list.appendChild(createDetailedEventCard(e));
        });

        wrapper.appendChild(list);
    }

    container.appendChild(wrapper);
}

function createDayCell(dateObj, allEvents, options = {}) {
    const { isCurrentMonth = true, compact = false } = options;

    const cell = document.createElement("div");
    cell.className = "calendar-day";
    if (!isCurrentMonth) cell.classList.add("other-month");
    if (isToday(dateObj)) cell.classList.add("today");
    if (dateObj.getDay() === 0) cell.classList.add("is-sun");
    if (dateObj.getDay() === 6) cell.classList.add("is-sat");

    const head = document.createElement("div");
    head.className = "day-cell-head";

    const dateLabel = document.createElement("div");
    dateLabel.className = "date-number";
    dateLabel.textContent = `${dateObj.getDate()}`;

    const weekday = document.createElement("div");
    weekday.className = "weekday-mini";
    weekday.textContent = WEEK_LABELS[dateObj.getDay()];

    head.appendChild(dateLabel);
    head.appendChild(weekday);
    cell.appendChild(head);

    const events = getEventsForDate(dateObj, allEvents);

    if (events.length === 0) {
        const spacer = document.createElement("div");
        spacer.className = "day-spacer";
        cell.appendChild(spacer);
        return cell;
    }

    const list = document.createElement("div");
    list.className = "day-events";
    cell.appendChild(list);

    const visibleEvents = compact ? events.slice(0, MAX_MONTH_EVENTS) : events;

    visibleEvents.forEach((e) => {
        const eventEl = document.createElement("button");
        eventEl.type = "button";
        eventEl.className = "event-item";
        eventEl.style.background = `linear-gradient(135deg, ${e._color}, ${hexToRgba(e._color, 0.78)})`;

        const time = buildEventTimeLabel(e, dateObj);
        const title = e["予定詳細"] || e["予定"] || "予定あり";

        eventEl.innerHTML = `
            <span class="event-time">${escapeHtml(time)}</span>
            <span class="event-title">${escapeHtml(title)}</span>
            <span class="event-source">${escapeHtml(e._source)}</span>
        `;

        eventEl.addEventListener("click", () => openEventModal(e));
        list.appendChild(eventEl);
    });

    if (compact && events.length > MAX_MONTH_EVENTS) {
        const moreBtn = document.createElement("button");
        moreBtn.type = "button";
        moreBtn.className = "more-events";
        moreBtn.textContent = `＋${events.length - MAX_MONTH_EVENTS}件`;
        moreBtn.addEventListener("click", () => {
            currentDate = new Date(dateObj);
            currentView = "day";
            ["month", "week", "day"].forEach((v) => {
                document.getElementById(`btn-${v}`).classList.toggle("active", v === "day");
            });
            renderCalendar();
        });
        list.appendChild(moreBtn);
    }

    return cell;
}

function createDetailedEventCard(e) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "event-detail-card";
    card.style.setProperty("--card-accent", e._color);

    const title = e["予定詳細"] || e["予定"] || "予定あり";
    const place = [e["場所"], e["場所詳細"]].filter(Boolean).join(" / ");
    const time = `${e["開始日"] || ""} ${e["開始時刻"] || ""}${e["終了時刻"] ? " ～ " + e["終了時刻"] : ""}`;

    card.innerHTML = `
        <div class="event-detail-top">
            <span class="event-detail-source">${escapeHtml(e._source)}</span>
            <span class="event-detail-time">${escapeHtml(time.trim())}</span>
        </div>
        <div class="event-detail-title">${escapeHtml(title)}</div>
        <div class="event-detail-meta">
            <span>${escapeHtml(place || "場所未設定")}</span>
        </div>
    `;

    card.addEventListener("click", () => openEventModal(e));
    return card;
}

function getEventsForDate(dateObj, allEvents) {
    return allEvents
        .filter((e) => isEventOnDate(e, dateObj))
        .sort(compareEvents);
}

function isEventOnDate(event, dateObj) {
    const start = parseDateOnly(event["開始日"]);
    if (!start) return false;

    const end = parseDateOnly(event["終了日"]) || start;
    const target = startOfDay(dateObj);

    return target >= start && target <= end;
}

function compareEvents(a, b) {
    const aTime = a["開始時刻"] || "99:99";
    const bTime = b["開始時刻"] || "99:99";
    const timeComp = aTime.localeCompare(bTime, "ja");
    if (timeComp !== 0) return timeComp;
    return (a["予定詳細"] || a["予定"] || "").localeCompare(b["予定詳細"] || b["予定"] || "", "ja");
}

function buildEventTimeLabel(event, dateObj) {
    const startDate = parseDateOnly(event["開始日"]);
    const endDate = parseDateOnly(event["終了日"]) || startDate;
    const startTime = event["開始時刻"] || "";
    const endTime = event["終了時刻"] || "";

    if (!startDate) return "時刻未設定";

    const target = startOfDay(dateObj);
    const sameDayRange = isSameDate(startDate, endDate);

    if (sameDayRange) {
        if (startTime && endTime) return `${startTime}～${endTime}`;
        if (startTime) return startTime;
        return "終日";
    }

    if (isSameDate(target, startDate)) return startTime ? `${startTime}～` : "開始";
    if (isSameDate(target, endDate)) return endTime ? `～${endTime}` : "終了";
    return "継続";
}

function openEventModal(e) {
    const modal = document.getElementById("event-modal");
    const title = document.getElementById("modal-title");
    const body = document.getElementById("modal-body");

    title.textContent = e["予定詳細"] || e["予定"] || "予定";

    body.innerHTML = `
        <div class="detail-grid">
            ${buildDetailRow("カレンダー", e._source)}
            ${buildDetailRow("開始", `${e["開始日"] || ""} ${e["開始時刻"] || ""}`.trim())}
            ${buildDetailRow("終了", `${e["終了日"] || ""} ${e["終了時刻"] || ""}`.trim())}
            ${buildDetailRow("予定", e["予定"] || "")}
            ${buildDetailRow("予定詳細", e["予定詳細"] || "")}
            ${buildDetailRow("場所", e["場所"] || "")}
            ${buildDetailRow("場所詳細", e["場所詳細"] || "")}
            ${buildDetailRow("内容", e["内容"] || "")}
            ${buildDetailRow("情報公開レベル", e["情報公開レベル"] || "")}
            ${buildDetailRow("重要度", e["重要度"] || "")}
            ${buildDetailRow("予約種別", e["予約種別"] || "")}
        </div>
    `;

    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");
}

function buildDetailRow(label, value) {
    return `
        <div class="detail-row">
            <div class="detail-label">${escapeHtml(label)}</div>
            <div class="detail-value">${escapeHtml(value || "—")}</div>
        </div>
    `;
}

function closeModal() {
    const modal = document.getElementById("event-modal");
    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");
}

function getStartOfWeek(date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - start.getDay());
    return start;
}

function parseDateOnly(value) {
    if (!value) return null;
    const parts = String(value).split("/");
    if (parts.length !== 3) return null;

    const y = Number(parts[0]);
    const m = Number(parts[1]) - 1;
    const d = Number(parts[2]);

    if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return null;
    return new Date(y, m, d);
}

function startOfDay(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

function isToday(date) {
    const today = new Date();
    return isSameDate(today, date);
}

function isSameDate(a, b) {
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    );
}

function formatShortDate(date) {
    return `${date.getFullYear()}年 ${date.getMonth() + 1}月 ${date.getDate()}日`;
}

function formatFullDate(date) {
    return `${date.getFullYear()}年 ${date.getMonth() + 1}月 ${date.getDate()}日`;
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function hexToRgba(hex, alpha) {
    const h = hex.replace("#", "");
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    const bigint = parseInt(full, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}