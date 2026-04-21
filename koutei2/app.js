window.addEventListener("DOMContentLoaded", () => {
  "use strict";

  const elements = {
    app: document.getElementById("app"),
    pageTitle: document.getElementById("pageTitle"),
    pageSubtitle: document.getElementById("pageSubtitle"),
    pagePeriod: document.getElementById("metaPeriod"),
    pageParticipants: document.getElementById("metaParticipants"),
    pageNote: document.getElementById("metaNote"),
    overview: document.getElementById("overview"),
    dayNav: document.getElementById("dayNav"),
    printButton: document.getElementById("printButton")
  };

  setupPrintButton(elements.printButton);

  const meta = window.KOUTEI_DATA?.meta || {};
  const rows = Array.isArray(window.KOUTEI_DATA?.itinerary)
    ? window.KOUTEI_DATA.itinerary
    : [];

  renderHeaderMeta({
    meta,
    rows,
    pageTitle: elements.pageTitle,
    pageSubtitle: elements.pageSubtitle,
    pagePeriod: elements.pagePeriod,
    pageParticipants: elements.pageParticipants,
    pageNote: elements.pageNote
  });

  if (!elements.app) return;

  const normalized = rows
    .map(normalizeRow)
    .filter((row) => row.date && hasVisibleContent(row));

  if (!normalized.length) {
    hideElement(elements.overview);
    hideElement(elements.dayNav);
    elements.app.innerHTML = `<div class="empty-state">行程データがありません。</div>`;
    return;
  }

  const sorted = normalized.sort(compareItinerary);
  const grouped = buildDayGroups(sorted);
  const summary = buildSummary(grouped);

  renderOverview(summary, elements.overview);
  renderDayNav(grouped, elements.dayNav);
  elements.app.innerHTML = grouped
    .map((group, dayIndex) => renderDaySection(group, dayIndex))
    .join("");

  setupSectionObserver(elements.dayNav);
});

function setupPrintButton(button) {
  if (!button) return;

  if (typeof window.print !== "function") {
    button.hidden = true;
    return;
  }

  button.addEventListener("click", () => window.print());
}

function renderHeaderMeta(params) {
  const {
    meta,
    rows,
    pageTitle,
    pageSubtitle,
    pagePeriod,
    pageParticipants,
    pageNote
  } = params;

  const title = safeText(meta.title) || "行程表";
  const subtitle = safeText(meta.subtitle);
  const participants = safeText(meta.participants);
  const note = safeText(meta.note);

  const inferred = inferPeriodFromRows(rows);
  const periodStart = normalizeDate(meta.period_start) || inferred.start;
  const periodEnd = normalizeDate(meta.period_end) || inferred.end;
  const periodText = buildPeriodText(periodStart, periodEnd);

  if (pageTitle) {
    pageTitle.textContent = title;
    document.title = title;
  }

  toggleText(pageSubtitle, subtitle);
  toggleText(pagePeriod, periodText);
  toggleText(pageParticipants, participants);
  toggleText(pageNote, note);
}

function renderOverview(summary, container) {
  if (!container) return;

  const cards = [
    {
      label: "日程",
      value: `${summary.totalDays}日`,
      detail: summary.periodLabel || "日付未設定"
    },
    {
      label: "予定",
      value: `${summary.totalItems}件`,
      detail: `1日平均 ${formatAverage(summary.totalItems, summary.totalDays)}件`
    },
    {
      label: "移動時間",
      value: summary.totalMoveDuration ? formatDuration(summary.totalMoveDuration) : "なし",
      detail: `${summary.moveCount}件の移動`
    },
    {
      label: "移動距離",
      value: summary.distanceCount ? formatDistance(summary.totalDistance) : "未集計",
      detail: summary.distanceCount ? `${summary.distanceCount}件に距離あり` : "距離データなし"
    }
  ];

  container.innerHTML = cards
    .map((card) => {
      return `
        <article class="overview-card">
          <p class="overview-label">${escapeHtml(card.label)}</p>
          <p class="overview-value">${escapeHtml(card.value)}</p>
          <p class="overview-detail">${escapeHtml(card.detail)}</p>
        </article>
      `;
    })
    .join("");

  showElement(container);
}

