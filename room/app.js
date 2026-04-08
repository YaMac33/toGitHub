(function () {
  "use strict";

  const ROOM_NAMES = ["委員会室", "小委員会室", "部課長控室", "小会議室"];
  const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];
  const STORAGE_KEY = "room_calendar_current_month_v1";

  const RAW_DATA = Array.isArray(window.APP_DATA && window.APP_DATA.reservations)
    ? window.APP_DATA.reservations.slice()
    : [];

  const state = {
    currentYear: 0,
    currentMonth: 0
  };

  const bodyEl = document.getElementById("reservation-body");
  const emptyMessageEl = document.getElementById("empty-message");
  const monthLabelEl = document.getElementById("month-label");

  const modalOverlayEl = document.getElementById("modal-overlay");
  const modalTitleEl = document.getElementById("modal-title");
  const modalSubtitleEl = document.getElementById("modal-subtitle");
  const modalBodyEl = document.getElementById("modal-body");

  let lastFocusedElement = null;

  const allReservations = RAW_DATA
    .map(convertRawRecord)
    .filter(function (item) {
      return item !== null;
    });

  init();

  function init() {
    validateHeaderRooms();

    const savedMonth = loadCurrentMonth();
    const initialDate = savedMonth || getInitialMonthDate();

    state.currentYear = initialDate.getFullYear();
    state.currentMonth = initialDate.getMonth();

    document.getElementById("prev-month-btn").addEventListener("click", handlePrevMonth);
    document.getElementById("next-month-btn").addEventListener("click", handleNextMonth);
    document.getElementById("today-btn").addEventListener("click", handleTodayMonth);

    document.getElementById("modal-close-btn").addEventListener("click", closeModal);
    document.getElementById("modal-close-footer-btn").addEventListener("click", closeModal);

    modalOverlayEl.addEventListener("click", function (event) {
      if (event.target === modalOverlayEl) {
        closeModal();
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && modalOverlayEl.classList.contains("is-open")) {
        closeModal();
      }
    });

    logDataKeyStats();
    render();
  }

  function convertRawRecord(raw) {
    if (!raw || typeof raw !== "object") {
      return null;
    }

    const reservationId = getField(raw, "ＩＤ（システムＩＤ：自動発番）", "ＩＤ", "ID");
    const startDate = normalizeDate(getField(raw, "開始日"));
    const endDate = normalizeDate(getField(raw, "終了日"));
    const roomName = String(getField(raw, "予約種別") || "").trim();
    const purpose = String(getField(raw, "内容") || "").trim();

    if (!reservationId && !startDate && !endDate && !roomName && !purpose) {
      return null;
    }

    return {
      reservation_id: String(reservationId || "").trim(),
      room_name: roomName,
      start_date: startDate,
      end_date: endDate,
      start_time: normalizeTime(getField(raw, "開始時刻")),
      end_time: normalizeTime(getField(raw, "終了時刻")),
      purpose: purpose,
      purpose_sub: String(getField(raw, "利用目的") || "").trim(),
      note: String(getField(raw, "利用目的詳細") || "").trim(),
      display_order: convertDisplayOrder(getField(raw, "重要度")),
      is_all_day: convertIsAllDay(getField(raw, "フラグ"), getField(raw, "is_all_day")),
      icon_no: String(getField(raw, "アイコン番号") || "").trim(),
      raw_flag: String(getField(raw, "フラグ") || "").trim()
    };
  }

  function getField(obj) {
    for (let i = 1; i < arguments.length; i += 1) {
      const key = arguments[i];
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        return obj[key];
      }
    }
    return "";
  }

  function convertDisplayOrder(value) {
    const text = String(value || "").trim();
    const num = Number(text);
    return Number.isFinite(num) ? num : 9999;
  }

  function convertIsAllDay(flagValue, directValue) {
    const directText = String(directValue || "").trim();
    if (directText === "1") return 1;
    if (directText === "0") return 0;

    const flagText = String(flagValue || "").trim();
    return flagText === "終日" ? 1 : 0;
  }

  function normalizeDate(value) {
    return String(value || "").trim().replace(/\//g, "-");
  }

  function normalizeTime(value) {
    const text = String(value || "").trim();
    if (!text) return "";

    const parts = text.split(":");
    if (parts.length >= 2) {
      const hh = String(parts[0]).padStart(2, "0");
      const mm = String(parts[1]).padStart(2, "0");
      return hh + ":" + mm;
    }

    return text;
  }

  function isValidDateString(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
  }

  function parseDateString(value) {
    const normalized = normalizeDate(value);
    if (!isValidDateString(normalized)) {
      return null;
    }

    const parts = normalized.split("-");
    const year = Number(parts[0]);
    const month = Number(parts[1]);
    const day = Number(parts[2]);

    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }

    return date;
  }

  function getInitialMonthDate() {
    const firstValid = allReservations.find(function (item) {
      return isValidDateString(item.start_date);
    });

    if (firstValid) {
      const parsed = parseDateString(firstValid.start_date);
      if (parsed) return parsed;
    }

    return new Date();
  }

  function handlePrevMonth() {
    state.currentMonth -= 1;
    normalizeCurrentMonth();
    saveCurrentMonth();
    render();
  }

  function handleNextMonth() {
    state.currentMonth += 1;
    normalizeCurrentMonth();
    saveCurrentMonth();
    render();
  }

  function handleTodayMonth() {
    const now = new Date();
    state.currentYear = now.getFullYear();
    state.currentMonth = now.getMonth();
    saveCurrentMonth();
    render();
  }

  function normalizeCurrentMonth() {
    while (state.currentMonth < 0) {
      state.currentMonth += 12;
      state.currentYear -= 1;
    }
    while (state.currentMonth > 11) {
      state.currentMonth -= 12;
      state.currentYear += 1;
    }
  }

  function saveCurrentMonth() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          year: state.currentYear,
          month: state.currentMonth
        })
      );
    } catch (error) {
      // 何もしない
    }
  }

  function loadCurrentMonth() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;

      const parsed = JSON.parse(raw);
      if (
        !parsed ||
        !Number.isInteger(parsed.year) ||
        !Number.isInteger(parsed.month) ||
        parsed.month < 0 ||
        parsed.month > 11
      ) {
        return null;
      }

      return new Date(parsed.year, parsed.month, 1);
    } catch (error) {
      return null;
    }
  }

  function render() {
    const wareki = getWareki(state.currentYear);
    monthLabelEl.textContent = wareki + "(" + state.currentYear + "年)" + (state.currentMonth + 1) + "月";

    bodyEl.innerHTML = "";

    const days = getDaysInMonth(state.currentYear, state.currentMonth);
    const reservationsForView = filterReservationsForCurrentView();

    for (let day = 1; day <= days; day += 1) {
      const dateObj = new Date(state.currentYear, state.currentMonth, day);
      const dateStr = toDateString(dateObj);
      bodyEl.appendChild(buildRow(dateObj, dateStr, reservationsForView));
    }

    updateEmptyMessage(reservationsForView.length > 0);
  }

  function updateEmptyMessage(hasReservations) {
    emptyMessageEl.hidden = hasReservations;

    if (hasReservations) {
      emptyMessageEl.textContent = "";
      return;
    }

    if (allReservations.length === 0) {
      emptyMessageEl.textContent =
        "予約データが見つかりません。../reservations.js が存在し、window.APP_DATA.reservations が配列か確認してください。";
      return;
    }

    emptyMessageEl.textContent = "この月に該当する予約はありません。";
  }

  function filterReservationsForCurrentView() {
    const firstDay = new Date(state.currentYear, state.currentMonth, 1);
    const lastDay = new Date(state.currentYear, state.currentMonth + 1, 0);

    const firstStr = normalizeDate(toDateString(firstDay));
    const lastStr = normalizeDate(toDateString(lastDay));

    return allReservations.filter(function (item) {
      if (!ROOM_NAMES.includes(item.room_name)) {
        return false;
      }

      if (!isValidDateString(item.start_date) || !isValidDateString(item.end_date)) {
        return false;
      }

      const start = normalizeDate(item.start_date);
      const end = normalizeDate(item.end_date);

      return !(end < firstStr || start > lastStr);
    });
  }

  function buildRow(dateObj, dateStr, reservations) {
    const tr = document.createElement("tr");

    if (dateObj.getDay() === 6) {
      tr.classList.add("is-saturday");
    } else if (dateObj.getDay() === 0) {
      tr.classList.add("is-sunday");
    }

    const dateTd = document.createElement("td");
    dateTd.className = "date-cell";
    dateTd.innerHTML =
      '<div class="date-main">' +
      escapeHtml((dateObj.getMonth() + 1) + "/" + dateObj.getDate() + "（" + WEEKDAY_LABELS[dateObj.getDay()] + "）") +
      "</div>" +
      '<div class="date-sub">' + escapeHtml(dateStr) + "</div>";
    tr.appendChild(dateTd);

    ROOM_NAMES.forEach(function (roomName) {
      const td = document.createElement("td");
      td.className = "room-cell";

      const roomReservations = reservations
        .filter(function (item) {
          return item.room_name === roomName && isReservationActiveOnDate(item, dateStr);
        })
        .map(function (item) {
          return buildDisplayReservation(item, dateStr);
        });

      td.appendChild(buildRoomCellButton(dateStr, roomName, roomReservations));
      tr.appendChild(td);
    });

    return tr;
  }

  function buildRoomCellButton(dateStr, roomName, roomReservations) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "room-click";
    button.addEventListener("click", function () {
      openModal(dateStr, roomName, roomReservations, button);
    });

    const wrapper = document.createElement("div");
    wrapper.className = "room-stack";

    if (roomReservations.length === 0) {
      const empty = document.createElement("div");
      empty.className = "slot-empty";
      empty.textContent = "（なし）";
      wrapper.appendChild(empty);
    } else {
      sortDisplayReservations(roomReservations).forEach(function (item) {
        wrapper.appendChild(buildRoomItem(item));
      });
    }

    button.appendChild(wrapper);
    return button;
  }

  function buildRoomItem(item) {
    const card = document.createElement("div");
    card.className = "room-item";

    const head = document.createElement("div");
    head.className = "room-item-head";

    const kindBadge = document.createElement("span");
    kindBadge.className = "kind-badge " + getKindClass(item.displayKind);
    kindBadge.textContent = getKindLabel(item.displayKind);
    head.appendChild(kindBadge);

    card.appendChild(head);

    const title = document.createElement("div");
    title.className = "room-item-title";
    title.textContent = item.purpose || "";
    card.appendChild(title);

    const sub = document.createElement("div");
    sub.className = "room-item-sub";
    sub.textContent = item.displayTimeText;
    card.appendChild(sub);

    if (item.note) {
      const note = document.createElement("div");
      note.className = "room-item-note";
      note.textContent = "※" + item.note;
      card.appendChild(note);
    }

    return card;
  }

  function openModal(dateStr, roomName, roomReservations, triggerElement) {
    const sorted = sortDisplayReservations(roomReservations);

    lastFocusedElement = triggerElement || document.activeElement;

    modalTitleEl.textContent = roomName;
    modalSubtitleEl.textContent = dateStr;
    modalBodyEl.innerHTML = "";

    if (sorted.length === 0) {
      const empty = document.createElement("div");
      empty.className = "modal-empty";
      empty.textContent = "予約はありません。";
      modalBodyEl.appendChild(empty);
    } else {
      sorted.forEach(function (item) {
        modalBodyEl.appendChild(buildDetailCard(item));
      });
    }

    modalOverlayEl.classList.add("is-open");
    modalOverlayEl.setAttribute("aria-hidden", "false");

    const closeBtn = document.getElementById("modal-close-btn");
    if (closeBtn) {
      closeBtn.focus();
    }
  }

  function closeModal() {
    modalOverlayEl.classList.remove("is-open");
    modalOverlayEl.setAttribute("aria-hidden", "true");

    if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
      lastFocusedElement.focus();
    }
  }

  function buildDetailCard(item) {
    const card = document.createElement("div");
    card.className = "detail-card";

    const head = document.createElement("div");
    head.className = "detail-head";

    const kindBadge = document.createElement("span");
    kindBadge.className = "kind-badge " + getKindClass(item.displayKind);
    kindBadge.textContent = getKindLabel(item.displayKind);
    head.appendChild(kindBadge);

    card.appendChild(head);

    const title = document.createElement("h3");
    title.className = "detail-title";
    title.textContent = item.purpose || "";
    card.appendChild(title);

    const meta = document.createElement("div");
    meta.className = "detail-meta";

    appendMetaItem(meta, "表示", item.displayTimeText);
    appendMetaItem(meta, "期間", item.start_date + " ～ " + item.end_date);
    appendMetaItem(meta, "終日", item.is_all_day === 1 ? "終日" : "時間指定");
    appendMetaItem(meta, "利用目的", item.purpose_sub || "なし");
    appendMetaItem(meta, "詳細", item.note || "なし");
    appendMetaItem(meta, "予約種別", item.room_name || "なし");
    appendMetaItem(meta, "フラグ", item.raw_flag || "なし");
    appendMetaItem(meta, "アイコン番号", item.icon_no || "なし");
    appendMetaItem(meta, "ID", item.reservation_id || "なし");

    card.appendChild(meta);

    return card;
  }

  function appendMetaItem(metaRoot, label, value) {
    const line = document.createElement("div");

    const strong = document.createElement("strong");
    strong.textContent = label + ":";
    line.appendChild(strong);

    line.appendChild(document.createTextNode(" " + String(value)));
    metaRoot.appendChild(line);
  }

  function isReservationActiveOnDate(item, dateStr) {
    const start = normalizeDate(item.start_date);
    const end = normalizeDate(item.end_date);
    const target = normalizeDate(dateStr);

    return start <= target && target <= end;
  }

  function buildDisplayReservation(item, dateStr) {
    const start = normalizeDate(item.start_date);
    const end = normalizeDate(item.end_date);
    const target = normalizeDate(dateStr);

    let displayKind = "single";
    if (start === end) {
      displayKind = "single";
    } else if (target === start) {
      displayKind = "start";
    } else if (target === end) {
      displayKind = "end";
    } else {
      displayKind = "continue";
    }

    return Object.assign({}, item, {
      displayKind: displayKind,
      displayTimeText: buildDisplayTimeText(item, displayKind)
    });
  }

  function buildDisplayTimeText(item, displayKind) {
    const startTime = String(item.start_time || "").trim();
    const endTime = String(item.end_time || "").trim();
    const isAllDay = Number(item.is_all_day) === 1;
    const sameDay = normalizeDate(item.start_date) === normalizeDate(item.end_date);

    if (sameDay) {
      if (isAllDay) return "終日";
      if (startTime && endTime) return startTime + "-" + endTime;
      if (startTime) return startTime + "開始";
      if (endTime) return endTime + "終了";
      return "時間指定";
    }

    if (isAllDay) {
      if (displayKind === "start") return "開始日";
      if (displayKind === "continue") return "継続中";
      if (displayKind === "end") return "終了日";
      return "終日";
    }

    if (displayKind === "start") {
      return startTime ? startTime + "開始" : "開始日";
    }
    if (displayKind === "continue") {
      return "終日";
    }
    if (displayKind === "end") {
      return endTime ? endTime + "終了" : "終了日";
    }

    if (startTime && endTime) return startTime + "-" + endTime;
    return "時間指定";
  }

  // 並び順仕様:
  // 1) 重要度(display_order)昇順
  // 2) 種別(single/start/continue/end)
  // 3) 利用内容(purpose)の日本語ロケール昇順
  function sortDisplayReservations(items) {
    return items.slice().sort(function (a, b) {
      const orderA = toNumber(a.display_order, 9999);
      const orderB = toNumber(b.display_order, 9999);
      if (orderA !== orderB) return orderA - orderB;

      const kindA = kindSortValue(a.displayKind);
      const kindB = kindSortValue(b.displayKind);
      if (kindA !== kindB) return kindA - kindB;

      const purposeA = String(a.purpose || "");
      const purposeB = String(b.purpose || "");
      return purposeA.localeCompare(purposeB, "ja");
    });
  }

  function kindSortValue(kind) {
    if (kind === "start") return 1;
    if (kind === "continue") return 2;
    if (kind === "end") return 3;
    return 0;
  }

  function getKindLabel(kind) {
    if (kind === "start") return "開始";
    if (kind === "continue") return "継続";
    if (kind === "end") return "終了";
    return "当日";
  }

  function getKindClass(kind) {
    if (kind === "start") return "kind-start";
    if (kind === "continue") return "kind-continue";
    if (kind === "end") return "kind-end";
    return "kind-single";
  }

  function getDaysInMonth(year, monthIndex) {
    return new Date(year, monthIndex + 1, 0).getDate();
  }

  function toDateString(dateObj) {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, "0");
    const day = String(dateObj.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
  }

  function toNumber(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function getWareki(year) {
    if (year >= 2019) {
      const w = year - 2018;
      return w === 1 ? "令和元年" : "令和" + w + "年";
    }
    if (year >= 1989) {
      const w = year - 1988;
      return w === 1 ? "平成元年" : "平成" + w + "年";
    }
    if (year >= 1926) {
      const w = year - 1925;
      return w === 1 ? "昭和元年" : "昭和" + w + "年";
    }
    return year + "年";
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function validateHeaderRooms() {
    const ths = Array.prototype.slice.call(document.querySelectorAll("thead th"));
    if (ths.length === 0) return;

    const headerRooms = ths.slice(1).map(function (th) {
      return String(th.textContent || "").trim();
    });

    const mismatch =
      headerRooms.length !== ROOM_NAMES.length ||
      headerRooms.some(function (name, idx) {
        return name !== ROOM_NAMES[idx];
      });

    if (mismatch) {
      console.warn("[room] ROOM_NAMES とテーブル列見出しの順序/件数が一致していません。", {
        ROOM_NAMES: ROOM_NAMES,
        headerRooms: headerRooms
      });
    }
  }

  function logDataKeyStats() {
    if (!Array.isArray(RAW_DATA) || RAW_DATA.length === 0) {
      console.info("[room] reservations データが空です。../reservations.js の読み込みや形式を確認してください。");
      return;
    }

    const missingStats = {
      start_date: 0,
      end_date: 0,
      room_name: 0,
      purpose: 0,
      id: 0
    };

    RAW_DATA.forEach(function (raw) {
      if (!getField(raw, "開始日")) missingStats.start_date += 1;
      if (!getField(raw, "終了日")) missingStats.end_date += 1;
      if (!getField(raw, "予約種別")) missingStats.room_name += 1;
      if (!getField(raw, "内容")) missingStats.purpose += 1;
      if (!getField(raw, "ＩＤ（システムＩＤ：自動発番）", "ＩＤ", "ID")) missingStats.id += 1;
    });

    console.info("[room] データ欠落キー統計", missingStats);
  }
})();
