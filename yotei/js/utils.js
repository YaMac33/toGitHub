window.YoteiUtils = (function () {
  "use strict";

  function ensureAppData() {
    window.APP_DATA = window.APP_DATA || {};
    if (!Array.isArray(window.APP_DATA.events)) {
      window.APP_DATA.events = [];
    }
    if (!Array.isArray(window.APP_DATA.event_history)) {
      window.APP_DATA.event_history = [];
    }
  }

  function padNumber(value, width) {
    return String(value).padStart(width, "0");
  }

  function sanitizeText(value, fallback) {
    if (value === null || value === undefined) {
      return fallback || "";
    }
    return String(value);
  }

  function toNumber(value, fallback) {
    var parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : (fallback || 0);
  }

  function parseStoredDateTime(value) {
    if (!value) {
      return null;
    }

    if (value instanceof Date) {
      return new Date(value.getTime());
    }

    var text = String(value).trim();
    var dateMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateMatch) {
      return new Date(
        Number(dateMatch[1]),
        Number(dateMatch[2]) - 1,
        Number(dateMatch[3]),
        0,
        0,
        0,
        0
      );
    }

    var dateTimeMatch = text.match(
      /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/
    );
    if (dateTimeMatch) {
      return new Date(
        Number(dateTimeMatch[1]),
        Number(dateTimeMatch[2]) - 1,
        Number(dateTimeMatch[3]),
        Number(dateTimeMatch[4]),
        Number(dateTimeMatch[5]),
        Number(dateTimeMatch[6] || 0),
        0
      );
    }

    return null;
  }

  function formatDate(dateValue) {
    var date = parseStoredDateTime(dateValue);
    if (!date) {
      return "";
    }
    return [
      date.getFullYear(),
      padNumber(date.getMonth() + 1, 2),
      padNumber(date.getDate(), 2)
    ].join("-");
  }

  function formatTime(dateValue) {
    var date = parseStoredDateTime(dateValue);
    if (!date) {
      return "";
    }
    return padNumber(date.getHours(), 2) + ":" + padNumber(date.getMinutes(), 2);
  }

  function formatDateTime(dateValue) {
    var date = parseStoredDateTime(dateValue);
    if (!date) {
      return "";
    }
    return (
      formatDate(date) +
      " " +
      padNumber(date.getHours(), 2) +
      ":" +
      padNumber(date.getMinutes(), 2) +
      ":" +
      padNumber(date.getSeconds(), 2)
    );
  }

  function getCurrentTimestamp() {
    return formatDateTime(new Date());
  }

  function getDatePart(value) {
    if (!value) {
      return "";
    }
    if (String(value).indexOf("T") >= 0 || String(value).indexOf(" ") >= 0) {
      return formatDate(value);
    }
    return sanitizeText(value);
  }

  function shiftDate(dateText, offsetDays) {
    var base = parseStoredDateTime(getDatePart(dateText));
    if (!base) {
      return "";
    }
    base.setDate(base.getDate() + offsetDays);
    return formatDate(base);
  }

  function normalizeLocalDateTimeString(value) {
    var date = parseStoredDateTime(value);
    if (!date) {
      return "";
    }
    return (
      formatDate(date) +
      "T" +
      padNumber(date.getHours(), 2) +
      ":" +
      padNumber(date.getMinutes(), 2) +
      ":00"
    );
  }

  function toDateTimeLocalValue(value) {
    var date = parseStoredDateTime(value);
    if (!date) {
      return "";
    }
    return (
      formatDate(date) +
      "T" +
      padNumber(date.getHours(), 2) +
      ":" +
      padNumber(date.getMinutes(), 2)
    );
  }

  function buildStoredRange(startInput, endInput, allDay) {
    var startValue = sanitizeText(startInput).trim();
    var endValue = sanitizeText(endInput).trim();

    if (allDay) {
      var startDate = getDatePart(startValue);
      var endDate = endValue ? getDatePart(endValue) : startDate;
      return {
        start: startDate,
        end: shiftDate(endDate, 1)
      };
    }

    return {
      start: normalizeLocalDateTimeString(startValue),
      end: normalizeLocalDateTimeString(endValue || startValue)
    };
  }

  function formatEventPeriod(event) {
    if (!event) {
      return "";
    }

    if (event.allDay) {
      var startDate = getDatePart(event.start);
      var endExclusive = getDatePart(event.end || shiftDate(startDate, 1));
      var endInclusive = shiftDate(endExclusive, -1);
      if (!endInclusive || endInclusive === startDate) {
        return startDate + " 終日";
      }
      return startDate + " - " + endInclusive + " 終日";
    }

    var startDateTime = parseStoredDateTime(event.start);
    var endDateTime = parseStoredDateTime(event.end || event.start);
    if (!startDateTime || !endDateTime) {
      return "";
    }

    var startDateText = formatDate(startDateTime);
    var endDateText = formatDate(endDateTime);

    if (startDateText === endDateText) {
      return (
        startDateText +
        " " +
        formatTime(startDateTime) +
        "-" +
        formatTime(endDateTime)
      );
    }

    return (
      startDateText +
      " " +
      formatTime(startDateTime) +
      " - " +
      endDateText +
      " " +
      formatTime(endDateTime)
    );
  }

  function buildEventDisplayText(event) {
    if (!event) {
      return "";
    }

    var parts = [
      sanitizeText(event.title),
      formatEventPeriod(event)
    ];

    var location = sanitizeText(event.extendedProps && event.extendedProps.location);
    if (location) {
      parts.push(location);
    }

    return parts.join(" / ");
  }

  function escapeHtml(value) {
    return sanitizeText(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function generateNextId(items, keyName, prefix, width) {
    var maxValue = 0;
    (items || []).forEach(function (item) {
      var raw = sanitizeText(item && item[keyName]);
      var matched = raw.match(new RegExp("^" + prefix + "(\\d+)$"));
      if (!matched) {
        return;
      }
      maxValue = Math.max(maxValue, Number(matched[1]));
    });
    return prefix + padNumber(maxValue + 1, width);
  }

  function buildDiffText(beforeEvent, afterEvent) {
    var labels = {
      title: "タイトル",
      start: "開始",
      end: "終了",
      allDay: "終日",
      category: "カテゴリ",
      location: "場所",
      department: "担当部署",
      content: "内容",
      visibility: "公開レベル",
      importance: "重要度",
      note: "備考"
    };

    var beforeProps = (beforeEvent && beforeEvent.extendedProps) || {};
    var afterProps = (afterEvent && afterEvent.extendedProps) || {};

    var values = {
      title: [sanitizeText(beforeEvent && beforeEvent.title), sanitizeText(afterEvent && afterEvent.title)],
      start: [formatEventPeriod(beforeEvent), formatEventPeriod(afterEvent)],
      end: ["", ""],
      allDay: [beforeEvent && beforeEvent.allDay ? "はい" : "いいえ", afterEvent && afterEvent.allDay ? "はい" : "いいえ"],
      category: [sanitizeText(beforeProps.category), sanitizeText(afterProps.category)],
      location: [sanitizeText(beforeProps.location), sanitizeText(afterProps.location)],
      department: [sanitizeText(beforeProps.department), sanitizeText(afterProps.department)],
      content: [sanitizeText(beforeProps.content), sanitizeText(afterProps.content)],
      visibility: [sanitizeText(beforeProps.visibility), sanitizeText(afterProps.visibility)],
      importance: [String(toNumber(beforeProps.importance, 0)), String(toNumber(afterProps.importance, 0))],
      note: [sanitizeText(beforeProps.note), sanitizeText(afterProps.note)]
    };

    var diffLines = [];
    Object.keys(values).forEach(function (key) {
      if (key === "end") {
        return;
      }
      if (values[key][0] === values[key][1]) {
        return;
      }
      diffLines.push(labels[key] + ": " + (values[key][0] || "未設定") + " → " + (values[key][1] || "未設定"));
    });

    return diffLines.join("\n");
  }

  function getCategoryMeta(category) {
    var map = {
      "会議": { color: "#0f766e", bg: "#d6f2ed" },
      "来客": { color: "#b45309", bg: "#fde7c8" },
      "庁内業務": { color: "#1d4ed8", bg: "#dce7ff" },
      "現地対応": { color: "#9333ea", bg: "#efdefe" },
      "行事": { color: "#be123c", bg: "#ffd9e2" },
      "その他": { color: "#4b5563", bg: "#e5e7eb" }
    };
    return map[category] || map["その他"];
  }

  function getAppFolderName() {
    var path = window.location.pathname || "";
    var parts = path.split("/").filter(Boolean);
    if (parts.length >= 2) {
      return decodeURIComponent(parts[parts.length - 2]);
    }
    return "yotei";
  }

  function createDefaultDateRange(baseDate) {
    var date = parseStoredDateTime(baseDate || new Date());
    if (!date) {
      date = new Date();
    }
    date.setHours(9, 0, 0, 0);
    var end = new Date(date.getTime());
    end.setHours(end.getHours() + 1);
    return {
      allDay: false,
      startInput: toDateTimeLocalValue(date),
      endInput: toDateTimeLocalValue(end)
    };
  }

  return {
    ensureAppData: ensureAppData,
    sanitizeText: sanitizeText,
    toNumber: toNumber,
    parseStoredDateTime: parseStoredDateTime,
    formatDate: formatDate,
    formatTime: formatTime,
    formatDateTime: formatDateTime,
    getCurrentTimestamp: getCurrentTimestamp,
    getDatePart: getDatePart,
    shiftDate: shiftDate,
    normalizeLocalDateTimeString: normalizeLocalDateTimeString,
    toDateTimeLocalValue: toDateTimeLocalValue,
    buildStoredRange: buildStoredRange,
    formatEventPeriod: formatEventPeriod,
    buildEventDisplayText: buildEventDisplayText,
    escapeHtml: escapeHtml,
    deepClone: deepClone,
    generateNextId: generateNextId,
    buildDiffText: buildDiffText,
    getCategoryMeta: getCategoryMeta,
    getAppFolderName: getAppFolderName,
    createDefaultDateRange: createDefaultDateRange
  };
}());
