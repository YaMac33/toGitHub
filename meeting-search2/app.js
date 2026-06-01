const fileInput = document.getElementById("fileInput");
const folderInput = document.getElementById("folderInput");
const dropZone = document.getElementById("dropZone");
const loadStatus = document.getElementById("loadStatus");
const searchInput = document.getElementById("searchInput");
const searchButton = document.getElementById("searchButton");
const clearButton = document.getElementById("clearButton");
const resultArea = document.getElementById("resultArea");
const resultsSection = document.getElementById("resultsSection");
const resultsControls = document.getElementById("resultsControls");
const fullTextSection = document.getElementById("fullTextSection");
const fullTextArea = document.getElementById("fullTextArea");
const statsSection = document.getElementById("statsSection");
const statsArea = document.getElementById("statsArea");
const deptFilter = document.getElementById("deptFilter");
const sortSelect = document.getElementById("sortSelect");

let records = [];
let currentResults = [];
let filteredResults = [];
let currentKeywords = [];
let isExpandedResults = false;

let matchElements = [];
let currentMatchIndex = -1;

const INITIAL_RESULT_LIMIT = 3;
const MAX_SNIPPETS = 3;
const SNIPPET_MARGIN = 100;

/* ============================================================
   ファイル読み込み
   ============================================================ */

fileInput.addEventListener("change", (event) => {
  loadFiles(Array.from(event.target.files || []));
  event.target.value = "";
});

folderInput.addEventListener("change", (event) => {
  loadFiles(Array.from(event.target.files || []));
  event.target.value = "";
});

dropZone.addEventListener("click", (event) => {
  if (event.target.closest(".file-button")) return;
  fileInput.click();
});

dropZone.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    fileInput.click();
  }
});

["dragenter", "dragover"].forEach((type) => {
  dropZone.addEventListener(type, (event) => {
    event.preventDefault();
    dropZone.classList.add("is-dragover");
  });
});

["dragleave", "dragend"].forEach((type) => {
  dropZone.addEventListener(type, (event) => {
    event.preventDefault();
    dropZone.classList.remove("is-dragover");
  });
});

dropZone.addEventListener("drop", async (event) => {
  event.preventDefault();
  dropZone.classList.remove("is-dragover");
  loadStatus.textContent = "読み込み中...";
  const files = await getFilesFromDataTransfer(event.dataTransfer);
  loadFiles(files);
});

async function getFilesFromDataTransfer(dataTransfer) {
  const items = dataTransfer.items;
  if (items && items.length && typeof items[0].webkitGetAsEntry === "function") {
    const entries = [];
    for (const item of items) {
      const entry = item.webkitGetAsEntry();
      if (entry) entries.push(entry);
    }
    const collected = [];
    for (const entry of entries) await traverseEntry(entry, collected);
    return collected;
  }
  return Array.from(dataTransfer.files || []);
}

function traverseEntry(entry, output) {
  return new Promise((resolve) => {
    if (entry.isFile) {
      entry.file((file) => { output.push(file); resolve(); }, () => resolve());
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      const readBatch = () => {
        reader.readEntries(async (batch) => {
          if (!batch.length) { resolve(); return; }
          for (const child of batch) await traverseEntry(child, output);
          readBatch();
        }, () => resolve());
      };
      readBatch();
    } else {
      resolve();
    }
  });
}

async function loadFiles(files) {
  records = [];
  currentResults = [];
  filteredResults = [];
  currentKeywords = [];
  isExpandedResults = false;

  closeFullText();
  resultArea.innerHTML = '<p class="empty">検索結果はここに表示されます。</p>';
  statsSection.classList.add("hidden");
  resultsControls.classList.add("hidden");

  if (files.length === 0) {
    loadStatus.textContent = "まだファイルは読み込まれていません。";
    return;
  }

  const textFiles = files.filter((f) => f.name.toLowerCase().endsWith(".txt"));

  if (textFiles.length === 0) {
    loadStatus.textContent = ".txt ファイルが選択されていません。";
    return;
  }

  loadStatus.textContent = `読み込み中... (0 / ${textFiles.length})`;

  const seen = new Set();
  let done = 0;

  for (const file of textFiles) {
    const pathKey = `${file.webkitRelativePath || file.name}_${file.size}`;
    if (seen.has(pathKey)) { done++; continue; }
    seen.add(pathKey);

    try {
      const text = await readFileAsText(file);
      const meta = extractMeta(text, file.name);
      records.push({
        id: createRecordId(pathKey, text),
        fileName: file.name,
        title: meta.title,
        date: meta.date,
        department: meta.department,
        text,
      });
    } catch (err) {
      console.error(`${file.name} の読み込みに失敗しました。`, err);
    }

    done++;
    loadStatus.textContent = `読み込み中... (${done} / ${textFiles.length})`;
  }

  records.sort((a, b) => a.fileName.localeCompare(b.fileName, "ja", { numeric: true }));

  loadStatus.textContent = `${records.length} 件の会議録を読み込みました。`;

  renderStats();

  if (searchInput.value.trim()) searchRecords();
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file, "UTF-8");
  });
}

