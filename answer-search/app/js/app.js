(() => {
  "use strict";

  const answers = (window.APP_DATA && window.APP_DATA.answers) || [];
  const state = {
    expandedRoots: new Set()
  };

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
      state.expandedRoots.clear();
      render();
      els.keyword.focus();
    });

    els.results.addEventListener("click", event => {
      const button = event.target.closest("[data-toggle-root]");
      if (!button) return;

      const rootId = button.dataset.toggleRoot;
      if (state.expandedRoots.has(rootId)) {
        state.expandedRoots.delete(rootId);
      } else {
        state.expandedRoots.add(rootId);
      }

      render();
    });
  }

  function render() {
    const filteredRows = answers.filter(matchesFilters);
    const groups = filterGroupsByDisplayMode(buildGroups(filteredRows));
    const totalChildren = groups.reduce((sum, group) => sum + group.children.length, 0);

    els.resultCount.textContent = `${groups.length}項目 / ${totalChildren}件の再質問・要望`;

    if (answers.length === 0) {
      els.results.innerHTML = '<div class="empty">答弁データが読み込まれていません。</div>';
      return;
    }

    if (groups.length === 0) {
      els.results.innerHTML = '<div class="empty">該当する答弁はありません。</div>';
      return;
    }

    els.results.innerHTML = groups.map(renderGroup).join("");
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

    return matchesValue(item.member_name, els.member.value) &&
      matchesValue(item.department_name, els.department.value) &&
      matchesValue(item.section_name, els.section.value) &&
      matchesValue(item.session_raw, els.session.value) &&
      matchesValue(item.answer_type, els.answerType.value) &&
      matchesValue(item.process_result, els.processResult.value);
  }

  function matchesValue(actual, expected) {
    if (!expected) return true;
    return String(actual || "") === expected;
  }

  function buildGroups(rows) {
    const hitIds = new Set(rows.map(row => row.answer_id));
    const rootIds = new Set(rows.map(row => row.root_answer_id || row.answer_id));
    const groups = new Map();

    answers
      .filter(row => hitIds.has(row.answer_id) || rootIds.has(row.root_answer_id || row.answer_id))
      .forEach(row => {
        const rootId = row.root_answer_id || row.answer_id;

        if (!groups.has(rootId)) {
          groups.set(rootId, {
            rootId,
            root: null,
            children: [],
            hitIds
          });
        }

        const group = groups.get(rootId);
        if (row.answer_level === 0 || row.answer_id === rootId) {
          group.root = row;
        } else {
          group.children.push(row);
        }
      });

    return [...groups.values()]
      .filter(group => group.root)
      .map(group => {
        group.children.sort((a, b) => a.sort_order - b.sort_order);
        return group;
      })
      .sort((a, b) => a.root.sort_order - b.root.sort_order);
  }

  function filterGroupsByDisplayMode(groups) {
    const mode = els.displayMode.value;

    if (mode === "rootOnly") {
      return groups.map(group => ({ ...group, children: [] }));
    }

    if (mode === "hasChildren") {
      return groups.filter(group => group.children.length > 0);
    }

    return groups;
  }

  function renderGroup(group) {
    const root = group.root;
    const children = group.children;
    const isExpanded = state.expandedRoots.has(group.rootId);
    const keyword = els.keyword.value.trim();
    const childSummary = children.length > 0 ? `${children.length}件の再質問・要望` : "再質問・要望なし";

    return `
      <article class="answer-card">
        <header class="card-header">
          <div>
            <h2 class="card-title">${highlightText(root.item_title || "項目名なし", keyword)}</h2>
            <div class="meta">
              ${badge(root.session_raw)}
              ${badge(root.member_name)}
              ${badge(joinValues(root.department_name, root.section_name))}
              ${badge(joinValues(root.major_item, root.middle_item, root.minor_item))}
              ${badge(root.category)}
              ${resultBadge(root.process_result)}
            </div>
          </div>
          <span class="child-count">${childSummary}</span>
        </header>

        <div class="card-body">
          ${renderBlock(root, true, keyword, group.hitIds.has(root.answer_id))}

          ${children.length > 0 ? `
            <div class="children">
              <button class="toggle-button" type="button" data-toggle-root="${escapeHtml(group.rootId)}" aria-expanded="${isExpanded}">
                ${isExpanded ? "再質問・要望を閉じる" : "再質問・要望を表示"}
              </button>
              <div class="child-list ${isExpanded ? "" : "is-hidden"}">
                ${children.map(child => renderBlock(child, false, keyword, group.hitIds.has(child.answer_id))).join("")}
              </div>
            </div>
          ` : ""}
        </div>
      </article>
    `;
  }

  function renderBlock(item, isRoot, keyword, isHit) {
    const questionLabel = item.answer_type === "要望" ? "要望" : "質問・要望要旨";

    return `
      <section class="block ${isRoot ? "root" : ""} ${isHit ? "hit" : ""}">
        <div class="block-title">
          <strong>${escapeHtml(item.answer_type || "-")}</strong>
          <span class="badge id-badge">${escapeHtml(item.answer_id || "-")}</span>
        </div>

        ${renderSection(questionLabel, item.question_summary, keyword)}
        ${renderSection("答弁要旨", item.answer_summary, keyword)}
        ${renderSection("今後の処理方針", item.future_policy, keyword)}
        ${renderSection("処理結果", item.process_result, keyword)}
      </section>
    `;
  }

  function renderSection(title, value, keyword) {
    return `
      <div class="block-section">
        <h3>${escapeHtml(title)}</h3>
        <p>${highlightText(cleanValue(value), keyword)}</p>
      </div>
    `;
  }

  function cleanValue(value) {
    const text = String(value ?? "").trim();
    return text || "-";
  }

  function badge(text) {
    if (!text) return "";
    return `<span class="badge">${escapeHtml(text)}</span>`;
  }

  function resultBadge(value) {
    const text = cleanValue(value);
    let className = "badge result-none";

    if (text === "済") {
      className = "badge result-done";
    } else if (text === "継続") {
      className = "badge result-continue";
    }

    return `<span class="${className}">${escapeHtml(text)}</span>`;
  }

  function joinValues(...values) {
    return values.map(value => String(value || "").trim()).filter(Boolean).join(" ");
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
      .toLocaleLowerCase("ja")
      .normalize("NFKC")
      .replace(/\s+/g, " ")
      .trim();
  }

  function highlightText(value, keyword) {
    const escaped = escapeHtml(value);
    const words = normalizeText(keyword).split(/\s+/).filter(Boolean);
    if (words.length === 0) return escaped;

    return words.reduce((html, word) => {
      const pattern = escapeRegExp(escapeHtml(word));
      if (!pattern) return html;
      return html.replace(new RegExp(`(${pattern})`, "gi"), "<mark>$1</mark>");
    }, escaped);
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
})();
