window.YoteiCalendar = (function () {
  "use strict";

  var Utils = window.YoteiUtils;
  var EventStore = window.YoteiEventStore;
  var state = {
    calendar: null,
    selectedEventId: "",
    options: null
  };

  function init(options) {
    state.options = options || {};
    var element = document.getElementById("calendar");
    if (!element || !window.FullCalendar || !window.FullCalendar.Calendar) {
      throw new Error("FullCalendar の初期化に必要な要素またはライブラリが見つかりません。");
    }

    state.calendar = new window.FullCalendar.Calendar(element, {
      locale: "ja",
      initialView: "dayGridMonth",
      height: 760,
      selectable: true,
      editable: true,
      eventStartEditable: true,
      eventDurationEditable: true,
      navLinks: true,
      nowIndicator: true,
      dayMaxEventRows: 3,
      expandRows: true,
      stickyHeaderDates: true,
      headerToolbar: {
        left: "prev,next today",
        center: "title",
        right: "dayGridMonth,timeGridWeek,timeGridDay,listMonth"
      },
      buttonText: {
        today: "今日",
        month: "月",
        week: "週",
        day: "日",
        list: "一覧"
      },
      eventTimeFormat: {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      },
      plugins: [
        window.FullCalendar.DayGrid.default,
        window.FullCalendar.TimeGrid.default,
        window.FullCalendar.List.default,
        window.FullCalendar.Interaction.default
      ],
      events: function (_info, successCallback) {
        successCallback(buildCalendarEvents());
      },
      dateClick: function (info) {
        if (typeof state.options.onDateClick === "function") {
          state.options.onDateClick(createDateClickPayload(info));
        }
      },
      eventClick: function (info) {
        info.jsEvent.preventDefault();
        state.selectedEventId = info.event.id;
        if (typeof state.options.onEventClick === "function") {
          state.options.onEventClick(info.event.id);
        }
        refresh();
      },
      eventDrop: function (info) {
        handleMutation(info, "drop", state.options.onEventDateChange);
      },
      eventResize: function (info) {
        handleMutation(info, "resize", state.options.onEventDateChange);
      }
    });

    state.calendar.render();
  }

  function createDateClickPayload(info) {
    var viewType = info.view && info.view.type ? info.view.type : "";
    if (viewType.indexOf("timeGrid") === 0) {
      var start = Utils.toDateTimeLocalValue(info.date);
      var endDate = new Date(info.date.getTime());
      endDate.setHours(endDate.getHours() + 1);
      return {
        allDay: false,
        startInput: start,
        endInput: Utils.toDateTimeLocalValue(endDate)
      };
    }

    var range = Utils.createDefaultDateRange(info.date);
    return {
      allDay: false,
      startInput: range.startInput,
      endInput: range.endInput
    };
  }

  function buildCalendarEvents() {
    var includeDeleted = Boolean(
      state.options &&
      typeof state.options.getShowDeleted === "function" &&
      state.options.getShowDeleted()
    );

    return EventStore.getVisibleEvents(includeDeleted).map(function (event) {
      var meta = Utils.getCategoryMeta(event.extendedProps.category);
      var isDeleted = Utils.toNumber(event.extendedProps && event.extendedProps.is_deleted, 0) === 1;
      var classNames = [];

      if (state.selectedEventId === event.id) {
        classNames.push("is-selected-event");
      }
      if (isDeleted) {
        classNames.push("is-deleted-event");
      }

      return {
        id: event.id,
        title: isDeleted ? "削除済み: " + event.title : event.title,
        start: event.start,
        end: event.end,
        allDay: event.allDay,
        backgroundColor: isDeleted ? "#6b7280" : meta.color,
        borderColor: isDeleted ? "#6b7280" : meta.color,
        textColor: "#ffffff",
        classNames: classNames,
        editable: !isDeleted,
        startEditable: !isDeleted,
        durationEditable: !isDeleted,
        extendedProps: {
          category: event.extendedProps.category
        }
      };
    });
  }

  function formatStoredFromDate(date, allDay) {
    if (!date) {
      return "";
    }
    if (allDay) {
      return Utils.formatDate(date);
    }
    return Utils.normalizeLocalDateTimeString(Utils.toDateTimeLocalValue(date));
  }

  function handleMutation(info, mutationType, callback) {
    if (typeof callback !== "function") {
      return;
    }

    try {
      callback({
        eventId: info.event.id,
        mutationType: mutationType,
        start: formatStoredFromDate(info.event.start, info.event.allDay),
        end: info.event.end ? formatStoredFromDate(info.event.end, info.event.allDay) : formatStoredFromDate(info.event.start, info.event.allDay),
        allDay: info.event.allDay,
        revert: info.revert
      });
    } catch (error) {
      console.error("ドラッグ/リサイズ処理に失敗しました。", error);
      info.revert();
    }
  }

  function refresh() {
    if (!state.calendar) {
      return;
    }
    state.calendar.refetchEvents();
    state.calendar.updateSize();
  }

  function setSelectedEventId(eventId) {
    state.selectedEventId = eventId || "";
    refresh();
  }

  function clearSelection() {
    setSelectedEventId("");
  }

  return {
    init: init,
    refresh: refresh,
    setSelectedEventId: setSelectedEventId,
    clearSelection: clearSelection
  };
}());
