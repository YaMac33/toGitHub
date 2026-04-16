(function () {
  "use strict";

  // =========================
  // 状態
  // =========================
  let state = {
    pins: [],
    addMode: false,
    temp: null
  };

  // =========================
  // DOM
  // =========================
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

  // =========================
  // 初期化
  // =========================
  init();

  function init() {
    loadData();
    renderPins();
    renderList();
  }

  // =========================
  // データロード
  // =========================
  function loadData() {
    // localStorage優先
    const saved = localStorage.getItem("mapPins");
    if (saved) {
      state.pins = JSON.parse(saved);
      return;
    }

    // pins.js
    if (window.APP_DATA && window.APP_DATA.mapPins) {
      state.pins = window.APP_DATA.mapPins.pins || [];
    }
  }

  // =========================
  // 保存
  // =========================
  function save() {
    localStorage.setItem("mapPins", JSON.stringify(state.pins));
  }

  // =========================
  // 座標取得
  // =========================
  mapContainer.addEventListener("click", (e) => {
    if (!state.addMode) return;

    const rect = mapContainer.getBoundingClientRect();

    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    state.temp = { x, y };

    coordX.textContent = x.toFixed(1);
    coordY.textContent = y.toFixed(1);

    showTempPin(x, y);
  });

  function showTempPin(x, y) {
    tempPin.style.left = x + "%";
    tempPin.style.top = y + "%";
    tempPin.classList.remove("hidden");
  }

  // =========================
  // ピン追加モード
  // =========================
  btnAddMode.addEventListener("click", () => {
    state.addMode = !state.addMode;
    status.textContent = state.addMode ? "ピン追加モード" : "通常モード";
  });

  // =========================
  // 仮ピン確定（ダブルクリック）
  // =========================
  mapContainer.addEventListener("dblclick", () => {
    if (!state.temp) return;

    const name = prompt("名称を入力してください");
    if (!name) return;

    const pin = {
      id: "P" + Date.now(),
      name: name,
      x: state.temp.x,
      y: state.temp.y
    };

    state.pins.push(pin);
    save();

    state.temp = null;
    tempPin.classList.add("hidden");

    renderPins();
    renderList();
  });

  // =========================
  // ピン描画
  // =========================
  function renderPins() {
    pinLayer.innerHTML = "";

    state.pins.forEach((pin) => {
      const el = document.createElement("div");
      el.className = "pin";
      el.style.left = pin.x + "%";
      el.style.top = pin.y + "%";

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        showDetail(pin);
      });

      pinLayer.appendChild(el);
    });
  }

  // =========================
  // 一覧
  // =========================
  function renderList() {
    pinList.innerHTML = "";

    state.pins.forEach((pin) => {
      const li = document.createElement("li");
      li.textContent = pin.name;

      li.addEventListener("click", () => {
        showDetail(pin);
      });

      pinList.appendChild(li);
    });
  }

  // =========================
  // 詳細
  // =========================
  function showDetail(pin) {
    pinDetail.innerHTML = `
      <div>名称: ${pin.name}</div>
      <div>X: ${pin.x.toFixed(1)}</div>
      <div>Y: ${pin.y.toFixed(1)}</div>
      <button id="delBtn">削除</button>
    `;

    document.getElementById("delBtn").onclick = () => {
      if (!confirm("削除しますか？")) return;

      state.pins = state.pins.filter(p => p.id !== pin.id);
      save();

      renderPins();
      renderList();
      pinDetail.innerHTML = "未選択";
    };
  }

  // =========================
  // エクスポート
  // =========================
  btnExport.addEventListener("click", () => {
    const data = {
      map_id: "map_" + Date.now(),
      pins: state.pins
    };

    const text =
`window.APP_DATA = window.APP_DATA || {};
window.APP_DATA.mapPins = ${JSON.stringify(data, null, 2)};`;

    download("pins.js", text);
  });

  function download(filename, text) {
    const blob = new Blob([text], { type: "text/javascript" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
  }

})();