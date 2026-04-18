(function () {
  var MAPL = window.MAPL = window.MAPL || {};

  function serializeAll() {
    return [
      "window.MAPL_DATA = window.MAPL_DATA || {};",
      "window.MAPL_DATA.pins = " + JSON.stringify(window.MAPL_DATA.pins, null, 2) + ";",
      "window.MAPL_DATA.routes = " + JSON.stringify(window.MAPL_DATA.routes, null, 2) + ";"
    ].join("\n");
  }

  function serializePins() {
    return [
      "window.MAPL_DATA = window.MAPL_DATA || {};",
      "window.MAPL_DATA.pins = " + JSON.stringify(window.MAPL_DATA.pins, null, 2) + ";"
    ].join("\n");
  }

  function serializeRoutes() {
    return [
      "window.MAPL_DATA = window.MAPL_DATA || {};",
      "window.MAPL_DATA.routes = " + JSON.stringify(window.MAPL_DATA.routes, null, 2) + ";"
    ].join("\n");
  }

  function parseTextData(text) {
    var fakeWindow = {
      MAPL_DATA: {}
    };

    var evaluator = new Function("window", "\"use strict\";\n" + text + "\nreturn window.MAPL_DATA || {};");
    var result = evaluator(fakeWindow);

    return {
      raw: result || {},
      normalized: MAPL.utils.normalizeDataShape(result || {})
    };
  }

  function importText(text, target) {
    var parsed;

    try {
      parsed = parseTextData(text);
    } catch (error) {
      return {
        ok: false,
        message: "JS テキストの読み込みに失敗しました: " + error.message
      };
    }

    if (target === "pins") {
      window.MAPL_DATA.pins = parsed.normalized.pins;
    } else if (target === "routes") {
      window.MAPL_DATA.routes = parsed.normalized.routes;
    } else {
      window.MAPL_DATA = {
        pins: parsed.normalized.pins,
        routes: parsed.normalized.routes
      };
    }

    return {
      ok: true,
      pins: window.MAPL_DATA.pins.length,
      routes: window.MAPL_DATA.routes.length
    };
  }

  MAPL.storage = {
    importText: importText,
    parseTextData: parseTextData,
    serializeAll: serializeAll,
    serializePins: serializePins,
    serializeRoutes: serializeRoutes
  };
})();
