(() => {
  "use strict";

  const STORAGE_KEY = "windowDutyAppState";
  const SLOTS = ["A", "B", "C", "D"];
  const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];
  const MAX_ATTEMPTS = 1000;

  const elements = {};

  const state = {
    staff: [],
    vacations: [],
    holidays: [],
    selectedYear: new Date().getFullYear(),
    selectedMonth: new Date().getMonth() + 1,
    schedule: []
  };

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    bindElements();
    loadState();
    bindEvents();
    syncInputs();
    renderAll();
  }

  function bindElements() {
    elements.yearInput = document.getElementById("yearInput");
    elements.monthSelect = document.getElementById("monthSelect");
    elements.generateBtn = document.getElementById("generateBtn");
    elements.regenerateBtn = document.getElementById("regenerateBtn");
    elements.csvBtn = document.getElementById("csvBtn");
    elements.messageArea = document.getElementById("messageArea");
    elements.scheduleTableBody = document.getElementById("scheduleTableBody");
    elements.scheduleLabel = document.getElementById("scheduleLabel");

    elements.vacationStaffSelect = document.getElementById("vacationStaffSelect");
    elements.vacationDateInput = document.getElementById("vacationDateInput");
    elements.addVacationBtn = document.getElementById("addVacationBtn");
    elements.vacationTableBody = document.getElementById("vacationTableBody");

    elements.holidayDateInput = document.getElementById("holidayDateInput");
    elements.holidayNameInput = document.getElementById("holidayNameInput");
    elements.addHolidayBtn = document.getElementById("addHolidayBtn");
    elements.holidayTableBody = document.getElementById("holidayTableBody");

    elements.staffNameInput = document.getElementById("staffNameInput");
    elements.staffTypeSelect = document.getElementById("staffTypeSelect");
    elements.addStaffBtn = document.getElementById("addStaffBtn");
    elements.sampleBtn = document.getElementById("sampleBtn");
    elements.staffTableBody = document.getElementById("staffTableBody");
    elements.staffCount = document.getElementById("staffCount");
  }

  function bindEvents() {
    elements.yearInput.addEventListener("change", handleMonthChange);
    elements.monthSelect.addEventListener("change", handleMonthChange);
    elements.generateBtn.addEventListener("click", handleGenerate);
    elements.regenerateBtn.addEventListener("click", handleGenerate);
    elements.csvBtn.addEventListener("click", exportCsv);
    elements.addVacationBtn.addEventListener("click", addVacation);
    elements.addHolidayBtn.addEventListener("click", addHoliday);
    elements.addStaffBtn.addEventListener("click", addStaff);
    elements.sampleBtn.addEventListener("click", loadSampleStaff);
  }

  function loadState() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    try {
      const saved = JSON.parse(raw);
      state.staff = Array.isArray(saved.staff) ? saved.staff : [];
      state.vacations = Array.isArray(saved.vacations) ? saved.vacations : [];
      state.holidays = Array.isArray(saved.holidays) ? saved.holidays : [];
      state.selectedYear = Number(saved.selectedYear) || state.selectedYear;
      state.selectedMonth = Number(saved.selectedMonth) || state.selectedMonth;
      state.schedule = Array.isArray(saved.schedule) ? saved.schedule : [];
    } catch {
      showMessage("保存データを読み込めませんでした。新しい状態で開始します。", "error");
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function syncInputs() {
    elements.yearInput.value = state.selectedYear;
    elements.monthSelect.value = String(state.selectedMonth);
    setDefaultDates();
  }

  function setDefaultDates() {
    const date = formatDate(state.selectedYear, state.selectedMonth, 1);
    elements.vacationDateInput.value = date;
    elements.holidayDateInput.value = date;
  }

  function renderAll() {
    renderStaff();
    renderVacationStaffOptions();
    renderVacations();
    renderHolidays();
    renderSchedule();
  }

  function handleMonthChange() {
    const year = Number(elements.yearInput.value);
    const month = Number(elements.monthSelect.value);

    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      showMessage("年は2000年から2100年の範囲で入力してください。", "error");
      syncInputs();
      return false;
    }

    state.selectedYear = year;
    state.selectedMonth = month;
    setDefaultDates();
    saveState();
    return true;
  }

  function addStaff() {
    const name = elements.staffNameInput.value.trim();
    const type = elements.staffTypeSelect.value;

    if (!name) {
      showMessage("職員の氏名を入力してください。", "error");
      return;
    }

    state.staff.push({
      staff_id: createId("staff"),
      name,
      type,
      active: true
    });
    state.schedule = [];
    elements.staffNameInput.value = "";

    saveState();
    renderAll();
    showMessage("職員を追加しました。当番表は必要に応じて再作成してください。", "success");
  }

  function loadSampleStaff() {
    const regular = Array.from({ length: 5 }, (_, index) => ({
      staff_id: `regular-${index + 1}`,
      name: `正規${index + 1}`,
      type: "regular",
      active: true
    }));

    const parttime = Array.from({ length: 15 }, (_, index) => ({
      staff_id: `parttime-${index + 1}`,
      name: `非正規${index + 1}`,
      type: "parttime",
      active: true
    }));

    state.staff = [...regular, ...parttime];
    state.vacations = state.vacations.filter((vacation) =>
      state.staff.some((staff) => staff.staff_id === vacation.staff_id)
    );
    state.schedule = [];

    saveState();
    renderAll();
    showMessage("サンプル職員20人を読み込みました。氏名は職員一覧から変更できます。", "success");
  }

  function renderStaff() {
    elements.staffCount.textContent = `${state.staff.length}人`;

    if (state.staff.length === 0) {
      elements.staffTableBody.innerHTML = `<tr><td colspan="5" class="empty-cell">職員データがありません。</td></tr>`;
      return;
    }

    elements.staffTableBody.innerHTML = "";
    state.staff.forEach((staff) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${escapeHtml(staff.staff_id)}</td>
        <td><input class="inline-input" type="text" value="${escapeHtml(staff.name)}" aria-label="氏名"></td>
        <td>
          <select class="inline-select" aria-label="区分">
            <option value="regular" ${staff.type === "regular" ? "selected" : ""}>正規</option>
            <option value="parttime" ${staff.type === "parttime" ? "selected" : ""}>非正規</option>
          </select>
        </td>
        <td>
          <label class="switch-label">
            <input type="checkbox" ${staff.active ? "checked" : ""}>
            <span>${staff.active ? "ON" : "OFF"}</span>
          </label>
        </td>
        <td><button type="button" class="danger">削除</button></td>
      `;

      const nameInput = row.querySelector(".inline-input");
      const typeSelect = row.querySelector(".inline-select");
      const activeInput = row.querySelector(".switch-label input");
      const deleteButton = row.querySelector(".danger");

      nameInput.addEventListener("change", () => {
        const name = nameInput.value.trim();
        if (!name) {
          nameInput.value = staff.name;
          showMessage("氏名は空にできません。", "error");
          return;
        }
        staff.name = name;
        clearScheduleAfterConditionChange("職員名を更新しました。");
      });

      typeSelect.addEventListener("change", () => {
        staff.type = typeSelect.value;
        clearScheduleAfterConditionChange("職員区分を更新しました。");
      });

      activeInput.addEventListener("change", () => {
        staff.active = activeInput.checked;
        clearScheduleAfterConditionChange("active設定を更新しました。");
      });

      deleteButton.addEventListener("click", () => {
        state.staff = state.staff.filter((item) => item.staff_id !== staff.staff_id);
        state.vacations = state.vacations.filter((item) => item.staff_id !== staff.staff_id);
        state.schedule = [];
        saveState();
        renderAll();
        showMessage("職員を削除しました。", "info");
      });

      elements.staffTableBody.appendChild(row);
    });
  }

  function clearScheduleAfterConditionChange(message) {
    state.schedule = [];
    saveState();
    renderAll();
    showMessage(`${message} 当番表は必要に応じて再作成してください。`, "info");
  }

  function renderVacationStaffOptions() {
    const current = elements.vacationStaffSelect.value;
    elements.vacationStaffSelect.innerHTML = "";

    if (state.staff.length === 0) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "職員データがありません";
      elements.vacationStaffSelect.appendChild(option);
      return;
    }

    state.staff.forEach((staff) => {
      const option = document.createElement("option");
      option.value = staff.staff_id;
      option.textContent = `${staff.name}（${typeLabel(staff.type)}）`;
      elements.vacationStaffSelect.appendChild(option);
    });

    if (state.staff.some((staff) => staff.staff_id === current)) {
      elements.vacationStaffSelect.value = current;
    }
  }

  function addVacation() {
    const staffId = elements.vacationStaffSelect.value;
    const date = elements.vacationDateInput.value;

    if (!staffId || !date) {
      showMessage("対象者と休暇日を選択してください。", "error");
      return;
    }

    if (!findStaff(staffId)) {
      showMessage("休暇を登録する職員が見つかりません。", "error");
      return;
    }

    const duplicated = state.vacations.some((vacation) =>
      vacation.staff_id === staffId && vacation.date === date
    );
    if (duplicated) {
      showMessage("同じ職員・同じ日付の休暇はすでに登録されています。", "error");
      return;
    }

    state.vacations.push({
      vacation_id: createId("vacation"),
      staff_id: staffId,
      date
    });
    state.schedule = [];

    saveState();
    renderVacations();
    renderSchedule();
    showMessage("休暇を追加しました。当番表は必要に応じて再作成してください。", "success");
  }

  function renderVacations() {
    if (state.vacations.length === 0) {
      elements.vacationTableBody.innerHTML = `<tr><td colspan="3" class="empty-cell">登録済み休暇はありません。</td></tr>`;
      return;
    }

    const sortedVacations = [...state.vacations].sort((a, b) => a.date.localeCompare(b.date));
    elements.vacationTableBody.innerHTML = "";

    sortedVacations.forEach((vacation) => {
      const staff = findStaff(vacation.staff_id);
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${escapeHtml(staff ? staff.name : "不明な職員")}</td>
        <td>${escapeHtml(vacation.date)}</td>
        <td><button type="button" class="danger">削除</button></td>
      `;

      row.querySelector("button").addEventListener("click", () => {
        state.vacations = state.vacations.filter((item) => item.vacation_id !== vacation.vacation_id);
        state.schedule = [];
        saveState();
        renderVacations();
        renderSchedule();
        showMessage("休暇を削除しました。当番表は必要に応じて再作成してください。", "info");
      });

      elements.vacationTableBody.appendChild(row);
    });
  }

  function addHoliday() {
    const date = elements.holidayDateInput.value;
    const name = elements.holidayNameInput.value.trim() || "祝日";

    if (!date) {
      showMessage("祝日の日付を選択してください。", "error");
      return;
    }

    const duplicated = state.holidays.some((holiday) => holiday.date === date);
    if (duplicated) {
      showMessage("同じ日付の祝日はすでに登録されています。", "error");
      return;
    }

    state.holidays.push({
      holiday_id: createId("holiday"),
      date,
      name
    });
    state.schedule = [];
    elements.holidayNameInput.value = "";

    saveState();
    renderHolidays();
    renderSchedule();
    showMessage("祝日を追加しました。当番表は必要に応じて再作成してください。", "success");
  }

  function renderHolidays() {
    if (state.holidays.length === 0) {
      elements.holidayTableBody.innerHTML = `<tr><td colspan="3" class="empty-cell">登録済み祝日はありません。</td></tr>`;
      return;
    }

    const sortedHolidays = [...state.holidays].sort((a, b) => a.date.localeCompare(b.date));
    elements.holidayTableBody.innerHTML = "";

    sortedHolidays.forEach((holiday) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${escapeHtml(holiday.date)}</td>
        <td>${escapeHtml(holiday.name)}</td>
        <td><button type="button" class="danger">削除</button></td>
      `;

      row.querySelector("button").addEventListener("click", () => {
        state.holidays = state.holidays.filter((item) => item.holiday_id !== holiday.holiday_id);
        state.schedule = [];
        saveState();
        renderHolidays();
        renderSchedule();
        showMessage("祝日を削除しました。当番表は必要に応じて再作成してください。", "info");
      });

      elements.holidayTableBody.appendChild(row);
    });
  }

  function handleGenerate() {
    if (!handleMonthChange()) return;

    const activeStaff = state.staff.filter((staff) => staff.active);
    if (activeStaff.length < SLOTS.length) {
      showMessage("activeな職員が4人以上必要です。", "error");
      return;
    }

    const dutyDates = getDutyDates(state.selectedYear, state.selectedMonth);
    if (dutyDates.length === 0) {
      state.schedule = [];
      saveState();
      renderSchedule();
      showMessage("対象月に割当対象日がありません。土日と祝日設定を確認してください。", "error");
      return;
    }

    const result = generateSchedule(dutyDates);
    if (!result) {
      state.schedule = [];
      saveState();
      renderSchedule();
      showMessage("条件が厳しすぎるため、当番表を作成できませんでした。休暇日、祝日、対象職員を見直してください。", "error");
      return;
    }

    state.schedule = result;
    saveState();
    renderSchedule();
    showMessage(`${state.selectedYear}年${state.selectedMonth}月の当番表を作成しました。`, "success");
  }

  function generateSchedule(dates) {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      const context = createAssignmentContext();
      const schedule = [];
      let failed = false;

      for (const dateInfo of dates) {
        const assignments = {};
        const assignedToday = new Set();

        for (const slot of SLOTS) {
          const candidates = getCandidates({
            dateInfo,
            slot,
            schedule,
            assignedToday,
            context
          });

          if (candidates.length === 0) {
            failed = true;
            break;
          }

          const selected = pickByLowestCount(candidates, context.counts);
          assignments[slot] = selected.staff_id;
          assignedToday.add(selected.staff_id);
          context.counts.set(selected.staff_id, (context.counts.get(selected.staff_id) || 0) + 1);
          addWeekdaySlotHistory(context, dateInfo, slot, selected.staff_id);
        }

        if (failed) break;

        schedule.push({
          date: dateInfo.date,
          weekday: dateInfo.weekday,
          weekdayIndex: dateInfo.weekdayIndex,
          assignments
        });
      }

      if (!failed && schedule.length === dates.length) {
        return schedule;
      }
    }

    return null;
  }

  function createAssignmentContext() {
    return {
      counts: new Map(state.staff.map((staff) => [staff.staff_id, 0])),
      weekdaySlotHistory: new Map()
    };
  }

  // 条件追加時は、この配列に「除外するときtrueを返す関数」を足す。
  function getAssignmentRules() {
    return [
      ({ staff }) => !staff.active,
      ({ staff, dateInfo }) => isOnVacation(staff.staff_id, dateInfo.date),
      ({ staff, assignedToday }) => assignedToday.has(staff.staff_id),
      ({ staff, slot, schedule }) => {
        const previousDutyDay = schedule[schedule.length - 1];
        return previousDutyDay ? previousDutyDay.assignments[slot] === staff.staff_id : false;
      },
      ({ staff, dateInfo, slot, context }) => {
        const usedInSameWeekdaySlot = getWeekdaySlotHistory(context, dateInfo, slot);
        return usedInSameWeekdaySlot.has(staff.staff_id);
      }
    ];
  }

  function getCandidates(ruleArgs) {
    const rules = getAssignmentRules();
    return state.staff.filter((staff) =>
      rules.every((rule) => !rule({ ...ruleArgs, staff }))
    );
  }

  function getWeekdaySlotHistory(context, dateInfo, slot) {
    const historyKey = `${dateInfo.weekdayIndex}-${slot}`;
    return context.weekdaySlotHistory.get(historyKey) || new Set();
  }

  function addWeekdaySlotHistory(context, dateInfo, slot, staffId) {
    const historyKey = `${dateInfo.weekdayIndex}-${slot}`;
    if (!context.weekdaySlotHistory.has(historyKey)) {
      context.weekdaySlotHistory.set(historyKey, new Set());
    }
    context.weekdaySlotHistory.get(historyKey).add(staffId);
  }

  function pickByLowestCount(candidates, counts) {
    const minCount = Math.min(...candidates.map((staff) => counts.get(staff.staff_id) || 0));
    const tied = candidates.filter((staff) => (counts.get(staff.staff_id) || 0) === minCount);
    return tied[Math.floor(Math.random() * tied.length)];
  }

  function isOnVacation(staffId, date) {
    return state.vacations.some((vacation) =>
      vacation.staff_id === staffId && vacation.date === date
    );
  }

  function isHoliday(date) {
    return state.holidays.some((holiday) => holiday.date === date);
  }

  function renderSchedule() {
    if (state.schedule.length === 0) {
      elements.scheduleLabel.textContent = "未作成";
      elements.scheduleTableBody.innerHTML = `<tr><td colspan="6" class="empty-cell">対象月を選択して当番表を作成してください。</td></tr>`;
      return;
    }

    elements.scheduleLabel.textContent = `${state.selectedYear}年${state.selectedMonth}月`;
    elements.scheduleTableBody.innerHTML = "";

    state.schedule.forEach((day) => {
      const row = document.createElement("tr");
      if (isHoliday(day.date)) row.classList.add("holiday-row");

      row.innerHTML = `
        <td>${escapeHtml(day.date)}</td>
        <td>${escapeHtml(day.weekday)}</td>
        ${SLOTS.map((slot) => `<td>${escapeHtml(staffName(day.assignments[slot]))}</td>`).join("")}
      `;
      elements.scheduleTableBody.appendChild(row);
    });
  }

  function exportCsv() {
    if (state.schedule.length === 0) {
      showMessage("CSV出力する当番表がありません。", "error");
      return;
    }

    const rows = [["date", "weekday", "A", "B", "C", "D"]];
    state.schedule.forEach((day) => {
      rows.push([
        day.date,
        day.weekday,
        staffName(day.assignments.A),
        staffName(day.assignments.B),
        staffName(day.assignments.C),
        staffName(day.assignments.D)
      ]);
    });

    const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\r\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `window-duty-${state.selectedYear}-${String(state.selectedMonth).padStart(2, "0")}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showMessage("CSVを出力しました。", "success");
  }

  function getDutyDates(year, month) {
    return getMonthDates(year, month).filter((dateInfo) =>
      dateInfo.weekdayIndex !== 0 &&
      dateInfo.weekdayIndex !== 6 &&
      !isHoliday(dateInfo.date)
    );
  }

  function getMonthDates(year, month) {
    const lastDay = new Date(year, month, 0).getDate();
    return Array.from({ length: lastDay }, (_, index) => {
      const day = index + 1;
      const dateObject = new Date(year, month - 1, day);
      const weekdayIndex = dateObject.getDay();
      return {
        date: formatDate(year, month, day),
        weekday: WEEKDAYS[weekdayIndex],
        weekdayIndex
      };
    });
  }

  function formatDate(year, month, day) {
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  function findStaff(staffId) {
    return state.staff.find((staff) => staff.staff_id === staffId);
  }

  function staffName(staffId) {
    const staff = findStaff(staffId);
    return staff ? staff.name : "";
  }

  function typeLabel(type) {
    return type === "regular" ? "正規" : "非正規";
  }

  function showMessage(text, type = "info") {
    elements.messageArea.innerHTML = "";
    if (!text) return;

    const message = document.createElement("div");
    message.className = `message ${type}`;
    message.textContent = text;
    elements.messageArea.appendChild(message);
  }

  function createId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeCsv(value) {
    const text = String(value ?? "");
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  }
})();
