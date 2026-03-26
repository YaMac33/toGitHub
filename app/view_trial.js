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

  function toWareki(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr + "T00:00:00");
    if (Number.isNaN(d.getTime())) return dateStr;

    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const day = d.getDate();

    const reiwaStart = new Date("2019-05-01T00:00:00");
    const heiseiStart = new Date("1989-01-08T00:00:00");
    const showaStart = new Date("1926-12-25T00:00:00");

    let eraName = "";
    let eraYear = 0;

    if (d >= reiwaStart) {
      eraName = "令和";
      eraYear = y - 2018;
    } else if (d >= heiseiStart) {
      eraName = "平成";
      eraYear = y - 1988;
    } else if (d >= showaStart) {
      eraName = "昭和";
      eraYear = y - 1925;
    } else {
      return y + "年" + m + "月" + day + "日";
    }

    const eraYearLabel = eraYear === 1 ? "元" : String(eraYear);
    return eraName + eraYearLabel + "年" + m + "月" + day + "日";
  }

  function formatPeriod(startDate, endDate) {
    return toWareki(startDate || "") + " ～ " + (endDate ? toWareki(endDate) : "継続中");
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

  function renderCommitteeOptions(selectEl) {
    const options = window.APP.getCommitteeOptions();
    const html = ['<option value="">すべて</option>']
      .concat(
        options.map(function (committee) {
          return '<option value="' + escapeHtml(committee.committee_id) + '">' +
            escapeHtml(committee.committee_name) +
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
        let text =
          escapeHtml(formatPeriod(row.term_start_date, row.term_end_date)) +
          " / " +
          escapeHtml(row.election_label || "");

        if (row.end_reason_code) {
          text += " / " + escapeHtml(row.end_reason_code);
        }

        if (row.note) {
          text += " / " + escapeHtml(row.note);
        }

        return text;
      })
    );

    const partyHistoryHtml = renderSimpleBlockRows(
      (detail.party_history || []).map(function (row) {
        let text =
          escapeHtml(formatPeriod(row.start_date, row.end_date)) +
          " / " +
          escapeHtml(row.party_name || "");

        if (row.role_name) {
          text += " / " + escapeHtml(row.role_name);
        }

        if (row.note) {
          text += " / " + escapeHtml(row.note);
        }

        return text;
      })
    );

    const committeeHistoryHtml = renderSimpleBlockRows(
      (detail.committee_history || []).map(function (row) {
        let text =
          escapeHtml(formatPeriod(row.start_date, row.end_date)) +
          " / " +
          escapeHtml(row.committee_name || "");

        if (row.role_name) {
          text += " / " + escapeHtml(row.role_name);
        }

        if (row.note) {
          text += " / " + escapeHtml(row.note);
        }

        return text;
      })
    );

    const councilHistoryHtml = renderSimpleBlockRows(
      (detail.council_history || []).map(function (row) {
        let text =
          escapeHtml(formatPeriod(row.start_date, row.end_date)) +
          " / " +
          escapeHtml(row.council_name || "");

        if (row.role_name) {
          text += " / " + escapeHtml(row.role_name);
        }

        if (row.note) {
          text += " / " + escapeHtml(row.note);
        }

        return text;
      })
    );

    const contactHistoryHtml = renderSimpleBlockRows(
      (detail.contact_history || []).map(function (row) {
        let text =
          escapeHtml(formatPeriod(row.start_date, row.end_date)) +
          " / " +
          escapeHtml(row.address || "");

        if (row.phone_mobile) {
          text += " / " + escapeHtml(row.phone_mobile);
        }

        if (row.email) {
          text += " / " + escapeHtml(row.email);
        }

        if (row.contact_note) {
          text += " / " + escapeHtml(row.contact_note);
        }

        return text;
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
          '<div class="history-row">生年月日: ' + escapeHtml(toWareki(detail.birth_date)) + "</div>" +
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
    const searchCommittee = document.getElementById("searchCommittee");

    function redraw() {
      const allRows = window.APP.buildMemberList();

      currentRows = window.APP.filterMemberList(allRows, {
        name: searchName.value,
        party_id: searchParty.value,
        committee_id: searchCommittee.value
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
    renderCommitteeOptions(searchCommittee);
    renderStatus(statusBox);
    redraw();

    searchName.addEventListener("input", redraw);
    searchParty.addEventListener("change", redraw);
    searchCommittee.addEventListener("change", redraw);
  }

  return {
    init: init
  };
})();

document.addEventListener("DOMContentLoaded", function () {
  window.APP_STABLE.init();
});
