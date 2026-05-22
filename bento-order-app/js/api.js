(function () {
  "use strict";

  const { state } = window.BentoState;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function mockDelay(result) {
    return new Promise((resolve) => {
      window.setTimeout(() => resolve(clone(result)), 220);
    });
  }

  function nowLocalString() {
    const date = new Date();
    const pad = (value) => String(value).padStart(2, "0");
    return [
      date.getFullYear(),
      pad(date.getMonth() + 1),
      pad(date.getDate())
    ].join("-") + " " + [pad(date.getHours()), pad(date.getMinutes())].join(":");
  }

  function randomCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let index = 0; index < 4; index += 1) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  function generateMockOrderId(deliveryDate) {
    // 本番ではGAS側で注文IDを発行する想定です。これはフロント側モック専用です。
    const ymd = String(deliveryDate || "").replaceAll("-", "");
    return `ORDER-${ymd}-${randomCode()}`;
  }

  function createInitialOrders() {
    return [
      {
        orderId: "ORDER-20260525-A1B2",
        acceptedAt: "2026-05-22 09:00",
        deliveryDate: "2026-05-25",
        department: "総務課",
        applicantName: "田中",
        menuId: "B001",
        menuName: "鮭弁当",
        unitPrice: 750,
        quantity: 3,
        subtotal: 2250,
        status: "ACTIVE",
        previousOrderId: "",
        updatedAt: "2026-05-22 09:00"
      },
      {
        orderId: "ORDER-20260525-C3D4",
        acceptedAt: "2026-05-22 09:05",
        deliveryDate: "2026-05-25",
        department: "総務課",
        applicantName: "田中",
        menuId: "B002",
        menuName: "のり弁当",
        unitPrice: 650,
        quantity: 2,
        subtotal: 1300,
        status: "ACTIVE",
        previousOrderId: "",
        updatedAt: "2026-05-22 09:05"
      },
      {
        orderId: "ORDER-20260525-E5F6",
        acceptedAt: "2026-05-22 09:10",
        deliveryDate: "2026-05-25",
        department: "議事課",
        applicantName: "佐藤",
        menuId: "B004",
        menuName: "カレー",
        unitPrice: 650,
        quantity: 1,
        subtotal: 650,
        status: "CANCELED",
        previousOrderId: "",
        updatedAt: "2026-05-22 10:15"
      }
    ];
  }

  function buildSummaries(orders) {
    const activeOrders = orders.filter((order) => order.status === "ACTIVE");
    const departmentMap = new Map();
    const menuMap = new Map();

    activeOrders.forEach((order) => {
      const departmentKey = [
        order.deliveryDate,
        order.department,
        order.menuId
      ].join("|");
      const menuKey = [order.deliveryDate, order.menuId].join("|");

      if (!departmentMap.has(departmentKey)) {
        departmentMap.set(departmentKey, {
          deliveryDate: order.deliveryDate,
          department: order.department,
          menuId: order.menuId,
          menuName: order.menuName,
          unitPrice: order.unitPrice,
          totalQuantity: 0,
          totalAmount: 0
        });
      }

      if (!menuMap.has(menuKey)) {
        menuMap.set(menuKey, {
          deliveryDate: order.deliveryDate,
          menuId: order.menuId,
          menuName: order.menuName,
          unitPrice: order.unitPrice,
          totalQuantity: 0,
          totalAmount: 0
        });
      }

      const departmentSummary = departmentMap.get(departmentKey);
      departmentSummary.totalQuantity += order.quantity;
      departmentSummary.totalAmount += order.subtotal;

      const menuSummary = menuMap.get(menuKey);
      menuSummary.totalQuantity += order.quantity;
      menuSummary.totalAmount += order.subtotal;
    });

    const byDepartment = [...departmentMap.values()].sort((a, b) =>
      `${a.deliveryDate}${a.department}${a.menuId}`.localeCompare(
        `${b.deliveryDate}${b.department}${b.menuId}`,
        "ja"
      )
    );

    const byMenu = [...menuMap.values()].sort((a, b) =>
      `${a.deliveryDate}${a.menuId}`.localeCompare(`${b.deliveryDate}${b.menuId}`, "ja")
    );

    return { byDepartment, byMenu };
  }

  function refreshSummaries() {
    state.summaries = buildSummaries(state.orders);
  }

  function fetchInitialData() {
    if (state.orders.length === 0) {
      state.orders = createInitialOrders();
      refreshSummaries();
    }

    return mockDelay({
      menus: state.menus,
      deliveryDates: state.deliveryDates,
      departments: state.departments,
      orders: state.orders,
      summaries: state.summaries
    });
  }

  function submitOrder(orderPayload) {
    const acceptedAt = nowLocalString();
    const createdOrders = orderPayload.items.map((item) => {
      const orderId = generateMockOrderId(orderPayload.deliveryDate);
      return {
        orderId,
        acceptedAt,
        deliveryDate: orderPayload.deliveryDate,
        department: orderPayload.department,
        applicantName: orderPayload.applicantName,
        menuId: item.menuId,
        menuName: item.menuName,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        subtotal: item.subtotal,
        status: "ACTIVE",
        previousOrderId: "",
        updatedAt: acceptedAt
      };
    });

    state.orders = [...createdOrders, ...state.orders];
    refreshSummaries();

    return mockDelay({
      ok: true,
      orderIds: createdOrders.map((order) => order.orderId),
      totalAmount: orderPayload.totalAmount,
      acceptedAt
    });
  }

  function submitChange(changePayload) {
    const updatedAt = nowLocalString();
    state.orders = state.orders.map((order) => {
      if (order.orderId === changePayload.targetOrderId && order.status === "ACTIVE") {
        return { ...order, status: "CHANGED", updatedAt };
      }
      return order;
    });

    const createdOrders = changePayload.items.map((item) => {
      const orderId = generateMockOrderId(changePayload.newDeliveryDate);
      return {
        orderId,
        acceptedAt: updatedAt,
        deliveryDate: changePayload.newDeliveryDate,
        department: changePayload.department,
        applicantName: changePayload.applicantName,
        menuId: item.menuId,
        menuName: item.menuName,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        subtotal: item.subtotal,
        status: "ACTIVE",
        previousOrderId: changePayload.targetOrderId,
        updatedAt
      };
    });

    state.orders = [...createdOrders, ...state.orders];
    refreshSummaries();

    return mockDelay({
      ok: true,
      orderIds: createdOrders.map((order) => order.orderId),
      totalAmount: changePayload.totalAmount,
      acceptedAt: updatedAt
    });
  }

  function submitCancel(cancelPayload) {
    const updatedAt = nowLocalString();
    let changed = false;

    state.orders = state.orders.map((order) => {
      if (order.orderId === cancelPayload.targetOrderId && order.status === "ACTIVE") {
        changed = true;
        return { ...order, status: "CANCELED", updatedAt };
      }
      return order;
    });

    refreshSummaries();

    return mockDelay({
      ok: true,
      canceledOrderId: cancelPayload.targetOrderId,
      changed,
      acceptedAt: updatedAt
    });
  }

  function fetchOrders() {
    return mockDelay(state.orders);
  }

  function fetchSummaries() {
    refreshSummaries();
    return mockDelay(state.summaries);
  }

  window.BentoApi = {
    fetchInitialData,
    submitOrder,
    submitChange,
    submitCancel,
    fetchOrders,
    fetchSummaries
  };
})();
