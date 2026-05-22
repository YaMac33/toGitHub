(function () {
  "use strict";

  function formatYen(number) {
    const value = Number(number) || 0;
    return `${value.toLocaleString("ja-JP")}円`;
  }

  function formatDate(dateString) {
    if (!dateString) return "";
    const date = new Date(`${dateString}T00:00:00`);
    if (Number.isNaN(date.getTime())) return String(dateString);
    return new Intl.DateTimeFormat("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short"
    }).format(date);
  }

  function formatDateTime(dateTimeString) {
    if (!dateTimeString) return "";
    const normalized = String(dateTimeString).includes("T")
      ? dateTimeString
      : String(dateTimeString).replace(" ", "T");
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) return String(dateTimeString);
    return new Intl.DateTimeFormat("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  function statusLabel(status) {
    const labels = {
      ACTIVE: "有効",
      CHANGED: "変更済み",
      CANCELED: "キャンセル済み",
      REJECTED: "締切後・無効"
    };
    return labels[status] || "不明";
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  window.BentoFormatters = {
    formatYen,
    formatDate,
    formatDateTime,
    statusLabel,
    escapeHtml
  };
})();
