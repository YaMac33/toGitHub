window.YoteiEventStore = (function () {
  "use strict";

  var Utils = window.YoteiUtils;

  function ensureStore() {
    Utils.ensureAppData();
  }

  function createExtendedProps(source, existing) {
    var current = existing || {};
    var input = source || {};

    return {
      category: Utils.sanitizeText(input.category, current.category || "その他"),
      location: Utils.sanitizeText(input.location, current.location || ""),
      department: Utils.sanitizeText(input.department, current.department || ""),
      content: Utils.sanitizeText(input.content, current.content || ""),
      visibility: Utils.sanitizeText(input.visibility, current.visibility || "内部"),
      importance: Utils.toNumber(input.importance, current.importance || 2),
      created_at: Utils.sanitizeText(input.created_at, current.created_at || Utils.getCurrentTimestamp()),
      created_by: Utils.sanitizeText(input.created_by, current.created_by || "佐藤"),
      updated_at: Utils.sanitizeText(input.updated_at, current.updated_at || current.created_at || Utils.getCurrentTimestamp()),
      updated_by: Utils.sanitizeText(input.updated_by, current.updated_by || current.created_by || "佐藤"),
      is_deleted: Utils.toNumber(input.is_deleted, current.is_deleted || 0),
      sort_order: Utils.toNumber(input.sort_order, current.sort_order || 10),
      note: Utils.sanitizeText(input.note, current.note || "")
    };
  }

  function sanitizeEvent(event, existing) {
    var current = existing || {};
    var input = event || {};
    var ext = input.extendedProps || {};

    return {
      id: Utils.sanitizeText(input.id, current.id || ""),
      title: Utils.sanitizeText(input.title, current.title || ""),
      start: Utils.sanitizeText(input.start, current.start || ""),
      end: Utils.sanitizeText(input.end, current.end || current.start || ""),
      allDay: Boolean(input.allDay),
      extendedProps: createExtendedProps(ext, current.extendedProps)
    };
  }

  function sortEvents() {
    window.APP_DATA.events.sort(function (left, right) {
      var leftStart = Utils.parseStoredDateTime(left.start);
      var rightStart = Utils.parseStoredDateTime(right.start);
      var leftTime = leftStart ? leftStart.getTime() : 0;
      var rightTime = rightStart ? rightStart.getTime() : 0;

      if (leftTime !== rightTime) {
        return leftTime - rightTime;
      }

      var leftSort = Utils.toNumber(left.extendedProps && left.extendedProps.sort_order, 0);
      var rightSort = Utils.toNumber(right.extendedProps && right.extendedProps.sort_order, 0);
      if (leftSort !== rightSort) {
        return leftSort - rightSort;
      }

      return left.id.localeCompare(right.id, "ja");
    });
  }

  function getAllEvents() {
    ensureStore();
    return window.APP_DATA.events;
  }

  function getAllEventsClone() {
    return Utils.deepClone(getAllEvents());
  }

  function replaceAllEvents(events) {
    ensureStore();
    window.APP_DATA.events = (events || []).map(function (event) {
      return sanitizeEvent(event);
    });
    sortEvents();
    return window.APP_DATA.events;
  }

  function getEventById(eventId) {
    ensureStore();
    return window.APP_DATA.events.find(function (event) {
      return event.id === eventId;
    }) || null;
  }

  function getVisibleEvents(includeDeleted) {
    return getAllEvents().filter(function (event) {
      if (includeDeleted) {
        return true;
      }
      return Utils.toNumber(event.extendedProps && event.extendedProps.is_deleted, 0) !== 1;
    });
  }

  function getNextEventId() {
    return Utils.generateNextId(getAllEvents(), "id", "EVT", 4);
  }

  function addEvent(event) {
    ensureStore();
    var sanitized = sanitizeEvent(event);
    window.APP_DATA.events.push(sanitized);
    sortEvents();
    return sanitized;
  }

  function updateEvent(eventId, updatedEvent) {
    ensureStore();
    var targetIndex = window.APP_DATA.events.findIndex(function (event) {
      return event.id === eventId;
    });

    if (targetIndex < 0) {
      return null;
    }

    var current = window.APP_DATA.events[targetIndex];
    var merged = sanitizeEvent({
      id: current.id,
      title: updatedEvent.title,
      start: updatedEvent.start,
      end: updatedEvent.end,
      allDay: updatedEvent.allDay,
      extendedProps: {
        category: updatedEvent.extendedProps.category,
        location: updatedEvent.extendedProps.location,
        department: updatedEvent.extendedProps.department,
        content: updatedEvent.extendedProps.content,
        visibility: updatedEvent.extendedProps.visibility,
        importance: updatedEvent.extendedProps.importance,
        created_at: current.extendedProps.created_at,
        created_by: current.extendedProps.created_by,
        updated_at: updatedEvent.extendedProps.updated_at,
        updated_by: updatedEvent.extendedProps.updated_by,
        is_deleted: updatedEvent.extendedProps.is_deleted,
        sort_order: updatedEvent.extendedProps.sort_order,
        note: updatedEvent.extendedProps.note
      }
    }, current);

    window.APP_DATA.events[targetIndex] = merged;
    sortEvents();
    return merged;
  }

  function logicalDeleteEvent(eventId, payload) {
    var current = getEventById(eventId);
    if (!current) {
      return null;
    }

    return updateEvent(eventId, {
      title: current.title,
      start: current.start,
      end: current.end,
      allDay: current.allDay,
      extendedProps: {
        category: current.extendedProps.category,
        location: current.extendedProps.location,
        department: current.extendedProps.department,
        content: current.extendedProps.content,
        visibility: current.extendedProps.visibility,
        importance: current.extendedProps.importance,
        updated_at: payload.updated_at,
        updated_by: payload.updated_by,
        is_deleted: 1,
        sort_order: current.extendedProps.sort_order,
        note: current.extendedProps.note
      }
    });
  }

  return {
    replaceAllEvents: replaceAllEvents,
    getAllEvents: getAllEvents,
    getAllEventsClone: getAllEventsClone,
    getEventById: getEventById,
    getVisibleEvents: getVisibleEvents,
    getNextEventId: getNextEventId,
    addEvent: addEvent,
    updateEvent: updateEvent,
    logicalDeleteEvent: logicalDeleteEvent
  };
}());
