window.addEventListener("DOMContentLoaded", () => {
  const app = document.getElementById("app");
  const meta = normalizeMeta(window.KOUTEI_DATA?.meta || {});
  const itinerary = collectItineraries(window.KOUTEI_DATA || {});

  applyMeta(meta);

  if (!itinerary.length) {
    app.innerHTML = `<div class="empty-state">データがありません。</div>`;
    return;
  }

  const rows = itinerary.map(normalizeRow).sort(compareRows);
  const grouped = groupByDay(rows);

  app.innerHTML = grouped.map(renderDay).join("");
});

const MOVE_CATEGORY = "移動";

function collectItineraries(source) {
  return Object.keys(source)
    .filter((key) => /^itinerary\d*$/i.test(key))
    .sort(compareItineraryKeys)
    .flatMap((key) => (Array.isArray(source[key]) ? source[key] : []));
}

function compareItineraryKeys(a, b) {
  const aNum = extractItineraryIndex(a);
  const bNum = extractItineraryIndex(b);
  return aNum - bNum;
}

function extractItineraryIndex(key) {
  const match = String(key).match(/^itinerary(\d*)$/i);
  if (!match) return Number.MAX_SAFE_INTEGER;
  return match[1] ? Number(match[1]) : 0;
}

function applyMeta(meta) {
  document.title = meta.title || "行程表";
  setText("pageTitle", meta.title || "行程表");
  setText("pageSubtitle", meta.subtitle);
  setText("metaPeriod", formatPeriod(meta.period_start, meta.period_end));
  setText("metaParticipants", meta.participants);
  setText("metaNote", meta.note);
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (!element) return;

  const text = value || "";
  element.textContent = text;
  element.hidden = !text;
}

function renderDay(group) {
  return `
    <section class="day-section">
      <div class="day-header">
        <div class="day-no">${escapeHtml(String(group.day_no))}日目</div>
        <div class="day-date">${escapeHtml(toWarekiDisplay(group.date))}</div>
      </div>
      <div class="timeline">
        ${group.items.map(renderItem).join("")}
      </div>
    </section>
  `;
}

function renderItem(item) {
  const isMove = item.category === MOVE_CATEGORY;
  const topLabel = isMove ? "出発" : "到着";
  const bottomLabel = isMove ? "到着" : "出発";
  const start = item.start_time || "--:--";
  const end = item.end_time || "--:--";
  const duration = isMove ? calcDuration(start, end) : "";
  const badgeClass = `category-badge ${categoryClassName(item.category)}`.trim();

  return `
    <article class="timeline-item">
      <div class="time-block" aria-label="時刻">
        <div class="time-top">
          <div class="time-label">${topLabel}</div>
          <div class="time-value">${escapeHtml(start)}</div>
        </div>
        <div class="time-bottom">
          <div class="time-label">${bottomLabel}</div>
          <div class="time-value">${escapeHtml(end)}</div>
        </div>
      </div>

      <div class="axis-block" aria-hidden="true">
        <span class="axis-line"></span>
        <span class="axis-dot"></span>
      </div>

      <div class="card">
        <div class="card-head">
          <span class="${escapeHtml(badgeClass)}">${escapeHtml(item.category || "未分類")}</span>
          <div class="title">${escapeHtml(item.title)}</div>
        </div>

        ${renderTextBlock("place", item.place_name)}
        ${renderTextBlock("detail", item.detail)}

        ${isMove ? renderMoveInfo(duration, item.move_method) : ""}
        ${item.note ? `<div class="note">備考: ${escapeHtml(item.note)}</div>` : ""}
      </div>
    </article>
  `;
}

function renderMoveInfo(duration, moveMethod) {
  if (!duration && !moveMethod) return "";

  return `
    <div class="move-info">
      ${duration ? `<div class="move-row">所要時間: ${escapeHtml(duration)}</div>` : ""}
      ${moveMethod ? `<div class="move-row">移動手段: ${escapeHtml(moveMethod)}</div>` : ""}
    </div>
  `;
}

