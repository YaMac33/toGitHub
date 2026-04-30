(function () {
  "use strict";

  var U = window.APP_UTILS;
  var F = window.APP_FORMATTERS;
  window.APP_VIEWS = window.APP_VIEWS || {};

  function optionHtml(list, selected) {
    return '<option value="">すべて</option>' + list.map(function (v) {
      return '<option value="' + U.escapeHtml(v) + '"' + (v === selected ? " selected" : "") + ">" + U.escapeHtml(v) + "</option>";
    }).join("");
  }

  function getSearchText(item) {
    return [
      item.case_id, item.person_id, item.person_name, item.person_kana, item.title,
      item.summary, item.department, item.owner, item.area, U.safeArray(item.tags).join(" "), item.search_text
    ].join(" ");
  }

  function filterCases(state) {
    var f = state.filters;
    var result = state.cases.filter(function (item) {
      if (!U.includesText(getSearchText(item), f.keyword)) return false;
      if (f.status && item.status !== f.status) return false;
      if (f.owner && item.owner !== f.owner) return false;
      if (f.department && item.department !== f.department) return false;
      if (f.area && item.area !== f.area) return false;
      if (f.priority && item.priority !== f.priority) return false;
      if (f.tag && U.safeArray(item.tags).indexOf(f.tag) === -1) return false;
      if (f.openOnly && !item.is_open) return false;
      if (f.overdueOnly && !item.is_overdue) return false;
      return true;
    });

    return sortCases(result, state.caseListSort || "received_desc");
  }

  function sortCases(items, sortKey) {
    var priorityRank = { "緊急": 0, "重要": 1, "通常": 2 };
    var statusRank = { "未対応": 0, "対応中": 1, "保留": 2, "完了": 3 };
    return items.slice().sort(function (a, b) {
      if (sortKey === "received_asc") return U.compareDateString(a.received_date, b.received_date);
      if (sortKey === "last_desc") return U.compareDateString(b.last_action_date, a.last_action_date);
      if (sortKey === "due_asc") return U.compareDateString(a.due_date, b.due_date);
      if (sortKey === "priority") return rank(priorityRank, a.priority) - rank(priorityRank, b.priority);
      if (sortKey === "status") return rank(statusRank, a.status) - rank(statusRank, b.status);
      return U.compareDateString(b.received_date, a.received_date);
    });
  }

  function rank(map, key) {
    return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : 9;
  }

  window.APP_VIEWS.renderCaseList = function (state) {
    var app = U.qs("#app");
    var f = state.filters;
    var items = filterCases(state);

    app.innerHTML = ''
      + '<section class="card"><h2 class="page-title">案件一覧</h2>'
      + '<div class="toolbar">'
      + '<input id="caseKeyword" type="search" placeholder="検索" value="' + U.escapeHtml(f.keyword) + '">'
      + '<div class="filters">'
      + select("caseStatus", state.lists.statuses, f.status, "状態")
      + select("caseOwner", state.lists.owners, f.owner, "担当")
      + select("caseDepartment", state.lists.departments, f.department, "部署")
      + select("caseArea", state.lists.areas, f.area, "地区")
      + select("casePriority", state.lists.priorities, f.priority, "重要度")
      + select("caseTag", state.lists.tags, f.tag, "タグ")
      + '</div>'
      + '<div class="filter-actions">'
      + '<label><input id="caseOpenOnly" type="checkbox"' + (f.openOnly ? " checked" : "") + '> 未完了のみ</label>'
      + '<label><input id="caseOverdueOnly" type="checkbox"' + (f.overdueOnly ? " checked" : "") + '> 期限超過のみ</label>'
      + '<select id="caseSort">'
      + '<option value="received_desc">受付日 新しい順</option><option value="received_asc">受付日 古い順</option>'
      + '<option value="last_desc">最終対応日 新しい順</option><option value="due_asc">対応期限 近い順</option>'
      + '<option value="priority">重要度順</option><option value="status">ステータス順</option>'
      + '</select><button type="button" id="clearCaseFilters" class="text-button">フィルタ解除</button>'
      + '<span class="muted">' + items.length + '件</span></div></div></section>'
      + '<section class="card">' + tableHtml(items) + '</section>';

    U.qs("#caseSort").value = state.caseListSort || "received_desc";
    bind(app, state);
  };

  function select(id, list, selected, label) {
    return '<label><span class="muted">' + U.escapeHtml(label) + '</span><select id="' + id + '">' + optionHtml(list, selected) + '</select></label>';
  }

  function tableHtml(items) {
    if (!items.length) return '<p class="empty-message">該当するデータがありません</p>';
    return '<div class="table-wrap"><table class="data-table"><thead><tr>'
      + '<th>受付日</th><th>相談者</th><th>件名</th><th>ステータス</th><th>重要度</th><th>担当部署</th><th>主担当者</th><th>対応期限</th><th>タグ</th>'
      + '</tr></thead><tbody>' + items.map(function (item) {
        return '<tr class="clickable-row" data-case-id="' + U.escapeHtml(item._row_id) + '">'
          + '<td>' + F.formatDate(item.received_date) + '</td>'
          + '<td>' + F.formatEmpty(item.person_name) + '</td>'
          + '<td><strong>' + U.escapeHtml(F.buildDisplayTitle(item)) + '</strong><div class="muted">' + F.formatEmpty(item.case_id) + '</div></td>'
          + '<td>' + F.statusBadge(item.status) + '</td>'
          + '<td>' + F.priorityBadge(item.priority) + '</td>'
          + '<td>' + F.formatEmpty(item.department) + '</td>'
          + '<td>' + F.formatEmpty(item.owner) + '</td>'
          + '<td>' + F.formatDate(item.due_date) + ' ' + F.overdueLabel(item) + '</td>'
          + '<td>' + F.formatTags(item.tags) + '</td></tr>';
      }).join("") + '</tbody></table></div>';
  }

  function bind(root, state) {
    function apply() {
      state.filters.keyword = U.qs("#caseKeyword").value;
      state.filters.status = U.qs("#caseStatus").value;
      state.filters.owner = U.qs("#caseOwner").value;
      state.filters.department = U.qs("#caseDepartment").value;
      state.filters.area = U.qs("#caseArea").value;
      state.filters.priority = U.qs("#casePriority").value;
      state.filters.tag = U.qs("#caseTag").value;
      state.filters.openOnly = U.qs("#caseOpenOnly").checked;
      state.filters.overdueOnly = U.qs("#caseOverdueOnly").checked;
      state.caseListSort = U.qs("#caseSort").value;
      window.APP.render();
    }
    ["#caseKeyword", "#caseStatus", "#caseOwner", "#caseDepartment", "#caseArea", "#casePriority", "#caseTag", "#caseOpenOnly", "#caseOverdueOnly", "#caseSort"].forEach(function (id) {
      U.qs(id, root).addEventListener(id === "#caseKeyword" ? "input" : "change", apply);
    });
    U.qs("#clearCaseFilters", root).addEventListener("click", function () {
      window.APP.clearFilters();
      window.APP.render();
    });
    U.qsa("[data-case-id]", root).forEach(function (row) {
      row.addEventListener("click", function () {
        window.APP.showCaseDetail(row.getAttribute("data-case-id"));
      });
    });
  }
})();
