window.AGENDAS_VIEW = (function () {
  "use strict";

  const escapeHtml = window.APP_UTILS.escapeHtml;
  const openInNewTab = window.APP_UTILS.openInNewTab;
  const toWareki = window.APP_FORMATTERS.toWareki;

  function getArray(name) {
    return Array.isArray(window.APP_DATA[name]) ? window.APP_DATA[name] : [];
  }

  function agendaCategoryLabel(value) {
    const map = {
      STEERING: "議運",
      LEADERS: "会派代表者会議",
      OTHER: "その他"
    };
    return map[value] || value || "";
  }

  function agendaSubcategoryLabel(value) {
    const map = {
      SCHEDULE: "日程調整",
      BILL_HANDLING: "議案取扱",
      QUESTION_HANDLING: "一般質問取扱",
      COORDINATION: "調整",
      REPORT: "報告",
      OTHER: "その他"
    };
    return map[value] || value || "";
  }

  function getMeetingById(meetingId) {
    return getArray("meetings").find(function (row) {
      return row.meeting_id === meetingId;
    }) || null;
  }

  function getEventById(eventId) {
    return getArray("events").find(function (row) {
      return row.event_id === eventId;
    }) || null;
  }

  function buildAgendaList() {
    const agendas = getArray("agendas");
    const agendaActions = getArray("agenda_actions");

    return agendas
      .slice()
      .sort(function (a, b) {
        const asort = Number(a.sort_order || 999999);
        const bsort = Number(b.sort_order || 999999);
        if (asort !== bsort) return asort - bsort;
        return (a.agenda_title || "") < (b.agenda_title || "") ? -1 : 1;
      })
      .map(function (agenda) {
        const actions = agendaActions
          .filter(function (row) {
            return row.agenda_id === agenda.agenda_id;
          })
          .slice()
          .sort(function (a, b) {
            const ad = a.action_date || "";
            const bd = b.action_date || "";
            if (ad !== bd) return ad < bd ? -1 : 1;

            const ae = getEventById(a.event_id);
            const be = getEventById(b.event_id);
            const asort = Number(ae && ae.sort_order ? ae.sort_order : 999999);
            const bsort = Number(be && be.sort_order ? be.sort_order : 999999);
            if (asort !== bsort) return asort - bsort;

            return (a.agenda_action_id || "") < (b.agenda_action_id || "") ? -1 : 1;
          });

        const firstAction = actions[0] || null;
        const lastAction = actions.length ? actions[actions.length - 1] : null;
        const meetingCount = [...new Set(actions.map(function (row) {
          return row.meeting_id || "";
        }).filter(Boolean))].length;

        const firstMeeting = firstAction ? getMeetingById(firstAction.meeting_id) : null;

        return {
          agenda_id: agenda.agenda_id || "",
          agenda_category: agenda.agenda_category || "",
          agenda_subcategory: agenda.agenda_subcategory || "",
          agenda_title: agenda.agenda_title || "",
          agenda_summary: agenda.agenda_summary || "",
          note: agenda.note || "",
          sort_order: agenda.sort_order || "",
          first_action_date: firstAction ? (firstAction.action_date || "") : "",
          last_action_date: lastAction ? (lastAction.action_date || "") : "",
          first_meeting_name: firstMeeting ? (firstMeeting.session_name || "") : "",
          action_count: actions.length,
          meeting_count: meetingCount
        };
      });
  }

  function renderStatus() {
    document.getElementById("statusBox").textContent = [
      "agenda.html 読み込み成功",
      "agendas: " + getArray("agendas").length + "件",
      "agenda_actions: " + getArray("agenda_actions").length + "件",
      "meetings: " + getArray("meetings").length + "件",
      "events: " + getArray("events").length + "件"
    ].join("\n");
  }

  function renderCategoryOptions() {
    const select = document.getElementById("searchCategory");
    const values = [...new Set(
      getArray("agendas").map(function (row) {
        return row.agenda_category;
      }).filter(Boolean)
    )];

    select.innerHTML = ['<option value="">すべて</option>']
      .concat(values.map(function (value) {
        return '<option value="' + escapeHtml(value) + '">' + escapeHtml(agendaCategoryLabel(value)) + "</option>";
      }))
      .join("");
  }

  function renderSubcategoryOptions(selectedCategory) {
    const select = document.getElementById("searchSubcategory");
    const values = [...new Set(
      getArray("agendas")
        .filter(function (row) {
          return !selectedCategory || row.agenda_category === selectedCategory;
        })
        .map(function (row) {
          return row.agenda_subcategory;
        })
        .filter(Boolean)
    )];

    select.innerHTML = ['<option value="">すべて</option>']
      .concat(values.map(function (value) {
        return '<option value="' + escapeHtml(value) + '">' + escapeHtml(agendaSubcategoryLabel(value)) + "</option>";
      }))
      .join("");
  }

  function filterRows(rows) {
    const searchCategory = document.getElementById("searchCategory").value;
    const searchSubcategory = document.getElementById("searchSubcategory").value;
    const searchText = document.getElementById("searchText").value.trim().toLowerCase();

    return rows.filter(function (row) {
      const hitCategory = !searchCategory || row.agenda_category === searchCategory;
      const hitSubcategory = !searchSubcategory || row.agenda_subcategory === searchSubcategory;

      const source = [
        row.agenda_title || "",
        row.agenda_summary || "",
        row.note || "",
        row.first_meeting_name || ""
      ].join(" ").toLowerCase();

      const hitText = !searchText || source.includes(searchText);

      return hitCategory && hitSubcategory && hitText;
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
        "<table>" +
          "<thead>" +
            "<tr>" +
              "<th>大分類</th>" +
              "<th>中分類</th>" +
              "<th>議題</th>" +
              "<th>初回日</th>" +
              "<th>最終日</th>" +
              "<th>関係会議数</th>" +
              "<th>履歴数</th>" +
            "</tr>" +
          "</thead>" +
          "<tbody>" +
            rows.map(function (row) {
              return (
                '<tr class="clickable-row" data-agenda-id="' + escapeHtml(row.agenda_id) + '">' +
                  "<td>" + escapeHtml(agendaCategoryLabel(row.agenda_category)) + "</td>" +
                  "<td>" + escapeHtml(agendaSubcategoryLabel(row.agenda_subcategory)) + "</td>" +
                  "<td>" + escapeHtml(row.agenda_title) + "</td>" +
                  "<td>" + escapeHtml(row.first_action_date ? toWareki(row.first_action_date) : "") + "</td>" +
                  "<td>" + escapeHtml(row.last_action_date ? toWareki(row.last_action_date) : "") + "</td>" +
                  "<td>" + escapeHtml(String(row.meeting_count)) + "</td>" +
                  "<td>" + escapeHtml(String(row.action_count)) + "</td>" +
                "</tr>"
              );
            }).join("") +
          "</tbody>" +
        "</table>" +
      "</div>";

    resultArea.querySelectorAll(".clickable-row").forEach(function (rowEl) {
      rowEl.addEventListener("click", function () {
        const agendaId = rowEl.dataset.agendaId || "";
        if (agendaId) {
          openInNewTab("agenda_detail.html?agenda_id=" + encodeURIComponent(agendaId));
        }
      });
    });
  }

  function redraw() {
    const rows = filterRows(buildAgendaList());
    renderTable(rows);
  }

  function init() {
    const searchCategory = document.getElementById("searchCategory");
    const searchSubcategory = document.getElementById("searchSubcategory");
    const searchText = document.getElementById("searchText");

    renderStatus();
    renderCategoryOptions();
    renderSubcategoryOptions("");
    redraw();

    searchCategory.addEventListener("change", function () {
      renderSubcategoryOptions(searchCategory.value);
      redraw();
    });

    searchSubcategory.addEventListener("change", redraw);
    searchText.addEventListener("input", redraw);
  }

  return {
    init: init
  };
})();

document.addEventListener("DOMContentLoaded", function () {
  window.AGENDAS_VIEW.init();
});
