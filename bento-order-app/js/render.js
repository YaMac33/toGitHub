(function () {
  "use strict";

  const { state } = window.BentoState;
  const {
    formatYen,
    formatDate,
    formatDateTime,
    statusLabel,
    escapeHtml
  } = window.BentoFormatters;

  const tabs = [
    { id: "order", label: "注文", hash: "#order" },
    { id: "change", label: "変更・キャンセル", hash: "#change" },
    { id: "orders", label: "注文一覧", hash: "#orders" },
    { id: "summary", label: "集計", hash: "#summary" }
  ];

  function optionHtml(value, label, selectedValue) {
    const selected = value === selectedValue ? " selected" : "";
    return `<option value="${escapeHtml(value)}"${selected}>${escapeHtml(label)}</option>`;
  }

  function renderDepartmentSelect(formState, formName) {
    const options = [
      '<option value="">選択してください</option>',
      ...state.departments.map((department) =>
        optionHtml(department, department, formState.department)
      )
    ].join("");

    const customField =
      formState.department === "その他"
        ? `
          <div class="field field-nested">
            <label for="${formName}-custom-department">その他の部署名</label>
            <input
              id="${formName}-custom-department"
              type="text"
              data-form="${formName}"
              data-field="customDepartment"
              value="${escapeHtml(formState.customDepartment)}"
              autocomplete="organization"
              placeholder="部署名を入力"
            >
          </div>
        `
        : "";

    return `
      <div class="field">
        <label for="${formName}-department">担当部署</label>
        <select id="${formName}-department" data-form="${formName}" data-field="department">
          ${options}
        </select>
      </div>
      ${customField}
    `;
  }

  function renderDeliveryDateOptions(selectedValue) {
    return [
      '<option value="">選択してください</option>',
      ...state.deliveryDates.map((entry) => {
        const label = `${formatDate(entry.date)} / 締切 ${formatDateTime(entry.deadline)}`;
        return optionHtml(entry.date, label, selectedValue);
      })
    ].join("");
  }

  function renderQuantityCards(formName, quantities, disabled) {
    const cardClass = disabled ? " menu-card is-disabled" : "menu-card";
    const stepAction = formName === "order" ? "order-step" : "change-step";
    const inputAction = formName === "order" ? "order-quantity" : "change-quantity";

    return state.menus
      .map((menu) => {
        const quantity = Number(quantities[menu.id]) || 0;
        const subtotal = menu.price * quantity;
        return `
          <article class="${cardClass}">
            <div>
              <p class="menu-code">${escapeHtml(menu.id)}</p>
              <h3>${escapeHtml(menu.name)}</h3>
              <p class="menu-price">${formatYen(menu.price)}</p>
            </div>
            <div class="quantity-control" aria-label="${escapeHtml(menu.name)}の個数">
              <button
                type="button"
                class="quantity-button"
                data-action="${stepAction}"
                data-menu-id="${escapeHtml(menu.id)}"
                data-delta="-1"
                ${disabled ? "disabled" : ""}
                aria-label="${escapeHtml(menu.name)}を1個減らす"
              >−</button>
              <input
                type="number"
                min="0"
                step="1"
                inputmode="numeric"
                data-action="${inputAction}"
                data-menu-id="${escapeHtml(menu.id)}"
                value="${quantity}"
                ${disabled ? "disabled" : ""}
                aria-label="${escapeHtml(menu.name)}の個数"
              >
              <button
                type="button"
                class="quantity-button"
                data-action="${stepAction}"
                data-menu-id="${escapeHtml(menu.id)}"
                data-delta="1"
                ${disabled ? "disabled" : ""}
                aria-label="${escapeHtml(menu.name)}を1個増やす"
              >＋</button>
            </div>
            <p class="subtotal">小計：<strong id="${formName}-subtotal-${escapeHtml(menu.id)}">${formatYen(subtotal)}</strong></p>
          </article>
        `;
      })
      .join("");
  }

  function renderTabs() {
    const tabMenu = document.getElementById("tab-menu");
    if (!tabMenu) return;

    tabMenu.innerHTML = tabs
      .map((tab) => {
        const selected = state.currentTab === tab.id;
        return `
          <a
            class="tab-button${selected ? " is-active" : ""}"
            href="${tab.hash}"
            data-tab="${tab.id}"
            role="tab"
            aria-selected="${selected}"
          >${escapeHtml(tab.label)}</a>
        `;
      })
      .join("");
  }

  function renderOrderForm() {
    const panel = document.getElementById("tab-panel");
    if (!panel) return;

    const draft = window.BentoState.getOrderDraft();

    panel.innerHTML = `
      <section class="panel" aria-labelledby="order-title">
        <div class="section-heading">
          <div>
            <p class="section-kicker">Order</p>
            <h2 id="order-title">弁当を注文する</h2>
          </div>
          <span class="notice-pill">締切前に送信</span>
        </div>

        <form id="order-form" class="form-grid" novalidate>
          ${renderDepartmentSelect(state.currentOrder, "order")}

          <div class="field">
            <label for="order-applicant-name">注文担当者名</label>
            <input
              id="order-applicant-name"
              type="text"
              data-form="order"
              data-field="applicantName"
              value="${escapeHtml(state.currentOrder.applicantName)}"
              autocomplete="name"
              placeholder="例：田中"
            >
          </div>

          <div class="field">
            <label for="order-email">メールアドレス</label>
            <input
              id="order-email"
              type="email"
              data-form="order"
              data-field="email"
              value="${escapeHtml(state.currentOrder.email)}"
              autocomplete="email"
              placeholder="example@example.com"
            >
          </div>

          <div class="field field-wide">
            <label for="order-delivery-date">受取日</label>
            <select id="order-delivery-date" data-form="order" data-field="deliveryDate">
              ${renderDeliveryDateOptions(state.currentOrder.deliveryDate)}
            </select>
          </div>

          <div class="field field-wide">
            <label for="order-note">備考</label>
            <textarea
              id="order-note"
              rows="3"
              data-form="order"
              data-field="note"
              placeholder="アレルギー、受取方法など"
            >${escapeHtml(state.currentOrder.note)}</textarea>
          </div>
        </form>

        <div class="menu-grid" aria-label="メニュー一覧">
          ${renderQuantityCards("order", state.currentOrder.quantities, false)}
        </div>

        <div class="total-bar" aria-live="polite">
          <div>
            <span>合計個数</span>
            <strong id="order-total-quantity">${draft.totalQuantity}</strong>
          </div>
          <div>
            <span>合計金額</span>
            <strong id="order-total-amount">${formatYen(draft.totalAmount)}</strong>
          </div>
          <button type="button" class="primary-button" data-action="order-confirm">
            注文内容を確認
          </button>
        </div>
      </section>
    `;
  }

  function renderChangeCancelForm() {
    const panel = document.getElementById("tab-panel");
    if (!panel) return;

    const isCancel = state.currentChange.actionType === "cancel";
    const draft = isCancel
      ? window.BentoState.getCancelDraft()
      : window.BentoState.getChangeDraft();

    panel.innerHTML = `
      <section class="panel" aria-labelledby="change-title">
        <div class="section-heading">
          <div>
            <p class="section-kicker">Update</p>
            <h2 id="change-title">変更・キャンセル</h2>
          </div>
          <span class="notice-pill">注文IDが必要</span>
        </div>

        <form id="change-form" class="form-grid" novalidate>
          <fieldset class="field field-wide choice-field">
            <legend>処理種別</legend>
            <label class="radio-card">
              <input
                type="radio"
                name="actionType"
                value="change"
                data-form="change"
                data-field="actionType"
                ${state.currentChange.actionType === "change" ? "checked" : ""}
              >
              <span>変更</span>
            </label>
            <label class="radio-card">
              <input
                type="radio"
                name="actionType"
                value="cancel"
                data-form="change"
                data-field="actionType"
                ${state.currentChange.actionType === "cancel" ? "checked" : ""}
              >
              <span>キャンセル</span>
            </label>
          </fieldset>

          <div class="field field-wide">
            <label for="change-target-order-id">注文ID</label>
            <input
              id="change-target-order-id"
              type="text"
              data-form="change"
              data-field="targetOrderId"
              value="${escapeHtml(state.currentChange.targetOrderId)}"
              placeholder="ORDER-20260525-A7K2"
            >
          </div>

          ${renderDepartmentSelect(state.currentChange, "change")}

          <div class="field">
            <label for="change-applicant-name">注文担当者名</label>
            <input
              id="change-applicant-name"
              type="text"
              data-form="change"
              data-field="applicantName"
              value="${escapeHtml(state.currentChange.applicantName)}"
              autocomplete="name"
              placeholder="例：田中"
            >
          </div>

          <div class="field">
            <label for="change-email">メールアドレス</label>
            <input
              id="change-email"
              type="email"
              data-form="change"
              data-field="email"
              value="${escapeHtml(state.currentChange.email)}"
              autocomplete="email"
              placeholder="example@example.com"
            >
          </div>

          <div class="field field-wide${isCancel ? " is-muted" : ""}">
            <label for="change-delivery-date">変更後受取日</label>
            <select
              id="change-delivery-date"
              data-form="change"
              data-field="newDeliveryDate"
              ${isCancel ? "disabled" : ""}
            >
              ${renderDeliveryDateOptions(state.currentChange.newDeliveryDate)}
            </select>
          </div>

          <div class="field field-wide">
            <label for="change-note">備考</label>
            <textarea
              id="change-note"
              rows="3"
              data-form="change"
              data-field="note"
              placeholder="変更理由、連絡事項など"
            >${escapeHtml(state.currentChange.note)}</textarea>
          </div>
        </form>

        ${
          isCancel
            ? `<div class="info-box">キャンセルの場合、変更後メニューの入力は不要です。</div>`
            : `
              <div class="menu-grid" aria-label="変更後メニュー一覧">
                ${renderQuantityCards("change", state.currentChange.quantities, false)}
              </div>

              <div class="total-bar" aria-live="polite">
                <div>
                  <span>変更後合計個数</span>
                  <strong id="change-total-quantity">${draft.totalQuantity}</strong>
                </div>
                <div>
                  <span>変更後合計金額</span>
                  <strong id="change-total-amount">${formatYen(draft.totalAmount)}</strong>
                </div>
                <button type="button" class="primary-button" data-action="change-confirm">
                  変更内容を確認
                </button>
              </div>
            `
        }

        ${
          isCancel
            ? `
              <div class="total-bar total-bar-single">
                <div>
                  <span>処理内容</span>
                  <strong>キャンセル申請</strong>
                </div>
                <button type="button" class="danger-button" data-action="change-confirm">
                  キャンセル内容を確認
                </button>
              </div>
            `
            : ""
        }
      </section>
    `;
  }

  function getFilteredOrders() {
    const keyword = state.orderFilters.keyword.trim().toLowerCase();

    return state.orders.filter((order) => {
      const matchDate =
        !state.orderFilters.deliveryDate ||
        order.deliveryDate === state.orderFilters.deliveryDate;
      const matchDepartment =
        !state.orderFilters.department ||
        order.department === state.orderFilters.department;
      const matchStatus =
        !state.orderFilters.status || order.status === state.orderFilters.status;
      const searchable = [
        order.orderId,
        order.department,
        order.applicantName,
        order.menuName
      ]
        .join(" ")
        .toLowerCase();
      const matchKeyword = !keyword || searchable.includes(keyword);

      return matchDate && matchDepartment && matchStatus && matchKeyword;
    });
  }

  function renderOrdersTable() {
    const panel = document.getElementById("tab-panel");
    if (!panel) return;

    const rows = getFilteredOrders();
    const departmentOptions = [
      '<option value="">すべて</option>',
      ...state.departments.map((department) =>
        optionHtml(department, department, state.orderFilters.department)
      )
    ].join("");
    const dateOptions = [
      '<option value="">すべて</option>',
      ...state.deliveryDates.map((entry) =>
        optionHtml(entry.date, formatDate(entry.date), state.orderFilters.deliveryDate)
      )
    ].join("");
    const statusOptions = [
      '<option value="">すべて</option>',
      ...["ACTIVE", "CHANGED", "CANCELED", "REJECTED"].map((status) =>
        optionHtml(status, statusLabel(status), state.orderFilters.status)
      )
    ].join("");

    panel.innerHTML = `
      <section class="panel" aria-labelledby="orders-title">
        <div class="section-heading">
          <div>
            <p class="section-kicker">List</p>
            <h2 id="orders-title">注文一覧</h2>
          </div>
          <span class="count-badge">${rows.length}件</span>
        </div>

        <form class="filter-grid" aria-label="注文一覧の絞り込み">
          <div class="field">
            <label for="filter-delivery-date">受取日</label>
            <select id="filter-delivery-date" data-filter="deliveryDate">
              ${dateOptions}
            </select>
          </div>
          <div class="field">
            <label for="filter-department">担当部署</label>
            <select id="filter-department" data-filter="department">
              ${departmentOptions}
            </select>
          </div>
          <div class="field">
            <label for="filter-status">ステータス</label>
            <select id="filter-status" data-filter="status">
              ${statusOptions}
            </select>
          </div>
          <div class="field">
            <label for="filter-keyword">キーワード</label>
            <input
              id="filter-keyword"
              type="search"
              data-filter="keyword"
              value="${escapeHtml(state.orderFilters.keyword)}"
              placeholder="注文ID、部署、担当者、メニュー"
            >
          </div>
        </form>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>注文ID</th>
                <th>受付日時</th>
                <th>受取日</th>
                <th>担当部署</th>
                <th>注文担当者名</th>
                <th>メニュー</th>
                <th>個数</th>
                <th>ステータス</th>
                <th>変更前注文ID</th>
                <th>更新日時</th>
              </tr>
            </thead>
            <tbody>
              ${
                rows.length
                  ? rows
                      .map(
                        (order) => `
                  <tr>
                    <td><code>${escapeHtml(order.orderId)}</code></td>
                    <td>${escapeHtml(formatDateTime(order.acceptedAt))}</td>
                    <td>${escapeHtml(formatDate(order.deliveryDate))}</td>
                    <td>${escapeHtml(order.department)}</td>
                    <td>${escapeHtml(order.applicantName)}</td>
                    <td>${escapeHtml(order.menuName)}</td>
                    <td class="number-cell">${order.quantity}</td>
                    <td><span class="status status-${escapeHtml(order.status.toLowerCase())}">${escapeHtml(statusLabel(order.status))}</span></td>
                    <td>${order.previousOrderId ? `<code>${escapeHtml(order.previousOrderId)}</code>` : "-"}</td>
                    <td>${escapeHtml(formatDateTime(order.updatedAt))}</td>
                  </tr>
                `
                      )
                      .join("")
                  : '<tr><td colspan="10" class="empty-cell">該当する注文はありません。</td></tr>'
              }
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  function summaryRowsHtml(rows, includeDepartment) {
    if (!rows.length) {
      const colspan = includeDepartment ? 6 : 5;
      return `<tr><td colspan="${colspan}" class="empty-cell">集計対象の注文はありません。</td></tr>`;
    }

    return rows
      .map(
        (row) => `
          <tr>
            <td>${escapeHtml(formatDate(row.deliveryDate))}</td>
            ${includeDepartment ? `<td>${escapeHtml(row.department)}</td>` : ""}
            <td>${escapeHtml(row.menuName)}</td>
            <td class="number-cell">${formatYen(row.unitPrice)}</td>
            <td class="number-cell">${row.totalQuantity}</td>
            <td class="number-cell">${formatYen(row.totalAmount)}</td>
          </tr>
        `
      )
      .join("");
  }

  function renderSummaryDepartment() {
    return `
      <section class="summary-section" aria-labelledby="summary-department-title">
        <h3 id="summary-department-title">部署別・メニュー別集計</h3>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>受取日</th>
                <th>担当部署</th>
                <th>メニュー</th>
                <th>単価</th>
                <th>合計個数</th>
                <th>合計金額</th>
              </tr>
            </thead>
            <tbody>${summaryRowsHtml(state.summaries.byDepartment, true)}</tbody>
          </table>
        </div>
      </section>
    `;
  }

  function renderSummaryTotal() {
    return `
      <section class="summary-section" aria-labelledby="summary-total-title">
        <h3 id="summary-total-title">メニュー別総合集計</h3>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>受取日</th>
                <th>メニュー</th>
                <th>単価</th>
                <th>合計個数</th>
                <th>合計金額</th>
              </tr>
            </thead>
            <tbody>${summaryRowsHtml(state.summaries.byMenu, false)}</tbody>
          </table>
        </div>
      </section>
    `;
  }

  function renderSummaryPage() {
    const panel = document.getElementById("tab-panel");
    if (!panel) return;

    const activeCount = state.orders.filter((order) => order.status === "ACTIVE").length;
    panel.innerHTML = `
      <section class="panel" aria-labelledby="summary-title">
        <div class="section-heading">
          <div>
            <p class="section-kicker">Summary</p>
            <h2 id="summary-title">集計</h2>
          </div>
          <span class="count-badge">有効注文 ${activeCount}件</span>
        </div>
        ${renderSummaryDepartment()}
        ${renderSummaryTotal()}
      </section>
    `;
  }

  function modalItemsHtml(payload) {
    if (!payload.items || payload.items.length === 0) {
      return '<p class="modal-empty">注文内容はありません。</p>';
    }

    return `
      <div class="confirm-items">
        ${payload.items
          .map(
            (item) => `
              <div class="confirm-item">
                <div>
                  <strong>${escapeHtml(item.menuName)}</strong>
                  <span>${formatYen(item.unitPrice)} × ${item.quantity}</span>
                </div>
                <strong>${formatYen(item.subtotal)}</strong>
              </div>
            `
          )
          .join("")}
      </div>
    `;
  }

  function renderOrderConfirmModal() {
    const modalRoot = document.getElementById("modal-root");
    if (!modalRoot) return;

    if (!state.modal.isOpen || !state.modal.payload) {
      modalRoot.innerHTML = "";
      return;
    }

    const payload = state.modal.payload;
    const isOrder = state.modal.mode === "order";
    const isChange = state.modal.mode === "change";
    const isCancel = state.modal.mode === "cancel";
    const submitLabel = isOrder ? "送信する" : isChange ? "変更を送信する" : "キャンセルを送信する";
    const title = isOrder ? "注文内容の確認" : isChange ? "変更内容の確認" : "キャンセル内容の確認";

    modalRoot.innerHTML = `
      <div class="modal-backdrop" data-action="close-modal">
        <section
          class="modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-modal-title"
          tabindex="-1"
        >
          <div class="modal-header">
            <h2 id="confirm-modal-title">${escapeHtml(title)}</h2>
            <button type="button" class="icon-button" data-action="close-modal" aria-label="確認画面を閉じる">×</button>
          </div>

          <div class="confirm-grid">
            <div>
              <span>処理種別</span>
              <strong>${isOrder ? "注文" : isChange ? "変更" : "キャンセル"}</strong>
            </div>
            ${
              isOrder
                ? ""
                : `<div><span>注文ID</span><strong><code>${escapeHtml(payload.targetOrderId)}</code></strong></div>`
            }
            <div>
              <span>担当部署</span>
              <strong>${escapeHtml(payload.department)}</strong>
            </div>
            <div>
              <span>注文担当者名</span>
              <strong>${escapeHtml(payload.applicantName)}</strong>
            </div>
            <div>
              <span>メールアドレス</span>
              <strong>${escapeHtml(payload.email)}</strong>
            </div>
            ${
              isCancel
                ? ""
                : `<div><span>${isOrder ? "受取日" : "変更後受取日"}</span><strong>${escapeHtml(formatDate(isOrder ? payload.deliveryDate : payload.newDeliveryDate))}</strong></div>`
            }
          </div>

          ${
            isCancel
              ? ""
              : `
                <h3 class="modal-subtitle">注文内容</h3>
                ${modalItemsHtml(payload)}
                <div class="modal-total">
                  <div><span>合計個数</span><strong>${payload.totalQuantity}</strong></div>
                  <div><span>合計金額</span><strong>${formatYen(payload.totalAmount)}</strong></div>
                </div>
              `
          }

          <div class="note-preview">
            <span>備考</span>
            <p>${payload.note ? escapeHtml(payload.note) : "なし"}</p>
          </div>

          <div class="modal-actions">
            <button type="button" class="secondary-button" data-action="close-modal">戻って修正</button>
            <button type="button" class="${isCancel ? "danger-button" : "primary-button"}" data-action="confirm-submit">
              ${escapeHtml(submitLabel)}
            </button>
          </div>
        </section>
      </div>
    `;
  }

  function renderMessage() {
    const messageRegion = document.getElementById("message-region");
    if (!messageRegion) return;

    if (!state.message) {
      messageRegion.innerHTML = "";
      return;
    }

    messageRegion.innerHTML = `
      <div class="message message-${escapeHtml(state.message.type)}" role="status">
        ${escapeHtml(state.message.text)}
      </div>
    `;
  }

  function renderErrors() {
    const errorRegion = document.getElementById("error-region");
    if (!errorRegion) return;

    if (!state.errors.length) {
      errorRegion.innerHTML = "";
      return;
    }

    errorRegion.innerHTML = `
      <div class="message message-error" role="alert">
        <strong>入力内容を確認してください</strong>
        <ul>
          ${state.errors.map((error) => `<li>${escapeHtml(error)}</li>`).join("")}
        </ul>
      </div>
    `;
  }

  function renderApp() {
    renderTabs();
    renderMessage();
    renderErrors();

    if (state.currentTab === "order") {
      renderOrderForm();
    } else if (state.currentTab === "change") {
      renderChangeCancelForm();
    } else if (state.currentTab === "orders") {
      renderOrdersTable();
    } else if (state.currentTab === "summary") {
      renderSummaryPage();
    }

    renderOrderConfirmModal();
  }

  window.BentoRender = {
    renderApp,
    renderTabs,
    renderOrderForm,
    renderChangeCancelForm,
    renderOrdersTable,
    renderSummaryDepartment,
    renderSummaryTotal,
    renderOrderConfirmModal,
    renderMessage,
    renderErrors
  };
})();
