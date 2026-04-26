window.addEventListener("DOMContentLoaded", () => {
  "use strict";

  const elements = {
    app: document.getElementById("app"),
    pageTitle: document.getElementById("pageTitle"),
    pageSubtitle: document.getElementById("pageSubtitle"),
    pagePeriod: document.getElementById("metaPeriod"),
    pageParticipants: document.getElementById("metaParticipants"),
    pageNote: document.getElementById("metaNote"),
    headerSupplement: document.getElementById("headerSupplement"),
    headerToggle: document.getElementById("headerToggle"),
    overviewSection: document.getElementById("overviewSection"),
    overviewToggle: document.getElementById("overviewToggle"),
    overview: document.getElementById("overview"),
    dayNav: document.getElementById("dayNav"),
    printButton: document.getElementById("printButton")
  };

  setupPrintButton(elements.printButton);

  const requestData = window.KOUTEI_COMPARE?.request || window.KOUTEI_REQUEST || null;
  const actualData = window.KOUTEI_COMPARE?.actual || window.KOUTEI_ACTUAL || null;

  if (!requestData || !actualData) {
    hideElement(elements.overviewSection);
    hideElement(elements.dayNav);
    elements.app.innerHTML = '<div class="empty-state">申請データと実績データの両方を読み込んでください。</div>';
    return;
  }

  const requestRows = normalizeRows(requestData.itinerary);
  const actualRows = normalizeRows(actualData.itinerary);
  const pairs = buildComparisonPairs(requestRows, actualRows)
    .filter((pair) => isMoveComparison(pair) && pair.rowChanged);

  renderHeaderMeta({
    meta: requestData.meta || actualData.meta || {},
    rows: [...requestRows, ...actualRows],
    pageTitle: elements.pageTitle,
    pageSubtitle: elements.pageSubtitle,
    pagePeriod: elements.pagePeriod,
    pageParticipants: elements.pageParticipants,
    pageNote: elements.pageNote
  });
  setupHeaderToggle(elements);

  if (!pairs.length) {
    hideElement(elements.overviewSection);
    hideElement(elements.dayNav);
    elements.app.innerHTML = '<div class="empty-state">移動手段・交通費に相違があるデータはありません。</div>';
    return;
  }

  const summary = buildSummary(pairs);
  const groups = buildDayGroups(pairs);

  renderOverview(summary, elements.overview);
  setupOverviewToggle(elements);
  renderDayNav(groups, elements.dayNav);
  elements.app.innerHTML = groups.map(renderDaySection).join("");
  setupSectionObserver(elements.dayNav);
});

function setupPrintButton(button) {
  if (!button) return;

  if (typeof window.print !== "function") {
    hideElement(button);
    return;
  }

  button.addEventListener("click", () => window.print());
}

function renderHeaderMeta(params) {
  const { meta, rows, pageTitle, pageSubtitle, pagePeriod, pageParticipants, pageNote } = params;
  const title = safeText(meta.title) || "交通費比較表";
  const subtitle = safeText(meta.subtitle) || "申請内容と実績内容の比較";
  const participants = safeText(meta.participants);
  const note = safeText(meta.note);
  const inferred = inferPeriodFromRows(rows);
  const periodStart = normalizeDate(meta.period_start) || inferred.start;
  const periodEnd = normalizeDate(meta.period_end) || inferred.end;

  if (pageTitle) {
    pageTitle.textContent = title;
    document.title = title;
  }

  toggleText(pageSubtitle, subtitle);
  toggleText(pagePeriod, buildPeriodText(periodStart, periodEnd));
  toggleText(pageParticipants, participants);
  toggleText(pageNote, note);
}

