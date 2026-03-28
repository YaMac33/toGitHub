(function () {
  "use strict";

  function fallbackCopy(text) {
    var textarea = document.createElement("textarea");
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();

    var ok = false;
    try {
      ok = document.execCommand("copy");
    } catch (e) {
      ok = false;
    }

    document.body.removeChild(textarea);
    return ok;
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }

    return new Promise(function (resolve, reject) {
      if (fallbackCopy(text)) {
        resolve();
      } else {
        reject(new Error("copy failed"));
      }
    });
  }

  function setCopiedState(button) {
    var original = button.textContent;
    button.textContent = "コピー済";
    setTimeout(function () {
      button.textContent = original;
    }, 1500);
  }

  function bindCopyButtons() {
    var buttons = document.querySelectorAll(".copy-block .copy-btn");

    buttons.forEach(function (button) {
      button.addEventListener("click", function () {
        var block = button.closest(".copy-block");
        if (!block) return;

        var code = block.querySelector("code");
        if (!code) return;

        copyText(code.innerText)
          .then(function () {
            setCopiedState(button);
          })
          .catch(function () {
            alert("コピーできませんでした");
          });
      });
    });
  }

  if (window.APP_COMMON && typeof window.APP_COMMON.onReady === "function") {
    window.APP_COMMON.onReady(bindCopyButtons);
  } else {
    document.addEventListener("DOMContentLoaded", bindCopyButtons);
  }
})();
