window.ITEMS_VIEW = (function () {
  "use strict";

  function getArray(name) {
    return Array.isArray(window.APP_DATA[name]) ? window.APP_DATA[name] : [];
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function classLabel(v) {
    if (v === "BILL") return "議案";
    if (v === "PROPOSAL") return "発議案";
    if (v === "PETITION") return "請願";
    if (v === "REQUEST") return "陳情";
    return v || "";
  }

  function subclassLabel(v) {
    const map = {
      ORDINANCE: "条例",
      BUDGET: "予算",
      SETTLEMENT: "決算",
      CONTRACT: "契約",
      PERSONNEL: "人事",
      PROPERTY: "財産",
      SPECIAL_DECISION: "専決処分",
      OPINION: "意見書",
      RESOLUTION: "決議",
      GENERAL: "一般",
      OTHER: "その他"
    };
    return map[v] || v || "";
  }

  function renderStatus() {
    document.getElementById("statusBox").textContent = [
      "items.html 読み込み成功",
      "council_terms: " + getArray("council_terms").length + "件",
      "items: " + getArray("items").length + "件",
      "item_actions: " + getArray("item_actions").length + "件"
    ].join("\n");
  }

  function renderSubclassOptions(selectedClass) {
    const select = document.getElementById("searchSubclass");
    const items = getArray("items");
    const values = [...new Set(
      items
        .filter(row => !selectedClass || row.item_class === selectedClass)
        .map(row => row.item_subclass)
    )];

    select.innerHTML = ['<option value="">すべて</option>']
      .concat(values.map(v => '<option value="' + escapeHtml(v) + '">' + escapeHtml(subclassLabel(v)) + '</option>'))
      .join("");
  }

  function renderYearOptions() {
    const select = document.getElementById("searchYearWareki");
    const values = [...new Set(getArray("items").map(row => row.year_wareki).filter(Boolean))];
    select.innerHTML = ['<option value="">すべて</option>']
      .concat(values.map(v => '<option value="' + escapeHtml(v) + '">' + escapeHtml(v) + '</option>'))
      .join("");
  }

  function filterRows(rows) {
    const searchClass = document.getElementById("searchClass").value;
    const searchSubclass = document.getElementById("searchSubclass").value;
    const searchYearWareki = document.getElementById("searchYearWareki").value;
    const searchText = document.getElementById("searchText").value.trim().toLowerCase();

    return rows.filter(function (row) {
      const hitClass = !searchClass || row.item_class === searchClass;
      const hitSubclass = !searchSubclass || row.item_subclass === searchSubclass;
      const hitYear = !searchYearWareki || row.year_wareki === searchYearWareki;
      const source = [
        row.item_no || "",
        row.title || "",
        row.summary || "",
        row.department || ""
      ].join(" ").toLowerCase();
      const hitText = !searchText || source.includes(searchText);

      return hitClass && hitSubclass && hitYear && hitText;
    });
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
        '<table>' +
          '<thead>' +
            '<tr>' +
              '<th>番号</th>' +
              '<th>大分類</th>' +
              '<th>中分類</th>' +
              '<th>年</th>' +
              '<th>件名</th>' +
              '<th>所管</th>' +
            '</tr>' +
          '</thead>' +
          '<tbody>' +
            rows.map(function (row) {
              return (
                '<tr class="clickable-row" data-item-id="' + escapeHtml(row.item_id) + '">' +
                  '<td>' + escapeHtml(row.item_no) + '</td>' +
                  '<td>' + escapeHtml(classLabel(row.item_class)) + '</td>' +
                  '<td>' + escapeHtml(subclassLabel(row.item_subclass)) + '</td>' +
                  '<td>' + escapeHtml(row.year_wareki || "") + '</td>' +
                  '<td>' + escapeHtml(row.title) + '</td>' +
                  '<td>' + escapeHtml(row.department || "") + '</td>' +
                '</tr>'
              );
            }).join("") +
          '</tbody>' +
        '</table>' +
      '</div>';

    resultArea.querySelectorAll(".clickable-row").forEach(function (rowEl) {
      rowEl.addEventListener("click", function () {
        const itemId = rowEl.dataset.itemId || "";
        if (itemId) {
          window.open("item_detail.html?item_id=" + encodeURIComponent(itemId), "_blank", "noopener,noreferrer");
        }
      });
    });
  }

  function redraw() {
    const rows = getArray("items")
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

    renderTable(filterRows(rows));
  }

  function init() {
    renderStatus();
    renderYearOptions();
    renderSubclassOptions("");

    const searchClass = document.getElementById("searchClass");
    const searchSubclass = document.getElementById("searchSubclass");
    const searchYearWareki = document.getElementById("searchYearWareki");
    const searchText = document.getElementById("searchText");

    searchClass.addEventListener("change", function () {
      renderSubclassOptions(searchClass.value);
      redraw();
    });
    searchSubclass.addEventListener("change", redraw);
    searchYearWareki.addEventListener("change", redraw);
    searchText.addEventListener("input", redraw);

    redraw();
  }

  return {
    init: init
  };
})();

document.addEventListener("DOMContentLoaded", function () {
  window.ITEMS_VIEW.init();
});
