window.YoteiEventEditor = (function () {
  "use strict";

  var Utils = window.YoteiUtils;
  var state = {
    callbacks: {},
    detailEventId: ""
  };
  var dom = {};

  function init(callbacks) {
    state.callbacks = callbacks || {};
    cacheDom();
    bindEvents();
  }

  function cacheDom() {
    dom.editorModal = document.getElementById("editorModal");
    dom.detailModal = document.getElementById("detailModal");
    dom.editorForm = document.getElementById("editorForm");
    dom.editorTitle = document.getElementById("editorModalTitle");
    dom.editorError = document.getElementById("editorError");
    dom.editorMode = document.getElementById("editorMode");
    dom.editorEventId = document.getElementById("editorEventId");
    dom.fieldTitle = document.getElementById("fieldTitle");
    dom.fieldStart = document.getElementById("fieldStart");
    dom.fieldEnd = document.getElementById("fieldEnd");
    dom.fieldAllDay = document.getElementById("fieldAllDay");
    dom.fieldCategory = document.getElementById("fieldCategory");
    dom.fieldLocation = document.getElementById("fieldLocation");
    dom.fieldDepartment = document.getElementById("fieldDepartment");
    dom.fieldContent = document.getElementById("fieldContent");
    dom.fieldVisibility = document.getElementById("fieldVisibility");
    dom.fieldImportance = document.getElementById("fieldImportance");
    dom.fieldUpdatedBy = document.getElementById("fieldUpdatedBy");
    dom.fieldChangeReason = document.getElementById("fieldChangeReason");
    dom.fieldNote = document.getElementById("fieldNote");
    dom.allDayHint = document.getElementById("allDayHint");
    dom.detailModalBody = document.getElementById("detailModalBody");
    dom.detailEditButton = document.getElementById("detailEditButton");
    dom.detailDeleteButton = document.getElementById("detailDeleteButton");
  }

  function bindEvents() {
    document.addEventListener("click", function (event) {
      var closeType = event.target && event.target.getAttribute("data-close-modal");
      if (!closeType) {
        return;
      }
      if (closeType === "editor") {
        closeEditorModal();
      }
      if (closeType === "detail") {
        closeDetailModal();
      }
    });

    dom.editorForm.addEventListener("submit", function (event) {
      event.preventDefault();
      submitEditorForm();
    });

    dom.fieldAllDay.addEventListener("change", updateAllDayHint);

    dom.detailEditButton.addEventListener("click", function () {
      if (!state.detailEventId || typeof state.callbacks.onEditFromDetail !== "function") {
        return;
      }
      state.callbacks.onEditFromDetail(state.detailEventId);
    });

    dom.detailDeleteButton.addEventListener("click", function () {
      if (!state.detailEventId || typeof state.callbacks.onDeleteFromDetail !== "function") {
        return;
      }
      state.callbacks.onDeleteFromDetail(state.detailEventId);
    });
  }

  function showEditorError(message) {
    dom.editorError.textContent = message;
    dom.editorError.classList.remove("hidden");
  }

  function clearEditorError() {
    dom.editorError.textContent = "";
    dom.editorError.classList.add("hidden");
  }

  function updateAllDayHint() {
    dom.allDayHint.textContent = dom.fieldAllDay.checked
      ? "終日にすると、終了日は入力値の当日までを予定期間として保存します。"
      : "時間指定予定として保存します。終了日時は開始日時以上にしてください。";
  }

  function openCreateModal(prefill) {
    var base = prefill || Utils.createDefaultDateRange(new Date());

    dom.editorTitle.textContent = "新規作成";
    dom.editorMode.value = "create";
    dom.editorEventId.value = "";
    dom.fieldTitle.value = "";
    dom.fieldCategory.value = "会議";
    dom.fieldStart.value = base.startInput || Utils.createDefaultDateRange(new Date()).startInput;
    dom.fieldEnd.value = base.endInput || Utils.createDefaultDateRange(new Date()).endInput;
    dom.fieldAllDay.checked = Boolean(base.allDay);
    dom.fieldLocation.value = "";
    dom.fieldDepartment.value = "";
    dom.fieldContent.value = "";
    dom.fieldVisibility.value = "内部";
    dom.fieldImportance.value = "2";
    dom.fieldUpdatedBy.value = "佐藤";
    dom.fieldChangeReason.value = "";
    dom.fieldNote.value = "";
    clearEditorError();
    updateAllDayHint();
    openModal(dom.editorModal);
    dom.fieldTitle.focus();
  }

  function openEditModal(event) {
    if (!event) {
      return;
    }

    dom.editorTitle.textContent = "イベント編集";
    dom.editorMode.value = "edit";
    dom.editorEventId.value = event.id;
    dom.fieldTitle.value = Utils.sanitizeText(event.title);
    dom.fieldCategory.value = Utils.sanitizeText(event.extendedProps.category, "会議");
    dom.fieldStart.value = event.allDay
      ? Utils.toDateTimeLocalValue(event.start)
      : Utils.toDateTimeLocalValue(event.start);
    dom.fieldEnd.value = event.allDay
      ? Utils.toDateTimeLocalValue(Utils.shiftDate(event.end || event.start, -1))
      : Utils.toDateTimeLocalValue(event.end || event.start);
    dom.fieldAllDay.checked = Boolean(event.allDay);
    dom.fieldLocation.value = Utils.sanitizeText(event.extendedProps.location);
    dom.fieldDepartment.value = Utils.sanitizeText(event.extendedProps.department);
    dom.fieldContent.value = Utils.sanitizeText(event.extendedProps.content);
    dom.fieldVisibility.value = Utils.sanitizeText(event.extendedProps.visibility, "内部");
    dom.fieldImportance.value = String(Utils.toNumber(event.extendedProps.importance, 2));
    dom.fieldUpdatedBy.value = Utils.sanitizeText(event.extendedProps.updated_by, "佐藤");
    dom.fieldChangeReason.value = "";
    dom.fieldNote.value = Utils.sanitizeText(event.extendedProps.note);
    clearEditorError();
    updateAllDayHint();
    openModal(dom.editorModal);
    dom.fieldTitle.focus();
  }

  function validateForm(payload) {
    if (!payload.title) {
      return "タイトルを入力してください。";
    }
    if (!payload.startInput) {
      return "開始日時を入力してください。";
    }

    if (payload.allDay) {
      var startDate = Utils.getDatePart(payload.startInput);
      var endDate = Utils.getDatePart(payload.endInput || payload.startInput);
      if (endDate < startDate) {
        return "終日予定の終了日は開始日以降にしてください。";
      }
      return "";
    }

    if (payload.endInput && payload.endInput < payload.startInput) {
      return "終了日時は開始日時以上にしてください。";
    }

    return "";
  }

  function readEditorForm() {
    return {
      mode: dom.editorMode.value,
      eventId: dom.editorEventId.value,
      title: dom.fieldTitle.value.trim(),
      startInput: dom.fieldStart.value,
      endInput: dom.fieldEnd.value || dom.fieldStart.value,
      allDay: dom.fieldAllDay.checked,
      category: dom.fieldCategory.value,
      location: dom.fieldLocation.value.trim(),
      department: dom.fieldDepartment.value.trim(),
      content: dom.fieldContent.value.trim(),
      visibility: dom.fieldVisibility.value,
      importance: dom.fieldImportance.value,
      updated_by: dom.fieldUpdatedBy.value.trim() || "佐藤",
      change_reason: dom.fieldChangeReason.value.trim(),
      note: dom.fieldNote.value.trim()
    };
  }

  function submitEditorForm() {
    clearEditorError();
    var payload = readEditorForm();
    var validationMessage = validateForm(payload);

    if (validationMessage) {
      showEditorError(validationMessage);
      return;
    }

    if (typeof state.callbacks.onSubmit === "function") {
      state.callbacks.onSubmit(payload);
    }
  }

  function buildDetailRows(event) {
    var deleted = Utils.toNumber(event.extendedProps.is_deleted, 0) === 1;
    var chip = Utils.getCategoryMeta(event.extendedProps.category);

    return [
      '<div class="detail-modal-card">',
      '  <div class="detail-title-row">',
      "    <div>",
      "      <h3>" + Utils.escapeHtml(event.title) + "</h3>",
      "      <p class=\"subtitle\">" + Utils.escapeHtml(Utils.formatEventPeriod(event)) + "</p>",
      "    </div>",
      '    <span class="event-chip' + (deleted ? " is-deleted" : "") + '" style="background:' + (deleted ? "#6b7280" : chip.color) + ';">' + Utils.escapeHtml(deleted ? "削除済み" : event.extendedProps.category) + "</span>",
      "  </div>",
      '  <dl class="detail-meta">',
      "    <div class=\"detail-row\"><dt>ID</dt><dd>" + Utils.escapeHtml(event.id) + "</dd></div>",
      "    <div class=\"detail-row\"><dt>場所</dt><dd>" + Utils.escapeHtml(event.extendedProps.location || "未設定") + "</dd></div>",
      "    <div class=\"detail-row\"><dt>担当部署</dt><dd>" + Utils.escapeHtml(event.extendedProps.department || "未設定") + "</dd></div>",
      "    <div class=\"detail-row\"><dt>内容</dt><dd>" + Utils.escapeHtml(event.extendedProps.content || "未設定") + "</dd></div>",
      "    <div class=\"detail-row\"><dt>公開レベル</dt><dd>" + Utils.escapeHtml(event.extendedProps.visibility || "未設定") + "</dd></div>",
      "    <div class=\"detail-row\"><dt>重要度</dt><dd>" + Utils.escapeHtml(String(event.extendedProps.importance || "")) + "</dd></div>",
      "    <div class=\"detail-row\"><dt>作成者</dt><dd>" + Utils.escapeHtml(event.extendedProps.created_by || "") + " / " + Utils.escapeHtml(event.extendedProps.created_at || "") + "</dd></div>",
      "    <div class=\"detail-row\"><dt>更新者</dt><dd>" + Utils.escapeHtml(event.extendedProps.updated_by || "") + " / " + Utils.escapeHtml(event.extendedProps.updated_at || "") + "</dd></div>",
      "    <div class=\"detail-row\"><dt>備考</dt><dd>" + Utils.escapeHtml(event.extendedProps.note || "未設定") + "</dd></div>",
      "  </dl>",
      "</div>"
    ].join("");
  }

  function buildHistoryHtml(histories) {
    if (!histories || !histories.length) {
      return [
        '<div class="empty-state">',
        "  <strong>履歴はまだありません</strong>",
        "  <p>この予定の変更履歴はまだ登録されていません。</p>",
        "</div>"
      ].join("");
    }

    return histories.map(function (history) {
      return [
        '<div class="history-item">',
        '  <div class="history-head">',
        '    <span class="history-type ' + history.operation_type.toLowerCase() + '">' + Utils.escapeHtml(history.operation_type) + "</span>",
        '    <span class="history-time">' + Utils.escapeHtml(history.changed_at) + "</span>",
        "  </div>",
        "  <p><span class=\"history-label\">概要</span> " + Utils.escapeHtml(history.change_summary || "変更") + "</p>",
        "  <p><span class=\"history-label\">変更者</span> " + Utils.escapeHtml(history.changed_by || "") + "</p>",
        "  <p><span class=\"history-label\">理由</span> " + Utils.escapeHtml(history.change_reason || "未入力") + "</p>",
        "  <p><span class=\"history-label\">差分</span><br>" + Utils.escapeHtml(history.diff_text || "差分なし").replace(/\n/g, "<br>") + "</p>",
        "</div>"
      ].join("");
    }).join("");
  }

  function openDetailModal(event, histories) {
    if (!event) {
      return;
    }

    var isDeleted = Utils.toNumber(event.extendedProps && event.extendedProps.is_deleted, 0) === 1;
    state.detailEventId = event.id;
    dom.detailModalBody.innerHTML = [
      buildDetailRows(event),
      '<div class="detail-modal-card">',
      "  <h3>履歴</h3>",
      '  <div class="detail-modal-history">' + buildHistoryHtml(histories) + "</div>",
      "</div>"
    ].join("");
    dom.detailEditButton.disabled = isDeleted;
    dom.detailDeleteButton.disabled = isDeleted;
    dom.detailEditButton.title = isDeleted ? "削除済みイベントは編集できません。" : "";
    dom.detailDeleteButton.title = isDeleted ? "このイベントはすでに論理削除されています。" : "";
    openModal(dom.detailModal);
  }

  function closeEditorModal() {
    closeModal(dom.editorModal);
  }

  function closeDetailModal() {
    closeModal(dom.detailModal);
  }

  function openModal(element) {
    if (!element) {
      return;
    }
    element.classList.remove("hidden");
    element.setAttribute("aria-hidden", "false");
  }

  function closeModal(element) {
    if (!element) {
      return;
    }
    element.classList.add("hidden");
    element.setAttribute("aria-hidden", "true");
  }

  return {
    init: init,
    openCreateModal: openCreateModal,
    openEditModal: openEditModal,
    openDetailModal: openDetailModal,
    closeEditorModal: closeEditorModal,
    closeDetailModal: closeDetailModal
  };
}());
