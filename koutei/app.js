window.addEventListener("DOMContentLoaded", () => {
  "use strict";

  const app = document.getElementById("app");
  const rows = Array.isArray(window.KOUTEI_DATA?.itinerary)
    ? window.KOUTEI_DATA.itinerary
    : [];

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
  const dateLabel = formatJapaneseDate(group.date);
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
  const categoryClass = `category-${item.category || "default"}`;
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

      <div class="dot-wrap">
        <span class="dot"></span>
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

function formatJapaneseDate(value) {
  if (!value) return "";

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;

  return `${Number(match[1])}年${Number(match[2])}月${Number(match[3])}日`;
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