function renderTextBlock(className, value) {
  if (!value) return "";
  return `<p class="${className}">${escapeHtml(value)}</p>`;
}

function normalizeMeta(meta) {
  return {
    title: normalizeString(meta.title),
    subtitle: normalizeString(meta.subtitle),
    period_start: formatDate(meta.period_start),
    period_end: formatDate(meta.period_end),
    participants: normalizeString(meta.participants),
    note: normalizeString(meta.note)
  };
}

function normalizeRow(row) {
  return {
    schedule_id: normalizeString(row.schedule_id),
    day_no: normalizeNumber(row.day_no, 1),
    date: formatDate(row.date),
    start_time: formatTime(row.start_time),
    end_time: formatTime(row.end_time),
    category: normalizeString(row.category),
    title: normalizeString(row.title),
    place_name: normalizeString(row.place_name),
    detail: normalizeString(row.detail),
    move_method: normalizeString(row.move_method),
    note: normalizeString(row.note),
    sort_order: normalizeNumber(row.sort_order, 0)
  };
}

function normalizeString(value) {
  if (value == null) return "";
  return String(value).trim();
}

function normalizeNumber(value, fallback) {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : fallback;
}

function compareRows(a, b) {
  if (a.date !== b.date) return a.date.localeCompare(b.date);
  if (a.day_no !== b.day_no) return a.day_no - b.day_no;
  if (a.start_time !== b.start_time) return a.start_time.localeCompare(b.start_time);
  if (a.end_time !== b.end_time) return a.end_time.localeCompare(b.end_time);
  return a.sort_order - b.sort_order;
}

function groupByDay(rows) {
  const groups = new Map();

  rows.forEach((row) => {
    const key = `${row.day_no}-${row.date}`;
    if (!groups.has(key)) {
      groups.set(key, {
        day_no: row.day_no,
        date: row.date,
        items: []
      });
    }

    groups.get(key).items.push(row);
  });

  return Array.from(groups.values());
}

function formatDate(value) {
  if (value == null || value === "") return "";
  return String(value).trim().replace(/\//g, "-");
}

function formatTime(value) {
  if (value == null || value === "") return "";

  const match = String(value).trim().match(/^(\d{1,2}):(\d{1,2})$/);
  if (!match) return String(value).trim();

  const hours = match[1].padStart(2, "0");
  const minutes = match[2].padStart(2, "0");
  return `${hours}:${minutes}`;
}

function calcDuration(start, end) {
  const startMinutes = parseTime(start);
  const endMinutes = parseTime(end);

  if (startMinutes == null || endMinutes == null) return "";

  const diff = endMinutes - startMinutes;
  if (diff <= 0) return "";

  const hours = Math.floor(diff / 60);
  const minutes = diff % 60;

  if (hours > 0 && minutes > 0) return `${hours}時間${minutes}分`;
  if (hours > 0) return `${hours}時間`;
  return `${minutes}分`;
}

function parseTime(value) {
  const match = String(value).trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;

  return hours * 60 + minutes;
}

function formatPeriod(start, end) {
  if (!start && !end) return "";
  if (start && end) {
    return `${toWarekiDisplay(start)} - ${toWarekiDisplay(end)}`;
  }

  return toWarekiDisplay(start || end);
}

function toWarekiDisplay(dateString) {
  if (!dateString) return "";

  const match = String(dateString).match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return dateString;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const era = getJapaneseEra(year, month, day);

  if (!era) return `${year}年${month}月${day}日`;

  return `${era.label}${era.year}年(${year}年)${month}月${day}日`;
}

function getJapaneseEra(year, month, day) {
  const value = Number(`${String(year).padStart(4, "0")}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}`);

  if (value >= 20190501) {
    return { label: "令和", year: year - 2018 };
  }
  if (value >= 19890108) {
    return { label: "平成", year: year - 1988 };
  }
  if (value >= 19261225) {
    return { label: "昭和", year: year - 1925 };
  }

  return null;
}

function categoryClassName(category) {
  if (!category) return "";
  return `category-${String(category).replace(/[^\p{L}\p{N}_-]/gu, "-")}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