function setupHeaderToggle(elements) {
  const { headerToggle, headerSupplement, pageSubtitle, pagePeriod, pageParticipants, pageNote } = elements;
  if (!headerToggle || !headerSupplement) return;

  const hasSupplement = [pageSubtitle, pagePeriod, pageParticipants, pageNote]
    .some((element) => element && !element.hidden && safeText(element.textContent));

  if (!hasSupplement) {
    hideElement(headerToggle);
    hideElement(headerSupplement);
    return;
  }

  showElement(headerToggle);
  setExpandableState(headerToggle, headerSupplement, false, "補足情報");
  headerToggle.addEventListener("click", () => {
    const isExpanded = headerToggle.getAttribute("aria-expanded") === "true";
    setExpandableState(headerToggle, headerSupplement, !isExpanded, "補足情報");
  });
}

function renderOverview(summary, container) {
  if (!container) return;

  const cards = [
    {
      label: "申請交通費",
      value: formatCurrency(summary.requestTotal),
      detail: `${summary.requestCount}件に交通費あり`
    },
    {
      label: "実績交通費",
      value: formatCurrency(summary.actualTotal),
      detail: `${summary.actualCount}件に交通費あり`
    },
    {
      label: "差額",
      value: formatSignedCurrency(summary.diffTotal),
      detail: summary.diffTotal === 0 ? "申請額と一致" : "実績 - 申請"
    },
    {
      label: "表示件数",
      value: `${summary.changedCount}件`,
      detail: `交通手段 ${summary.methodChangedCount}件 / 交通費 ${summary.costChangedCount}件`
    }
  ];

  container.innerHTML = cards.map((card) => `
    <article class="overview-card ${card.label === "差額" ? diffClass(summary.diffTotal) : ""}">
      <p class="overview-label">${escapeHtml(card.label)}</p>
      <p class="overview-value">${escapeHtml(card.value)}</p>
      <p class="overview-detail">${escapeHtml(card.detail)}</p>
    </article>
  `).join("");
}

function setupOverviewToggle(elements) {
  const { overviewSection, overview, overviewToggle } = elements;
  if (!overviewSection || !overview || !overviewToggle || !overview.innerHTML.trim()) {
    hideElement(overviewSection);
    hideElement(overview);
    return;
  }

  showElement(overviewSection);
  setExpandableState(overviewToggle, overview, true, "比較サマリー");
  overviewToggle.addEventListener("click", () => {
    const isExpanded = overviewToggle.getAttribute("aria-expanded") === "true";
    setExpandableState(overviewToggle, overview, !isExpanded, "比較サマリー");
  });
}

function renderDayNav(groups, container) {
  if (!container) return;

  if (groups.length <= 1) {
    hideElement(container);
    container.innerHTML = "";
    return;
  }

  container.innerHTML = groups.map((group) => `
    <a class="day-nav-link" href="#${escapeHtml(group.id)}" data-day-link="${escapeHtml(group.id)}">
      <span class="day-nav-label">${escapeHtml(group.dayLabel)}</span>
      <span class="day-nav-date">${escapeHtml(group.shortDateLabel)}</span>
    </a>
  `).join("");

  showElement(container);
}

function setupSectionObserver(dayNav) {
  if (!dayNav || typeof IntersectionObserver !== "function") return;

  const links = Array.from(dayNav.querySelectorAll("[data-day-link]"));
  const sections = Array.from(document.querySelectorAll(".day-section[id]"));
  if (!links.length || !sections.length) return;

  const linkMap = new Map(links.map((link) => [link.getAttribute("data-day-link"), link]));
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const link = linkMap.get(entry.target.id);
      if (!link) return;
      link.classList.toggle("is-active", entry.isIntersecting);
    });
  }, { rootMargin: "-30% 0px -55% 0px", threshold: 0 });

  sections.forEach((section) => observer.observe(section));
}