function renderDayNav(groups, container) {
  if (!container) return;

  if (groups.length <= 1) {
    hideElement(container);
    container.innerHTML = "";
    return;
  }

  container.innerHTML = groups
    .map((group) => {
      return `
        <a class="day-nav-link" href="#${escapeHtml(group.id)}" data-day-link="${escapeHtml(group.id)}">
          <span class="day-nav-label">${escapeHtml(group.dayLabel)}</span>
          <span class="day-nav-date">${escapeHtml(group.shortDateLabel)}</span>
        </a>
      `;
    })
    .join("");

  showElement(container);
}

function setupSectionObserver(dayNav) {
  if (!dayNav || typeof IntersectionObserver !== "function") return;

  const links = Array.from(dayNav.querySelectorAll("[data-day-link]"));
  const sections = Array.from(document.querySelectorAll(".day-section[id]"));
  if (!links.length || !sections.length) return;

  const linkMap = new Map(
    links.map((link) => [link.getAttribute("data-day-link"), link])
  );

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const link = linkMap.get(entry.target.id);
        if (!link) return;
        link.classList.toggle("is-active", entry.isIntersecting);
      });
    },
    {
      rootMargin: "-30% 0px -55% 0px",
      threshold: 0
    }
  );

  sections.forEach((section) => observer.observe(section));
}

function buildDayGroups(rows) {
  const map = new Map();

  rows.forEach((row) => {
    const key = `${row.day_no || 0}__${row.date}`;

    if (!map.has(key)) {
      map.set(key, {
        day_no: row.day_no,
        date: row.date,
        items: []
      });
    }

    map.get(key).items.push(row);
  });

  return Array.from(map.values())
    .sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return (a.day_no || 0) - (b.day_no || 0);
    })
    .map((group, index) => {
      const stats = buildDayStats(group.items);
      return {
        ...group,
        id: buildDayId(group, index),
        dayLabel: group.day_no ? `${group.day_no}日目` : "日程",
        shortDateLabel: formatShortDate(group.date),
        dateLabel: formatWarekiSeirekiDate(group.date),
        countLabel: `${group.items.length}件`,
        stats
      };
    });
}

function buildDayStats(items) {
  const startTimes = items
    .map((item) => parseTimeToMinutes(item.start_time))
    .filter((value) => value != null);

  const endCandidates = items
    .map((item) => parseTimeToMinutes(item.end_time || item.start_time))
    .filter((value) => value != null);

  const moveItems = items.filter((item) => item.category === "移動");
  const moveDuration = moveItems.reduce((total, item) => {
    return total + getTravelDurationMinutes(item.start_time, item.end_time);
  }, 0);

  const distanceValues = items
    .map((item) => parseDistanceValue(item.distance))
    .filter((value) => value != null);

  return {
    firstStart: startTimes.length ? formatMinutes(Math.min(...startTimes)) : "",
    lastEnd: endCandidates.length ? formatMinutes(Math.max(...endCandidates)) : "",
    moveCount: moveItems.length,
    moveDuration,
    distanceTotal: distanceValues.reduce((total, value) => total + value, 0),
    distanceCount: distanceValues.length
  };
}

function buildSummary(groups) {
  return groups.reduce(
    (summary, group) => {
      summary.totalDays += 1;
      summary.totalItems += group.items.length;
      summary.moveCount += group.stats.moveCount;
      summary.totalMoveDuration += group.stats.moveDuration;
      summary.totalDistance += group.stats.distanceTotal;
      summary.distanceCount += group.stats.distanceCount;
      return summary;
    },
    {
      totalDays: 0,
      totalItems: 0,
      moveCount: 0,
      totalMoveDuration: 0,
      totalDistance: 0,
      distanceCount: 0,
      periodLabel: buildPeriodText(
        groups[0]?.date || "",
        groups.length ? groups[groups.length - 1].date : ""
      )
    }
  );
}