/* ============================================================
   メタ情報抽出
   ============================================================ */

function extractMeta(text, fileName) {
  const titleFromText = getLineValue(text, "会議名");
  const dateFromText = getLineValue(text, "開催日");
  const deptFromText = getLineValue(text, "担当課");

  const base = fileName.replace(/\.txt$/i, "");
  let dateFromFile = "";
  let titleFromFile = base;

  const m = base.match(/^(\d{4}-\d{2}-\d{2})_(.+)$/);
  if (m) { dateFromFile = m[1]; titleFromFile = m[2]; }

  return {
    title: titleFromText || titleFromFile,
    date: dateFromText || dateFromFile || "",
    department: deptFromText || "",
  };
}

function getLineValue(text, label) {
  const regex = new RegExp(`^${escapeRegExp(label)}[：:](.+)$`, "m");
  const m = text.match(regex);
  return m ? m[1].trim() : "";
}

/* ============================================================
   統計パネル
   ============================================================ */

function renderStats() {
  if (records.length === 0) { statsSection.classList.add("hidden"); return; }

  statsSection.classList.remove("hidden");

  const dates = records.map((r) => r.date).filter(Boolean).sort();
  const depts = [...new Set(records.map((r) => r.department).filter(Boolean))].sort();

  const dateRangeHtml =
    dates.length > 1
      ? `${formatDate(dates[0])} ～ ${formatDate(dates[dates.length - 1])}`
      : dates.length === 1
      ? formatDate(dates[0])
      : "―";

  const deptTagsHtml =
    depts.length > 0
      ? depts
          .map(
            (d) =>
              `<span class="dept-tag dept-color-${getDeptColorIndex(d)}">${escapeHtml(d)}</span>`
          )
          .join("")
      : '<span class="text-muted">―</span>';

  statsArea.innerHTML = `
    <div class="stats-row">
      <div class="stat-box">
        <span class="stat-num">${records.length}</span>
        <span class="stat-label">会議録ファイル</span>
      </div>
      <div class="stat-sep" aria-hidden="true"></div>
      <div class="stat-box">
        <span class="stat-num">${depts.length}</span>
        <span class="stat-label">担当課</span>
      </div>
      <div class="stat-sep" aria-hidden="true"></div>
      <div class="stat-box stat-box--wide">
        <span class="stat-label">開催期間</span>
        <span class="stat-range">${dateRangeHtml}</span>
      </div>
    </div>
    ${
      depts.length > 0
        ? `<div class="stats-depts"><span class="stat-label">担当課一覧：</span><span class="dept-tags">${deptTagsHtml}</span></div>`
        : ""
    }
  `;
}

/* ============================================================
   検索
   ============================================================ */

searchButton.addEventListener("click", () => searchRecords());

clearButton.addEventListener("click", () => {
  searchInput.value = "";
  currentKeywords = [];
  currentResults = [];
  filteredResults = [];
  closeFullText();
  resultArea.innerHTML = '<p class="empty">検索結果はここに表示されます。</p>';
  resultsControls.classList.add("hidden");
  searchInput.focus();
});

searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") searchRecords();
});

let searchTimer = null;
searchInput.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => searchRecords(), 250);
});

deptFilter.addEventListener("change", () => {
  isExpandedResults = false;
  applyFilterAndSort();
  renderResults();
});

sortSelect.addEventListener("change", () => {
  isExpandedResults = false;
  applyFilterAndSort();
  renderResults();
});

function parseQuery(raw) {
  const normalized = raw.replace(/　/g, " ").trim();
  const phrases = [];
  const keywords = [];
  const excludes = [];

  // クォート・カギカッコのフレーズを先に抽出
  let remaining = normalized.replace(
    /[""「]([^""」]+)[""」]/g,
    (_, p) => { if (p.trim()) phrases.push(p.trim()); return " "; }
  );

  // 残りをスペースで分割してキーワード／除外語に振り分け
  remaining.split(/\s+/).forEach((w) => {
    const t = w.trim();
    if (!t) return;
    if (t.startsWith("-") && t.length > 1) {
      excludes.push(t.slice(1));
    } else {
      keywords.push(t);
    }
  });

  return { phrases, keywords, excludes };
}