function buildComparisonPairs(requestRows, actualRows) {
  const requestMap = buildRowMap(requestRows);
  const actualMap = buildRowMap(actualRows);
  const keys = Array.from(new Set([...requestMap.keys(), ...actualMap.keys()]));

  return keys.map((key) => {
    const request = requestMap.get(key) || null;
    const actual = actualMap.get(key) || null;
    const base = request || actual;
    const methodChanged = normalizeCompareText(request?.detail) !== normalizeCompareText(actual?.detail);
    const costChanged = parseCurrencyValue(request?.transport_cost) !== parseCurrencyValue(actual?.transport_cost);
    const rowChanged = !request || !actual || methodChanged || costChanged;

    return {
      key,
      request,
      actual,
      base,
      day_no: base.day_no,
      date: base.date,
      start_time: base.start_time,
      sort_order: base.sort_order,
      methodChanged,
      costChanged,
      rowChanged
    };
  }).sort(comparePairs);
}

function isMoveComparison(pair) {
  return isMoveCategory(pair.request?.category) || isMoveCategory(pair.actual?.category);
}

function buildRowMap(rows) {
  const map = new Map();
  rows.forEach((row, index) => {
    const key = row.schedule_id || `${row.date}_${row.start_time}_${row.title}_${index}`;
    map.set(key, row);
  });
  return map;
}

function buildSummary(pairs) {
  return pairs.reduce((summary, pair) => {
    const requestCost = parseCurrencyValue(pair.request?.transport_cost);
    const actualCost = parseCurrencyValue(pair.actual?.transport_cost);

    if (requestCost != null) {
      summary.requestTotal += requestCost;
      summary.requestCount += 1;
    }

    if (actualCost != null) {
      summary.actualTotal += actualCost;
      summary.actualCount += 1;
    }

    if (pair.rowChanged) summary.changedCount += 1;
    if (pair.methodChanged) summary.methodChangedCount += 1;
    if (pair.costChanged) summary.costChangedCount += 1;
    summary.diffTotal = summary.actualTotal - summary.requestTotal;
    return summary;
  }, {
    requestTotal: 0,
    actualTotal: 0,
    diffTotal: 0,
    requestCount: 0,
    actualCount: 0,
    changedCount: 0,
    methodChangedCount: 0,
    costChangedCount: 0
  });
}

function buildDayGroups(pairs) {
  const map = new Map();

  pairs.forEach((pair) => {
    const key = `${pair.day_no || 0}__${pair.date}`;
    if (!map.has(key)) {
      map.set(key, {
        day_no: pair.day_no,
        date: pair.date,
        pairs: []
      });
    }
    map.get(key).pairs.push(pair);
  });

  return Array.from(map.values())
    .sort((a, b) => a.date.localeCompare(b.date) || (a.day_no || 0) - (b.day_no || 0))
    .map((group, index) => ({
      ...group,
      id: `day-${group.day_no || index + 1}-${group.date}`,
      dayLabel: group.day_no ? `${group.day_no}日目` : "日程",
      shortDateLabel: formatShortDate(group.date),
      dateLabel: formatWarekiSeirekiDate(group.date),
      changedCount: group.pairs.filter((pair) => pair.rowChanged).length,
      diffTotal: group.pairs.reduce((total, pair) => {
        return total + (parseCurrencyValue(pair.actual?.transport_cost) || 0) - (parseCurrencyValue(pair.request?.transport_cost) || 0);
      }, 0)
    }));
}

function renderDaySection(group) {
  const chips = [
    buildChip("表示", `${group.changedCount}件`),
    buildChip("差額", formatSignedCurrency(group.diffTotal))
  ].join("");

  return `
    <section class="day-section" id="${escapeHtml(group.id)}">
      <div class="day-header">
        <div class="day-title-wrap">
          <div class="day-no">${escapeHtml(group.dayLabel)}</div>
          <div class="day-date">${escapeHtml(group.dateLabel)}</div>
          <div class="day-stats">${chips}</div>
        </div>
        <div class="day-count">${escapeHtml(`${group.pairs.length}件`)}</div>
      </div>
      <div class="comparison-list">
        ${group.pairs.map(renderComparisonItem).join("")}
      </div>
    </section>
  `;
}

