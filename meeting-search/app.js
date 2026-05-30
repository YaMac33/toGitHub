const fileInput = document.getElementById("fileInput");
const loadStatus = document.getElementById("loadStatus");
const searchInput = document.getElementById("searchInput");
const searchButton = document.getElementById("searchButton");
const resultArea = document.getElementById("resultArea");
const resultsSection = document.getElementById("resultsSection");
const fullTextSection = document.getElementById("fullTextSection");
const fullTextArea = document.getElementById("fullTextArea");

let records = [];
let currentResults = [];
let currentKeywords = [];
let isExpandedResults = false;

const INITIAL_RESULT_LIMIT = 3;

fileInput.addEventListener("change", handleFileSelect);
searchButton.addEventListener("click", searchRecords);

searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    searchRecords();
  }
});

async function handleFileSelect(event) {
  const files = Array.from(event.target.files || []);

  records = [];
  currentResults = [];
  currentKeywords = [];
  isExpandedResults = false;

  closeFullText();

  resultArea.innerHTML = '<p class="empty">検索結果はここに表示されます。</p>';

  if (files.length === 0) {
    loadStatus.textContent = "まだファイルは読み込まれていません。";
    return;
  }

  const textFiles = files.filter((file) => {
    return file.name.toLowerCase().endsWith(".txt");
  });

  if (textFiles.length === 0) {
    loadStatus.textContent = ".txt ファイルが選択されていません。";
    return;
  }

  for (const file of textFiles) {
    try {
      const text = await readFileAsText(file);
      const meta = extractMeta(text, file.name);

      records.push({
        id: createRecordId(file.name, text),
        fileName: file.name,
        title: meta.title,
        date: meta.date,
        department: meta.department,
        text: text
      });
    } catch (error) {
      console.error(`${file.name} の読み込みに失敗しました。`, error);
    }
  }

  records.sort((a, b) => {
    return `${b.date}_${b.title}`.localeCompare(`${a.date}_${a.title}`, "ja");
  });

  loadStatus.textContent = `${records.length}件の会議録を読み込みました。`;
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      resolve(String(reader.result || ""));
    };

    reader.onerror = () => {
      reject(reader.error);
    };

    reader.readAsText(file, "UTF-8");
  });
}

function extractMeta(text, fileName) {
  const titleFromText = getLineValue(text, "会議名");
  const dateFromText = getLineValue(text, "開催日");
  const departmentFromText = getLineValue(text, "担当課");

  const fileBaseName = fileName.replace(/\.txt$/i, "");

  let dateFromFileName = "";
  let titleFromFileName = fileBaseName;

  const fileNameMatch = fileBaseName.match(/^(\d{4}-\d{2}-\d{2})_(.+)$/);

  if (fileNameMatch) {
    dateFromFileName = fileNameMatch[1];
    titleFromFileName = fileNameMatch[2];
  }

  return {
    title: titleFromText || titleFromFileName,
    date: dateFromText || dateFromFileName || "日付不明",
    department: departmentFromText || "担当課不明"
  };
}

function getLineValue(text, label) {
  const regex = new RegExp(`^${escapeRegExp(label)}[：:](.+)$`, "m");
  const match = text.match(regex);

  if (!match) {
    return "";
  }

  return match[1].trim();
}

function searchRecords() {
  closeFullText();

  if (records.length === 0) {
    resultArea.innerHTML = '<p class="empty">先に会議録ファイルを読み込んでください。</p>';
    return;
  }

  const rawKeyword = searchInput.value.trim();

  if (!rawKeyword) {
    resultArea.innerHTML = '<p class="empty">検索キーワードを入力してください。</p>';
    return;
  }

  currentKeywords = rawKeyword
    .replace(/\u3000/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);

  currentResults = records
    .map((record) => {
      const hit = isAndMatch(record.text, currentKeywords);

      if (!hit) {
        return null;
      }

      return {
        ...record,
        snippet: createSnippet(record.text, currentKeywords)
      };
    })
    .filter(Boolean);

  isExpandedResults = false;
  renderResults();
}

function isAndMatch(text, keywords) {
  const normalizedText = text.toLowerCase();

  return keywords.every((keyword) => {
    return normalizedText.includes(keyword.toLowerCase());
  });
}

function createSnippet(text, keywords) {
  const normalizedText = text.toLowerCase();

  let firstIndex = -1;
  let firstKeyword = "";

  for (const keyword of keywords) {
    const index = normalizedText.indexOf(keyword.toLowerCase());

    if (index !== -1 && (firstIndex === -1 || index < firstIndex)) {
      firstIndex = index;
      firstKeyword = keyword;
    }
  }

  if (firstIndex === -1) {
    return "";
  }

  const margin = 70;
  const start = Math.max(0, firstIndex - margin);
  const end = Math.min(text.length, firstIndex + firstKeyword.length + margin);

  const prefix = start > 0 ? "..." : "";
  const suffix = end < text.length ? "..." : "";

  return prefix + text.slice(start, end).trim() + suffix;
}

