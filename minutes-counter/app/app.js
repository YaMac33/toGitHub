(function () {
  const data = window.APP_DATA || {};
  const speeches = data.speeches || [];
  const qaLinks = data.qa_links || [];
  const summary = data.summary || {};

  const el = {
    searchInput: document.getElementById("searchInput"),
    summaryCards: document.getElementById("summaryCards"),
    speakerLabelRanking: document.getElementById("speakerLabelRanking"),
    speakerNameRanking: document.getElementById("speakerNameRanking"),
    markRanking: document.getElementById("markRanking"),
    answererLabelRanking: document.getElementById("answererLabelRanking"),
    qaTree: document.getElementById("qaTree"),
    unlinkedAnswers: document.getElementById("unlinkedAnswers"),
    speechRows: document.getElementById("speechRows"),
  };

  const speechById = new Map(speeches.map((speech) => [speech.speech_id, speech]));

  function text(value) {
    return value == null || value === "" ? "未設定" : String(value);
  }

  function clip(value, length) {
    const normalized = text(value).replace(/\s+/g, " ").trim();
    return normalized.length > length ? normalized.slice(0, length) + "..." : normalized;
  }

  function matchesSearch(value, query) {
    if (!query) return true;
    return String(value || "").toLowerCase().includes(query);
  }

  function currentQuery() {
    return (el.searchInput.value || "").trim().toLowerCase();
  }

  function filteredSpeeches() {
    const query = currentQuery();
    return speeches.filter((speech) =>
      matchesSearch(speech.speaker_label, query) ||
      matchesSearch(speech.speaker_name, query) ||
      matchesSearch(speech.body, query)
    );
  }

  function filteredQaLinks() {
    const query = currentQuery();
    return qaLinks.filter((link) => {
      const answerSpeech = speechById.get(link.answer_speech_id);
      return (
        matchesSearch(link.questioner_label, query) ||
        matchesSearch(link.questioner_name, query) ||
        matchesSearch(link.answerer_label, query) ||
        matchesSearch(link.answerer_name, query) ||
        matchesSearch(answerSpeech && answerSpeech.body, query)
      );
    });
  }

  function renderSummaryCards() {
    const cards = [
      ["総発言数", summary.total_speeches || 0],
      ["答弁リンク数", summary.total_qa_links || 0],
      ["未紐づけ答弁数", summary.total_unlinked_answers || 0],
      ["取得元URL数", (summary.sources || []).length],
    ];
    el.summaryCards.innerHTML = cards
      .map(([label, value]) => `<article class="stat-card"><span>${label}</span><strong>${value}</strong></article>`)
      .join("");
  }

  function renderRanking(target, rows, labelKeys) {
    target.innerHTML = "";
    if (!rows.length) {
      target.innerHTML = '<li class="empty">データなし</li>';
      return;
    }
    target.innerHTML = rows
      .map((row) => {
        const label = labelKeys.map((key) => text(row[key])).filter(Boolean).join(" ");
        return `<li><span>${escapeHtml(label)}</span><strong>${row.count}回</strong></li>`;
      })
      .join("");
  }

  function summarize(items, keys) {
    const map = new Map();
    items.forEach((item) => {
      const id = keys.map((key) => item[key] || "").join("\u0000");
      if (!id.replace(/\u0000/g, "")) return;
      map.set(id, { item, count: (map.get(id) && map.get(id).count ? map.get(id).count : 0) + 1 });
    });
    return Array.from(map.values())
      .map(({ item, count }) => {
        const row = { count };
        keys.forEach((key) => {
          row[key] = item[key] || "";
        });
        return row;
      })
      .sort((a, b) => b.count - a.count);
  }

  function renderRankings() {
    const speechRows = filteredSpeeches();
    const linkRows = filteredQaLinks();
    renderRanking(el.speakerLabelRanking, summarize(speechRows, ["speaker_label"]), ["speaker_label"]);
    renderRanking(el.speakerNameRanking, summarize(speechRows, ["speaker_name"]), ["speaker_name"]);
    renderRanking(el.markRanking, summarize(speechRows, ["mark"]), ["mark"]);
    renderRanking(el.answererLabelRanking, summarize(linkRows, ["answerer_label"]), ["answerer_label"]);
  }

  function renderQaTree() {
    const grouped = new Map();
    filteredQaLinks()
      .filter((link) => link.questioner_speech_id)
      .forEach((link) => {
        const qKey = `${link.questioner_label || ""}\u0000${link.questioner_name || ""}`;
        const aKey = `${link.answerer_label || ""}\u0000${link.answerer_name || ""}`;
        if (!grouped.has(qKey)) {
          grouped.set(qKey, { label: link.questioner_label, name: link.questioner_name, answers: new Map() });
        }
        const current = grouped.get(qKey);
        current.answers.set(aKey, (current.answers.get(aKey) || 0) + 1);
      });

    if (!grouped.size) {
      el.qaTree.innerHTML = '<p class="empty">データなし</p>';
      return;
    }

    el.qaTree.innerHTML = Array.from(grouped.values())
      .map((group) => {
        const answers = Array.from(group.answers.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([key, count]) => {
            const [label, name] = key.split("\u0000");
            return `<li><span>${escapeHtml(label)} ${escapeHtml(name)}</span><strong>${count}回</strong></li>`;
          })
          .join("");
        return `<article class="tree-item"><h3>${escapeHtml(text(group.label))} ${escapeHtml(text(group.name))}</h3><ul>${answers}</ul></article>`;
      })
      .join("");
  }

  function renderUnlinkedAnswers() {
    const rows = filteredQaLinks().filter((link) => !link.questioner_speech_id);
    el.unlinkedAnswers.innerHTML = rows.length
      ? rows
          .map((link) => {
            const speech = speechById.get(link.answer_speech_id) || {};
            return `<tr>
              <td>${escapeHtml(text(link.answer_speech_id))}</td>
              <td>${escapeHtml(text(link.answerer_label))}<br><span>${escapeHtml(text(link.answerer_name))}</span></td>
              <td>${escapeHtml(clip(speech.body, 90))}</td>
            </tr>`;
          })
          .join("")
      : '<tr><td colspan="3" class="empty">未紐づけ答弁はありません</td></tr>';
  }

  function renderSpeechRows() {
    const rows = filteredSpeeches();
    el.speechRows.innerHTML = rows.length
      ? rows
          .map(
            (speech) => `<tr>
              <td>${speech.seq}</td>
              <td><span class="mark">${escapeHtml(text(speech.mark))}</span></td>
              <td>${escapeHtml(text(speech.role_type))}</td>
              <td>${escapeHtml(text(speech.speaker_label))}<br><span>${escapeHtml(text(speech.speaker_name))}</span></td>
              <td>${escapeHtml(clip(speech.body, 110))}</td>
            </tr>`
          )
          .join("")
      : '<tr><td colspan="5" class="empty">該当する発言はありません</td></tr>';
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function render() {
    renderSummaryCards();
    renderRankings();
    renderQaTree();
    renderUnlinkedAnswers();
    renderSpeechRows();
  }

  el.searchInput.addEventListener("input", render);
  render();
})();