function renderComparisonItem(pair) {
  const base = pair.base;
  const timeRange = buildTimeRange(base.start_time, base.end_time);
  const title = base.title || "予定";
  const category = base.category || "未設定";
  const diff = (parseCurrencyValue(pair.actual?.transport_cost) || 0) - (parseCurrencyValue(pair.request?.transport_cost) || 0);

  return `
    <article class="comparison-item ${pair.rowChanged ? "is-changed" : "is-same"}">
      <div class="comparison-head">
        <div class="comparison-title-wrap">
          <span class="category-badge" data-category="${escapeHtml(category)}">${escapeHtml(category)}</span>
          <div>
            <h2 class="comparison-title">${escapeHtml(title)}</h2>
            <p class="comparison-time">${escapeHtml(timeRange || "時刻未設定")}</p>
          </div>
        </div>
        <span class="change-badge ${pair.rowChanged ? "change-badge-warn" : "change-badge-ok"}">
          ${pair.rowChanged ? "相違あり" : "一致"}
        </span>
      </div>

      <div class="compare-grid">
        ${renderSide("申請", pair.request, "request")}
        ${renderSide("実績", pair.actual, "actual")}
        <div class="diff-panel ${diffClass(diff)}">
          <p class="side-label">差分</p>
          ${renderDiffLine("移動手段", pair.request?.detail, pair.actual?.detail, pair.methodChanged)}
          ${renderDiffLine("交通費", formatCurrencyLabel(pair.request?.transport_cost), formatCurrencyLabel(pair.actual?.transport_cost), pair.costChanged)}
          <div class="diff-total">
            <span>差額</span>
            <strong>${escapeHtml(formatSignedCurrency(diff))}</strong>
          </div>
        </div>
      </div>
    </article>
  `;
}

function renderSide(label, row, tone) {
  if (!row) {
    return `
      <div class="side-card side-card-${tone} is-missing">
        <p class="side-label">${escapeHtml(label)}</p>
        <p class="missing-text">データなし</p>
      </div>
    `;
  }

  return `
    <div class="side-card side-card-${tone}">
      <p class="side-label">${escapeHtml(label)}</p>
      <dl class="side-list">
        <div><dt>移動手段</dt><dd>${escapeHtml(row.detail || "未入力")}</dd></div>
        <div><dt>交通費</dt><dd>${escapeHtml(formatCurrencyLabel(row.transport_cost) || "未入力")}</dd></div>
        <div><dt>距離</dt><dd>${escapeHtml(formatDistanceLabel(row.distance) || "未入力")}</dd></div>
        <div><dt>備考</dt><dd>${escapeHtml(row.note || "なし")}</dd></div>
      </dl>
    </div>
  `;
}

function renderDiffLine(label, requestValue, actualValue, changed) {
  const before = safeText(requestValue) || "未入力";
  const after = safeText(actualValue) || "未入力";
  return `
    <div class="diff-line ${changed ? "is-different" : ""}">
      <span>${escapeHtml(label)}</span>
      <strong>${changed ? `${escapeHtml(before)} → ${escapeHtml(after)}` : "一致"}</strong>
    </div>
  `;
}

function normalizeRows(rows) {
  return Array.isArray(rows)
    ? rows.map(normalizeRow).filter((row) => row.date && hasVisibleContent(row))
    : [];
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
    transport_cost: safeText(row.transport_cost),
    note: safeText(row.note),
    sort_order: toNumber(row.sort_order)
  };
}

function comparePairs(a, b) {
  return a.date.localeCompare(b.date)
    || (a.start_time || "99:99").localeCompare(b.start_time || "99:99")
    || a.sort_order - b.sort_order
    || a.key.localeCompare(b.key);
}

function hasVisibleContent(row) {
  return Boolean(row.title || row.detail || row.category || row.distance || row.transport_cost || row.note || row.start_time || row.end_time);
}

function isMoveCategory(category) {
  return safeText(category) === "移動";
}