function renderDaySection(group, dayIndex) {
  const statChips = [
    group.stats.firstStart ? buildChip("開始", group.stats.firstStart) : "",
    group.stats.lastEnd ? buildChip("終了", group.stats.lastEnd) : "",
    group.stats.moveCount ? buildChip("移動", `${group.stats.moveCount}件`) : "",
    group.stats.moveDuration ? buildChip("移動時間", formatDuration(group.stats.moveDuration)) : "",
    group.stats.distanceCount ? buildChip("距離", formatDistance(group.stats.distanceTotal)) : ""
  ]
    .filter(Boolean)
    .join("");

  return `
    <section class="day-section" id="${escapeHtml(group.id)}">
      <div class="day-header">
        <div class="day-title-wrap">
          <div class="day-no">${escapeHtml(group.dayLabel)}</div>
          <div class="day-date">${escapeHtml(group.dateLabel)}</div>
          ${statChips ? `<div class="day-stats">${statChips}</div>` : ""}
        </div>
        <div class="day-count">${escapeHtml(group.countLabel)}</div>
      </div>

      <div class="timeline">
        ${group.items
          .map((item, itemIndex) => {
            const prevItem = group.items[itemIndex - 1] || null;
            const nextItem = group.items[itemIndex + 1] || null;
            return renderTimelineItem(item, dayIndex, itemIndex, prevItem, nextItem);
          })
          .join("")}
      </div>
    </section>
  `;
}

function renderTimelineItem(item, dayIndex, itemIndex, prevItem, nextItem) {
  const category = item.category || "未分類";
  const isMove = item.category === "移動";
  const title = item.title || item.detail || "予定";
  const duration = isMove
    ? formatTravelDuration(item.start_time, item.end_time)
    : "";
  const distance = safeText(item.distance);
  const timeRange = buildTimeRange(item.start_time, item.end_time);
  const animationDelay = Math.min((dayIndex * 120) + (itemIndex * 55), 600);
  const startLabel = isMove ? "出発" : "";
  const endLabel = isMove ? "到着" : "";
  const showStartTime = shouldShowTimeSlot(item, "start", prevItem, nextItem);
  const showEndTime = shouldShowTimeSlot(item, "end", prevItem, nextItem);
  const showAnyTime = showStartTime || showEndTime;

  const infoChips = [
    duration ? buildInfoChip("所要", duration) : "",
    distance ? buildInfoChip("距離", distance) : ""
  ]
    .filter(Boolean)
    .join("");

  return `
    <article class="timeline-item" style="--item-delay:${animationDelay}ms">
      <div class="time-block"${showAnyTime ? ` aria-label="${escapeHtml(timeRange || "時刻未設定")}"` : ' aria-hidden="true"'}>
        <div class="time-top${showStartTime ? "" : " is-hidden"}"${showStartTime ? "" : ' aria-hidden="true"'}>
          <div class="time-label">${escapeHtml(startLabel)}</div>
          <div class="time-value">${escapeHtml(item.start_time)}</div>
        </div>
        <div class="time-bottom${showEndTime ? "" : " is-hidden"}"${showEndTime ? "" : ' aria-hidden="true"'}>
          <div class="time-label">${escapeHtml(endLabel)}</div>
          <div class="time-value">${escapeHtml(item.end_time)}</div>
        </div>
      </div>

      <div class="axis-block" aria-hidden="true">
        <span class="axis-line"></span>
        <span class="axis-dot"></span>
      </div>

      <div class="card">
        <div class="card-head">
          <div class="card-title-wrap">
            <span class="category-badge" data-category="${escapeHtml(category)}">${escapeHtml(category)}</span>
            <div class="title">${escapeHtml(title)}</div>
          </div>
          ${timeRange ? `<span class="time-range-chip">${escapeHtml(timeRange)}</span>` : ""}
        </div>

        ${item.detail && item.detail !== title
          ? `<p class="detail">${escapeHtml(item.detail)}</p>`
          : ""}

        ${infoChips ? `<div class="move-info">${infoChips}</div>` : ""}

        ${item.note
          ? `<div class="meta"><span class="meta-chip">備考: ${escapeHtml(item.note)}</span></div>`
          : ""}
      </div>
    </article>
  `;
}

