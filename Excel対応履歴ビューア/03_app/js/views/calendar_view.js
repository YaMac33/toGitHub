(function () {
  "use strict";

  var U = window.APP_UTILS;
  var F = window.APP_FORMATTERS;
  window.APP_VIEWS = window.APP_VIEWS || {};

  function eventsForDate(state, dateString) {
    var mode = state.calendar.mode;
    if (mode === "history") {
      return state.histories.filter(function (h) { return h.action_date === dateString; }).map(function (h) {
        var c = state.caseMap[h.case_id] || {};
        return { type: "対応", case_id: h.case_id, title: F.buildDisplayTitle(c) || h.content || h.case_id, person: c.person_name || "", history: h };
      });
    }
    if (mode === "due") {
      return state.cases.filter(function (c) { return c.due_date === dateString; }).map(function (c) {
        return { type: "期限", case_id: c._row_id, title: F.buildDisplayTitle(c), person: c.person_name, caseItem: c };
      });
    }
    return state.cases.filter(function (c) { return c.received_date === dateString; }).map(function (c) {
      return { type: "受付", case_id: c._row_id, title: F.buildDisplayTitle(c), person: c.person_name, caseItem: c };
    });
  }

  window.APP_VIEWS.renderCalendarView = function (state) {
    var app = U.qs("#app");
    var cal = state.calendar;
    var weeks = U.getMonthMatrix(cal.year, cal.month);
    var today = U.getTodayString();

    app.innerHTML = ''
      + '<section class="card">'
      + '<div class="calendar-toolbar">'
      + '<h2 class="page-title">' + cal.year + '年' + cal.month + '月</h2>'
      + '<div class="segmented"><button type="button" id="prevMonth">前月</button><button type="button" id="nextMonth">翌月</button></div>'
      + '<div class="segmented">'
      + modeButton("received", "受付日", cal.mode)
      + modeButton("history", "対応日", cal.mode)
      + modeButton("due", "期限日", cal.mode)
      + '</div></div></section>'
      + '<section class="card"><div class="calendar-grid">'
      + ["日", "月", "火", "水", "木", "金", "土"].map(function (d) { return '<div class="calendar-weekday">' + d + '</div>'; }).join("")
      + weeks.map(function (week) {
        return week.map(function (day) {
          var events = eventsForDate(state, day.dateString);
          return '<div class="calendar-cell ' + (day.inMonth ? "" : "calendar-cell-muted") + (day.dateString === today ? " calendar-cell-today" : "") + '" data-date="' + day.dateString + '">'
            + '<div class="calendar-day-number">' + day.day + '</div>'
            + events.slice(0, 3).map(function (ev) {
              return '<div class="calendar-event">' + U.escapeHtml(ev.type) + ' ' + U.escapeHtml(ev.title) + '</div>';
            }).join("")
            + (events.length > 3 ? '<div class="muted">他' + (events.length - 3) + '件</div>' : "")
            + '</div>';
        }).join("");
      }).join("")
      + '</div></section>'
      + '<div id="calendarModal" class="modal" role="dialog" aria-modal="true"></div>';

    bind(app, state);
  };

  function modeButton(value, label, current) {
    return '<button type="button" data-mode="' + value + '" class="' + (value === current ? "active" : "") + '">' + label + '</button>';
  }

  function bind(root, state) {
    U.qs("#prevMonth", root).addEventListener("click", function () {
      changeMonth(state, -1);
    });
    U.qs("#nextMonth", root).addEventListener("click", function () {
      changeMonth(state, 1);
    });
    U.qsa("[data-mode]", root).forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.calendar.mode = btn.getAttribute("data-mode");
        window.APP.render();
      });
    });
    U.qsa("[data-date]", root).forEach(function (cell) {
      cell.addEventListener("click", function () {
        showDateModal(state, cell.getAttribute("data-date"));
      });
    });
  }

  function changeMonth(state, delta) {
    var d = new Date(state.calendar.year, state.calendar.month - 1 + delta, 1);
    state.calendar.year = d.getFullYear();
    state.calendar.month = d.getMonth() + 1;
    window.APP.render();
  }

  function showDateModal(state, dateString) {
    var modal = U.qs("#calendarModal");
    var events = eventsForDate(state, dateString);
    modal.innerHTML = '<div class="modal-panel">'
      + '<div class="modal-header"><h2>' + F.formatDate(dateString) + '</h2><button type="button" class="text-button" id="closeCalendarModal">閉じる</button></div>'
      + (events.length ? events.map(function (ev) {
        return '<div class="case-strip clickable-item" data-case-id="' + U.escapeHtml(ev.case_id) + '">'
          + '<strong>[' + U.escapeHtml(ev.type) + '] ' + U.escapeHtml(ev.title || "案件不明") + '</strong>'
          + '<span class="muted">' + F.formatEmpty(ev.case_id) + ' / ' + F.formatEmpty(ev.person) + '</span>'
          + '</div>';
      }).join("") : '<p class="empty-message">該当するデータがありません</p>')
      + '</div>';
    modal.classList.add("open");
    U.qs("#closeCalendarModal", modal).addEventListener("click", close);
    modal.addEventListener("click", function (e) {
      if (e.target === modal) close();
    });
    U.qsa("[data-case-id]", modal).forEach(function (el) {
      el.addEventListener("click", function () {
        close();
        window.APP.showCaseDetail(el.getAttribute("data-case-id"));
      });
    });
    function close() {
      modal.classList.remove("open");
      modal.innerHTML = "";
    }
  }
})();
