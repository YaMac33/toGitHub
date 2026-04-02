window.QUESTIONS_VIEW = (function () {
  "use strict";

  const escapeHtml = window.APP_UTILS && typeof window.APP_UTILS.escapeHtml === "function"
    ? window.APP_UTILS.escapeHtml
    : function (value) { return String(value == null ? "" : value); };

  const state = {
    keyword: "",
    viewMode: "list"
  };

  const expandedMap = {};

  const els = {
    keywordInput: document.getElementById("keywordInput"),
    searchBtn: document.getElementById("searchBtn"),
    clearBtn: document.getElementById("clearBtn"),
    viewListBtn: document.getElementById("viewListBtn"),
    viewSessionBtn: document.getElementById("viewSessionBtn"),
    summaryKeyword: document.getElementById("summaryKeyword"),
    summaryCount: document.getElementById("summaryCount"),
    summaryView: document.getElementById("summaryView"),
    resultsArea: document.getElementById("resultsArea")
  };

  function getHeaderRecords() {
    if (window.APP_DATA && Array.isArray(window.APP_DATA.questions)) {
      return window.APP_DATA.questions;
    }
    return [];
  }

  function getDetailRecords() {
    if (window.APP_DATA && Array.isArray(window.APP_DATA.question_details)) {
      return window.APP_DATA.question_details;
    }
    return [];
  }

  function getRecords() {
    if (Array.isArray(window.RECORDS)) {
      return window.RECORDS.slice();
    }

    const headers = getHeaderRecords();
    const details = getDetailRecords();

    if (!headers.length || !details.length) {
      return headers.slice();
    }

    const headerMap = {};
    headers.forEach(function (header) {
      headerMap[header.question_id] = header;
    });

    return details
      .map(function (detail) {
        const header = headerMap[detail.question_id];
        if (!header) return null;

        return {
          question_id: header.question_id || "",
          detail_id: detail.detail_id || "",
          meeting_id: header.meeting_id || "",
          question_date: header.question_date || "",
          fiscal_year: header.fiscal_year || "",
          number: header.number || "",
          year: header.year || "",
          session: header.session || "",
          notice_no: header.notice_no || "",
          member_id: header.member_id || "",
          member_name: header.member_name || "",
          group: header.group || header.group_name || "",
          group_name: header.group_name || header.group || "",
          allotted_minutes: header.allotted_minutes || "",
          note: header.note || "",
          sort_order: detail.sort_order || header.sort_order || "",
          major_no: detail.major_no || "",
          middle_no: detail.middle_no || "",
          minor_no: detail.minor_no || "",
          content: detail.content || "",
          created_at: detail.created_at || header.created_at || "",
          updated_at: detail.updated_at || header.updated_at || ""
        };
      })
      .filter(Boolean);
  }

  function normalizeText(v) {
    return String(v == null ? "" : v).replace(/\s+/g, " ").trim();
  }

  function toNumber(v) {
    const n = parseInt(v, 10);
    return isNaN(n) ? 0 : n;
  }

  function getEraPriority(n) {
    n = normalizeText(n).toUpperCase();
    if (n === "R") return 0;
    if (n === "H") return 1;
    return 9;
  }

  function formatYear(number, year) {
    number = normalizeText(number).toUpperCase();
    year = normalizeText(year);
    if (number === "R") return "令和" + year + "年";
    if (number === "H") return "平成" + year + "年";
    return year + "年";
  }

  function formatSession(session) {
    return "第" + toNumber(session) + "回定例会";
  }

  function formatYS(r) {
    return formatYear(r.number, r.year) + " / " + formatSession(r.session);
  }

  function buildTreeLabel(r) {
    const a = normalizeText(r.major_no);
    const b = normalizeText(r.middle_no);
    const c = normalizeText(r.minor_no);
    const arr = [];
    if (a && a !== "-") arr.push(a);
    if (b && b !== "-") arr.push(b);
    if (c && c !== "-") arr.push(c);
    return arr.join("-") || "-";
  }

  function getDepth(r) {
    if (r.minor_no && r.minor_no !== "-") return 2;
    if (r.middle_no && r.middle_no !== "-") return 1;
    return 0;
  }

  function compareRecords(a, b) {
    const e = getEraPriority(a.number) - getEraPriority(b.number);
    if (e !== 0) return e;

    const y = toNumber(b.year) - toNumber(a.year);
    if (y !== 0) return y;

    const s = toNumber(b.session) - toNumber(a.session);
    if (s !== 0) return s;

    return toNumber(a.notice_no) - toNumber(b.notice_no);
  }

  function compareTreeRecords(a, b) {
    const aMajor = toNumber(a.major_no);
    const bMajor = toNumber(b.major_no);
    if (aMajor !== bMajor) return aMajor - bMajor;

    const aMiddle = toNumber(a.middle_no);
    const bMiddle = toNumber(b.middle_no);
    if (aMiddle !== bMiddle) return aMiddle - bMiddle;

    const aMinor = toNumber(a.minor_no);
    const bMinor = toNumber(b.minor_no);
    if (aMinor !== bMinor) return aMinor - bMinor;

    return 0;
  }

  function filterRecords(records, keyword) {
    const q = normalizeText(keyword).toLowerCase();
    if (!q) return records.slice();

    return records.filter(function (r) {
      return (
        normalizeText(r.member_name).toLowerCase().includes(q) ||
        normalizeText(r.content).toLowerCase().includes(q) ||
        normalizeText(r.notice_no).includes(q)
      );
    });
  }

  function groupList(records) {
    const map = {};

    records.forEach(function (r) {
      const member = r.member_name || "不明";
      if (!map[member]) {
        map[member] = {
          member: member,
          group: r.group || r.group_name || "",
          ys: {}
        };
      }

      const ysKey = r.number + "_" + r.year + "_" + r.session;
      if (!map[member].ys[ysKey]) {
        map[member].ys[ysKey] = {
          number: r.number,
          year: r.year,
          session: r.session,
          notices: {}
        };
      }

      const notice = r.notice_no;
      if (!map[member].ys[ysKey].notices[notice]) {
        map[member].ys[ysKey].notices[notice] = [];
      }

      map[member].ys[ysKey].notices[notice].push(r);
    });

    return Object.values(map);
  }

  function groupSession(records) {
    const map = {};

    records.forEach(function (r) {
      const sessionKey = r.number + "_" + r.year + "_" + r.session;
      if (!map[sessionKey]) {
        map[sessionKey] = {
          number: r.number,
          year: r.year,
          session: r.session,
          notices: {}
        };
      }

      const notice = r.notice_no;
      if (!map[sessionKey].notices[notice]) {
        map[sessionKey].notices[notice] = {};
      }

      const member = r.member_name || "不明";
      if (!map[sessionKey].notices[notice][member]) {
        map[sessionKey].notices[notice][member] = {
          group: r.group || r.group_name || "",
          records: []
        };
      }

      map[sessionKey].notices[notice][member].records.push(r);
    });

    return Object.values(map);
  }

  function renderTreeRows(list) {
    let html = "";
    list.forEach(function (r) {
      html += `
        <div class="tree-row depth-${getDepth(r)}">
          <div class="tree-inner">
            <span class="tree-label-badge">${escapeHtml(buildTreeLabel(r))}</span>
            <div class="tree-content">${escapeHtml(r.content)}</div>
          </div>
        </div>
      `;
    });
    return html;
  }

  function renderCollapsible(contentHtml, expandKey, collapsedClass) {
    const expanded = !!expandedMap[expandKey];
    return `
      <div class="collapsible ${expanded ? "expanded" : collapsedClass}">
        ${contentHtml}
      </div>
      <div class="more-wrap">
        <button class="more-btn" data-key="${escapeHtml(expandKey)}">
          ${expanded ? "閉じる" : "もっと見る"}
        </button>
      </div>
    `;
  }

  function renderListCards(groups) {
    if (groups.length === 0) {
      els.resultsArea.innerHTML = `<div class="empty-box">検索結果がありません</div>`;
      return;
    }

    let html = `<div class="cards">`;

    groups.forEach(function (g) {
      html += `
        <section class="card">
          <div class="card-header">
            <h3 class="card-title">${escapeHtml(g.member)}${g.group ? `（${escapeHtml(g.group)}）` : ""}</h3>
          </div>
      `;

      const ysList = Object.values(g.ys).sort(compareRecords);
      let innerHtml = "";

      ysList.forEach(function (ys) {
        innerHtml += `
          <div class="section-block">
            <div class="section-title">${escapeHtml(formatYS(ys))}</div>
        `;

        const notices = Object.keys(ys.notices).sort(function (a, b) {
          return toNumber(a) - toNumber(b);
        });

        notices.forEach(function (n) {
          const list = ys.notices[n].slice().sort(compareTreeRecords);

          innerHtml += `
            <div class="notice-block">
              <div class="notice-title">通告No: ${escapeHtml(n)}</div>
              <div class="tree-block">
                ${renderTreeRows(list)}
              </div>
            </div>
          `;
        });

        innerHtml += `</div>`;
      });

      const expandKey = `list:${g.member}`;
      html += renderCollapsible(innerHtml, expandKey, "member-collapsed");
      html += `</section>`;
    });

    html += `</div>`;
    els.resultsArea.innerHTML = html;
  }

  function renderSessionCards(groups) {
    if (groups.length === 0) {
      els.resultsArea.innerHTML = `<div class="empty-box">検索結果がありません</div>`;
      return;
    }

    let html = `<div class="cards">`;

    groups.sort(compareRecords).forEach(function (s) {
      html += `
        <section class="card">
          <div class="card-header">
            <h3 class="card-title">${escapeHtml(formatYS(s))}</h3>
          </div>
      `;

      const notices = Object.keys(s.notices).sort(function (a, b) {
        return toNumber(a) - toNumber(b);
      });

      notices.forEach(function (n) {
        const members = Object.keys(s.notices[n]).sort();

        html += `
          <div class="section-block">
            <div class="section-title">通告No: ${escapeHtml(n)}</div>
        `;

        members.forEach(function (m) {
          const obj = s.notices[n][m];
          const sortedList = obj.records.slice().sort(compareTreeRecords);
          const memberInnerHtml = `
            <div class="tree-block">
              ${renderTreeRows(sortedList)}
            </div>
          `;
          const expandKey = `session:${s.number}_${s.year}_${s.session}:${m}`;

          html += `
            <div class="notice-block">
              <div class="member-title">${escapeHtml(m)} <span class="muted">(${escapeHtml(obj.group || "所属なし")})</span></div>
              ${renderCollapsible(memberInnerHtml, expandKey, "session-member-collapsed")}
            </div>
          `;
        });

        html += `</div>`;
      });

      html += `</section>`;
    });

    html += `</div>`;
    els.resultsArea.innerHTML = html;
  }

  function updateViewButtons() {
    [els.viewListBtn, els.viewSessionBtn].forEach(function (btn) {
      btn.classList.remove("active");
    });

    if (state.viewMode === "list") els.viewListBtn.classList.add("active");
    if (state.viewMode === "session") els.viewSessionBtn.classList.add("active");
  }

  function render() {
    const records = getRecords();
    const data = filterRecords(records, state.keyword).sort(compareRecords);

    els.summaryKeyword.textContent = state.keyword ? state.keyword : "なし";
    els.summaryCount.textContent = data.length + "件";

    const viewLabels = {
      list: "一覧",
      session: "回ごと"
    };
    els.summaryView.textContent = viewLabels[state.viewMode];

    updateViewButtons();

    if (state.viewMode === "list") {
      renderListCards(groupList(data));
    } else {
      renderSessionCards(groupSession(data));
    }
  }

  function bind() {
    els.searchBtn.addEventListener("click", function () {
      state.keyword = els.keywordInput.value;
      render();
    });

    els.keywordInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        state.keyword = els.keywordInput.value;
        render();
      }
    });

    els.clearBtn.addEventListener("click", function () {
      state.keyword = "";
      els.keywordInput.value = "";
      Object.keys(expandedMap).forEach(function (k) {
        delete expandedMap[k];
      });
      render();
    });

    els.viewListBtn.addEventListener("click", function () {
      state.viewMode = "list";
      render();
    });

    els.viewSessionBtn.addEventListener("click", function () {
      state.viewMode = "session";
      render();
    });

    els.resultsArea.addEventListener("click", function (e) {
      const btn = e.target.closest(".more-btn");
      if (!btn) return;
      const key = btn.getAttribute("data-key");
      if (!key) return;
      expandedMap[key] = !expandedMap[key];
      render();
    });
  }

  function init() {
    bind();
    render();
  }

  return {
    init: init
  };
})();

document.addEventListener("DOMContentLoaded", function () {
  window.QUESTIONS_VIEW.init();
});