window.YoteiExportImport = (function () {
  "use strict";

  var Utils = window.YoteiUtils;

  function sortEventsForExport(events) {
    return Utils.deepClone(events || []).sort(function (left, right) {
      return left.id.localeCompare(right.id, "ja");
    });
  }

  function sortHistoryForExport(historyItems) {
    return Utils.deepClone(historyItems || []).sort(function (left, right) {
      return left.history_id.localeCompare(right.history_id, "ja");
    });
  }

  function serializeAsJsAssignment(propertyName, value) {
    return [
      "window.APP_DATA = window.APP_DATA || {};",
      "window.APP_DATA." + propertyName + " = " + JSON.stringify(value, null, 2) + ";",
      ""
    ].join("\n");
  }

  function generateEventsJs(events) {
    return serializeAsJsAssignment("events", sortEventsForExport(events));
  }

  function generateEventHistoryJs(historyItems) {
    return serializeAsJsAssignment("event_history", sortHistoryForExport(historyItems));
  }

  function exportAll(appData) {
    var source = appData || window.APP_DATA || {};
    return {
      eventsText: generateEventsJs(source.events || []),
      historyText: generateEventHistoryJs(source.event_history || [])
    };
  }

  function importSnapshotFromWindow() {
    Utils.ensureAppData();
    return {
      events: Utils.deepClone(window.APP_DATA.events),
      event_history: Utils.deepClone(window.APP_DATA.event_history)
    };
  }

  function executeScriptText(text, propertyName) {
    var sandboxWindow = { APP_DATA: {} };
    var executor = new Function("window", text + "\nreturn window.APP_DATA;");
    var appData = executor(sandboxWindow) || sandboxWindow.APP_DATA || {};
    return Utils.deepClone(appData[propertyName] || []);
  }

  function importFromScriptTexts(payload) {
    var input = payload || {};
    return {
      events: executeScriptText(input.eventsText || "", "events"),
      event_history: executeScriptText(input.historyText || "", "event_history")
    };
  }

  return {
    generateEventsJs: generateEventsJs,
    generateEventHistoryJs: generateEventHistoryJs,
    exportAll: exportAll,
    importSnapshotFromWindow: importSnapshotFromWindow,
    importFromScriptTexts: importFromScriptTexts
  };
}());
