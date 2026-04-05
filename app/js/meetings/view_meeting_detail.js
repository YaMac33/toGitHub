window.APP_DATA = window.APP_DATA || {};

window.MEETING_DETAIL_VIEW = (function () {
  "use strict";

  const SPECIAL_CODES = ["IKY", "TKY", "IKK", "TKK"];
  const ITEM_CATEGORY_ORDER = { GI: 1, SG: 2, CJ: 2, HG: 3 };
  const PRIMARY_EXCEPTION_PRIORITY = [
    "追加議案",
    "先議",
    "修正案あり",
    "履歴あり",
    "通常外付託"
  ];

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
    if (!normalized) return "—";

    const parts = normalized.split("-");
    const y = Number(parts[0]);
    const m = Number(parts[1]);
    const d = Number(parts[2]);

    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return "—";

    if (y >= 2019) {
      return "令和" + (y - 2018) + "年" + m + "月" + d + "日";
    }
    if (y >= 1989) {
      return "平成" + (y - 1988) + "年" + m + "月" + d + "日";
    }
    if (y >= 1926) {
      return "昭和" + (y - 1925) + "年" + m + "月" + d + "日";
    }

    return y + "年" + m + "月" + d + "日";
  }

  function isInsidePeriodType(value) {
    return String(value || "").trim() === "内";
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

  function getItemsSource() {
    return Array.isArray(window.APP_DATA.items) ? window.APP_DATA.items : [];
  }

  function toSafeNumber(value) {
    const text = String(value == null ? "" : value).trim();
    if (!text) return 0;
    const num = Number(text);
    return Number.isFinite(num) ? num : 0;
  }

  function itemCategoryOrder(categoryKey) {
    return ITEM_CATEGORY_ORDER[String(categoryKey || "")] || 99;
  }

  function getItemsByMeetingId(meetingId) {
    return getItemsSource()
      .filter(function (row) {
        return String(row.meeting_id || "") === String(meetingId || "");
      })
      .sort(function (a, b) {
        const ao = itemCategoryOrder(a.item_class);
        const bo = itemCategoryOrder(b.item_class);
        if (ao !== bo) return ao - bo;

        const an = toSafeNumber(a.item_no_numeric);
        const bn = toSafeNumber(b.item_no_numeric);
        if (an !== bn) return an - bn;

        const aso = Number(a.sort_order || 0);
        const bso = Number(b.sort_order || 0);
        if (aso !== bso) return aso - bso;

        const aid = String(a.item_id || "");
        const bid = String(b.item_id || "");
        return aid < bid ? -1 : aid > bid ? 1 : 0;
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
    if (ac !== bc) return ac < bc ? -1 : ac > bc ? 1 : 0;

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
      if (a.date !== b.date) return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
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

  function getPlenaryDates(rows) {
    return rows
      .filter(function (row) {
        return String(row.meeting_type_code || "").trim() === "HNKG";
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

  function buildItemReferenceDates(meetingRows, questionRows) {
    const plenaryDates = getPlenaryDates(meetingRows);
    const questionLastDate = questionRows.reduce(function (max, row) {
      const d = normalizeDate(row.question_date);
      if (!d) return max;
      if (!max || d > max) return d;
      return max;
    }, "");

    const petitionCandidates = plenaryDates.filter(function (d) {
      return questionLastDate && d < questionLastDate;
    });

    return {
      plenary_dates: plenaryDates,
      plenary_first_date: plenaryDates[0] || "",
      plenary_second_date: plenaryDates[1] || "",
      plenary_last_date: plenaryDates.length ? plenaryDates[plenaryDates.length - 1] : "",
      question_last_date: questionLastDate,
      petition_standard_date: petitionCandidates.length ? petitionCandidates[petitionCandidates.length - 1] : ""
    };
  }

  function buildItemDisplayMeta(item) {
    const categoryKey = String(item.item_class || "").trim();
    const displayNumber = toSafeNumber(item.item_no_numeric);

    let categoryLabel = "";
    let displayLabel = "";

    if (categoryKey === "GI") {
      categoryLabel = "議案";
      displayLabel = "議案第" + displayNumber + "号";
    } else if (categoryKey === "SG") {
      categoryLabel = "請願";
      displayLabel = "受理番号第" + displayNumber + "号";
    } else if (categoryKey === "CJ") {
      categoryLabel = "陳情";
      displayLabel = "受理番号第" + displayNumber + "号";
    } else if (categoryKey === "HG") {
      categoryLabel = "発議案";
      displayLabel = "発議案第" + displayNumber + "号";
    } else {
      categoryLabel = categoryKey || "その他";
      displayLabel = String(item.item_no || "").trim() || ("第" + displayNumber + "号");
    }

    return {
      category_key: categoryKey,
      category_label: categoryLabel,
      display_number: displayNumber,
      display_label: displayLabel
    };
  }

  function isFlagOn(value) {
    const text = String(value == null ? "" : value).trim();
    return text === "1" || text.toLowerCase() === "true";
  }

  function pickPrimaryExceptionTag(tags) {
    const unique = tags.filter(function (tag, index, arr) {
      return tag && arr.indexOf(tag) === index;
    });

    for (let i = 0; i < PRIMARY_EXCEPTION_PRIORITY.length; i += 1) {
      if (unique.indexOf(PRIMARY_EXCEPTION_PRIORITY[i]) >= 0) {
        return PRIMARY_EXCEPTION_PRIORITY[i];
      }
    }
    return unique[0] || "";
  }

  function classifySingleMeetingItem(item, referenceDates) {
    const meta = buildItemDisplayMeta(item);
    const categoryKey = meta.category_key;
    const teianDate = normalizeDate(item.teian_date);
    const futakuDate = normalizeDate(item.futaku_date);
    const giketsuDate = normalizeDate(item.giketsu_date);
    const exceptionTags = [];

    if (categoryKey === "GI") {
      if (
        teianDate &&
        referenceDates.plenary_first_date &&
        teianDate !== referenceDates.plenary_first_date
      ) {
        exceptionTags.push("追加議案");
      }
      if (
        giketsuDate &&
        referenceDates.plenary_last_date &&
        giketsuDate < referenceDates.plenary_last_date
      ) {
        exceptionTags.push("先議");
      }
      if (
        futakuDate &&
        referenceDates.plenary_second_date &&
        futakuDate !== referenceDates.plenary_second_date
      ) {
        exceptionTags.push("通常外付託");
      }
    } else if (categoryKey === "SG" || categoryKey === "CJ") {
      if (
        futakuDate &&
        referenceDates.petition_standard_date &&
        futakuDate !== referenceDates.petition_standard_date
      ) {
        exceptionTags.push("通常外付託");
      }
      if (
        giketsuDate &&
        referenceDates.plenary_last_date &&
        giketsuDate < referenceDates.plenary_last_date
      ) {
        exceptionTags.push("先議");
      }
    } else if (categoryKey === "HG") {
      if (
        teianDate &&
        referenceDates.plenary_last_date &&
        teianDate !== referenceDates.plenary_last_date
      ) {
        exceptionTags.push("追加議案");
      }
      if (
        giketsuDate &&
        referenceDates.plenary_last_date &&
        giketsuDate < referenceDates.plenary_last_date
      ) {
        exceptionTags.push("先議");
      }
    }

    if (isFlagOn(item.syuseian_flag)) {
      exceptionTags.push("修正案あり");
    }
    if (isFlagOn(item.rireki_flag)) {
      exceptionTags.push("履歴あり");
    }

    const uniqueTags = exceptionTags.filter(function (tag, index, arr) {
      return tag && arr.indexOf(tag) === index;
    });

    return {
      item: item,
      meta: meta,
      is_normal: uniqueTags.length === 0,
      exception_tags: uniqueTags,
      primary_exception_tag: pickPrimaryExceptionTag(uniqueTags)
    };
  }

  function classifyMeetingItems(itemRows, referenceDates) {
    return itemRows.map(function (item) {
      return classifySingleMeetingItem(item, referenceDates);
    });
  }

  function uniqueSortedNumbers(items) {
    const seen = {};
    return items
      .map(function (row) {
        return toSafeNumber(row.meta && row.meta.display_number);
      })
      .filter(function (num) {
        return Number.isFinite(num) && num > 0;
      })
      .sort(function (a, b) {
        return a - b;
      })
      .filter(function (num) {
        if (seen[num]) return false;
        seen[num] = true;
        return true;
      });
  }

  function compressRanges(numbers) {
    if (!numbers.length) return [];

    const ranges = [];
    let start = numbers[0];
    let end = numbers[0];

    for (let i = 1; i < numbers.length; i += 1) {
      const current = numbers[i];
      if (current === end + 1) {
        end = current;
      } else {
        ranges.push({ start: start, end: end });
        start = current;
        end = current;
      }
    }

    ranges.push({ start: start, end: end });
    return ranges;
  }

  function formatCompressedLabels(numbers, categoryKey) {
    const ranges = compressRanges(numbers);

    return ranges.map(function (range) {
      if (categoryKey === "GI") {
        return range.start === range.end
          ? "議案第" + range.start + "号"
          : "議案第" + range.start + "号〜第" + range.end + "号";
      }
      if (categoryKey === "SG" || categoryKey === "CJ" || categoryKey === "PETITION") {
        return range.start === range.end
          ? "受理番号第" + range.start + "号"
          : "受理番号第" + range.start + "号〜第" + range.end + "号";
      }
      if (categoryKey === "HG") {
        return range.start === range.end
          ? "発議案第" + range.start + "号"
          : "発議案第" + range.start + "号〜第" + range.end + "号";
      }
      return range.start === range.end
        ? "第" + range.start + "号"
        : "第" + range.start + "号〜第" + range.end + "号";
    }).join("、");
  }

  function compressDisplayNumbers(items, categoryKey) {
    const numbers = uniqueSortedNumbers(items);
    if (!numbers.length) return "";
    return formatCompressedLabels(numbers, categoryKey);
  }

  function buildNormalItemGroups(classifiedItems, referenceDates) {
    const billItems = classifiedItems.filter(function (row) {
      return row.is_normal && row.meta.category_key === "GI";
    });

    const petitionItems = classifiedItems.filter(function (row) {
      return row.is_normal && (row.meta.category_key === "SG" || row.meta.category_key === "CJ");
    });

    const motionItems = classifiedItems.filter(function (row) {
      return row.is_normal && row.meta.category_key === "HG";
    });

    const groups = [];

    if (billItems.length) {
      groups.push({
        label: "議案",
        text: compressDisplayNumbers(billItems, "GI"),
        details: [
          "提案日 " + formatDateJa(referenceDates.plenary_first_date),
          "付託日 " + formatDateJa(referenceDates.plenary_second_date),
          "議決日 " + formatDateJa(referenceDates.plenary_last_date)
        ]
      });
    }

    if (petitionItems.length) {
      groups.push({
        label: "請願・陳情",
        text: compressDisplayNumbers(petitionItems, "PETITION"),
        details: [
          "上程・付託日 " + formatDateJa(referenceDates.petition_standard_date),
          "議決日 " + formatDateJa(referenceDates.plenary_last_date)
        ]
      });
    }

    if (motionItems.length) {
      groups.push({
        label: "発議案",
        text: compressDisplayNumbers(motionItems, "HG"),
        details: [
          "提案日 " + formatDateJa(referenceDates.plenary_last_date),
          "議決日 " + formatDateJa(referenceDates.plenary_last_date)
        ]
      });
    }

    return groups;
  }

  function getResultLabel(code) {
    const map = {
      KK: "可決",
      HK: "否決",
      DO: "同意",
      TK: "適任",
      SN: "承認",
      NT: "認定",
      ST: "採択",
      SS: "採択送付",
      FS: "不採択",
      KZ: "継続",
      TS: "取下げ"
    };
    return map[String(code || "").trim().toUpperCase()] || String(code || "");
  }

  function getCommitteeLastHeldDate(meetingRows, meetingId, committeeId) {
    const dates = meetingRows
      .filter(function (row) {
        return String(row.meeting_id || "") === String(meetingId || "") &&
          String(row.meeting_type_code || "") === String(committeeId || "");
      })
      .map(function (row) {
        return normalizeDate(row.held_date);
      })
      .filter(Boolean)
      .sort();

    return dates.length ? dates[dates.length - 1] : "";
  }

  function buildExceptionItemDetails(classifiedRow, detailContext) {
    const item = classifiedRow.item;
    const type = classifiedRow.primary_exception_tag;
    const teianDate = normalizeDate(item.teian_date);
    const futakuDate = normalizeDate(item.futaku_date);
    const giketsuDate = normalizeDate(item.giketsu_date);
    const committeeName = String(item.committee_name || "");
    const committeeLastDate = getCommitteeLastHeldDate(
      detailContext.meeting_rows,
      item.meeting_id,
      item.committee_id
    );

    if (type === "追加議案") {
      return [
        "提案日 " + formatDateJa(teianDate)
      ];
    }

    if (type === "先議") {
      return [
        "議決日 " + formatDateJa(giketsuDate)
      ];
    }

    if (type === "修正案あり") {
      const lines = [
        "提出委員会 " + (committeeName || "—")
      ];
      if (committeeLastDate) {
        lines.push("開催日 " + formatDateJa(committeeLastDate));
      }
      lines.push("本会議提案日 " + formatDateJa(teianDate));
      lines.push("議決日 " + formatDateJa(giketsuDate));
      return lines;
    }

    if (type === "履歴あり") {
      return [
        "議決日 " + formatDateJa(giketsuDate)
      ];
    }

    if (type === "通常外付託") {
      return [
        "付託日 " + formatDateJa(futakuDate)
      ];
    }

    return [];
  }

  function buildExceptionItemGroups(classifiedItems, detailContext) {
    const grouped = {};

    classifiedItems.forEach(function (row) {
      if (row.is_normal) return;

      const tag = row.primary_exception_tag;
      const itemId = String(row.item && row.item.item_id || "");
      if (!tag || !itemId) return;

      if (!grouped[tag]) {
        grouped[tag] = {
          label: tag,
          items: [],
          seen: {}
        };
      }

      if (!grouped[tag].seen[itemId]) {
        grouped[tag].seen[itemId] = true;
        grouped[tag].items.push({
          label: row.meta.display_label,
          details: buildExceptionItemDetails(row, detailContext),
          sort_group: itemCategoryOrder(row.meta.category_key),
          sort_no: toSafeNumber(row.meta.display_number)
        });
      }
    });

    return PRIMARY_EXCEPTION_PRIORITY.map(function (tag) {
      const group = grouped[tag];
      if (!group || !group.items.length) return null;

      group.items.sort(function (a, b) {
        if (a.sort_group !== b.sort_group) return a.sort_group - b.sort_group;
        return a.sort_no - b.sort_no;
      });

      return group;
    }).filter(Boolean);
  }

  function buildLinkedItemCards(classifiedItems) {
    return classifiedItems
      .slice()
      .sort(function (a, b) {
        const ao = itemCategoryOrder(a.meta.category_key);
        const bo = itemCategoryOrder(b.meta.category_key);
        if (ao !== bo) return ao - bo;

        const an = toSafeNumber(a.meta.display_number);
        const bn = toSafeNumber(b.meta.display_number);
        if (an !== bn) return an - bn;

        const aso = Number(a.item.sort_order || 0);
        const bso = Number(b.item.sort_order || 0);
        if (aso !== bso) return aso - bso;

        const aid = String(a.item.item_id || "");
        const bid = String(b.item.item_id || "");
        return aid < bid ? -1 : aid > bid ? 1 : 0;
      })
      .map(function (row) {
        const item = row.item;
        return {
          display_label: row.meta.display_label,
          title: String(item.title || ""),
          committee_name: String(item.committee_name || ""),
          result_label: getResultLabel(item.result_code),
          teian_date: normalizeDate(item.teian_date),
          futaku_date: normalizeDate(item.futaku_date),
          giketsu_date: normalizeDate(item.giketsu_date),
          exception_text: row.exception_tags.length ? row.exception_tags.join("、") : ""
        };
      });
  }

  function buildMeetingItemsViewModel(classifiedItems, detailContext) {
    return {
      normal_groups: buildNormalItemGroups(classifiedItems, detailContext.item_reference_dates),
      exception_groups: buildExceptionItemGroups(classifiedItems, detailContext),
      linked_cards: buildLinkedItemCards(classifiedItems)
    };
  }

  function buildDetail(meetingId) {
    const meetingRows = getMeetingRowsByMeetingId(meetingId);
    if (!meetingRows.length) return null;

    const first = meetingRows[0];
    const questionRows = getQuestionsByMeetingId(meetingId);
    const specialCommitteeMembers = getSpecialCommitteeMembersByMeetingId(meetingId);
    const itemRows = getItemsByMeetingId(meetingId);

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

    const itemReferenceDates = buildItemReferenceDates(meetingRows, questionRows);
    const itemClassifiedRows = classifyMeetingItems(itemRows, itemReferenceDates);

    const detailContext = {
      meeting_rows: meetingRows,
      item_reference_dates: itemReferenceDates
    };

    const itemViewModel = buildMeetingItemsViewModel(itemClassifiedRows, detailContext);

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
      special_committees: specialCommittees,
      item_rows: itemRows,
      item_reference_dates: itemReferenceDates,
      item_classified_rows: itemClassifiedRows,
      item_view_model: itemViewModel
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

  function renderItems(detail) {
    const area = document.getElementById("itemsArea");
    if (!area) return;

    const viewModel = detail && detail.item_view_model ? detail.item_view_model : null;
    if (!viewModel || !detail.item_rows || !detail.item_rows.length) {
      area.innerHTML = '<div class="empty">案件データがありません。</div>';
      return;
    }

    const normalHtml = viewModel.normal_groups.length
      ? (
          '<div class="detail-subcard">' +
            '<h3>通常</h3>' +
            viewModel.normal_groups.map(function (group) {
              return (
                '<div class="history-row" style="margin-bottom:12px;">' +
                  '<span class="summary-label">' + escapeHtml(group.label) + "</span>" +
                  '<div style="display:inline-block;">' +
                    '<div>' + escapeHtml(group.text) + '</div>' +
                    '<div style="margin-top:4px;color:#6b7280;font-size:13px;">' +
                      group.details.map(function (line) {
                        return '<div>' + escapeHtml(line) + '</div>';
                      }).join("") +
                    '</div>' +
                  '</div>' +
                "</div>"
              );
            }).join("") +
          "</div>"
        )
      : "";

    const exceptionHtml = viewModel.exception_groups.length
      ? (
          '<div class="detail-subcard" style="margin-top:12px;">' +
            '<h3>例外</h3>' +
            viewModel.exception_groups.map(function (group) {
              return (
                '<div class="history-row" style="margin-bottom:12px;">' +
                  '<span class="summary-label">' + escapeHtml(group.label) + "</span>" +
                  '<div style="display:inline-block;">' +
                    group.items.map(function (item) {
                      return (
                        '<div style="margin-bottom:10px;">' +
                          '<div>' + escapeHtml(item.label) + '</div>' +
                          (
                            item.details.length
                              ? '<div style="margin-top:4px;color:#6b7280;font-size:13px;">' +
                                  item.details.map(function (line) {
                                    return '<div>' + escapeHtml(line) + '</div>';
                                  }).join("") +
                                '</div>'
                              : ''
                          ) +
                        '</div>'
                      );
                    }).join("") +
                  '</div>' +
                '</div>'
              );
            }).join("") +
          "</div>"
        )
      : "";

    const linkedCardsHtml = viewModel.linked_cards.length
      ? (
          '<details class="linked-items-details" style="margin-top:12px;">' +
            '<summary>該当案件</summary>' +
            '<div class="linked-items-body">' +
              '<div class="linked-items-list">' +
                viewModel.linked_cards.map(function (card) {
                  return (
                    '<div class="linked-item-card">' +
                      '<div class="linked-item-main">' + escapeHtml(card.display_label) + '</div>' +
                      '<div class="linked-item-meta">' +
                        '<div class="linked-item-meta-line">件名：' + escapeHtml(card.title) + '</div>' +
                        '<div class="linked-item-meta-line">付託委員会：' + escapeHtml(card.committee_name || "—") + '</div>' +
                        '<div class="linked-item-meta-line">議決結果：' + escapeHtml(card.result_label || "—") + '</div>' +
                        '<div class="linked-item-meta-line">提案日：' + escapeHtml(formatDateJa(card.teian_date)) + '</div>' +
                        '<div class="linked-item-meta-line">付託日：' + escapeHtml(formatDateJa(card.futaku_date)) + '</div>' +
                        '<div class="linked-item-meta-line">議決日：' + escapeHtml(formatDateJa(card.giketsu_date)) + '</div>' +
                        (
                          card.exception_text
                            ? '<div class="linked-item-meta-line">例外：' + escapeHtml(card.exception_text) + '</div>'
                            : ''
                        ) +
                      '</div>' +
                    '</div>'
                  );
                }).join("") +
              '</div>' +
            '</div>' +
          '</details>'
        )
      : '';

    area.innerHTML =
      '<div class="detail-subcard">' +
        '<h3>案件</h3>' +
        normalHtml +
        exceptionHtml +
        linkedCardsHtml +
      '</div>';
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
      "view_meeting_detail.js 読み込み成功",
      "meeting_id: " + detail.meeting_id,
      "meeting_rows: " + detail.meeting_rows.length + "件",
      "meeting_rows_in_term: " + detail.meeting_rows_in_term.length + "件",
      "meeting_rows_calendar_target: " + detail.meeting_rows_calendar_target.length + "件",
      "question_rows: " + detail.question_rows.length + "件",
      "calendar_events_integrated: " + detail.calendar_events_integrated.length + "件",
      "special_committees: " + detail.special_committees.length + "件",
      "item_rows: " + detail.item_rows.length + "件",
      "item_normal_groups: " + detail.item_view_model.normal_groups.length + "件",
      "item_exception_groups: " + detail.item_view_model.exception_groups.length + "件",
      "petition_standard_date: " + (detail.item_reference_dates.petition_standard_date || "")
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
