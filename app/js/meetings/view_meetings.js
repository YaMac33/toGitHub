window.MEETINGS_VIEW = (function () {
  "use strict";

  const SPECIAL_CODES = ["IKY", "TKY", "IKK", "TKK"];

  function init() {
    const rows = getMeetings();
    const groups = buildMeetingGroups(rows);

    fillSpecialCommitteeOptions(groups);
    bindEvents();
    render();

    if (!rows.length) {
      setStatus("meetings.js にデータがありません。");
      return;
    }

    setStatus([
      "meetings.html 読み込み成功",
      "会議回: " + groups.length + "件",
      "元データ行: " + rows.length + "件"
    ].join("\n"));
  }

  function getMeetings() {
    return Array.isArray(window.APP_DATA && window.APP_DATA.meetings)
      ? window.APP_DATA.meetings.slice()
      : [];
  }

  function bindEvents() {
    const sessionTypeEl = document.getElementById("searchSessionType");
    const specialCommitteeEl = document.getElementById("searchSpecialCommittee");

    if (sessionTypeEl) {
      sessionTypeEl.addEventListener("change", render);
    }
    if (specialCommitteeEl) {
      specialCommitteeEl.addEventListener("change", render);
    }
  }

  function buildMeetingGroups(rows) {
    const map = {};

    rows.forEach(function (row) {
      const meetingId = String(row.meeting_id || "").trim();
      if (!meetingId) return;

      if (!map[meetingId]) {
        map[meetingId] = {
          meeting_id: meetingId,
          session_name: buildSessionName(row),
          session_type_code: String(row.session_type_code || "").trim(),
          start_date: String(row.held_date || "").trim(),
          end_date: String(row.held_date || "").trim(),
          special_committee_names: [],
          detail_url: "./meeting_detail.html?meeting_id=" + encodeURIComponent(meetingId)
        };
      }

      const group = map[meetingId];
      const heldDate = String(row.held_date || "").trim();
      const meetingName = String(row.meeting_name || "").trim();
      const meetingTypeCode = String(row.meeting_type_code || "").trim();

      if (heldDate) {
        if (!group.start_date || heldDate < group.start_date) {
          group.start_date = heldDate;
        }
        if (!group.end_date || heldDate > group.end_date) {
          group.end_date = heldDate;
        }
      }

      if (
        meetingName &&
        SPECIAL_CODES.indexOf(meetingTypeCode) >= 0 &&
        group.special_committee_names.indexOf(meetingName) === -1
      ) {
        group.special_committee_names.push(meetingName);
      }
    });

    const groups = Object.keys(map).map(function (key) {
      const group = map[key];
      group.special_committee_names.sort();
      return group;
    });

    groups.sort(compareMeetingGroups);
    return groups;
  }

  function buildSessionName(row) {
    const eraCode = String(row.era_code || "").trim();
    const warekiYear = Number(row.wareki_year || 0);
    const sessionNo = Number(row.session || 0);
    const sessionTypeLabel = String(row.session_type_label || "").trim();

    return (
      eraCodeToLabel(eraCode) +
      String(warekiYear || "") +
      "年第" +
      String(sessionNo || "") +
      "回" +
      sessionTypeLabel
    );
  }

  function eraCodeToLabel(eraCode) {
    const value = String(eraCode || "").trim().toUpperCase();
    if (value === "R") return "令和";
    if (value === "H") return "平成";
    if (value === "S") return "昭和";
    return value;
  }

  function compareMeetingGroups(a, b) {
    const ad = String(a.start_date || "");
    const bd = String(b.start_date || "");
    if (ad !== bd) return ad > bd ? -1 : 1;

    const aid = String(a.meeting_id || "");
    const bid = String(b.meeting_id || "");
    return aid < bid ? -1 : aid > bid ? 1 : 0;
  }

  function fillSpecialCommitteeOptions(groups) {
    const el = document.getElementById("searchSpecialCommittee");
    if (!el) return;

    const names = [];
    const seen = {};

    groups.forEach(function (group) {
      group.special_committee_names.forEach(function (name) {
        if (!seen[name]) {
          seen[name] = true;
          names.push(name);
        }
      });
    });

    names.sort();

    el.innerHTML =
      '<option value="">すべて</option>' +
      names.map(function (name) {
        return '<option value="' + escapeHtml(name) + '">' + escapeHtml(name) + "</option>";
      }).join("");
  }

  function applyFilters(groups) {
    const sessionType = getValue("searchSessionType");
    const specialCommittee = getValue("searchSpecialCommittee");

    return groups.filter(function (group) {
      if (sessionType && String(group.session_type_code || "") !== sessionType) {
        return false;
      }

      if (specialCommittee && group.special_committee_names.indexOf(specialCommittee) === -1) {
        return false;
      }

      return true;
    });
  }

  function render() {
    const rows = getMeetings();
    const groups = buildMeetingGroups(rows);
    const filtered = applyFilters(groups);

    const resultMeta = document.getElementById("resultMeta");
    const resultArea = document.getElementById("resultArea");

    if (resultMeta) {
      resultMeta.textContent = filtered.length + "件";
    }

    if (!resultArea) return;

    if (!filtered.length) {
      resultArea.innerHTML = '<div class="empty">該当する会議回はありません。</div>';
      return;
    }

    resultArea.innerHTML = filtered.map(renderGroupCard).join("");
  }

  function renderGroupCard(group) {
    const specialCommittees = group.special_committee_names.length
      ? group.special_committee_names.join("、")
      : "なし";

    return (
      '<a href="' + escapeHtml(group.detail_url) + '" ' +
        'class="detail-subcard" ' +
        'style="display:block; margin-bottom:12px; text-decoration:none; color:inherit;">' +

        '<div style="font-size:18px; font-weight:bold; margin-bottom:10px;">' +
          escapeHtml(group.session_name) +
        "</div>" +

        '<div class="history-row">' +
          '<span class="summary-label">期間</span>' +
          escapeHtml(buildPeriodText(group.start_date, group.end_date)) +
        "</div>" +

        '<div class="history-row">' +
          '<span class="summary-label">特別委員会</span>' +
          escapeHtml(specialCommittees) +
        "</div>" +

      "</a>"
    );
  }

  function buildPeriodText(startDate, endDate) {
    if (!startDate && !endDate) return "";
    if (startDate && endDate && startDate === endDate) {
      return formatDateSlash(startDate);
    }
    return formatDateSlash(startDate) + " ～ " + formatDateSlash(endDate);
  }

  function formatDateSlash(dateStr) {
    const value = String(dateStr || "").trim();
    if (!value) return "";

    const parts = value.split("-");
    if (parts.length !== 3) return value;

    return (
      parts[0] + "/" +
      String(Number(parts[1])).padStart(2, "0") + "/" +
      String(Number(parts[2])).padStart(2, "0")
    );
  }

  function getValue(id) {
    const el = document.getElementById(id);
    return el ? String(el.value || "") : "";
  }

  function setStatus(text) {
    const el = document.getElementById("statusBox");
    if (el) {
      el.textContent = text;
    }
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  document.addEventListener("DOMContentLoaded", init);

  return {
    init: init,
    render: render
  };
})();