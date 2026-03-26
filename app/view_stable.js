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

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function highlightText(text, keyword) {
    const safeText = escapeHtml(text);
    if (!keyword) return safeText;
    const regex = new RegExp("(" + escapeRegExp(keyword) + ")", "gi");
    return safeText.replace(regex, '<span class="hit-mark">$1</span>');
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

  function filterDetailRows(rows, keyword, mapper) {
    if (!rows || rows.length === 0) return [];
    if (!keyword) return rows;
    return rows.filter(function (row) {
      return mapper(row).includes(keyword);
    });
  }

  function renderSimpleBlockRows(rows) {
    if (!rows || rows.length === 0) {
      return '<div class="empty-small">データなし</div>';
    }

    return rows.map(function (row) {
      return '<div class="history-row">' + row + "</div>";
    }).join("");
  }

  function renderCurrentBlockRows(items, keyword) {
    if (!items || items.length === 0) {
      return '<div class="empty-small">データなし</div>';
    }

    const filtered = !keyword
      ? items
      : items.filter(function (item) {
          return String(item).includes(keyword);
        });

    if (filtered.length === 0) {
      return '<div class="empty-small">該当なし</div>';
    }

    return filtered.map(function (item) {
      return '<div class="history-row">' + highlightText(item, keyword) + "</div>";
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

    const keywordInputValue = detailAreaEl.querySelector("#detailSearchInput")
      ? detailAreaEl.querySelector("#detailSearchInput").value.trim()
      : "";

    const currentCommitteesHtml = renderCurrentBlockRows(detail.current_committees || [], keywordInputValue);
    const currentCouncilsHtml = renderCurrentBlockRows(detail.current_councils || [], keywordInputValue);
    const currentPartyHtml = (!keywordInputValue || String(detail.current_party_name || "").includes(keywordInputValue))
      ? (detail.current_party_name
          ? '<div class="history-row">' + highlightText(detail.current_party_name, keywordInputValue) + "</div>"
          : '<div class="empty-small">データなし</div>')
      : '<div class="empty-small">該当なし</div>';

    const officeTermsRows = filterDetailRows(
      detail.office_terms || [],
      keywordInputValue,
      function (row) {
        return [
          formatPeriod(row.term_start_date, row.term_end_date),
          row.election_label || "",
          row.end_reason_code || "",
          row.note || ""
        ].join(" ");
      }
    ).map(function (row) {
      let text =
        formatPeriod(row.term_start_date, row.term_end_date) +
        " / " +
        (row.election_label || "");

      if (row.end_reason_code) {
        text += " / " + row.end_reason_code;
      }

      if (row.note) {
        text += " / " + row.note;
      }

      return highlightText(text, keywordInputValue);
    });

    const partyHistoryRows = filterDetailRows(
      detail.party_history || [],
      keywordInputValue,
      function (row) {
        return [
          formatPeriod(row.start_date, row.end_date),
          row.party_name || "",
          row.role_name || "",
          row.note || ""
        ].join(" ");
      }
    ).map(function (row) {
      let text =
        formatPeriod(row.start_date, row.end_date) +
        " / " +
        (row.party_name || "");

      if (row.role_name) {
        text += " / " + row.role_name;
      }

      if (row.note) {
        text += " / " + row.note;
      }

      return highlightText(text, keywordInputValue);
    });

    const committeeHistoryRows = filterDetailRows(
      detail.committee_history || [],
      keywordInputValue,
      function (row) {
        return [
          formatPeriod(row.start_date, row.end_date),
          row.committee_name || "",
          row.role_name || "",
          row.note || ""
        ].join(" ");
      }
    ).map(function (row) {
      let text =
        formatPeriod(row.start_date, row.end_date) +
        " / " +
        (row.committee_name || "");

      if (row.role_name) {
        text += " / " + row.role_name;
      }

      if (row.note) {
        text += " / " + row.note;
      }

      return highlightText(text, keywordInputValue);
    });

    const councilHistoryRows = filterDetailRows(
      detail.council_history || [],
      keywordInputValue,
      function (row) {
        return [
          formatPeriod(row.start_date, row.end_date),
          row.council_name || "",
          row.role_name || "",
          row.note || ""
        ].join(" ");
      }
    ).map(function (row) {
      let text =
        formatPeriod(row.start_date, row.end_date) +
        " / " +
        (row.council_name || "");

      if (row.role_name) {
        text += " / " + row.role_name;
      }

      if (row.note) {
        text += " / " + row.note;
      }

      return highlightText(text, keywordInputValue);
    });

    const contactHistoryRows = filterDetailRows(
      detail.contact_history || [],
      keywordInputValue,
      function (row) {
        return [
          formatPeriod(row.start_date, row.end_date),
          row.address || "",
          row.phone_home || "",
          row.phone_mobile || "",
          row.email || "",
          row.contact_note || ""
        ].join(" ");
      }
    ).map(function (row) {
      let text =
        formatPeriod(row.start_date, row.end_date) +
        " / " +
        (row.address || "");

      if (row.phone_home) {
        text += " / " + row.phone_home;
      }

      if (row.phone_mobile) {
        text += " / " + row.phone_mobile;
      }

      if (row.email) {
        text += " / " + row.email;
      }

      if (row.contact_note) {
        text += " / " + row.contact_note;
      }

      return highlightText(text, keywordInputValue);
    });

    const currentContactBlocks = [];
    if (detail.current_contact) {
      const candidates = [
        "郵便番号: " + (detail.current_contact.postal_code || ""),
        "住所: " + (detail.current_contact.address || ""),
        "住所公開範囲: " + (detail.current_contact.address_visibility || ""),
        "自宅電話: " + (detail.current_contact.phone_home || ""),
        "自宅電話公開範囲: " + (detail.current_contact.phone_home_visibility || ""),
        "携帯電話: " + (detail.current_contact.phone_mobile || ""),
        "携帯電話公開範囲: " + (detail.current_contact.phone_mobile_visibility || ""),
        "メール: " + (detail.current_contact.email || ""),
        "メール公開範囲: " + (detail.current_contact.email_visibility || ""),
        "備考: " + (detail.current_contact.contact_note || "")
      ];

      candidates.forEach(function (line) {
        if (!keywordInputValue || line.includes(keywordInputValue)) {
          currentContactBlocks.push('<div class="history-row">' + highlightText(line, keywordInputValue) + "</div>");
        }
      });
    }

    const currentContactHtml = currentContactBlocks.length > 0
      ? currentContactBlocks.join("")
      : '<div class="empty-small">' + (detail.current_contact ? "該当なし" : "データなし") + "</div>";

    detailAreaEl.innerHTML =
      '<div class="detail-search-wrap">' +
        '<input id="detailSearchInput" type="text" placeholder="詳細内検索（現在所属 + 履歴）" value="' + escapeHtml(keywordInputValue) + '">' +
      "</div>" +

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
          currentPartyHtml +
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
          renderSimpleBlockRows(officeTermsRows) +
        "</div>" +

        '<div class="detail-card detail-card-wide">' +
          "<h3>会派履歴</h3>" +
          renderSimpleBlockRows(partyHistoryRows) +
        "</div>" +

        '<div class="detail-card detail-card-wide">' +
          "<h3>委員会履歴</h3>" +
          renderSimpleBlockRows(committeeHistoryRows) +
        "</div>" +

        '<div class="detail-card detail-card-wide">' +
          "<h3>審議会履歴</h3>" +
          renderSimpleBlockRows(councilHistoryRows) +
        "</div>" +

        '<div class="detail-card detail-card-wide">' +
          "<h3>連絡先履歴</h3>" +
          renderSimpleBlockRows(contactHistoryRows) +
        "</div>" +
      "</div>";

    const detailSearchInput = detailAreaEl.querySelector("#detailSearchInput");
    if (detailSearchInput) {
      detailSearchInput.addEventListener("input", function () {
        renderDetail(detailAreaEl, memberId);
      });
    }
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
