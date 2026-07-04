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
  file: "pages/2026-07-04_html-to-lgwan.html",
  title: "HTML生成→LGWAN内配置",
  date: "2026-07-04",
  category: "技術の共有",
  body: "技術の共有 HTML生成→LGWAN内配置 2026-07-04 ／ 〇〇 Claudeに生成させたHTMLを、LGWAN環境内のテキストエディタに貼り付けて〇〇.htmlとして保存するだけで、「権限のある者だけが閲覧できるWebページ」を作る手順です。外部サービスにもサーバーにも依存しません。 01この方法のねらい LGWAN環境では外部Webサービスへの接続が制限されますが、ローカルに置いたHTMLファイルはブラウザ（Edge）で file:// として直接開けます。この性質を使うと、サーバー構築・専用ソフト・管理者権限のいずれも要らずに、共有フォルダのアクセス権が届く範囲＝「見せてよい相手」だけが閲覧できる資料ページを作れます。サーバー不要：ファイルを置くだけ。構築も申請も不要。権限で閲覧制御：共有フォルダのアクセス権がそのまま公開範囲になる。誰でも再現可能：コピー＆保存の操作だけ。属人化しにくい。 02必要なもの テキストエディタ（メモ帳でOK）、Webブラウザ（Edge）、保存先の共有フォルダまたは自分の端末内フォルダ、HTMLを生成する手段（Claude等の生成AI。庁外環境で生成し、テキストだけを持ち込む）。HTMLはあくまで「テキスト」として持ち込みます。実行ファイルではないため、持ち込み時は組織のデータ持ち込みルールに従ってください。個人情報・住民情報・内部システム構成などの機微情報はページに含めない運用を前提とします。 03作成手順（4ステップ） STEP1／HTMLを生成する。生成AIに「作りたいページの内容」を伝え、HTMLコードを1つ出力させます。指示のひな形は次章に用意しています。 STEP2／テキストを全選択してコピー。出力された  から  までを、すべて選択してコピーします。 STEP3／メモ帳に貼り付けて保存。メモ帳を開き、貼り付け、［名前を付けて保存］で次の2点を必ず指定します。ファイル名…〇〇.html（末尾を必ず .html にする）、ファイルの種類…「すべてのファイル」（テキスト文書のままだと .txt が付く）、文字コード…UTF-8（文字化け防止）。 STEP4／ブラウザで開いて確認。保存した〇〇.htmlをダブルクリック、またはEdgeにドラッグして表示を確認します。崩れがあればSTEP1に戻って修正を依頼します。 04指示テンプレート（コピーして使う） そのまま生成AIに貼り付け、〇〇部分を書き換えて使ってください。プロンプト例：次の条件で、単一のHTMLファイルを1つ出力してください。【用途】・LGWAN環境内のブラウザ（Edge）で file:// として開く社内向け資料ページ ・外部CDNや外部リンクは使わない（すべて1ファイルで完結）【内容】・タイトル：〇〇 ・伝えたいこと：〇〇 ・掲載する項目：〇〇、〇〇、〇〇 【体裁】・からまで省略せず出力 ・文字コードはUTF-8、lang=“ja” ・スマホでも読める簡潔なレイアウト ・説明の前置きは不要、HTMLコードのみ出力。※外部CDN禁止を明記すると、LGWAN内でも崩れないファイルになります。 05よくあるつまずき 症状：ダブルクリックしてもメモ帳で開く／原因：拡張子が.txtになっている／対処：ファイルの種類を「すべてのファイル」にして.htmlで保存し直す。症状：文字が□や？に化ける／原因：文字コードがUTF-8でない／対処：保存時に文字コードをUTF-8へ変更。症状：レイアウトが崩れる・画像が出ない／原因：外部CDN・外部URLを参照している／対処：「1ファイルで完結」で作り直す。画像は使わない、または埋め込み指定。症状：他の人が見られない／原因：個人フォルダに置いている／対処：共有フォルダの、見せたい範囲にアクセス権がある場所へ移動。 06広めるときのコツ 最初は「完成済みのHTMLファイルを渡して、置き場所を変えるだけ」から体験してもらうと心理的ハードルが下がります。慣れてきたらSTEP4→STEP1の順で、後ろの工程から少しずつ触ってもらうと定着しやすいです。このページ自体も同じ方法で作られています。「作り方の見本」として、そのまま教材に使えます。"
},
    {
  file: "2026-07-06_kintone-marugoto-dxbox-trial.html",
  title: "kintone まるごとDXボックスを活用した試験運用について",
  date: "2026-07-06",
  category: "DX推進",
  body: "DX推進 kintone まるごとDXボックスを活用した試験運用について 令和8年7月6日 〇〇課 DX推進担当 01提案の概要 本提案は、無償プログラムを活用して kintone を全庁的に試験導入し、あわせて LGWAN 環境からの安全な接続手段を確保するものです。予算化前の準備・効果検証期間として、庁費の追加負担を最小限に抑えて実証（PoC）を実施できる点が最大の利点です。 Ⅰ. 基盤 自治体まるごとDXボックス 全職員が無償で利用できる kintone 環境。自治体向けアプリを標準搭載。 Ⅱ. 接続 LGWAN×kintone まるっと活用プログラム 〇〇社「moconavi」を無償試用。LGWAN 端末から kintone へ直接接続。 Ⅲ. 支援 パートナー企業：〇〇 申込窓口。導入から運用・内製化までの伴走支援を担う。 Ⅳ. 方式 LGWAN-ASP 専用接続 SKY-DIV を経由せず、認定の専用経路で kintone を利用。 いずれも無償で利用可能なプログラムであり、本格導入の可否を判断するための実証を、低コストで実施できます。 02各構成要素の説明 Ⅰ. kintone「自治体まるごとDXボックス」 〇〇社が小規模自治体向けに提供する、kintone を基盤とした自治体DX推進プログラム。全職員が無償で利用できる kintone 環境に、すぐに使える自治体向けアプリがあらかじめ備わっています。 提供元 〇〇株式会社 費用 無償（プログラム参加中） 無償提供期間 利用開始日～令和9年4月末まで（最大約13か月） 申込方法 パートナー企業経由での申込みが必要 Ⅱ. moconavi「LGWAN×kintone まるっと活用プログラム」 〇〇社が提供する、LGWAN 環境から kintone を安全に利用するためのクラウドゲートウェイサービスを無償で試用できるプログラム。上記Ⅰへの参加が前提条件となります。 提供元 株式会社〇〇 費用 無償（キャンペーン期間中・ユーザー数無制限） 申込期間 令和8年9月30日まで 登録区分 LGWAN-ASP 登録済サービス（認定登録番号〇〇） 特徴 VPN・端末証明書が不要。端末に専用アプリを導入するだけで LGWAN 端末から直接接続可能 Ⅲ. パートナー企業「〇〇」 まるごとDXボックスは複数のパートナー企業が窓口となって提供しており、自治体はその中から1社を選んで申し込みます。本提案では〇〇を選定します。 選定理由：kintone に特化した開発実績が豊富で、パートナー評価制度で継続的に高評価を獲得。実務経験の長い元市役所職員による伴走支援体制を有し、自治体特有の事務フローや人事異動時の引き継ぎといった現場課題に対応できる点。 03接続方式の現状と変更点 現状では、インターネット系の閲覧は SKY-DIV による画面転送方式、Microsoft365 は LGWAN 環境内に保存したデータを利用しています。このまま kintone を利用すると画面転送経由となり、操作性の低下や連携サービスが正しく動作しない懸念があります。 現状のまま利用した場合 LGWAN 端末→SKY-DIV（画面転送）→インターネット系ブラウザ→kintone 画面転送を経由するため操作性・応答性が低下。連携サービスが正しく動作しない可能性があります。 本提案（moconavi 専用接続） LGWAN 端末→moconavi（セキュアブラウザ起動）→LGWAN-ASP 認定の専用経路→kintone LGWAN 端末上で moconavi のセキュアブラウザを起動し、その中で kintone にログインして利用します。起動時に kintone 画面へ自動遷移させることも可能で、職員から見た使用感は「kintone 専用アイコンを開く」感覚に近づけられます。 04既存環境（SKY-DIV）との共存 一般的なインターネット閲覧→従来どおり SKY-DIV を使用。ホームページの閲覧、調べ物など、これまでの用途はそのまま画面転送で対応します。 kintone および連携サービス→moconavi 経由で専用接続。kintone と対応する連携サービスのみ、moconavi のセキュアブラウザから直接接続します。 moconavi は構成プロファイルを利用しないため、既存の端末管理・セキュリティ製品と競合せず併用できます。現行セキュリティモデルを変更することなく、kintone 専用の別経路として並行導入できます。 05セキュリティ上の論点と対策 論点：SKY-DIV 経由でも kintone にログインできてしまうリスク。moconavi を経由せずとも、SKY-DIV を通したブラウザで ID・パスワードを入力すれば、理屈のうえでは kintone にログインできてしまいます。放置すると意図しない経路からのアクセスが発生しうります。 区分 対策 主・技術的制御：kintone の IP アドレス制限機能を利用し、moconavi の通信経路からのアクセスのみを許可。SKY-DIV 経由の通常インターネットからのログインを技術的に遮断します。 従・運用ルール：IP 制限を補完する形で、「kintone へは moconavi 経由でのみアクセスする」旨を庁内で周知・明文化します。 無害化について：moconavi 自体が Office ファイルを中心とした無害化機能を標準搭載しており、SKY-DIV と合わせ経路ごとに無害化が担保される「二重の無害化体制」となります。両者のポリシーが重複・矛盾しないよう、情報政策担当と事前に整理します。 06データの保存場所に関する留意点 LGWAN-ASP を利用しても、kintone の業務データの保存場所自体は変わりません。kintone のデータは従来どおり〇〇社のクラウド上に保存されます。moconavi（LGWAN-ASP）が提供するのは「安全な通信経路」であり、データを別サーバーに保管し直すものではありません。「保存場所が LGWAN 内に移る」のではなく、「そこへ至る通信経路が LGWAN の閉域網を経由する安全な形になる」と理解すべきです。この点は個人情報の取扱い区分を検討する際に重要となるため、庁内で正確に共有しておく必要があります。 07導入の進め方（想定スケジュール） STEP1 パートナー企業（〇〇）経由で「まるごとDXボックス」に申込み。kintone 環境と伴走支援がセットで開始。 STEP2 「LGWAN×kintone まるっと活用プログラム」に申込み（締切：令和8年9月30日）。事前ヒアリングを経てセットアップ支援を受ける。 STEP3 kintone 側の IP アドレス制限を設定（moconavi 経由のみ許可）。 STEP4 動作検証。kintone 本体および連携サービスが LGWAN 環境で正常動作するかを確認。 STEP5 効果検証・全庁展開の可否判断・次年度予算要求の検討。 08事前に確認すべき事項 当市が過去に「まるごとDXボックス」「moconavi 本プログラム」に参加していないか（前年度参加者は対象外となるルールがあるため）、moconavi 経由での kintone・連携サービスの動作可否（要事前検証）、SKY-DIV と moconavi の無害化ポリシーの整合性（情報政策担当と調整）、全職員導入を見据えた場合の次年度以降の費用（優遇価格の適用条件）。 09本提案の意義（まとめ） 低コストでの実証：無償プログラムの活用により、庁費の追加負担を最小限に抑えて実証導入が可能。既存環境との共存：操作性・利便性を確保しつつ、既存の SKY-DIV 環境とも共存できる。安全性の担保：技術的なアクセス制御（IP制限）により、意図しない経路からのアクセスを遮断。伴走による定着：実績あるパートナーの支援により、内製化・定着まで見据えた推進が可能。本取組は、当市における「kintone×moconavi 併用」の先行的な実証事例となり、今後の全庁DX基盤整備を検討するうえでの貴重な材料となります。※本資料中の無償提供期間・申込締切・登録番号・実績数値等は作成時点の情報に基づく。正式な起案前に、各提供元の最新の公式情報で再確認すること。"
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