function searchRecords() {
  closeFullText();

  if (records.length === 0) {
    resultArea.innerHTML = '<p class="empty">先に会議録ファイルを読み込んでください。</p>';
    resultsControls.classList.add("hidden");
    return;
  }

  const rawKeyword = searchInput.value.trim();
  if (!rawKeyword) {
    resultArea.innerHTML = '<p class="empty">検索キーワードを入力してください。</p>';
    resultsControls.classList.add("hidden");
    return;
  }

  const searchMode =
    document.querySelector('input[name="searchMode"]:checked')?.value || "and";
  const { phrases, keywords, excludes } = parseQuery(rawKeyword);

  currentKeywords = [...phrases, ...keywords];
  const allInclude = [...phrases, ...keywords];

  currentResults = records
    .map((record) => {
      const textLower = record.text.toLowerCase();

      // 含む条件（AND/OR）
      let matched;
      if (allInclude.length === 0) {
        matched = true;
      } else if (searchMode === "or") {
        matched = allInclude.some((t) => textLower.includes(t.toLowerCase()));
      } else {
        matched = allInclude.every((t) => textLower.includes(t.toLowerCase()));
      }

      // 除外条件（モードに関係なく AND NOT）
      if (matched && excludes.length > 0) {
        matched = !excludes.some((ex) => textLower.includes(ex.toLowerCase()));
      }

      if (!matched) return null;

      const positions = findMatchPositions(record.text, currentKeywords);
      const titlePositions = findMatchPositions(record.title, currentKeywords);
      const hitCount = positions.length;
      const score = titlePositions.length * 10 + hitCount;

      return {
        ...record,
        hitCount,
        score,
        snippets: buildSnippets(record.text, positions, MAX_SNIPPETS, SNIPPET_MARGIN),
      };
    })
    .filter(Boolean);

  updateDeptFilterOptions();
  resultsControls.classList.remove("hidden");
  isExpandedResults = false;
  applyFilterAndSort();
  renderResults();
}

function updateDeptFilterOptions() {
  const prev = deptFilter.value;
  const depts = [...new Set(currentResults.map((r) => r.department).filter(Boolean))].sort();
  deptFilter.innerHTML = '<option value="">すべての担当課</option>';
  for (const d of depts) {
    const opt = document.createElement("option");
    opt.value = d;
    opt.textContent = d;
    if (d === prev) opt.selected = true;
    deptFilter.appendChild(opt);
  }
}

function applyFilterAndSort() {
  const dept = deptFilter.value;
  const sort = sortSelect.value;

  filteredResults = dept
    ? currentResults.filter((r) => r.department === dept)
    : [...currentResults];

  if (sort === "date-desc") {
    filteredResults.sort(
      (a, b) => (b.date || "").localeCompare(a.date || "") || b.score - a.score
    );
  } else if (sort === "date-asc") {
    filteredResults.sort(
      (a, b) => (a.date || "").localeCompare(b.date || "") || b.score - a.score
    );
  } else {
    filteredResults.sort(
      (a, b) =>
        b.score - a.score ||
        a.fileName.localeCompare(b.fileName, "ja", { numeric: true })
    );
  }
}

/* ============================================================
   検索結果の描画
   ============================================================ */

function renderResults() {
  if (filteredResults.length === 0) {
    const msg =
      currentResults.length > 0
        ? "選択した絞り込み条件に該当する会議録はありませんでした。"
        : "該当する会議録は見つかりませんでした。";
    resultArea.innerHTML = `<p class="empty">${msg}</p>`;
    return;
  }

  const visibleResults = isExpandedResults
    ? filteredResults
    : filteredResults.slice(0, INITIAL_RESULT_LIMIT);

  const hiddenCount = Math.max(0, filteredResults.length - INITIAL_RESULT_LIMIT);
  const totalHits = filteredResults.reduce((s, r) => s + r.hitCount, 0);

  const dept = deptFilter.value;
  const counterText = dept
    ? `「${escapeHtml(dept)}」で <strong>${filteredResults.length}</strong> 件（全 ${currentResults.length} 件中）`
    : `<strong>${filteredResults.length}</strong> 件見つかりました — キーワード一致 ${totalHits} 箇所`;

  const itemsHtml = visibleResults
    .map((record) => buildResultItemHtml(record))
    .join("");

  let expandHtml = "";
  if (!isExpandedResults && hiddenCount > 0) {
    expandHtml = `
      <div class="expand-wrap">
        <button type="button" class="btn-expand" data-action="expand-results">
          さらに ${hiddenCount} 件を表示する ▼
        </button>
      </div>`;
  } else if (isExpandedResults && filteredResults.length > INITIAL_RESULT_LIMIT) {
    expandHtml = `
      <div class="expand-wrap">
        <button type="button" class="btn-expand btn-expand--collapse" data-action="collapse-results">
          表示を閉じる ▲
        </button>
      </div>`;
  }

  resultArea.innerHTML = `
    <div class="result-counter">
      <span class="result-count-text">${counterText}</span>
      <button type="button" class="secondary btn-print" data-action="print-results">印刷</button>
    </div>
    ${itemsHtml}
    ${expandHtml}
  `;
}

