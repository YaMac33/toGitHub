(() => {
  "use strict";

  const answers = (window.APP_DATA && window.APP_DATA.answers) || [];

  const els = {
    keyword: document.getElementById("keywordInput"),
    member: document.getElementById("memberFilter"),
    department: document.getElementById("departmentFilter"),
    section: document.getElementById("sectionFilter"),
    session: document.getElementById("sessionFilter"),
    answerType: document.getElementById("answerTypeFilter"),
    processResult: document.getElementById("processResultFilter"),
    displayMode: document.getElementById("displayModeFilter"),
    reset: document.getElementById("resetButton"),
    resultCount: document.getElementById("resultCount"),
    results: document.getElementById("results")
  };

  init();

  function init() {
    normalizeData();
    buildFilters();
    bindEvents();
    render();
  }

  function normalizeData() {
    answers.forEach((item, index) => {
      item.answer_id = String(item.answer_id || "");
      item.parent_answer_id = String(item.parent_answer_id || "");
      item.root_answer_id = String(item.root_answer_id || item.answer_id || "");
      item.answer_level = Number(item.answer_level || 0);
      item.sort_order = Number(item.sort_order || index + 1);
      item.search_text = String(item.search_text || buildSearchText(item));
    });
  }

  function buildFilters() {
    fillSelect(els.member, uniqueValues("member_name"));
    fillSelect(els.department, uniqueValues("department_name"));
    fillSelect(els.section, uniqueValues("section_name"));
    fillSelect(els.session, uniqueValues("session_raw"));
    fillSelect(els.answerType, uniqueValues("answer_type"));
    fillSelect(els.processResult, uniqueValues("process_result"));
  }

  function uniqueValues(key) {
    return [...new Set(
      answers
        .map(item => String(item[key] || "").trim())
        .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, "ja"));
  }

  function fillSelect(select, values) {
    values.forEach(value => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    });
  }

  function bindEvents() {
    [
      els.keyword,
      els.member,
      els.department,
      els.section,
      els.session,
      els.answerType,
      els.processResult,
      els.displayMode
    ].forEach(el => {
      el.addEventListener("input", render);
      el.addEventListener("change", render);
    });

    els.reset.addEventListener("click", () => {
      els.keyword.value = "";
      els.member.value = "";
      els.department.value = "";
      els.section.value = "";
      els.session.value = "";
      els.answerType.value = "";
      els.processResult.value = "";
      els.displayMode.value = "all";
      render();
    });
  }

  function render() {
    const filteredRows = answers.filter(matchesFilters);
    const groups = buildGroups(filteredRows);
    const displayGroups = filterGroupsByDisplayMode(groups);

    els.resultCount.textContent = `${displayGroups.length}件`;

    if (displayGroups.length === 0) {
      els.results.innerHTML = `<div class="empty">該当する答弁はありません。</div>`;
      return;
    }

    els.results.innerHTML = displayGroups.map(renderGroup).join("");

    els.results.querySelectorAll("[data-toggle-id]").forEach(button => {
      button.addEventListener("click", () => {
        const id = button.dataset.toggleId;
        const target = document.querySelector(`[data-child-list-id="${cssEscape(id)}"]`);
        if (!target) return;

        target.classList.toggle("is-hidden");
        button.textContent = target.classList.contains("is-hidden")
          ? "再質問・要望を表示"
          : "再質問・要望を閉じる";
      });
    });
  }

  function matchesFilters(item) {
    const keyword = normalizeText(els.keyword.value);

    if (keyword) {
      const haystack = normalizeText(item.search_text || buildSearchText(item));
      const keywords = keyword.split(/\s+/).filter(Boolean);

      if (!keywords.every(word => haystack.includes(word))) {
        return false;
      }
    }

    if (!matchesValue(item.member_name, els.member.value)) return false;
    if (!matchesValue(item.department_name, els.department.value)) return false;
    if (!matchesValue(item.section_name, els.section.value)) return false;
    if (!matchesValue(item.session_raw, els.session.value)) return false;
    if (!matchesValue(item.answer_type, els.answerType.value)) return false;
    if (!matchesValue(item.process_result, els.processResult.value)) return false;

    return true;
  }

  function matchesValue(actual, expected) {
    if (!expected) return true;
    return String(actual || "") === expected;
  }

  function buildGroups(rows) {
    const rowIdSet = new Set(rows.map(row => row.answer_id));
    const rootIdSet = new Set(rows.map(row => row.root_answer_id));

    // 再質問だけがヒットした場合でも、親の本答弁を表示する
    const relatedRows = answers.filter(row => {
      return rowIdSet.has(row.answer_id) || rootIdSet.has(row.root_answer_id);
    });

    const map = new Map();

    relatedRows.forEach(row => {
      const rootId = row.root_answer_id || row.answer_id;

      if (!map.has(rootId)) {
        map.set(rootId, {
          rootId,
          root: null,
          children: [],
          hit: false
        });
      }

      const group = map.get(rootId);

      if (row.answer_level === 0 || row.answer_id === rootId) {
        group.root = row;
      } else {
        group.children.push(row);
      }

      if (rows.some(hitRow => hitRow.answer_id === row.answer_id)) {
        group.hit = true;
      }
    });

    const groups = [...map.values()]
      .filter(group => group.root)
      .map(group => {
        group.children.sort((a, b) => a.sort_order - b.sort_order);
        return group;
      })
      .sort((a, b) => a.root.sort_order - b.root.sort_order);

    return groups;
  }

  function filterGroupsByDisplayMode(groups) {
    const mode = els.displayMode.value;

    if (mode === "rootOnly") {
      return groups.map(group => ({
        ...group,
        children: []
      }));
    }

    if (mode === "hasChildren") {
      return groups.filter(group => group.children.length > 0);
    }

    return groups;
  }

  function renderGroup(group) {
    const root = group.root;
    const children = group.children;
    const childListId = `children-${root.answer_id}`;
    const keyword = els.keyword.value.trim();

    return `
      <article class="answer-card">
        <header class="card-header">
          <div class="card-title-row">
            <div>
              <h2 class="card-title">${escapeHtml(root.item_title || "項目名なし")}</h2>
              <div class="meta">
                ${badge(root.session_raw)}
                ${badge(root.member_name)}
                ${badge(`${root.department_name || ""} ${root.section_name || ""}`.trim())}
                ${badge(root.category)}
                ${resultBadge(root.process_result)}
              </div>
            </div>
          </div>
        </header>

        <div class="card-body">
          ${renderBlock(root, true, keyword)}

          ${children.length > 0 ? `
            <div class="children">
              <button class="toggle-button" type="button" data-toggle-id="${escapeHtml(childListId)}">
                再質問・要望を表示
              </button>
              <div class="child-list is-hidden" data-child-list-id="${escapeHtml(childListId)}">
                ${children.map(child => renderBlock(child, false, keyword)).join("")}
              </div>
            </div>
          ` : ""}
        </div>
      </article>
    `;
  }

  function renderBlock(item, isRoot, keyword) {
    return `
      <section class="block ${isRoot ? "root" : ""}">
        <div class="block-title">
          <strong>${escapeHtml(item.answer_type || "")}</strong>
          <span class="badge">${escapeHtml(item.answer_id || "")}</span>
        </div>

        <div class="block-section">
          <h4>${item.answer_type === "要望" ? "要望" : "質問・要望要旨"}</h4>
          <p>${highlight(escapeHtml(item.question_summary || "-"), keyword)}</p>
        </div>

        <div class="block-section">
          <h4>答弁要旨</h4>
          <p>${highlight(escapeHtml(item.answer_summary || "-"), keyword)}</p>
        </div>

        <div class="block-section">
          <h4>今後の処理方針</h4>
          <p>${highlight(escapeHtml(item.future_policy || "-"), keyword)}</p>
        </div>

        <div class="block-section">
          <h4>処理結果</h4>
          <p>${escapeHtml(item.process_result || "-")}</p>
        </div>
      </section>
    `;
  }

  function badge(text) {
    if (!text) return "";
    return `<span class="badge">${escapeHtml(text)}</span>`;
  }

  function resultBadge(value) {
    const text = String(value || "-");
    let className = "badge result-none";

    if (text === "済") {
      className = "badge result-done";
    } else if (text === "継続") {
      className = "badge result-continue";
    }

    return `<span class="${className}">${escapeHtml(text)}</span>`;
  }

  function buildSearchText(item) {
    return [
      item.session_raw,
      item.notice_no,
      item.member_name,
      item.party_name,
      item.department_name,
      item.section_name,
      item.item_title,
      item.category,
      item.major_item,
      item.middle_item,
      item.minor_item,
      item.answer_type,
      item.question_summary,
      item.answer_summary,
      item.future_policy,
      item.process_result
    ].filter(Boolean).join(" ");
  }

  function normalizeText(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function highlight(html, keyword) {
    const words = normalizeText(keyword).split(/\s+/).filter(Boolean);
    if (words.length === 0) return html;

    let result = html;

    words.forEach(word => {
      const escapedWord = escapeRegExp(escapeHtml(word));
      if (!escapedWord) return;
      const reg = new RegExp(`(${escapedWord})`, "gi");
      result = result.replace(reg, "<mark>$1</mark>");
    });

    return result;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === "function") {
      return window.CSS.escape(value);
    }

    return String(value).replace(/"/g, '\\"');
  }
})();