(function () {
  "use strict";

  var U = window.APP_UTILS;
  var F = window.APP_FORMATTERS;
  window.APP_VIEWS = window.APP_VIEWS || {};

  window.APP_VIEWS.renderCaseDetail = function (state, caseId) {
    var app = U.qs("#app");
    var item = state.caseMap[caseId] || null;
    if (!item) {
      app.innerHTML = '<section class="card"><h2>案件詳細</h2><p class="empty-message">案件が見つかりません</p></section>';
      return;
    }

    var histories = U.safeArray(state.historiesByCaseId[item.case_id]).slice().sort(function (a, b) {
      return (a.action_date + " " + a.action_time).localeCompare(b.action_date + " " + b.action_time);
    });
    var related = findRelatedCases(state.cases, item);

    app.innerHTML = ''
      + '<section class="card detail-hero">'
      + '<h2>' + U.escapeHtml(item.case_id || "IDなし") + ' ' + U.escapeHtml(F.buildDisplayTitle(item)) + '</h2>'
      + '<div>' + F.statusBadge(item.status) + ' ' + F.priorityBadge(item.priority) + ' ' + F.overdueLabel(item) + '</div>'
      + '<div class="muted">担当：' + F.formatEmpty(item.owner) + ' / 部署：' + F.formatEmpty(item.department) + '</div>'
      + F.formatTags(item.tags)
      + '</section>'
      + '<section class="detail-grid">'
      + infoCard("相談者情報", [
        ["相談者ID", item.person_id], ["氏名", item.person_name], ["かな", item.person_kana], ["連絡先メモ", item.contact_memo]
      ])
      + infoCard("案件情報", [
        ["受付日", item.received_date], ["最終対応日", item.last_action_date], ["地区", item.area], ["期限", item.due_date],
        ["完了日", item.completed_date], ["主担当者", item.owner], ["副担当者", item.sub_owner], ["公開区分", item.visibility]
      ])
      + '</section>'
      + textCard("概要", item.summary)
      + textCard("内部メモ", item.internal_memo)
      + textCard("添付資料メモ", item.attachment_memo)
      + '<section class="card"><h2>対応履歴</h2>' + timeline(histories) + '</section>'
      + '<section class="card"><h2>同じ相談者の別案件</h2>' + relatedHtml(related) + '</section>';

    U.qsa("[data-case-id]", app).forEach(function (el) {
      el.addEventListener("click", function () {
        window.APP.showCaseDetail(el.getAttribute("data-case-id"));
      });
    });
  };

  function infoCard(title, rows) {
    return '<section class="card"><h2>' + U.escapeHtml(title) + '</h2><dl class="kv-list">'
      + rows.map(function (row) {
        return '<dt>' + U.escapeHtml(row[0]) + '</dt><dd>' + F.formatEmpty(row[1]) + '</dd>';
      }).join("") + '</dl></section>';
  }

  function textCard(title, value) {
    return '<section class="card"><h2>' + U.escapeHtml(title) + '</h2><p>' + F.formatEmpty(value) + '</p></section>';
  }

  function timeline(histories) {
    if (!histories.length) return '<p class="empty-message">該当するデータがありません</p>';
    return '<div class="timeline">' + histories.map(function (h) {
      return '<article class="timeline-item">'
        + '<div class="timeline-meta"><span>' + F.formatDate(h.action_date) + '</span><span>' + F.formatTime(h.action_time) + '</span><span>' + F.formatEmpty(h.action_type) + '</span><span>' + F.formatEmpty(h.staff) + '</span><span>' + F.formatEmpty(h.department) + '</span></div>'
        + '<p>' + F.formatEmpty(h.content) + '</p>'
        + (h.next_action_date || h.next_action_content ? '<p class="muted">次回：' + F.formatDate(h.next_action_date) + ' ' + F.formatEmpty(h.next_action_content) + '</p>' : '')
        + (h.internal_memo ? '<p class="muted">内部メモ：' + F.formatEmpty(h.internal_memo) + '</p>' : '')
        + '</article>';
    }).join("") + '</div>';
  }

  function findRelatedCases(cases, item) {
    return U.safeArray(cases).filter(function (c) {
      if (c === item) return false;
      if (item.person_id) return c.person_id === item.person_id;
      return item.person_name && c.person_name === item.person_name;
    }).slice(0, 10);
  }

  function relatedHtml(items) {
    if (!items.length) return '<p class="empty-message">該当するデータがありません</p>';
    return items.map(function (item) {
      return '<div class="case-strip clickable-item" data-case-id="' + U.escapeHtml(item._row_id) + '">'
        + '<strong>' + U.escapeHtml(item.case_id || "IDなし") + ' ' + U.escapeHtml(F.buildDisplayTitle(item)) + '</strong>'
        + '<span class="muted">' + F.formatDate(item.received_date) + ' / ' + F.formatEmpty(item.status) + '</span>'
        + '</div>';
    }).join("");
  }
})();
