(function () {
  "use strict";

  var SCORE_DEFINITIONS = [
    { key: "basic", label: "基礎理解" },
    { key: "excel", label: "Excelスキル" },
    { key: "data", label: "データ活用" },
    { key: "tools", label: "ツール活用" },
    { key: "security", label: "セキュリティ" }
  ];

  var DEFAULT_LEVELS = ["初級", "中級", "上級"];
  var state = {
    records: [],
    filteredRecords: [],
    selectedId: "",
    chart: null
  };

  document.addEventListener("DOMContentLoaded", initialize);

  function initialize() {
    state.records = normalizeRecords(readSourceData());

    populateFilterOptions(state.records);
    bindEvents();
    refresh();
  }

  function readSourceData() {
    if (window.APP_DATA && Array.isArray(window.APP_DATA.dx_scores)) {
      return window.APP_DATA.dx_scores;
    }

    return [];
  }

  function normalizeRecords(source) {
    return source
      .map(function (item, index) {
        return normalizeRecord(item, index);
      })
      .filter(function (record) {
        return record !== null;
      });
  }

  function normalizeRecord(item, index) {
    if (!item || typeof item !== "object") {
      return null;
    }

    var safeScores = item.scores && typeof item.scores === "object" ? item.scores : {};
    var normalizedScores = {};

    SCORE_DEFINITIONS.forEach(function (definition) {
      normalizedScores[definition.key] = clampScore(safeScores[definition.key]);
    });

    var id = toText(item.id) || "record-" + (index + 1);
    var name = toText(item.name) || "氏名未設定";
    var department = toText(item.department) || "未所属";
    var level = toText(item.level) || "未設定";
    var comment = toText(item.comment) || "コメントはありません。";

    return {
      id: id,
      name: name,
      department: department,
      level: level,
      comment: comment,
      scores: normalizedScores,
      averageScore: calculateAverageScore(normalizedScores)
    };
  }

  function bindEvents() {
    getElement("departmentFilter").addEventListener("change", refresh);
    getElement("levelFilter").addEventListener("change", refresh);
    getElement("nameSearch").addEventListener("input", refresh);
  }

  function refresh() {
    var filters = getFilters();
    state.filteredRecords = filterRecords(state.records, filters);

    syncSelection();
    renderSummary(state.filteredRecords);
    renderList(state.filteredRecords);
    renderView(filters.department);
    renderEmptyStates();
  }

  function getFilters() {
    return {
      department: getElement("departmentFilter").value,
      level: getElement("levelFilter").value,
      search: getElement("nameSearch").value.trim().toLowerCase()
    };
  }

  function filterRecords(records, filters) {
    return records.filter(function (record) {
      var matchesDepartment = !filters.department || record.department === filters.department;
      var matchesLevel = !filters.level || record.level === filters.level;
      var matchesSearch = !filters.search || record.name.toLowerCase().indexOf(filters.search) !== -1;

      return matchesDepartment && matchesLevel && matchesSearch;
    });
  }

  function syncSelection() {
    if (!state.filteredRecords.length) {
      state.selectedId = "";
      return;
    }

    var exists = state.filteredRecords.some(function (record) {
      return record.id === state.selectedId;
    });

    if (!exists) {
      state.selectedId = state.filteredRecords[0].id;
    }
  }

  function renderSummary(records) {
    var levelCounts = {
      "初級": 0,
      "中級": 0,
      "上級": 0
    };

    records.forEach(function (record) {
      if (Object.prototype.hasOwnProperty.call(levelCounts, record.level)) {
        levelCounts[record.level] += 1;
      }
    });

    getElement("totalCount").textContent = String(records.length);
    getElement("averageScore").textContent = formatNumber(calculateAverageFromRecords(records));
    getElement("beginnerCount").textContent = String(levelCounts["初級"]);
    getElement("intermediateCount").textContent = String(levelCounts["中級"]);
    getElement("advancedCount").textContent = String(levelCounts["上級"]);
    getElement("listCount").textContent = records.length + "件";
  }

  function renderList(records) {
    var container = getElement("employeeList");
    container.innerHTML = "";

    records.forEach(function (record) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "employee-button" + (record.id === state.selectedId ? " active" : "");
      button.setAttribute("role", "listitem");
      button.addEventListener("click", function () {
        state.selectedId = record.id;
        renderList(state.filteredRecords);
        renderView(getFilters().department);
      });

      var name = document.createElement("p");
      name.className = "employee-name";
      name.textContent = record.name;

      var meta = document.createElement("p");
      meta.className = "employee-meta";
      meta.textContent = record.department + " / " + record.level;

      var score = document.createElement("p");
      score.className = "employee-score";
      score.textContent = "平均スコア " + formatNumber(record.averageScore);

      button.appendChild(name);
      button.appendChild(meta);
      button.appendChild(score);
      container.appendChild(button);
    });
  }

  function renderView(selectedDepartment) {
    var selectedRecord = getSelectedRecord();
    var departmentSummary = selectedDepartment ? calculateDepartmentAverage(selectedDepartment) : null;

    renderChart(selectedRecord, departmentSummary, selectedDepartment);
    renderDetails(selectedRecord, departmentSummary, selectedDepartment);
  }

  function renderChart(record, departmentSummary, selectedDepartment) {
    var fallback = getElement("chartFallback");
    var caption = getElement("chartCaption");

    if (!record) {
      destroyChart();
      fallback.classList.add("hidden");
      caption.textContent = "表示する職員がありません。";
      return;
    }

    if (typeof window.Chart !== "function") {
      destroyChart();
      fallback.classList.remove("hidden");
      caption.textContent = "チャートライブラリ未読み込み";
      return;
    }

    fallback.classList.add("hidden");

    var datasets = [
      {
        label: record.name,
        data: extractScoreValues(record.scores),
        borderColor: "#1f5b92",
        backgroundColor: "rgba(31, 91, 146, 0.18)",
        pointBackgroundColor: "#1f5b92",
        pointBorderColor: "#ffffff",
        pointRadius: 4,
        borderWidth: 2
      }
    ];

    if (departmentSummary) {
      datasets.push({
        label: selectedDepartment + " 平均",
        data: extractScoreValues(departmentSummary.scores),
        borderColor: "#d27c2c",
        backgroundColor: "rgba(210, 124, 44, 0.12)",
        pointBackgroundColor: "#d27c2c",
        pointBorderColor: "#ffffff",
        pointRadius: 3,
        borderWidth: 2
      });
    }

    caption.textContent = departmentSummary
      ? "個人スコアと部署平均を比較しています。"
      : "個人スコアを表示しています。";

    var ctx = getElement("skillChart");

    destroyChart();
    state.chart = new window.Chart(ctx, {
      type: "radar",
      data: {
        labels: SCORE_DEFINITIONS.map(function (definition) {
          return definition.label;
        }),
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        scales: {
          r: {
            min: 0,
            max: 5,
            ticks: {
              stepSize: 1,
              backdropColor: "transparent",
              color: "#64748b"
            },
            grid: {
              color: "rgba(100, 116, 139, 0.2)"
            },
            angleLines: {
              color: "rgba(100, 116, 139, 0.2)"
            },
            pointLabels: {
              color: "#1f2a37",
              font: {
                size: 12
              }
            }
          }
        },
        plugins: {
          legend: {
            position: "top"
          },
          tooltip: {
            callbacks: {
              label: function (context) {
                return context.dataset.label + ": " + formatNumber(context.raw);
              }
            }
          }
        }
      }
    });
  }

  function renderDetails(record, departmentSummary, selectedDepartment) {
    var detail = getElement("detailContent");
    detail.innerHTML = "";

    if (!record) {
      detail.innerHTML = '<p class="empty-inline">職員を選択すると詳細を表示します。</p>';
      return;
    }

    var wrapper = document.createElement("div");

    var head = document.createElement("div");
    head.className = "detail-head";

    var textBlock = document.createElement("div");
    var name = document.createElement("h3");
    name.className = "detail-name";
    name.textContent = record.name;

    var sub = document.createElement("p");
    sub.className = "detail-sub";
    sub.textContent = "所属: " + record.department + " / ID: " + record.id;

    textBlock.appendChild(name);
    textBlock.appendChild(sub);

    var badge = document.createElement("span");
    badge.className = "level-badge";
    badge.textContent = record.level;

    head.appendChild(textBlock);
    head.appendChild(badge);

    var scoreGrid = document.createElement("dl");
    scoreGrid.className = "score-grid";

    SCORE_DEFINITIONS.forEach(function (definition) {
      var scoreCard = document.createElement("div");
      scoreCard.className = "score-card";

      var dt = document.createElement("dt");
      dt.textContent = definition.label;

      var dd = document.createElement("dd");
      dd.textContent = formatNumber(record.scores[definition.key]);

      scoreCard.appendChild(dt);
      scoreCard.appendChild(dd);
      scoreGrid.appendChild(scoreCard);
    });

    wrapper.appendChild(head);
    wrapper.appendChild(scoreGrid);

    if (departmentSummary && selectedDepartment) {
      var departmentBlock = document.createElement("section");
      departmentBlock.className = "department-average";

      var departmentTitle = document.createElement("h3");
      departmentTitle.textContent = selectedDepartment + " の部署平均";

      var departmentText = document.createElement("p");
      departmentText.textContent =
        "対象 " + departmentSummary.count + " 名 / 平均スコア " + formatNumber(departmentSummary.averageScore);

      departmentBlock.appendChild(departmentTitle);
      departmentBlock.appendChild(departmentText);
      wrapper.appendChild(departmentBlock);
    }

    var commentBlock = document.createElement("section");
    commentBlock.className = "comment-block";

    var commentTitle = document.createElement("h3");
    commentTitle.textContent = "コメント";

    var commentText = document.createElement("p");
    commentText.textContent = record.comment;

    commentBlock.appendChild(commentTitle);
    commentBlock.appendChild(commentText);
    wrapper.appendChild(commentBlock);

    detail.appendChild(wrapper);
  }

  function renderEmptyStates() {
    var hasSourceData = state.records.length > 0;
    var hasFilteredData = state.filteredRecords.length > 0;

    getElement("globalEmptyState").classList.toggle("hidden", hasSourceData);
    getElement("contentArea").classList.toggle("hidden", !hasSourceData);
    getElement("listEmptyState").classList.toggle("hidden", hasFilteredData);
  }

  function populateFilterOptions(records) {
    var departmentSelect = getElement("departmentFilter");
    var levelSelect = getElement("levelFilter");

    appendOptions(departmentSelect, uniqueValues(records, "department"), "すべての部署");

    var levels = DEFAULT_LEVELS.slice();
    uniqueValues(records, "level").forEach(function (level) {
      if (levels.indexOf(level) === -1) {
        levels.push(level);
      }
    });
    appendOptions(levelSelect, levels, "すべてのレベル");
  }

  function appendOptions(select, values, defaultLabel) {
    select.innerHTML = "";

    var defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = defaultLabel;
    select.appendChild(defaultOption);

    values.forEach(function (value) {
      var option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    });
  }

  function uniqueValues(records, key) {
    var map = {};

    records.forEach(function (record) {
      map[record[key]] = true;
    });

    return Object.keys(map).sort(function (a, b) {
      return a.localeCompare(b, "ja");
    });
  }

  function calculateDepartmentAverage(department) {
    var departmentRecords = state.records.filter(function (record) {
      return record.department === department;
    });

    if (!departmentRecords.length) {
      return null;
    }

    var summaryScores = {};
    SCORE_DEFINITIONS.forEach(function (definition) {
      var total = departmentRecords.reduce(function (sum, record) {
        return sum + record.scores[definition.key];
      }, 0);

      summaryScores[definition.key] = total / departmentRecords.length;
    });

    return {
      count: departmentRecords.length,
      scores: summaryScores,
      averageScore: calculateAverageScore(summaryScores)
    };
  }

  function getSelectedRecord() {
    for (var i = 0; i < state.filteredRecords.length; i += 1) {
      if (state.filteredRecords[i].id === state.selectedId) {
        return state.filteredRecords[i];
      }
    }

    return null;
  }

  function calculateAverageFromRecords(records) {
    if (!records.length) {
      return 0;
    }

    var total = records.reduce(function (sum, record) {
      return sum + record.averageScore;
    }, 0);

    return total / records.length;
  }

  function calculateAverageScore(scores) {
    var total = SCORE_DEFINITIONS.reduce(function (sum, definition) {
      return sum + clampScore(scores[definition.key]);
    }, 0);

    return total / SCORE_DEFINITIONS.length;
  }

  function extractScoreValues(scores) {
    return SCORE_DEFINITIONS.map(function (definition) {
      return clampScore(scores[definition.key]);
    });
  }

  function clampScore(value) {
    var numeric = Number(value);

    if (!isFinite(numeric)) {
      return 0;
    }

    if (numeric < 0) {
      return 0;
    }

    if (numeric > 5) {
      return 5;
    }

    return Math.round(numeric * 10) / 10;
  }

  function formatNumber(value) {
    return clampScore(value).toFixed(1);
  }

  function toText(value) {
    return value === null || value === undefined ? "" : String(value).trim();
  }

  function destroyChart() {
    if (state.chart && typeof state.chart.destroy === "function") {
      state.chart.destroy();
    }

    state.chart = null;
  }

  function getElement(id) {
    return document.getElementById(id);
  }
})();
