window.YoteiApp = (function () {
  "use strict";

  var Utils = window.YoteiUtils;
  var EventStore = window.YoteiEventStore;
  var HistoryStore = window.YoteiHistoryStore;
  var FileAccess = window.YoteiFileAccess;
  var ExportImport = window.YoteiExportImport;
  var Editor = window.YoteiEventEditor;
  var Calendar = window.YoteiCalendar;

  var state = {
    loadedSnapshot: null,
    selectedEventId: "",
    showDeleted: false
  };

  var dom = {};

  async function init() {
    Utils.ensureAppData();
    state.loadedSnapshot = ExportImport.importSnapshotFromWindow();

    cacheDom();
    bindButtons();
    Editor.init({
      onSubmit: handleEditorSubmit,
      onEditFromDetail: openEditFromDetail,
      onDeleteFromDetail: deleteFromDetail
    });

    Calendar.init({
      getShowDeleted: function () {
        return state.showDeleted;
      },
      onDateClick: function (payload) {
        Editor.openCreateModal(payload);
      },
      onEventClick: function (eventId) {
        selectEvent(eventId, true);
      },
      onEventDateChange: handleCalendarDateChange
    });

    var restoreResult = await FileAccess.restoreDirectory();
    if (restoreResult && restoreResult.restored) {
      await syncSnapshotFromFiles(false);
    }
    updateStatusCards();
    updateEventCount();
    renderSelectedEvent(null);
    showStatusMessage(
      restoreResult && restoreResult.restored
        ? restoreResult.message
        : "アプリを読み込みました。",
      restoreResult && restoreResult.restored ? "success" : "info"
    );

    if (!FileAccess.isSupported()) {
      showStatusMessage(FileAccess.getSupportMessage(), "warning");
      return;
    }

    if (restoreResult && !restoreResult.ok && restoreResult.message) {
      showStatusMessage(restoreResult.message, restoreResult.type || "warning");
    }
  }

  function cacheDom() {
    dom.apiSupportValue = document.getElementById("apiSupportValue");
    dom.apiSupportNote = document.getElementById("apiSupportNote");
    dom.directoryStatusValue = document.getElementById("directoryStatusValue");
    dom.directoryStatusNote = document.getElementById("directoryStatusNote");
    dom.lastSavedValue = document.getElementById("lastSavedValue");
    dom.lastSavedNote = document.getElementById("lastSavedNote");
    dom.statusMessage = document.getElementById("statusMessage");
    dom.chooseDirectoryButton = document.getElementById("chooseDirectoryButton");
    dom.saveButton = document.getElementById("saveButton");
    dom.reloadButton = document.getElementById("reloadButton");
    dom.newEventButton = document.getElementById("newEventButton");
    dom.selectedEventDetail = document.getElementById("selectedEventDetail");
    dom.selectedEventHistory = document.getElementById("selectedEventHistory");
    dom.selectedBadge = document.getElementById("selectedBadge");
    dom.historyCountBadge = document.getElementById("historyCountBadge");
    dom.eventCountText = document.getElementById("eventCountText");
    dom.showDeletedToggle = document.getElementById("showDeletedToggle");
    dom.showDeletedToggle.checked = state.showDeleted;
  }

  function bindButtons() {
    dom.chooseDirectoryButton.addEventListener("click", chooseDirectory);
    dom.saveButton.addEventListener("click", saveAllData);
    dom.reloadButton.addEventListener("click", reloadFromSnapshot);
    dom.newEventButton.addEventListener("click", function () {
      Editor.openCreateModal(Utils.createDefaultDateRange(new Date()));
    });
    dom.showDeletedToggle.addEventListener("change", handleShowDeletedToggle);
  }

  function showStatusMessage(message, type) {
    dom.statusMessage.textContent = message;
    dom.statusMessage.className = "status-banner is-" + (type || "info");
  }

  function updateStatusCards() {
    var fileState = FileAccess.getState();

    dom.apiSupportValue.textContent = fileState.supported ? "対応" : "未対応";
    dom.apiSupportNote.textContent = fileState.supportMessage;
    dom.directoryStatusValue.textContent = fileState.hasDirectoryHandle
      ? "設定済み"
      : (fileState.directoryName ? "再設定待ち" : "未設定");
    dom.directoryStatusNote.textContent = fileState.hasDirectoryHandle
      ? (fileState.directoryName + " を使用中")
      : (fileState.directoryName ? "前回: " + fileState.directoryName + " / 再設定が必要です" : "初回保存時に選択してください");
    dom.lastSavedValue.textContent = fileState.lastSavedAt || "未保存";
    dom.lastSavedNote.textContent = fileState.lastSavedAt
      ? "保存先の data/events.js と data/event_history.js を更新します"
      : "保存完了後に更新されます";

    dom.chooseDirectoryButton.disabled = !fileState.supported;
    dom.saveButton.disabled = !fileState.supported;
  }

  function updateEventCount() {
    var visibleCount = EventStore.getVisibleEvents(state.showDeleted).length;
    var totalCount = EventStore.getAllEvents().length;
    var deletedCount = totalCount - EventStore.getVisibleEvents(false).length;
    dom.eventCountText.textContent = state.showDeleted
      ? "表示中 " + visibleCount + " 件 / 全件 " + totalCount + " 件 / 削除済み " + deletedCount + " 件"
      : "表示中 " + visibleCount + " 件 / 全件 " + totalCount + " 件";
  }

  function handleShowDeletedToggle() {
    state.showDeleted = Boolean(dom.showDeletedToggle.checked);

    if (!state.showDeleted && state.selectedEventId) {
      var selectedEvent = EventStore.getEventById(state.selectedEventId);
      if (selectedEvent && Utils.toNumber(selectedEvent.extendedProps && selectedEvent.extendedProps.is_deleted, 0) === 1) {
        renderSelectedEvent(null);
      }
    }

    Calendar.refresh();
    updateEventCount();
    showStatusMessage(
      state.showDeleted ? "削除済みイベントも表示しています。" : "削除済みイベントを非表示にしました。",
      "info"
    );
  }

  function buildDetailHtml(event) {
    if (!event) {
      return [
        '<div class="empty-state">',
        "  <strong>イベントを選択してください</strong>",
        "  <p>カレンダー上の予定をクリックすると詳細と履歴を表示します。</p>",
        "</div>"
      ].join("");
    }

    var deleted = Utils.toNumber(event.extendedProps.is_deleted, 0) === 1;
    var meta = Utils.getCategoryMeta(event.extendedProps.category);

    return [
      '<div class="detail-title-row">',
      "  <div>",
      "    <h3>" + Utils.escapeHtml(event.title) + "</h3>",
      "    <p class=\"subtitle\">" + Utils.escapeHtml(Utils.formatEventPeriod(event)) + "</p>",
      "  </div>",
      '  <span class="event-chip' + (deleted ? " is-deleted" : "") + '" style="background:' + (deleted ? "#6b7280" : meta.color) + ';">' + Utils.escapeHtml(deleted ? "削除済み" : event.extendedProps.category) + "</span>",
      "</div>",
      '<dl class="detail-meta">',
      "  <div class=\"detail-row\"><dt>ID</dt><dd>" + Utils.escapeHtml(event.id) + "</dd></div>",
      "  <div class=\"detail-row\"><dt>場所</dt><dd>" + Utils.escapeHtml(event.extendedProps.location || "未設定") + "</dd></div>",
      "  <div class=\"detail-row\"><dt>担当部署</dt><dd>" + Utils.escapeHtml(event.extendedProps.department || "未設定") + "</dd></div>",
      "  <div class=\"detail-row\"><dt>内容</dt><dd>" + Utils.escapeHtml(event.extendedProps.content || "未設定") + "</dd></div>",
      "  <div class=\"detail-row\"><dt>公開</dt><dd>" + Utils.escapeHtml(event.extendedProps.visibility || "未設定") + "</dd></div>",
      "  <div class=\"detail-row\"><dt>重要度</dt><dd>" + Utils.escapeHtml(String(event.extendedProps.importance || "")) + "</dd></div>",
      "  <div class=\"detail-row\"><dt>更新者</dt><dd>" + Utils.escapeHtml(event.extendedProps.updated_by || "") + "</dd></div>",
      "  <div class=\"detail-row\"><dt>更新日時</dt><dd>" + Utils.escapeHtml(event.extendedProps.updated_at || "") + "</dd></div>",
      "  <div class=\"detail-row\"><dt>備考</dt><dd>" + Utils.escapeHtml(event.extendedProps.note || "未設定") + "</dd></div>",
      "</dl>"
    ].join("");
  }

  function buildHistoryHtml(histories) {
    if (!histories.length) {
      return [
        '<div class="empty-state">',
        "  <strong>履歴はまだありません</strong>",
        "  <p>この予定の変更履歴はまだ登録されていません。</p>",
        "</div>"
      ].join("");
    }

    return histories.map(function (item) {
      return [
        '<div class="history-item">',
        '  <div class="history-head">',
        '    <span class="history-type ' + item.operation_type.toLowerCase() + '">' + Utils.escapeHtml(item.operation_type) + "</span>",
        '    <span class="history-time">v' + Utils.escapeHtml(String(item.version_no)) + " / " + Utils.escapeHtml(item.changed_at) + "</span>",
        "  </div>",
        "  <p><span class=\"history-label\">概要</span> " + Utils.escapeHtml(item.change_summary || "変更") + "</p>",
        "  <p><span class=\"history-label\">変更者</span> " + Utils.escapeHtml(item.changed_by || "") + "</p>",
        "  <p><span class=\"history-label\">変更理由</span> " + Utils.escapeHtml(item.change_reason || "未入力") + "</p>",
        "  <p><span class=\"history-label\">差分</span><br>" + Utils.escapeHtml(item.diff_text || "差分なし").replace(/\n/g, "<br>") + "</p>",
        "</div>"
      ].join("");
    }).join("");
  }

  function renderSelectedEvent(event) {
    if (!event) {
      state.selectedEventId = "";
      dom.selectedBadge.textContent = "未選択";
      dom.historyCountBadge.textContent = "0 件";
      dom.selectedEventDetail.innerHTML = buildDetailHtml(null);
      dom.selectedEventHistory.innerHTML = buildHistoryHtml([]);
      Calendar.clearSelection();
      return;
    }

    var histories = HistoryStore.getHistoryByEventId(event.id);
    state.selectedEventId = event.id;
    dom.selectedBadge.textContent = event.id;
    dom.historyCountBadge.textContent = histories.length + " 件";
    dom.selectedEventDetail.innerHTML = buildDetailHtml(event);
    dom.selectedEventHistory.innerHTML = buildHistoryHtml(histories);
    Calendar.setSelectedEventId(event.id);
  }

  function selectEvent(eventId, openDetailModal) {
    var event = EventStore.getEventById(eventId);
    if (!event) {
      renderSelectedEvent(null);
      return;
    }

    renderSelectedEvent(event);

    if (openDetailModal) {
      Editor.openDetailModal(event, HistoryStore.getHistoryByEventId(event.id));
    }
  }

  function buildEventFromForm(payload, existingEvent) {
    var now = Utils.getCurrentTimestamp();
    var storedRange = Utils.buildStoredRange(payload.startInput, payload.endInput, payload.allDay);
    var base = existingEvent || {};
    var currentProps = base.extendedProps || {};
    var createdAt = currentProps.created_at || now;
    var createdBy = currentProps.created_by || payload.updated_by || "佐藤";

    return {
      id: base.id || EventStore.getNextEventId(),
      title: payload.title,
      start: storedRange.start,
      end: storedRange.end,
      allDay: payload.allDay,
      extendedProps: {
        category: payload.category,
        location: payload.location,
        department: payload.department,
        content: payload.content,
        visibility: payload.visibility,
        importance: payload.importance,
        created_at: createdAt,
        created_by: createdBy,
        updated_at: now,
        updated_by: payload.updated_by || "佐藤",
        is_deleted: currentProps.is_deleted || 0,
        sort_order: currentProps.sort_order || 10,
        note: payload.note
      }
    };
  }

  function handleEditorSubmit(payload) {
    try {
      if (payload.mode === "create") {
        var newEvent = buildEventFromForm(payload, null);
        EventStore.addEvent(newEvent);
        HistoryStore.addCreateHistory(newEvent, {
          changed_at: newEvent.extendedProps.updated_at,
          changed_by: newEvent.extendedProps.updated_by,
          change_reason: payload.change_reason
        });
        Editor.closeEditorModal();
        Calendar.refresh();
        updateEventCount();
        selectEvent(newEvent.id, false);
        showStatusMessage("予定を新規作成しました。", "success");
        return;
      }

      var currentEvent = EventStore.getEventById(payload.eventId);
      if (!currentEvent) {
        showStatusMessage("編集中の予定が見つかりません。", "error");
        return;
      }

      var beforeEvent = Utils.deepClone(currentEvent);
      var updatedEvent = buildEventFromForm(payload, currentEvent);
      EventStore.updateEvent(payload.eventId, updatedEvent);
      var savedEvent = EventStore.getEventById(payload.eventId);
      HistoryStore.addUpdateHistory(beforeEvent, savedEvent, {
        changed_at: savedEvent.extendedProps.updated_at,
        changed_by: savedEvent.extendedProps.updated_by,
        change_reason: payload.change_reason
      });
      Editor.closeEditorModal();
      Calendar.refresh();
      updateEventCount();
      selectEvent(savedEvent.id, false);
      showStatusMessage("予定を更新しました。", "success");
    } catch (error) {
      console.error("フォーム保存に失敗しました。", error);
      showStatusMessage("予定の保存に失敗しました。", "error");
    }
  }

  function openEditFromDetail(eventId) {
    var event = EventStore.getEventById(eventId);
    if (!event) {
      showStatusMessage("編集対象の予定が見つかりません。", "error");
      return;
    }
    Editor.closeDetailModal();
    Editor.openEditModal(event);
  }

  function deleteFromDetail(eventId) {
    var event = EventStore.getEventById(eventId);
    if (!event) {
      showStatusMessage("削除対象の予定が見つかりません。", "error");
      return;
    }

    var confirmed = window.confirm("「" + event.title + "」を削除しますか？\n削除は論理削除として記録されます。");
    if (!confirmed) {
      return;
    }

    var beforeEvent = Utils.deepClone(event);
    var now = Utils.getCurrentTimestamp();
    EventStore.logicalDeleteEvent(eventId, {
      updated_at: now,
      updated_by: event.extendedProps.updated_by || "佐藤"
    });
    HistoryStore.addDeleteHistory(beforeEvent, {
      changed_at: now,
      changed_by: event.extendedProps.updated_by || "佐藤",
      change_reason: ""
    });
    Editor.closeDetailModal();
    Calendar.refresh();
    updateEventCount();
    selectEvent(eventId, false);
    showStatusMessage("予定を削除しました。", "warning");
  }

  function handleCalendarDateChange(payload) {
    var event = EventStore.getEventById(payload.eventId);
    if (!event) {
      throw new Error("移動対象の予定が見つかりません。");
    }

    var beforeEvent = Utils.deepClone(event);
    var now = Utils.getCurrentTimestamp();
    EventStore.updateEvent(payload.eventId, {
      id: event.id,
      title: event.title,
      start: payload.start,
      end: payload.end,
      allDay: payload.allDay,
      extendedProps: {
        category: event.extendedProps.category,
        location: event.extendedProps.location,
        department: event.extendedProps.department,
        content: event.extendedProps.content,
        visibility: event.extendedProps.visibility,
        importance: event.extendedProps.importance,
        updated_at: now,
        updated_by: event.extendedProps.updated_by || "佐藤",
        is_deleted: event.extendedProps.is_deleted,
        sort_order: event.extendedProps.sort_order,
        note: event.extendedProps.note
      }
    });

    var updated = EventStore.getEventById(payload.eventId);
    HistoryStore.addUpdateHistory(beforeEvent, updated, {
      changed_at: now,
      changed_by: updated.extendedProps.updated_by,
      change_summary: payload.mutationType === "resize" ? "予定時間を調整" : "予定日時を移動",
      change_reason: payload.mutationType === "resize" ? "カレンダー上でサイズ変更" : "カレンダー上でドラッグ移動"
    });
    updateEventCount();
    selectEvent(updated.id, false);
    showStatusMessage(payload.mutationType === "resize" ? "予定時間を更新しました。" : "予定日時を更新しました。", "success");
  }

  async function chooseDirectory() {
    var result = await FileAccess.pickDirectory();
    updateStatusCards();
    showStatusMessage(result.message, result.type || "info");
  }

  async function saveAllData() {
    var exported = ExportImport.exportAll(window.APP_DATA);
    var result = await FileAccess.saveDataFiles(exported);
    updateStatusCards();

    if (result.ok) {
      var synced = await syncSnapshotFromFiles(true);
      if (!synced) {
        state.loadedSnapshot = ExportImport.importSnapshotFromWindow();
      }
      showStatusMessage(result.message + " 最終保存時刻: " + result.savedAt, result.type || "success");
      return;
    }

    showStatusMessage(result.message, result.type || "warning");
  }

  async function reloadFromSnapshot() {
    var synced = await syncSnapshotFromFiles(true);
    if (!synced) {
      EventStore.replaceAllEvents(state.loadedSnapshot.events);
      HistoryStore.replaceAllHistory(state.loadedSnapshot.event_history);
    }
    Calendar.refresh();
    updateEventCount();
    renderSelectedEvent(null);
    showStatusMessage(
      synced
        ? "保存先ファイルを再読込して再描画しました。"
        : "読み込み済みデータを元に再描画しました。",
      "info"
    );
  }

  async function syncSnapshotFromFiles(applyToStore) {
    if (!FileAccess.isSupported()) {
      return false;
    }

    var readResult = await FileAccess.readDataFiles();
    if (!readResult.ok) {
      return false;
    }

    try {
      var snapshot = ExportImport.importFromScriptTexts({
        eventsText: readResult.eventsText,
        historyText: readResult.historyText
      });
      state.loadedSnapshot = snapshot;
      if (applyToStore) {
        EventStore.replaceAllEvents(snapshot.events);
        HistoryStore.replaceAllHistory(snapshot.event_history);
      }
      return true;
    } catch (error) {
      console.error("保存先ファイルの解析に失敗しました。", error);
      return false;
    }
  }

  document.addEventListener("DOMContentLoaded", init);

  return {
    init: init
  };
}());