function inferPeriodFromRows(rows) {
  const dates = rows.map((row) => normalizeDate(row?.date)).filter(Boolean).sort();
  return { start: dates[0] || "", end: dates[dates.length - 1] || "" };
}

function buildPeriodText(start, end) {
  if (!start && !end) return "";
  if (start && !end) return formatWarekiSeirekiDate(start);
  if (!start && end) return formatWarekiSeirekiDate(end);
  if (start === end) return formatWarekiSeirekiDate(start);
  return `${formatWarekiSeirekiDate(start)} - ${formatMonthDayOnly(end)}`;
}

function buildTimeRange(startTime, endTime) {
  if (!startTime && !endTime) return "";
  if (startTime && endTime) return `${startTime} - ${endTime}`;
  return startTime || endTime || "";
}

function normalizeDate(value) {
  const text = safeText(value).replace(/\//g, "-");
  const match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return "";
  return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
}

function normalizeTime(value) {
  const text = safeText(value);
  if (!text) return "";
  const match = text.match(/^(\d{1,2}):(\d{1,2})$/);
  if (!match) return text;
  return `${match[1].padStart(2, "0")}:${match[2].padStart(2, "0")}`;
}

function formatWarekiSeirekiDate(value) {
  const match = safeText(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return safeText(value);
  return `${Number(match[2])}月${Number(match[3])}日${formatWeekday(value)}`;
}

function formatShortDate(value) {
  const match = safeText(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return safeText(value);
  return `${Number(match[2])}/${Number(match[3])}${formatWeekday(value)}`;
}

function formatMonthDayOnly(value) {
  const match = safeText(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return safeText(value);
  return `${Number(match[2])}月${Number(match[3])}日${formatWeekday(value)}`;
}

function formatWeekday(value) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  return `(${date.toLocaleDateString("ja-JP", { weekday: "short" })})`;
}

function parseDistanceValue(value) {
  const match = safeText(value).match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatDistance(value) {
  if (value == null || Number.isNaN(value)) return "";
  const hasDecimal = Math.abs(value % 1) > 0.001;
  return `${new Intl.NumberFormat("ja-JP", {
    minimumFractionDigits: 0,
    maximumFractionDigits: hasDecimal ? 1 : 0
  }).format(value)}km`;
}

function formatDistanceLabel(value) {
  const parsed = parseDistanceValue(value);
  return parsed == null ? safeText(value) : formatDistance(parsed);
}

function parseCurrencyValue(value) {
  const text = safeText(value).replace(/,/g, "");
  if (!text) return null;
  const match = text.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatCurrency(value) {
  if (value == null || Number.isNaN(value)) return "0円";
  return `${new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 0 }).format(value)}円`;
}

function formatSignedCurrency(value) {
  if (!value) return "±0円";
  return `${value > 0 ? "+" : "-"}${formatCurrency(Math.abs(value))}`;
}

function formatCurrencyLabel(value) {
  const parsed = parseCurrencyValue(value);
  return parsed == null ? safeText(value) : formatCurrency(parsed);
}

function buildChip(label, value) {
  return `
    <span class="stat-chip">
      <span class="stat-chip-label">${escapeHtml(label)}</span>
      <span class="stat-chip-value">${escapeHtml(value)}</span>
    </span>
  `;
}

function normalizeCompareText(value) {
  return safeText(value).replace(/\s+/g, " ");
}

function diffClass(value) {
  if (value > 0) return "diff-plus";
  if (value < 0) return "diff-minus";
  return "diff-zero";
}

function setExpandableState(button, panel, expanded, label) {
  if (!button || !panel) return;
  button.setAttribute("aria-expanded", String(expanded));
  button.textContent = expanded ? `${label}を隠す` : `${label}を表示`;
  panel.hidden = !expanded;
}

function toggleText(element, text) {
  if (!element) return;
  element.textContent = text || "";
  element.hidden = !text;
}

function showElement(element) {
  if (element) element.hidden = false;
}

function hideElement(element) {
  if (element) element.hidden = true;
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
