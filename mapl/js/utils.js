(function () {
  var MAPL = window.MAPL = window.MAPL || {};

  function createId(prefix) {
    var stamp = Date.now().toString(36);
    var random = Math.random().toString(36).slice(2, 8);
    return prefix + "_" + stamp + "_" + random;
  }

  function toNumber(value, fallback) {
    var parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function roundCoord(value) {
    return Math.round(value * 1000000) / 1000000;
  }

  function formatCoord(value) {
    if (!Number.isFinite(value)) {
      return "--";
    }

    return roundCoord(value).toFixed(6);
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeDataShape(source) {
    var data = source || {};

    var pins = Array.isArray(data.pins) ? data.pins : [];
    var routes = Array.isArray(data.routes) ? data.routes : [];

    return {
      pins: pins.map(normalizePin),
      routes: routes.map(normalizeRoute)
    };
  }

  function ensureDataShape(source) {
    window.MAPL_DATA = normalizeDataShape(source);
    return window.MAPL_DATA;
  }

  function normalizePin(pin, index) {
    var lat = toNumber(pin && pin.lat, 35.681236);
    var lng = toNumber(pin && pin.lng, 139.767125);
    var id = pin && pin.id ? String(pin.id) : createId("pin" + (index || ""));

    return {
      id: id,
      name: pin && pin.name ? String(pin.name) : "新しいピン",
      category: pin && pin.category ? String(pin.category) : "",
      memo: pin && pin.memo ? String(pin.memo) : "",
      lat: roundCoord(lat),
      lng: roundCoord(lng),
      createdAt: pin && pin.createdAt ? String(pin.createdAt) : new Date().toISOString(),
      updatedAt: pin && pin.updatedAt ? String(pin.updatedAt) : new Date().toISOString()
    };
  }

  function normalizeRoute(route, index) {
    var id = route && route.id ? String(route.id) : createId("route" + (index || ""));
    var points = Array.isArray(route && route.points) ? route.points : [];

    return {
      id: id,
      name: route && route.name ? String(route.name) : "新しい経路",
      color: route && route.color ? String(route.color) : "#2f6fed",
      visible: route && route.visible !== undefined ? Boolean(route.visible) : true,
      memo: route && route.memo ? String(route.memo) : "",
      points: points.map(function (point) {
        return {
          lat: roundCoord(toNumber(point && point.lat, 35.681236)),
          lng: roundCoord(toNumber(point && point.lng, 139.767125))
        };
      }),
      createdAt: route && route.createdAt ? String(route.createdAt) : new Date().toISOString(),
      updatedAt: route && route.updatedAt ? String(route.updatedAt) : new Date().toISOString()
    };
  }

  function createDefaultPin(lat, lng) {
    return normalizePin({
      id: createId("pin"),
      name: "新しいピン",
      lat: lat,
      lng: lng
    });
  }

  function createDefaultRoute() {
    return normalizeRoute({
      id: createId("route"),
      name: "新しい経路",
      color: "#2f6fed",
      visible: true,
      points: []
    });
  }

  MAPL.utils = {
    clone: clone,
    createDefaultPin: createDefaultPin,
    createDefaultRoute: createDefaultRoute,
    createId: createId,
    ensureDataShape: ensureDataShape,
    formatCoord: formatCoord,
    formatLatLng: function (lat, lng) {
      return formatCoord(lat) + ", " + formatCoord(lng);
    },
    normalizeDataShape: normalizeDataShape,
    roundCoord: roundCoord,
    toNumber: toNumber
  };
})();
