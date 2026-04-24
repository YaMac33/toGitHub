const PROGRESS_KEY = "qa_progress_v2";
    const RATES_KEY = "qa_rates_v2";
    const FAVORITES_KEY = "qa_favorites_v1";
    const FAVORITE_MODE_KEY = "qa_favorite_mode_v1";

    let questions = [];
    let currentQuestion = null;
    let lastQuestionId = null;
    let isAnswered = false;

    let progress = loadProgress();
    let rates = loadRates();
    let favorites = loadFavorites();
    let favoriteMode = loadFavoriteMode();

    const $ = (id) => document.getElementById(id);

    function loadProgress() {
      try { return JSON.parse(localStorage.getItem(PROGRESS_KEY) || "{}"); }
      catch { return {}; }
    }

    function saveProgress() {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
    }

    function loadRates() {
      try {
        return {
          unanswered: 40,
          wrong: 50,
          mastered: 10,
          favoriteBoost: 0,
          ...JSON.parse(localStorage.getItem(RATES_KEY) || "{}")
        };
      } catch {
        return { unanswered: 40, wrong: 50, mastered: 10, favoriteBoost: 0 };
      }
    }

    function saveRates() {
      localStorage.setItem(RATES_KEY, JSON.stringify(rates));
    }

    function loadFavorites() {
      try {
        const arr = JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]");
        return new Set(Array.isArray(arr) ? arr : []);
      } catch {
        return new Set();
      }
    }

    function saveFavorites() {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favorites]));
    }

    function loadFavoriteMode() {
      return localStorage.getItem(FAVORITE_MODE_KEY) === "true";
    }

    function saveFavoriteMode() {
      localStorage.setItem(FAVORITE_MODE_KEY, String(favoriteMode));
    }

    function isFavorite(id) {
      return favorites.has(id);
    }

    function toggleFavorite(id) {
      if (!id) return;
      if (favorites.has(id)) favorites.delete(id);
      else favorites.add(id);
      saveFavorites();
      updateStats();
      renderFavoriteUI();
      renderList();
      renderFavoriteModeStatus();
    }

    function getQuestionState(id) {
      const p = progress[id];
      if (!p) return "unanswered";
      if (p.status === "wrong") return "wrong";
      if (p.status === "mastered") return "mastered";
      return "unanswered";
    }

    function getStatusBadgeHTML(state) {
      if (state === "wrong") return `<span id="statusPill" class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">不正解</span>`;
      if (state === "mastered") return `<span id="statusPill" class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">マスター</span>`;
      return `<span id="statusPill" class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-600">未回答</span>`;
    }

    function classifyQuestions(sourceQuestions = questions) {
      return {
        unanswered: sourceQuestions.filter(q => getQuestionState(q.id) === "unanswered"),
        wrong: sourceQuestions.filter(q => getQuestionState(q.id) === "wrong"),
        mastered: sourceQuestions.filter(q => getQuestionState(q.id) === "mastered")
      };
    }

    function updateStats() {
      const groups = classifyQuestions();
      $("statUnanswered").textContent = groups.unanswered.length;
      $("statWrong").textContent = groups.wrong.length;
      $("statMastered").textContent = groups.mastered.length;
      $("statFavorites").textContent = favorites.size;
    }

    function weightedPickGroup(groups) {
      const available = [];
      if (groups.unanswered.length > 0 && rates.unanswered > 0) available.push({ key: "unanswered", weight: Number(rates.unanswered) });
      if (groups.wrong.length > 0 && rates.wrong > 0) available.push({ key: "wrong", weight: Number(rates.wrong) });
      if (groups.mastered.length > 0 && rates.mastered > 0) available.push({ key: "mastered", weight: Number(rates.mastered) });

      if (available.length === 0) return questions.length === 0 ? null : "all";

      const total = available.reduce((sum, item) => sum + item.weight, 0);
      let r = Math.random() * total;

      for (const item of available) {
        r -= item.weight;
        if (r <= 0) return item.key;
      }
      return available[available.length - 1].key;
    }

    function maybeRestrictToFavorites(pool) {
      const favPool = pool.filter(q => isFavorite(q.id));
      if (favPool.length === 0) return pool;

      if (favoriteMode) return favPool;

      const boost = Math.max(0, Math.min(100, Number(rates.favoriteBoost) || 0));
      if (boost > 0 && Math.random() * 100 < boost) {
        return favPool;
      }
      return pool;
    }

    function pickRandomQuestion() {
      if (questions.length === 0) return null;

      let sourceQuestions = questions;
      if (favoriteMode) {
        sourceQuestions = questions.filter(q => isFavorite(q.id));
        if (sourceQuestions.length === 0) return null;
      }

      const groups = classifyQuestions(sourceQuestions);
      const selectedGroup = weightedPickGroup(groups);

      let pool;
      if (selectedGroup === "unanswered") pool = groups.unanswered;
      else if (selectedGroup === "wrong") pool = groups.wrong;
      else if (selectedGroup === "mastered") pool = groups.mastered;
      else pool = sourceQuestions;

      if (!pool || pool.length === 0) pool = sourceQuestions;
      pool = maybeRestrictToFavorites(pool);

      if (pool.length > 1 && lastQuestionId) {
        const withoutLast = pool.filter(q => q.id !== lastQuestionId);
        if (withoutLast.length > 0) pool = withoutLast;
      }

      return pool[Math.floor(Math.random() * pool.length)];
    }

    function renderFavoriteUI() {
      if (!currentQuestion) {
        $("favoriteBtnIcon").textContent = "☆";
        $("favoriteBtnText").textContent = "お気に入り登録";
        $("favoriteBadge").classList.add("hidden");
        return;
      }

      const fav = isFavorite(currentQuestion.id);
      $("favoriteBtnIcon").textContent = fav ? "★" : "☆";
      $("favoriteBtnText").textContent = fav ? "お気に入り解除" : "お気に入り登録";
      $("favoriteBadge").classList.toggle("hidden", !fav);
    }

    function renderFavoriteModeStatus() {
      $("favoriteModeStatus").textContent = favoriteMode
        ? "現在: お気に入り出題モード"
        : "現在: 通常出題モード";
    }

    function renderQuestion() {
      isAnswered = false;

      $("resultArea").classList.add("hidden");
      $("resultArea").classList.remove("fade-in");
      $("resultBox").classList.add("hidden");
      $("explanationContainer").classList.add("hidden");
      $("nextBtn").classList.add("hidden");

      $("controlsUnanswered").classList.remove("hidden");
      $("answerInput").value = "";
      $("answerInput").classList.remove("border-red-500", "ring-red-500");
      $("answerInput").disabled = false;

      if (!currentQuestion) {
        $("question").textContent = favoriteMode
          ? "お気に入り出題モードですが、お気に入り問題がありません。"
          : "出題できる問題がありません。";
        $("idPill").textContent = "ID: -";
        $("statusPill").outerHTML = `<span id="statusPill" class="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600">-</span>`;
        renderFavoriteUI();
        return;
      }

      const state = getQuestionState(currentQuestion.id);
      $("question").textContent = currentQuestion.question;
      $("idPill").textContent = "ID: " + currentQuestion.id;
      $("statusPill").outerHTML = getStatusBadgeHTML(state).replace('px-2.5 py-0.5', 'px-3 py-1 text-sm');
      renderFavoriteUI();

      setTimeout(() => $("answerInput").focus(), 50);
    }

    function submitAnswer() {
      if (!currentQuestion || isAnswered) return;

      const input = $("answerInput").value.trim();
      if (!input) {
        $("answerInput").classList.add("shake", "border-red-500", "focus:ring-red-500");
        setTimeout(() => $("answerInput").classList.remove("shake"), 400);
        return;
      }

      isAnswered = true;
      $("answerInput").disabled = true;

      const answers = Array.isArray(currentQuestion.answer) ? currentQuestion.answer : [];
      const isCorrect = answers.includes(input);

      if (!progress[currentQuestion.id]) {
        progress[currentQuestion.id] = { status: "unanswered", correctStreak: 0 };
      }

      const p = progress[currentQuestion.id];

      $("controlsUnanswered").classList.add("hidden");
      $("resultArea").classList.remove("hidden");
      $("resultBox").classList.remove("hidden");
      $("nextBtn").classList.remove("hidden");

      void $("resultArea").offsetWidth;
      $("resultArea").classList.add("fade-in");

      if (isCorrect) {
        p.correctStreak = (p.correctStreak || 0) + 1;
        if (p.correctStreak >= 2) p.status = "mastered";
        else if (p.status !== "wrong") p.status = "mastered";

        const msg = p.status === "mastered" ? "🎉 マスターしました！" : "⭕ 正解！";
        $("resultBox").className = "p-5 rounded-xl text-center border-2 bg-green-50 border-green-200 text-green-700 w-full";
        $("resultBox").innerHTML = `<div class="text-2xl font-bold">${msg}</div>`;
      } else {
        p.status = "wrong";
        p.correctStreak = 0;

        const firstAnswer = answers[0] || "";
        $("resultBox").className = "p-5 rounded-xl text-center border-2 bg-red-50 border-red-200 text-red-700 w-full";
        $("resultBox").innerHTML = `
          <div class="text-2xl font-bold mb-2">❌ 不正解</div>
          <div class="text-sm bg-white bg-opacity-60 px-4 py-2 rounded-lg inline-block">
            正解: <span class="font-bold text-lg underline ml-1">${escapeHtml(firstAnswer)}</span>
          </div>`;
      }

      if (currentQuestion.explanation || currentQuestion.link) {
        $("explanationTitle").textContent = "解説";
        let html = `<div>${escapeHtml(currentQuestion.explanation || "")}</div>`;
        if (currentQuestion.link) {
          html += `<div class="mt-2"><a href="${escapeAttribute(currentQuestion.link)}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline font-medium flex items-center gap-1">参考リンク</a></div>`;
        }
        $("explanation").innerHTML = html;
        $("explanationContainer").classList.remove("hidden");
      } else {
        $("explanationContainer").classList.add("hidden");
      }

      progress[currentQuestion.id] = p;
      saveProgress();
      updateStats();
      renderList();

      setTimeout(() => $("nextBtn").focus(), 50);
    }

    function nextQuestion() {
      currentQuestion = pickRandomQuestion();
      if (!currentQuestion) {
        renderQuestion();
        updateStats();
        return;
      }
      lastQuestionId = currentQuestion.id;
      renderQuestion();
      updateStats();
    }

    function renderList() {
      const body = $("listBody");
      const search = $("listSearch").value.trim().toLowerCase();
      const filter = $("listFilter").value;
      const favoriteFilter = $("favoriteFilter").value;

      body.innerHTML = "";

      const filtered = questions.filter(q => {
        const state = getQuestionState(q.id);
        const fav = isFavorite(q.id);

        if (filter !== "all" && state !== filter) return false;
        if (favoriteFilter === "only" && !fav) return false;
        if (favoriteFilter === "exclude" && fav) return false;

        if (!search) return true;

        const haystack = [
          q.id,
          q.question,
          (Array.isArray(q.answer) ? q.answer.join(" ") : ""),
          q.explanation || "",
          fav ? "お気に入り" : ""
        ].join(" ").toLowerCase();

        return haystack.includes(search);
      });

      if (filtered.length === 0) {
        body.innerHTML = `<tr><td colspan="7" class="px-4 py-8 text-center text-gray-500">該当する問題が見つかりません</td></tr>`;
        return;
      }

      for (const q of filtered) {
        const tr = document.createElement("tr");
        tr.className = "hover:bg-gray-50 transition-colors";
        const state = getQuestionState(q.id);
        const answers = Array.isArray(q.answer) ? q.answer.join(" / ") : "";
        const linkHtml = q.link ? `<a href="${escapeAttribute(q.link)}" target="_blank" class="text-blue-500 hover:text-blue-700 ml-1" title="参考リンク">🔗</a>` : "";
        const fav = isFavorite(q.id);

        tr.innerHTML = `
          <td class="px-4 py-3 whitespace-nowrap">${getStatusBadgeHTML(state)}</td>
          <td class="px-4 py-3 whitespace-nowrap">
            <button class="favorite-toggle text-xl ${fav ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-500'}" data-fav-id="${escapeAttribute(q.id)}" type="button">${fav ? '★' : '☆'}</button>
          </td>
          <td class="px-4 py-3 text-gray-500 font-mono text-xs">${escapeHtml(q.id)}</td>
          <td class="px-4 py-3 font-medium text-gray-800">${escapeHtml(q.question)}</td>
          <td class="px-4 py-3 text-gray-600 hidden md:table-cell">${escapeHtml(answers)}</td>
          <td class="px-4 py-3 text-gray-500 text-sm hidden lg:table-cell max-w-xs truncate" title="${escapeHtml(q.explanation || "")}">${escapeHtml(q.explanation || "")}${linkHtml}</td>
          <td class="px-4 py-3 text-center whitespace-nowrap">
            <button class="bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shadow-sm open-btn" data-id="${escapeAttribute(q.id)}">開く</button>
          </td>
        `;

        tr.querySelector(".open-btn").addEventListener("click", () => {
          currentQuestion = q;
          lastQuestionId = q.id;
          showTab("quiz");
          renderQuestion();
        });

        tr.querySelector(".favorite-toggle").addEventListener("click", () => {
          toggleFavorite(q.id);
        });

        body.appendChild(tr);
      }
    }

    function showTab(tab) {
      $("viewQuiz").classList.toggle("hidden", tab !== "quiz");
      $("viewList").classList.toggle("hidden", tab !== "list");
      $("viewSettings").classList.toggle("hidden", tab !== "settings");

      const tabs = { quiz: $("tabQuiz"), list: $("tabList"), settings: $("tabSettings") };
      for (const key in tabs) {
        if (key === tab) {
          tabs[key].className = "px-4 py-3 text-sm font-bold text-blue-600 border-b-2 border-blue-600 focus:outline-none whitespace-nowrap transition-colors";
        } else {
          tabs[key].className = "px-4 py-3 text-sm font-medium text-gray-500 hover:text-gray-800 border-b-2 border-transparent hover:border-gray-300 focus:outline-none whitespace-nowrap transition-colors";
        }
      }

      if (tab === "list") renderList();
      if (tab === "settings") renderRates();
    }

    function renderRates() {
      $("rateUnanswered").value = rates.unanswered;
      $("rateWrong").value = rates.wrong;
      $("rateMastered").value = rates.mastered;
      $("favoriteBoost").value = rates.favoriteBoost;
      renderFavoriteModeStatus();
    }

    function saveRateSettings() {
      rates.unanswered = Math.max(0, Number($("rateUnanswered").value) || 0);
      rates.wrong = Math.max(0, Number($("rateWrong").value) || 0);
      rates.mastered = Math.max(0, Number($("rateMastered").value) || 0);
      rates.favoriteBoost = Math.max(0, Math.min(100, Number($("favoriteBoost").value) || 0));
      saveRates();

      const btn = $("saveRatesBtn");
      const originalText = btn.textContent;
      btn.textContent = "✅ 保存しました";
      btn.classList.replace("bg-gray-900", "bg-green-600");
      setTimeout(() => {
        btn.textContent = originalText;
        btn.classList.replace("bg-green-600", "bg-gray-900");
      }, 2000);
    }

    function resetProgress() {
      if (!confirm("学習履歴をリセットします。本当によろしいですか？")) return;
      progress = {};
      saveProgress();
      updateStats();
      renderList();
      if (currentQuestion) renderQuestion();
      alert("リセットが完了しました。");
    }

    function escapeHtml(str) {
      return String(str)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }

    function escapeAttribute(str) {
      return escapeHtml(str);
    }

    function setQuestionsData(json) {
      if (!Array.isArray(json)) {
        throw new Error("data.js の QUIZ_DATA の形式が不正です（配列ではありません）");
      }

      questions = json.map(item => ({
        id: String(item.id || "").trim(),
        question: String(item.question || "").trim(),
        answer: Array.isArray(item.answer) ? item.answer.map(v => String(v)) : [],
        explanation: String(item.explanation || "").trim(),
        link: item.link ? String(item.link).trim() : ""
      })).filter(q => q.id && q.question && q.answer.length > 0);

      updateStats();
      renderList();

      if (questions.length === 0) {
        currentQuestion = null;
        renderQuestion();
        return;
      }

      nextQuestion();
    }

    function showLoadError(message) {
      $("question").textContent = "data.js の読み込みに失敗しました";
      $("answerInput").disabled = true;
      $("controlsUnanswered").classList.add("hidden");
      $("resultArea").classList.remove("hidden");
      $("resultBox").classList.add("hidden");
      $("nextBtn").classList.add("hidden");
      $("explanationContainer").classList.remove("hidden");
      $("explanationTitle").textContent = "エラー";
      $("explanation").innerHTML = `<div class="text-red-600 font-bold">${escapeHtml(message)}</div>`;
      $("idPill").textContent = "ID: Error";
      $("statusPill").outerHTML = `<span id="statusPill" class="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">読込エラー</span>`;
    }

    function loadData() {
      try {
        setQuestionsData(window.QUIZ_DATA);
      } catch (err) {
        console.error("描画エラー:", err);
        showLoadError(err.message || String(err));
      }
    }

    $("submitBtn").addEventListener("click", submitAnswer);
    $("skipBtn").addEventListener("click", nextQuestion);
    $("nextBtn").addEventListener("click", nextQuestion);
    $("copyIdBtn").addEventListener("click", async () => {
      if (!currentQuestion?.id) return;
      try {
        await navigator.clipboard.writeText(currentQuestion.id);
        const btn = $("copyIdBtn");
        const originalText = btn.textContent;
        btn.textContent = "コピー済み";
        setTimeout(() => {
          btn.textContent = originalText;
        }, 1200);
      } catch (err) {
        alert("コピーに失敗しました");
      }
    });
    $("favoriteBtn").addEventListener("click", () => {
      if (currentQuestion) toggleFavorite(currentQuestion.id);
    });

    $("favoriteModeOnBtn").addEventListener("click", () => {
      favoriteMode = true;
      saveFavoriteMode();
      renderFavoriteModeStatus();
      nextQuestion();
    });

    $("favoriteModeOffBtn").addEventListener("click", () => {
      favoriteMode = false;
      saveFavoriteMode();
      renderFavoriteModeStatus();
      nextQuestion();
    });

    document.addEventListener("keydown", (e) => {
      if (!$("viewQuiz").classList.contains("hidden") && e.key === "Enter") {
        e.preventDefault();
        if (!isAnswered && !$("answerInput").disabled) {
          submitAnswer();
        } else if (isAnswered) {
          nextQuestion();
        }
      }
    });

    $("tabQuiz").addEventListener("click", () => showTab("quiz"));
    $("tabList").addEventListener("click", () => showTab("list"));
    $("tabSettings").addEventListener("click", () => showTab("settings"));

    $("listSearch").addEventListener("input", renderList);
    $("listFilter").addEventListener("change", renderList);
    $("favoriteFilter").addEventListener("change", renderList);
    $("reloadListBtn").addEventListener("click", renderList);

    $("saveRatesBtn").addEventListener("click", saveRateSettings);
    $("resetProgressBtn").addEventListener("click", resetProgress);

    loadData();