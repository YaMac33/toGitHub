(function () {
  "use strict";

  window.APP_UTILS = window.APP_UTILS || {};

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function escapeRegExp(value) {
    return String(value == null ? "" : value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function qs(name) {
    return new URLSearchParams(window.location.search).get(name) || "";
  }

  function todayString() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  function isCurrentRange(startDate, endDate, baseDate) {
    if (!startDate) return false;

    const base = baseDate || todayString();

    if (startDate > base) return false;
    if (endDate && endDate < base) return false;

    return true;
  }

  function safeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function getById(list, keyName, keyValue) {
    return safeArray(list).find(function (row) {
      return row && row[keyName] === keyValue;
    }) || null;
  }

  function openInNewTab(url) {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  window.APP_UTILS.escapeHtml = escapeHtml;
  window.APP_UTILS.escapeRegExp = escapeRegExp;
  window.APP_UTILS.qs = qs;
  window.APP_UTILS.todayString = todayString;
  window.APP_UTILS.isCurrentRange = isCurrentRange;
  window.APP_UTILS.safeArray = safeArray;
  window.APP_UTILS.getById = getById;
  window.APP_UTILS.openInNewTab = openInNewTab;
})();
