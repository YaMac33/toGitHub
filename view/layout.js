/* =========================================================================
   layout.js — ヘッダー/フッター共通コンポーネント
   file:// 直開きでも動作(fetch不使用、Shadow DOMも不使用)

   使い方:
     <script src="./layout.js"></script>
     ...
     <site-header title="ページタイトル"></site-header>
     <site-footer></site-footer>

   注意:
     Shadow DOMを使わず光DOM(light DOM)に直接描画しているため、
     style.css のクラス(.navbar, .btn など)がそのまま効きます。
     全ページ共通で見た目を変えたい場合は、このファイルの
     テンプレート部分(innerHTML)だけを直せば全ページに反映されます。
   ========================================================================= */

(function () {
  "use strict";

  /* --- ヘッダー ----------------------------------------------------------- */
  class SiteHeader extends HTMLElement {
    connectedCallback() {
      const title = this.getAttribute("title") || "社内ツール";
      const home = this.getAttribute("home") || "./index.html";

      this.innerHTML = `
        <header class="navbar">
          <span class="brand">${escapeHtml(title)}</span>
          <nav class="flex gap-4 text-sm">
            <a href="${escapeHtml(home)}">ホーム</a>
          </nav>
        </header>
      `;
    }
  }

  /* --- フッター ----------------------------------------------------------- */
  class SiteFooter extends HTMLElement {
    connectedCallback() {
      const owner = this.getAttribute("owner") || "";
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

  /* --- 簡易エスケープ(属性からの差し込み用) --------------------------------- */
  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  customElements.define("site-header", SiteHeader);
  customElements.define("site-footer", SiteFooter);
})();
