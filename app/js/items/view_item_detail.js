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

  function formatActionDateLabel(row) {
    if (row.action_type === "DECIDED") {
      return row.result_label ? (row.result_label + "日") : "議決日";
    }
    if (row.action_type === "CONTINUED") {
      return "継続審査決定日";
    }
    if (row.action_type === "WITHDRAWN") {
      return "取下げ日";
    }
    if (row.action_type === "REFERRED") {
      return "付託日";
    }
    if (row.action_type === "PROPOSED") {
      return row.item_class === "PETITION" || row.item_class === "REQUEST" ? "上程日" : "提案日";
    }
    return actionTypeLabel(row.action_type);
  }

  function getSortWeight(row) {
    const map = {
      PROPOSED: 1,
      REFERRED: 2,
      CONTINUED: 3,
      DECIDED: 4,
      WITHDRAWN: 5,
      REPORTED: 6
    };
    return map[row.action_type] || 99;
  }

  function buildNumberRangeLabel(items) {
    if (!items.length) return "";

    const labels = items
      .map(function (row) {
        return {
          no: row.item_no || "",
          num: Number(row.item_no_numeric || 0)
        };
      })
      .sort(function (a, b) {
        return a.num - b.num;
      });

    if (labels.length === 1) {
      return labels[0].no;
    }

    const allGian = labels.every(function (row) {
      return /^議案第\d+号$/.test(row.no);
    });

    if (allGian) {
      return "議案第" + labels[0].num + "号〜第" + labels[labels.length - 1].num + "号";
    }

    return labels.map(function (row) {
      return row.no;
    }).join("、");
  }

  function buildActionEvents(actions, item) {
    return actions.map(function (row) {
      return {
        action_id: row.action_id || "",
        action_type: row.action_type || "",
        result: row.result || "",
        result_label: row.result_label || "",
        action_date: row.action_date || "",
        note: row.note || "",
        meeting_id: row.meeting_id || "",
        event_id: row.event_id || "",
        item_id: row.item_id || "",
        item_no: item.item_no || "",
        item_no_numeric: item.item_no_numeric || 0,
        item_class: item.item_class || "",
        item_subclass: item.item_subclass || "",
        title: item.title || ""
      };
    });
  }

  function pickDate(events, type) {
    const row = events.find(function (event) {
      return event.action_type === type;
    });
    return row ? (row.action_date || "") : "";
  }

  function getFinalState(events) {
    if (events.some(function (row) { return row.action_type === "WITHDRAWN"; })) {
      return "WITHDRAWN";
    }
    if (events.some(function (row) { return row.action_type === "CONTINUED"; })) {
      return "CONTINUED";
    }
    if (events.some(function (row) { return row.action_type === "DECIDED"; })) {
      return "DECIDED";
    }
    return "";
  }

  function buildMeetingPatterns(item, actions) {
    const proposedRows = actions.filter(function (row) {
      return row.action_type === "PROPOSED";
    });

    const groupedMeetingIds = [...new Set(
      actions.map(function (row) { return row.meeting_id || ""; }).filter(Boolean)
    )];

    return groupedMeetingIds.map(function (meetingId) {
      const rows = actions
        .filter(function (row) {
          return row.meeting_id === meetingId;
        })
        .slice()
        .sort(function (a, b) {
          const ad = a.action_date || "";
          const bd = b.action_date || "";
          if (ad !== bd) return ad < bd ? -1 : 1;
          return getSortWeight(a) - getSortWeight(b);
        });

      const meeting = getMeetingById(meetingId);
      const proposedDate = pickDate(rows, "PROPOSED");
      const referredDate = pickDate(rows, "REFERRED");
      const decidedDate = pickDate(rows, "DECIDED");
      const continuedDate = pickDate(rows, "CONTINUED");
      const withdrawnDate = pickDate(rows, "WITHDRAWN");

      return {
        item_id: item.item_id || "",
        item_no: item.item_no || "",
        item_no_numeric: item.item_no_numeric || 0,
        item_class: item.item_class || "",
        title: item.title || "",
        meeting_id: meetingId,
        meeting_name: meeting ? (meeting.session_name || "") : meetingId,
        proposed_date: proposedDate,
        referred_date: referredDate,
        decided_date: decidedDate,
        continued_date: continuedDate,
        withdrawn_date: withdrawnDate,
        final_state: getFinalState(rows),
        actions: rows,
        all_proposed_dates: proposedRows.map(function (row) { return row.action_date || ""; })
      };
    });
  }

  function getStandardProposedDate(patterns) {
    const map = {};

    patterns.forEach(function (row) {
      if (!row.proposed_date) return;
      if (!map[row.proposed_date]) map[row.proposed_date] = 0;
      map[row.proposed_date] += 1;
    });

    let bestDate = "";
    let bestCount = -1;

    Object.keys(map).forEach(function (dateKey) {
      if (map[dateKey] > bestCount) {
        bestDate = dateKey;
        bestCount = map[dateKey];
      }
    });

    return bestDate;
  }

  function classifyPattern(pattern, standardProposedDate) {
    if (pattern.final_state === "WITHDRAWN") {
      return "withdrawn";
    }

    if (pattern.item_class === "PROPOSAL") {
      return "proposal_basic";
    }

    const isAdditional = !!pattern.proposed_date && !!standardProposedDate && pattern.proposed_date !== standardProposedDate;
    const hasReferred = !!pattern.referred_date;
    const hasDecided = !!pattern.decided_date;
    const hasContinued = !!pattern.continued_date;

    if (isAdditional && !hasReferred && hasDecided) {
      return "additional_fasttrack";
    }

    if (isAdditional && hasContinued) {
      return "additional_continued";
    }

    if (isAdditional) {
      return "additional";
    }

    if (!hasReferred && hasDecided) {
      return "fasttrack";
    }

    if (pattern.item_class === "PETITION" || pattern.item_class === "REQUEST") {
      return "petition_request";
    }

    return "basic_bill";
  }

  function buildPatternRows(item, actions) {
    const patterns = buildMeetingPatterns(item, actions);
    const standardProposedDate = getStandardProposedDate(patterns);

    return patterns.map(function (row) {
      row.pattern_type = classifyPattern(row, standardProposedDate);
      return row;
    });
  }

  function groupPatterns(patternRows) {
    const groups = {};

    patternRows.forEach(function (row) {
      const key = [
        row.pattern_type,
        row.proposed_date || "",
        row.referred_date || "",
        row.decided_date || "",
        row.continued_date || "",
        row.withdrawn_date || ""
      ].join("|");

      if (!groups[key]) {
        groups[key] = {
          pattern_type: row.pattern_type,
          proposed_date: row.proposed_date || "",
          referred_date: row.referred_date || "",
          decided_date: row.decided_date || "",
          continued_date: row.continued_date || "",
          withdrawn_date: row.withdrawn_date || "",
          items: []
        };
      }

      groups[key].items.push(row);
    });

    return Object.values(groups).map(function (group) {
      group.items.sort(function (a, b) {
        return Number(a.item_no_numeric || 0) - Number(b.item_no_numeric || 0);
      });
      return group;
    });
  }

  function getPatternGroupLabel(type) {
    const map = {
      basic_bill: "基本形（議案）",
      petition_request: "請願・陳情",
      proposal_basic: "発議案",
      fasttrack: "先議",
      additional: "追加議案",
      additional_fasttrack: "追加議案（先議）",
      additional_continued: "追加議案（継続審査）",
      withdrawn: "取下げ"
    };
    return map[type] || "その他";
  }

  function buildLinesForGroup(group) {
    const lines = [];

    if (group.proposed_date) {
      const label = group.items[0].item_class === "PETITION" || group.items[0].item_class === "REQUEST"
        ? "上程日"
        : "提案日";
      lines.push({ label: label, value: group.proposed_date });
    }

    if (group.referred_date) {
      lines.push({ label: "付託日", value: group.referred_date });
    }

    if (group.decided_date) {
      let decidedLabel = "議決日";

      const decidedLabels = [...new Set(
        group.items
          .map(function (row) {
            const decided = row.actions.find(function (action) {
              return action.action_type === "DECIDED";
            });
            return decided ? (decided.result_label || "") : "";
          })
          .filter(Boolean)
      )];

      if (decidedLabels.length === 1) {
        decidedLabel = decidedLabels[0] + "日";
      }

      lines.push({ label: decidedLabel, value: group.decided_date });
    }

    if (group.continued_date) {
      lines.push({ label: "継続審査決定日", value: group.continued_date });
    }

    if (group.withdrawn_date) {
      lines.push({ label: "取下げ日", value: group.withdrawn_date });
    }

    return lines;
  }

  function renderPatternBlock(title, groups) {
    if (!groups.length) return "";

    return (
      '<div class="pattern-block">' +
        '<div class="pattern-title">' + escapeHtml(title) + "</div>" +
        groups.map(function (group) {
          const lines = buildLinesForGroup(group);
          const numberLabel = buildNumberRangeLabel(group.items);

          return (
            '<div class="pattern-item">' +
              '<div class="pattern-item-title">' + escapeHtml(numberLabel) + ":</div>" +
              lines.map(function (line) {
                return '<div class="history-row"><span class="summary-label">' +
                  escapeHtml(line.label) +
                  "</span>" +
                  escapeHtml(toWareki(line.value)) +
                  "</div>";
              }).join("") +
            "</div>"
          );
        }).join("") +
      "</div>"
    );
  }

  function buildCalendarEvents(patternRows) {
    const calendarEvents = [];

    patternRows.forEach(function (pattern) {
      const itemLabel = pattern.item_no || "";

      if (pattern.proposed_date) {
        calendarEvents.push({
          date: pattern.proposed_date,
          css: "proposed",
          text: (pattern.item_class === "PETITION" || pattern.item_class === "REQUEST" ? "上程" : "提案") + "（" + itemLabel + "）"
        });
      }

      if (pattern.referred_date) {
        calendarEvents.push({
          date: pattern.referred_date,
          css: "referred",
          text: "付託（" + itemLabel + "）"
        });
      }

      if (pattern.decided_date) {
        const decided = pattern.actions.find(function (action) {
          return action.action_type === "DECIDED";
        });
        calendarEvents.push({
          date: pattern.decided_date,
          css: "decided",
          text: (decided && decided.result_label ? decided.result_label : "議決") + "（" + itemLabel + "）"
        });
      }

      if (pattern.continued_date) {
        calendarEvents.push({
          date: pattern.continued_date,
          css: "continued",
          text: "継続審査（" + itemLabel + "）"
        });
      }

      if (pattern.withdrawn_date) {
        calendarEvents.push({
          date: pattern.withdrawn_date,
          css: "withdrawn",
          text: "取下げ（" + itemLabel + "）"
        });
      }
    });

    return calendarEvents.sort(function (a, b) {
      return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
    });
  }

  function buildCalendarMonths(dates) {
    if (!dates.length) return [];
    const sorted = dates.slice().sort();
    const start = new Date(sorted[0] + "T00:00:00");
    const end = new Date(sorted[sorted.length - 1] + "T00:00:00");

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

  function groupCalendarEventsByDate(events) {
    const map = {};
    events.forEach(function (row) {
      if (!map[row.date]) map[row.date] = [];
      map[row.date].push(row);
    });
    return map;
  }

  function renderCalendar(patternRows) {
    const calendarArea = document.getElementById("calendarArea");
    const events = buildCalendarEvents(patternRows);

    if (!events.length) {
      calendarArea.innerHTML = '<div class="empty">カレンダー表示対象がありません。</div>';
      return;
    }

    const eventMap = groupCalendarEventsByDate(events);
    const months = buildCalendarMonths(events.map(function (row) { return row.date; }));
    const weekdayLabels = ["日", "月", "火", "水", "木", "金", "土"];

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

        const dayEvents = eventMap[dateStr] || [];
        const visibleItems = dayEvents.slice(0, 3);
        const hiddenCount = dayEvents.length - visibleItems.length;

        const itemHtml = visibleItems.map(function (item) {
          return '<div class="calendar-item ' + escapeHtml(item.css) + '">' + escapeHtml(item.text) + "</div>";
        }).join("");

        const moreHtml = hiddenCount > 0
          ? '<div class="calendar-more">+' + escapeHtml(String(hiddenCount)) + "件</div>"
          : "";

        const hasEventsClass = dayEvents.length ? " has-events" : "";

        cells.push(
          '<div class="calendar-cell' + hasEventsClass + '">' +
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
  }

  function renderPatterns(item, actions) {
    const area = document.getElementById("actionsArea");

    if (!actions.length) {
      area.innerHTML = '<div class="empty">アクション履歴がありません。</div>';
      return [];
    }

    const patternRows = buildPatternRows(item, actions);
    const grouped = groupPatterns(patternRows);

    const basicBillGroups = grouped.filter(function (row) { return row.pattern_type === "basic_bill"; });
    const petitionRequestGroups = grouped.filter(function (row) { return row.pattern_type === "petition_request"; });
    const proposalGroups = grouped.filter(function (row) { return row.pattern_type === "proposal_basic"; });

    const exceptionGroups = grouped.filter(function (row) {
      return ["fasttrack", "additional", "additional_fasttrack", "additional_continued", "withdrawn"].includes(row.pattern_type);
    });

    let html = "";
    html += renderPatternBlock("基本形（議案）", basicBillGroups);
    html += renderPatternBlock("請願・陳情", petitionRequestGroups);
    html += renderPatternBlock("発議案", proposalGroups);

    if (exceptionGroups.length) {
      html += '<div class="pattern-block">';
      html += '<div class="pattern-title">例外</div>';

      ["fasttrack", "additional", "additional_fasttrack", "additional_continued", "withdrawn"].forEach(function (type) {
        const rows = exceptionGroups.filter(function (row) {
          return row.pattern_type === type;
        });
        if (!rows.length) return;

        html += '<div class="pattern-item">';
        html += '<div class="pattern-item-title">▼ ' + escapeHtml(getPatternGroupLabel(type)) + "</div>";

        rows.forEach(function (group) {
          const lines = buildLinesForGroup(group);
          const numberLabel = buildNumberRangeLabel(group.items);

          html += '<div class="pattern-item">';
          html += '<div class="pattern-item-title">' + escapeHtml(numberLabel) + ":</div>";
          html += lines.map(function (line) {
            return '<div class="history-row"><span class="summary-label">' +
              escapeHtml(line.label) +
              "</span>" +
              escapeHtml(toWareki(line.value)) +
              "</div>";
          }).join("");
          html += "</div>";
        });

        html += "</div>";
      });

      html += "</div>";
    }

    area.innerHTML = html || '<div class="empty">表示対象がありません。</div>';

    return patternRows;
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
      document.getElementById("calendarArea").innerHTML = '<div class="empty">該当案件がありません。</div>';
      return;
    }

    const actions = getArray("item_actions")
      .filter(function (row) {
        return row.item_id === itemId;
      })
      .slice()
      .sort(function (a, b) {
        const ad = a.action_date || "";
        const bd = b.action_date || "";
        if (ad !== bd) return ad < bd ? -1 : 1;
        return getSortWeight(a) - getSortWeight(b);
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
      '<div class="summary-item summary-item-wide"><span class="summary-label">概要</span>' + escapeHtml(item.summary || "") + "</div>" +
      '<div class="summary-item summary-item-wide"><span class="summary-label">備考</span>' + escapeHtml(item.note || "") + "</div>";

    const patternRows = renderPatterns(item, actions);
    renderCalendar(patternRows);
  }

  return {
    init: init
  };
})();

document.addEventListener("DOMContentLoaded", function () {
  window.ITEM_DETAIL_VIEW.init();
});
