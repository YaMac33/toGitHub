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

  function eventTypeLabel(value) {
    if (value === "PLENARY") return "本会議";
    if (value === "STEERING_COMMITTEE") return "議会運営委員会";
    if (value === "LEADERS_MEETING") return "会派代表者会議";
    return value || "";
  }

  function getMeetingById(meetingId) {
    return getArray("meetings").find(function (row) {
      return row.meeting_id === meetingId;
    }) || null;
  }

  function getEventTypeById(eventTypeId) {
    return getArray("event_types").find(function (row) {
      return row.event_type_id === eventTypeId;
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
        const at = a.start_time || "";
        const bt = b.start_time || "";
        return at < bt ? -1 : at > bt ? 1 : 0;
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
        const ar = a.role_name || "";
        const br = b.role_name || "";
        if (ar !== br) return ar < br ? -1 : 1;
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
      chunks.push(eventTypeLabel(row.event_type_id || ""));
    });

    instances.forEach(function (instance) {
      const specialCommittee = getSpecialCommitteeById(instance.special_committee_id);
      chunks.push(specialCommittee ? specialCommittee.special_committee_name : "");
      chunks.push(instance.established_date || "");
      chunks.push(instance.end_date || "");
      chunks.push(instance.note || "");
      chunks.push(instance.roster_file_path || "");

      getSpecialCommitteeMeetingsByInstanceId(instance.special_committee_instance_id).forEach(function (row) {
        chunks.push(row.meeting_date || "");
        chunks.push(row.note || "");
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

  function calcInclusiveDays(startDate, endDate) {
    if (!startDate || !endDate) return "";
    const start = new Date(startDate + "T00:00:00");
    const end = new Date(endDate + "T00:00:00");
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "";
    const diff = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
    return diff > 0 ? diff : "";
  }

  function buildDateBasedEvents(meetingId) {
    const normalEvents = getEventsByMeetingId(meetingId).map(function (row) {
      let displayLabel = "";
      let order = 999;

      if (row.event_type_id === "PLENARY") {
        displayLabel = "本会議";
        order = 1;
      } else if (row.event_type_id === "STEERING_COMMITTEE") {
        displayLabel = "議会運営委員会";
        order = 2;
      } else if (row.event_type_id === "LEADERS_MEETING") {
        displayLabel = "会派代表者会議";
        order = 3;
      } else {
        const committee = getCommitteeById(row.committee_id);
        displayLabel = committee ? committee.committee_name : "";
        order = 4;
      }

      return {
        event_date: row.event_date || "",
        sort_order_in_day: order,
        display_label: displayLabel,
        display_note: row.note || "",
        event_kind: "normal",
        source_id: row.event_id || ""
      };
    });

    const specialMeetingEvents = getSpecialCommitteeInstancesByMeetingId(meetingId)
      .flatMap(function (instance) {
        const specialCommittee = getSpecialCommitteeById(instance.special_committee_id);
        return getSpecialCommitteeMeetingsByInstanceId(instance.special_committee_instance_id).map(function (row) {
          return {
            event_date: row.meeting_date || "",
            sort_order_in_day: 5,
            display_label: specialCommittee ? specialCommittee.special_committee_name : "",
            display_note: row.note || "",
            event_kind: "special_committee_meeting",
            source_id: row.special_committee_meeting_id || ""
          };
        });
      });

    return normalEvents
      .concat(specialMeetingEvents)
      .sort(function (a, b) {
        const ad = a.event_date || "";
        const bd = b.event_date || "";
        if (ad !== bd) return ad < bd ? -1 : 1;
        if (a.sort_order_in_day !== b.sort_order_in_day) return a.sort_order_in_day - b.sort_order_in_day;
        const al = a.display_label || "";
        const bl = b.display_label || "";
        return al < bl ? -1 : al > bl ? 1 : 0;
      });
  }

  function groupDateBasedEvents(events) {
    const groups = [];
    events.forEach(function (row) {
      const last = groups.length ? groups[groups.length - 1] : null;
      if (!last || last.event_date !== row.event_date) {
        groups.push({
          event_date: row.event_date,
          items: [row]
        });
      } else {
        last.items.push(row);
      }
    });
    return groups;
  }

  function buildMeetingDetail(meetingId) {
    const meeting = getMeetingById(meetingId);
    if (!meeting) return null;

    const specialCommitteeInstances = getSpecialCommitteeInstancesByMeetingId(meetingId).map(function (instance) {
      const specialCommittee = getSpecialCommitteeById(instance.special_committee_id);
      const meetings = getSpecialCommitteeMeetingsByInstanceId(instance.special_committee_instance_id).map(function (m) {
        return {
          meeting_date: m.meeting_date || "",
          note: m.note || ""
        };
      });

      const members = getSpecialCommitteeMembersByInstanceId(instance.special_committee_instance_id).map(function (memberRow) {
        const member = getMemberById(memberRow.member_id);
        return {
          member_name: member ? member.member_name : memberRow.member_id,
          role_name: memberRow.role_name || ""
        };
      });

      return {
        special_committee_instance_id: instance.special_committee_instance_id || "",
        special_committee_name: specialCommittee ? specialCommittee.special_committee_name : "",
        established_date: instance.established_date || "",
        end_date: instance.end_date || "",
        note: instance.note || "",
        roster_file_path: instance.roster_file_path || "",
        meetings: meetings,
        members: members
      };
    });

    const dateBasedEvents = buildDateBasedEvents(meetingId);

    const steeringDates = getEventsByMeetingId(meetingId)
      .filter(function (row) {
        return row.event_type_id === "STEERING_COMMITTEE";
      })
      .map(function (row) {
        return row.event_date || "";
      });

    return {
      meeting_id: meeting.meeting_id || "",
      fiscal_year: meeting.fiscal_year || "",
      year: meeting.year || "",
      term_no: meeting.term_no || "",
      session_type: meeting.session_type || "",
      session_name: meeting.session_name || "",
      start_date: meeting.start_date || "",
      end_date: meeting.end_date || "",
      schedule_file_path: meeting.schedule_file_path || "",
      note: meeting.note || "",
      term_days: calcInclusiveDays(meeting.start_date, meeting.end_date),
      steering_dates: steeringDates,
      date_based_event_groups: groupDateBasedEvents(dateBasedEvents),
      special_committee_instances: specialCommitteeInstances
    };
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
      .concat(
        options.map(function (row) {
          return '<option value="' + escapeHtml(row.special_committee_id) + '">' +
            escapeHtml(row.special_committee_name) +
            "</option>";
        })
      )
      .join("");

    selectEl.innerHTML = html;
  }

  function renderTable(containerEl, rows) {
    if (!rows.length) {
      containerEl.innerHTML = '<div class="empty">該当データがありません。</div>';
      return;
    }

    const bodyHtml = rows.map(function (row) {
      const selectedClass = row.meeting_id === selectedMeetingId ? " selected-row" : "";
      return [
        '<tr class="clickable-row' + selectedClass + '" data-meeting-id="' + escapeHtml(row.meeting_id) + '">',
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

  function renderSimpleRows(rows) {
    if (!rows || rows.length === 0) {
      return '<div class="empty-small">データなし</div>';
    }
    return rows.map(function (row) {
      return '<div class="history-row">' + row + "</div>";
    }).join("");
  }

  function filterTexts(texts) {
    if (!currentKeyword) return texts;
    return texts.filter(function (text) {
      return String(text).toLowerCase().includes(currentKeyword.toLowerCase());
    });
  }

  function renderDateBasedGroups(groups) {
    if (!groups || groups.length === 0) {
      return '<div class="empty-small">データなし</div>';
    }

    const filteredGroups = groups
      .map(function (group) {
        const items = currentKeyword
          ? group.items.filter(function (item) {
              const source = [item.display_label || "", item.display_note || "", item.event_date || ""].join(" ").toLowerCase();
              return source.includes(currentKeyword.toLowerCase());
            })
          : group.items;

        return {
          event_date: group.event_date,
          items: items
        };
      })
      .filter(function (group) {
        return group.items.length > 0;
      });

    if (!filteredGroups.length) {
      return '<div class="empty-small">該当なし</div>';
    }

    return filteredGroups.map(function (group) {
      const itemsHtml = group.items.map(function (item) {
        return (
          '<div class="date-item">' +
            highlightText(item.display_label, currentKeyword) +
            (item.display_note
              ? '<div class="sub-note">' + highlightText(item.display_note, currentKeyword) + "</div>"
              : "") +
          "</div>"
        );
      }).join("");

      return (
        '<div class="date-group">' +
          '<div class="date-title">' + escapeHtml(toWareki(group.event_date)) + "</div>" +
          itemsHtml +
        "</div>"
      );
    }).join("");
  }

  function renderDetail(detailAreaEl, meetingId) {
    if (!meetingId) {
      detailAreaEl.innerHTML = '<div class="empty">一覧から会議回を選択すると詳細を表示します。</div>';
      return;
    }

    const detail = buildMeetingDetail(meetingId);
    if (!detail) {
      detailAreaEl.innerHTML = '<div class="empty">詳細データを取得できませんでした。</div>';
      return;
    }

    const steeringDateText = filterTexts(
      (detail.steering_dates || []).map(function (dateStr) {
        return toWareki(dateStr);
      })
    );

    const steeringDateLine = steeringDateText.length
      ? highlightText(steeringDateText.join("、"), currentKeyword)
      : "データなし";

    const specialCommitteeHtml = detail.special_committee_instances.length === 0
      ? '<div class="empty-small">データなし</div>'
      : detail.special_committee_instances.map(function (instance) {
          const meetingDateRows = filterTexts(
            (instance.meetings || []).map(function (row) {
              let text = toWareki(row.meeting_date);
              if (row.note) text += " / " + row.note;
              return text;
            })
          ).map(function (text) {
            return highlightText(text, currentKeyword);
          });

          const memberRows = filterTexts(
            (instance.members || []).map(function (row) {
              return row.role_name
                ? row.member_name + "（" + row.role_name + "）"
                : row.member_name;
            })
          ).map(function (text) {
            return highlightText(text, currentKeyword);
          });

          const rosterLinkHtml = instance.roster_file_path
            ? '<div class="link-line"><a href="' + escapeHtml(instance.roster_file_path) + '" target="_blank" rel="noopener noreferrer">名簿</a></div>'
            : '<div class="link-line">名簿: なし</div>';

          return (
            '<div class="detail-card detail-card-wide">' +
              "<h3>" + highlightText(instance.special_committee_name, currentKeyword) + "</h3>" +
              '<div class="history-row">設置日: ' + escapeHtml(toWareki(instance.established_date)) + "</div>" +
              '<div class="history-row">終了日: ' + escapeHtml(instance.end_date ? toWareki(instance.end_date) : "継続中") + "</div>" +
              rosterLinkHtml +
              (instance.note ? '<div class="history-row">備考: ' + highlightText(instance.note, currentKeyword) + "</div>" : "") +
              '<div class="detail-grid" style="margin-top:12px;">' +
                '<div class="detail-card">' +
                  "<h3>会議日</h3>" +
                  renderSimpleRows(meetingDateRows) +
                "</div>" +
                '<div class="detail-card">' +
                  "<h3>委員名簿</h3>" +
                  renderSimpleRows(memberRows) +
                "</div>" +
              "</div>" +
            "</div>"
          );
        }).join("");

    const scheduleLinkHtml = detail.schedule_file_path
      ? '<div class="link-line"><a href="' + escapeHtml(detail.schedule_file_path) + '" target="_blank" rel="noopener noreferrer">日程表</a></div>'
      : '<div class="link-line">日程表: なし</div>';

    detailAreaEl.innerHTML =
      '<div class="detail-header">' +
        '<div class="detail-title">' + highlightText(detail.session_name, currentKeyword) + "</div>" +
        '<div class="detail-subtitle">会議回ID: ' + escapeHtml(detail.meeting_id) + " / " + escapeHtml(sessionTypeLabel(detail.session_type)) + "</div>" +
      "</div>" +

      '<div class="detail-grid">' +
        '<div class="detail-card detail-card-wide">' +
          "<h3>会議回概要</h3>" +
          '<div class="history-row">会期: ' +
            escapeHtml(toWareki(detail.start_date)) + " ～ " + escapeHtml(toWareki(detail.end_date)) +
            (detail.term_days ? "（" + escapeHtml(String(detail.term_days)) + "日）" : "") +
          "</div>" +
          '<div class="history-row">議会運営委員会 開催日: ' + steeringDateLine + "</div>" +
          scheduleLinkHtml +
        "</div>" +

        '<div class="detail-card detail-card-wide">' +
          "<h3>日付ベース議会日程</h3>" +
          renderDateBasedGroups(detail.date_based_event_groups) +
        "</div>" +

        '<div class="detail-card detail-card-wide">' +
          "<h3>特別委員会</h3>" +
          specialCommitteeHtml +
        "</div>" +
      "</div>";
  }

  function bindRowEvents(resultArea, detailArea) {
    resultArea.querySelectorAll(".clickable-row").forEach(function (rowEl) {
      rowEl.addEventListener("click", function () {
        selectedMeetingId = rowEl.dataset.meetingId || "";
        renderTable(resultArea, currentRows);
        renderDetail(detailArea, selectedMeetingId);
        bindRowEvents(resultArea, detailArea);
      });
    });
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

      if (selectedMeetingId && !currentRows.some(function (row) { return row.meeting_id === selectedMeetingId; })) {
        selectedMeetingId = "";
      }

      resultMeta.textContent = currentRows.length + "件";
      renderTable(resultArea, currentRows);
      renderDetail(detailArea, selectedMeetingId);
      bindRowEvents(resultArea, detailArea);
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
