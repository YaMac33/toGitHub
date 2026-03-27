// =============================
// formatters.js（表示整形）
// =============================

// 和暦変換
function toWareki(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();

  if (y >= 2019) {
    return `令和${y - 2018}年${m}月${day}日`;
  } else if (y >= 1989) {
    return `平成${y - 1988}年${m}月${day}日`;
  } else {
    return `${y}年${m}月${day}日`;
  }
}

// 期間表示
function formatPeriod(startDate, endDate) {
  if (!startDate && !endDate) return "";

  const s = startDate ? toWareki(startDate) : "";
  const e = endDate ? toWareki(endDate) : "現在";

  return `${s} ～ ${e}`;
}

// 公開状態ラベル
function visibilityLabel(flag) {
  return String(flag) === "1" ? "公開" : "非公開";
}

// 時間（数値）→「○時間○分」
function formatDurationHours(value) {
  if (!value) return "";

  const num = Number(value);
  const hours = Math.floor(num);
  const minutes = Math.round((num - hours) * 60);

  return `${hours}時間${minutes}分`;
}

// 会議種別ラベル
function sessionTypeLabel(value) {
  if (value === "REGULAR") return "定例会";
  if (value === "EXTRA") return "臨時会";
  return "";
}

// イベント種別ラベル（event_types参照）
function eventTypeLabel(id) {
  const list = window.APP_DATA?.event_types || [];
  const found = list.find(v => v.event_type_id === id);
  return found ? found.event_type_name : id;
}
