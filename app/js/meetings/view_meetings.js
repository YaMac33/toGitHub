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
          session_type_label: String(row.session_type_label || "").trim(),
          era_code: String(row.era_code || "").trim(),
          wareki_year: Number(row.wareki_year || 0),
          session_no: Number(row.session || 0),
          start_date: String(row.held_date || "").trim(),
          end_date: String(row.held_date || "").trim(),
          meeting_count: 0,
          special_committee_names: [],
          rows: [],
          detail_url: "./meeting_detail.html?meeting_id=" + encodeURIComponent(meetingId)
        };
      }

      const group = map[meetingId];
      const heldDate = String(row.held_date || "").trim();
      const meetingName = String(row.meeting_name || "").trim();
      const meetingTypeCode = String(row.meeting_type_code || "").trim();

      group.rows.push(row);
      group.meeting_count += 1;

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
      group.rows.sort(compareMeetingRows);
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

  function compareMeetingRows(a, b) {
    const ad = String(a.held_date || "");
    const bd = String(b.held_date || "");
    if (ad !== bd) return ad < bd ? -1 : 1;

    const as = Number(a.day_sequence || a["同日回"] || 0);
    const bs = Number(b.day_sequence || b["同日回"] || 0);
    if (as !== bs) return as - bs;

    const ar = String(a.row_id || "");
    const br = String(b.row_id || "");
    if (ar !== br) return ar < br ? -1 : 1;

    return 0;
  }

  function compareMeetingGroups(a, b) {
    const ad = String(a.start_date || "");
    const bd = String(b.start_date || "");
    if (ad !== bd) return ad > bd ? -1 : 1;

    const aw = Number(a.wareki_year || 0);
    const bw = Number(b.wareki_year || 0);
    if (aw !== bw) return bw - aw;

    const as = Number(a.session_no || 0);
    const bs = Number(b.session_no || 0);
    if (as !== bs) return bs - as;

    const at = String(a.session_type_code || "");
    const bt = String(b.session_type_code || "");
    if (at !== bt) return at < bt ? -1 : 1;

    return 0;
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

    const rowsHtml = group.rows.map(function (row) {
      const dateText = formatDateJa(row.held_date || "");
      const meetingName = String(row.meeting_name || "").trim();
      const duration = formatDurationMinutes(row.duration_minutes);

      return (
        '<div class="history-row">' +
          escapeHtml(dateText) +
          " ／ " +
          escapeHtml(meetingName) +
          (duration ? " ／ " + escapeHtml(duration) : "") +
        "</div>"
      );
    }).join("");

    return (
      '<article class="detail-subcard" style="margin-bottom:12px;">' +
        '<div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start; margin-bottom:10px;">' +
          '<div>' +
            '<h3 style="margin:0 0 6px; font-size:18px;">' + escapeHtml(group.session_name) + "</h3>" +
          "</div>" +
          '<div>' +
            '<a class="button" href="' + escapeHtml(group.detail_url) + '">詳細へ</a>' +
          "</div>' +
        '</div>' +

        '<div class="history-row"><span class="summary-label">期間</span>' +
          escapeHtml(buildPeriodText(group.start_date, group.end_date)) +
        "</div>" +

        '<div class="history-row"><span class="summary-label">特別委員会</span>' +
          escapeHtml(specialCommittees) +
        "</div>" +

        '<div class="history-row"><span class="summary-label">会議数</span>' +
          escapeHtml(String(group.meeting_count)) + "件" +
        "</div>" +

        '<div style="margin-top:10px;">' + rowsHtml + "</div>" +
      "</article>"
    );
  }

  function buildPeriodText(startDate, endDate) {
    if (!startDate && !endDate) return "";
    if (startDate && endDate && startDate === endDate) {
      return formatDateJa(startDate);
    }
    return formatDateJa(startDate) + " ～ " + formatDateJa(endDate);
  }

  function formatDateJa(dateStr) {
    const value = String(dateStr || "").trim();
    if (!value) return "";

    const parts = value.split("-");
    if (parts.length !== 3) return value;

    return Number(parts[0]) + "年" + Number(parts[1]) + "月" + Number(parts[2]) + "日";
  }

  function formatDurationMinutes(value) {
    if (value === null || value === undefined || value === "") return "";

    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) return "";

    return num + "分";
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