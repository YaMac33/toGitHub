window.APP_DATA = window.APP_DATA || {};

window.MEETINGS_VIEW = (function () {
  "use strict";

  let currentRows = [];
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
    return safeText.replace(regex, '<span class="hit-mark">$1</span>');
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

  function getMeetingById(meetingId) {
    return getArray("meetings").find(function (row) {
      return row.meeting_id === meetingId;
    }) || null;
  }

  function getCommitteeById(committeeId) {
    return getArray("committees").find(function (row) {
      return row.committee_id === committeeId;
    }) || null;
  }

  function getSpecialCommitteeById(specialCommitteeId) {
    return getArray("special_committees").find(function (row) {
      return row.special_committee_id === specialCommitteeId;
    }) || null;
  }

  function getMemberById(memberId) {
    return getArray("members").find(function (row) {
      return row.member_id === memberId;
    }) || null;
  }

  function getEventsByMeetingId(meetingId) {
    return getArray("events")
      .filter(function (row) {
        return row.meeting_id === meetingId;
      })
      .sort(function (a, b) {
        const ad = a.event_date || "";
        const bd = b.event_date || "";
        if (ad !== bd) return ad < bd ? -1 : 1;
        const ac = a.committee_id || "";
        const bc = b.committee_id || "";
        return ac < bc ? -1 : ac > bc ? 1 : 0;
      });
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

  function getSpecialCommitteeMeetingsByInstanceId(instanceId) {
    return getArray("special_committee_meetings")
      .filter(function (row) {
        return row.special_committee_instance_id === instanceId;
      })
      .sort(function (a, b) {
        const ad = a.meeting_date || "";
        const bd = b.meeting_date || "";
        return ad < bd ? -1 : ad > bd ? 1 : 0;
      });
  }

  function getSpecialCommitteeMembersByInstanceId(instanceId) {
    return getArray("special_committee_members")
      .filter(function (row) {
        return row.special_committee_instance_id === instanceId;
      })
      .sort(function (a, b) {
        const am = a.member_id || "";
        const bm = b.member_id || "";
        return am < bm ? -1 : am > bm ? 1 : 0;
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

  function buildMeetingSearchText(meetingId) {
    const meeting = getMeetingById(meetingId);
    const normalEvents = getEventsByMeetingId(meetingId);
    const instances = getSpecialCommitteeInstancesByMeetingId(meetingId);
    const chunks = [];

    if (meeting) {
      chunks.push(meeting.session_name || "");
      chunks.push(sessionTypeLabel(meeting.session_type || ""));
      chunks.push(meeting.note || "");
      chunks.push(meeting.schedule_file_path || "");
    }

    normalEvents.forEach(function (row) {
      const committee = getCommitteeById(row.committee_id);
      chunks.push(row.event_date || "");
      chunks.push(row.note || "");
      chunks.push(committee ? committee.committee_name : "");
      chunks.push(row.event_type_id || "");
      chunks.push(String(row.duration || ""));
    });

    instances.forEach(function (instance) {
      const specialCommittee = getSpecialCommitteeById(instance.special_committee_id);
      chunks.push(specialCommittee ? specialCommittee.special_committee_name : "");
      chunks.push(instance.established_date || "");
      chunks.push(instance.end_date || "");
      chunks.push(instance.note || "");
      chunks.push(instance.roster_file_path || "");

      getSpecialCommitteeMeetingsByInstanceId(instance.special_committee_instance_id).forEach(function (meetingRow) {
        chunks.push(meetingRow.meeting_date || "");
        chunks.push(meetingRow.note || "");
      });

      getSpecialCommitteeMembersByInstanceId(instance.special_committee_instance_id).forEach(function (memberRow) {
        const member = getMemberById(memberRow.member_id);
        chunks.push(member ? member.member_name : "");
        chunks.push(member ? member.member_name_short || "" : "");
        chunks.push(memberRow.role_name || "");
      });
    });

    return chunks.join(" ").toLowerCase();
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
          fiscal_year: meeting.fiscal_year || "",
          term_no: meeting.term_no || "",
          session_type: meeting.session_type || "",
          session_name: meeting.session_name || "",
          start_date: meeting.start_date || "",
          end_date: meeting.end_date || "",
          special_committee_count: instances.length
        };
      });
  }

  function filterMeetingList(rows, conditions) {
    const meetingText = (conditions.meeting_text || "").trim().toLowerCase();
    const sessionType = (conditions.session_type || "").trim();
    const specialCommitteeId = (conditions.special_committee_id || "").trim();
    const keyword = (conditions.keyword || "").trim().toLowerCase();

    return rows.filter(function (row) {
      const hitMeetingText =
        !meetingText ||
        String(row.session_name || "").toLowerCase().includes(meetingText);

      const hitSessionType =
        !sessionType ||
        row.session_type === sessionType;

      const hitSpecialCommittee =
        !specialCommitteeId ||
        getSpecialCommitteeInstancesByMeetingId(row.meeting_id).some(function (instance) {
          return instance.special_committee_id === specialCommitteeId;
        });

      const hitKeyword =
        !keyword ||
        buildMeetingSearchText(row.meeting_id).includes(keyword);

      return hitMeetingText && hitSessionType && hitSpecialCommittee && hitKeyword;
    });
  }

  function renderStatus(statusEl) {
    statusEl.textContent = [
      "meetings.html 読み込み成功",
      "meetings: " + getArray("meetings").length + "件",
      "event_types: " + getArray("event_types").length + "件",
      "events: " + getArray("events").length + "件",
      "special_committees: " + getArray("special_committees").length + "件",
      "special_committee_instances: " + getArray("special_committee_instances").length + "件",
      "special_committee_meetings: " + getArray("special_committee_meetings").length + "件",
      "special_committee_members: " + getArray("special_committee_members").length + "件"
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

  function goMeetingDetail(meetingId) {
    window.location.href = "meeting_detail.html?meeting_id=" + encodeURIComponent(meetingId);
  }

  function renderTable(containerEl, rows) {
    if (!rows.length) {
      containerEl.innerHTML = '<div class="empty">該当データがありません。</div>';
      return;
    }

    const bodyHtml = rows.map(function (row) {
      return [
        '<tr class="clickable-row" data-meeting-id="' + escapeHtml(row.meeting_id) + '">',
        "<td>" + highlightText(row.session_name, currentKeyword) + "</td>",
        "<td>" + escapeHtml(sessionTypeLabel(row.session_type)) + "</td>",
        "<td>" + escapeHtml(toWareki(row.start_date)) + "</td>",
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
          goMeetingDetail(meetingId);
        }
      });
    });
  }

  function renderEmptyDetail(detailArea) {
    detailArea.innerHTML = '<div class="empty">会議回をクリックすると詳細ページへ移動します。</div>';
  }

  function init() {
    const statusBox = document.getElementById("statusBox");
    const resultMeta = document.getElementById("resultMeta");
    const resultArea = document.getElementById("resultArea");
    const detailArea = document.getElementById("detailArea");

    const searchMeetingText = document.getElementById("searchMeetingText");
    const searchSessionType = document.getElementById("searchSessionType");
    const searchSpecialCommittee = document.getElementById("searchSpecialCommittee");
    const searchMeetingKeyword = document.getElementById("searchMeetingKeyword");

    function redraw() {
      currentKeyword = (searchMeetingKeyword.value || "").trim();

      const allRows = buildMeetingList();

      currentRows = filterMeetingList(allRows, {
        meeting_text: searchMeetingText.value,
        session_type: searchSessionType.value,
        special_committee_id: searchSpecialCommittee.value,
        keyword: searchMeetingKeyword.value
      });

      resultMeta.textContent = currentRows.length + "件";
      renderTable(resultArea, currentRows);
      bindRowEvents(resultArea);
      renderEmptyDetail(detailArea);
    }

    renderStatus(statusBox);
    renderSpecialCommitteeOptions(searchSpecialCommittee);
    redraw();

    searchMeetingText.addEventListener("input", redraw);
    searchSessionType.addEventListener("change", redraw);
    searchSpecialCommittee.addEventListener("change", redraw);
    searchMeetingKeyword.addEventListener("input", redraw);
  }

  return {
    init: init
  };
})();

document.addEventListener("DOMContentLoaded", function () {
  window.MEETINGS_VIEW.init();
});
