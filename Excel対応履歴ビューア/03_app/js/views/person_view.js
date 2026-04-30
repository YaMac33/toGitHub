(function () {
  "use strict";

  var U = window.APP_UTILS;
  var F = window.APP_FORMATTERS;
  window.APP_VIEWS = window.APP_VIEWS || {};

  function buildPeople(state) {
    var groups = {};
    state.cases.forEach(function (item) {
      var key = item.person_id || item.person_name || "(未設定)";
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return Object.keys(groups).map(function (key) {
      var cases = groups[key];
      var first = cases[0] || {};
      var tags = {};
      cases.forEach(function (c) {
        U.safeArray(c.tags).forEach(function (tag) { tags[tag] = (tags[tag] || 0) + 1; });
      });
      var latest = cases.slice().sort(function (a, b) { return U.compareDateString(b.received_date, a.received_date); })[0] || {};
      return {
        key: key,
        person_id: first.person_id,
        person_name: first.person_name,
        person_kana: first.person_kana,
        cases: cases,
        openCount: cases.filter(function (c) { return c.is_open; }).length,
        overdueCount: cases.filter(function (c) { return c.is_overdue; }).length,
        lastAction: cases.map(function (c) { return c.last_action_date || c.received_date; }).sort().pop() || "",
        tags: Object.keys(tags).sort(function (a, b) { return tags[b] - tags[a]; }).slice(0, 3),
        latestTitle: F.buildDisplayTitle(latest)
      };
    }).sort(function (a, b) {
      return U.compareDateString(b.lastAction, a.lastAction);
    });
  }

  window.APP_VIEWS.renderPersonView = function (state) {
    var app = U.qs("#app");
    var keyword = state.personKeyword || "";
    var people = buildPeople(state).filter(function (p) {
      return U.includesText([p.person_id, p.person_name, p.person_kana].join(" "), keyword);
    });
    var selected = state.selectedPersonKey || (people[0] && people[0].key) || "";
    var selectedPerson = people.filter(function (p) { return p.key === selected; })[0] || null;

    app.innerHTML = ''
      + '<section class="card"><h2 class="page-title">相談者ビュー</h2>'
      + '<div class="toolbar"><input id="personKeyword" type="search" placeholder="相談者名・かな・IDで検索" value="' + U.escapeHtml(keyword) + '"></div></section>'
      + '<section class="card">' + peopleTable(people, selected) + '</section>'
      + '<section class="card"><h2>' + U.escapeHtml(selectedPerson ? (selectedPerson.person_name || selectedPerson.person_id || "未設定") : "相談者") + 'さんの案件</h2>'
      + personCases(selectedPerson ? selectedPerson.cases : []) + '</section>';

    U.qs("#personKeyword", app).addEventListener("input", function (e) {
      state.personKeyword = e.target.value;
      state.selectedPersonKey = "";
      window.APP.render();
    });
    U.qsa("[data-person-key]", app).forEach(function (row) {
      row.addEventListener("click", function () {
        state.selectedPersonKey = row.getAttribute("data-person-key");
        window.APP.render();
      });
    });
    U.qsa("[data-case-id]", app).forEach(function (row) {
      row.addEventListener("click", function () {
        window.APP.showCaseDetail(row.getAttribute("data-case-id"));
      });
    });
  };

  function peopleTable(people, selected) {
    if (!people.length) return '<p class="empty-message">該当するデータがありません</p>';
    return '<div class="table-wrap"><table class="data-table"><thead><tr><th>相談者ID</th><th>氏名</th><th>件数</th><th>未完了</th><th>期限超過</th><th>最終対応日</th><th>主なタグ</th><th>最新案件タイトル</th></tr></thead><tbody>'
      + people.map(function (p) {
        return '<tr class="clickable-row' + (p.key === selected ? ' active-row' : '') + '" data-person-key="' + U.escapeHtml(p.key) + '">'
          + '<td>' + F.formatEmpty(p.person_id) + '</td><td>' + F.formatEmpty(p.person_name) + '</td><td>' + p.cases.length + '件</td><td>' + p.openCount + '件</td><td>' + p.overdueCount + '件</td><td>' + F.formatDateShort(p.lastAction) + '</td><td>' + F.formatTags(p.tags) + '</td><td>' + U.escapeHtml(p.latestTitle) + '</td></tr>';
      }).join("") + '</tbody></table></div>';
  }

  function personCases(cases) {
    if (!cases.length) return '<p class="empty-message">該当するデータがありません</p>';
    return cases.slice().sort(function (a, b) { return U.compareDateString(b.received_date, a.received_date); }).map(function (item) {
      return '<div class="case-strip clickable-item" data-case-id="' + U.escapeHtml(item._row_id) + '">'
        + '<strong>' + F.formatDate(item.received_date) + ' ' + U.escapeHtml(F.buildDisplayTitle(item)) + '</strong>'
        + '<span>' + F.statusBadge(item.status) + ' ' + F.priorityBadge(item.priority) + '</span>'
        + '</div>';
    }).join("");
  }
})();
