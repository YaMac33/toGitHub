(function () {
  "use strict";

  const state = {
    initialized: false,
    mode: "normal", // normal / create / edit
    tempRoute: null,
    selectedRouteId: null,
    draggingPointIndex: null,
    mousePoint: null
  };

  let getMapData;
  let onChange;
  let onSelectRoute;
  let onDraftChange;

  let mapContainer;
  let svgLayer;

  window.ROUTES = {
    init,
    render,
    setModeCreate,
    setModeEdit,
    confirmRoute,
    cancelRoute,
    canConfirmRoute,
    select,
    clearSelection,
    getSelectedRouteId,
    getSelectedRoute,
    getMode
  };

  function init(config) {
    getMapData = config.getMapData;
    onChange = config.onChange;
    onSelectRoute = config.onSelectRoute || function () {};
    onDraftChange = config.onDraftChange || function () {};

    mapContainer = config.mapContainer;
    svgLayer = config.svgLayer;

    bindEvents();
    state.initialized = true;
    render();
  }

  function bindEvents() {
    mapContainer.addEventListener("click", onMapClick);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
  }

  function getMode() {
    return state.mode;
  }

  function getSelectedRouteId() {
    return state.selectedRouteId;
  }

  function getSelectedRoute() {
    const mapData = getMapData();
    if (!mapData || !Array.isArray(mapData.routes)) return null;
    return mapData.routes.find((route) => route.id === state.selectedRouteId) || null;
  }

  function setModeCreate() {
    state.mode = "create";
    state.selectedRouteId = null;
    state.draggingPointIndex = null;
    state.mousePoint = null;
    state.tempRoute = {
      name: "",
      points: []
    };
    onSelectRoute(null);
    onDraftChange();
    render();
  }

  function setModeEdit(routeId = state.selectedRouteId) {
    if (!routeId) return;
    select(routeId);
  }

  function confirmRoute() {
    if (!state.tempRoute || state.tempRoute.points.length < 2) return;

    const mapData = getMapData();
    const routes = Array.isArray(mapData.routes) ? mapData.routes : [];

    const newRoute = {
      id: "R" + Date.now(),
      name: "経路" + (routes.length + 1),
      points: clonePoints(state.tempRoute.points),
      created_at: nowIso(),
      updated_at: nowIso()
    };

    state.tempRoute = null;
    state.mode = "normal";
    state.selectedRouteId = newRoute.id;
    state.mousePoint = null;

    onDraftChange();
    onChange([...routes, newRoute]);
    onSelectRoute(newRoute.id);
  }

  function canConfirmRoute() {
    return Boolean(state.tempRoute && state.tempRoute.points.length >= 2);
  }

  function cancelRoute() {
    state.tempRoute = null;
    state.mousePoint = null;
    if (state.mode === "create") {
      state.mode = state.selectedRouteId ? "edit" : "normal";
    }
    onDraftChange();
    render();
  }

  function select(routeId, options = {}) {
    const silent = Boolean(options.silent);
    state.selectedRouteId = routeId || null;
    state.mode = state.selectedRouteId ? "edit" : "normal";
    state.draggingPointIndex = null;
    if (!silent) {
      onSelectRoute(state.selectedRouteId);
    }
    render();
  }

  function clearSelection(options = {}) {
    select(null, options);
  }

  function onMapClick(e) {
    if (state.mode !== "create") return;

    const point = getPointOnSvg(e.clientX, e.clientY);
    if (!point) return;

    state.tempRoute.points.push(point);
    onDraftChange();
    render();
  }

  function onPointerMove(e) {
    if (state.mode === "create") {
      state.mousePoint = getPointOnSvg(e.clientX, e.clientY);
      render();
      return;
    }

    if (state.draggingPointIndex === null) return;

    const selectedRoute = getSelectedRoute();
    if (!selectedRoute) return;

    const point = getPointOnSvg(e.clientX, e.clientY);
    if (!point) return;

    selectedRoute.points[state.draggingPointIndex] = point;
    selectedRoute.updated_at = nowIso();
    render();
  }

  function onPointerUp() {
    if (state.draggingPointIndex === null) return;

    state.draggingPointIndex = null;

    const mapData = getMapData();
    const routes = Array.isArray(mapData.routes) ? mapData.routes : [];
    onChange([...routes]);
  }

  function render() {
    if (!state.initialized || !svgLayer) return;

    svgLayer.innerHTML = "";

    const mapData = getMapData();
    const routes = Array.isArray(mapData.routes) ? mapData.routes : [];

    routes.forEach((route) => {
      const isSelected = route.id === state.selectedRouteId;
      drawRoute(route, { selected: isSelected, temp: false });

      if (isSelected) {
        drawRoutePoints(route);
      }
    });

    if (state.tempRoute) {
      drawTempRoute();
    }
  }

  function drawRoute(route, options) {
    const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    polyline.setAttribute("points", buildPointsString(route.points));
    polyline.setAttribute("class", [
      "route-line",
      options.selected ? "selected" : "",
      options.temp ? "temp" : ""
    ].filter(Boolean).join(" "));

    polyline.addEventListener("click", (e) => {
      e.stopPropagation();
      select(route.id);
    });

    svgLayer.appendChild(polyline);
  }

  function drawTempRoute() {
    const points = clonePoints(state.tempRoute.points);

    if (state.mousePoint) {
      points.push(state.mousePoint);
    }

    if (!points.length) return;

    const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    polyline.setAttribute("points", buildPointsString(points));
    polyline.setAttribute("class", "route-line temp");
    svgLayer.appendChild(polyline);

    state.tempRoute.points.forEach((point) => {
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", point.x);
      circle.setAttribute("cy", point.y);
      circle.setAttribute("r", "1.3");
      circle.setAttribute("class", "route-point");
      svgLayer.appendChild(circle);
    });
  }

  function drawRoutePoints(route) {
    route.points.forEach((point, index) => {
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", point.x);
      circle.setAttribute("cy", point.y);
      circle.setAttribute("r", state.draggingPointIndex === index ? "1.8" : "1.4");
      circle.setAttribute("class", [
        "route-point",
        state.draggingPointIndex === index ? "dragging" : ""
      ].filter(Boolean).join(" "));

      circle.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        state.draggingPointIndex = index;
      });

      svgLayer.appendChild(circle);
    });
  }

  function getPointOnSvg(clientX, clientY) {
    const rect = svgLayer.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;

    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;

    if (x < 0 || x > 100 || y < 0 || y > 100) {
      return null;
    }

    return {
      x: round1(x),
      y: round1(y)
    };
  }

  function buildPointsString(points) {
    return points.map((point) => `${point.x},${point.y}`).join(" ");
  }

  function clonePoints(points) {
    return points.map((point) => ({ x: point.x, y: point.y }));
  }

  function round1(value) {
    return Math.round(value * 10) / 10;
  }

  function nowIso() {
    return new Date().toISOString();
  }
})();
