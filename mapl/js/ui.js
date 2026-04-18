(function () {
  var MAPL = window.MAPL = window.MAPL || {};

  var refs = {};

  function init() {
    refs = {
      appModal: document.getElementById("appModal"),
      btnClearSelection: document.getElementById("btnClearSelection"),
      btnExport: document.getElementById("btnExport"),
      btnImport: document.getElementById("btnImport"),
      btnPinMode: document.getElementById("btnPinMode"),
      btnRouteMode: document.getElementById("btnRouteMode"),
      currentModeText: document.getElementById("currentModeText"),
      currentSelectionText: document.getElementById("currentSelectionText"),
      cursorLatLng: document.getElementById("cursorLatLng"),
      detailPanel: document.getElementById("detailPanel"),
      emptyDetail: document.getElementById("emptyDetail"),
      footerHintText: document.getElementById("footerHintText"),
      footerModeText: document.getElementById("footerModeText"),
      modalBody: document.getElementById("modalBody"),
      modalClose: document.getElementById("modalClose"),
      modalTitle: document.getElementById("modalTitle"),
      modeHintText: document.getElementById("modeHintText"),
      pinCategoryInput: document.getElementById("pinCategoryInput"),
      pinCenterBtn: document.getElementById("pinCenterBtn"),
      pinCountText: document.getElementById("pinCountText"),
      pinDeleteBtn: document.getElementById("pinDeleteBtn"),
      pinEditor: document.getElementById("pinEditor"),
      pinLatInput: document.getElementById("pinLatInput"),
      pinList: document.getElementById("pinList"),
      pinLngInput: document.getElementById("pinLngInput"),
      pinMemoInput: document.getElementById("pinMemoInput"),
      pinNameInput: document.getElementById("pinNameInput"),
      routeColorInput: document.getElementById("routeColorInput"),
      routeCountText: document.getElementById("routeCountText"),
      routeEditor: document.getElementById("routeEditor"),
      routeFinishBtn: document.getElementById("routeFinishBtn"),
      routeList: document.getElementById("routeList"),
      routeNameInput: document.getElementById("routeNameInput"),
      routePointCount: document.getElementById("routePointCount"),
      routePointList: document.getElementById("routePointList"),
      routeSaveBtn: document.getElementById("routeSaveBtn"),
      routeUndoBtn: document.getElementById("routeUndoBtn"),
      statusMessage: document.getElementById("statusMessage")
    };

    bindEvents();
  }

  function bindEvents() {
    refs.btnPinMode.addEventListener("click", function () {
      MAPL.app.setMode("pin");
    });

    refs.btnRouteMode.addEventListener("click", function () {
      MAPL.app.startRouteCreation();
    });

    refs.btnExport.addEventListener("click", function () {
      openExportModal();
    });

    refs.btnImport.addEventListener("click", function () {
      openImportModal();
    });

    refs.btnClearSelection.addEventListener("click", function () {
      MAPL.app.clearSelection();
    });

    refs.modalClose.addEventListener("click", closeModal);
    refs.appModal.querySelector(".modal-backdrop").addEventListener("click", closeModal);

    refs.pinNameInput.addEventListener("input", updatePinFromForm);
    refs.pinCategoryInput.addEventListener("input", updatePinFromForm);
    refs.pinMemoInput.addEventListener("input", updatePinFromForm);
    refs.pinLatInput.addEventListener("change", updatePinFromForm);
    refs.pinLngInput.addEventListener("change", updatePinFromForm);

    refs.pinCenterBtn.addEventListener("click", function () {
      if (MAPL.state.selectedId) {
        MAPL.pins.focusPin(MAPL.state.selectedId);
      }
    });

    refs.pinDeleteBtn.addEventListener("click", function () {
      if (MAPL.state.selectedId) {
        openDeleteModal("pin", MAPL.state.selectedId);
      }
    });

    refs.routeNameInput.addEventListener("input", updateRouteDraftFromForm);
    refs.routeColorInput.addEventListener("input", updateRouteDraftFromForm);

    refs.routeUndoBtn.addEventListener("click", function () {
      MAPL.app.undoRoutePoint();
    });

    refs.routeSaveBtn.addEventListener("click", function () {
      MAPL.app.saveRoute();
    });

    refs.routeFinishBtn.addEventListener("click", function () {
      MAPL.app.finishRouteEditing();
    });
  }

  function renderAll() {
    renderHeaderState();
    renderPinList();
    renderRouteList();
    renderDetailPanel();
    renderStatus();
  }

  function renderHeaderState() {
    var modeLabel = getModeLabel();
    var selectionLabel = getSelectionLabel();
    var hint = getModeHint();

    refs.currentModeText.textContent = modeLabel;
    refs.footerModeText.textContent = modeLabel;
    refs.currentSelectionText.textContent = selectionLabel;
    refs.modeHintText.textContent = hint;
    refs.footerHintText.textContent = hint;

    refs.btnPinMode.classList.toggle("active", MAPL.state.mode === "pin");
    refs.btnRouteMode.classList.toggle("active", MAPL.state.mode === "route");
  }

  function renderPinList() {
    var pins = MAPL.pins.getAllPins();
    refs.pinCountText.textContent = pins.length + "件";
    refs.pinList.innerHTML = "";

    if (!pins.length) {
      refs.pinList.appendChild(createEmptyMessage("ピンはまだありません。"));
      return;
    }

    pins.forEach(function (pin) {
      var item = document.createElement("article");
      item.className = "list-item";

      if (MAPL.state.selectedType === "pin" && MAPL.state.selectedId === pin.id) {
        item.classList.add("active");
      }

      var title = document.createElement("div");
      title.className = "list-title";
      title.innerHTML = "<strong></strong><span class=\"count-chip\"></span>";
      title.querySelector("strong").textContent = pin.name || "無題";
      title.querySelector("span").textContent = pin.category || "未分類";

      var meta = document.createElement("div");
      meta.className = "list-meta";
      meta.textContent = MAPL.utils.formatLatLng(pin.lat, pin.lng);

      var actions = document.createElement("div");
      actions.className = "item-actions";
      actions.appendChild(createActionButton("選択", function () {
        MAPL.app.selectPin(pin.id);
      }));
      actions.appendChild(createActionButton("中央表示", function () {
        MAPL.pins.focusPin(pin.id);
      }));
      actions.appendChild(createActionButton("編集", function () {
        MAPL.app.selectPin(pin.id);
      }));
      actions.appendChild(createActionButton("削除", function () {
        openDeleteModal("pin", pin.id);
      }, "danger"));

      item.appendChild(title);
      item.appendChild(meta);
      item.appendChild(actions);
      refs.pinList.appendChild(item);
    });
  }

  function renderRouteList() {
    var routes = MAPL.routes.getAllRoutes();
    refs.routeCountText.textContent = routes.length + "件";
    refs.routeList.innerHTML = "";

    if (!routes.length) {
      refs.routeList.appendChild(createEmptyMessage("経路はまだありません。"));
      return;
    }

    routes.forEach(function (route) {
      var item = document.createElement("article");
      item.className = "list-item";

      if (MAPL.state.selectedType === "route" && MAPL.state.selectedId === route.id && MAPL.state.mode !== "route") {
        item.classList.add("active");
      }

      if (MAPL.state.mode === "route" && MAPL.state.draftSourceId === route.id) {
        item.classList.add("active");
      }

      var title = document.createElement("div");
      title.className = "list-title";
      title.innerHTML = "<strong></strong><span class=\"count-chip\"></span>";
      title.querySelector("strong").textContent = route.name || "無題";
      title.querySelector("span").textContent = route.points.length + "点";

      var meta = document.createElement("div");
      meta.className = "list-meta";
      meta.textContent = (route.visible ? "表示中" : "非表示") + " / 色 " + route.color;

      var toggleRow = document.createElement("label");
      toggleRow.className = "toggle-row";
      var toggle = document.createElement("input");
      toggle.type = "checkbox";
      toggle.checked = route.visible;
      toggle.addEventListener("change", function () {
        MAPL.app.toggleRoute(route.id, toggle.checked);
      });
      var toggleLabel = document.createElement("span");
      toggleLabel.textContent = "表示";
      toggleRow.appendChild(toggle);
      toggleRow.appendChild(toggleLabel);

      var actions = document.createElement("div");
      actions.className = "item-actions";
      actions.appendChild(createActionButton("選択", function () {
        MAPL.app.selectRoute(route.id);
      }));
      actions.appendChild(createActionButton("編集", function () {
        MAPL.app.editRoute(route.id);
      }));
      actions.appendChild(createActionButton("中央表示", function () {
        MAPL.routes.focusRoute(route.id);
      }));
      actions.appendChild(createActionButton("削除", function () {
        openDeleteModal("route", route.id);
      }, "danger"));

      item.appendChild(title);
      item.appendChild(meta);
      item.appendChild(toggleRow);
      item.appendChild(actions);
      refs.routeList.appendChild(item);
    });
  }

  function renderDetailPanel() {
    var selectedPin = MAPL.state.selectedType === "pin" ? MAPL.pins.getPinById(MAPL.state.selectedId) : null;
    var isRouteEditing = MAPL.state.mode === "route";
    var selectedRoute = MAPL.state.mode === "route"
      ? MAPL.state.draftRoute
      : (MAPL.state.selectedType === "route" ? MAPL.routes.getRouteById(MAPL.state.selectedId) : null);

    refs.emptyDetail.classList.toggle("hidden", Boolean(selectedPin || selectedRoute));
    refs.pinEditor.classList.toggle("hidden", !selectedPin);
    refs.routeEditor.classList.toggle("hidden", !selectedRoute);

    if (selectedPin) {
      refs.pinNameInput.value = selectedPin.name || "";
      refs.pinCategoryInput.value = selectedPin.category || "";
      refs.pinMemoInput.value = selectedPin.memo || "";
      refs.pinLatInput.value = MAPL.utils.formatCoord(selectedPin.lat);
      refs.pinLngInput.value = MAPL.utils.formatCoord(selectedPin.lng);
    }

    if (selectedRoute) {
      refs.routeNameInput.value = selectedRoute.name || "";
      refs.routeColorInput.value = selectedRoute.color || "#2f6fed";
      refs.routePointCount.textContent = selectedRoute.points.length + "点";
      refs.routeNameInput.disabled = !isRouteEditing;
      refs.routeColorInput.disabled = !isRouteEditing;
      refs.routeUndoBtn.disabled = !isRouteEditing;
      refs.routeSaveBtn.disabled = !isRouteEditing;
      refs.routeFinishBtn.disabled = !isRouteEditing;
      renderRoutePoints(selectedRoute.points, isRouteEditing);
    } else {
      refs.routeNameInput.disabled = true;
      refs.routeColorInput.disabled = true;
      refs.routeUndoBtn.disabled = true;
      refs.routeSaveBtn.disabled = true;
      refs.routeFinishBtn.disabled = true;
    }
  }

  function renderRoutePoints(points, editable) {
    refs.routePointList.innerHTML = "";

    if (!points.length) {
      refs.routePointList.appendChild(createEmptyMessage("地図をクリックして経路点を追加してください。"));
      return;
    }

    points.forEach(function (point, index) {
      var item = document.createElement("div");
      item.className = "route-point-item";

      var meta = document.createElement("div");
      meta.innerHTML = "<strong>点 " + (index + 1) + "</strong><div class=\"route-point-meta\">" +
        MAPL.utils.formatLatLng(point.lat, point.lng) + "</div>";

      item.appendChild(meta);

      if (editable) {
        item.appendChild(createActionButton("削除", function () {
          MAPL.app.removeRoutePoint(index);
        }, "danger"));
      }

      refs.routePointList.appendChild(item);
    });
  }

  function renderStatus() {
    refs.statusMessage.textContent = MAPL.state.statusMessage || "準備完了";
  }

  function renderCursor(latLng) {
    if (!latLng) {
      refs.cursorLatLng.textContent = "--";
      return;
    }

    refs.cursorLatLng.textContent = MAPL.utils.formatLatLng(latLng.lat, latLng.lng);
  }

  function updatePinFromForm() {
    if (MAPL.state.selectedType !== "pin") {
      return;
    }

    MAPL.app.updateSelectedPin({
      name: refs.pinNameInput.value,
      category: refs.pinCategoryInput.value,
      memo: refs.pinMemoInput.value,
      lat: refs.pinLatInput.value,
      lng: refs.pinLngInput.value
    });
  }

  function updateRouteDraftFromForm() {
    if (MAPL.state.mode !== "route") {
      return;
    }

    MAPL.app.updateRouteDraft({
      name: refs.routeNameInput.value,
      color: refs.routeColorInput.value
    });
  }

  function openModal(title, bodyNode) {
    refs.modalTitle.textContent = title;
    refs.modalBody.innerHTML = "";
    refs.modalBody.appendChild(bodyNode);
    refs.appModal.classList.remove("hidden");
    refs.appModal.setAttribute("aria-hidden", "false");
  }

  function closeModal() {
    refs.appModal.classList.add("hidden");
    refs.appModal.setAttribute("aria-hidden", "true");
    refs.modalBody.innerHTML = "";
  }

  function openExportModal() {
    var wrap = document.createElement("div");
    var textarea = document.createElement("textarea");
    textarea.className = "modal-textarea";
    textarea.readOnly = true;

    var actions = document.createElement("div");
    actions.className = "export-actions";

    function setText(mode) {
      if (mode === "pins") {
        textarea.value = MAPL.storage.serializePins();
      } else if (mode === "routes") {
        textarea.value = MAPL.storage.serializeRoutes();
      } else {
        textarea.value = MAPL.storage.serializeAll();
      }
      textarea.focus();
      textarea.select();
    }

    actions.appendChild(createActionButton("全体を書き出す", function () {
      setText("all");
    }));
    actions.appendChild(createActionButton("pins.js 用", function () {
      setText("pins");
    }));
    actions.appendChild(createActionButton("routes.js 用", function () {
      setText("routes");
    }));
    actions.appendChild(createActionButton("クリップボードへコピー", function () {
      textarea.select();

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(textarea.value).then(function () {
          MAPL.app.setStatus("エクスポート内容をクリップボードへコピーしました。");
        }).catch(function () {
          MAPL.app.setStatus("コピーに失敗しました。テキストを手動でコピーしてください。");
        });
      }
    }));

    wrap.appendChild(createInfoText("出力内容はそのまま `data/pins.js` や `data/routes.js` に置き換えできます。"));
    wrap.appendChild(actions);
    wrap.appendChild(textarea);

    openModal("エクスポート", wrap);
    setText("all");
  }

  function openImportModal() {
    var wrap = document.createElement("div");
    wrap.className = "import-grid";

    wrap.appendChild(createInfoText("`.js` ファイルを選ぶか、下の欄へ JS テキストを貼り付けて取り込みます。"));

    var fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.id = "importFileInput";
    fileInput.accept = ".js,text/javascript,application/javascript";

    var textarea = document.createElement("textarea");
    textarea.className = "modal-textarea";
    textarea.placeholder = "window.MAPL_DATA = window.MAPL_DATA || {};\nwindow.MAPL_DATA.pins = [];\nwindow.MAPL_DATA.routes = [];";

    fileInput.addEventListener("change", function () {
      var file = fileInput.files && fileInput.files[0];

      if (!file) {
        return;
      }

      var reader = new FileReader();
      reader.onload = function () {
        textarea.value = String(reader.result || "");
      };
      reader.readAsText(file, "utf-8");
    });

    var actions = document.createElement("div");
    actions.className = "import-actions";
    actions.appendChild(createActionButton("全体を反映", function () {
      importText(textarea.value, "all");
    }));
    actions.appendChild(createActionButton("pins のみ反映", function () {
      importText(textarea.value, "pins");
    }));
    actions.appendChild(createActionButton("routes のみ反映", function () {
      importText(textarea.value, "routes");
    }));

    wrap.appendChild(fileInput);
    wrap.appendChild(textarea);
    wrap.appendChild(actions);

    openModal("インポート", wrap);
  }

  function importText(text, target) {
    var result = MAPL.app.importData(text, target);

    if (result.ok) {
      closeModal();
    }
  }

  function openDeleteModal(kind, id) {
    var wrap = document.createElement("div");
    wrap.appendChild(createInfoText((kind === "pin" ? "このピン" : "この経路") + "を削除します。よろしいですか。"));

    var actions = document.createElement("div");
    actions.className = "confirm-actions";
    actions.appendChild(createActionButton("削除する", function () {
      MAPL.app.deleteItem(kind, id);
      closeModal();
    }, "danger"));
    actions.appendChild(createActionButton("キャンセル", closeModal));

    wrap.appendChild(actions);
    openModal("削除確認", wrap);
  }

  function createActionButton(label, handler, extraClass) {
    var button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", handler);

    if (extraClass) {
      button.classList.add(extraClass);
    }

    return button;
  }

  function createEmptyMessage(text) {
    var item = document.createElement("div");
    item.className = "list-empty";
    item.textContent = text;
    return item;
  }

  function createInfoText(text) {
    var note = document.createElement("p");
    note.className = "import-note";
    note.textContent = text;
    return note;
  }

  function getModeLabel() {
    if (MAPL.state.mode === "pin") {
      return "ピン追加";
    }

    if (MAPL.state.mode === "route") {
      return "経路編集中";
    }

    return "通常";
  }

  function getSelectionLabel() {
    if (MAPL.state.selectedType === "pin") {
      var pin = MAPL.pins.getPinById(MAPL.state.selectedId);
      return pin ? "ピン: " + pin.name : "なし";
    }

    if (MAPL.state.mode === "route" && MAPL.state.draftRoute) {
      return "経路: " + (MAPL.state.draftRoute.name || "新しい経路");
    }

    if (MAPL.state.selectedType === "route") {
      var route = MAPL.routes.getRouteById(MAPL.state.selectedId);
      return route ? "経路: " + route.name : "なし";
    }

    return "なし";
  }

  function getModeHint() {
    if (MAPL.state.mode === "pin") {
      return "地図クリックでピンを追加します。";
    }

    if (MAPL.state.mode === "route") {
      return "地図クリックで経路点を追加し、保存で確定します。";
    }

    return "一覧または地図上の対象を選択して編集できます。";
  }

  MAPL.ui = {
    closeModal: closeModal,
    init: init,
    openDeleteModal: openDeleteModal,
    openExportModal: openExportModal,
    openImportModal: openImportModal,
    renderAll: renderAll,
    renderCursor: renderCursor,
    renderDetailPanel: renderDetailPanel,
    renderHeaderState: renderHeaderState,
    renderPinList: renderPinList,
    renderRouteList: renderRouteList,
    renderStatus: renderStatus
  };
})();