function buildResultItemHtml(record) {
  const dateHtml = record.date
    ? `<span class="result-date">${escapeHtml(formatDate(record.date))}</span>`
    : "";
  const deptHtml = record.department
    ? `<span class="dept-tag dept-color-${getDeptColorIndex(record.department)}">${escapeHtml(record.department)}</span>`
    : "";

  const barWidthPct = Math.min(100, Math.round((Math.min(record.hitCount, 20) / 20) * 100));

  const snippetsHtml = record.snippets
    .map(
      (s) =>
        `<blockquote class="snippet">${highlightKeywords(
          escapeHtml(s),
          currentKeywords
        )}</blockquote>`
    )
    .join("");

  return `
    <article class="result-item">
      <div class="result-item__head">
        <div class="result-badges">${dateHtml}${deptHtml}</div>
        <h3 class="result-title">${highlightKeywords(escapeHtml(record.title), currentKeywords)}</h3>
        <div class="result-item__sub">
          <span class="result-filename">${escapeHtml(record.fileName)}</span>
          <span class="hit-indicator" title="${record.hitCount}箇所でキーワードに一致">
            <span class="hit-bar"><span class="hit-bar__fill" style="width:${barWidthPct}%"></span></span>
            <span class="hit-count">${record.hitCount} 件一致</span>
          </span>
        </div>
      </div>
      ${snippetsHtml}
      <div class="result-actions">
        <button type="button" class="btn-fulltext" data-action="show-full-text"
                data-record-id="${escapeHtml(record.id)}">全文を表示 →</button>
      </div>
    </article>
  `;
}

resultArea.addEventListener("click", (event) => {
  if (!(event.target instanceof HTMLElement)) return;
  const btn = event.target.closest("[data-action]");
  if (!btn) return;

  switch (btn.dataset.action) {
    case "expand-results":
      isExpandedResults = true;
      renderResults();
      break;
    case "collapse-results":
      isExpandedResults = false;
      renderResults();
      resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
      break;
    case "show-full-text":
      showFullText(btn.dataset.recordId);
      break;
    case "print-results":
      window.print();
      break;
  }
});

/* ============================================================
   全文表示
   ============================================================ */

fullTextArea.addEventListener("click", (event) => {
  if (!(event.target instanceof HTMLElement)) return;
  const btn = event.target.closest("[data-action]");
  if (!btn) return;

  switch (btn.dataset.action) {
    case "close-full-text":  closeFullText(); scrollToResults(); break;
    case "back-to-results":  scrollToResults(); break;
    case "prev-match":       goToMatch(currentMatchIndex - 1); break;
    case "next-match":       goToMatch(currentMatchIndex + 1); break;
  }
});

function showFullText(recordId) {
  const record = records.find((r) => r.id === recordId);
  if (!record) return;

  const dateHtml = record.date
    ? `<span class="result-date">${escapeHtml(formatDate(record.date))}</span>`
    : "";
  const deptHtml = record.department
    ? `<span class="dept-tag dept-color-${getDeptColorIndex(record.department)}">${escapeHtml(record.department)}</span>`
    : "";

  const fullText = highlightKeywords(escapeHtml(record.text), currentKeywords);
  const hasKw = currentKeywords.length > 0;

  const navHtml = hasKw
    ? `<div class="match-nav">
        <button type="button" class="secondary" data-action="prev-match">◀ 前</button>
        <span id="matchCounter" class="match-counter">- / -</span>
        <button type="button" class="secondary" data-action="next-match">次 ▶</button>
      </div>`
    : "";

  const actionsHtml = `
    <div class="full-text-actions">
      <button type="button" class="secondary" data-action="back-to-results">← 検索結果に戻る</button>
      <button type="button" class="danger" data-action="close-full-text">✕ 閉じる</button>
    </div>`;

  fullTextArea.innerHTML = `
    <div class="full-text-header">
      <div class="full-text-badges">${dateHtml}${deptHtml}</div>
      <p class="full-text-title">${escapeHtml(record.title)}</p>
      <p class="full-text-meta">${escapeHtml(record.fileName)}</p>
      ${navHtml}
    </div>
    ${actionsHtml}
    <div class="full-text-body">${fullText}</div>
    ${actionsHtml}
  `;

  fullTextSection.classList.remove("hidden");
  matchElements = Array.from(
    fullTextArea.querySelectorAll(".full-text-body mark")
  );
  currentMatchIndex = -1;
  updateMatchCounter();
  fullTextSection.scrollIntoView({ behavior: "smooth", block: "start" });
  if (matchElements.length > 0) goToMatch(0);
}

