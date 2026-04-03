window.MEMBERS_VIEW = (function () {
  "use strict";

  const escapeHtml = window.APP_UTILS.escapeHtml;
  const openInNewTab = window.APP_UTILS.openInNewTab;

  function renderStatus(statusEl) {
    const counts = window.APP.getSummaryCounts();
    statusEl.textContent = [
      "members.html 読み込み成功",
      "members: " + counts.members + "件",
      "office_terms: " + counts.office_terms + "件",
      "member_parties: " + counts.member_parties + "件",
      "member_committees: " + counts.member_committees + "件",
      "member_councils: " + counts.member_councils + "件",
      "contacts: " + counts.contacts + "件",
      "meetings: " + counts.meetings + "件",
      "special_committees: " + counts.special_committees + "件",
      "special_committee_instances: " + counts.special_committee_instances + "件",
      "special_committee_members: " + counts.special_committee_members + "件"
    ].join("\n");
  }

  function renderPartyOptions(selectEl) {
    const options = window.APP.getPartyOptions();
    selectEl.innerHTML = ['<option value="">すべて</option>']
      .concat(options.map(function (row) {
        return '<option value="' + escapeHtml(row.party_id) + '">' + escapeHtml(row.party_name) + "</option>";
      }))
      .join("");
  }

  function renderCommitteeOptions(selectEl) {
    const options = window.APP.getCommitteeOptions();
    selectEl.innerHTML = ['<option value="">すべて</option>']
      .concat(options.map(function (row) {
        return '<option value="' + escapeHtml(row.value) + '">' + escapeHtml(row.label) + "</option>";
      }))
      .join("");
  }

  function goMemberDetailInNewTab(memberId) {
    const url = "member_detail.html?member_id=" + encodeURIComponent(memberId);
    openInNewTab(url);
  }

  function renderTable(containerEl, rows) {
    if (!rows.length) {
      containerEl.innerHTML = '<div class="empty">該当データがありません。</div>';
      return;
    }

    const bodyHtml = rows.map(function (row) {
      const committeeLabel = row.current_committees_regular.concat(row.current_committees_special).join(" / ");
      return [
        '<tr class="clickable-row" data-member-id="' + escapeHtml(row.member_id) + '">',
        "<td>" + escapeHtml(row.member_no) + "</td>",
        "<td>" + escapeHtml(row.member_name) + "</td>",
        "<td>" + escapeHtml(row.current_party_name) + "</td>",
        "<td>" + escapeHtml(committeeLabel) + "</td>",
        "</tr>"
      ].join("");
    }).join("");

    containerEl.innerHTML =
      '<div class="result-table-wrap">' +
        "<table>" +
          "<thead>" +
            "<tr>" +
              "<th>番号</th>" +
              "<th>氏名</th>" +
              "<th>現在会派</th>" +
              "<th>現在委員会</th>" +
            "</tr>" +
          "</thead>" +
          "<tbody>" + bodyHtml + "</tbody>" +
        "</table>" +
      "</div>";
  }

  function bindRowEvents(resultArea) {
    resultArea.querySelectorAll(".clickable-row").forEach(function (rowEl) {
      rowEl.addEventListener("click", function () {
        const memberId = rowEl.dataset.memberId || "";
        if (memberId) {
          goMemberDetailInNewTab(memberId);
        }
      });
    });
  }

  function init() {
    const statusBox = document.getElementById("statusBox");
    const resultMeta = document.getElementById("resultMeta");
    const resultArea = document.getElementById("resultArea");

    const showCurrentOnly = document.getElementById("showCurrentOnly");
    const searchParty = document.getElementById("searchParty");
    const searchCommittee = document.getElementById("searchCommittee");
    const searchName = document.getElementById("searchName");

    function redraw() {
      const allRows = window.APP.buildMemberList();
      const rows = window.APP.filterMemberList(allRows, {
        current_only: showCurrentOnly.checked,
        party_id: searchParty.value,
        committee_selector: searchCommittee.value,
        name: searchName.value
      });

      resultMeta.textContent = rows.length + "件";
      renderTable(resultArea, rows);
      bindRowEvents(resultArea);
    }

    renderStatus(statusBox);
    renderPartyOptions(searchParty);
    renderCommitteeOptions(searchCommittee);
    redraw();

    showCurrentOnly.addEventListener("change", redraw);
    searchParty.addEventListener("change", redraw);
    searchCommittee.addEventListener("change", redraw);
    searchName.addEventListener("input", redraw);
  }

  return {
    init: init
  };
})();

document.addEventListener("DOMContentLoaded", function () {
  window.MEMBERS_VIEW.init();
});