window.YoteiHistoryStore = (function () {
  "use strict";

  var Utils = window.YoteiUtils;

  function ensureStore() {
    Utils.ensureAppData();
  }

  function sanitizeHistory(entry) {
    var item = entry || {};
    return {
      history_id: Utils.sanitizeText(item.history_id),
      event_id: Utils.sanitizeText(item.event_id),
      operation_type: Utils.sanitizeText(item.operation_type),
      changed_at: Utils.sanitizeText(item.changed_at),
      changed_by: Utils.sanitizeText(item.changed_by, "佐藤"),
      before_text: Utils.sanitizeText(item.before_text),
      after_text: Utils.sanitizeText(item.after_text),
      diff_text: Utils.sanitizeText(item.diff_text),
      change_summary: Utils.sanitizeText(item.change_summary),
      change_reason: Utils.sanitizeText(item.change_reason),
      version_no: Utils.toNumber(item.version_no, 1)
    };
  }

  function getAllHistory() {
    ensureStore();
    return window.APP_DATA.event_history;
  }

  function getAllHistoryClone() {
    return Utils.deepClone(getAllHistory());
  }

  function replaceAllHistory(items) {
    ensureStore();
    window.APP_DATA.event_history = (items || []).map(function (entry) {
      return sanitizeHistory(entry);
    });
    sortHistory();
    return window.APP_DATA.event_history;
  }

  function sortHistory() {
    window.APP_DATA.event_history.sort(function (left, right) {
      if (left.changed_at !== right.changed_at) {
        return right.changed_at.localeCompare(left.changed_at, "ja");
      }
      return right.history_id.localeCompare(left.history_id, "ja");
    });
  }

  function getHistoryByEventId(eventId) {
    return getAllHistory().filter(function (item) {
      return item.event_id === eventId;
    }).sort(function (left, right) {
      return right.version_no - left.version_no;
    });
  }

  function getNextHistoryId() {
    return Utils.generateNextId(getAllHistory(), "history_id", "HIS", 6);
  }

  function getNextVersionNo(eventId) {
    var maxVersion = 0;
    getAllHistory().forEach(function (item) {
      if (item.event_id !== eventId) {
        return;
      }
      maxVersion = Math.max(maxVersion, Utils.toNumber(item.version_no, 0));
    });
    return maxVersion + 1;
  }

  function addHistory(entry) {
    ensureStore();
    var sanitized = sanitizeHistory(entry);
    window.APP_DATA.event_history.push(sanitized);
    sortHistory();
    return sanitized;
  }

  function addCreateHistory(event, options) {
    var payload = options || {};
    return addHistory({
      history_id: getNextHistoryId(),
      event_id: event.id,
      operation_type: "CREATE",
      changed_at: payload.changed_at,
      changed_by: payload.changed_by,
      before_text: "",
      after_text: Utils.buildEventDisplayText(event),
      diff_text: "",
      change_summary: payload.change_summary || "予定を新規作成",
      change_reason: payload.change_reason || "",
      version_no: getNextVersionNo(event.id)
    });
  }

  function addUpdateHistory(beforeEvent, afterEvent, options) {
    var payload = options || {};
    return addHistory({
      history_id: getNextHistoryId(),
      event_id: afterEvent.id,
      operation_type: "UPDATE",
      changed_at: payload.changed_at,
      changed_by: payload.changed_by,
      before_text: Utils.buildEventDisplayText(beforeEvent),
      after_text: Utils.buildEventDisplayText(afterEvent),
      diff_text: Utils.buildDiffText(beforeEvent, afterEvent),
      change_summary: payload.change_summary || "予定を更新",
      change_reason: payload.change_reason || "",
      version_no: getNextVersionNo(afterEvent.id)
    });
  }

  function addDeleteHistory(beforeEvent, options) {
    var payload = options || {};
    return addHistory({
      history_id: getNextHistoryId(),
      event_id: beforeEvent.id,
      operation_type: "DELETE",
      changed_at: payload.changed_at,
      changed_by: payload.changed_by,
      before_text: Utils.buildEventDisplayText(beforeEvent),
      after_text: "",
      diff_text: "削除フラグ: 0 → 1",
      change_summary: payload.change_summary || "予定を削除",
      change_reason: payload.change_reason || "",
      version_no: getNextVersionNo(beforeEvent.id)
    });
  }

  return {
    replaceAllHistory: replaceAllHistory,
    getAllHistory: getAllHistory,
    getAllHistoryClone: getAllHistoryClone,
    getHistoryByEventId: getHistoryByEventId,
    addCreateHistory: addCreateHistory,
    addUpdateHistory: addUpdateHistory,
    addDeleteHistory: addDeleteHistory
  };
}());
