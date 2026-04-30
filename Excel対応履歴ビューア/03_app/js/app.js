(function () {
  "use strict";

  var U = window.APP_UTILS;
  var F = window.APP_FORMATTERS;
  var V = window.APP_VIEWS || {};
  var APP = {};
  var stringKeys = [
    "case_id", "received_date", "last_action_date", "status", "priority", "person_id",
    "person_name", "person_kana", "contact_memo", "area", "title", "summary", "department",
    "owner", "sub_owner", "due_date", "completed_date", "visibility", "internal_memo",
    "attachment_memo", "sort_order", "elapsed_days", "search_text", "display_title",
    "display_subtitle", "created_at", "updated_at"
  ];
  var historyStringKeys = [
    "history_id", "case_id", "action_date", "action_time", "action_type", "staff",
    "department", "counterparty", "content", "next_action_date", "next_action_content",
    "attachment_memo", "internal_memo", "created_at", "updated_at"
  ];

  APP.state = null;

  document.addEventListener("DOMContentLoaded", function () {
    if (!window.APP_DATA || !Array.isArray(window.APP_DATA.cases) || !Array.isArray(window.APP_DATA.histories)) {
      showDataError();
      return;
    }
    APP.state = buildState(window.APP_DATA);
    bindNavigation();
    updateExportInfo();
    APP.render();
  });

  function buildState(data) {
    var today = new Date();
    var cases = U.safeArray(data.cases).map(normalizeCase);
    var histories = U.safeArray(data.histories).map(normalizeHistory);
    var caseMap = {};
    var historiesByCaseId = {};

    cases.forEach(function (item, index) {
      item._row_id = item.case_id || "__case_" + index;
      caseMap[item._row_id] = item;
      if (item.case_id) caseMap[item.case_id] = item;
    });
    histories.forEach(function (item) {
      var key = item.case_id || "";
      if (!historiesByCaseId[key]) historiesByCaseId[key] = [];
      historiesByCaseId[key].push(item);
    });

    return {
      meta: data.meta || {},
      cases: cases,
      histories: histories,
      caseMap: caseMap,
      historiesByCaseId: historiesByCaseId,
      filters: defaultFilters(),
      currentView: "dashboard",
      selectedCaseId: "",
      caseListSort: "received_desc",
      personKeyword: "",
      selectedPersonKey: "",
      calendar: {
        year: today.getFullYear(),
        month: today.getMonth() + 1,
        mode: "received"
      },
      lists: buildLists(cases)
    };
  }

  function normalizeCase(raw) {
    var item = {};
    stringKeys.forEach(function (key) {
      item[key] = U.safeString(raw && raw[key]);
    });
    item.tags = Array.isArray(raw && raw.tags) ? raw.tags.map(U.safeString).filter(Boolean) : [];
    item.is_overdue = typeof (raw && raw.is_overdue) === "boolean" ? raw.is_overdue : false;
    item.is_open = typeof (raw && raw.is_open) === "boolean" ? raw.is_open : item.status !== "完了";
    if (!item.display_title) item.display_title = item.title;
    if (!item.display_subtitle) item.display_subtitle = F.buildDisplaySubtitle(item);
    return item;
  }

  function normalizeHistory(raw) {
    var item = {};
    historyStringKeys.forEach(function (key) {
      item[key] = U.safeString(raw && raw[key]);
    });
    return item;
  }

  function buildLists(cases) {
    var tags = [];
    cases.forEach(function (item) {
      tags = tags.concat(U.safeArray(item.tags));
    });
    return {
      statuses: sortedUnique(cases.map(function (c) { return c.status; })),
      owners: sortedUnique(cases.map(function (c) { return c.owner; })),
      departments: sortedUnique(cases.map(function (c) { return c.department; })),
      areas: sortedUnique(cases.map(function (c) { return c.area; })),
      priorities: sortedUnique(cases.map(function (c) { return c.priority; })),
      tags: sortedUnique(tags)
    };
  }

  function sortedUnique(values) {
    return U.unique(values).sort(function (a, b) { return a.localeCompare(b, "ja"); });
  }

  function defaultFilters() {
    return {
      keyword: "",
      status: "",
      owner: "",
      department: "",
      area: "",
      priority: "",
      tag: "",
      openOnly: false,
      overdueOnly: false
    };
  }

  function bindNavigation() {
    U.qsa(".app-nav [data-view]").forEach(function (button) {
      button.addEventListener("click", function () {
        if (button.disabled) return;
        var view = button.getAttribute("data-view");
        if (view === "caseDetail" && !APP.state.selectedCaseId) return;
        APP.state.currentView = view;
        APP.render();
      });
    });
  }

  function updateExportInfo() {
    var el = U.qs("#exportInfo");
    el.innerHTML = "最終出力<br><strong>" + F.formatDateTime(APP.state.meta.exported_at) + "</strong>";
  }

  function updateNav() {
    U.qsa(".app-nav [data-view]").forEach(function (button) {
      var view = button.getAttribute("data-view");
      button.classList.toggle("active", view === APP.state.currentView);
      if (view === "caseDetail") {
        button.disabled = !APP.state.selectedCaseId;
      }
    });
  }

  APP.render = function () {
    updateNav();
    if (APP.state.currentView === "caseList") V.renderCaseList(APP.state);
    else if (APP.state.currentView === "personView") V.renderPersonView(APP.state);
    else if (APP.state.currentView === "calendar") V.renderCalendarView(APP.state);
    else if (APP.state.currentView === "caseDetail") V.renderCaseDetail(APP.state, APP.state.selectedCaseId);
    else V.renderDashboard(APP.state);
    var app = U.qs("#app");
    if (app) app.focus();
  };

  APP.showCaseDetail = function (caseId) {
    APP.state.selectedCaseId = U.safeString(caseId);
    APP.state.currentView = "caseDetail";
    APP.render();
    window.scrollTo(0, 0);
  };

  APP.clearFilters = function () {
    APP.state.filters = defaultFilters();
  };

  function showDataError() {
    U.qs("#app").innerHTML = '<section class="warning-message">データファイルを読み込めませんでした。03_app/data/ に meta.js, cases.js, histories.js が存在するか確認してください。</section>';
  }

  window.APP = APP;
})();
