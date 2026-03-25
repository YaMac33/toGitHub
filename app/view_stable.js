window.APP_STABLE = (function () {
  "use strict";

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function renderPartyOptions(selectEl) {
    const options = window.APP.getPartyOptions();

    const html = ['<option value="">すべて</option>']
      .concat(
        options.map(function (party) {
          return (
            '<option value="' + escapeHtml(party.party_id) + '">' +
            escapeHtml(party.party_name) +
            "</option>"
          );
        })
      )
      .join("");

    selectEl.innerHTML = html;
  }

  function renderMultiLineList(items) {
    if (!Array.isArray(items) || items.length === 0) {
      return "";
    }

    return items
      .map(function (item) {
        return '<div>' + escapeHtml(item) + "</div>";
      })
      .join("");
  }

  function renderTable(containerEl, rows) {
    if (!rows.length) {
      containerEl.innerHTML =
        '<div class="empty">該当データがありません。</div>';
      return;
    }

    const bodyHtml = rows
      .map(function (row) {
        return [
          "<tr>",
          "<td>" + escapeHtml(row.member_no) + "</td>",
          "<td>" + escapeHtml(row.member_name) + "</td>",
          "<td>" + escapeHtml(row.member_name_short) + "</td>",
          "<td>" + escapeHtml(row.age) + "</td>",
          "<td>" + escapeHtml(row.current_status) + "</td>",
          "<td>" + escapeHtml(row.current_party_name) + "</td>",
          "<td>" + renderMultiLineList(row.current_committees) + "</td>",
          "<td>" + renderMultiLineList(row.current_councils) + "</td>",
          "</tr>"
        ].join("");
      })
      .join("");

    containerEl.innerHTML =
      '<div class="result-table-wrap">' +
        "<table>" +
          "<thead>" +
            "<tr>" +
              "<th>番号</th>" +
              "<th>氏名</th>" +
              "<th>略称</th>" +
              "<th>年齢</th>" +
              "<th>在任状態</th>" +
              "<th>現在会派</th>" +
              "<th>現在委員会</th>" +
              "<th>現在審議会</th>" +
            "</tr>" +
          "</thead>" +
          "<tbody>" + bodyHtml + "</tbody>" +
        "</table>" +
      "</div>";
  }

  function renderStatus(statusEl) {
    const counts = window.APP.getSummaryCounts();
    statusEl.textContent = [
      "stable.html 読み込み成功",
      "members: " + counts.members + "件",
      "office_terms: " + counts.office_terms + "件",
      "parties: " + counts.parties + "件",
      "member_parties: " + counts.member_parties + "件",
      "member_committees: " + counts.member_committees + "件",
      "member_councils: " + counts.member_councils + "件"
    ].join("\n");
  }

  function init() {
    const statusBox = document.getElementById("statusBox");
    const resultMeta = document.getElementById("resultMeta");
    const resultArea = document.getElementById("resultArea");

    const searchName = document.getElementById("searchName");
    const searchParty = document.getElementById("searchParty");
    const searchStatus = document.getElementById("searchStatus");

    function redraw() {
      const allRows = window.APP.buildMemberList();

      const filteredRows = window.APP.filterMemberList(allRows, {
        name: searchName.value,
        party_id: searchParty.value,
        status: searchStatus.value
      });

      resultMeta.textContent = filteredRows.length + "件";
      renderTable(resultArea, filteredRows);
    }

    renderPartyOptions(searchParty);
    renderStatus(statusBox);
    redraw();

    searchName.addEventListener("input", redraw);
    searchParty.addEventListener("change", redraw);
    searchStatus.addEventListener("change", redraw);
  }

  return {
    init: init
  };
})();

document.addEventListener("DOMContentLoaded", function () {
  window.APP_STABLE.init();
});
