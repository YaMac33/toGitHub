(function () {
  var MAPL = window.MAPL = window.MAPL || {};

  MAPL.state = {
    cursorLatLng: null,
    draftRoute: null,
    draftSourceId: null,
    mode: "select",
    selectedId: null,
    selectedType: null,
    statusMessage: "準備完了"
  };

  function init() {
    MAPL.utils.ensureDataShape(window.MAPL_DATA || {});
    MAPL.ui.init();
    MAPL.map.initMap();
    refreshAll("読み込み完了: " + MAPL.map.getBaseLayerSummary());
  }

  function refreshAll(statusMessage) {
    if (statusMessage) {
      setStatus(statusMessage);
    }

    MAPL.pins.renderPins();
    MAPL.routes.renderRoutes();
    MAPL.pins.refreshSelection();
    MAPL.routes.refreshSelection();
    MAPL.routes.syncDraftRendering();
    MAPL.ui.renderAll();
  }

  function setStatus(message) {
    MAPL.state.statusMessage = message;
    MAPL.ui.renderStatus();
  }

  function setMode(mode) {
    if (mode === "pin") {
      if (MAPL.state.mode === "route") {
        finishRouteEditing();
      }

      MAPL.state.mode = "pin";
      MAPL.state.selectedType = null;
      MAPL.state.selectedId = null;
      refreshAll("ピン追加モードに切り替えました。");
      return;
    }

    MAPL.state.mode = "select";
    refreshAll("通常モードに切り替えました。");
  }

  function clearSelection() {
    if (MAPL.state.mode === "route") {
      MAPL.routes.finishEditing();
    }

    MAPL.state.mode = "select";
    MAPL.state.selectedType = null;
    MAPL.state.selectedId = null;
    MAPL.state.draftRoute = null;
    MAPL.state.draftSourceId = null;
    refreshAll("選択を解除しました。");
  }

  function handleMapClick(event) {
    var lat = event.latlng.lat;
    var lng = event.latlng.lng;

    if (MAPL.state.mode === "pin") {
      var pin = MAPL.pins.addPin(lat, lng);
      MAPL.state.selectedType = "pin";
      MAPL.state.selectedId = pin.id;
      refreshAll("ピンを追加しました。");
      return;
    }

    if (MAPL.state.mode === "route" && MAPL.state.draftRoute) {
      MAPL.routes.addDraftPoint(lat, lng);
      refreshAll("経路点を追加しました。");
    }
  }

  function handleMapMouseMove(event) {
    MAPL.state.cursorLatLng = {
      lat: event.latlng.lat,
      lng: event.latlng.lng
    };
    MAPL.ui.renderCursor(MAPL.state.cursorLatLng);
  }

  function handleMapLeave() {
    MAPL.state.cursorLatLng = null;
    MAPL.ui.renderCursor(null);
  }

  function selectPin(pinId) {
    if (!MAPL.pins.getPinById(pinId)) {
      return;
    }

    if (MAPL.state.mode === "route") {
      MAPL.routes.finishEditing();
      MAPL.state.mode = "select";
    }

    MAPL.state.selectedType = "pin";
    MAPL.state.selectedId = pinId;
    refreshAll("ピンを選択しました。");
  }

  function updateSelectedPin(nextValues) {
    if (MAPL.state.selectedType !== "pin" || !MAPL.state.selectedId) {
      return;
    }

    MAPL.pins.updatePin(MAPL.state.selectedId, nextValues);
    MAPL.pins.refreshSelection();
    MAPL.ui.renderPinList();
    MAPL.ui.renderDetailPanel();
    setStatus("ピンを更新しました。");
  }

  function startRouteCreation() {
    MAPL.routes.startNewDraft();
    refreshAll("新しい経路の作成を開始しました。");
  }

  function editRoute(routeId) {
    var draft = MAPL.routes.startEdit(routeId);

    if (!draft) {
      setStatus("対象の経路が見つかりません。");
      return;
    }

    refreshAll("経路編集モードに入りました。");
  }

  function selectRoute(routeId) {
    if (!MAPL.routes.getRouteById(routeId)) {
      return;
    }

    if (MAPL.state.mode === "route" && MAPL.state.draftSourceId !== routeId) {
      MAPL.routes.finishEditing();
      MAPL.state.mode = "select";
    }

    MAPL.state.selectedType = "route";
    MAPL.state.selectedId = routeId;
    refreshAll("経路を選択しました。");
  }

  function updateRouteDraft(nextValues) {
    if (MAPL.state.mode !== "route") {
      return;
    }

    MAPL.routes.updateDraftMeta(nextValues);
    MAPL.ui.renderDetailPanel();
    MAPL.ui.renderRouteList();
    setStatus("編集中の経路を更新しました。");
  }

  function undoRoutePoint() {
    if (MAPL.state.mode !== "route") {
      return;
    }

    MAPL.routes.undoDraftPoint();
    refreshAll("経路点を1つ戻しました。");
  }

  function removeRoutePoint(index) {
    if (MAPL.state.mode !== "route") {
      return;
    }

    MAPL.routes.removeDraftPoint(index);
    refreshAll("経路点を削除しました。");
  }

  function saveRoute() {
    if (MAPL.state.mode !== "route") {
      return;
    }

    var result = MAPL.routes.saveDraft();

    if (!result.ok) {
      setStatus(result.message);
      MAPL.ui.renderAll();
      return;
    }

    MAPL.state.selectedType = "route";
    MAPL.state.selectedId = result.routeId;
    refreshAll("経路を保存しました。");
  }

  function finishRouteEditing() {
    if (MAPL.state.mode === "route") {
      MAPL.routes.finishEditing();
    }

    MAPL.state.mode = "select";

    if (!MAPL.state.selectedId || !MAPL.routes.getRouteById(MAPL.state.selectedId)) {
      MAPL.state.selectedType = null;
      MAPL.state.selectedId = null;
    }

    refreshAll("経路編集を終了しました。");
  }

  function toggleRoute(routeId, visible) {
    MAPL.routes.toggleVisibility(routeId, visible);
    refreshAll("経路表示を更新しました。");
  }

  function deleteItem(kind, id) {
    var deleted = false;

    if (kind === "pin") {
      deleted = MAPL.pins.deletePin(id);
    } else if (kind === "route") {
      deleted = MAPL.routes.deleteRoute(id);
      if (MAPL.state.draftSourceId === id) {
        MAPL.routes.finishEditing();
        MAPL.state.mode = "select";
      }
    }

    if (MAPL.state.selectedId === id) {
      MAPL.state.selectedId = null;
      MAPL.state.selectedType = null;
    }

    refreshAll(deleted ? "削除しました。" : "削除対象が見つかりませんでした。");
  }

  function importData(text, target) {
    var result = MAPL.storage.importText(text, target);

    if (!result.ok) {
      setStatus(result.message);
      return result;
    }

    MAPL.state.draftRoute = null;
    MAPL.state.draftSourceId = null;
    MAPL.state.mode = "select";
    MAPL.state.selectedType = null;
    MAPL.state.selectedId = null;
    refreshAll("インポートを反映しました。");
    return result;
  }

  document.addEventListener("DOMContentLoaded", init);

  MAPL.app = {
    clearSelection: clearSelection,
    deleteItem: deleteItem,
    editRoute: editRoute,
    finishRouteEditing: finishRouteEditing,
    handleMapClick: handleMapClick,
    handleMapLeave: handleMapLeave,
    handleMapMouseMove: handleMapMouseMove,
    importData: importData,
    removeRoutePoint: removeRoutePoint,
    saveRoute: saveRoute,
    selectPin: selectPin,
    selectRoute: selectRoute,
    setMode: setMode,
    setStatus: setStatus,
    startRouteCreation: startRouteCreation,
    toggleRoute: toggleRoute,
    undoRoutePoint: undoRoutePoint,
    updateRouteDraft: updateRouteDraft,
    updateSelectedPin: updateSelectedPin
  };
})();
