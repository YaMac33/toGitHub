window.APP_DATA = window.APP_DATA || {};

window.MEETING_DETAIL_VIEW = (function () {
  "use strict";

  let currentDetail = null;

  function getArray(name) {
    return Array.isArray(window.APP_DATA[name]) ? window.APP_DATA[name] : [];
  }

  function qs(name) {
    return new URLSearchParams(window.location.search).get(name) || "";
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
        return (a.committee_id || "") < (b.committee_id || "") ? -1 : 1;
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
        return (a.meeting_date || "") < (b.meeting_date || "") ? -1 : 1;
      });
  }

  function roleOrder(roleName) {
    const role = String(roleName || "").trim();
    if (role === "委員長") return 1;
    if (role === "副委員長") return 2;
    return 9;
  }

  function getSpecialCommitteeMembersByInstanceId(instanceId) {
    return getArray("special_committee_members")
      .filter(function (row) {
        return row.special_committee_instance_id === instanceId;
      })
      .sort(function (a, b) {
        const ra = roleOrder(a.role_name);
        const rb = roleOrder(b.role_name);
        if (ra !== rb) return ra - rb;

        const am = getMemberById(a.member_id);
        const bm = getMemberById(b.member_id);

        const ano = Number(am && am.member_no ? am.member_no : 999999);
        const bno = Number(bm && bm.member_no ? bm.member_no : 999999);
        if (ano !== bno) return ano - bno;

        const an = am ? (am.member_name || "") : (a.member_id || "");
        const bn = bm ? (bm.member_name || "") : (b.member_id || "");
        return an < bn ? -1 : an > bn ? 1 : 0;
      });
  }

  function calcInclusiveDays(startDate, endDate) {
    if (!startDate || !endDate) return "";
    const start = new Date(startDate + "T00:00:00");
    const end = new Date(endDate + "T00:00:00");
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "";
    const diff = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
    return diff > 0 ? diff : "";
  }

  function formatDurationHours(v) {
    if (v === null || v === undefined || v === "") return "";
    const num = Number(v);
    if (!Number.isFinite(num)) return String(v);

    const totalMinutes = Math.round(num * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return hours + "時間" + minutes + "分";
  }

  function buildDateEvents(meetingId) {
    const normalEvents = getEventsByMeetingId(meetingId).map(function (row) {
      let label = "";
      let cls = "";
      let order = 999;

      if (row.event_type_id === "PLENARY") {
        label = "本会議";
        cls = "plenary";
        order = 1;
      } else if (row.event_type_id === "STEERING_COMMITTEE") {
        label = "議会運営委員会";
        cls = "steering";
        order = 2;
      } else if (row.event_type_id === "LEADERS_MEETING") {
        label = "会派代表者会議";
        cls = "leaders";
        order = 3;
      } else {
        const committee = getCommitteeById(row.committee_id);
        label = committee ? committee.committee_name : "常任委員会";
        cls = "standing";
        order = 4;
      }

      const noteParts = [];
      if (row.duration !== "" && row.duration !== undefined) {
        noteParts.push("所要時間: " + formatDurationHours(row.duration));
      }
      if (row.note) {
        noteParts.push(row.note);
      }

      return {
        event_date: row.event_date || "",
        label: label,
        note: noteParts.join(" / "),
        css_class: cls,
        sort_order_in_day: order,
        source_type: "normal",
        source_id: row.event_id || ""
      };
    });

    const specialEvents = getSpecialCommitteeInstancesByMeetingId(meetingId).flatMap(function (instance) {
      const specialCommittee = getSpecialCommitteeById(instance.special_committee_id);
      const label = specialCommittee ? specialCommittee.special_committee_name : "特別委員会";

      return getSpecialCommitteeMeetingsByInstanceId(instance.special_committee_instance_id).map(function (row) {
        return {
          event_date: row.meeting_date || "",
          label: label,
          note: row.note || "",
          css_class: "special",
          sort_order_in_day: 5,
          source_type: "special",
          source_id: row.special_committee_meeting_id || ""
        };
      });
    });

    return normalEvents.concat(specialEvents).sort(function (a, b) {
      if (a.event_date !== b.event_date) return a.event_date < b.event_date ? -1 : 1;
      if (a.sort_order_in_day !== b.sort_order_in_day) return a.sort_order_in_day - b.sort_order_in_day;
      return a.label < b.label ? -1 : a.label > b.label ? 1 : 0;
    });
  }

  function buildCalendarMonths(startDate, endDate) {
    if (!startDate || !endDate) return [];
    const start = new Date(startDate + "T00:00:00");
    const end = new Date(endDate + "T00:00:00");
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];

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

  function groupEventsByDate(events) {
    const map = {};
    events.forEach(function (row) {
      if (!map[row.event_date]) {
        map[row.event_date] = [];
      }
      map[row.event_date].push(row);
    });
    return map;
  }

  function isInTerm(dateStr, startDate, endDate) {
    if (!dateStr || !startDate || !endDate) return false;
    return dateStr >= startDate && dateStr <= endDate;
  }

  function renderSummary(detail) {
    const summaryArea = document.getElementById("summaryArea");
    const steeringDates = detail.steering_dates.length
      ? detail.steering_dates.map(toWareki).join("、")
      : "なし";

    const scheduleHtml = detail.schedule_file_path
      ? '<a href="' + escapeHtml(detail.schedule_file_path) + '" target="_blank" rel="noopener noreferrer">日程表</a>'
      : "なし";

    summaryArea.innerHTML =
      '<div class="summary-item summary-item-wide">' +
        '<span class="summary-label">会期</span>' +
        escapeHtml(toWareki(detail.start_date)) + " ～ " + escapeHtml(toWareki(detail.end_date)) +
        (detail.term_days ? "（" + escapeHtml(String(detail.term_days)) + "日）" : "") +
      "</div>" +
      '<div class="summary-item summary-item-wide">' +
        '<span class="summary-label">議会運営委員会 開催日</span>' +
        escapeHtml(steeringDates) +
      "</div>" +
      '<div class="summary-item summary-item-wide link-line">' +
        '<span class="summary-label">日程表</span>' +
        scheduleHtml +
      "</div>";
  }

  function renderCalendar(detail) {
    const calendarArea = document.getElementById("calendarArea");
    const months = buildCalendarMonths(detail.start_date, detail.end_date);
    const eventMap = groupEventsByDate(detail.date_events);
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
            '</div>'
          );
        }).join("");

        const moreHtml = hiddenCount > 0
          ? '<div class="calendar-more">+' + escapeHtml(String(hiddenCount)) + '件</div>'
          : "";

        const inTermClass = isInTerm(dateStr, detail.start_date, detail.end_date) ? " in-term" : "";
        const hasEventsClass = items.length > 0 ? " has-events" : "";
        const dataAttr = items.length > 0 ? ' data-date="' + escapeHtml(dateStr) + '"' : "";

        cells.push(
          '<div class="calendar-cell' + inTermClass + hasEventsClass + '"' + dataAttr + '>' +
            '<div class="calendar-day">' + escapeHtml(String(day)) + '</div>' +
            '<div class="calendar-items">' + itemHtml + moreHtml + '</div>' +
          '</div>'
        );
      }

      while (cells.length % 7 !== 0) {
        cells.push('<div class="calendar-cell outside"></div>');
      }

      return (
        '<div class="calendar-month">' +
          '<div class="calendar-title">' + escapeHtml(String(monthInfo.year)) + "年" + escapeHtml(String(monthInfo.monthIndex + 1)) + "月</div>" +
          '<div class="calendar-grid">' +
            weekdayLabels.map(function (label) {
              return '<div class="weekday-head">' + escapeHtml(label) + '</div>';
            }).join("") +
            cells.join("") +
          '</div>' +
        '</div>'
      );
    }).join("");

    bindCalendarDayClicks();
  }

  function renderSpecialCommittees(detail) {
    const area = document.getElementById("specialCommitteeArea");

    if (!detail.special_committees.length) {
      area.innerHTML = '<div class="empty">特別委員会データがありません。</div>';
      return;
    }

    area.innerHTML = detail.special_committees.map(function (sc) {
      const rosterHtml = sc.roster_file_path
        ? '<div class="link-line"><a href="' + escapeHtml(sc.roster_file_path) + '" target="_blank" rel="noopener noreferrer">名簿</a></div>'
        : '<div class="link-line">名簿: なし</div>';

      const meetingDatesHtml = sc.meeting_dates.length
        ? sc.meeting_dates.map(function (row) {
            const text = row.note
              ? toWareki(row.meeting_date) + " / " + row.note
              : toWareki(row.meeting_date);
            return '<div class="history-row">' + escapeHtml(text) + '</div>';
          }).join("")
        : '<div class="empty-small">データなし</div>';

      const membersHtml = sc.members.length
        ? sc.members.map(function (row) {
            const text = row.role_name
              ? row.member_name + "（" + row.role_name + "）"
              : row.member_name;
            return '<div class="history-row">' + escapeHtml(text) + '</div>';
          }).join("")
        : '<div class="empty-small">データなし</div>';

      return (
        '<div class="detail-subcard">' +
          '<h3>' + escapeHtml(sc.special_committee_name) + '</h3>' +
          '<div class="history-row">設置日: ' + escapeHtml(toWareki(sc.established_date)) + '</div>' +
          '<div class="history-row">終了日: ' + escapeHtml(sc.end_date ? toWareki(sc.end_date) : "継続中") + '</div>' +
          rosterHtml +
          (sc.note ? '<div class="history-row">備考: ' + escapeHtml(sc.note) + '</div>' : "") +
          '<div class="detail-grid" style="margin-top:12px;">' +
            '<div class="detail-subcard">' +
              '<h3>会議日</h3>' +
              meetingDatesHtml +
            '</div>' +
            '<div class="detail-subcard">' +
              '<h3>委員名簿</h3>' +
              membersHtml +
            '</div>' +
          '</div>' +
        '</div>'
      );
    }).join("");
  }

  function buildDetail(meetingId) {
    const meeting = getMeetingById(meetingId);
    if (!meeting) return null;

    const steeringDates = getEventsByMeetingId(meetingId)
      .filter(function (row) {
        return row.event_type_id === "STEERING_COMMITTEE";
      })
      .map(function (row) {
        return row.event_date || "";
      });

    const specialCommittees = getSpecialCommitteeInstancesByMeetingId(meetingId).map(function (instance) {
      const scMaster = getSpecialCommitteeById(instance.special_committee_id);
      return {
        special_committee_name: scMaster ? scMaster.special_committee_name : "特別委員会",
        established_date: instance.established_date || "",
        end_date: instance.end_date || "",
        note: instance.note || "",
        roster_file_path: instance.roster_file_path || "",
        meeting_dates: getSpecialCommitteeMeetingsByInstanceId(instance.special_committee_instance_id).map(function (row) {
          return {
            meeting_date: row.meeting_date || "",
            note: row.note || ""
          };
        }),
        members: getSpecialCommitteeMembersByInstanceId(instance.special_committee_instance_id).map(function (row) {
          const member = getMemberById(row.member_id);
          return {
            member_name: member ? member.member_name : row.member_id,
            role_name: row.role_name || ""
          };
        })
      };
    });

    return {
      meeting_id: meeting.meeting_id || "",
      session_name: meeting.session_name || "",
      session_type: meeting.session_type || "",
      start_date: meeting.start_date || "",
      end_date: meeting.end_date || "",
      term_days: calcInclusiveDays(meeting.start_date, meeting.end_date),
      schedule_file_path: meeting.schedule_file_path || "",
      steering_dates: steeringDates,
      date_events: buildDateEvents(meetingId),
      special_committees: specialCommittees
    };
  }

  function openDayModal(dateStr) {
    if (!currentDetail) return;

    const items = currentDetail.date_events.filter(function (row) {
      return row.event_date === dateStr;
    });

    const backdrop = document.getElementById("dayModalBackdrop");
    const title = document.getElementById("dayModalTitle");
    const body = document.getElementById("dayModalBody");

    title.textContent = toWareki(dateStr) + " の会議詳細";

    if (!items.length) {
      body.innerHTML = '<div class="empty">この日のイベントはありません。</div>';
    } else {
      body.innerHTML = items.map(function (item) {
        return (
          '<div class="modal-item">' +
            '<div class="modal-item-title">' + escapeHtml(item.label) + '</div>' +
            '<div class="modal-item-note">' + (item.note ? escapeHtml(item.note) : "補足なし") + '</div>' +
          '</div>'
        );
      }).join("");
    }

    backdrop.classList.add("show");
  }

  function closeDayModal() {
    document.getElementById("dayModalBackdrop").classList.remove("show");
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

    closeBtn.addEventListener("click", closeDayModal);

    backdrop.addEventListener("click", function (e) {
      if (e.target === backdrop) {
        closeDayModal();
      }
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        closeDayModal();
      }
    });
  }

  function render(detail) {
    const pageTitle = document.getElementById("pageTitle");
    const pageDesc = document.getElementById("pageDesc");

    pageTitle.textContent = detail.session_name;
    pageDesc.textContent = sessionTypeLabel(detail.session_type) + " の詳細を表示しています。";

    renderSummary(detail);
    renderCalendar(detail);
    renderSpecialCommittees(detail);
  }

  function renderStatus(text) {
    document.getElementById("statusBox").textContent = text;
  }

  function init() {
    bindModalEvents();

    const meetingId = qs("meeting_id");

    if (!meetingId) {
      renderStatus("meeting_id が指定されていません。");
      document.getElementById("summaryArea").innerHTML = '<div class="empty">meeting_id がありません。</div>';
      document.getElementById("calendarArea").innerHTML = '<div class="empty">表示対象がありません。</div>';
      document.getElementById("specialCommitteeArea").innerHTML = '<div class="empty">表示対象がありません。</div>';
      return;
    }

    const detail = buildDetail(meetingId);

    if (!detail) {
      renderStatus("該当する会議回が見つかりません。");
      document.getElementById("summaryArea").innerHTML = '<div class="empty">該当する会議回がありません。</div>';
      document.getElementById("calendarArea").innerHTML = '<div class="empty">表示対象がありません。</div>';
      document.getElementById("specialCommitteeArea").innerHTML = '<div class="empty">表示対象がありません。</div>';
      return;
    }

    currentDetail = detail;

    renderStatus([
      "meeting_detail.html 読み込み成功",
      "meeting_id: " + detail.meeting_id,
      "date_events: " + detail.date_events.length + "件",
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
