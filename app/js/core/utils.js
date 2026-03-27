// =============================
// utils.js（共通ユーティリティ）
// =============================

// HTMLエスケープ
function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// 正規表現エスケープ
function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// URLパラメータ取得
function qs(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

// 今日の日付（yyyy-mm-dd）
function todayString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// 現在判定（期間内か）
function isCurrentRange(startDate, endDate, baseDate) {
  if (!startDate) return false;
  const base = baseDate || todayString();
  if (startDate > base) return false;
  if (endDate && endDate < base) return false;
  return true;
}
