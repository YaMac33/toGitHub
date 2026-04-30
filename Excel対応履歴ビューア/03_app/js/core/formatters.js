(function () {
  "use strict";

  var U = window.APP_UTILS;
  var F = {};

  F.formatEmpty = function (value) {
    var s = U.safeString(value);
    return s ? U.escapeHtml(s) : "—";
  };

  F.formatDate = function (dateString) {
    return F.formatEmpty(dateString);
  };

  F.formatDateShort = function (dateString) {
    var s = U.safeString(dateString);
    if (!s || s.length < 10) return "—";
    return Number(s.slice(5, 7)) + "/" + Number(s.slice(8, 10));
  };

  F.formatDateTime = function (dateTimeString) {
    return F.formatEmpty(dateTimeString);
  };

  F.formatTime = function (timeString) {
    return F.formatEmpty(timeString);
  };

  F.formatTags = function (tags) {
    var list = U.safeArray(tags);
    if (!list.length) return '<span class="muted">—</span>';
    return '<span class="tag-list">' + list.map(function (tag) {
      return '<span class="tag">' + U.escapeHtml(tag) + "</span>";
    }).join("") + "</span>";
  };

  F.statusLabel = function (status) {
    return U.safeString(status) || "—";
  };

  F.priorityLabel = function (priority) {
    return U.safeString(priority) || "—";
  };

  F.statusClass = function (status) {
    var s = U.safeString(status);
    if (s === "未対応") return "status-new";
    if (s === "対応中") return "status-progress";
    if (s === "保留") return "status-wait";
    if (s === "完了") return "status-done";
    return "badge-status";
  };

  F.priorityClass = function (priority) {
    var p = U.safeString(priority);
    if (p === "緊急") return "priority-urgent";
    if (p === "重要") return "priority-important";
    return "badge-priority";
  };

  F.statusBadge = function (status) {
    return '<span class="badge badge-status ' + F.statusClass(status) + '">' + U.escapeHtml(F.statusLabel(status)) + "</span>";
  };

  F.priorityBadge = function (priority) {
    return '<span class="badge badge-priority ' + F.priorityClass(priority) + '">' + U.escapeHtml(F.priorityLabel(priority)) + "</span>";
  };

  F.overdueLabel = function (caseItem) {
    if (!caseItem || !caseItem.is_overdue) return "";
    return '<span class="badge badge-overdue">期限超過</span>';
  };

  F.buildDisplayTitle = function (caseItem) {
    if (!caseItem) return "";
    return U.safeString(caseItem.display_title) || U.safeString(caseItem.title) || U.safeString(caseItem.case_id) || "無題の案件";
  };

  F.buildDisplaySubtitle = function (caseItem) {
    if (!caseItem) return "";
    if (caseItem.display_subtitle) return U.safeString(caseItem.display_subtitle);
    return [caseItem.received_date, caseItem.owner, caseItem.status].filter(function (v) {
      return U.safeString(v);
    }).join("｜");
  };

  window.APP_FORMATTERS = F;
})();
