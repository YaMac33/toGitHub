(function () {
  "use strict";

  var state = {
    keyword: "",
    viewMode: "table"
  };

  var expandedMap = {};

  var els = {
    keywordInput: document.getElementById("keywordInput"),
    searchBtn: document.getElementById("searchBtn"),
    clearBtn: document.getElementById("clearBtn"),
    viewTableBtn: document.getElementById("viewTableBtn"),
    viewMemberBtn: document.getElementById("viewMemberBtn"),
    viewSessionBtn: document.getElementById("viewSessionBtn"),
    summaryKeyword: document.getElementById("summaryKeyword"),
    summaryCount: document.getElementById("summaryCount"),
    summaryView: document.getElementById("summaryView"),
    resultsArea: document.getElementById("resultsArea")
  };

  function escapeHtml(v) {
    return String(v || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeText(v) {
    return String(v || "").replace(/\s+/g, " ").trim();
  }

  function toNumber(v) {
    var n = parseInt(v, 10);
    return isNaN(n) ? 0 : n;
  }

  function getEraPriority(n) {
    n = normalizeText(n).toUpperCase();
    if (n === "R") return 0;
    if (n === "H") return 1;
    return 9;
  }

  function formatYear(number, year) {
    number = normalizeText(number).toUpperCase();
    year = normalizeText(year);
    if (number === "R") return "令和" + year + "年";
    if (number === "H") return "平成" + year + "年";
    return year + "年";
  }

  function formatSession(session) {
    return "第" + toNumber(session) + "回定例会";
  }

  function formatYS(r) {
    return formatYear(r.number, r.year) + " / " + formatSession(r.session);
  }

  function buildTreeLabel(r) {
    var a = normalizeText(r.major_no);
    var b = normalizeText(r.middle_no);
    var c = normalizeText(r.minor_no);
    var arr = [];
    if (a && a !== "-") arr.push(a);
    if (b && b !== "-") arr.push(b);
    if (c && c !== "-") arr.push(c);
    return arr.join("-");
  }

  function getDepth(r) {
    if (r.minor_no && r.minor_no !== "-") return 2;
    if (r.middle_no && r.middle_no !== "-") return 1;
    return 0;
  }

  function compareRecords(a, b) {
    var e = getEraPriority(a.number) - getEraPriority(b.number);
    if (e !== 0) return e;

    var y = toNumber(b.year) - toNumber(a.year);
    if (y !== 0) return y;

    var s = toNumber(b.session) - toNumber(a.session);
    if (s !== 0) return s;

    var n = toNumber(a.notice_no) - toNumber(b.notice_no);
    if (n !== 0) return n;

    return 0;
  }

  function filterRecords(records, keyword) {
    var q = normalizeText(keyword).toLowerCase();
    if (!q) return records.slice();

    return records.filter(function (r) {
      return (
        normalizeText(r.member_name).toLowerCase().includes(q) ||
        normalizeText(r.content).toLowerCase().includes(q)
      );
    });
  }

  function groupMember(records) {
    var map = {};

    records.forEach(function (r) {
      var m = r.member_name || "不明";
      if (!map[m]) {
        map[m] = { member: m, group: r.group, ys: {} };
      }

      var ysKey = r.number + "_" + r.year + "_" + r.session;
      if (!map[m].ys[ysKey]) {
        map[m].ys[ysKey] = {
          number: r.number,
          year: r.year,
          session: r.session,
          notices: {}
        };
      }

      var n = r.notice_no;
      if (!map[m].ys[ysKey].notices[n]) {
        map[m].ys[ysKey].notices[n] = [];
      }

      map[m].ys[ysKey].notices[n].push(r);
    });

    return Object.values(map);
  }

  function groupSession(records) {
    var map = {};

    records.forEach(function (r) {
      var key = r.number + "_" + r.year + "_" + r.session;
      if (!map[key]) {
        map[key] = {
          number: r.number,
          year: r.year,
          session: r.session,
          notices: {}
        };
      }

      var n = r.notice_no;
      if (!map[key].notices[n]) {
        map[key].notices[n] = {};
      }

      var m = r.member_name;
      if (!map[key].notices[n][m]) {
        map[key].notices[n][m] = { group: r.group, records: [] };
      }

      map[key].notices[n][m].records.push(r);
    });

    return Object.values(map);
  }

  function renderTreeRows(list, limit, expandKey) {
    var expanded = expandedMap[expandKey];
    var html = "";
    var count = 0;

    for (var i = 0; i < list.length; i++) {
      if (!expanded && count >= limit) break;

      var r = list[i];
      html += '<div class="tree-row depth-' + getDepth(r) + '">';
      html += '<div class="tree-label">' + escapeHtml(buildTreeLabel(r)) + "</div>";
      html += '<div class="tree-content">' + escapeHtml(r.content) + "</div>";
      html += "</div>";

      count++;
    }

    if (!expanded && list.length > limit) {
      html += '<button class="more-btn" data-key="' + expandKey + '">もっと見る</button>';
    }

    return html;
  }

  function renderMemberCards(groups) {
    var html = '<div class="cards">';

    groups.forEach(function (g) {
      html += '<div class="card">';
      html += '<h3>' + escapeHtml(g.member + "（" + (g.group || "") + "）") + "</h3>";

      var ysList = Object.values(g.ys).sort(compareRecords);

      ysList.forEach(function (ys) {
        html += "<div>";
        html += "<b>■ " + escapeHtml(formatYS(ys)) + "</b>";

        var notices = Object.keys(ys.notices).sort(function (a, b) {
          return toNumber(a) - toNumber(b);
        });

        notices.forEach(function (n) {
          var list = ys.notices[n].sort(compareRecords);

          var key = "member:" + g.member;

          html += '<div class="notice-block">';
          html += "<div>通告No:" + escapeHtml(n) + "</div>";
          html += renderTreeRows(list, 3, key);
          html += "</div>";
        });

        html += "</div>";
      });

      html += "</div>";
    });

    html += "</div>";
    els.resultsArea.innerHTML = html;
  }

  function renderSessionCards(groups) {
    var html = '<div class="cards">';

    groups.sort(compareRecords).forEach(function (s) {
      html += '<div class="card">';
      html += "<h3>" + escapeHtml(formatYS(s)) + "</h3>";

      var notices = Object.keys(s.notices).sort(function (a, b) {
        return toNumber(a) - toNumber(b);
      });

      notices.forEach(function (n) {
        html += "<div><b>通告No:" + n + "</b></div>";

        var members = Object.keys(s.notices[n]).sort();

        members.forEach(function (m) {
          var obj = s.notices[n][m];
          var key = "session:" + s.number + "_" + s.year + "_" + s.session + ":" + m;

          html += '<div class="notice-block">';
          html += "<div>" + escapeHtml(m + "（" + (obj.group || "") + "）") + "</div>";
          html += renderTreeRows(obj.records.sort(compareRecords), 3, key);
          html += "</div>";
        });
      });

      html += "</div>";
    });

    html += "</div>";
    els.resultsArea.innerHTML = html;
  }

  function render() {
    var data = filterRecords(RECORDS, state.keyword).sort(compareRecords);

    els.summaryKeyword.textContent = "検索語：" + (state.keyword || "なし");
    els.summaryCount.textContent = "検索結果：" + data.length + "件";
    els.summaryView.textContent = state.viewMode;

    if (state.viewMode === "member") {
      renderMemberCards(groupMember(data));
      return;
    }

    if (state.viewMode === "session") {
      renderSessionCards(groupSession(data));
      return;
    }

    els.resultsArea.innerHTML = "<pre>" + escapeHtml(JSON.stringify(data, null, 2)) + "</pre>";
  }

  function bind() {
    els.searchBtn.onclick = function () {
      state.keyword = els.keywordInput.value;
      render();
    };

    els.clearBtn.onclick = function () {
      state.keyword = "";
      els.keywordInput.value = "";
      expandedMap = {};
      render();
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

    els.resultsArea.onclick = function (e) {
      var key = e.target.getAttribute("data-key");
      if (!key) return;
      expandedMap[key] = !expandedMap[key];
      render();
    };
  }

  bind();
  render();
})();