function shouldShowTimeSlot(item, slot, prevItem, nextItem) {
  const currentTime = safeText(slot === "start" ? item.start_time : item.end_time);
  if (!currentTime) return false;

  if (slot === "start") {
    const prevTime = safeText(prevItem?.end_time);
    if (!prevTime || prevTime !== currentTime) return true;

    const prevPriority = getTimeSlotPriority(prevItem, "end");
    const currentPriority = getTimeSlotPriority(item, "start");
    return currentPriority >= prevPriority;
  }

  const nextTime = safeText(nextItem?.start_time);
  if (!nextTime || nextTime !== currentTime) return true;

  const nextPriority = getTimeSlotPriority(nextItem, "start");
  const currentPriority = getTimeSlotPriority(item, "end");
  return currentPriority > nextPriority;
}

function getTimeSlotPriority(item, slot) {
  const isMove = item?.category === "移動";

  if (slot === "start") {
    return isMove ? 4 : 2;
  }

  return isMove ? 3 : 1;
}

function normalizeRow(row) {
  return {
    schedule_id: safeText(row.schedule_id),
    day_no: toNumber(row.day_no),
    date: normalizeDate(row.date),
    start_time: normalizeTime(row.start_time),
    end_time: normalizeTime(row.end_time),
    category: safeText(row.category),
    title: safeText(row.title),
    detail: safeText(row.detail),
    distance: safeText(row.distance),
    note: safeText(row.note),
    sort_order: toNumber(row.sort_order)
  };
}

function compareItinerary(a, b) {
  const dateCompare = a.date.localeCompare(b.date);
  if (dateCompare !== 0) return dateCompare;

  const timeCompare = (a.start_time || "99:99").localeCompare(b.start_time || "99:99");
  if (timeCompare !== 0) return timeCompare;

  const sortCompare = a.sort_order - b.sort_order;
  if (sortCompare !== 0) return sortCompare;

  return a.schedule_id.localeCompare(b.schedule_id);
}

function hasVisibleContent(row) {
  return Boolean(
    row.title ||
    row.detail ||
    row.category ||
    row.distance ||
    row.note ||
    row.start_time ||
    row.end_time
  );
}

function inferPeriodFromRows(rows) {
  const dates = rows
    .map((row) => normalizeDate(row?.date))
    .filter(Boolean)
    .sort();

  if (!dates.length) {
    return { start: "", end: "" };
  }

  return {
    start: dates[0],
    end: dates[dates.length - 1]
  };
}

function buildPeriodText(start, end) {
  if (!start && !end) return "";
  if (start && !end) return formatWarekiSeirekiDate(start);
  if (!start && end) return formatWarekiSeirekiDate(end);
  if (start === end) return formatWarekiSeirekiDate(start);

  const sameYear = start.slice(0, 4) === end.slice(0, 4);

  if (sameYear) {
    return `${formatWarekiSeirekiDate(start)} - ${formatMonthDayOnly(end)}`;
  }

  return `${formatWarekiSeirekiDate(start)} - ${formatWarekiSeirekiDate(end)}`;
}

function buildTimeRange(startTime, endTime) {
  if (!startTime && !endTime) return "";
  if (startTime && endTime) return `${startTime} - ${endTime}`;
  return startTime || endTime || "";
}

function formatTravelDuration(startTime, endTime) {
  const minutes = getTravelDurationMinutes(startTime, endTime);
  return minutes ? formatDuration(minutes) : "";
}

function getTravelDurationMinutes(startTime, endTime) {
  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);

  if (startMinutes == null || endMinutes == null) return 0;

  let diff = endMinutes - startMinutes;
  if (diff < 0) diff += 24 * 60;
  return diff;
}

