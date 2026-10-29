// ページ側で動く部分。本文の取り出し、入力欄への文字の挿入、画面右下の小さな操作パネル。
// 拡張機能の操作をしたときだけ、そのタブに差し込まれる。
(function () {
  'use strict';
  if (window.__gvPage) return;
  const GV = globalThis.GV;

  // ---------- 入力欄 ----------

  const TEXT_INPUT = /^(text|search|url|email|tel)$/i;

  function deepActive() {
    let el = document.activeElement;
    for (let i = 0; i < 8 && el; i++) {
      if (el.shadowRoot && el.shadowRoot.activeElement) {
        el = el.shadowRoot.activeElement;
      } else if (el.tagName === 'IFRAME' || el.tagName === 'FRAME') {
        let d = null;
        try {
          d = el.contentDocument; // 別サイトのiframeの中には入れない
        } catch (_) {}
        if (d && d.activeElement && d.activeElement !== d.body) el = d.activeElement;
        else break;
      } else {
        break;
      }
    }
    return el;
  }

  function isEditable(el) {
    if (!el || el.disabled || el.readOnly) return false;
    if (el.isContentEditable || el.tagName === 'TEXTAREA') return true;
    return el.tagName === 'INPUT' && TEXT_INPUT.test(el.type || 'text');
  }

  let target = null;
  let savedRange = null;

  // 録音を始めたときの入力欄とカーソル位置を覚えておく
  function mark() {
    const el = deepActive();
    target = isEditable(el) ? el : null;
    savedRange = null;
    if (target && target.isContentEditable) {
      const sel = target.ownerDocument.getSelection();
      if (sel && sel.rangeCount && target.contains(sel.getRangeAt(0).commonAncestorContainer)) {
        savedRange = sel.getRangeAt(0).cloneRange();
      }
    }
    return !!target;
  }

  function insert(text) {
    let el = target && target.isConnected ? target : deepActive();
    const range = el === target ? savedRange : null;
    target = null;
    savedRange = null;
    if (!isEditable(el)) return false;

    const doc = el.ownerDocument;
    el.focus();
    if (el.isContentEditable && range) {
      const sel = doc.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
    let ok = false;
    try {
      ok = doc.execCommand('insertText', false, text);
    } catch (_) {}
    if (ok) return true;

    if ('value' in el && typeof el.setRangeText === 'function') {
      const start = el.selectionStart == null ? el.value.length : el.selectionStart;
      const end = el.selectionEnd == null ? start : el.selectionEnd;
      el.setRangeText(text, start, end, 'end');
      el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
      return true;
    }
    if (el.isContentEditable) {
      const sel = doc.getSelection();
      let r = sel.rangeCount ? sel.getRangeAt(0) : null;
      if (!r || !el.contains(r.commonAncestorContainer)) {
        r = doc.createRange();
        r.selectNodeContents(el);
        r.collapse(false);
      }
      r.deleteContents();
      const node = doc.createTextNode(text);
      r.insertNode(node);
      r.setStartAfter(node);
      r.collapse(true);
      sel.removeAllRanges();
      sel.addRange(r);
      el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
      return true;
    }
    return false;
  }

  // ---------- 本文の取り出し ----------

  function extract(maxChars) {
    const done = (t, fromSelection) => ({ text: t.slice(0, maxChars), truncated: t.length > maxChars, fromSelection });
    const selected = String(window.getSelection() || '').trim();
    if (selected) return done(selected, true);

    const SKIP = [
      'nav', 'footer', 'aside', 'form', 'dialog', 'button', 'script', 'style', 'noscript', 'svg',
      '[role="navigation"]', '[role="complementary"]', '[role="contentinfo"]', '[role="banner"] nav',
      '[aria-hidden="true"]', '[hidden]', 'gemini-voice-overlay',
    ].join(',');
    const BLOCK = 'h1,h2,h3,h4,h5,h6,p,li,blockquote,pre,figcaption,dt,dd,td,th';

    const readFrom = (root) => {
      const out = [];
      for (const el of root.querySelectorAll(BLOCK)) {
        if (el.closest(SKIP)) continue;
        if (el.querySelector(BLOCK)) continue; // 入れ子の親は飛ばし、いちばん内側だけ読む
        if (el.checkVisibility && !el.checkVisibility()) continue;
        const t = (el.innerText || '').replace(/[ \t ]+/g, ' ').trim();
        if (t.length >= 2) out.push(t);
      }
      return out.join('\n');
    };

    // 記事らしい部分のうち、いちばん文章の多いところを本文とみなす
    let root = null;
    let best = 0;
    for (const el of document.querySelectorAll('article, main, [role="main"]')) {
      const n = (el.innerText || '').length;
      if (n > best) {
        best = n;
        root = el;
      }
    }
    let text = root ? readFrom(root) : '';
    if (text.length < 200) {
      const all = readFrom(document.body);
      if (all.length > text.length) text = all;
    }
    if (text.length < 50) text = (document.body.innerText || '').trim();

    const title = (document.title || '').trim();
    const first = text.split('\n')[0] || '';
    if (title && first && !title.includes(first) && !first.includes(title)) text = title + '\n' + text;
    return done(text, false);
  }

  // ---------- 画面右下の操作パネル ----------

  const CSS = `
    :host { all: initial; }
    .box {
      font: 13px/1.5 system-ui, -apple-system, "Segoe UI", "Hiragino Sans", "Yu Gothic UI", Meiryo, sans-serif;
      color: #f9fafb; background: rgba(17, 24, 39, .95); border: 1px solid rgba(255, 255, 255, .08);
      border-radius: 14px; box-shadow: 0 12px 32px rgba(0, 0, 0, .32); padding: 10px 12px 10px 14px;
      width: 304px; box-sizing: border-box; animation: in .16s ease-out;
    }
    @keyframes in { from { opacity: 0; transform: translateY(6px); } }
    .top { display: flex; align-items: center; gap: 8px; min-height: 30px; }
    .title { flex: 1; display: flex; align-items: center; gap: 8px; font-weight: 600; min-width: 0; }
    .count { margin-left: 8px; font-weight: 400; color: #a5b4fc; font-variant-numeric: tabular-nums; }
    .elapsed { font-variant-numeric: tabular-nums; }
    .ic { display: inline-flex; }
    svg { width: 18px; height: 18px; fill: currentColor; }
    .title > .ic { color: #a5b4fc; }
    .err .title, .err .title > .ic { color: #fca5a5; }
    .dot { width: 9px; height: 9px; border-radius: 50%; background: #ef4444; flex: none; animation: pulse 1.2s ease-in-out infinite; }
    @keyframes pulse { 50% { opacity: .3; } }
    .spin { width: 14px; height: 14px; flex: none; border: 2px solid rgba(255, 255, 255, .25); border-top-color: #fff; border-radius: 50%; animation: spin .8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .preview { margin: 4px 0 0; color: #d1d5db; font-size: 12px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .bar { height: 3px; background: rgba(255, 255, 255, .12); border-radius: 2px; overflow: hidden; margin: 8px 0; }
    .bar > i { display: block; height: 100%; background: #818cf8; transition: width .3s; }
    .row { display: flex; align-items: center; gap: 4px; margin-top: 6px; }
    .spacer { flex: 1; }
    button { all: unset; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 32px; padding: 0 12px; border-radius: 8px; color: #f9fafb; font-size: 12px; box-sizing: border-box; white-space: nowrap; }
    button:hover { background: rgba(255, 255, 255, .1); }
    button:focus-visible { outline: 2px solid #a5b4fc; outline-offset: 1px; }
    button.icon { width: 32px; padding: 0; }
    button.sm { width: 26px; }
    button.primary { background: #4f46e5; }
    button.primary:hover { background: #6366f1; }
    button.grow { flex: 1; }
    .speed { min-width: 36px; text-align: center; font-size: 12px; color: #e5e7eb; font-variant-numeric: tabular-nums; }
    .msg { margin-top: 4px; color: #e5e7eb; font-size: 12px; white-space: pre-wrap; word-break: break-word; max-height: 140px; overflow: auto; }
    .result { background: rgba(255, 255, 255, .06); border-radius: 8px; padding: 8px; }
    .hint { margin-top: 6px; color: #9ca3af; font-size: 11px; }
    @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
  `;

  let tabId = null;
  let showOverlay = true;
  let host = null;
  let box = null;
  let current = null;
  let dismissedJob = null;
  let ticker = null;
  let hideTimer = null;

  function ensureUI() {
    if (host && host.isConnected) return;
    host = document.createElement('gemini-voice-overlay');
    host.style.cssText = 'all: initial; position: fixed; z-index: 2147483647; right: 20px; bottom: 20px;';
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = CSS;
    box = document.createElement('div');
    box.className = 'box';
    box.setAttribute('role', 'region');
    box.setAttribute('aria-label', 'Gemini ボイス');
    shadow.append(style, box);
    document.documentElement.appendChild(host);
  }

  function hide() {
    clearInterval(ticker);
    clearTimeout(hideTimer);
    if (host) host.remove();
    host = null;
    box = null;
  }

  function sendControl(action, value) {
    try {
      chrome.runtime.sendMessage({ target: 'background', type: 'control', action, value }).catch(() => {});
    } catch (_) {
      hide(); // 拡張機能が更新・削除された後
    }
  }

  function render(st) {
    current = st;
    clearInterval(ticker);
    clearTimeout(hideTimer);
    const mine = st && tabId != null && st.tabId === tabId;
    if (!mine || !showOverlay || st.state === 'idle' || (st.jobId && st.jobId === dismissedJob)) {
      hide();
      return;
    }
    ensureUI();
    const dismiss = () => {
      dismissedJob = st.jobId;
      hide();
    };
    const r = GV.panel.render(box, st, { overlay: true, send: sendControl, copy: GV.copyText, dismiss });
    if (r.tick) ticker = setInterval(r.tick, 500);
    if (r.autoHide) hideTimer = setTimeout(dismiss, r.autoHide);
  }

  async function refresh() {
    try {
      const { status } = await chrome.storage.session.get('status');
      render(status || null);
    } catch (_) {}
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'session' && changes.status) render(changes.status.newValue);
  });

  // 録音中は Esc でキャンセル
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && current && current.mode === 'dict' && current.state === 'recording' && current.tabId === tabId) {
      sendControl('cancel');
    }
  }, true);

  window.__gvPage = {
    extract,
    mark,
    insert,
    setTab(id, show) {
      tabId = id;
      showOverlay = show;
      dismissedJob = null;
      refresh();
      return true;
    },
  };
})();
