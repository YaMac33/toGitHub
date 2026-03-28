window.ITEMS_VIEW = (function () {
  "use strict";

  const escapeHtml = window.APP_UTILS.escapeHtml;
  const openInNewTab = window.APP_UTILS.openInNewTab;
  const classLabel = window.APP_FORMATTERS.itemClassLabel;
  const subclassLabel = window.APP_FORMATTERS.itemSubclassLabel;

  function getArray(name) {
    return Array.isArray(window.APP_DATA[name]) ? window.APP_DATA[name] : [];
  }

  function getEraCode(yearWareki) {
    const value = String(yearWareki || "").trim().toUpperCase();
    if (!value) return "";
    if (value.startsWith("R")) return "R";
    if (value.startsWith("H")) return "H";
    if (value.startsWith("S")) return "S";
    return "OTHER";
  }

  function eraLabel(code) {
    if (code === "R") return "令和";
    if (code === "H") return "平成";
    if (code === "S") return "昭和";
    return "その他";
  }

  function getSortedItems() {
    return getArray("items")
      .slice()
      .sort(function (a, b) {
        const ay = Number(a.year || 0);
        const by = Number(b.year || 0);
        if (ay !== by) return by - ay;

        const ac = String(a.item_class || "");
        const bc = String(b.item_class || "");
        if (ac !== bc) return ac < bc ? -1 : 1;

        return Number(a.item_no_numeric || 0) - Number(b.item_no_numeric || 0);
      });
  }

  function renderStatus() {
    document.getElementById("statusBox").textContent = [
      "items.html 読み込み成功",
      "council_terms: " + getArray("council_terms").length + "件",
      "items: " + getArray("items").length + "件",
      "item_actions: " + getArray("item_actions").length + "件"
    ].join("\n");
  }

  function renderEraOptions() {
    const select = document.getElementById("searchEra");
    const values = [...new Set(
      getArray("items")
        .map(function (row) {
          return getEraCode(row.year_wareki);
        })
        .filter(Boolean)
    )];

    values.sort(function (a, b) {
      const order = { R: 1, H: 2, S: 3, OTHER: 9 };
      return (order[a] || 99) - (order[b] || 99);
    });

    select.innerHTML = ['<option value="">選択してください</option>']
      .concat(values.map(function (v) {
        return '<option value="' + escapeHtml(v) + '">' + escapeHtml(eraLabel(v)) + "</option>";
      }))
      .join("");
  }

  function renderYearOptions(selectedEra) {
    const select = document.getElementById("searchYearWareki");

    if (!selectedEra) {
      select.disabled = true;
      select.innerHTML = '<option value="">元号を先に選択</option>';
      return;
    }

    const values = [...new Set(
      getArray("items")
        .filter(function (row) {
          return getEraCode(row.year_wareki) === selectedEra;
        })
        .map(function (row) {
          return row.year_wareki;
        })
        .filter(Boolean)
    )];

    values.sort(function (a, b) {
      const an = parseInt(String(a).replace(/^[A-Z]/i, ""), 10) || 0;
      const bn = parseInt(String(b).replace(/^[A-Z]/i, ""), 10) || 0;
      return bn - an;
    });

    select.disabled = false;
    select.innerHTML = ['<option value="">すべて</option>']
      .concat(values.map(function (v) {
        return '<option value="' + escapeHtml(v) + '">' + escapeHtml(v) + "</option>";
      }))
      .join("");
  }

  function renderSubclassOptions(selectedClass, selectedEra, selectedYearWareki) {
    const select = document.getElementById("searchSubclass");

    const values = [...new Set(
      getArray("items")
        .filter(function (row) {
          const hitEra = !selectedEra || getEraCode(row.year_wareki) === selectedEra;
          const hitYear = !selectedYearWareki || row.year_wareki === selectedYearWareki;
          const hitClass = !selectedClass || row.item_class === selectedClass;
          return hitEra && hitYear && hitClass;
        })
        .map(function (row) {
          return row.item_subclass;
        })
        .filter(Boolean)
    )];

    select.innerHTML = ['<option value="">すべて</option>']
      .concat(values.map(function (v) {
        return '<option value="' + escapeHtml(v) + '">' + escapeHtml(subclassLabel(v)) + "</option>";
      }))
      .join("");
  }

  function filterRows(rows) {
    const searchEra = document.getElementById("searchEra").value;
    const searchYearWareki = document.getElementById("searchYearWareki").value;
    const searchClass = document.getElementById("searchClass").value;
    const searchSubclass = document.getElementById("searchSubclass").value;
    const searchText = document.getElementById("searchText").value.trim().toLowerCase();

    if (!searchEra) {
      return [];
    }

    return rows.filter(function (row) {
      const hitEra = getEraCode(row.year_wareki) === searchEra;
      const hitYear = !searchYearWareki || row.year_wareki === searchYearWareki;
      const hitClass = !searchClass || row.item_class === searchClass;
      const hitSubclass = !searchSubclass || row.item_subclass === searchSubclass;

      const source = [
        row.item_no || "",
        row.title || "",
        row.summary || "",
        row.department || ""
      ].join(" ").toLowerCase();

      const hitText = !searchText || source.includes(searchText);

      return hitEra && hitYear && hitClass && hitSubclass && hitText;
    });
  }

  function renderEmptyGuide() {
    const resultMeta = document.getElementById("resultMeta");
    const resultArea = document.getElementById("resultArea");

    resultMeta.textContent = "0件";
    resultArea.innerHTML = '<div class="empty">元号を選択してください。</div>';
  }

  function renderTable(rows) {
    const resultArea = document.getElementById("resultArea");
    const resultMeta = document.getElementById("resultMeta");

    resultMeta.textContent = rows.length + "件";

    if (!rows.length) {
      resultArea.innerHTML = '<div class="empty">該当データがありません。</div>';
      return;
    }

    resultArea.innerHTML =
      '<div class="result-table-wrap">' +
        "<table>" +
          "<thead>" +
            "<tr>" +
              "<th>番号</th>" +
              "<th>大分類</th>" +
              "<th>中分類</th>" +
              "<th>年</th>" +
              "<th>件名</th>" +
              "<th>所管</th>" +
            "</tr>" +
          "</thead>" +
          "<tbody>" +
            rows.map(function (row) {
              return (
                '<tr class="clickable-row" data-item-id="' + escapeHtml(row.item_id) + '">' +
                  "<td>" + escapeHtml(row.item_no) + "</td>" +
                  "<td>" + escapeHtml(classLabel(row.item_class)) + "</td>" +
                  "<td>" + escapeHtml(subclassLabel(row.item_subclass)) + "</td>" +
                  "<td>" + escapeHtml(row.year_wareki || "") + "</td>" +
                  "<td>" + escapeHtml(row.title || "") + "</td>" +
                  "<td>" + escapeHtml(row.department || "") + "</td>" +
                "</tr>"
              );
            }).join("") +
          "</tbody>" +
        "</table>" +
      "</div>";

    resultArea.querySelectorAll(".clickable-row").forEach(function (rowEl) {
      rowEl.addEventListener("click", function () {
        const itemId = rowEl.dataset.itemId || "";
        if (itemId) {
          openInNewTab("item_detail.html?item_id=" + encodeURIComponent(itemId));
        }
      });
    });
  }

  function redraw() {
    const searchEra = document.getElementById("searchEra").value;
    const rows = getSortedItems();

    if (!searchEra) {
      renderEmptyGuide();
      return;
    }

    renderTable(filterRows(rows));
  }

  function init() {
    const searchEra = document.getElementById("searchEra");
    const searchYearWareki = document.getElementById("searchYearWareki");
    const searchClass = document.getElementById("searchClass");
    const searchSubclass = document.getElementById("searchSubclass");
    const searchText = document.getElementById("searchText");

    renderStatus();
    renderEraOptions();
    renderYearOptions("");
    renderSubclassOptions("", "", "");
    renderEmptyGuide();

    searchEra.addEventListener("change", function () {
      searchYearWareki.value = "";
      renderYearOptions(searchEra.value);
      renderSubclassOptions(searchClass.value, searchEra.value, "");
      redraw();
    });

    searchYearWareki.addEventListener("change", function () {
      renderSubclassOptions(searchClass.value, searchEra.value, searchYearWareki.value);
      redraw();
    });

    searchClass.addEventListener("change", function () {
      renderSubclassOptions(searchClass.value, searchEra.value, searchYearWareki.value);
      redraw();
    });

    searchSubclass.addEventListener("change", redraw);
    searchText.addEventListener("input", redraw);
  }

  return {
    init: init
  };
})();

document.addEventListener("DOMContentLoaded", function () {
  window.ITEMS_VIEW.init();
});
