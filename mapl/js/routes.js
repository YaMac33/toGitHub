(function () {
  var MAPL = window.MAPL = window.MAPL || {};

  var routeLayerMap = {};

  function getAllRoutes() {
    return window.MAPL_DATA.routes;
  }

  function getRouteById(routeId) {
    return getAllRoutes().find(function (route) {
      return route.id === routeId;
    }) || null;
  }

  function renderRoutes() {
    var layers = MAPL.map.getLayers();
    var routeLayer = layers && layers.routes;

    if (!routeLayer) {
      return;
    }

    routeLayer.clearLayers();
    routeLayerMap = {};

    getAllRoutes().forEach(function (route) {
      if (!route.visible || route.points.length === 0) {
        return;
      }

      var polyline = L.polyline(route.points.map(function (point) {
        return [point.lat, point.lng];
      }), {
        color: route.color || "#2f6fed",
        weight: 4,
        opacity: 0.9
      });

      polyline.on("click", function () {
        MAPL.app.selectRoute(route.id);
      });

      polyline.bindTooltip(route.name || "無題の経路");
      polyline.addTo(routeLayer);
      routeLayerMap[route.id] = polyline;
    });

    refreshSelection();
  }

  function startNewDraft() {
    var draft = MAPL.utils.createDefaultRoute();

    MAPL.state.draftRoute = draft;
    MAPL.state.draftSourceId = null;
    MAPL.state.mode = "route";
    MAPL.state.selectedType = "route";
    MAPL.state.selectedId = draft.id;

    syncDraftRendering();
    return draft;
  }

  function startEdit(routeId) {
    var route = getRouteById(routeId);

    if (!route) {
      return null;
    }

    MAPL.state.draftRoute = MAPL.utils.clone(route);
    MAPL.state.draftSourceId = route.id;
    MAPL.state.mode = "route";
    MAPL.state.selectedType = "route";
    MAPL.state.selectedId = route.id;

    syncDraftRendering();
    return MAPL.state.draftRoute;
  }

  function addDraftPoint(lat, lng) {
    if (!MAPL.state.draftRoute) {
      return null;
    }

    MAPL.state.draftRoute.points.push({
      lat: MAPL.utils.roundCoord(lat),
      lng: MAPL.utils.roundCoord(lng)
    });

    syncDraftRendering();
    return MAPL.state.draftRoute;
  }

  function undoDraftPoint() {
    if (!MAPL.state.draftRoute || !MAPL.state.draftRoute.points.length) {
      return null;
    }

    MAPL.state.draftRoute.points.pop();
    syncDraftRendering();
    return MAPL.state.draftRoute;
  }

  function removeDraftPoint(index) {
    if (!MAPL.state.draftRoute) {
      return null;
    }

    MAPL.state.draftRoute.points = MAPL.state.draftRoute.points.filter(function (_, pointIndex) {
      return pointIndex !== index;
    });
    syncDraftRendering();
    return MAPL.state.draftRoute;
  }

  function updateDraftMeta(nextValues) {
    if (!MAPL.state.draftRoute) {
      return null;
    }

    if (nextValues.name !== undefined) {
      MAPL.state.draftRoute.name = String(nextValues.name || "").trim() || "新しい経路";
    }

    if (nextValues.color !== undefined) {
      MAPL.state.draftRoute.color = String(nextValues.color || "#2f6fed");
    }

    syncDraftRendering();
    return MAPL.state.draftRoute;
  }

  function saveDraft() {
    var draft = MAPL.state.draftRoute;

    if (!draft) {
      return {
        ok: false,
        message: "保存対象の経路がありません。"
      };
    }

    if (draft.points.length < 2) {
      return {
        ok: false,
        message: "経路は2点以上で保存してください。"
      };
    }

    draft.updatedAt = new Date().toISOString();
    draft.name = draft.name || "新しい経路";

    if (MAPL.state.draftSourceId) {
      var route = getRouteById(MAPL.state.draftSourceId);

      if (route) {
        route.name = draft.name;
        route.color = draft.color;
        route.points = MAPL.utils.clone(draft.points);
        route.visible = true;
        route.updatedAt = draft.updatedAt;
      }
    } else {
      draft.visible = true;
      window.MAPL_DATA.routes.push(MAPL.utils.clone(draft));
      MAPL.state.draftSourceId = draft.id;
      MAPL.state.selectedId = draft.id;
    }

    renderRoutes();
    syncDraftRendering();

    return {
      ok: true,
      routeId: MAPL.state.draftSourceId || draft.id
    };
  }

  function finishEditing() {
    MAPL.state.draftRoute = null;
    MAPL.state.draftSourceId = null;
    MAPL.map.clearDraftRoute();
  }

  function deleteRoute(routeId) {
    var beforeLength = window.MAPL_DATA.routes.length;
    window.MAPL_DATA.routes = window.MAPL_DATA.routes.filter(function (route) {
      return route.id !== routeId;
    });
    renderRoutes();
    return beforeLength !== window.MAPL_DATA.routes.length;
  }

  function toggleVisibility(routeId, visible) {
    var route = getRouteById(routeId);

    if (!route) {
      return null;
    }

    route.visible = Boolean(visible);
    route.updatedAt = new Date().toISOString();
    renderRoutes();
    return route;
  }

  function focusRoute(routeId) {
    var route = getRouteById(routeId);

    if (!route || !route.points.length) {
      return;
    }

    MAPL.map.fitBounds(route.points);
  }

  function refreshSelection() {
    var state = MAPL.state || {};

    Object.keys(routeLayerMap).forEach(function (routeId) {
      var polyline = routeLayerMap[routeId];
      var isSelected = state.selectedType === "route" && state.selectedId === routeId;

      polyline.setStyle({
        weight: isSelected ? 6 : 4,
        opacity: isSelected ? 1 : 0.78
      });
    });
  }

  function syncDraftRendering() {
    var draft = MAPL.state.draftRoute;

    if (!draft) {
      MAPL.map.clearDraftRoute();
      return;
    }

    MAPL.map.drawDraftRoute(draft.points, draft.color);
  }

  MAPL.routes = {
    addDraftPoint: addDraftPoint,
    deleteRoute: deleteRoute,
    finishEditing: finishEditing,
    focusRoute: focusRoute,
    getAllRoutes: getAllRoutes,
    getRouteById: getRouteById,
    refreshSelection: refreshSelection,
    removeDraftPoint: removeDraftPoint,
    renderRoutes: renderRoutes,
    saveDraft: saveDraft,
    startEdit: startEdit,
    startNewDraft: startNewDraft,
    syncDraftRendering: syncDraftRendering,
    toggleVisibility: toggleVisibility,
    undoDraftPoint: undoDraftPoint,
    updateDraftMeta: updateDraftMeta
  };
})();
