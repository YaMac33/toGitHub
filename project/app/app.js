(function () {
  "use strict";

  var state = {
    keyword: "",
    viewMode: "table",   // table | member | session
    sortMode: "desc"     // UI上は残すが、主要ソートは仕様固定
  };

  var expandedMap = {};

  var els = {
    keywordInput: document.getElementById("keywordInput"),
    searchBtn: document.getElementById("searchBtn"),
    clearBtn: document.getElementById("clearBtn"),
    viewTableBtn: document.getElementById("viewTableBtn"),
    viewMemberBtn: document.getElementById("viewMemberBtn"),
    viewSessionBtn: document.getElementById("viewSessionBtn"),
    sortSelect: document.getElementById("sortSelect"),
    summaryKeyword: document.getElementById("summaryKeyword"),
    summaryCount: document.getElementById("summaryCount"),
    summaryView: document.getElementById("summaryView"),
    resultsArea: document.getElementById("resultsArea")
  };

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeText(value) {
    if (value === null || value === undefined) {
      return "";
    }

    return String(value)
      .replace(/\r\n/g, " ")
      .replace(/\n/g, " ")
      .replace(/\r/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function truncateText(value, limit) {
    var text = normalizeText(value);
    if (text.length <= limit) {
      return text;
    }
    return text.slice(0, limit) + "…";
  }

  function toNumber(value) {
    var v = normalizeText(value);
    if (v === "" || v === "-") {
      return 0;
    }
    var n = parseInt(v, 10);
    return isNaN(n) ? 0 : n;
  }

  function getRecordId(record, index) {
    var base = normalizeText(record.id);
    if (base) {
      return base;
    }
    return "row-" + index;
  }

  function getViewLabel(viewMode) {
    if (viewMode === "member") {
      return "人ごとカード";
    }
    if (viewMode === "session") {
      return "回ごとカード";
    }
    return "一覧表";
  }

  function getMemberDisplayName(memberName, groupName) {
    var member = normalizeText(memberName);
    var group = normalizeText(groupName);

    if (!group) {
      return member;
    }
    return member + "（" + group + "）";
  }

  function getEraPriority(numberValue) {
    var n = normalizeText(numberValue).toUpperCase();
    if (n === "R") {
      return 0;
    }
    if (n === "H") {
      return 1;
    }
    return 9;
  }

  function formatYearLabel(numberValue, yearValue) {
    var era = normalizeText(numberValue).toUpperCase();
    var year = normalizeText(yearValue);

    if (!year) {
      return "";
    }
    if (era === "R") {
      return "令和" + year + "年";
    }
    if (era === "H") {
      return "平成" + year + "年";
    }
    return year + "年";
  }

  function formatSessionLabel(sessionValue) {
    var n = toNumber(sessionValue);
    if (n <= 0) {
      return normalizeText(sessionValue);
    }
    return "第" + n + "回定例会";
  }

  function formatYearSessionLabel(numberValue, yearValue, sessionValue) {
    return formatYearLabel(numberValue, yearValue) + " / " + formatSessionLabel(sessionValue);
  }

  function buildTreeLabel(record) {
    var major = normalizeText(record.major_no);
    var middle = normalizeText(record.middle_no);
    var minor = normalizeText(record.minor_no);
    var parts = [];

    if (major && major !== "-") {
      parts.push(major);
    }
    if (middle && middle !== "-") {
      parts.push(middle);
    }
    if (minor && minor !== "-") {
      parts.push(minor);
    }

    return parts.join("-");
  }

  function getTreeDepth(record) {
    var middle = normalizeText(record.middle_no);
    var minor = normalizeText(record.minor_no);

    if (minor && minor !== "-") {
      return 2;
    }
    if (middle && middle !== "-") {
      return 1;
    }
    return 0;
  }

  function compareTreeRecords(a, b) {
    var aMajor = toNumber(a.major_no);
    var bMajor = toNumber(b.major_no);
    if (aMajor !== bMajor) {
      return aMajor - bMajor;
    }

    var aMiddle = toNumber(a.middle_no);
    var bMiddle = toNumber(b.middle_no);
    if (aMiddle !== bMiddle) {
      return aMiddle - bMiddle;
    }

    var aMinor = toNumber(a.minor_no);
    var bMinor = toNumber(b.minor_no);
    if (aMinor !== bMinor) {
      return aMinor - bMinor;
    }

    return 0;
  }

  // 一覧表の基本ソート
  // 1. 元号: R → H
  // 2. year: 降順
  // 3. session: 降順
  // 4. notice_no: 昇順
  // 5. member_name: 昇順
  // 6. tree: 昇順
  function compareRecords(a, b) {
    var eraDiff = getEraPriority(a.number) - getEraPriority(b.number);
    if (eraDiff !== 0) {
      return eraDiff;
    }

    var yearDiff = toNumber(b.year) - toNumber(a.year);
    if (yearDiff !== 0) {
      return yearDiff;
    }

    var sessionDiff = toNumber(b.session) - toNumber(a.session);
    if (sessionDiff !== 0) {
      return sessionDiff;
    }

    var noticeDiff = toNumber(a.notice_no) - toNumber(b.notice_no);
    if (noticeDiff !== 0) {
      return noticeDiff;
    }

    var memberA = normalizeText(a.member_name);
    var memberB = normalizeText(b.member_name);
    if (memberA < memberB) {
      return -1;
    }
    if (memberA > memberB) {
      return 1;
    }

    return compareTreeRecords(a, b);
  }

  function sortRecords(records) {
    var list = records.slice();
    list.sort(compareRecords);
    return list;
  }

  function matchesKeyword(record, keyword) {
    var q = normalizeText(keyword).toLowerCase();
    if (!q) {
      return true;
    }

    var fields = [
      record.fiscal_year,
      record.number,
      record.year,
      record.session,
      record.notice_no,
      record.member_name,
      record.group,
      record.content
    ];

    for (var i = 0; i < fields.length; i++) {
      var value = normalizeText(fields[i]).toLowerCase();
      if (value.indexOf(q) !== -1) {
        return true;
      }
    }

    return false;
  }

  function filterRecords(records, keyword) {
    var result = [];
    for (var i = 0; i < records.length; i++) {
      if (matchesKeyword(records[i], keyword)) {
        result.push(records[i]);
      }
    }
    return result;
  }

  // 人ごと:
  // member_name
  //   -> year+session（新しい順: R→H, year降順, session降順）
  //      -> notice_no（昇順）
  //         -> records(tree順)
  function groupByMemberThenYearSessionThenNotice(records) {
    var memberMap = {};
    var memberOrder = [];
    var i;

    for (i = 0; i < records.length; i++) {
      var record = records[i];
      var memberKey = normalizeText(record.member_name) || "不明";

      if (!memberMap[memberKey]) {
        memberMap[memberKey] = {
          key: memberKey,
          member_name: memberKey,
          group: normalizeText(record.group),
          yearSessions: [],
          yearSessionMap: {}
        };
        memberOrder.push(memberKey);
      }

      var memberGroup = memberMap[memberKey];
      var ysKey = [
        normalizeText(record.number),
        normalizeText(record.year),
        normalizeText(record.session)
      ].join("_");

      if (!memberGroup.yearSessionMap[ysKey]) {
        memberGroup.yearSessionMap[ysKey] = {
          key: ysKey,
          number: normalizeText(record.number),
          year: normalizeText(record.year),
          session: normalizeText(record.session),
          notices: [],
          noticeMap: {}
        };
        memberGroup.yearSessions.push(memberGroup.yearSessionMap[ysKey]);
      }

      var yearSessionGroup = memberGroup.yearSessionMap[ysKey];
      var noticeKey = normalizeText(record.notice_no) || "0";

      if (!yearSessionGroup.noticeMap[noticeKey]) {
        yearSessionGroup.noticeMap[noticeKey] = {
          key: noticeKey,
          notice_no: normalizeText(record.notice_no),
          records: []
        };
        yearSessionGroup.notices.push(yearSessionGroup.noticeMap[noticeKey]);
      }

      yearSessionGroup.noticeMap[noticeKey].records.push(record);
    }

    var members = [];
    for (i = 0; i < memberOrder.length; i++) {
      members.push(memberMap[memberOrder[i]]);
    }

    for (i = 0; i < members.length; i++) {
      var m = members[i];

      // year+session は新しい順
      m.yearSessions.sort(function (a, b) {
        var eraDiff = getEraPriority(a.number) - getEraPriority(b.number);
        if (eraDiff !== 0) {
          return eraDiff;
        }

        var yearDiff = toNumber(b.year) - toNumber(a.year);
        if (yearDiff !== 0) {
          return yearDiff;
        }

        return toNumber(b.session) - toNumber(a.session);
      });

      for (var j = 0; j < m.yearSessions.length; j++) {
        var ys = m.yearSessions[j];

        // 通告Noは昇順
        ys.notices.sort(function (a, b) {
          return toNumber(a.notice_no) - toNumber(b.notice_no);
        });

        for (var k = 0; k < ys.notices.length; k++) {
          ys.notices[k].records.sort(compareTreeRecords);
        }
      }
    }

    return members;
  }

  // 回ごと:
  // year+session（新しい順: R→H, year降順, session降順）
  //   -> notice_no（昇順）
  //      -> member_name（昇順）
  //         -> records(tree順)
  function groupByYearSessionThenNoticeThenMember(records) {
    var sessionMap = {};
    var sessionOrder = [];
    var i;

    for (i = 0; i < records.length; i++) {
      var record = records[i];
      var ysKey = [
        normalizeText(record.number),
        normalizeText(record.year),
        normalizeText(record.session)
      ].join("_");

      if (!sessionMap[ysKey]) {
        sessionMap[ysKey] = {
          key: ysKey,
          number: normalizeText(record.number),
          year: normalizeText(record.year),
          session: normalizeText(record.session),
          notices: [],
          noticeMap: {}
        };
        sessionOrder.push(ysKey);
      }

      var sessionGroup = sessionMap[ysKey];
      var noticeKey = normalizeText(record.notice_no) || "0";

      if (!sessionGroup.noticeMap[noticeKey]) {
        sessionGroup.noticeMap[noticeKey] = {
          key: noticeKey,
          notice_no: normalizeText(record.notice_no),
          members: [],
          memberMap: {}
        };
        sessionGroup.notices.push(sessionGroup.noticeMap[noticeKey]);
      }

      var noticeGroup = sessionGroup.noticeMap[noticeKey];
      var memberKey = normalizeText(record.member_name) || "不明";

      if (!noticeGroup.memberMap[memberKey]) {
        noticeGroup.memberMap[memberKey] = {
          key: memberKey,
          member_name: memberKey,
          group: normalizeText(record.group),
          records: []
        };
        noticeGroup.members.push(noticeGroup.memberMap[memberKey]);
      }

      noticeGroup.memberMap[memberKey].records.push(record);
    }

    var sessions = [];
    for (i = 0; i < sessionOrder.length; i++) {
      sessions.push(sessionMap[sessionOrder[i]]);
    }

    // 回は新しい順
    sessions.sort(function (a, b) {
      var eraDiff = getEraPriority(a.number) - getEraPriority(b.number);
      if (eraDiff !== 0) {
        return eraDiff;
      }

      var yearDiff = toNumber(b.year) - toNumber(a.year);
      if (yearDiff !== 0) {
        return yearDiff;
      }

      return toNumber(b.session) - toNumber(a.session);
    });

    for (i = 0; i < sessions.length; i++) {
      var s = sessions[i];

      // 通告Noは昇順
      s.notices.sort(function (a, b) {
        return toNumber(a.notice_no) - toNumber(b.notice_no);
      });

      for (var j = 0; j < s.notices.length; j++) {
        var n = s.notices[j];

        // 同じ通告Noの中では人名昇順
        n.members.sort(function (a, b) {
          var aName = normalizeText(a.member_name);
          var bName = normalizeText(b.member_name);
          if (aName < bName) {
            return -1;
          }
          if (aName > bName) {
            return 1;
          }
          return 0;
        });

        for (var k = 0; k < n.members.length; k++) {
          n.members[k].records.sort(compareTreeRecords);
        }
      }
    }

    return sessions;
  }

  function renderSummary(filteredRecords) {
    var keywordText = normalizeText(state.keyword);
    els.summaryKeyword.textContent = "検索語：" + (keywordText || "なし");
    els.summaryCount.textContent = "検索結果：" + filteredRecords.length + "件";
    els.summaryView.textContent = "表示形式：" + getViewLabel(state.viewMode);
  }

  function updateActiveButtons() {
    els.viewTableBtn.className = state.viewMode === "table" ? "active" : "";
    els.viewMemberBtn.className = state.viewMode === "member" ? "active" : "";
    els.viewSessionBtn.className = state.viewMode === "session" ? "active" : "";
  }

  function renderTable(records) {
    var html = "";

    html += '<div class="table-wrap">';
    html += '<table class="results-table">';
    html += "<thead><tr>";
    html += "<th>年度</th>";
    html += "<th>年</th>";
    html += "<th>回</th>";
    html += "<th>通告No</th>";
    html += "<th>議員名</th>";
    html += "<th>内容</th>";
    html += "</tr></thead>";
    html += "<tbody>";

    if (!records.length) {
      html += '<tr><td colspan="6">該当データがありません。</td></tr>';
    } else {
      for (var i = 0; i < records.length; i++) {
        var record = records[i];
        html += "<tr>";
        html += "<td>" + escapeHtml(record.fiscal_year || "") + "</td>";
        html += "<td>" + escapeHtml(formatYearLabel(record.number, record.year)) + "</td>";
        html += "<td>" + escapeHtml(formatSessionLabel(record.session)) + "</td>";
        html += "<td>" + escapeHtml(record.notice_no || "") + "</td>";
        html += "<td>" + escapeHtml(truncateText(record.member_name || "", 12)) + "</td>";
        html += "<td>" + escapeHtml(truncateText(record.content || "", 40)) + "</td>";
        html += "</tr>";
      }
    }

    html += "</tbody></table></div>";
    els.resultsArea.innerHTML = html;
  }

  function buildTreeRowHtml(record, limit, prefix, rowIndex) {
    var recordId = getRecordId(record, rowIndex);
    var expandKey = prefix + ":" + recordId;
    var fullText = normalizeText(record.content || "");
    var isLong = fullText.length > limit;
    var isExpanded = !!expandedMap[expandKey];
    var textToShow = isExpanded ? fullText : truncateText(fullText, limit);
    var treeLabel = buildTreeLabel(record);
    var depth = getTreeDepth(record);

    var html = "";
    html += '<div class="tree-row depth-' + depth + '">';
    html += '<div class="tree-label">' + escapeHtml(treeLabel) + "</div>";
    html += '<div class="tree-content-wrap">';
    html += '<div class="tree-content">' + escapeHtml(textToShow) + "</div>";

    if (isLong) {
      html += '<button class="more-btn" type="button" data-expand-key="' + escapeHtml(expandKey) + '">';
      html += isExpanded ? "閉じる" : "もっと見る";
      html += "</button>";
    }

    html += "</div>";
    html += "</div>";

    return html;
  }

  function renderMemberCards(memberGroups) {
    var html = "";

    if (!memberGroups.length) {
      els.resultsArea.innerHTML = '<p class="empty-message">該当データがありません。</p>';
      return;
    }

    html += '<div class="cards">';

    for (var i = 0; i < memberGroups.length; i++) {
      var memberGroup = memberGroups[i];
      var displayName = getMemberDisplayName(memberGroup.member_name, memberGroup.group);
      var totalCount = 0;

      for (var yc = 0; yc < memberGroup.yearSessions.length; yc++) {
        for (var nc = 0; nc < memberGroup.yearSessions[yc].notices.length; nc++) {
          totalCount += memberGroup.yearSessions[yc].notices[nc].records.length;
        }
      }

      html += '<section class="card">';
      html += '<div class="card-header">';
      html += '<h2 class="card-title">' + escapeHtml(truncateText(displayName, 30)) + "</h2>";
      html += '<div class="card-count">' + totalCount + "件</div>";
      html += "</div>";
      html += '<div class="card-body">';

      for (var j = 0; j < memberGroup.yearSessions.length; j++) {
        var ys = memberGroup.yearSessions[j];

        html += '<section class="subgroup-block">';
        html += '<div class="subgroup-title">■ ' + escapeHtml(formatYearSessionLabel(ys.number, ys.year, ys.session)) + "</div>";

        for (var k = 0; k < ys.notices.length; k++) {
          var notice = ys.notices[k];

          html += '<article class="notice-block">';
          html += '<div class="meta-line">通告No: ' + escapeHtml(notice.notice_no || "") + "</div>";
          html += '<div class="tree-block">';

          for (var r = 0; r < notice.records.length; r++) {
            html += buildTreeRowHtml(notice.records[r], 80, "member", r);
          }

          html += "</div>";
          html += "</article>";
        }

        html += "</section>";
      }

      html += "</div>";
      html += "</section>";
    }

    html += "</div>";
    els.resultsArea.innerHTML = html;
  }

  function renderSessionCards(sessionGroups) {
    var html = "";

    if (!sessionGroups.length) {
      els.resultsArea.innerHTML = '<p class="empty-message">該当データがありません。</p>';
      return;
    }

    html += '<div class="cards">';

    for (var i = 0; i < sessionGroups.length; i++) {
      var sessionGroup = sessionGroups[i];
      var totalCount = 0;

      for (var nc = 0; nc < sessionGroup.notices.length; nc++) {
        for (var mc = 0; mc < sessionGroup.notices[nc].members.length; mc++) {
          totalCount += sessionGroup.notices[nc].members[mc].records.length;
        }
      }

      html += '<section class="card">';
      html += '<div class="card-header">';
      html += '<h2 class="card-title">' + escapeHtml(formatYearSessionLabel(sessionGroup.number, sessionGroup.year, sessionGroup.session)) + "</h2>";
      html += '<div class="card-count">' + totalCount + "件</div>";
      html += "</div>";
      html += '<div class="card-body">';

      for (var j = 0; j < sessionGroup.notices.length; j++) {
        var notice = sessionGroup.notices[j];

        html += '<section class="subgroup-block">';
        html += '<div class="subgroup-title">通告No: ' + escapeHtml(notice.notice_no || "") + "</div>";

        for (var k = 0; k < notice.members.length; k++) {
          var member = notice.members[k];
          var displayName = getMemberDisplayName(member.member_name, member.group);

          html += '<article class="notice-block">';
          html += '<div class="meta-line">' + escapeHtml(displayName) + "</div>";
          html += '<div class="tree-block">';

          for (var r = 0; r < member.records.length; r++) {
            html += buildTreeRowHtml(member.records[r], 70, "session", r);
          }

          html += "</div>";
          html += "</article>";
        }

        html += "</section>";
      }

      html += "</div>";
      html += "</section>";
    }

    html += "</div>";
    els.resultsArea.innerHTML = html;
  }

  function render() {
    if (typeof RECORDS === "undefined" || !RECORDS || !RECORDS.length) {
      els.resultsArea.innerHTML = '<p class="empty-message">データが読み込めていません。</p>';
      els.summaryKeyword.textContent = "検索語：なし";
      els.summaryCount.textContent = "検索結果：0件";
      els.summaryView.textContent = "表示形式：" + getViewLabel(state.viewMode);
      updateActiveButtons();
      return;
    }

    var filteredRecords = filterRecords(RECORDS, state.keyword);
    var sortedRecords = sortRecords(filteredRecords);

    renderSummary(sortedRecords);
    updateActiveButtons();

    if (state.viewMode === "member") {
      renderMemberCards(groupByMemberThenYearSessionThenNotice(sortedRecords));
      return;
    }

    if (state.viewMode === "session") {
      renderSessionCards(groupByYearSessionThenNoticeThenMember(sortedRecords));
      return;
    }

    renderTable(sortedRecords);
  }

  function handleSearch() {
    state.keyword = els.keywordInput.value || "";
    render();
  }

  function handleClear() {
    state.keyword = "";
    els.keywordInput.value = "";
    expandedMap = {};
    render();
  }

  function handleToggleMore(event) {
    var target = event.target;
    if (!target || !target.getAttribute("data-expand-key")) {
      return;
    }

    var key = target.getAttribute("data-expand-key");
    expandedMap[key] = !expandedMap[key];
    render();
  }

  function bindEvents() {
    els.searchBtn.onclick = handleSearch;
    els.clearBtn.onclick = handleClear;

    els.keywordInput.onkeydown = function (event) {
      if (event.key === "Enter") {
        handleSearch();
      }
    };

    els.viewTableBtn.onclick = function () {
      state.viewMode = "table";
      render();
    };

    els.viewMemberBtn.onclick = function () {
      state.viewMode = "member";
      render();
    };

    els.viewSessionBtn.onclick = function () {
      state.viewMode = "session";
      render();
    };

    els.sortSelect.onchange = function () {
      state.sortMode = els.sortSelect.value;
      render();
    };

    els.resultsArea.onclick = handleToggleMore;
  }

  bindEvents();
  render();
})();
