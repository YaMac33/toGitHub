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
      "member_parties: " + counts.member_parties + "件"
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
