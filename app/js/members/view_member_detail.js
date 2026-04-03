window.MEMBER_DETAIL_VIEW = (function () {
  "use strict";

  const qs = window.APP_UTILS.qs;
  const escapeHtml = window.APP_UTILS.escapeHtml;
  const toWareki = window.APP_FORMATTERS.toWareki;
  const formatPeriod = window.APP_FORMATTERS.formatPeriod;
  const visibilityLabel = window.APP_FORMATTERS.visibilityLabel;

  function renderStatus(text) {
    document.getElementById("statusBox").textContent = text;
  }

  function renderBasic(detail) {
    const area = document.getElementById("basicArea");
    area.innerHTML =
      '<div class="summary-item"><span class="summary-label">番号</span>' + escapeHtml(detail.member_no) + "</div>" +
      '<div class="summary-item"><span class="summary-label">在任状態</span>' + escapeHtml(detail.current_status) + "</div>" +
      '<div class="summary-item"><span class="summary-label">氏名かな</span>' + escapeHtml(detail.member_kana) + "</div>" +
      '<div class="summary-item"><span class="summary-label">性別</span>' + escapeHtml(detail.gender) + "</div>" +
      '<div class="summary-item"><span class="summary-label">生年月日</span>' + escapeHtml(toWareki(detail.birth_date)) + "</div>" +
      '<div class="summary-item"><span class="summary-label">年齢</span>' + escapeHtml(detail.age) + "</div>" +
      '<div class="summary-item summary-item-wide"><span class="summary-label">備考</span>' + escapeHtml(detail.note || "") + "</div>";
  }

  function renderCurrent(detail) {
    const area = document.getElementById("currentArea");

    const committeePills = detail.current_committees_regular
      .concat(detail.current_committees_special)
      .map(function (text) {
        return '<span class="pill">' + escapeHtml(text) + "</span>";
      }).join("");

    const councilPills = (detail.current_councils || []).map(function (text) {
      return '<span class="pill">' + escapeHtml(text) + "</span>";
    }).join("");

    let currentContactHtml = '<div class="empty-small">データなし</div>';
    if (detail.current_contact) {
      currentContactHtml =
        '<div class="history-row">住所: ' + escapeHtml(detail.current_contact.address || "") + "</div>" +
        '<div class="history-row">住所公開範囲: ' + escapeHtml(visibilityLabel(detail.current_contact.address_visibility)) + "</div>" +
        '<div class="history-row">自宅電話: ' + escapeHtml(detail.current_contact.phone_home || "") + "</div>" +
        '<div class="history-row">自宅電話公開範囲: ' + escapeHtml(visibilityLabel(detail.current_contact.phone_home_visibility)) + "</div>" +
        '<div class="history-row">携帯電話: ' + escapeHtml(detail.current_contact.phone_mobile || "") + "</div>" +
        '<div class="history-row">携帯電話公開範囲: ' + escapeHtml(visibilityLabel(detail.current_contact.phone_mobile_visibility)) + "</div>" +
        '<div class="history-row">メール: ' + escapeHtml(detail.current_contact.email || "") + "</div>" +
        '<div class="history-row">メール公開範囲: ' + escapeHtml(visibilityLabel(detail.current_contact.email_visibility)) + "</div>" +
        '<div class="history-row">備考: ' + escapeHtml(detail.current_contact.contact_note || "") + "</div>";
    }

    area.innerHTML =
      '<div class="detail-subcard">' +
        "<h3>現在会派</h3>" +
        (detail.current_party_name
          ? '<div class="history-row">' + escapeHtml(detail.current_party_name) + "</div>"
          : '<div class="empty-small">データなし</div>') +
      "</div>" +

      '<div class="detail-subcard">' +
        "<h3>現在委員会</h3>" +
        (committeePills || '<div class="empty-small">データなし</div>') +
      "</div>" +

      '<div class="detail-subcard">' +
        "<h3>現在審議会</h3>" +
        (councilPills || '<div class="empty-small">データなし</div>') +
      "</div>" +

      '<div class="detail-subcard">' +
        "<h3>現在連絡先</h3>" +
        currentContactHtml +
      "</div>";
  }

  function makeRowsHtml(items) {
    if (!items.length) {
      return '<div class="empty-small">データなし</div>';
    }
    return items.map(function (text) {
      return '<div class="history-row">' + escapeHtml(text) + "</div>";
    }).join("");
  }

  function renderExpandable(area, items) {
    if (!items.length) {
      area.innerHTML = '<div class="empty-small">データなし</div>';
      return;
    }

    const isExpandable = items.length > 3;
    const rowsHtml = makeRowsHtml(items);

    area.innerHTML =
      '<div class="toggle-content' + (isExpandable ? ' is-collapsed' : '') + '">' +
        rowsHtml +
      "</div>" +
      (isExpandable
        ? '<div class="toggle-wrap"><button type="button" class="toggle-button">もっと見る</button></div>'
        : "");

    if (isExpandable) {
      const button = area.querySelector(".toggle-button");
      const content = area.querySelector(".toggle-content");
      button.addEventListener("click", function () {
        const collapsed = content.classList.contains("is-collapsed");
        if (collapsed) {
          content.classList.remove("is-collapsed");
          button.textContent = "閉じる";
        } else {
          content.classList.add("is-collapsed");
          button.textContent = "もっと見る";
        }
      });
    }
  }

  function renderCommitteeHistory(detail) {
    const area = document.getElementById("committeeHistoryArea");

    const regularItems = (detail.committee_history_regular || []).map(function (row) {
      let text = formatPeriod(row.start_date, row.end_date) + " / " + (row.committee_name || "");
      if (row.role_name) text += " / " + row.role_name;
      if (row.note) text += " / " + row.note;
      return text;
    });

    const specialItems = (detail.committee_history_special || []).map(function (row) {
      let text = (row.meeting_name || "") + " / " + (row.special_committee_name || "");
      if (row.role_name) text += " / " + row.role_name;
      text += " / " + formatPeriod(row.start_date, row.end_date);
      if (row.note) text += " / " + row.note;
      return text;
    });

    area.innerHTML =
      '<div class="detail-subcard">' +
        '<h3>常設委員会</h3>' +
        '<div id="committeeRegularWrap"></div>' +
      "</div>" +
      '<div class="detail-subcard">' +
        '<h3>特別委員会</h3>' +
        '<div id="committeeSpecialWrap"></div>' +
      "</div>";

    renderExpandable(document.getElementById("committeeRegularWrap"), regularItems);
    renderExpandable(document.getElementById("committeeSpecialWrap"), specialItems);
  }

  function renderHistorySection(areaId, items) {
    renderExpandable(document.getElementById(areaId), items);
  }

  function init() {
    const memberId = qs("member_id");
    if (!memberId) {
      renderStatus("member_id が指定されていません。");
      document.getElementById("basicArea").innerHTML = '<div class="empty">member_id がありません。</div>';
      return;
    }

    const detail = window.APP.buildMemberDetail(memberId);
    if (!detail) {
      renderStatus("該当する議員が見つかりません。");
      document.getElementById("basicArea").innerHTML = '<div class="empty">該当する議員がありません。</div>';
      return;
    }

    document.getElementById("pageTitle").textContent = detail.member_name;
    document.getElementById("pageDesc").textContent = "議員詳細を表示しています。";

    renderStatus([
      "member_detail.html 読み込み成功",
      "member_id: " + detail.member_id,
      "current_status: " + detail.current_status,
      "party_history: " + (detail.party_history || []).length + "件",
      "committee_history_regular: " + (detail.committee_history_regular || []).length + "件",
      "committee_history_special: " + (detail.committee_history_special || []).length + "件",
      "office_terms: " + (detail.office_terms || []).length + "件",
      "contact_history: " + (detail.contact_history || []).length + "件",
      "council_history: " + (detail.council_history || []).length + "件"
    ].join("\n"));

    renderBasic(detail);
    renderCurrent(detail);
    renderCommitteeHistory(detail);

    renderHistorySection("partyHistoryArea", (detail.party_history || []).map(function (row) {
      let text = formatPeriod(row.start_date, row.end_date) + " / " + (row.party_name || "");
      if (row.role_name) text += " / " + row.role_name;
      if (row.note) text += " / " + row.note;
      return text;
    }));

    renderHistorySection("officeHistoryArea", (detail.office_terms || []).map(function (row) {
      let text = formatPeriod(row.term_start_date, row.term_end_date) + " / " + (row.election_label || "");
      if (row.end_reason_code) text += " / " + row.end_reason_code;
      if (row.note) text += " / " + row.note;
      return text;
    }));

    renderHistorySection("contactHistoryArea", (detail.contact_history || []).map(function (row) {
      let text = formatPeriod(row.start_date, row.end_date) + " / 住所: " + (row.address || "");
      if (row.address_visibility) text += " / 住所公開範囲: " + visibilityLabel(row.address_visibility);
      if (row.phone_home) text += " / 自宅電話: " + row.phone_home;
      if (row.phone_home_visibility) text += " / 自宅電話公開範囲: " + visibilityLabel(row.phone_home_visibility);
      if (row.phone_mobile) text += " / 携帯電話: " + row.phone_mobile;
      if (row.phone_mobile_visibility) text += " / 携帯電話公開範囲: " + visibilityLabel(row.phone_mobile_visibility);
      if (row.email) text += " / メール: " + row.email;
      if (row.email_visibility) text += " / メール公開範囲: " + visibilityLabel(row.email_visibility);
      if (row.contact_note) text += " / " + row.contact_note;
      return text;
    }));

    renderHistorySection("councilHistoryArea", (detail.council_history || []).map(function (row) {
      let text = formatPeriod(row.start_date, row.end_date) + " / " + (row.council_name || "");
      if (row.role_name) text += " / " + row.role_name;
      if (row.note) text += " / " + row.note;
      return text;
    }));
  }

  return {
    init: init
  };
})();

document.addEventListener("DOMContentLoaded", function () {
  window.MEMBER_DETAIL_VIEW.init();
});