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
    return window.APP_UTILS && window.APP_UTILS.escapeHtml
      ? window.APP_UTILS.escapeHtml(value)
      : String(value == null ? "" : value);
  }

  function toWareki(dateStr) {
    return window.APP_FORMATTERS && window.APP_FORMATTERS.toWareki
      ? window.APP_FORMATTERS.toWareki(dateStr)
      : (dateStr || "");
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

  function getItemById(itemId) {
    return getArray("items").find(function (row) {
      return row.item_id === itemId;
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
        return (a.event_id || "") < (b.event_id || "") ? -1 : 1;
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

  function buildMeetingEvents(meetingId) {
    const normalEvents = getEventsByMeetingId(meetingId).map(function (row) {
      let label = "";
      let cls = "";
      let order = 1;

      if (row.event_type_id === "PLENARY") {
        label = "本会議";
        cls = "plenary";
        order = 1;
      } else if (row.event_type_id === "STEERING_COMMITTEE") {
        label = "議会運営委員会";
        cls = "steering";
        order = 1;
      } else if (row.event_type_id === "LEADERS_MEETING") {
        label = "会派代表者会議";
        cls = "leaders";
        order = 1;
      } else {
        const committee = getCommitteeById(row.committee_id);
        label = committee ? committee.committee_name : "常任委員会";
        cls = "standing";
        order = 1;
      }

      const noteParts = [];
      if (row.duration !== "" && row.duration !== undefined) {
        noteParts.push("所要時間: " + formatDurationHours(row.duration));
      }
      if (row.note) {
        noteParts.push(row.note);
      }

      return {
        date: row.event_date || "",
        category: "meeting",
        label: label,
        sort_order: order,
        css_class: cls,
        detail_text: noteParts.join(" / ") || label
      };
    });

    const specialEvents = getSpecialCommitteeInstancesByMeetingId(meetingId).flatMap(function (instance) {
      const specialCommittee = getSpecialCommitteeById(instance.special_committee_id);
      const label = specialCommittee ? specialCommittee.special_committee_name : "特別委員会";

      return getSpecialCommitteeMeetingsByInstanceId(instance.special_committee_instance_id).map(function (row) {
        return {
          date: row.meeting_date || "",
          category: "meeting",
          label: label,
          sort_order: 1,
          css_class: "special",
          detail_text: row.note || label
        };
      });
    });

    return normalEvents.concat(specialEvents).sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return a.label < b.label ? -1 : a.label > b.label ? 1 : 0;
    });
  }

  function getItemActionsByMeetingId(meetingId) {
    return getArray("item_actions")
      .filter(function (row) {
        return row.meeting_id === meetingId;
      })
      .sort(function (a, b) {
        const ad = a.action_date || "";
        const bd = b.action_date || "";
        if (ad !== bd) return ad < bd ? -1 : 1;
        return (a.action_id || "") < (b.action_id || "") ? -1 : 1;
      });
  }

  function buildMeetingItemUnits(meetingId) {
    const actions = getItemActionsByMeetingId(meetingId);
    const map = {};

    actions.forEach(function (row) {
      const item = getItemById(row.item_id);
      if (!item) return;

      if (!map[row.item_id]) {
        map[row.item_id] = {
          item_id: item.item_id || "",
          item_class: item.item_class || "",
          item_no: item.item_no || "",
          item_no_numeric: Number(item.item_no_numeric || 0),
          title: item.title || "",
          meeting_id: meetingId,
          proposed_date: "",
          referred_date: "",
          decided_date: "",
          continued_date: "",
          withdrawn_date: "",
          decided_result_label: "",
          actions: []
        };
      }

      const unit = map[row.item_id];
      unit.actions.push(row);

      if (row.action_type === "PROPOSED" && !unit.proposed_date) {
        unit.proposed_date = row.action_date || "";
      }
      if (row.action_type === "REFERRED" && !unit.referred_date) {
        unit.referred_date = row.action_date || "";
      }
      if (row.action_type === "DECIDED" && !unit.decided_date) {
        unit.decided_date = row.action_date || "";
        unit.decided_result_label = row.result_label || "";
      }
      if (row.action_type === "CONTINUED" && !unit.continued_date) {
        unit.continued_date = row.action_date || "";
      }
      if (row.action_type === "WITHDRAWN" && !unit.withdrawn_date) {
        unit.withdrawn_date = row.action_date || "";
      }
    });

    return Object.values(map).sort(function (a, b) {
      return a.item_no_numeric - b.item_no_numeric;
    });
  }

  function getStandardProposedDate(itemUnits) {
    const countMap = {};

    itemUnits
      .filter(function (row) {
        return row.item_class === "BILL" && row.proposed_date;
      })
      .forEach(function (row) {
        if (!countMap[row.proposed_date]) {
          countMap[row.proposed_date] = 0;
        }
        countMap[row.proposed_date] += 1;
      });

    let bestDate = "";
    let bestCount = -1;

    Object.keys(countMap).forEach(function (dateKey) {
      if (countMap[dateKey] > bestCount) {
        bestDate = dateKey;
        bestCount = countMap[dateKey];
      }
    });

    return bestDate;
  }

  function classifyMeetingItemUnit(unit, standardProposedDate) {
    if (unit.withdrawn_date) {
      return "withdrawn";
    }

    if (unit.item_class === "PROPOSAL") {
      return "proposal";
    }

    if (unit.item_class === "PETITION" || unit.item_class === "REQUEST") {
      return "petition_request";
    }

    const isAdditional = !!unit.proposed_date && !!standardProposedDate && unit.proposed_date !== standardProposedDate;
    const hasReferred = !!unit.referred_date;
    const hasDecided = !!unit.decided_date;
    const hasContinued = !!unit.continued_date;

    if (isAdditional && !hasReferred && hasDecided) {
      return "additional_fasttrack";
    }

    if (isAdditional && hasReferred && hasContinued) {
      return "additional_continued";
    }

    if (isAdditional && hasReferred && hasDecided) {
      return "additional";
    }

    if (!isAdditional && !hasReferred && hasDecided) {
      return "fasttrack";
    }

    if (!isAdditional && hasReferred && (hasDecided || hasContinued)) {
      return "basic_bill";
    }

    return "other";
  }

  function getPatternLabel(type) {
    const map = {
      basic_bill: "基本形（議案）",
      petition_request: "請願・陳情",
      proposal: "発議案",
      fasttrack: "先議",
      additional: "追加議案",
      additional_fasttrack: "追加議案（先議）",
      additional_continued: "追加議案（継続審査）",
      withdrawn: "取下げ",
      other: "その他"
    };
    return map[type] || "その他";
  }

  function groupMeetingItemPatterns(itemUnits, standardProposedDate) {
    const groupedMap = {};

    itemUnits.forEach(function (unit) {
      unit.pattern_type = classifyMeetingItemUnit(unit, standardProposedDate);

      const decidedLabelKey = unit.decided_result_label || "";
      const key = [
        unit.pattern_type,
        unit.proposed_date || "",
        unit.referred_date || "",
        unit.decided_date || "",
        unit.continued_date || "",
        unit.withdrawn_date || "",
        decidedLabelKey
      ].join("|");

      if (!groupedMap[key]) {
        groupedMap[key] = {
          pattern_type: unit.pattern_type,
          proposed_date: unit.proposed_date || "",
          referred_date: unit.referred_date || "",
          decided_date: unit.decided_date || "",
          continued_date: unit.continued_date || "",
          withdrawn_date: unit.withdrawn_date || "",
          decided_result_label: decidedLabelKey,
          items: []
        };
      }

      groupedMap[key].items.push(unit);
    });

    return Object.values(groupedMap).map(function (group) {
      group.items.sort(function (a, b) {
        return a.item_no_numeric - b.item_no_numeric;
      });
      return group;
    });
  }

  function buildNumberRangeLabel(items) {
    if (!items.length) return "";

    if (items.length === 1) {
      return items[0].item_no || "";
    }

    const first = items[0];
    const last = items[items.length - 1];

    const allBills = items.every(function (row) {
      return row.item_class === "BILL";
    });

    if (allBills) {
      let contiguous = true;
      for (let i = 1; i < items.length; i += 1) {
        if (items[i].item_no_numeric !== items[i - 1].item_no_numeric + 1) {
          contiguous = false;
          break;
        }
      }
      if (contiguous) {
        return "議案第" + first.item_no_numeric + "号〜第" + last.item_no_numeric + "号";
      }
    }

    return items.map(function (row) {
      return row.item_no || "";
    }).join("、");
  }

  function buildPatternLines(group) {
    const lines = [];

    if (group.pattern_type === "petition_request") {
      if (group.referred_date) {
        lines.push({ label: "付託日", value: group.referred_date });
      }
      if (group.decided_date) {
        const decidedLabel = group.decided_result_label || "議決";
        lines.push({ label: decidedLabel + "日", value: group.decided_date });
      }
      if (group.continued_date) {
        lines.push({ label: "継続審査決定日", value: group.continued_date });
      }
      return lines;
    }

    if (group.proposed_date) {
      lines.push({ label: "提案日", value: group.proposed_date });
    }
    if (group.referred_date) {
      lines.push({ label: "付託日", value: group.referred_date });
    }
    if (group.decided_date) {
      lines.push({
        label: (group.decided_result_label || "議決") + "日",
        value: group.decided_date
      });
    }
    if (group.continued_date) {
      lines.push({ label: "継続審査決定日", value: group.continued_date });
    }
    if (group.withdrawn_date) {
      lines.push({ label: "取下げ日", value: group.withdrawn_date });
    }

    return lines;
  }

  function buildItemCalendarEvents(groupedPatterns) {
    const events = [];

    groupedPatterns.forEach(function (group) {
      const numberLabel = buildNumberRangeLabel(group.items);
      const cssSuffixPassed = "decided-passed";
      const cssSuffixRejected = "decided-rejected";

      if (group.pattern_type === "petition_request") {
        if (group.referred_date) {
          events.push({
            date: group.referred_date,
            category: "item",
            label: "付託（" + numberLabel + "）",
            sort_order: 3,
            css_class: "referred",
            detail_text: "付託（" + numberLabel + "）"
          });
        }

        if (group.decided_date) {
          const decidedLabel = group.decided_result_label || "議決";
          const decidedCss = decidedLabel === "不採択" ? cssSuffixRejected : cssSuffixPassed;
          events.push({
            date: group.decided_date,
            category: "item",
            label: decidedLabel + "（" + numberLabel + "）",
            sort_order: 5,
            css_class: decidedCss,
            detail_text: decidedLabel + "（" + numberLabel + "）"
          });
        }

        if (group.continued_date) {
          events.push({
            date: group.continued_date,
            category: "item",
            label: "継続審査（" + numberLabel + "）",
            sort_order: 4,
            css_class: "continued",
            detail_text: "継続審査（" + numberLabel + "）"
          });
        }

        return;
      }

      if (group.proposed_date) {
        events.push({
          date: group.proposed_date,
          category: "item",
          label: "提案（" + numberLabel + "）",
          sort_order: 2,
          css_class: "proposed",
          detail_text: "提案（" + numberLabel + "）"
        });
      }

      if (group.referred_date) {
        events.push({
          date: group.referred_date,
          category: "item",
          label: "付託（" + numberLabel + "）",
          sort_order: 3,
          css_class: "referred",
          detail_text: "付託（" + numberLabel + "）"
        });
      }

      if (group.continued_date) {
        events.push({
          date: group.continued_date,
          category: "item",
          label: "継続審査（" + numberLabel + "）",
          sort_order: 4,
          css_class: "continued",
          detail_text: "継続審査（" + numberLabel + "）"
        });
      }

      if (group.decided_date) {
        const decidedLabel = group.decided_result_label || "議決";
        const rejectedLabels = ["否決", "不採択"];
        const decidedCss = rejectedLabels.includes(decidedLabel) ? cssSuffixRejected : cssSuffixPassed;

        events.push({
          date: group.decided_date,
          category: "item",
          label: decidedLabel + "（" + numberLabel + "）",
          sort_order: 5,
          css_class: decidedCss,
          detail_text: decidedLabel + "（" + numberLabel + "）"
        });
      }

      if (group.withdrawn_date) {
        events.push({
          date: group.withdrawn_date,
          category: "item",
          label: "取下げ（" + numberLabel + "）",
          sort_order: 6,
          css_class: "withdrawn",
          detail_text: "取下げ（" + numberLabel + "）"
        });
      }
    });

    return events;
  }

  function buildIntegratedCalendarEvents(meetingEvents, itemEvents) {
    return meetingEvents.concat(itemEvents).sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
      return a.label < b.label ? -1 : a.label > b.label ? 1 : 0;
    });
  }

  function buildDateEventMap(events) {
    const map = {};
    events.forEach(function (row) {
      if (!map[row.date]) {
        map[row.date] = [];
      }
      map[row.date].push(row);
    });
    return map;
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
          '<div class="calendar-title">' + escapeHtml(String(monthInfo.year)) + "年" + escapeHtml(String(monthInfo.monthIndex + 1)) + "月</div>" +
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
            return '<div class="history-row">' + escapeHtml(text) + "</div>";
          }).join("")
        : '<div class="empty-small">データなし</div>';

      const membersHtml = sc.members.length
        ? sc.members.map(function (row) {
            const text = row.role_name
              ? row.member_name + "（" + row.role_name + "）"
              : row.member_name;
            return '<div class="history-row">' + escapeHtml(text) + "</div>";
          }).join("")
        : '<div class="empty-small">データなし</div>';

      return (
        '<div class="detail-subcard">' +
          "<h3>" + escapeHtml(sc.special_committee_name) + "</h3>" +
          '<div class="history-row">設置日: ' + escapeHtml(toWareki(sc.established_date)) + "</div>" +
          '<div class="history-row">終了日: ' + escapeHtml(sc.end_date ? toWareki(sc.end_date) : "継続中") + "</div>" +
          rosterHtml +
          (sc.note ? '<div class="history-row">備考: ' + escapeHtml(sc.note) + "</div>" : "") +
          '<div class="detail-grid" style="margin-top:12px;">' +
            '<div class="detail-subcard">' +
              "<h3>会議日</h3>" +
              meetingDatesHtml +
            "</div>" +
            '<div class="detail-subcard">' +
              "<h3>委員名簿</h3>" +
              membersHtml +
            "</div>" +
          "</div>" +
        "</div>"
      );
    }).join("");
  }

  function renderPatternBlock(title, groups) {
    if (!groups.length) return "";

    return (
      '<div class="pattern-block">' +
        '<div class="pattern-title">' + escapeHtml(title) + "</div>" +
        groups.map(function (group) {
          const lines = buildPatternLines(group);
          const numberLabel = buildNumberRangeLabel(group.items);

          return (
            '<div class="pattern-item">' +
              '<div class="pattern-item-title">' + escapeHtml(numberLabel) + ":</div>" +
              lines.map(function (line) {
                return (
                  '<div class="history-row">' +
                    '<span class="summary-label">' + escapeHtml(line.label) + "</span>" +
                    escapeHtml(toWareki(line.value)) +
                  "</div>"
                );
              }).join("") +
            "</div>"
          );
        }).join("") +
      "</div>"
    );
  }

  function renderItems(detail) {
    const area = document.getElementById("itemsArea");
    const grouped = detail.item_patterns;

    if (!grouped.length) {
      area.innerHTML = '<div class="empty">案件データがありません。</div>';
      return;
    }

    const basicBillGroups = grouped.filter(function (row) { return row.pattern_type === "basic_bill"; });
    const petitionRequestGroups = grouped.filter(function (row) { return row.pattern_type === "petition_request"; });
    const proposalGroups = grouped.filter(function (row) { return row.pattern_type === "proposal"; });

    const exceptionGroups = grouped.filter(function (row) {
      return ["fasttrack", "additional", "additional_fasttrack", "additional_continued", "withdrawn", "other"].includes(row.pattern_type);
    });

    let html = "";
    html += renderPatternBlock("基本形（議案）", basicBillGroups);
    html += renderPatternBlock("請願・陳情", petitionRequestGroups);
    html += renderPatternBlock("発議案", proposalGroups);

    if (exceptionGroups.length) {
      html += '<div class="pattern-block">';
      html += '<div class="pattern-title">例外</div>';

      ["fasttrack", "additional", "additional_fasttrack", "additional_continued", "withdrawn", "other"].forEach(function (type) {
        const rows = exceptionGroups.filter(function (row) {
          return row.pattern_type === type;
        });
        if (!rows.length) return;

        html += '<div class="pattern-item">';
        html += '<div class="pattern-item-title">▼ ' + escapeHtml(getPatternLabel(type)) + "</div>";

        rows.forEach(function (group) {
          const lines = buildPatternLines(group);
          const numberLabel = buildNumberRangeLabel(group.items);

          html += '<div class="pattern-item">';
          html += '<div class="pattern-item-title">' + escapeHtml(numberLabel) + ":</div>";
          html += lines.map(function (line) {
            return (
              '<div class="history-row">' +
                '<span class="summary-label">' + escapeHtml(line.label) + "</span>" +
                escapeHtml(toWareki(line.value)) +
              "</div>"
            );
          }).join("");
          html += "</div>";
        });

        html += "</div>";
      });

      html += "</div>";
    }

    area.innerHTML = html || '<div class="empty">表示対象がありません。</div>';
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

    const meetingEvents = buildMeetingEvents(meetingId);
    const itemUnits = buildMeetingItemUnits(meetingId);
    const standardProposedDate = getStandardProposedDate(itemUnits);
    const itemPatterns = groupMeetingItemPatterns(itemUnits, standardProposedDate);
    const itemCalendarEvents = buildItemCalendarEvents(itemPatterns);
    const integratedCalendarEvents = buildIntegratedCalendarEvents(meetingEvents, itemCalendarEvents);

    return {
      meeting_id: meeting.meeting_id || "",
      session_name: meeting.session_name || "",
      session_type: meeting.session_type || "",
      start_date: meeting.start_date || "",
      end_date: meeting.end_date || "",
      term_days: calcInclusiveDays(meeting.start_date, meeting.end_date),
      schedule_file_path: meeting.schedule_file_path || "",
      steering_dates: steeringDates,
      special_committees: specialCommittees,
      item_patterns: itemPatterns,
      calendar_events_integrated: integratedCalendarEvents
    };
  }

  function openDayModal(dateStr) {
    if (!currentDetail) return;

    const items = currentDetail.calendar_events_integrated.filter(function (row) {
      return row.date === dateStr;
    });

    const backdrop = document.getElementById("dayModalBackdrop");
    const title = document.getElementById("dayModalTitle");
    const body = document.getElementById("dayModalBody");

    title.textContent = toWareki(dateStr) + " の詳細";

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
    renderItems(detail);
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
      document.getElementById("itemsArea").innerHTML = '<div class="empty">表示対象がありません。</div>';
      return;
    }

    const detail = buildDetail(meetingId);

    if (!detail) {
      renderStatus("該当する会議回が見つかりません。");
      document.getElementById("summaryArea").innerHTML = '<div class="empty">該当する会議回がありません。</div>';
      document.getElementById("calendarArea").innerHTML = '<div class="empty">表示対象がありません。</div>';
      document.getElementById("specialCommitteeArea").innerHTML = '<div class="empty">表示対象がありません。</div>';
      document.getElementById("itemsArea").innerHTML = '<div class="empty">表示対象がありません。</div>';
      return;
    }

    currentDetail = detail;

    renderStatus([
      "meeting_detail.html 読み込み成功",
      "meeting_id: " + detail.meeting_id,
      "calendar_events_integrated: " + detail.calendar_events_integrated.length + "件",
      "special_committees: " + detail.special_committees.length + "件",
      "item_patterns: " + detail.item_patterns.length + "件"
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
