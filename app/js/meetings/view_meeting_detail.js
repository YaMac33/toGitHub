window.APP_DATA = window.APP_DATA || {};

window.MEETING_DETAIL_VIEW = (function () {
  "use strict";

  const SPECIAL_CODES = ["IKY", "TKY", "IKK", "TKK"];

  let currentDetail = null;

  function getArray(name) {
    return Array.isArray(window.APP_DATA[name]) ? window.APP_DATA[name] : [];
  }

  function qs(name) {
    return new URLSearchParams(window.location.search).get(name) || "";
  }

  function escapeHtml(value) {
    return window.APP_UTILS && typeof window.APP_UTILS.escapeHtml === "function"
      ? window.APP_UTILS.escapeHtml(value)
      : String(value == null ? "" : value)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#39;");
  }

  function normalizeDate(dateValue) {
    const value = String(dateValue || "").trim();
    if (!value) return "";

    const normalized = value.replace(/\./g, "/").replace(/-/g, "/");
    const parts = normalized.split("/");

    if (parts.length !== 3) return "";

    const y = String(parts[0]).trim();
    const m = String(parts[1]).trim();
    const d = String(parts[2]).trim();

    if (!/^\d+$/.test(y) || !/^\d+$/.test(m) || !/^\d+$/.test(d)) return "";

    return y.padStart(4, "0") + "-" + m.padStart(2, "0") + "-" + d.padStart(2, "0");
  }

  function toDateObject(dateStr) {
    const normalized = normalizeDate(dateStr);
    if (!normalized) return null;

    const parts = normalized.split("-");
    if (parts.length !== 3) return null;

    const y = Number(parts[0]);
    const m = Number(parts[1]);
    const d = Number(parts[2]);

    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;

    const dt = new Date(y, m - 1, d);
    if (Number.isNaN(dt.getTime())) return null;

    return dt;
  }

  function formatDateJa(dateStr) {
    const normalized = normalizeDate(dateStr);
    if (!normalized) return "";

    const parts = normalized.split("-");
    if (parts.length !== 3) return "";

    return Number(parts[0]) + "年" + Number(parts[1]) + "月" + Number(parts[2]) + "日";
  }

  function isInsidePeriodType(value) {
    return String(value || "").trim() === "内";
  }

  function isOutsidePeriodType(value) {
    return String(value || "").trim() === "外";
  }

  function isDisplayTargetPeriodType(value) {
    const v = String(value || "").trim();
    return v === "内" || v === "外";
  }

  function getMeetingRowsByMeetingId(meetingId) {
    return getArray("meetings")
      .filter(function (row) {
        return String(row.meeting_id || "") === String(meetingId || "");
      })
      .sort(compareMeetingRows);
  }

  function getQuestionRowsSource() {
    if (window.APP_DATA && Array.isArray(window.APP_DATA.questions)) {
      return window.APP_DATA.questions;
    }
    if (Array.isArray(window.RECORDS)) {
      return window.RECORDS;
    }
    return [];
  }

  function getQuestionsByMeetingId(meetingId) {
    return getQuestionRowsSource()
      .filter(function (row) {
        return String(row.meeting_id || "") === String(meetingId || "");
      })
      .sort(function (a, b) {
        const ad = normalizeDate(a.question_date);
        const bd = normalizeDate(b.question_date);
        if (ad !== bd) return ad < bd ? -1 : 1;

        const an = Number(a.notice_no || 0);
        const bn = Number(b.notice_no || 0);
        if (an !== bn) return an - bn;

        const as = Number(a.sort_order || 0);
        const bs = Number(b.sort_order || 0);
        return as - bs;
      });
  }

  function getSpecialCommitteeMembersByMeetingId(meetingId) {
    return getArray("special_committee_members")
      .filter(function (row) {
        return String(row.meeting_id || "") === String(meetingId || "");
      })
      .sort(compareSpecialCommitteeMemberRows);
  }

  function compareSpecialCommitteeMemberRows(a, b) {
    const ai = String(a.special_committee_instance_id || a.committee_instance_id || "");
    const bi = String(b.special_committee_instance_id || b.committee_instance_id || "");
    if (ai !== bi) return ai < bi ? -1 : 1;

    const aso = Number(a.sort_order || 0);
    const bso = Number(b.sort_order || 0);
    if (aso !== bso) return aso - bso;

    const ar = roleOrder(a.role_name || a.role);
    const br = roleOrder(b.role_name || b.role);
    if (ar !== br) return ar - br;

    const an = String(a.member_name || a.member_id || "");
    const bn = String(b.member_name || b.member_id || "");
    return an < bn ? -1 : an > bn ? 1 : 0;
  }

  function compareMeetingRows(a, b) {
    const ad = normalizeDate(a.held_date);
    const bd = normalizeDate(b.held_date);
    if (ad !== bd) return ad < bd ? -1 : 1;

    const as = Number(a.day_sequence || 0);
    const bs = Number(b.day_sequence || 0);
    if (as !== bs) return as - bs;

    const ac = String(a.meeting_type_code || "");
    const bc = String(b.meeting_type_code || "");
    if (ac !== bc) return ac < bc ? -1 : 1;

    const ar = String(a.row_id || "");
    const br = String(b.row_id || "");
    return ar < br ? -1 : ar > br ? 1 : 0;
  }

  function eraCodeToLabel(code) {
    const value = String(code || "").trim().toUpperCase();
    if (value === "R") return "令和";
    if (value === "H") return "平成";
    if (value === "S") return "昭和";
    return value;
  }

  function buildSessionName(row) {
    if (!row) return "";
    return (
      eraCodeToLabel(row.era_code) +
      String(Number(row.wareki_year || 0) || "") +
      "年第" +
      String(Number(row.session || 0) || "") +
      "回" +
      String(row.session_type_label || "")
    );
  }

  function formatDurationMinutes(value) {
    if (value === null || value === undefined || value === "") return "";

    if (typeof value === "number") {
      if (!Number.isFinite(value)) return "";
      if (value > 0 && value < 1) {
        return String(Math.round(value * 24 * 60)) + "分";
      }
      return String(Math.round(value)) + "分";
    }

    const text = String(value).trim();
    if (!text) return "";

    if (!isNaN(Number(text))) {
      const num = Number(text);
      if (num > 0 && num < 1) {
        return String(Math.round(num * 24 * 60)) + "分";
      }
      return String(Math.round(num)) + "分";
    }

    return text;
  }

  function calcInclusiveDays(startDate, endDate) {
    const start = toDateObject(startDate);
    const end = toDateObject(endDate);
    if (!start || !end) return "";

    const diff = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
    return diff > 0 ? diff : "";
  }

  function getSteeringDates(rows) {
    return rows
      .filter(function (row) {
        return String(row.meeting_type_code || "") === "GIUN" && normalizeDate(row.held_date);
      })
      .map(function (row) {
        return normalizeDate(row.held_date);
      })
      .filter(Boolean)
      .filter(function (date, index, arr) {
        return arr.indexOf(date) === index;
      })
      .sort();
  }

  function getMeetingCssClass(meetingTypeCode) {
    const code = String(meetingTypeCode || "").trim();

    if (code === "HNKG") return "plenary";
    if (code === "GIUN") return "steering";
    if (code === "KDHK") return "leaders";
    if (SPECIAL_CODES.indexOf(code) >= 0) return "special";

    if (
      code === "SOMJ" ||
      code === "TSKJ" ||
      code === "KDKJ" ||
      code === "BKFJ" ||
      /_KYO$/.test(code)
    ) {
      return "standing";
    }

    return "standing";
  }

  function buildMeetingDetailText(row) {
    const parts = [];
    const name = String(row.meeting_name || "").trim();
    const duration = formatDurationMinutes(row.duration_minutes);
    const periodType = String(row.period_type || "").trim();

    if (name) parts.push(name);
    if (duration) parts.push("実時間: " + duration);
    if (periodType === "外") parts.push("会期外");

    return parts.join(" / ");
  }

  function buildMeetingCalendarEvents(rows) {
    return rows.map(function (row) {
      return {
        date: normalizeDate(row.held_date),
        category: "meeting",
        label: String(row.meeting_name || ""),
        sort_order: 1,
        css_class: getMeetingCssClass(row.meeting_type_code),
        detail_text: buildMeetingDetailText(row)
      };
    }).filter(function (row) {
      return row.date && row.label;
    });
  }

  function getQuestionGroupName(row) {
    return String(row.group_name || row.group || "").trim();
  }

  function buildQuestionCalendarEvents(questionRows) {
    const grouped = {};

    questionRows.forEach(function (row) {
      const dateKey = normalizeDate(row.question_date);
      if (!dateKey) return;

      const noticeNo = String(row.notice_no || "");
      const memberName = String(row.member_name || "");
      const groupName = getQuestionGroupName(row);
      const minutes = formatDurationMinutes(row.allotted_minutes);

      const detailLine = [
        "通告No" + noticeNo,
        memberName + (groupName ? "（" + groupName + "）" : ""),
        minutes
      ].filter(Boolean).join(" ");

      const uniqueKey = [dateKey, noticeNo, memberName, groupName].join("|");

      if (!grouped[dateKey]) {
        grouped[dateKey] = {
          date: dateKey,
          category: "question",
          sort_order: 2,
          css_class: "question",
          items: [],
          seen: {}
        };
      }

      if (!grouped[dateKey].seen[uniqueKey]) {
        grouped[dateKey].seen[uniqueKey] = true;
        grouped[dateKey].items.push({
          notice_no: Number(row.notice_no || 0),
          detail_text: detailLine
        });
      }
    });

    return Object.keys(grouped).sort().map(function (dateKey) {
      const group = grouped[dateKey];

      group.items.sort(function (a, b) {
        return a.notice_no - b.notice_no;
      });

      return {
        date: group.date,
        category: "question",
        label: "一般質問（" + group.items.length + "件）",
        sort_order: group.sort_order,
        css_class: group.css_class,
        detail_text: group.items.map(function (item) {
          return item.detail_text;
        }).join("\n")
      };
    });
  }

  function buildIntegratedCalendarEvents(meetingEvents, questionEvents) {
    return meetingEvents.concat(questionEvents).sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
      return a.label < b.label ? -1 : a.label > b.label ? 1 : 0;
    });
  }

  function buildDateEventMap(events) {
    const map = {};
    events.forEach(function (row) {
      if (!row.date) return;
      if (!map[row.date]) {
        map[row.date] = [];
      }
      map[row.date].push(row);
    });
    return map;
  }

  function buildCalendarMonths(startDate, endDate) {
    const start = toDateObject(startDate);
    const end = toDateObject(endDate);

    if (!start || !end) return [];

    const months = [];
    let y = start.getFullYear();
    let m = start.getMonth();

    while (true) {
      months.push({ year: y, monthIndex: m });
      if (y === end.getFullYear() && m === end.getMonth()) break;
      m += 1;
      if (m > 11) {
        m = 0;
        y += 1;
      }
    }

    return months;
  }

  function isInTerm(dateStr, startDate, endDate) {
    const d = normalizeDate(dateStr);
    const s = normalizeDate(startDate);
    const e = normalizeDate(endDate);
    if (!d || !s || !e) return false;
    return d >= s && d <= e;
  }

  function roleOrder(roleName) {
    const role = String(roleName || "").trim();
    if (role === "委員長") return 1;
    if (role === "副委員長") return 2;
    if (role === "理事") return 3;
    if (role === "委員") return 4;
    return 9;
  }

  function buildSpecialCommittees(rows, specialCommitteeMembers) {
    const map = {};

    rows.forEach(function (row) {
      const code = String(row.meeting_type_code || "");
      const name = String(row.meeting_name || "");
      const date = normalizeDate(row.held_date);

      if (SPECIAL_CODES.indexOf(code) < 0 || !name || !date) return;

      if (!map[code]) {
        map[code] = {
          special_committee_id: code,
          special_committee_name: name,
          special_committee_instance_id: "",
          first_date: date,
          last_date: date,
          count: 0,
          members: []
        };
      }

      map[code].count += 1;
      if (date < map[code].first_date) map[code].first_date = date;
      if (date > map[code].last_date) map[code].last_date = date;
    });

    specialCommitteeMembers.forEach(function (row) {
      const committeeId = String(row.special_committee_id || row.committee_id || "");
      const instanceId = String(row.special_committee_instance_id || row.committee_instance_id || "");
      const committeeName = String(row.special_committee_name || "");

      if (!map[committeeId]) {
        map[committeeId] = {
          special_committee_id: committeeId,
          special_committee_name: committeeName,
          special_committee_instance_id: instanceId,
          first_date: normalizeDate(row.start_date),
          last_date: normalizeDate(row.end_date),
          count: 0,
          members: []
        };
      }

      if (!map[committeeId].special_committee_instance_id && instanceId) {
        map[committeeId].special_committee_instance_id = instanceId;
      }
      if (!map[committeeId].special_committee_name && committeeName) {
        map[committeeId].special_committee_name = committeeName;
      }

      const startDate = normalizeDate(row.start_date);
      const endDate = normalizeDate(row.end_date);

      if (startDate && (!map[committeeId].first_date || startDate < map[committeeId].first_date)) {
        map[committeeId].first_date = startDate;
      }
      if (endDate && (!map[committeeId].last_date || endDate > map[committeeId].last_date)) {
        map[committeeId].last_date = endDate;
      }

      map[committeeId].members.push({
        special_committee_member_id: String(row.special_committee_member_id || ""),
        member_id: String(row.member_id || ""),
        member_name: String(row.member_name || row.member_id || ""),
        role_name: String(row.role_name || row.role || ""),
        sort_order: Number(row.sort_order || 0),
        start_date: startDate,
        end_date: endDate
      });
    });

    return Object.keys(map).sort().map(function (key) {
      const group = map[key];
      group.members.sort(function (a, b) {
        const aso = Number(a.sort_order || 0);
        const bso = Number(b.sort_order || 0);
        if (aso !== bso) return aso - bso;

        const ra = roleOrder(a.role_name);
        const rb = roleOrder(b.role_name);
        if (ra !== rb) return ra - rb;

        const an = String(a.member_name || "");
        const bn = String(b.member_name || "");
        return an < bn ? -1 : an > bn ? 1 : 0;
      });
      return group;
    });
  }

  function pickMinDate(rows) {
    return rows.reduce(function (min, row) {
      const d = normalizeDate(row.held_date);
      if (!d) return min;
      if (!min || d < min) return d;
      return min;
    }, "");
  }

  function pickMaxDate(rows) {
    return rows.reduce(function (max, row) {
      const d = normalizeDate(row.held_date);
      if (!d) return max;
      if (!max || d > max) return d;
      return max;
    }, "");
  }

  function buildDetail(meetingId) {
    const meetingRows = getMeetingRowsByMeetingId(meetingId);
    if (!meetingRows.length) return null;

    const first = meetingRows[0];
    const questionRows = getQuestionsByMeetingId(meetingId);
    const specialCommitteeMembers = getSpecialCommitteeMembersByMeetingId(meetingId);

    const inTermRows = meetingRows.filter(function (row) {
      return isInsidePeriodType(row.period_type);
    });

    const displayTargetRows = meetingRows.filter(function (row) {
      return isDisplayTargetPeriodType(row.period_type);
    });

    const termBaseRows = inTermRows.length ? inTermRows : meetingRows;
    const calendarBaseRows = displayTargetRows.length ? displayTargetRows : meetingRows;

    const startDate = pickMinDate(termBaseRows);
    const endDate = pickMaxDate(termBaseRows);

    const calendarStartDate = pickMinDate(calendarBaseRows);
    const calendarEndDate = pickMaxDate(calendarBaseRows);

    const meetingEvents = buildMeetingCalendarEvents(calendarBaseRows);
    const questionEvents = buildQuestionCalendarEvents(questionRows);
    const integrated = buildIntegratedCalendarEvents(meetingEvents, questionEvents);
    const specialCommittees = buildSpecialCommittees(meetingRows, specialCommitteeMembers);

    return {
      meeting_id: String(meetingId || ""),
      session_name: buildSessionName(first),
      session_type_code: String(first.session_type_code || ""),
      session_type_label: String(first.session_type_label || ""),
      start_date: startDate,
      end_date: endDate,
      term_days: calcInclusiveDays(startDate, endDate),
      calendar_start_date: calendarStartDate,
      calendar_end_date: calendarEndDate,
      steering_dates: getSteeringDates(meetingRows),
      meeting_rows: meetingRows,
      meeting_rows_in_term: inTermRows,
      meeting_rows_calendar_target: calendarBaseRows,
      question_rows: questionRows,
      calendar_events_integrated: integrated,
      special_committees: specialCommittees
    };
  }

  function renderSummary(detail) {
    const summaryArea = document.getElementById("summaryArea");
    if (!summaryArea) return;

    const steeringDates = detail.steering_dates.length
      ? detail.steering_dates.map(formatDateJa).join("、")
      : "なし";

    summaryArea.innerHTML =
      '<div class="summary-item summary-item-wide">' +
        '<span class="summary-label">会期</span>' +
        escapeHtml(formatDateJa(detail.start_date)) +
        " ～ " +
        escapeHtml(formatDateJa(detail.end_date)) +
        (detail.term_days ? "（" + escapeHtml(String(detail.term_days)) + "日）" : "") +
      "</div>" +
      '<div class="summary-item summary-item-wide">' +
        '<span class="summary-label">議会運営委員会 開催日</span>' +
        escapeHtml(steeringDates) +
      "</div>";
  }

  function renderCalendar(detail) {
    const calendarArea = document.getElementById("calendarArea");
    if (!calendarArea) return;

    const months = buildCalendarMonths(detail.calendar_start_date, detail.calendar_end_date);
    const eventMap = buildDateEventMap(detail.calendar_events_integrated);
    const weekdayLabels = ["日", "月", "火", "水", "木", "金", "土"];

    if (!months.length) {
      calendarArea.innerHTML = '<div class="empty">カレンダー表示対象がありません。</div>';
      return;
    }

    calendarArea.innerHTML = months.map(function (monthInfo) {
      const monthStart = new Date(monthInfo.year, monthInfo.monthIndex, 1);
      const monthEnd = new Date(monthInfo.year, monthInfo.monthIndex + 1, 0);
      const firstWeekday = monthStart.getDay();
      const daysInMonth = monthEnd.getDate();

      const cells = [];
      for (let i = 0; i < firstWeekday; i += 1) {
        cells.push('<div class="calendar-cell outside"></div>');
      }

      for (let day = 1; day <= daysInMonth; day += 1) {
        const yyyy = monthInfo.year;
        const mm = String(monthInfo.monthIndex + 1).padStart(2, "0");
        const dd = String(day).padStart(2, "0");
        const dateStr = yyyy + "-" + mm + "-" + dd;

        const items = eventMap[dateStr] || [];
        const visibleItems = items.slice(0, 3);
        const hiddenCount = items.length - visibleItems.length;

        const itemHtml = visibleItems.map(function (item) {
          return (
            '<div class="calendar-item ' + escapeHtml(item.css_class) + '">' +
              escapeHtml(item.label) +
            "</div>"
          );
        }).join("");

        const moreHtml = hiddenCount > 0
          ? '<div class="calendar-more">+' + escapeHtml(String(hiddenCount)) + "件</div>"
          : "";

        const inTermClass = isInTerm(dateStr, detail.start_date, detail.end_date) ? " in-term" : "";
        const hasEventsClass = items.length > 0 ? " has-events" : "";
        const dataAttr = items.length > 0 ? ' data-date="' + escapeHtml(dateStr) + '"' : "";

        cells.push(
          '<div class="calendar-cell' + inTermClass + hasEventsClass + '"' + dataAttr + ">" +
            '<div class="calendar-day">' + escapeHtml(String(day)) + "</div>" +
            '<div class="calendar-items">' + itemHtml + moreHtml + "</div>" +
          "</div>"
        );
      }

      while (cells.length % 7 !== 0) {
        cells.push('<div class="calendar-cell outside"></div>');
      }

      return (
        '<div class="calendar-month">' +
          '<div class="calendar-title">' +
            escapeHtml(String(monthInfo.year)) + "年" + escapeHtml(String(monthInfo.monthIndex + 1)) + "月" +
          "</div>" +
          '<div class="calendar-grid">' +
            weekdayLabels.map(function (label) {
              return '<div class="weekday-head">' + escapeHtml(label) + "</div>";
            }).join("") +
            cells.join("") +
          "</div>" +
        "</div>"
      );
    }).join("");

    bindCalendarDayClicks();
  }

  function renderSpecialCommittees(detail) {
    const area = document.getElementById("specialCommitteeArea");
    if (!area) return;

    if (!detail.special_committees.length) {
      area.innerHTML = '<div class="empty">特別委員会データがありません。</div>';
      return;
    }

    area.innerHTML = detail.special_committees.map(function (sc) {
      const membersHtml = sc.members.length
        ? sc.members.map(function (row) {
            const text = row.role_name
              ? row.role_name + "　" + row.member_name
              : row.member_name;
            return '<div class="history-row">' + escapeHtml(text) + "</div>";
          }).join("")
        : '<div class="empty-small">委員データがありません。</div>';

      return (
        '<div class="detail-subcard">' +
          "<h3>" + escapeHtml(sc.special_committee_name) + "</h3>" +
          '<div class="history-row"><span class="summary-label">初回開催日</span>' + escapeHtml(formatDateJa(sc.first_date)) + "</div>" +
          '<div class="history-row"><span class="summary-label">最終開催日</span>' + escapeHtml(formatDateJa(sc.last_date)) + "</div>" +
          '<div class="history-row"><span class="summary-label">開催回数</span>' + escapeHtml(String(sc.count)) + "回</div>" +
          '<div class="detail-subcard" style="margin-top:12px;">' +
            "<h3>委員一覧</h3>" +
            membersHtml +
          "</div>" +
        "</div>"
      );
    }).join("");
  }

  function renderItems() {
    const area = document.getElementById("itemsArea");
    if (!area) return;
    area.innerHTML = "";
  }

  function openDayModal(dateStr) {
    if (!currentDetail) return;

    const normalized = normalizeDate(dateStr);
    const items = currentDetail.calendar_events_integrated.filter(function (row) {
      return row.date === normalized;
    });

    const backdrop = document.getElementById("dayModalBackdrop");
    const title = document.getElementById("dayModalTitle");
    const body = document.getElementById("dayModalBody");

    if (!backdrop || !title || !body) return;

    title.textContent = formatDateJa(normalized) + " の詳細";

    if (!items.length) {
      body.innerHTML = '<div class="empty">この日のイベントはありません。</div>';
    } else {
      body.innerHTML = items.map(function (item) {
        return (
          '<div class="modal-item">' +
            '<div class="modal-item-title">' + escapeHtml(item.label) + "</div>" +
            '<div class="modal-item-note">' + escapeHtml(item.detail_text || item.label) + "</div>" +
          "</div>"
        );
      }).join("");
    }

    backdrop.classList.add("show");
  }

  function closeDayModal() {
    const backdrop = document.getElementById("dayModalBackdrop");
    if (backdrop) {
      backdrop.classList.remove("show");
    }
  }

  function bindCalendarDayClicks() {
    document.querySelectorAll(".calendar-cell.has-events[data-date]").forEach(function (cell) {
      cell.addEventListener("click", function () {
        openDayModal(cell.dataset.date || "");
      });
    });
  }

  function bindModalEvents() {
    const backdrop = document.getElementById("dayModalBackdrop");
    const closeBtn = document.getElementById("dayModalClose");

    if (closeBtn) {
      closeBtn.addEventListener("click", closeDayModal);
    }

    if (backdrop) {
      backdrop.addEventListener("click", function (e) {
        if (e.target === backdrop) {
          closeDayModal();
        }
      });
    }

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        closeDayModal();
      }
    });
  }

  function render(detail) {
    const pageTitle = document.getElementById("pageTitle");
    const pageDesc = document.getElementById("pageDesc");

    if (pageTitle) {
      pageTitle.textContent = detail.session_name;
    }
    if (pageDesc) {
      pageDesc.textContent = detail.session_type_label + " の詳細を表示しています。";
    }

    renderSummary(detail);
    renderCalendar(detail);
    renderSpecialCommittees(detail);
    renderItems(detail);
  }

  function renderStatus(text) {
    const box = document.getElementById("statusBox");
    if (box) {
      box.textContent = text;
    }
  }

  function renderEmptyState(message) {
    const summaryArea = document.getElementById("summaryArea");
    const calendarArea = document.getElementById("calendarArea");
    const specialCommitteeArea = document.getElementById("specialCommitteeArea");
    const itemsArea = document.getElementById("itemsArea");

    if (summaryArea) summaryArea.innerHTML = '<div class="empty">' + escapeHtml(message) + "</div>";
    if (calendarArea) calendarArea.innerHTML = '<div class="empty">表示対象がありません。</div>';
    if (specialCommitteeArea) specialCommitteeArea.innerHTML = '<div class="empty">表示対象がありません。</div>';
    if (itemsArea) itemsArea.innerHTML = "";
  }

  function init() {
    bindModalEvents();

    const meetingId = qs("meeting_id");

    if (!meetingId) {
      renderStatus("meeting_id が指定されていません。");
      renderEmptyState("meeting_id がありません。");
      return;
    }

    const detail = buildDetail(meetingId);

    if (!detail) {
      renderStatus("該当する会議回が見つかりません。");
      renderEmptyState("該当する会議回がありません。");
      return;
    }

    currentDetail = detail;

    renderStatus([
      "meeting_detail.html 読み込み成功",
      "meeting_id: " + detail.meeting_id,
      "meeting_rows: " + detail.meeting_rows.length + "件",
      "meeting_rows_in_term: " + detail.meeting_rows_in_term.length + "件",
      "meeting_rows_calendar_target: " + detail.meeting_rows_calendar_target.length + "件",
      "question_rows: " + detail.question_rows.length + "件",
      "calendar_events_integrated: " + detail.calendar_events_integrated.length + "件",
      "special_committees: " + detail.special_committees.length + "件"
    ].join("\n"));

    render(detail);
  }

  return {
    init: init
  };
})();

document.addEventListener("DOMContentLoaded", function () {
  window.MEETING_DETAIL_VIEW.init();
});