(function () {
  "use strict";

  window.APP_COMMON = window.APP_COMMON || {};

  function onReady(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback);
    } else {
      callback();
    }
  }

  function init() {
    console.log("common.js loaded");
  }

  window.APP_COMMON.onReady = onReady;

  onReady(init);
})();
