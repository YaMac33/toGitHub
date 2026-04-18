(function () {
  var MAPL = window.MAPL = window.MAPL || {};

  var mapInstance = null;
  var layerRefs = {
    base: null,
    pins: null,
    routes: null,
    draft: null
  };
  var baseLayerState = {
    configuredMode: "blank",
    activeMode: "blank",
    hasLoadedTile: false,
    missingTileNoticeShown: false,
    tileErrorCount: 0
  };
  var TRANSPARENT_TILE =
    "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

  function initMap() {
    mapInstance = L.map("map", {
      attributionControl: false,
      zoomControl: true,
      worldCopyJump: false
    });

    mapInstance.setView([35.681236, 139.767125], 5);

    layerRefs.base = L.layerGroup().addTo(mapInstance);
    layerRefs.routes = L.layerGroup().addTo(mapInstance);
    layerRefs.pins = L.layerGroup().addTo(mapInstance);
    layerRefs.draft = L.layerGroup().addTo(mapInstance);

    applyBaseLayer(getBaseMapConfig());

    mapInstance.on("click", function (event) {
      if (MAPL.app && typeof MAPL.app.handleMapClick === "function") {
        MAPL.app.handleMapClick(event);
      }
    });

    mapInstance.on("mousemove", function (event) {
      if (MAPL.app && typeof MAPL.app.handleMapMouseMove === "function") {
        MAPL.app.handleMapMouseMove(event);
      }
    });

    mapInstance.on("mouseout", function () {
      if (MAPL.app && typeof MAPL.app.handleMapLeave === "function") {
        MAPL.app.handleMapLeave();
      }
    });

    return mapInstance;
  }

  function applyBaseLayer(config) {
    var baseConfig = normalizeBaseMapConfig(config);
    var mode = baseConfig.mode;

    baseLayerState.configuredMode = mode;
    baseLayerState.activeMode = "blank";
    baseLayerState.hasLoadedTile = false;
    baseLayerState.missingTileNoticeShown = false;
    baseLayerState.tileErrorCount = 0;

    if (layerRefs.base) {
      layerRefs.base.clearLayers();
    }

    if (mode === "blank") {
      return null;
    }

    var tileLayer = L.tileLayer(baseConfig.tileUrlTemplate, {
      attribution: baseConfig.attribution || "",
      bounds: baseConfig.bounds || undefined,
      errorTileUrl: TRANSPARENT_TILE,
      maxZoom: baseConfig.maxZoom,
      minZoom: baseConfig.minZoom,
      noWrap: Boolean(baseConfig.noWrap),
      opacity: 1,
      tileSize: baseConfig.tileSize,
      zoomOffset: baseConfig.zoomOffset
    });

    tileLayer.on("tileload", function () {
      if (!baseLayerState.hasLoadedTile) {
        baseLayerState.hasLoadedTile = true;
        baseLayerState.activeMode = "localTiles";

        if (MAPL.app && typeof MAPL.app.setStatus === "function") {
          MAPL.app.setStatus("ローカル地図タイルを表示しています。");
        }
      }
    });

    tileLayer.on("tileerror", function () {
      baseLayerState.tileErrorCount += 1;

      if (!baseLayerState.hasLoadedTile && !baseLayerState.missingTileNoticeShown) {
        baseLayerState.missingTileNoticeShown = true;
        baseLayerState.activeMode = mode === "auto" ? "blank" : "localTiles";

        if (MAPL.app && typeof MAPL.app.setStatus === "function") {
          MAPL.app.setStatus("ローカル地図タイルが見つからないため、白地背景のまま表示しています。");
        }
      }
    });

    tileLayer.addTo(layerRefs.base);
    baseLayerState.activeMode = "localTiles";
    return tileLayer;
  }

  function getBaseMapConfig() {
    var config = window.MAPL_CONFIG && window.MAPL_CONFIG.baseMap
      ? window.MAPL_CONFIG.baseMap
      : null;

    return normalizeBaseMapConfig(config);
  }

  function normalizeBaseMapConfig(config) {
    var nextConfig = config || {};

    return {
      attribution: nextConfig.attribution || "",
      bounds: Array.isArray(nextConfig.bounds) ? nextConfig.bounds : null,
      maxZoom: toFiniteNumber(nextConfig.maxZoom, 18),
      minZoom: toFiniteNumber(nextConfig.minZoom, 0),
      mode: nextConfig.mode || "auto",
      noWrap: nextConfig.noWrap !== undefined ? Boolean(nextConfig.noWrap) : true,
      tileSize: toFiniteNumber(nextConfig.tileSize, 256),
      tileUrlTemplate: nextConfig.tileUrlTemplate || "./tiles/{z}/{x}/{y}.png",
      zoomOffset: toFiniteNumber(nextConfig.zoomOffset, 0)
    };
  }

  function toFiniteNumber(value, fallback) {
    var parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function getBaseLayerSummary() {
    if (baseLayerState.configuredMode === "blank") {
      return "白地背景";
    }

    if (baseLayerState.hasLoadedTile) {
      return "ローカル地図タイル";
    }

    if (baseLayerState.configuredMode === "auto") {
      return "ローカル地図タイル自動検出";
    }

    return "ローカル地図タイル";
  }

  function getMap() {
    return mapInstance;
  }

  function getLayers() {
    return layerRefs;
  }

  function centerOn(lat, lng, zoom) {
    if (!mapInstance) {
      return;
    }

    mapInstance.setView([lat, lng], zoom || Math.max(mapInstance.getZoom(), 13));
  }

  function fitBounds(points) {
    if (!mapInstance || !points || !points.length) {
      return;
    }

    if (points.length === 1) {
      centerOn(points[0].lat, points[0].lng, 14);
      return;
    }

    var bounds = L.latLngBounds(points.map(function (point) {
      return [point.lat, point.lng];
    }));

    mapInstance.fitBounds(bounds.pad(0.2));
  }

  function drawDraftRoute(points, color) {
    clearDraftRoute();

    if (!layerRefs.draft || !points || !points.length) {
      return;
    }

    var latLngs = points.map(function (point) {
      return [point.lat, point.lng];
    });

    if (latLngs.length > 1) {
      L.polyline(latLngs, {
        color: color || "#2f6fed",
        weight: 4,
        opacity: 0.9,
        dashArray: "10 8"
      }).addTo(layerRefs.draft);
    }

    latLngs.forEach(function (latLng, index) {
      L.circleMarker(latLng, {
        radius: 6,
        color: color || "#2f6fed",
        fillColor: "#ffffff",
        fillOpacity: 1,
        weight: 2
      })
        .bindTooltip("点 " + (index + 1), {
          direction: "top",
          offset: [0, -6]
        })
        .addTo(layerRefs.draft);
    });
  }

  function clearDraftRoute() {
    if (layerRefs.draft) {
      layerRefs.draft.clearLayers();
    }
  }

  MAPL.map = {
    applyBaseLayer: applyBaseLayer,
    centerOn: centerOn,
    clearDraftRoute: clearDraftRoute,
    drawDraftRoute: drawDraftRoute,
    fitBounds: fitBounds,
    getBaseLayerSummary: getBaseLayerSummary,
    getLayers: getLayers,
    getMap: getMap,
    initMap: initMap
  };
})();
