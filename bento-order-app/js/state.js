(function () {
  "use strict";

  const departments = ["総務課", "企画課", "財政課", "議事課", "その他"];

  const deliveryDates = [
    { date: "2026-05-25", deadline: "2026-05-24T12:00:00" },
    { date: "2026-05-26", deadline: "2026-05-25T12:00:00" },
    { date: "2026-05-27", deadline: "2026-05-26T12:00:00" }
  ];

  const menus = [
    { id: "B001", name: "鮭弁当", price: 750 },
    { id: "B002", name: "のり弁当", price: 650 },
    { id: "B003", name: "唐揚げ弁当", price: 700 },
    { id: "B004", name: "カレー", price: 650 },
    { id: "B005", name: "ハンバーグ弁当", price: 800 },
    { id: "B006", name: "幕の内弁当", price: 850 }
  ];

  const emptyQuantities = () =>
    menus.reduce((result, menu) => {
      result[menu.id] = 0;
      return result;
    }, {});

  const initialOrderForm = () => ({
    department: "",
    customDepartment: "",
    applicantName: "",
    email: "",
    deliveryDate: "",
    quantities: emptyQuantities(),
    note: ""
  });

  const initialChangeForm = () => ({
    actionType: "change",
    targetOrderId: "",
    department: "",
    customDepartment: "",
    applicantName: "",
    email: "",
    newDeliveryDate: "",
    quantities: emptyQuantities(),
    note: ""
  });

  const state = {
    departments,
    deliveryDates,
    menus,
    orders: [],
    summaries: {
      byDepartment: [],
      byMenu: []
    },
    currentOrder: initialOrderForm(),
    currentChange: initialChangeForm(),
    currentTab: "order",
    orderFilters: {
      deliveryDate: "",
      department: "",
      status: "",
      keyword: ""
    },
    modal: {
      isOpen: false,
      mode: "",
      title: "",
      payload: null
    },
    message: null,
    errors: []
  };

  function resetOrderForm() {
    state.currentOrder = initialOrderForm();
  }

  function resetChangeForm() {
    state.currentChange = initialChangeForm();
  }

  function getMenuById(menuId) {
    return state.menus.find((menu) => menu.id === menuId);
  }

  function resolveDepartment(formState) {
    if (formState.department === "その他") {
      return formState.customDepartment.trim() || "その他";
    }
    return formState.department;
  }

  function buildItemsFromQuantities(quantities) {
    return state.menus
      .map((menu) => {
        const quantity = Number(quantities[menu.id]) || 0;
        return {
          menuId: menu.id,
          menuName: menu.name,
          unitPrice: menu.price,
          quantity,
          subtotal: menu.price * quantity
        };
      })
      .filter((item) => item.quantity > 0);
  }

  function calculateTotals(items) {
    return items.reduce(
      (result, item) => {
        result.totalQuantity += item.quantity;
        result.totalAmount += item.subtotal;
        return result;
      },
      { totalQuantity: 0, totalAmount: 0 }
    );
  }

  function getOrderDraft() {
    const items = buildItemsFromQuantities(state.currentOrder.quantities);
    const totals = calculateTotals(items);
    return {
      type: "order",
      department: resolveDepartment(state.currentOrder),
      applicantName: state.currentOrder.applicantName.trim(),
      email: state.currentOrder.email.trim(),
      deliveryDate: state.currentOrder.deliveryDate,
      items,
      totalQuantity: totals.totalQuantity,
      totalAmount: totals.totalAmount,
      note: state.currentOrder.note.trim()
    };
  }

  function getChangeDraft() {
    const items = buildItemsFromQuantities(state.currentChange.quantities);
    const totals = calculateTotals(items);
    return {
      type: "change",
      targetOrderId: state.currentChange.targetOrderId.trim(),
      department: resolveDepartment(state.currentChange),
      applicantName: state.currentChange.applicantName.trim(),
      email: state.currentChange.email.trim(),
      newDeliveryDate: state.currentChange.newDeliveryDate,
      items,
      totalQuantity: totals.totalQuantity,
      totalAmount: totals.totalAmount,
      note: state.currentChange.note.trim()
    };
  }

  function getCancelDraft() {
    return {
      type: "cancel",
      targetOrderId: state.currentChange.targetOrderId.trim(),
      department: resolveDepartment(state.currentChange),
      applicantName: state.currentChange.applicantName.trim(),
      email: state.currentChange.email.trim(),
      note: state.currentChange.note.trim()
    };
  }

  function setMessage(type, text) {
    state.message = { type, text };
  }

  function clearMessages() {
    state.message = null;
    state.errors = [];
  }

  window.BentoState = {
    state,
    resetOrderForm,
    resetChangeForm,
    getMenuById,
    resolveDepartment,
    buildItemsFromQuantities,
    calculateTotals,
    getOrderDraft,
    getChangeDraft,
    getCancelDraft,
    setMessage,
    clearMessages
  };
})();
