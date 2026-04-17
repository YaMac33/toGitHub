(function () {
  "use strict";

  const STORAGE_KEY = "mapAppCurrentData";

  const state = {
    mapData: {
      map_id: "map_default",
      map_name: "地点マップ",
      map_image_file: "map.png",
      updated_at: "",
      pins: []
    },
    mode: "normal", // normal / add / edit
    tempPin: null,
    selectedPinId: null,
    editingPinId: null
  };

  const mapContainer = document.getElementById("mapContainer");
  const pinLayer = document.getElementById("pinLayer");
  const tempPin = document.getElementById("tempPin");
  const coordX = document.getElementById("coordX");
  const coordY = document.getElementById("coordY");
  const pinList = document.getElementById("pinList");
  const pinDetail = document.getElementById("pinDetail");
  const status = document.getElementById("status");

  const btnAddMode = document.getElementById("btnAddMode");
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

  init();

  function init() {
    loadData();
    renderAll();
    bindEvents();
    updateStatus();
  }

  function bindEvents() {
    btnAddMode.addEventListener("click", toggleAddMode);
    btnExport.addEventListener("click", exportData);
    fileImport.addEventListener("change", importData);

    mapContainer.addEventListener("click", onMapClick);
    pinForm.addEventListener("submit", onSubmitPinForm);
    btnCancelModal.addEventListener("click", closeModal);
    modalBackdrop.addEventListener("click", (e) => {
      if (e.target === modalBackdrop) {
        closeModal();
      }
    });
  }

  function loadData() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      state.mapData = JSON.parse(saved);
      return;
    }

    if (window.APP_DATA && window.APP_DATA.mapPins) {
      state.mapData = structuredClone(window.APP_DATA.mapPins);
    }
  }

  function saveData() {
    state.mapData.updated_at = nowIso();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.mapData));
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function toggleAddMode() {
    if (state.mode === "add") {
      state.mode = "normal";
      clearTempPin();
    } else {
      state.mode = "add";
      state.editingPinId = null;
    }
    updateStatus();
  }

  function updateStatus() {
    if (state.mode === "add") {
      status.textContent = "ピン追加モード";
    } else if (state.mode === "edit") {
      status.textContent = "編集中";
    } else {
      status.textContent = "通常モード";
    }
  }

  function onMapClick(e) {
    if (state.mode !== "add") return;

    const rect = mapContainer.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    state.tempPin = {
      x: round1(x),
      y: round1(y)
    };

    showTempPin(state.tempPin.x, state.tempPin.y);
    coordX.textContent = state.tempPin.x.toFixed(1);
    coordY.textContent = state.tempPin.y.toFixed(1);

    openCreateModal();
  }

  function round1(value) {
    return Math.round(value * 10) / 10;
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
    modalTitle.textContent = "ピン登録";
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

    modalTitle.textContent = "ピン編集";
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
    updateStatus();
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
    const pin = {
      id: "P" + Date.now(),
      name,
      x: state.tempPin.x,
      y: state.tempPin.y,
      category: pinCategory.value.trim(),
      note: pinNote.value.trim(),
      created_at: nowIso(),
      updated_at: nowIso()
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
    renderPins();
    renderList();
    renderDetail();
  }

  function renderPins() {
    pinLayer.innerHTML = "";

    state.mapData.pins.forEach((pin) => {
      const el = document.createElement("div");
      el.className = "pin";
      if (pin.id === state.selectedPinId) {
        el.classList.add("selected");
      }

      el.style.left = pin.x + "%";
      el.style.top = pin.y + "%";
      el.title = pin.name;

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        state.selectedPinId = pin.id;
        renderAll();
      });

      pinLayer.appendChild(el);
    });
  }

  function renderList() {
    pinList.innerHTML = "";

    if (!state.mapData.pins.length) {
      const li = document.createElement("li");
      li.textContent = "ピンはありません";
      pinList.appendChild(li);
      return;
    }

    state.mapData.pins.forEach((pin) => {
      const li = document.createElement("li");
      li.textContent = pin.category ? `【${pin.category}】${pin.name}` : pin.name;

      if (pin.id === state.selectedPinId) {
        li.classList.add("active");
      }

      li.addEventListener("click", () => {
        state.selectedPinId = pin.id;
        renderAll();
      });

      pinList.appendChild(li);
    });
  }

  function renderDetail() {
    const pin = getSelectedPin();

    if (!pin) {
      pinDetail.textContent = "未選択";
      return;
    }

    pinDetail.innerHTML = `
      <div>名称: ${escapeHtml(pin.name)}</div>
      <div>区分: ${escapeHtml(pin.category || "")}</div>
      <div>X: ${pin.x.toFixed(1)}</div>
      <div>Y: ${pin.y.toFixed(1)}</div>
      <div>備考: ${escapeHtml(pin.note || "")}</div>
      <div class="detail-actions">
        <button type="button" id="btnEditPin">編集</button>
        <button type="button" class="danger" id="btnDeletePin">削除</button>
      </div>
    `;

    document.getElementById("btnEditPin").addEventListener("click", () => {
      openEditModal(pin);
    });

    document.getElementById("btnDeletePin").addEventListener("click", () => {
      deleteSelectedPin();
    });
  }

  function getSelectedPin() {
    return state.mapData.pins.find((pin) => pin.id === state.selectedPinId) || null;
  }

  function deleteSelectedPin() {
    const pin = getSelectedPin();
    if (!pin) return;

    if (!confirm(`「${pin.name}」を削除しますか？`)) return;

    state.mapData.pins = state.mapData.pins.filter((item) => item.id !== pin.id);
    state.selectedPinId = null;
    saveData();
    renderAll();
  }

  function exportData() {
    const text =
`window.APP_DATA = window.APP_DATA || {};
window.APP_DATA.mapPins = ${JSON.stringify(state.mapData, null, 2)};`;

    const blob = new Blob([text], { type: "text/javascript" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "pins.js";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function importData(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = reader.result;
        const imported = parseMapPinsFromJs(text);

        if (!imported || !Array.isArray(imported.pins)) {
          throw new Error("データ形式が不正です");
        }

        state.mapData = imported;
        state.selectedPinId = null;
        state.editingPinId = null;
        clearTempPin();
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

  function parseMapPinsFromJs(text) {
    const sandbox = { APP_DATA: {} };
    new Function("window", text)(sandbox);
    return sandbox.APP_DATA.mapPins;
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