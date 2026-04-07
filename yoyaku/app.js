(function () {
  "use strict";

  const ROOM_NAMES = ["委員会室", "小委員会室", "部課長控室", "小会議室"];
  const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

  const state = {
    currentYear: 0,
    currentMonth: 0,
    statusFilter: "承認済"
  };

  const bodyEl = document.getElementById("reservation-body");
  const emptyMessageEl = document.getElementById("empty-message");
  const monthLabelEl = document.getElementById("month-label");
  const statusFilterEl = document.getElementById("status-filter");

  const modalOverlayEl = document.getElementById("modal-overlay");
  const modalTitleEl = document.getElementById("modal-title");
  const modalSubtitleEl = document.getElementById("modal-subtitle");
  const modalBodyEl = document.getElementById("modal-body");

  const allReservations = Array.isArray(window.APP_DATA && window.APP_DATA.reservations)
    ? window.APP_DATA.reservations.slice()
    : [];

  init();

  function init() {
    const initialDate = getInitialMonthDate();
    state.currentYear = initialDate.getFullYear();
    state.currentMonth = initialDate.getMonth();

    document.getElementById("prev-month-btn").addEventListener("click", handlePrevMonth);
    document.getElementById("next-month-btn").addEventListener("click", handleNextMonth);
    document.getElementById("today-btn").addEventListener("click", handleTodayMonth);

    statusFilterEl.addEventListener("change", function () {
      state.statusFilter = statusFilterEl.value;
      render();
    });

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

    render();
  }

  function getInitialMonthDate() {
    const firstValid = allReservations.find(function (item) {
      return isValidDateString(item.start_date);
    });

    if (firstValid) {
      return parseDateString(firstValid.start_date);
    }

    return new Date();
  }

  function handlePrevMonth() {
    state.currentMonth -= 1;
    normalizeCurrentMonth();
    render();
  }

  function handleNextMonth() {
    state.currentMonth += 1;
    normalizeCurrentMonth();
    render();
  }

  function handleTodayMonth() {
    const now = new Date();
    state.currentYear = now.getFullYear();
    state.currentMonth = now.getMonth();
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

    emptyMessageEl.hidden = reservationsForView.length > 0;
  }

  function filterReservationsForCurrentView() {
    const firstDay = new Date(state.currentYear, state.currentMonth, 1);
    const lastDay = new Date(state.currentYear, state.currentMonth + 1, 0);

    const firstStr = normalizeDate(toDateString(firstDay));
    const lastStr = normalizeDate(toDateString(lastDay));

    return allReservations.filter(function (item) {
      if (!isValidDateString(item.start_date) || !isValidDateString(item.end_date)) {
        return false;
      }

      if (state.statusFilter !== "all" && String(item.status || "") !== state.statusFilter) {
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
          return String(item.room_name || "") === roomName && isReservationActiveOnDate(item, dateStr);
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
      openModal(dateStr, roomName, roomReservations);
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

    if (state.statusFilter === "all") {
      const statusBadge = document.createElement("span");
      statusBadge.className = "status-badge " + getStatusClass(item.status);
      statusBadge.textContent = item.status || "";
      head.appendChild(statusBadge);
    }

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

  function openModal(dateStr, roomName, roomReservations) {
    const sorted = sortDisplayReservations(roomReservations);

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
  }

  function closeModal() {
    modalOverlayEl.classList.remove("is-open");
    modalOverlayEl.setAttribute("aria-hidden", "true");
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

    const statusBadge = document.createElement("span");
    statusBadge.className = "status-badge " + getStatusClass(item.status);
    statusBadge.textContent = item.status || "";
    head.appendChild(statusBadge);

    card.appendChild(head);

    const title = document.createElement("h3");
    title.className = "detail-title";
    title.textContent = item.purpose || "";
    card.appendChild(title);

    const meta = document.createElement("div");
    meta.className = "detail-meta";
    meta.innerHTML =
      '<div><strong>表示:</strong> ' + escapeHtml(item.displayTimeText) + "</div>" +
      '<div><strong>期間:</strong> ' + escapeHtml(item.start_date + " ～ " + item.end_date) + "</div>" +
      '<div><strong>終日:</strong> ' + escapeHtml(String(item.is_all_day) === "1" ? "終日" : "時間指定") + "</div>" +
      '<div><strong>部署:</strong> ' + escapeHtml(String(item.department_name || "")) + "</div>" +
      '<div><strong>担当者:</strong> ' + escapeHtml(String(item.person_in_charge || "")) + "</div>" +
      '<div><strong>入力者:</strong> ' + escapeHtml(String(item.entered_by || "")) + "</div>" +
      '<div><strong>表示順:</strong> ' + escapeHtml(String(item.display_order || "")) + "</div>" +
      '<div><strong>備考:</strong> ' + escapeHtml(String(item.note || "なし")) + "</div>" +
      '<div><strong>作成日:</strong> ' + escapeHtml(String(item.created_at || "")) + "</div>" +
      '<div><strong>更新日:</strong> ' + escapeHtml(String(item.updated_at || "")) + "</div>";
    card.appendChild(meta);

    return card;
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

  function getStatusClass(status) {
    if (status === "承認済") return "status-approved";
    if (status === "申請中") return "status-pending";
    if (status === "却下") return "status-rejected";
    if (status === "キャンセル") return "status-cancelled";
    return "";
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

  function normalizeDate(value) {
    return String(value || "").replace(/\//g, "-");
  }

  function isValidDateString(value) {
    return /^\d{4}[-\/]\d{2}[-\/]\d{2}$/.test(String(value || ""));
  }

  function parseDateString(value) {
    const normalized = normalizeDate(value);
    const parts = normalized.split("-");
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
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
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
})();