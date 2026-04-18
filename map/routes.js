(function () {
  "use strict";

  // =========================
  // 状態
  // =========================
  const ROUTE_STORAGE_KEY = "mapRoutesData";

  const state = {
    routes: [],
    mode: "normal", // normal / create / edit
    tempRoute: null,
    selectedRouteId: null,
    draggingPointIndex: null
  };

  // =========================
  // DOM（後でindex.htmlに合わせる）
  // =========================
  let mapContainer;
  let mapImage;
  let svgLayer;

  // =========================
  // 初期化（外部から呼ぶ）
  // =========================
  window.ROUTES = {
    init,
    setModeCreate,
    confirmRoute,
    cancelRoute
  };

  function init(config) {
    mapContainer = config.mapContainer;
    mapImage = config.mapImage;
    svgLayer = config.svgLayer;

    loadData();
    bindEvents();
    renderAll();
  }

  // =========================
  // データ
  // =========================
  function loadData() {
    const saved = localStorage.getItem(ROUTE_STORAGE_KEY);
    if (saved) {
      state.routes = JSON.parse(saved);
    }
  }

  function saveData() {
    localStorage.setItem(ROUTE_STORAGE_KEY, JSON.stringify(state.routes));
  }

  // =========================
  // モード操作
  // =========================
  function setModeCreate() {
    state.mode = "create";
    state.tempRoute = {
      id: null,
      name: "",
      points: []
    };
  }

  function confirmRoute() {
    if (!state.tempRoute || state.tempRoute.points.length < 2) return;

    const route = {
      id: "R" + Date.now(),
      name: "経路" + (state.routes.length + 1),
      points: state.tempRoute.points,
      created_at: now(),
      updated_at: now()
    };

    state.routes.push(route);
    state.tempRoute = null;
    state.mode = "normal";

    saveData();
    renderAll();
  }

  function cancelRoute() {
    state.tempRoute = null;
    state.mode = "normal";
    renderAll();
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
    renderAll();
  }

  // =========================
  // ドラッグ（頂点移動）
  // =========================
  function onPointerMove(e) {
    if (state.draggingPointIndex === null) return;

    const route = getSelectedRoute();
    if (!route) return;

    const point = getPointOnImage(e.clientX, e.clientY);
    if (!point) return;

    route.points[state.draggingPointIndex] = point;
    route.updated_at = now();

    renderAll();
  }

  function onPointerUp() {
    if (state.draggingPointIndex !== null) {
      saveData();
    }
    state.draggingPointIndex = null;
  }

  // =========================
  // 描画
  // =========================
  function renderAll() {
    renderRoutes();
    renderTempRoute();
  }

  function renderRoutes() {
    svgLayer.innerHTML = "";

    state.routes.forEach((route) => {
      const polyline = createPolyline(route.points, false);

      polyline.addEventListener("click", () => {
        state.selectedRouteId = route.id;
        state.mode = "edit";
        renderAll();
      });

      svgLayer.appendChild(polyline);

      // 編集中：頂点表示
      if (state.selectedRouteId === route.id) {
        route.points.forEach((p, i) => {
          const c = createPointCircle(p, true);

          c.addEventListener("pointerdown", (e) => {
            e.stopPropagation();
            state.draggingPointIndex = i;
          });

          svgLayer.appendChild(c);
        });
      }
    });
  }

  function renderTempRoute() {
    if (!state.tempRoute) return;

    const polyline = createPolyline(state.tempRoute.points, true);
    svgLayer.appendChild(polyline);
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

  function createPointCircle(p, isEdit) {
    const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");

    c.setAttribute("cx", p.x);
    c.setAttribute("cy", p.y);
    c.setAttribute("r", isEdit ? 4 : 3);
    c.setAttribute("fill", "#fff");
    c.setAttribute("stroke", "#2563eb");
    c.setAttribute("stroke-width", "2");

    return c;
  }

  // =========================
  // 座標変換（画像基準）
  // =========================
  function getPointOnImage(clientX, clientY) {
    const rect = mapImage.getBoundingClientRect();

    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;

    if (x < 0 || x > 100 || y < 0 || y > 100) return null;

    return {
      x: round1(x),
      y: round1(y)
    };
  }

  function round1(v) {
    return Math.round(v * 10) / 10;
  }

  function now() {
    return new Date().toISOString();
  }

  function getSelectedRoute() {
    return state.routes.find(r => r.id === state.selectedRouteId);
  }

})();