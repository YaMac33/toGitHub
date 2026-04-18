(function () {
  "use strict";

  const STORAGE_KEY = "mapAppCurrentData";
  const DRAG_THRESHOLD = 4;

  const state = {
    mapData: {
      map_id: "map_default",
      map_name: "地点マップ",
      map_image_file: "map.png",
      updated_at: "",
      pins: [],
      routes: []
    },
    mode: "normal", // normal / add / edit
    tempPin: null,
    selectedPinId: null,
    editingPinId: null,

    pinDrag: {
      isPointerDown: false,
      isDragging: false,
      pinId: null,
      moved: false
    },

    listDrag: {
      draggingPinId: null
    }
  };

  const mapContainer = document.getElementById("mapContainer");
  const mapImage = document.getElementById("mapImage");
  const pinLayer = document.getElementById("pinLayer");
  const routeLayer = document.getElementById("routeLayer");
  const tempPin = document.getElementById("tempPin");
  const coordX = document.getElementById("coordX");
  const coordY = document.getElementById("coordY");
  const pinList = document.getElementById("pinList");
  const pinDetail = document.getElementById("pinDetail");
  const routeList = document.getElementById("routeList");
  const routeDetail = document.getElementById("routeDetail");
  const status = document.getElementById("status");

  const btnAddMode = document.getElementById("btnAddMode");
  const btnRouteMode = document.getElementById("btnRouteMode");
  const btnRouteConfirm = document.getElementById("btnRouteConfirm");
  const btnRouteCancel = document.getElementById("btnRouteCancel");
  const btnExport = document.getElementById("btnExport");
  const fileImport = document.getElementById("fileImport");

  const modalBackdrop = document.getElementById("modalBackdrop");
  const modalTitle = document.getElementById("modalTitle");
  const pinForm = document.getElementById("pinForm");
  const pinName = document.getElementById("pinName");
  const pinCategory = document.getElementById("pinCategory");
  const pinNote = document.getElementById("pinNote");
  const pinX = document.getElementById("pinX");
  const pinY = document.getElementById("pinY");
  const btnSavePin = document.getElementById("btnSavePin");
  const btnCancelModal = document.getElementById("btnCancelModal");
  const btnCloseModalIcon = document.getElementById("btnCloseModalIcon");

  init();

  function init() {
    loadData();
    ensureMapDataShape();
    syncOverlayLayersToImage();
    bindEvents();
    initRoutesModule();
    renderAll();
  }

  function bindEvents() {
    btnAddMode.addEventListener("click", toggleAddMode);
    btnRouteMode.addEventListener("click", onClickRouteMode);
    btnRouteConfirm.addEventListener("click", onClickRouteConfirm);
    btnRouteCancel.addEventListener("click", onClickRouteCancel);

    btnExport.addEventListener("click", exportData);
    fileImport.addEventListener("change", importData);

    mapContainer.addEventListener("click", onMapClick);
    pinForm.addEventListener("submit", onSubmitPinForm);
    btnCancelModal.addEventListener("click", closeModal);
    if (btnCloseModalIcon) btnCloseModalIcon.addEventListener("click", closeModal);

    modalBackdrop.addEventListener("click", (e) => {
      if (e.target === modalBackdrop) {
        closeModal();
      }
    });

    mapImage.addEventListener("load", () => {
      syncOverlayLayersToImage();
      renderAll();
    });

    window.addEventListener("resize", () => {
      syncOverlayLayersToImage();
      renderAll();
    });

    window.addEventListener("pointermove", onWindowPointerMove);
    window.addEventListener("pointerup", onWindowPointerUp);
    window.addEventListener("pointercancel", onWindowPointerUp);
  }

  function initRoutesModule() {
    if (!window.ROUTES) return;

    window.ROUTES.init({
      getMapData: () => state.mapData,
      onChange: handleRoutesChange,
      onSelectRoute: handleRouteSelect,
      mapContainer,
      svgLayer: routeLayer
    });
  }

  function handleRoutesChange(newRoutes) {
    state.mapData.routes = Array.isArray(newRoutes) ? newRoutes : [];
    saveData();
    renderAll();
  }

  function handleRouteSelect() {
    state.selectedPinId = null;
    renderAll();
  }

  function loadData() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      state.mapData = JSON.parse(saved);
      return;
    }

    if (window.APP_DATA) {
      if (window.APP_DATA.mapData) {
        state.mapData = cloneObject(window.APP_DATA.mapData);
        return;
      }

      if (window.APP_DATA.mapPins) {
        state.mapData = cloneObject(window.APP_DATA.mapPins);
        return;
      }
    }
  }

  function ensureMapDataShape() {
    if (!Array.isArray(state.mapData.pins)) {
      state.mapData.pins = [];
    }
    if (!Array.isArray(state.mapData.routes)) {
      state.mapData.routes = [];
    }
  }

  function cloneObject(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function saveData() {
    state.mapData.updated_at = nowIso();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.mapData));
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function toggleAddMode() {
    if (window.ROUTES) {
      window.ROUTES.cancelRoute();
      window.ROUTES.clearSelection({ silent: true });
    }

    if (state.mode === "add") {
      state.mode = "normal";
      clearTempPin();
    } else {
      state.mode = "add";
      state.editingPinId = null;
      state.selectedPinId = null;
    }

    renderAll();
  }

  function onClickRouteMode() {
    clearTempPin();
    state.mode = "normal";
    state.selectedPinId = null;

    if (window.ROUTES) {
      window.ROUTES.setModeCreate();
    }

    renderAll();
  }

  function onClickRouteConfirm() {
    if (window.ROUTES) {
      window.ROUTES.confirmRoute();
    }
    renderAll();
  }

  function onClickRouteCancel() {
    if (window.ROUTES) {
      window.ROUTES.cancelRoute();
      window.ROUTES.clearSelection({ silent: true });
    }
    renderAll();
  }

  function updateStatus() {
    const routeMode = window.ROUTES ? window.ROUTES.getMode() : "normal";

    if (state.pinDrag.isDragging) {
      status.textContent = "ピン移動中...";
      status.classList.add("active");
      return;
    }

    if (routeMode === "create") {
      status.textContent = "経路追加モード（地図をクリック）";
      status.classList.add("active");
      return;
    }

    if (routeMode === "edit") {
      status.textContent = "経路編集中";
      status.classList.add("active");
      return;
    }

    if (state.mode === "add") {
      status.textContent = "追加モード（地図をクリック）";
      status.classList.add("active");
      return;
    }

    if (state.mode === "edit") {
      status.textContent = "編集中";
      status.classList.add("active");
      return;
    }

    status.textContent = "通常モード";
    status.classList.remove("active");
  }

  function onMapClick(e) {
    if (state.mode !== "add") return;
    if (state.pinDrag.isDragging) return;

    const point = getPointOnImage(e.clientX, e.clientY);
    if (!point) return;

    state.tempPin = {
      x: round1(point.x),
      y: round1(point.y)
    };

    showTempPin(state.tempPin.x, state.tempPin.y);
    coordX.textContent = state.tempPin.x.toFixed(1);
    coordY.textContent = state.tempPin.y.toFixed(1);

    openCreateModal();
  }

  function round1(value) {
    return Math.round(value * 10) / 10;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function showTempPin(x, y) {
    tempPin.style.left = x + "%";
    tempPin.style.top = y + "%";
    tempPin.classList.remove("hidden");
  }

  function clearTempPin() {
    state.tempPin = null;
    tempPin.classList.add("hidden");
    coordX.textContent = "--";
    coordY.textContent = "--";
  }

  function openCreateModal() {
    if (!state.tempPin) return;

    state.mode = "add";
    updateStatus();
    modalTitle.textContent = "新規ピンの登録";
    btnSavePin.textContent = "登録";

    pinForm.reset();
    pinX.value = state.tempPin.x.toFixed(1);
    pinY.value = state.tempPin.y.toFixed(1);

    modalBackdrop.classList.remove("hidden");
    pinName.focus();
  }

  function openEditModal(pin) {
    state.mode = "edit";
    state.editingPinId = pin.id;
    updateStatus();

    modalTitle.textContent = "ピンの編集";
    btnSavePin.textContent = "更新";

    pinName.value = pin.name || "";
    pinCategory.value = pin.category || "";
    pinNote.value = pin.note || "";
    pinX.value = pin.x.toFixed(1);
    pinY.value = pin.y.toFixed(1);

    modalBackdrop.classList.remove("hidden");
    pinName.focus();
  }

  function closeModal() {
    modalBackdrop.classList.add("hidden");

    if (state.mode === "add") {
      clearTempPin();
    }

    state.editingPinId = null;
    state.mode = "normal";
    renderAll();
  }

  function onSubmitPinForm(e) {
    e.preventDefault();

    const name = pinName.value.trim();
    if (!name) return;

    if (state.mode === "add" && state.tempPin) {
      createPin(name);
    } else if (state.mode === "edit" && state.editingPinId) {
      updatePin(name);
    }

    saveData();
    renderAll();
    closeModal();
  }

  function createPin(name) {
    const timestamp = nowIso();

    const pin = {
      id: "P" + Date.now(),
      name,
      x: state.tempPin.x,
      y: state.tempPin.y,
      category: pinCategory.value.trim(),
      note: pinNote.value.trim(),
      created_at: timestamp,
      updated_at: timestamp
    };

    state.mapData.pins.push(pin);
    state.selectedPinId = pin.id;
  }

  function updatePin(name) {
    const pin = state.mapData.pins.find((item) => item.id === state.editingPinId);
    if (!pin) return;

    pin.name = name;
    pin.category = pinCategory.value.trim();
    pin.note = pinNote.value.trim();
    pin.updated_at = nowIso();

    state.selectedPinId = pin.id;
  }

  function renderAll() {
    syncOverlayLayersToImage();
    renderPins();
    renderPinList();
    renderPinDetail();
    renderRouteList();
    renderRouteDetail();

    if (window.ROUTES) {
      window.ROUTES.render();
    }

    updateStatus();
  }

  function renderPins() {
    const tempPinEl = tempPin;
    pinLayer.innerHTML = "";
    pinLayer.appendChild(tempPinEl);

    state.mapData.pins.forEach((pin) => {
      const el = document.createElement("div");
      el.className = "pin";
      el.dataset.pinId = pin.id;

      if (pin.id === state.selectedPinId) {
        el.classList.add("selected");
      }
      if (pin.id === state.pinDrag.pinId && state.pinDrag.isDragging) {
        el.classList.add("dragging");
      }

      el.style.left = pin.x + "%";
      el.style.top = pin.y + "%";

      const tooltip = document.createElement("div");
      tooltip.className = "pin-tooltip";
      tooltip.textContent = pin.name;
      el.appendChild(tooltip);

      el.addEventListener("pointerdown", (e) => {
        onPinPointerDown(e, pin.id, el);
      });

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        if (state.pinDrag.moved) return;

        state.selectedPinId = pin.id;
        if (window.ROUTES) {
          window.ROUTES.clearSelection({ silent: true });
        }
        renderAll();
      });

      pinLayer.appendChild(el);
    });
  }

  function renderPinList() {
    pinList.innerHTML = "";

    if (!state.mapData.pins.length) {
      const li = document.createElement("li");
      li.textContent = "ピンはまだ登録されていません";
      li.style.justifyContent = "center";
      li.style.color = "var(--text-muted)";
      li.style.backgroundColor = "transparent";
      li.style.border = "none";
      pinList.appendChild(li);
      return;
    }

    state.mapData.pins.forEach((pin) => {
      const li = document.createElement("li");
      li.dataset.pinId = pin.id;
      li.draggable = true;

      if (pin.id === state.selectedPinId) {
        li.classList.add("active");
        setTimeout(() => li.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
      }

      const badgeHtml = pin.category ? `<span class="pin-badge">${escapeHtml(pin.category)}</span>` : "";

      li.innerHTML = `
        <div class="pin-list-content">
          ${badgeHtml}
          <span class="pin-list-name">${escapeHtml(pin.name)}</span>
        </div>
        <span class="material-symbols-outlined drag-handle" title="ドラッグで並べ替え">drag_indicator</span>
      `;

      li.addEventListener("click", () => {
        state.selectedPinId = pin.id;
        if (window.ROUTES) {
          window.ROUTES.clearSelection({ silent: true });
        }
        renderAll();
      });

      li.addEventListener("dragstart", (e) => {
        onListDragStart(e, pin.id, li);
      });

      li.addEventListener("dragover", (e) => {
        onListDragOver(e, pin.id, li);
      });

      li.addEventListener("dragleave", () => {
        li.classList.remove("drop-before", "drop-after");
      });

      li.addEventListener("drop", (e) => {
        onListDrop(e, pin.id, li);
      });

      li.addEventListener("dragend", () => {
        onListDragEnd();
      });

      pinList.appendChild(li);
    });
  }

  function renderPinDetail() {
    const pin = getSelectedPin();

    if (!pin) {
      pinDetail.innerHTML = '<div class="empty-state">ピンを選択するか、追加モードで地図をクリックしてください。</div>';
      return;
    }

    pinDetail.innerHTML = `
      <div class="detail-grid">
        <div class="detail-label">名称</div>
        <div class="detail-value">${escapeHtml(pin.name)}</div>

        <div class="detail-label">区分</div>
        <div class="detail-value">${pin.category ? `<span class="pin-badge">${escapeHtml(pin.category)}</span>` : '<span style="color:var(--border)">-</span>'}</div>

        <div class="detail-label">座標</div>
        <div class="detail-value" style="font-family: monospace;">X: ${pin.x.toFixed(1)} / Y: ${pin.y.toFixed(1)}</div>

        <div class="detail-label">備考</div>
        <div class="detail-value" style="white-space: pre-wrap;">${pin.note ? escapeHtml(pin.note) : '<span style="color:var(--border)">-</span>'}</div>
      </div>
      <div class="detail-actions">
        <button type="button" class="btn btn-outline" id="btnEditPin">
          <span class="material-symbols-outlined" style="font-size: 16px;">edit</span> 編集
        </button>
        <button type="button" class="btn btn-danger" id="btnDeletePin">
          <span class="material-symbols-outlined" style="font-size: 16px;">delete</span> 削除
        </button>
      </div>
    `;

    document.getElementById("btnEditPin").addEventListener("click", () => {
      openEditModal(pin);
    });

    document.getElementById("btnDeletePin").addEventListener("click", () => {
      deleteSelectedPin();
    });
  }

  function renderRouteList() {
    routeList.innerHTML = "";

    if (!state.mapData.routes.length) {
      const li = document.createElement("li");
      li.textContent = "経路はまだ登録されていません";
      li.style.justifyContent = "center";
      li.style.color = "var(--text-muted)";
      li.style.backgroundColor = "transparent";
      li.style.border = "none";
      routeList.appendChild(li);
      return;
    }

    const selectedRouteId = window.ROUTES ? window.ROUTES.getSelectedRouteId() : null;

    state.mapData.routes.forEach((route) => {
      const li = document.createElement("li");
      li.dataset.routeId = route.id;

      if (route.id === selectedRouteId) {
        li.classList.add("active");
        setTimeout(() => li.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
      }

      li.innerHTML = `
        <div class="route-list-content">
          <span class="route-badge">経路</span>
          <span class="route-list-name">${escapeHtml(route.name)}</span>
          <span class="route-list-sub">点数: ${route.points.length}</span>
        </div>
      `;

      li.addEventListener("click", () => {
        state.selectedPinId = null;
        if (window.ROUTES) {
          window.ROUTES.select(route.id);
        } else {
          renderAll();
        }
      });

      routeList.appendChild(li);
    });
  }

  function renderRouteDetail() {
    const selectedRoute = window.ROUTES ? window.ROUTES.getSelectedRoute() : null;

    if (!selectedRoute) {
      routeDetail.innerHTML = '<div class="empty-state">経路を選択するか、経路追加モードで地図をクリックしてください。</div>';
      return;
    }

    const startPoint = selectedRoute.points[0];
    const endPoint = selectedRoute.points[selectedRoute.points.length - 1];

    routeDetail.innerHTML = `
      <div class="detail-grid">
        <div class="detail-label">名称</div>
        <div class="detail-value">${escapeHtml(selectedRoute.name)}</div>

        <div class="detail-label">点数</div>
        <div class="detail-value">${selectedRoute.points.length}</div>

        <div class="detail-label">始点</div>
        <div class="detail-value" style="font-family: monospace;">X: ${startPoint.x.toFixed(1)} / Y: ${startPoint.y.toFixed(1)}</div>

        <div class="detail-label">終点</div>
        <div class="detail-value" style="font-family: monospace;">X: ${endPoint.x.toFixed(1)} / Y: ${endPoint.y.toFixed(1)}</div>
      </div>
      <div class="detail-actions">
        <button type="button" class="btn btn-danger" id="btnDeleteRoute">
          <span class="material-symbols-outlined" style="font-size: 16px;">delete</span> 削除
        </button>
      </div>
    `;

    document.getElementById("btnDeleteRoute").addEventListener("click", () => {
      deleteSelectedRoute();
    });
  }

  function getSelectedPin() {
    return state.mapData.pins.find((pin) => pin.id === state.selectedPinId) || null;
  }

  function deleteSelectedPin() {
    const pin = getSelectedPin();
    if (!pin) return;

    if (!confirm(`「${pin.name}」を削除しますか？\n※この操作は取り消せません。`)) return;

    state.mapData.pins = state.mapData.pins.filter((item) => item.id !== pin.id);
    state.selectedPinId = null;
    saveData();
    renderAll();
  }

  function deleteSelectedRoute() {
    if (!window.ROUTES) return;

    const route = window.ROUTES.getSelectedRoute();
    if (!route) return;

    if (!confirm(`「${route.name}」を削除しますか？\n※この操作は取り消せません。`)) return;

    state.mapData.routes = state.mapData.routes.filter((item) => item.id !== route.id);
    window.ROUTES.clearSelection({ silent: true });
    saveData();
    renderAll();
  }

  function getPinById(pinId) {
    return state.mapData.pins.find((pin) => pin.id === pinId) || null;
  }

  function onPinPointerDown(e, pinId, el) {
    if (state.mode !== "normal") return;
    if (e.button !== 0) return;

    e.stopPropagation();

    state.selectedPinId = pinId;
    if (window.ROUTES) {
      window.ROUTES.clearSelection({ silent: true });
    }

    state.pinDrag.isPointerDown = true;
    state.pinDrag.isDragging = false;
    state.pinDrag.pinId = pinId;
    state.pinDrag.moved = false;

    el.setPointerCapture?.(e.pointerId);

    renderAll();
  }

  function onWindowPointerMove(e) {
    if (!state.pinDrag.isPointerDown || !state.pinDrag.pinId) return;

    const point = getPointOnImage(e.clientX, e.clientY);
    if (!point) return;

    const pin = getPinById(state.pinDrag.pinId);
    if (!pin) return;

    const dx = Math.abs(pin.x - point.x);
    const dy = Math.abs(pin.y - point.y);

    if (!state.pinDrag.isDragging) {
      if (dx < getPercentThresholdX() && dy < getPercentThresholdY()) {
        return;
      }
      state.pinDrag.isDragging = true;
      state.pinDrag.moved = true;
      updateStatus();
    }

    pin.x = round1(clamp(point.x, 0, 100));
    pin.y = round1(clamp(point.y, 0, 100));
    pin.updated_at = nowIso();

    coordX.textContent = pin.x.toFixed(1);
    coordY.textContent = pin.y.toFixed(1);

    renderAll();
  }

  function onWindowPointerUp() {
    if (!state.pinDrag.isPointerDown) return;

    const shouldSave = state.pinDrag.isDragging;

    state.pinDrag.isPointerDown = false;
    state.pinDrag.isDragging = false;
    const moved = state.pinDrag.moved;
    state.pinDrag.pinId = null;

    if (shouldSave) {
      saveData();
    }

    setTimeout(() => {
      state.pinDrag.moved = false;
    }, 0);

    if (!moved) {
      updateStatus();
      return;
    }

    renderAll();
  }

  function getPercentThresholdX() {
    const imageRect = getRenderedImageRect();
    if (!imageRect) return 0.5;
    return (DRAG_THRESHOLD / imageRect.width) * 100;
  }

  function getPercentThresholdY() {
    const imageRect = getRenderedImageRect();
    if (!imageRect) return 0.5;
    return (DRAG_THRESHOLD / imageRect.height) * 100;
  }

  function getRenderedImageRect() {
    const containerRect = mapContainer.getBoundingClientRect();

    const naturalWidth = mapImage.naturalWidth || containerRect.width;
    const naturalHeight = mapImage.naturalHeight || containerRect.height;

    if (!naturalWidth || !naturalHeight) return null;

    const containerRatio = containerRect.width / containerRect.height;
    const imageRatio = naturalWidth / naturalHeight;

    let width;
    let height;
    let left;
    let top;

    if (imageRatio > containerRatio) {
      width = containerRect.width;
      height = width / imageRatio;
      left = containerRect.left;
      top = containerRect.top + (containerRect.height - height) / 2;
    } else {
      height = containerRect.height;
      width = height * imageRatio;
      top = containerRect.top;
      left = containerRect.left + (containerRect.width - width) / 2;
    }

    return {
      left,
      top,
      width,
      height
    };
  }

  function syncOverlayLayersToImage() {
    const imageRect = getRenderedImageRect();
    const containerRect = mapContainer.getBoundingClientRect();
    if (!imageRect) return;

    const left = imageRect.left - containerRect.left;
    const top = imageRect.top - containerRect.top;

    pinLayer.style.left = left + "px";
    pinLayer.style.top = top + "px";
    pinLayer.style.width = imageRect.width + "px";
    pinLayer.style.height = imageRect.height + "px";

    routeLayer.style.left = left + "px";
    routeLayer.style.top = top + "px";
    routeLayer.style.width = imageRect.width + "px";
    routeLayer.style.height = imageRect.height + "px";
    routeLayer.setAttribute("viewBox", "0 0 100 100");
    routeLayer.setAttribute("preserveAspectRatio", "none");
  }

  function getPointOnImage(clientX, clientY) {
    const rect = getRenderedImageRect();
    if (!rect) return null;

    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;

    return {
      x: clamp(x, 0, 100),
      y: clamp(y, 0, 100)
    };
  }

  function onListDragStart(e, pinId, li) {
    state.listDrag.draggingPinId = pinId;
    li.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", pinId);
  }

  function onListDragOver(e, targetPinId, li) {
    if (!state.listDrag.draggingPinId) return;
    if (state.listDrag.draggingPinId === targetPinId) return;

    e.preventDefault();
    clearListDropClasses();

    const rect = li.getBoundingClientRect();
    const offset = e.clientY - rect.top;
    const isBefore = offset < rect.height / 2;

    li.classList.add(isBefore ? "drop-before" : "drop-after");
  }

  function onListDrop(e, targetPinId, li) {
    e.preventDefault();

    const draggingPinId = state.listDrag.draggingPinId;
    if (!draggingPinId || draggingPinId === targetPinId) {
      clearListDropClasses();
      return;
    }

    const rect = li.getBoundingClientRect();
    const offset = e.clientY - rect.top;
    const insertBefore = offset < rect.height / 2;

    movePinInArray(draggingPinId, targetPinId, insertBefore);
    clearListDropClasses();
    saveData();
    renderAll();
  }

  function onListDragEnd() {
    state.listDrag.draggingPinId = null;
    clearListDropClasses();

    pinList.querySelectorAll("li").forEach((li) => {
      li.classList.remove("dragging");
    });
  }

  function clearListDropClasses() {
    pinList.querySelectorAll("li").forEach((li) => {
      li.classList.remove("drop-before", "drop-after");
    });
  }

  function movePinInArray(draggingPinId, targetPinId, insertBefore) {
    const pins = state.mapData.pins;
    const fromIndex = pins.findIndex((pin) => pin.id === draggingPinId);
    const targetIndex = pins.findIndex((pin) => pin.id === targetPinId);

    if (fromIndex === -1 || targetIndex === -1) return;
    if (fromIndex === targetIndex) return;

    const [draggingPin] = pins.splice(fromIndex, 1);

    let insertIndex = pins.findIndex((pin) => pin.id === targetPinId);
    if (insertIndex === -1) {
      pins.push(draggingPin);
      return;
    }

    if (!insertBefore) {
      insertIndex += 1;
    }

    pins.splice(insertIndex, 0, draggingPin);
  }

  function exportData() {
    const text =
`window.APP_DATA = window.APP_DATA || {};
window.APP_DATA.mapData = ${JSON.stringify(state.mapData, null, 2)};`;

    const blob = new Blob([text], { type: "text/javascript" });
    const a = document.createElement("a");
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = "pins.js";
    a.click();
    URL.revokeObjectURL(url);
  }

  function importData(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = reader.result;
        const imported = parseMapDataFromJs(text);

        if (!imported || !Array.isArray(imported.pins)) {
          throw new Error("データ形式が不正です");
        }

        state.mapData = imported;
        ensureMapDataShape();
        state.selectedPinId = null;
        state.editingPinId = null;
        clearTempPin();

        if (window.ROUTES) {
          window.ROUTES.clearSelection({ silent: true });
          window.ROUTES.cancelRoute();
        }

        saveData();
        renderAll();
        alert("インポートしました。");
      } catch (error) {
        alert("インポートに失敗しました。");
      } finally {
        fileImport.value = "";
      }
    };
    reader.readAsText(file, "UTF-8");
  }

  function parseMapDataFromJs(text) {
    const sandbox = { APP_DATA: {} };
    new Function("window", text)(sandbox);

    if (sandbox.APP_DATA.mapData) {
      return sandbox.APP_DATA.mapData;
    }

    if (sandbox.APP_DATA.mapPins) {
      return sandbox.APP_DATA.mapPins;
    }

    return null;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }
})();