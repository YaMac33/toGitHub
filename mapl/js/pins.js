(function () {
  var MAPL = window.MAPL = window.MAPL || {};

  var markerMap = {};

  function getAllPins() {
    return window.MAPL_DATA.pins;
  }

  function getPinById(pinId) {
    return getAllPins().find(function (pin) {
      return pin.id === pinId;
    }) || null;
  }

  function renderPins() {
    var layers = MAPL.map.getLayers();
    var pinLayer = layers && layers.pins;

    if (!pinLayer) {
      return;
    }

    pinLayer.clearLayers();
    markerMap = {};

    getAllPins().forEach(function (pin) {
      var marker = L.marker([pin.lat, pin.lng], {
        title: pin.name || "ピン"
      });

      marker.on("click", function () {
        if (MAPL.state && MAPL.state.mode === "route") {
          return;
        }

        MAPL.app.selectPin(pin.id);
      });

      marker.bindPopup(createPopupHtml(pin));
      marker.addTo(pinLayer);
      markerMap[pin.id] = marker;
    });

    refreshSelection();
  }

  function createPopupHtml(pin) {
    var title = pin.name || "無題";
    var category = pin.category ? "<div>" + pin.category + "</div>" : "";

    return "<strong>" + title + "</strong>" + category +
      "<div>" + MAPL.utils.formatLatLng(pin.lat, pin.lng) + "</div>";
  }

  function addPin(lat, lng) {
    var pin = MAPL.utils.createDefaultPin(lat, lng);
    window.MAPL_DATA.pins.push(pin);
    renderPins();
    return pin;
  }

  function updatePin(pinId, nextValues) {
    var pin = getPinById(pinId);

    if (!pin) {
      return null;
    }

    if (nextValues.name !== undefined) {
      pin.name = String(nextValues.name || "").trim() || "新しいピン";
    }

    if (nextValues.category !== undefined) {
      pin.category = String(nextValues.category || "");
    }

    if (nextValues.memo !== undefined) {
      pin.memo = String(nextValues.memo || "");
    }

    if (nextValues.lat !== undefined) {
      pin.lat = MAPL.utils.roundCoord(MAPL.utils.toNumber(nextValues.lat, pin.lat));
    }

    if (nextValues.lng !== undefined) {
      pin.lng = MAPL.utils.roundCoord(MAPL.utils.toNumber(nextValues.lng, pin.lng));
    }

    pin.updatedAt = new Date().toISOString();
    renderPins();
    return pin;
  }

  function deletePin(pinId) {
    var beforeLength = window.MAPL_DATA.pins.length;
    window.MAPL_DATA.pins = window.MAPL_DATA.pins.filter(function (pin) {
      return pin.id !== pinId;
    });
    renderPins();
    return beforeLength !== window.MAPL_DATA.pins.length;
  }

  function focusPin(pinId) {
    var pin = getPinById(pinId);

    if (!pin) {
      return;
    }

    MAPL.map.centerOn(pin.lat, pin.lng, 14);
    if (markerMap[pin.id]) {
      markerMap[pin.id].openPopup();
    }
  }

  function refreshSelection() {
    var state = MAPL.state || {};

    Object.keys(markerMap).forEach(function (pinId) {
      var marker = markerMap[pinId];
      var isSelected = state.selectedType === "pin" && state.selectedId === pinId;

      marker.setOpacity(isSelected ? 1 : 0.85);
      marker.setZIndexOffset(isSelected ? 1000 : 0);

      if (!isSelected) {
        marker.closePopup();
      }
    });
  }

  MAPL.pins = {
    addPin: addPin,
    deletePin: deletePin,
    focusPin: focusPin,
    getAllPins: getAllPins,
    getPinById: getPinById,
    refreshSelection: refreshSelection,
    renderPins: renderPins,
    updatePin: updatePin
  };
})();
