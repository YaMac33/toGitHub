(function () {
  "use strict";

  window.APP_FORMATTERS = window.APP_FORMATTERS || {};

  function toWareki(dateStr) {
    if (!dateStr) return "";

    const d = new Date(dateStr + "T00:00:00");
    if (Number.isNaN(d.getTime())) return String(dateStr);

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

    return eraName + (eraYear === 1 ? "元" : String(eraYear)) + "年" + m + "月" + day + "日";
  }

  function formatPeriod(startDate, endDate) {
    if (!startDate && !endDate) return "";
    return toWareki(startDate || "") + " ～ " + (endDate ? toWareki(endDate) : "継続中");
  }

  function visibilityLabel(code) {
    switch (String(code || "").trim()) {
      case "PRIVATE":
        return "非公開";
      case "SECRETARIAT":
        return "事務局まで";
      case "STAFF":
        return "職員まで";
      case "CITIZEN":
        return "市民まで";
      default:
        return "";
    }
  }

  function sessionTypeLabel(value) {
    if (value === "REGULAR") return "定例会";
    if (value === "EXTRA") return "臨時会";
    return value || "";
  }

  function formatDurationHours(value) {
    if (value == null || value === "") return "";

    const num = Number(value);
    if (!Number.isFinite(num)) return String(value);

    const totalMinutes = Math.round(num * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return hours + "時間" + minutes + "分";
  }

  function itemClassLabel(value) {
    if (value === "BILL") return "議案";
    if (value === "PROPOSAL") return "発議案";
    if (value === "PETITION") return "請願";
    if (value === "REQUEST") return "陳情";
    return value || "";
  }

  function itemSubclassLabel(value) {
    const map = {
      ORDINANCE: "条例",
      BUDGET: "予算",
      SETTLEMENT: "決算",
      CONTRACT: "契約",
      PERSONNEL: "人事",
      PROPERTY: "財産",
      SPECIAL_DECISION: "専決処分",
      OPINION: "意見書",
      RESOLUTION: "決議",
      GENERAL: "一般",
      OTHER: "その他"
    };
    return map[value] || value || "";
  }

  function actionTypeLabel(value) {
    const map = {
      PROPOSED: "提案",
      REFERRED: "付託",
      REPORTED: "報告",
      CONTINUED: "継続審査",
      WITHDRAWN: "取下げ",
      DECIDED: "最終結果"
    };
    return map[value] || value || "";
  }

  function resultLabel(value) {
    const map = {
      NONE: "結果なし",
      PASSED: "通った",
      REJECTED: "通らなかった"
    };
    return map[value] || value || "";
  }

  window.APP_FORMATTERS.toWareki = toWareki;
  window.APP_FORMATTERS.formatPeriod = formatPeriod;
  window.APP_FORMATTERS.visibilityLabel = visibilityLabel;
  window.APP_FORMATTERS.sessionTypeLabel = sessionTypeLabel;
  window.APP_FORMATTERS.formatDurationHours = formatDurationHours;
  window.APP_FORMATTERS.itemClassLabel = itemClassLabel;
  window.APP_FORMATTERS.itemSubclassLabel = itemSubclassLabel;
  window.APP_FORMATTERS.actionTypeLabel = actionTypeLabel;
  window.APP_FORMATTERS.resultLabel = resultLabel;
})();
