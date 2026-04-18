(function () {
  "use strict";

  // =========================
  // 内部状態（UI専用）
  // =========================
  const state = {
    mode: "normal", // normal / create / edit
    tempRoute: null,
    selectedRouteId: null,
    draggingPointIndex: null,
    mousePoint: null
  };

  // =========================
  // 外部連携（app.js）
  // =========================
  let getMapData;
  let onChange;

  // =========================
  // DOM
  // =========================
  let mapContainer;
  let mapImage;
  let svgLayer;

  // =========================
  // 公開API
  // =========================
  window.ROUTES = {
    init,
    setModeCreate,
    confirmRoute,
    cancelRoute,
    render
  };

  function init(config) {
    getMapData = config.getMapData;
    onChange = config.onChange;

    mapContainer = config.mapContainer;
    mapImage = config.mapImage;
    svgLayer = config.svgLayer;

    bindEvents();
    render();
  }

  // =========================
  // モード操作
  // =========================
  function setModeCreate() {
    state.mode = "create";
    state.tempRoute = {
      name: "",
      points: []
    };
  }

  function confirmRoute() {
    if (!state.tempRoute || state.tempRoute.points.length < 2) return;

    const mapData = getMapData();

    const newRoute = {
      id: "R" + Date.now(),
      name: "経路" + (mapData.routes.length + 1),
      points: state.tempRoute.points,
      created_at: now(),
      updated_at: now()
    };

    const newRoutes = [...mapData.routes, newRoute];

    state.tempRoute = null;
    state.mode = "normal";

    onChange(newRoutes);
  }

  function cancelRoute() {
    state.tempRoute = null;
    state.mode = "normal";
    render();
  }

  // =========================
  // イベント
  // =========================
  function bindEvents() {
    mapContainer.addEventListener("click", onMapClick);

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }

  function onMapClick(e) {
    if (state.mode !== "create") return;

    const point = getPointOnImage(e.clientX, e.clientY);
    if (!point) return;

    state.tempRoute.points.push(point);
    render();
  }

  // =========================
  // ドラッグ（頂点移動）
  // =========================
  function onPointerMove(e) {
    state.mousePoint = getPointOnImage(e.clientX, e.clientY);

    if (state.draggingPointIndex === null) {
      render(); // 仮線追従
      return;
    }

    const mapData = getMapData();
    const route = mapData.routes.find(r => r.id === state.selectedRouteId);
    if (!route) return;

    const point = getPointOnImage(e.clientX, e.clientY);
    if (!point) return;

    route.points[state.draggingPointIndex] = point;
    route.updated_at = now();

    render();
  }

  function onPointerUp() {
    if (state.draggingPointIndex !== null) {
      const mapData = getMapData();
      onChange([...mapData.routes]); // 保存トリガー
    }
    state.draggingPointIndex = null;
  }

  // =========================
  // 描画
  // =========================
  function render() {
    svgLayer.innerHTML = "";

    const mapData = getMapData();

    // 保存済み経路
    mapData.routes.forEach(route => {
      drawRoute(route, false);

      if (route.id === state.selectedRouteId) {
        drawPoints(route);
      }
    });

    // 作成中
    if (state.tempRoute) {
      drawTempRoute();
    }
  }

  function drawRoute(route, isTemp) {
    const el = createPolyline(route.points, isTemp);

    el.addEventListener("click", () => {
      state.selectedRouteId = route.id;
      state.mode = "edit";
      render();
    });

    svgLayer.appendChild(el);
  }

  function drawTempRoute() {
    if (!state.tempRoute) return;

    let points = [...state.tempRoute.points];

    // 仮線：最後 + マウス
    if (state.mousePoint) {
      points = [...points, state.mousePoint];
    }

    const el = createPolyline(points, true);
    svgLayer.appendChild(el);
  }

  function drawPoints(route) {
    route.points.forEach((p, i) => {
      const c = createPointCircle(p);

      c.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        state.draggingPointIndex = i;
      });

      svgLayer.appendChild(c);
    });
  }

  // =========================
  // SVG生成
  // =========================
  function createPolyline(points, isTemp) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", "polyline");

    el.setAttribute("fill", "none");
    el.setAttribute("stroke", isTemp ? "#94a3b8" : "#2563eb");
    el.setAttribute("stroke-width", isTemp ? "2" : "4");
    el.setAttribute("stroke-linecap", "round");
    el.setAttribute("stroke-linejoin", "round");

    el.setAttribute(
      "points",
      points.map(p => `${p.x},${p.y}`).join(" ")
    );

    return el;
  }

  function createPointCircle(p) {
    const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");

    c.setAttribute("cx", p.x);
    c.setAttribute("cy", p.y);
    c.setAttribute("r", 4);
    c.setAttribute("fill", "#fff");
    c.setAttribute("stroke", "#2563eb");
    c.setAttribute("stroke-width", "2");

    return c;
  }

  // =========================
  // 座標
  // =========================
  function getPointOnImage(clientX, clientY) {
    const rect = mapImage.getBoundingClientRect();

    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;

    if (x < 0 || x > 100 || y < 0 || y > 100) return null;

    return { x: round1(x), y: round1(y) };
  }

  function round1(v) {
    return Math.round(v * 10) / 10;
  }

  function now() {
    return new Date().toISOString();
  }

})();