function parseTimeToMinutes(value) {
  const text = safeText(value);
  const match = text.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  return hours * 60 + minutes;
}

function formatDuration(minutes) {
  if (!minutes) return "0分";

  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;

  if (hours > 0 && restMinutes > 0) return `${hours}時間${restMinutes}分`;
  if (hours > 0) return `${hours}時間`;
  return `${restMinutes}分`;
}

function formatMinutes(minutes) {
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(restMinutes).padStart(2, "0")}`;
}

function normalizeDate(value) {
  const text = safeText(value).replace(/\//g, "-");
  const match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return "";

  const year = match[1];
  const month = match[2].padStart(2, "0");
  const day = match[3].padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeTime(value) {
  const text = safeText(value);
  if (!text) return "";

  const match = text.match(/^(\d{1,2}):(\d{1,2})$/);
  if (!match) return text;

  const hour = match[1].padStart(2, "0");
  const minute = match[2].padStart(2, "0");
  return `${hour}:${minute}`;
}

function formatWarekiSeirekiDate(value) {
  if (!value) return "";

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const weekday = formatWeekday(value);
  const wareki = toWareki(year, month, day);

  return `${wareki} (${year}年) ${month}月${day}日${weekday}`;
}

function formatShortDate(value) {
  if (!value) return "";

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;

  return `${Number(match[2])}/${Number(match[3])}${formatWeekday(value)}`;
}

function formatMonthDayOnly(value) {
  if (!value) return "";

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;

  return `${Number(match[2])}月${Number(match[3])}日${formatWeekday(value)}`;
}

function formatWeekday(value) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  return `(${date.toLocaleDateString("ja-JP", { weekday: "short" })})`;
}

function toWareki(year, month, day) {
  const target = new Date(year, month - 1, day);
  const reiwaStart = new Date(2019, 4, 1);
  const heiseiStart = new Date(1989, 0, 8);
  const showaStart = new Date(1926, 11, 25);

  if (target >= reiwaStart) {
    return `令和${formatWarekiYear(year - 2018)}`;
  }

  if (target >= heiseiStart) {
    return `平成${formatWarekiYear(year - 1988)}`;
  }

  if (target >= showaStart) {
    return `昭和${formatWarekiYear(year - 1925)}`;
  }

  return `${year}年`;
}

function formatWarekiYear(year) {
  return `${year === 1 ? "元" : year}年`;
}

function parseDistanceValue(value) {
  const text = safeText(value);
  if (!text) return null;

  const match = text.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;

  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatDistance(value) {
  const hasDecimal = Math.abs(value % 1) > 0.001;
  return `${new Intl.NumberFormat("ja-JP", {
    minimumFractionDigits: 0,
    maximumFractionDigits: hasDecimal ? 1 : 0
  }).format(value)}km`;
}

function formatAverage(total, count) {
  if (!count) return "0";
  const average = total / count;
  return new Intl.NumberFormat("ja-JP", {
    minimumFractionDigits: 0,
    maximumFractionDigits: average % 1 === 0 ? 0 : 1
  }).format(average);
}

function buildChip(label, value) {
  return `
    <span class="stat-chip">
      <span class="stat-chip-label">${escapeHtml(label)}</span>
      <span class="stat-chip-value">${escapeHtml(value)}</span>
    </span>
  `;
}

function buildInfoChip(label, value) {
  return `<span class="info-chip">${escapeHtml(label)}: ${escapeHtml(value)}</span>`;
}

function buildDayId(group, index) {
  return `day-${group.day_no || index + 1}-${group.date}`;
}

function toggleText(element, text) {
  if (!element) return;

  if (text) {
    element.textContent = text;
    showElement(element);
    return;
  }

  element.textContent = "";
  hideElement(element);
}

function showElement(element) {
  if (!element) return;
  element.hidden = false;
}

function hideElement(element) {
  if (!element) return;
  element.hidden = true;
}

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function safeText(value) {
  return value == null ? "" : String(value).trim();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}