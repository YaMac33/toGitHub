(function () {
  "use strict";

  var U = {};

  U.qs = function (selector, root) {
    return (root || document).querySelector(selector);
  };

  U.qsa = function (selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  };

  U.safeString = function (value) {
    if (value === undefined || value === null) return "";
    return String(value);
  };

  U.safeArray = function (value) {
    return Array.isArray(value) ? value : [];
  };

  U.escapeHtml = function (value) {
    return U.safeString(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  };

  U.normalizeText = function (value) {
    return U.safeString(value).toLowerCase().replace(/\s+/g, " ").trim();
  };

  U.includesText = function (target, keyword) {
    var key = U.normalizeText(keyword);
    if (!key) return true;
    return U.normalizeText(target).indexOf(key) !== -1;
  };

  U.unique = function (array) {
    var seen = {};
    var result = [];
    U.safeArray(array).forEach(function (item) {
      var key = U.safeString(item);
      if (key && !seen[key]) {
        seen[key] = true;
        result.push(key);
      }
    });
    return result;
  };

  U.groupBy = function (array, keyFn) {
    var groups = {};
    U.safeArray(array).forEach(function (item) {
      var key = U.safeString(keyFn(item));
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return groups;
  };

  U.compareDateString = function (a, b) {
    var av = U.safeString(a);
    var bv = U.safeString(b);
    if (!av && !bv) return 0;
    if (!av) return 1;
    if (!bv) return -1;
    if (av < bv) return -1;
    if (av > bv) return 1;
    return 0;
  };

  U.sortByDate = function (array, key, direction) {
    var dir = direction === "asc" ? 1 : -1;
    return U.safeArray(array).slice().sort(function (a, b) {
      return U.compareDateString(a[key], b[key]) * dir;
    });
  };

  U.pad2 = function (value) {
    return String(value).padStart ? String(value).padStart(2, "0") : ("0" + value).slice(-2);
  };

  U.getTodayString = function () {
    var d = new Date();
    return d.getFullYear() + "-" + U.pad2(d.getMonth() + 1) + "-" + U.pad2(d.getDate());
  };

  U.isDateInMonth = function (dateString, year, month) {
    var s = U.safeString(dateString);
    return s.indexOf(year + "-" + U.pad2(month) + "-") === 0;
  };

  U.getMonthMatrix = function (year, month) {
    var first = new Date(year, month - 1, 1);
    var start = new Date(year, month - 1, 1 - first.getDay());
    var weeks = [];
    var cursor = new Date(start.getTime());
    var w;
    var d;

    for (w = 0; w < 6; w += 1) {
      var week = [];
      for (d = 0; d < 7; d += 1) {
        week.push({
          year: cursor.getFullYear(),
          month: cursor.getMonth() + 1,
          day: cursor.getDate(),
          dateString: cursor.getFullYear() + "-" + U.pad2(cursor.getMonth() + 1) + "-" + U.pad2(cursor.getDate()),
          inMonth: cursor.getMonth() + 1 === month
        });
        cursor.setDate(cursor.getDate() + 1);
      }
      weeks.push(week);
    }
    return weeks;
  };

  window.APP_UTILS = U;
})();
