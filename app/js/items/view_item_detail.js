window.ITEM_DETAIL_VIEW = (function () {
  "use strict";

  const qs = window.APP_UTILS.qs;
  const escapeHtml = window.APP_UTILS.escapeHtml;
  const toWareki = window.APP_FORMATTERS.toWareki;
  const classLabel = window.APP_FORMATTERS.itemClassLabel;
  const subclassLabel = window.APP_FORMATTERS.itemSubclassLabel;
  const actionTypeLabel = window.APP_FORMATTERS.actionTypeLabel;
  const resultLabel = window.APP_FORMATTERS.resultLabel;

  function getArray(name) {
    return Array.isArray(window.APP_DATA[name]) ? window.APP_DATA[name] : [];
  }

  function getMeetingById(meetingId) {
    return getArray("meetings").find(function (row) {
      return row.meeting_id === meetingId;
    }) || null;
  }

  function getEventById(eventId) {
    return getArray("events").find(function (row) {
      return row.event_id === eventId;
    }) || null;
  }

  function getTermById(termId) {
    return getArray("council_terms").find(function (row) {
      return row.term_id === termId;
    }) || null;
  }

  function init() {
    const itemId = qs("item_id");
    const item = getArray("items").find(function (row) {
      return row.item_id === itemId;
    });

    if (!item) {
      document.getElementById("statusBox").textContent = "item_id が不正です。";
      document.getElementById("basicArea").innerHTML = '<div class="empty">該当案件がありません。</div>';
      document.getElementById("actionsArea").innerHTML = '<div class="empty">該当案件がありません。</div>';
      return;
    }

    const actions = getArray("item_actions")
      .filter(function (row) {
        return row.item_id === itemId;
      })
      .slice()
      .sort(function (a, b) {
        return (a.action_date || "") < (b.action_date || "") ? -1 : 1;
      });

    document.getElementById("pageTitle").textContent = item.item_no + " " + item.title;
    document.getElementById("pageDesc").textContent = classLabel(item.item_class) + " の詳細を表示しています。";

    document.getElementById("statusBox").textContent = [
      "item_detail.html 読み込み成功",
      "item_id: " + item.item_id,
      "actions: " + actions.length + "件"
    ].join("\n");

    const term = item.term_id ? getTermById(item.term_id) : null;

    document.getElementById("basicArea").innerHTML =
      '<div class="summary-item"><span class="summary-label">大分類</span>' + escapeHtml(classLabel(item.item_class)) + "</div>" +
      '<div class="summary-item"><span class="summary-label">中分類</span>' + escapeHtml(subclassLabel(item.item_subclass)) + "</div>" +
      '<div class="summary-item"><span class="summary-label">番号</span>' + escapeHtml(item.item_no) + "</div>" +
      '<div class="summary-item"><span class="summary-label">番号体系</span>' + escapeHtml(item.numbering_scope || "") + "</div>" +
      '<div class="summary-item"><span class="summary-label">年度</span>' + escapeHtml(item.fiscal_year_wareki || "") + "</div>" +
      '<div class="summary-item"><span class="summary-label">年</span>' + escapeHtml(item.year_wareki || "") + "</div>" +
      '<div class="summary-item"><span class="summary-label">任期</span>' + escapeHtml(term ? term.term_name : "") + "</div>" +
      '<div class="summary-item"><span class="summary-label">所管</span>' + escapeHtml(item.department || "") + "</div>" +
      '<div class="summary-item"><span class="summary-label">予算系</span>' + escapeHtml(String(item.is_budget) === "1" ? "はい" : "いいえ") + "</div>" +
      '<div class="summary-item"><span class="summary-label">内部ID</span>' + escapeHtml(item.item_id) + "</div>" +
      '<div class="summary-item summary-item-wide"><span class="summary-label">概要</span>' + escapeHtml(item.summary || "") + "</div>" +
      '<div class="summary-item summary-item-wide"><span class="summary-label">備考</span>' + escapeHtml(item.note || "") + "</div>";

    if (!actions.length) {
      document.getElementById("actionsArea").innerHTML = '<div class="empty">アクション履歴がありません。</div>';
      return;
    }

    document.getElementById("actionsArea").innerHTML = actions.map(function (row) {
      const meeting = getMeetingById(row.meeting_id);
      const event = getEventById(row.event_id);

      const eventLabel = event
        ? ((event.event_date || "") ? toWareki(event.event_date) + " / " : "") + (event.note || event.event_id)
        : "";

      return (
        '<div class="history-row">' +
          '<span class="pill">' + escapeHtml(toWareki(row.action_date)) + "</span>" +
          '<span class="pill">' + escapeHtml(actionTypeLabel(row.action_type)) + "</span>" +
          '<span class="pill">' + escapeHtml(resultLabel(row.result)) + "</span>" +
          "<div>会議回: " + escapeHtml(meeting ? meeting.session_name : row.meeting_id) + "</div>" +
          "<div>イベント: " + escapeHtml(eventLabel) + "</div>" +
          "<div>備考: " + escapeHtml(row.note || "") + "</div>" +
        "</div>"
      );
    }).join("");
  }

  return {
    init: init
  };
})();

document.addEventListener("DOMContentLoaded", function () {
  window.ITEM_DETAIL_VIEW.init();
});
