/* =========================================================================
   layout.js — 共通レイアウト & 記事一覧 & 全文検索
   LGWAN / 完全オフライン / file:// 直開き / Microsoft Edge 対応
   （fetch不使用・外部リソース不使用・Shadow DOM不使用）

   ■ このファイルでやっていること
     1. 記事の一覧（ARTICLES 配列）を持つ
     2. <site-header> <site-footer> 共通のヘッダー/フッターを描画
     3. <article-list>   記事一覧を配列から自動生成
     4. <article-search> タイトル＋本文の全文検索（トップページ用）

   ■ 更新担当者の方へ（ここだけ触ればOK）
     新しい記事を追加したら、下の「記事リスト（ARTICLES）」に
     1ブロックコピーして貼り付け、中身を書き換えてください。
     それ以外の場所は触らないでください。
   ========================================================================= */

(function () {
  "use strict";

  /* =======================================================================
     ★★★ 記事リスト（ここだけ編集してください）★★★

     新しい記事を追加する手順:
       1. 下の { … } のブロックを1つコピー
       2. いちばん上に貼り付け（新しい記事を上に並べると日付順で自然です）
       3. 中身を書き換える
          - file : pages/ フォルダ内のファイル名（正確に。半角英数字）
          - title: 一覧に表示される記事タイトル
          - date : 日付（YYYY-MM-DD の形式）
          - category: 今は未使用（将来カテゴリ分けする時の欄。空 "" でOK）
          - body : 検索用の本文テキスト（記事本文をそのまま貼り付ける）
                   ※検索に使われます。記事本文を直したら、ここも直してください。

     ※ ブロックの末尾（閉じカッコ } の後ろ）にカンマ「,」が必要です。
       いちばん最後のブロックだけカンマ不要です。
     ======================================================================= */
  const ARTICLES = [
    {
      file: "2026-07-02_dx-results.html",
      title: "DX推進リーダー これまでの取り組みと実績",
      date: "2026-07-02",
      category: "",
      body: "これまでに〇〇が取り組んできた主な事例をまとめました。いずれも大がかりなシステムではなく、現場の作業を少しずつ楽にすることを目的にしています。主な取り組み一覧。会議室予約システム、全庁、紙台帳を廃止し二重予約を解消、運用中。一般質問通告フォーム、議会事務局、提出・集計の手作業を削減、運用中。〇〇集計の自動化、〇〇課、月次作業を半日から約10分に、試行中。取り組みの進め方。どの取り組みも、困っている作業を一緒に見つける、使える形にする、使いながら直す、という流れで進めています。作って終わりにせず、定着まで伴走することを大切にしています。"
    },
    {
  file: "2026-07-06_kintone-marugoto-dxbox-trial.html",
  title: "kintone まるごとDXボックスを活用した試験運用について",
  date: "2026-07-06",
  category: "DX推進",
    }
    // ↑ 新しい記事はこの上の行にブロックをコピーして追加してください
  ];


  /* =======================================================================
     ↓↓↓ ここから下は基本的に触らないでください（仕組みの部分）↓↓↓
     ======================================================================= */

  /* --- ヘッダー ----------------------------------------------------------- */
  class SiteHeader extends HTMLElement {
    connectedCallback() {
      const title = this.getAttribute("title") || "DX推進リーダー 活動紹介";
      const base = this.getAttribute("base") || ".";
      this.innerHTML = `
        <header class="navbar">
          <a href="${base}/index.html" class="brand">${escapeHtml(title)}</a>
          <nav class="flex gap-4 text-sm">
            <a href="${base}/index.html">記事一覧</a>
            <a href="${base}/info/about.html">DX推進リーダーとは？</a>
            <a href="${base}/info/contact.html">お問い合わせ先</a>
          </nav>
        </header>
      `;
    }
  }

  /* --- フッター ----------------------------------------------------------- */
  class SiteFooter extends HTMLElement {
    connectedCallback() {
      const owner = this.getAttribute("owner") || "〇〇 DX推進担当";
      const year = new Date().getFullYear();
      this.innerHTML = `
        <footer class="text-xs text-muted"
                style="padding: var(--space-5); margin-top: var(--space-7);
                       border-top: var(--border-hairline); text-align: center;">
          © ${year} ${escapeHtml(owner)}
        </footer>
      `;
    }
  }

  /* --- 記事一覧 ----------------------------------------------------------- */
  class ArticleList extends HTMLElement {
    connectedCallback() {
      const base = this.getAttribute("base") || ".";
      const items = sortByDateDesc(ARTICLES);
      if (items.length === 0) {
        this.innerHTML = '<p class="text-muted">まだ記事がありません。</p>';
        return;
      }
      this.innerHTML = `<ul class="article-list">${renderRows(items, base)}</ul>`;
    }
  }

  /* --- 全文検索 ----------------------------------------------------------- */
  class ArticleSearch extends HTMLElement {
    connectedCallback() {
      const base = this.getAttribute("base") || ".";
      this._base = base;
      this._composing = false; // IME変換中フラグ

      this.innerHTML = `
        <div class="search-box">
          <input type="text" class="input search-input"
                 placeholder="キーワードで記事を検索"
                 aria-label="記事検索">
        </div>
        <div class="search-results" aria-live="polite"></div>
      `;

      this._input = this.querySelector(".search-input");
      this._results = this.querySelector(".search-results");

      // IME変換中は検索しない。確定後（compositionend）に検索する。
      this._input.addEventListener("compositionstart", () => {
        this._composing = true;
      });
      this._input.addEventListener("compositionend", () => {
        this._composing = false;
        this._run();
      });
      // 変換を伴わない入力（英数字直接・削除・貼り付け等）に対応
      this._input.addEventListener("input", () => {
        if (!this._composing) this._run();
      });
    }

    _run() {
      const raw = this._input.value.trim();

      if (raw === "") {
        this._results.innerHTML = "";
        this.dispatchEvent(new CustomEvent("search-clear", { bubbles: true }));
        return;
      }
      this.dispatchEvent(new CustomEvent("search-active", { bubbles: true }));

      const q = normalize(raw);
      const hits = [];

      sortByDateDesc(ARTICLES).forEach((a) => {
        const titleN = normalize(a.title || "");
        const bodyN = normalize(a.body || "");
        const inTitle = titleN.indexOf(q) !== -1;
        const idxBody = bodyN.indexOf(q);

        if (inTitle || idxBody !== -1) {
          hits.push({
            article: a,
            snippet: idxBody !== -1 ? makeSnippet(a.body, bodyN, q) : ""
          });
        }
      });

      if (hits.length === 0) {
        this._results.innerHTML =
          '<p class="text-muted search-empty">一致する記事がありません。</p>';
        return;
      }

      const base = this._base;
      const html = hits.map((h) => {
        const a = h.article;
        return `
          <a class="search-hit" href="${base}/pages/${encodeURI(a.file)}">
            <span class="article-date">${escapeHtml(a.date)}</span>
            <span class="search-hit-body">
              <span class="article-title">${escapeHtml(a.title)}</span>
              ${h.snippet ? `<span class="search-snippet">${h.snippet}</span>` : ""}
            </span>
          </a>
        `;
      }).join("");

      this._results.innerHTML =
        `<p class="text-xs search-count">${hits.length}件ヒットしました</p>
         <div class="search-hit-list">${html}</div>`;
    }
  }


  /* --- 共通ヘルパー -------------------------------------------------------- */

  function sortByDateDesc(list) {
    return list.slice().sort((a, b) =>
      (b.date || "").localeCompare(a.date || ""));
  }

  function renderRows(items, base) {
    return items.map((a) => `
      <li class="article-row">
        <a class="article-link" href="${base}/pages/${encodeURI(a.file)}">
          <span class="article-date">${escapeHtml(a.date)}</span>
          <span class="article-title">${escapeHtml(a.title)}</span>
        </a>
      </li>
    `).join("");
  }

  /* 正規化: 全角英数字→半角 + 英字を小文字へ
     （ひらがな/カタカナの同一視はしない = 完全一致方針） */
  function normalize(str) {
    return String(str)
      .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (ch) =>
        String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
      .toLowerCase();
  }

  /* スニペット生成: ヒット箇所の前後を切り出し、ヒット語を <mark> で強調 */
  function makeSnippet(original, bodyN, q) {
    const PAD = 35;
    const pos = bodyN.indexOf(q);
    if (pos === -1) return "";

    const start = Math.max(0, pos - PAD);
    const end = Math.min(original.length, pos + q.length + PAD);

    const before = original.slice(start, pos);
    const hit = original.slice(pos, pos + q.length);
    const after = original.slice(pos + q.length, end);

    const lead = start > 0 ? "…" : "";
    const tail = end < original.length ? "…" : "";

    return `${lead}${escapeHtml(before)}`
         + `<mark>${escapeHtml(hit)}</mark>`
         + `${escapeHtml(after)}${tail}`;
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  customElements.define("site-header", SiteHeader);
  customElements.define("site-footer", SiteFooter);
  customElements.define("article-list", ArticleList);
  customElements.define("article-search", ArticleSearch);
})();
