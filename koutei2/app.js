window.addEventListener("DOMContentLoaded", () => {
  "use strict";

  const app = document.getElementById("app");
  const pageTitle = document.getElementById("pageTitle");
  const pageSubtitle = document.getElementById("pageSubtitle");
  const pagePeriod = document.getElementById("pagePeriod");
  const pageParticipants = document.getElementById("pageParticipants");
  const pageNote = document.getElementById("pageNote");
  const periodRow = document.getElementById("periodRow");
  const participantsRow = document.getElementById("participantsRow");
  const noteRow = document.getElementById("noteRow");

  const meta = window.KOUTEI_DATA?.meta || {};
  const rows = Array.isArray(window.KOUTEI_DATA?.itinerary)
    ? window.KOUTEI_DATA.itinerary
    : [];

  renderHeaderMeta({
    meta,
    rows,
    pageTitle,
    pageSubtitle,
    pagePeriod,
    pageParticipants,
    pageNote,
    periodRow,
    participantsRow,
    noteRow
  });

  if (!app) return;

  if (!rows.length) {
    app.innerHTML = `<div class="empty">行程データがありません。</div>`;
    return;
  }

  const normalized = rows
    .map(normalizeRow)
    .filter((row) => row.date);

  const sorted = normalized.sort(compareItinerary);
  const grouped = groupByDay(sorted);

  app.innerHTML = grouped.map(renderDaySection).join("");
});

function renderHeaderMeta(params) {
  const {
    meta,
    rows,
    pageTitle,
    pageSubtitle,
    pagePeriod,
    pageParticipants,
    pageNote,
    periodRow,
    participantsRow,
    noteRow
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

  if (pageSubtitle) {
    pageSubtitle.textContent = subtitle;
  }

  if (pagePeriod && periodRow) {
    if (periodText) {
      pagePeriod.textContent = periodText;
      periodRow.hidden = false;
    } else {
      pagePeriod.textContent = "";
      periodRow.hidden = true;
    }
  }

  if (pageParticipants && participantsRow) {
    if (participants) {
      pageParticipants.textContent = participants;
      participantsRow.hidden = false;
    } else {
      pageParticipants.textContent = "";
      participantsRow.hidden = true;
    }
  }

  if (pageNote && noteRow) {
    if (note) {
      pageNote.textContent = note;
      noteRow.hidden = false;
    } else {
      pageNote.textContent = "";
      noteRow.hidden = true;
    }
  }
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

function groupByDay(rows) {
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

  return Array.from(map.values()).sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    return (a.day_no || 0) - (b.day_no || 0);
  });
}

function renderDaySection(group) {
  const dayNoLabel = group.day_no ? `${group.day_no}日目` : "日程";
  const dateLabel = formatWarekiSeirekiDate(group.date);
  const countLabel = `${group.items.length}件`;

  return `
    <section class="day-section">
      <div class="day-header">
        <div class="day-title-wrap">
          <div class="day-no">${escapeHtml(dayNoLabel)}</div>
          <div class="day-date">${escapeHtml(dateLabel)}</div>
        </div>
        <div class="day-count">${escapeHtml(countLabel)}</div>
      </div>

      <div class="timeline">
        ${group.items.map(renderTimelineItem).join("")}
      </div>
    </section>
  `;
}

function renderTimelineItem(item) {
  const category = item.category || "未分類";
  const categoryClass = buildCategoryClass(category);
  const isMove = category === "移動";

  const startTime = item.start_time || "";
  const endTime = item.end_time || "";

  const topTime = startTime || "--:--";
  const bottomTime = endTime || "--:--";

  const duration = isMove ? formatTravelDuration(startTime, endTime) : "";

  return `
    <article class="timeline-item">
      <div class="time-block">
        <div class="time-top">
          ${startTime
            ? `<div class="time-value">${escapeHtml(topTime)}</div>`
            : `<div class="time-value muted">--:--</div>`}
        </div>

        <div class="time-bottom">
          ${endTime
            ? `<div class="time-value">${escapeHtml(bottomTime)}</div>`
            : `<div class="time-value muted">--:--</div>`}
        </div>
      </div>

      <div class="axis-block">
        <span class="axis-line"></span>
        <span class="axis-dot"></span>
      </div>

      <div class="card">
        <div class="card-head">
          <span class="category-badge ${escapeHtml(categoryClass)}">${escapeHtml(category)}</span>
          <div class="title">${escapeHtml(item.title || "")}</div>
        </div>

        ${item.detail ? `<p class="detail">${escapeHtml(item.detail)}</p>` : ""}

        ${isMove && (duration || item.distance) ? `
          <div class="move-info">
            ${duration ? `<div class="move-duration">所要時間：${escapeHtml(duration)}</div>` : ""}
            ${item.distance ? `<div class="move-method">距離：${escapeHtml(item.distance)}</div>` : ""}
          </div>
        ` : ""}

        ${item.note ? `
          <div class="meta">
            <span class="meta-chip">備考：${escapeHtml(item.note)}</span>
          </div>
        ` : ""}
      </div>
    </article>
  `;
}

function buildCategoryClass(category) {
  const text = safeText(category);
  return text ? `category-${text}` : "";
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

function formatTravelDuration(startTime, endTime) {
  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);

  if (startMinutes == null || endMinutes == null) return "";

  let diff = endMinutes - startMinutes;
  if (diff < 0) diff += 24 * 60;
  if (diff === 0) return "0分";

  const hours = Math.floor(diff / 60);
  const minutes = diff % 60;

  if (hours > 0 && minutes > 0) return `${hours}時間${minutes}分`;
  if (hours > 0) return `${hours}時間`;
  return `${minutes}分`;
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

  const wareki = toWareki(year, month, day);
  return `${wareki}(${year}年)${month}月${day}日`;
}

function formatMonthDayOnly(value) {
  if (!value) return "";

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;

  return `${Number(match[2])}月${Number(match[3])}日`;
}

function toWareki(year, month, day) {
  const target = new Date(year, month - 1, day);
  const reiwaStart = new Date(2019, 4, 1);
  const heiseiStart = new Date(1989, 0, 8);
  const showaStart = new Date(1926, 11, 25);

  if (target >= reiwaStart) {
    const warekiYear = year - 2018;
    return `令和${warekiYear}年`;
  }

  if (target >= heiseiStart) {
    const warekiYear = year - 1988;
    return `平成${warekiYear}年`;
  }

  if (target >= showaStart) {
    const warekiYear = year - 1925;
    return `昭和${warekiYear}年`;
  }

  return `${year}年`;
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
