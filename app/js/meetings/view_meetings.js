window.APP_DATA = window.APP_DATA || {};

window.MEETINGS_VIEW = (function () {
  "use strict";

  let currentRows = [];

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

  function toWareki(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr + "T00:00:00");
    if (Number.isNaN(d.getTime())) return dateStr;

    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const day = d.getDate();

    const reiwaStart = new Date("2019-05-01T00:00:00");
    const heiseiStart = new Date("1989-01-08T00:00:00");
    const showaStart = new Date("1926-12-25T00:00:00");

    let eraName = "";
    let eraYear = 0;

    if (d >= reiwaStart) {
      eraName = "令和";
      eraYear = y - 2018;
    } else if (d >= heiseiStart) {
      eraName = "平成";
      eraYear = y - 1988;
    } else if (d >= showaStart) {
      eraName = "昭和";
      eraYear = y - 1925;
    } else {
      return y + "年" + m + "月" + day + "日";
    }

    const eraYearLabel = eraYear === 1 ? "元" : String(eraYear);
    return eraName + eraYearLabel + "年" + m + "月" + day + "日";
  }

  function sessionTypeLabel(value) {
    if (value === "REGULAR") return "定例会";
    if (value === "EXTRA") return "臨時会";
    return value || "";
  }

  function getSpecialCommitteeInstancesByMeetingId(meetingId) {
    return getArray("special_committee_instances")
      .filter(function (row) {
        return row.meeting_id === meetingId;
      })
      .sort(function (a, b) {
        const ad = a.established_date || "";
        const bd = b.established_date || "";
        return ad < bd ? -1 : ad > bd ? 1 : 0;
      });
  }

  function getSpecialCommitteeOptions() {
    return getArray("special_committees")
      .filter(function (row) {
        return String(row.active_flag || "0") === "1";
      })
      .slice()
      .sort(function (a, b) {
        return Number(a.sort_order || 9999) - Number(b.sort_order || 9999);
      })
      .map(function (row) {
        return {
          special_committee_id: row.special_committee_id || "",
          special_committee_name: row.special_committee_name || ""
        };
      });
  }

  function buildMeetingList() {
    return getArray("meetings")
      .slice()
      .sort(function (a, b) {
        return Number(a.sort_order || 9999) - Number(b.sort_order || 9999);
      })
      .map(function (meeting) {
        const instances = getSpecialCommitteeInstancesByMeetingId(meeting.meeting_id);
        return {
          meeting_id: meeting.meeting_id || "",
          session_type: meeting.session_type || "",
          session_name: meeting.session_name || "",
          start_date: meeting.start_date || "",
          end_date: meeting.end_date || "",
          special_committee_count: instances.length
        };
      });
  }

  function filterMeetingList(rows, conditions) {
    const sessionType = (conditions.session_type || "").trim();
    const specialCommitteeId = (conditions.special_committee_id || "").trim();

    return rows.filter(function (row) {
      const hitSessionType =
        !sessionType ||
        row.session_type === sessionType;

      const hitSpecialCommittee =
        !specialCommitteeId ||
        getSpecialCommitteeInstancesByMeetingId(row.meeting_id).some(function (instance) {
          return instance.special_committee_id === specialCommitteeId;
        });

      return hitSessionType && hitSpecialCommittee;
    });
  }

  function renderStatus(statusEl) {
    statusEl.textContent = [
      "meetings.html 読み込み成功",
      "meetings: " + getArray("meetings").length + "件",
      "special_committees: " + getArray("special_committees").length + "件",
      "special_committee_instances: " + getArray("special_committee_instances").length + "件"
    ].join("\n");
  }

  function renderSpecialCommitteeOptions(selectEl) {
    const options = getSpecialCommitteeOptions();
    const html = ['<option value="">すべて</option>']
      .concat(options.map(function (row) {
        return '<option value="' + escapeHtml(row.special_committee_id) + '">' +
          escapeHtml(row.special_committee_name) +
          "</option>";
      }))
      .join("");

    selectEl.innerHTML = html;
  }

  function goMeetingDetailInNewTab(meetingId) {
    const url = "meeting_detail.html?meeting_id=" + encodeURIComponent(meetingId);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function renderTable(containerEl, rows) {
    if (!rows.length) {
      containerEl.innerHTML = '<div class="empty">該当データがありません。</div>';
      return;
    }

    const bodyHtml = rows.map(function (row) {
      return [
        '<tr class="clickable-row" data-meeting-id="' + escapeHtml(row.meeting_id) + '">',
        "<td>" + escapeHtml(row.session_name) + "</td>",
        "<td>" + escapeHtml(sessionTypeLabel(row.session_type)) + "</td>",
        "<td>" + escapeHtml(toWareki(row.start_date)) + "</td>",
        "<td>" + escapeHtml(toWareki(row.end_date)) + "</td>",
        "<td>" + escapeHtml(String(row.special_committee_count)) + "</td>",
        "</tr>"
      ].join("");
    }).join("");

    containerEl.innerHTML =
      '<div class="result-table-wrap">' +
        "<table>" +
          "<thead>" +
            "<tr>" +
              "<th>会議回</th>" +
              "<th>種別</th>" +
              "<th>開始日</th>" +
              "<th>終了日</th>" +
              "<th>特別委員会数</th>" +
            "</tr>" +
          "</thead>" +
          "<tbody>" + bodyHtml + "</tbody>" +
        "</table>" +
      "</div>";
  }

  function bindRowEvents(resultArea) {
    resultArea.querySelectorAll(".clickable-row").forEach(function (rowEl) {
      rowEl.addEventListener("click", function () {
        const meetingId = rowEl.dataset.meetingId || "";
        if (meetingId) {
          goMeetingDetailInNewTab(meetingId);
        }
      });
    });
  }

  function init() {
    const statusBox = document.getElementById("statusBox");
    const resultMeta = document.getElementById("resultMeta");
    const resultArea = document.getElementById("resultArea");

    const searchSessionType = document.getElementById("searchSessionType");
    const searchSpecialCommittee = document.getElementById("searchSpecialCommittee");

    function redraw() {
      const allRows = buildMeetingList();

      currentRows = filterMeetingList(allRows, {
        session_type: searchSessionType.value,
        special_committee_id: searchSpecialCommittee.value
      });

      resultMeta.textContent = currentRows.length + "件";
      renderTable(resultArea, currentRows);
      bindRowEvents(resultArea);
    }

    renderStatus(statusBox);
    renderSpecialCommitteeOptions(searchSpecialCommittee);
    redraw();

    searchSessionType.addEventListener("change", redraw);
    searchSpecialCommittee.addEventListener("change", redraw);
  }

  return {
    init: init
  };
})();

document.addEventListener("DOMContentLoaded", function () {
  window.MEETINGS_VIEW.init();
});