function goToMatch(index) {
  if (matchElements.length === 0) return;
  const total = matchElements.length;
  const next = ((index % total) + total) % total;
  if (currentMatchIndex >= 0 && matchElements[currentMatchIndex]) {
    matchElements[currentMatchIndex].classList.remove("is-active");
  }
  currentMatchIndex = next;
  const el = matchElements[currentMatchIndex];
  el.classList.add("is-active");
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  updateMatchCounter();
}

function updateMatchCounter() {
  const el = document.getElementById("matchCounter");
  if (!el) return;
  el.textContent =
    matchElements.length === 0
      ? "一致なし"
      : `${currentMatchIndex + 1} / ${matchElements.length}`;
}

function closeFullText() {
  fullTextArea.innerHTML = "";
  fullTextSection.classList.add("hidden");
  matchElements = [];
  currentMatchIndex = -1;
}

function scrollToResults() {
  resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !fullTextSection.classList.contains("hidden")) {
    closeFullText();
    scrollToResults();
    return;
  }
  if (!fullTextSection.classList.contains("hidden") && document.activeElement?.tagName !== "INPUT") {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      goToMatch(currentMatchIndex + 1);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      goToMatch(currentMatchIndex - 1);
    }
  }
});

/* ============================================================
   ユーティリティ
   ============================================================ */

function findMatchPositions(text, keywords) {
  const valid = keywords.filter(Boolean);
  if (!valid.length) return [];
  const pattern = valid
    .slice()
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join("|");
  const regex = new RegExp(pattern, "gi");
  const positions = [];
  let m;
  let guard = 0;
  while ((m = regex.exec(text)) !== null) {
    positions.push({ index: m.index, length: m[0].length });
    if (m.index === regex.lastIndex) regex.lastIndex++;
    if (++guard > 50000) break;
  }
  return positions;
}

function buildSnippets(text, positions, maxSnippets, margin) {
  const snippets = [];
  let lastEnd = -1;
  for (const pos of positions) {
    if (snippets.length >= maxSnippets) break;
    const start = Math.max(0, pos.index - margin);
    if (start <= lastEnd) continue;
    const end = Math.min(text.length, pos.index + pos.length + margin);
    const prefix = start > 0 ? "…" : "";
    const suffix = end < text.length ? "…" : "";
    snippets.push(prefix + text.slice(start, end).replace(/\s+/g, " ").trim() + suffix);
    lastEnd = end;
  }
  return snippets;
}

function highlightKeywords(escapedText, keywords) {
  let result = escapedText;
  const sorted = [...keywords].filter(Boolean).sort((a, b) => b.length - a.length);
  for (const kw of sorted) {
    const escaped = escapeHtml(kw);
    const regex = new RegExp(`(${escapeRegExp(escaped)})`, "gi");
    result = result.replace(regex, "<mark>$1</mark>");
  }
  return result;
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[1]}年${parseInt(m[2])}月${parseInt(m[3])}日`;
  return dateStr;
}

const DEPT_COLOR_COUNT = 7;
function getDeptColorIndex(dept) {
  let h = 0;
  for (let i = 0; i < dept.length; i++) h = (h * 31 + dept.charCodeAt(i)) & 0xffff;
  return (h % DEPT_COLOR_COUNT) + 1;
}

function createRecordId(pathKey, text) {
  let hash = 0;
  const src = `${pathKey}_${text.length}`;
  for (let i = 0; i < src.length; i++) {
    hash = (hash << 5) - hash + src.charCodeAt(i);
    hash |= 0;
  }
  return `${pathKey}_${Math.abs(hash)}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
