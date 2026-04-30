(function () {
  "use strict";

  var U = window.APP_UTILS;
  var F = window.APP_FORMATTERS;
  window.APP_VIEWS = window.APP_VIEWS || {};

  function countBy(items, key) {
    var map = {};
    U.safeArray(items).forEach(function (item) {
      var value = U.safeString(item[key]) || "未設定";
      map[value] = (map[value] || 0) + 1;
    });
    return Object.keys(map).sort(function (a, b) {
      return map[b] - map[a] || a.localeCompare(b, "ja");
    }).map(function (keyName) {
      return { name: keyName, count: map[keyName] };
    });
  }

  function countTags(cases) {
    var map = {};
    U.safeArray(cases).forEach(function (item) {
      U.safeArray(item.tags).forEach(function (tag) {
        map[tag] = (map[tag] || 0) + 1;
      });
    });
    return Object.keys(map).sort(function (a, b) {
      return map[b] - map[a] || a.localeCompare(b, "ja");
    }).slice(0, 10).map(function (tag) {
      return { name: tag, count: map[tag] };
    });
  }

  function listHtml(items) {
    if (!items.length) return '<p class="empty-message">該当するデータがありません</p>';
    return '<ul class="compact-list">' + items.map(function (item) {
      return "<li><span>" + U.escapeHtml(item.name) + "</span><strong>" + item.count + "件</strong></li>";
    }).join("") + "</ul>";
  }

  function isAttention(item, today) {
    return item.is_overdue === true ||
      item.status === "未対応" ||
      item.priority === "緊急" ||
      (item.due_date && item.due_date <= today && !item.completed_date);
  }

  window.APP_VIEWS.renderDashboard = function (state) {
    var app = U.qs("#app");
    var today = U.getTodayString();
    var now = new Date();
    var thisYear = now.getFullYear();
    var thisMonth = now.getMonth() + 1;
    var cases = state.cases;
    var histories = state.histories;
    var openCount = cases.filter(function (c) { return c.is_open; }).length;
    var overdueCount = cases.filter(function (c) { return c.is_overdue; }).length;
    var monthCases = cases.filter(function (c) { return U.isDateInMonth(c.received_date, thisYear, thisMonth); }).length;
    var monthHistories = histories.filter(function (h) { return U.isDateInMonth(h.action_date, thisYear, thisMonth); }).length;
    var attention = cases.filter(function (c) { return isAttention(c, today); }).slice(0, 10);

    app.innerHTML = ''
      + '<section class="card">'
      + '<h2>' + U.escapeHtml(state.meta.app_name || "Excel対応履歴ビューア") + '</h2>'
      + '<p class="muted">最終出力：' + F.formatDateTime(state.meta.exported_at) + '</p>'
      + '</section>'
      + '<section class="stat-grid">'
      + statCard("全案件数", cases.length)
      + statCard("未完了件数", openCount)
      + statCard("期限超過件数", overdueCount)
      + statCard("今月受付件数", monthCases)
      + statCard("今月対応履歴", monthHistories)
      + '</section>'
      + '<section class="card-grid">'
      + cardList("ステータス別件数", listHtml(countBy(cases, "status")))
      + cardList("担当者別件数", listHtml(countBy(cases, "owner")))
      + cardList("重要度別件数", listHtml(countBy(cases, "priority")))
      + cardList("タグ別件数 上位10件", listHtml(countTags(cases)))
      + '</section>'
      + '<section class="card"><h2>要注意案件</h2>'
      + (attention.length ? attention.map(function (item) {
        return '<div class="attention-item clickable-item" data-case-id="' + U.escapeHtml(item._row_id) + '">'
          + '<div>' + F.overdueLabel(item) + ' ' + F.priorityBadge(item.priority) + ' ' + F.statusBadge(item.status) + '</div>'
          + '<strong>' + U.escapeHtml(item.case_id || "IDなし") + ' ' + U.escapeHtml(F.buildDisplayTitle(item)) + '</strong>'
          + '<span class="muted">期限：' + F.formatDate(item.due_date) + ' / 担当：' + F.formatEmpty(item.owner) + '</span>'
          + '</div>';
      }).join("") : '<p class="empty-message">該当するデータがありません</p>')
      + '</section>';

    U.qsa("[data-case-id]", app).forEach(function (el) {
      el.addEventListener("click", function () {
        window.APP.showCaseDetail(el.getAttribute("data-case-id"));
      });
    });
  };

  function statCard(label, value) {
    return '<div class="stat-card"><span class="label">' + U.escapeHtml(label) + '</span><span class="value">' + value + '件</span></div>';
  }

  function cardList(title, body) {
    return '<section class="card"><h2>' + U.escapeHtml(title) + '</h2>' + body + '</section>';
  }
})();
