window.APP_STABLE = (function () {
  "use strict";

  let currentRows = [];
  let selectedMemberId = "";

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function formatPeriod(startDate, endDate) {
    return (startDate || "") + " ～ " + (endDate || "継続中");
  }

  function renderPartyOptions(selectEl) {
    const options = window.APP.getPartyOptions();
    const html = ['<option value="">すべて</option>']
      .concat(
        options.map(function (party) {
          return '<option value="' + escapeHtml(party.party_id) + '">' +
            escapeHtml(party.party_name) +
            '</option>';
        })
      )
      .join("");

    selectEl.innerHTML = html;
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

  function renderTable(containerEl, rows) {
    if (!rows.length) {
      containerEl.innerHTML = '<div class="empty">該当データがありません。</div>';
      return;
    }

    const bodyHtml = rows.map(function (row) {
      const selectedClass = row.member_id === selectedMemberId ? " selected-row" : "";
      return [
        '<tr class="clickable-row' + selectedClass + '" data-member-id="' + escapeHtml(row.member_id) + '">',
        "<td>" + escapeHtml(row.member_no) + "</td>",
        "<td>" + escapeHtml(row.member_name) + "</td>",
        "<td>" + escapeHtml(row.current_party_name) + "</td>",
        "<td>" + escapeHtml(row.current_status) + "</td>",
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
              "<th>在任状態</th>" +
            "</tr>" +
          "</thead>" +
          "<tbody>" + bodyHtml + "</tbody>" +
        "</table>" +
      "</div>";
  }

  function renderSimpleBlockRows(rows) {
    if (!rows || rows.length === 0) {
      return '<div class="empty-small">データなし</div>';
    }

    return rows.map(function (row) {
      return '<div class="history-row">' + row + "</div>";
    }).join("");
  }

  function renderDetail(detailAreaEl, memberId) {
    if (!memberId) {
      detailAreaEl.innerHTML = '<div class="empty">一覧から議員を選択すると詳細を表示します。</div>';
      return;
    }

    const detail = window.APP.buildMemberDetail(memberId);
    if (!detail) {
      detailAreaEl.innerHTML = '<div class="empty">詳細データを取得できませんでした。</div>';
      return;
    }

    const currentCommitteesHtml = renderSimpleBlockRows(
      (detail.current_committees || []).map(function (item) {
        return escapeHtml(item);
      })
    );

    const currentCouncilsHtml = renderSimpleBlockRows(
      (detail.current_councils || []).map(function (item) {
        return escapeHtml(item);
      })
    );

    const officeTermsHtml = renderSimpleBlockRows(
      (detail.office_terms || []).map(function (row) {
        return escapeHtml(formatPeriod(row.term_start_date, row.term_end_date)) +
          " / " +
          escapeHtml(row.election_label || "") +
          (row.end_reason_code ? " / " + escapeHtml(row.end_reason_code) : "");
      })
    );

    const partyHistoryHtml = renderSimpleBlockRows(
      (detail.party_history || []).map(function (row) {
        return escapeHtml(formatPeriod(row.start_date, row.end_date)) +
          " / " +
          escapeHtml(row.party_name || "") +
          (row.role_name ? " / " + escapeHtml(row.role_name) : "");
      })
    );

    const committeeHistoryHtml = renderSimpleBlockRows(
      (detail.committee_history || []).map(function (row) {
        return escapeHtml(formatPeriod(row.start_date, row.end_date)) +
          " / " +
          escapeHtml(row.committee_name || "") +
          (row.role_name ? " / " + escapeHtml(row.role_name) : "");
      })
    );

    const councilHistoryHtml = renderSimpleBlockRows(
      (detail.council_history || []).map(function (row) {
        return escapeHtml(formatPeriod(row.start_date, row.end_date)) +
          " / " +
          escapeHtml(row.council_name || "") +
          (row.role_name ? " / " + escapeHtml(row.role_name) : "");
      })
    );

    const contactHistoryHtml = renderSimpleBlockRows(
      (detail.contact_history || []).map(function (row) {
        return escapeHtml(formatPeriod(row.start_date, row.end_date)) +
          " / " +
          escapeHtml(row.address || "") +
          (row.phone_mobile ? " / " + escapeHtml(row.phone_mobile) : "") +
          (row.email ? " / " + escapeHtml(row.email) : "");
      })
    );

    const currentContactHtml = detail.current_contact
      ? [
          '<div class="history-row">郵便番号: ' + escapeHtml(detail.current_contact.postal_code || "") + "</div>",
          '<div class="history-row">住所: ' + escapeHtml(detail.current_contact.address || "") + "</div>",
          '<div class="history-row">自宅電話: ' + escapeHtml(detail.current_contact.phone_home || "") + "</div>",
          '<div class="history-row">携帯電話: ' + escapeHtml(detail.current_contact.phone_mobile || "") + "</div>",
          '<div class="history-row">メール: ' + escapeHtml(detail.current_contact.email || "") + "</div>"
        ].join("")
      : '<div class="empty-small">データなし</div>';

    detailAreaEl.innerHTML =
      '<div class="detail-header">' +
        '<div class="detail-title">' + escapeHtml(detail.member_name) + "（" + escapeHtml(detail.member_name_short) + "）</div>" +
        '<div class="detail-subtitle">議員ID: ' + escapeHtml(detail.member_id) + " / " + escapeHtml(detail.current_status) + "</div>" +
      "</div>" +

      '<div class="detail-grid">' +
        '<div class="detail-card">' +
          "<h3>基本情報</h3>" +
          '<div class="history-row">番号: ' + escapeHtml(detail.member_no) + "</div>" +
          '<div class="history-row">氏名かな: ' + escapeHtml(detail.member_kana) + "</div>" +
          '<div class="history-row">生年月日: ' + escapeHtml(detail.birth_date) + "</div>" +
          '<div class="history-row">年齢: ' + escapeHtml(detail.age) + "</div>" +
          '<div class="history-row">性別: ' + escapeHtml(detail.gender) + "</div>" +
          '<div class="history-row">備考: ' + escapeHtml(detail.note) + "</div>" +
        "</div>" +

        '<div class="detail-card">' +
          "<h3>現在会派</h3>" +
          (detail.current_party_name
            ? '<div class="history-row">' + escapeHtml(detail.current_party_name) + "</div>"
            : '<div class="empty-small">データなし</div>') +
        "</div>" +

        '<div class="detail-card">' +
          "<h3>現在委員会</h3>" +
          currentCommitteesHtml +
        "</div>" +

        '<div class="detail-card">' +
          "<h3>現在審議会</h3>" +
          currentCouncilsHtml +
        "</div>" +

        '<div class="detail-card detail-card-wide">' +
          "<h3>現在連絡先</h3>" +
          currentContactHtml +
        "</div>" +

        '<div class="detail-card detail-card-wide">' +
          "<h3>在任履歴</h3>" +
          officeTermsHtml +
        "</div>" +

        '<div class="detail-card detail-card-wide">' +
          "<h3>会派履歴</h3>" +
          partyHistoryHtml +
        "</div>" +

        '<div class="detail-card detail-card-wide">' +
          "<h3>委員会履歴</h3>" +
          committeeHistoryHtml +
        "</div>" +

        '<div class="detail-card detail-card-wide">' +
          "<h3>審議会履歴</h3>" +
          councilHistoryHtml +
        "</div>" +

        '<div class="detail-card detail-card-wide">' +
          "<h3>連絡先履歴</h3>" +
          contactHistoryHtml +
        "</div>" +
      "</div>";
  }

  function bindRowEvents(resultArea, detailArea) {
    resultArea.querySelectorAll(".clickable-row").forEach(function (rowEl) {
      rowEl.addEventListener("click", function () {
        selectedMemberId = rowEl.dataset.memberId || "";
        renderTable(resultArea, currentRows);
        renderDetail(detailArea, selectedMemberId);
        bindRowEvents(resultArea, detailArea);
      });
    });
  }

  function init() {
    const statusBox = document.getElementById("statusBox");
    const resultMeta = document.getElementById("resultMeta");
    const resultArea = document.getElementById("resultArea");
    const detailArea = document.getElementById("detailArea");

    const searchName = document.getElementById("searchName");
    const searchParty = document.getElementById("searchParty");
    const searchStatus = document.getElementById("searchStatus");

    function redraw() {
      const allRows = window.APP.buildMemberList();

      currentRows = window.APP.filterMemberList(allRows, {
        name: searchName.value,
        party_id: searchParty.value,
        status: searchStatus.value
      });

      if (selectedMemberId && !currentRows.some(function (row) { return row.member_id === selectedMemberId; })) {
        selectedMemberId = "";
      }

      resultMeta.textContent = currentRows.length + "件";
      renderTable(resultArea, currentRows);
      renderDetail(detailArea, selectedMemberId);
      bindRowEvents(resultArea, detailArea);
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
