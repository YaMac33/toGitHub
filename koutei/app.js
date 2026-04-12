window.addEventListener("DOMContentLoaded", () => {
  "use strict";

  const app = document.getElementById("app");
  const titleEl = document.getElementById("pageTitle");
  const subtitleEl = document.getElementById("pageSubtitle");
  const periodEl = document.getElementById("pagePeriod");
  const participantsEl = document.getElementById("pageParticipants");
  const noteEl = document.getElementById("pageNote");
  const periodRow = document.getElementById("periodRow");
  const participantsRow = document.getElementById("participantsRow");
  const noteRow = document.getElementById("noteRow");

  const meta = window.KOUTEI_DATA?.meta || {};
  const rows = Array.isArray(window.KOUTEI_DATA?.itinerary)
    ? window.KOUTEI_DATA.itinerary
    : [];

  renderHeaderMeta({
    meta,
    titleEl,
    subtitleEl,
    periodEl,
    participantsEl,
    noteEl,
    periodRow,
    participantsRow,
    noteRow,
    rows
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
    titleEl,
    subtitleEl,
    periodEl,
    participantsEl,
    noteEl,
    periodRow,
    participantsRow,
    noteRow,
    rows
  } = params;

  const title = safeText(meta.title) || "行程表";
  const subtitle = safeText(meta.subtitle);
  const participants = safeText(meta.participants);
  const note = safeText(meta.note);

  const inferredPeriod = inferPeriodFromRows(rows);
  const periodStart = normalizeDate(meta.period_start) || inferredPeriod.start;
  const periodEnd = normalizeDate(meta.period_end) || inferredPeriod.end;
  const periodText = buildPeriodText(periodStart, periodEnd);

  if (titleEl) {
    titleEl.textContent = title;
    document.title = title;
  }

  if (subtitleEl) {
    subtitleEl.textContent = subtitle;
  }

  if (periodEl && periodRow) {
    if (periodText) {
      periodEl.textContent = periodText;
      periodRow.hidden = false;
    } else {
      periodEl.textContent = "";
      periodRow.hidden = true;
    }
  }

  if (participantsEl && participantsRow) {
    if (participants) {
      participantsEl.textContent = participants;
      participantsRow.hidden = false;
    } else {
      participantsEl.textContent = "";
      participantsRow.hidden = true;
    }
  }

  if (noteEl && noteRow) {
    if (note) {
      noteEl.textContent = note;
      noteRow.hidden = false;
    } else {
      noteEl.textContent = "";
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
    place_name: safeText(row.place_name),
    title: safeText(row.title),
    detail: safeText(row.detail),
    move_method: safeText(row.move_method),
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
  const categoryClass = buildCategoryClass(item.category);
  const title = item.title || "名称未設定";
  const place = item.place_name || "";
  const detail = item.detail || "";
  const start = item.start_time || "--:--";
  const end = item.end_time || "";
  const timeRange = end ? `〜 ${end}` : "";

  const meta = [];

  if (item.move_method) {
    meta.push(`<span class="meta-chip">移動: ${escapeHtml(item.move_method)}</span>`);
  }

  if (item.note) {
    meta.push(`<span class="meta-chip">備考: ${escapeHtml(item.note)}</span>`);
  }

  return `
    <article class="timeline-item">
      <div class="time-block">
        <div class="start-time">${escapeHtml(start)}</div>
        <div class="end-time">${escapeHtml(timeRange)}</div>
      </div>

      <div class="axis-block">
        <span class="axis-line"></span>
        <span class="axis-dot"></span>
      </div>

      <div class="card">
        <div class="card-head">
          <span class="category-badge ${escapeHtml(categoryClass)}">
            ${escapeHtml(item.category || "未分類")}
          </span>
          <div class="title">${escapeHtml(title)}</div>
        </div>

        ${place ? `<p class="place">${escapeHtml(place)}</p>` : ""}
        ${detail ? `<p class="detail">${escapeHtml(detail)}</p>` : ""}
        ${meta.length ? `<div class="meta">${meta.join("")}</div>` : ""}
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
    return `${formatWarekiSeirekiDate(start)} ～ ${formatMonthDayOnly(end)}`;
  }

  return `${formatWarekiSeirekiDate(start)} ～ ${formatWarekiSeirekiDate(end)}`;
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