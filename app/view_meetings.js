window.APP_DATA = window.APP_DATA || {};

window.MEETINGS_VIEW = (function () {
  "use strict";

  let currentRows = [];
  let selectedMeetingId = "";
  let currentKeyword = "";

  function getArray(name) {
    return Array.isArray(window.APP_DATA[name]) ? window.APP_DATA[name] : [];
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function highlightText(text, keyword) {
    const safeText = escapeHtml(text);
    if (!keyword) return safeText;
    const regex = new RegExp("(" + escapeRegExp(keyword) + ")", "gi");
    return safeText.replace(regex, '<span style="background:yellow;">$1</span>');
  }

  function toWareki(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr + "T00:00:00");
    if (Number.isNaN(d.getTime())) return dateStr;

    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const day = d.getDate();

    const reiwaStart = new Date("2019-05-01T00:00:00");
    const heiseiStart = new Date("1989-01-08T00:00:00");

    let eraName = "";
    let eraYear = 0;

    if (d >= reiwaStart) {
      eraName = "令和";
      eraYear = y - 2018;
    } else if (d >= heiseiStart) {
      eraName = "平成";
      eraYear = y - 1988;
    } else {
      return y + "年" + m + "月" + day + "日";
    }

    return eraName + eraYear + "年" + m + "月" + day + "日";
  }

  function sessionTypeLabel(value) {
    if (value === "REGULAR") return "定例会";
    if (value === "EXTRA") return "臨時会";
    return value || "";
  }

  function getMeetingById(meetingId) {
    return getArray("meetings").find(function (row) {
      return row.meeting_id === meetingId;
    }) || null;
  }

  function getSpecialCommitteeInstancesByMeetingId(meetingId) {
    return getArray("special_committee_instances").filter(function (row) {
      return row.meeting_id === meetingId;
    });
  }

  function buildMeetingList() {
    return getArray("meetings").map(function (meeting) {
      const instances = getSpecialCommitteeInstancesByMeetingId(meeting.meeting_id);
      return {
        meeting_id: meeting.meeting_id,
        session_name: meeting.session_name,
        session_type: meeting.session_type,
        start_date: meeting.start_date,
        special_committee_count: instances.length
      };
    });
  }

  function renderTable(containerEl, rows) {
    if (!rows.length) {
      containerEl.innerHTML = "データなし";
      return;
    }

    const html = rows.map(function (row) {
      return (
        "<div>" +
        row.session_name +
        " / " +
        sessionTypeLabel(row.session_type) +
        " / " +
        toWareki(row.start_date) +
        " / 特別委員会:" +
        row.special_committee_count +
        "</div>"
      );
    }).join("");

    containerEl.innerHTML = html;
  }

  function init() {
    const resultArea = document.getElementById("resultArea");

    // ★デバッグ表示ここ
    const debugEl = document.getElementById("debugBox");
    if (debugEl) {
      debugEl.textContent = JSON.stringify(window.APP_DATA, null, 2);
    }

    const rows = buildMeetingList();
    renderTable(resultArea, rows);
  }

  return {
    init: init
  };
})();

document.addEventListener("DOMContentLoaded", function () {
  window.MEETINGS_VIEW.init();
});