function renderResults() {
  if (currentResults.length === 0) {
    resultArea.innerHTML = '<p class="empty">該当する会議録は見つかりませんでした。</p>';
    return;
  }

  const visibleResults = isExpandedResults
    ? currentResults
    : currentResults.slice(0, INITIAL_RESULT_LIMIT);

  const resultHtml = visibleResults.map((record) => {
    const title = escapeHtml(record.title);
    const date = escapeHtml(record.date);
    const department = escapeHtml(record.department);
    const fileName = escapeHtml(record.fileName);
    const snippet = highlightKeywords(escapeHtml(record.snippet), currentKeywords);

    return `
      <article class="result-item">
        <p class="result-title">【${date}】${title}</p>
        <p class="result-meta">担当課：${department} ／ ファイル名：${fileName}</p>
        <p class="snippet">${snippet}</p>
        <div class="result-actions">
          <button type="button" data-action="show-full-text" data-record-id="${escapeHtml(record.id)}">
            全文を見る
          </button>
        </div>
      </article>
    `;
  }).join("");

  const hiddenCount = Math.max(0, currentResults.length - INITIAL_RESULT_LIMIT);

  let toggleHtml = "";

  if (currentResults.length > INITIAL_RESULT_LIMIT) {
    toggleHtml = `
      <div class="toggle-results">
        <button type="button" class="secondary" data-action="toggle-results">
          ${isExpandedResults ? "表示を少なくする" : `すべて表示（残り${hiddenCount}件）`}
        </button>
      </div>
    `;
  }

  resultArea.innerHTML = `
    <p class="result-count">${currentResults.length}件見つかりました。</p>
    ${resultHtml}
    ${toggleHtml}
  `;
}

resultArea.addEventListener("click", (event) => {
  const target = event.target;

  if (!(target instanceof HTMLElement)) {
    return;
  }

  const action = target.dataset.action;

  if (action === "toggle-results") {
    isExpandedResults = !isExpandedResults;
    renderResults();
    scrollToResults();
    return;
  }

  if (action === "show-full-text") {
    const recordId = target.dataset.recordId;
    showFullText(recordId);
  }
});

fullTextArea.addEventListener("click", (event) => {
  const target = event.target;

  if (!(target instanceof HTMLElement)) {
    return;
  }

  const action = target.dataset.action;

  if (action === "close-full-text") {
    closeFullText();
    scrollToResults();
    return;
  }

  if (action === "back-to-results") {
    scrollToResults();
  }
});

function showFullText(recordId) {
  const record = records.find((item) => item.id === recordId);

  if (!record) {
    return;
  }

  const title = escapeHtml(record.title);
  const date = escapeHtml(record.date);
  const department = escapeHtml(record.department);
  const fileName = escapeHtml(record.fileName);
  const fullText = highlightKeywords(escapeHtml(record.text), currentKeywords);

  const actionsHtml = `
    <div class="full-text-actions">
      <button type="button" class="secondary" data-action="back-to-results">
        検索結果に戻る
      </button>
      <button type="button" class="danger" data-action="close-full-text">
        全文表示を閉じる
      </button>
    </div>
  `;

  fullTextArea.innerHTML = `
    <div class="full-text-header">
      <p class="full-text-title">【${date}】${title}</p>
      <p class="full-text-meta">担当課：${department} ／ ファイル名：${fileName}</p>
    </div>

    ${actionsHtml}

    <div class="full-text-body">${fullText}</div>

    ${actionsHtml}
  `;

  fullTextSection.classList.remove("hidden");
  fullTextSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeFullText() {
  fullTextArea.innerHTML = "";
  fullTextSection.classList.add("hidden");
}

function scrollToResults() {
  resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

function createRecordId(fileName, text) {
  let hash = 0;
  const source = `${fileName}_${text.length}`;

  for (let i = 0; i < source.length; i++) {
    hash = (hash << 5) - hash + source.charCodeAt(i);
    hash |= 0;
  }

  return `${fileName}_${Math.abs(hash)}`;
}

function highlightKeywords(escapedText, keywords) {
  let result = escapedText;

  const sortedKeywords = [...keywords]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  for (const keyword of sortedKeywords) {
    const escapedKeyword = escapeHtml(keyword);
    const regex = new RegExp(`(${escapeRegExp(escapedKeyword)})`, "gi");

    result = result.replace(regex, "<mark>$1</mark>");
  }

  return result;
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
