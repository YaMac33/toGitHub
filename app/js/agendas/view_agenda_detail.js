window.AGENDA_DETAIL_VIEW = (function () {
  "use strict";

  const qs = window.APP_UTILS.qs;
  const escapeHtml = window.APP_UTILS.escapeHtml;
  const toWareki = window.APP_FORMATTERS.toWareki;

  function getArray(name) {
    return Array.isArray(window.APP_DATA[name]) ? window.APP_DATA[name] : [];
  }

  function agendaCategoryLabel(value) {
    const map = {
      STEERING: "議運",
      LEADERS: "会派代表者会議",
      OTHER: "その他"
    };
    return map[value] || value || "";
  }

  function agendaSubcategoryLabel(value) {
    const map = {
      SCHEDULE: "日程調整",
      BILL_HANDLING: "議案取扱",
      QUESTION_HANDLING: "一般質問取扱",
      COORDINATION: "調整",
      REPORT: "報告",
      OTHER: "その他"
    };
    return map[value] || value || "";
  }

  function agendaActionTypeLabel(value) {
    const map = {
      PROPOSED: "議題提示",
      DISCUSSED: "協議",
      DECIDED: "決定",
      REPORTED: "報告",
      CONTINUED: "継続"
    };
    return map[value] || value || "";
  }

  function eventTypeLabelFromEvent(event) {
    if (!event) return "";

    if (event.event_type_id === "STEERING_COMMITTEE") return "議運";
    if (event.event_type_id === "LEADERS_MEETING") return "会派代表者会議";
    if (event.event_type_id === "PLENARY") return "本会議";
    return "その他";
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

  function getAgendaById(agendaId) {
    return getArray("agendas").find(function (row) {
      return row.agenda_id === agendaId;
    }) || null;
  }

  function buildDetail(agendaId) {
    const agenda = getAgendaById(agendaId);
    if (!agenda) return null;

    const actions = getArray("agenda_actions")
      .filter(function (row) {
        return row.agenda_id === agendaId;
      })
      .map(function (row) {
        const meeting = getMeetingById(row.meeting_id);
        const event = getEventById(row.event_id);

        return {
          agenda_action_id: row.agenda_action_id || "",
          meeting_id: row.meeting_id || "",
          meeting_name: meeting ? (meeting.session_name || "") : (row.meeting_id || ""),
          event_id: row.event_id || "",
          event_type_label: eventTypeLabelFromEvent(event),
          event_sort: Number(event && event.sort_order ? event.sort_order : 999999),
          action_type: row.action_type || "",
          action_date: row.action_date || "",
          note: row.note || ""
        };
      })
      .sort(function (a, b) {
        const ad = a.action_date || "";
        const bd = b.action_date || "";
        if (ad !== bd) return ad < bd ? -1 : 1;
        if (a.event_sort !== b.event_sort) return a.event_sort - b.event_sort;
        return (a.agenda_action_id || "") < (b.agenda_action_id || "") ? -1 : 1;
      });

    return {
      agenda_id: agenda.agenda_id || "",
      agenda_category: agenda.agenda_category || "",
      agenda_subcategory: agenda.agenda_subcategory || "",
      agenda_title: agenda.agenda_title || "",
      agenda_summary: agenda.agenda_summary || "",
      note: agenda.note || "",
      sort_order: agenda.sort_order || "",
      actions: actions
    };
  }

  function renderStatus(detail) {
    document.getElementById("statusBox").textContent = [
      "agenda_detail.html 読み込み成功",
      "agenda_id: " + detail.agenda_id,
      "actions: " + detail.actions.length + "件"
    ].join("\n");
  }

  function renderBasic(detail) {
    document.getElementById("basicArea").innerHTML =
      '<div class="summary-item"><span class="summary-label">大分類</span>' + escapeHtml(agendaCategoryLabel(detail.agenda_category)) + "</div>" +
      '<div class="summary-item"><span class="summary-label">中分類</span>' + escapeHtml(agendaSubcategoryLabel(detail.agenda_subcategory)) + "</div>" +
      '<div class="summary-item"><span class="summary-label">内部ID</span>' + escapeHtml(detail.agenda_id) + "</div>" +
      '<div class="summary-item"><span class="summary-label">表示順</span>' + escapeHtml(String(detail.sort_order || "")) + "</div>" +
      '<div class="summary-item summary-item-wide"><span class="summary-label">議題</span>' + escapeHtml(detail.agenda_title) + "</div>" +
      '<div class="summary-item summary-item-wide"><span class="summary-label">概要</span>' + escapeHtml(detail.agenda_summary || "") + "</div>" +
      '<div class="summary-item summary-item-wide"><span class="summary-label">備考</span>' + escapeHtml(detail.note || "") + "</div>";
  }

  function renderHistory(detail) {
    const area = document.getElementById("historyArea");

    if (!detail.actions.length) {
      area.innerHTML = '<div class="empty">履歴がありません。</div>';
      return;
    }

    area.innerHTML = detail.actions.map(function (row) {
      return (
        '<div class="history-row">' +
          '<div><span class="summary-label">日時</span>' + escapeHtml(toWareki(row.action_date || "")) + "</div>" +
          '<div><span class="summary-label">会議回</span>' + escapeHtml(row.meeting_name) + "</div>" +
          '<div><span class="summary-label">会議種別</span>' + escapeHtml(row.event_type_label) + "</div>" +
          '<div><span class="summary-label">扱い</span>' + escapeHtml(agendaActionTypeLabel(row.action_type)) + "</div>" +
          '<div><span class="summary-label">備考</span>' + escapeHtml(row.note || "") + "</div>" +
        "</div>"
      );
    }).join("");
  }

  function init() {
    const agendaId = qs("agenda_id");
    const detail = buildDetail(agendaId);

    if (!agendaId) {
      document.getElementById("statusBox").textContent = "agenda_id が指定されていません。";
      document.getElementById("basicArea").innerHTML = '<div class="empty">agenda_id がありません。</div>';
      document.getElementById("historyArea").innerHTML = '<div class="empty">表示対象がありません。</div>';
      return;
    }

    if (!detail) {
      document.getElementById("statusBox").textContent = "該当する議題が見つかりません。";
      document.getElementById("basicArea").innerHTML = '<div class="empty">該当する議題がありません。</div>';
      document.getElementById("historyArea").innerHTML = '<div class="empty">表示対象がありません。</div>';
      return;
    }

    document.getElementById("pageTitle").textContent = detail.agenda_title;
    document.getElementById("pageDesc").textContent = "議題ベースで履歴を表示しています。";

    renderStatus(detail);
    renderBasic(detail);
    renderHistory(detail);
  }

  return {
    init: init
  };
})();

document.addEventListener("DOMContentLoaded", function () {
  window.AGENDA_DETAIL_VIEW.init();
});
