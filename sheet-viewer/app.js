'use strict';

/** GAS ウェブアプリの /exec URL */
const API_URL = 'https://script.google.com/macros/s/AKfycbzwJSk5hGRsgqnHfU9XxKXiNgXC5t5IkycC5lIwqsIr-UYZyqaG-LRk73z1z6iNc5nX/exec';

const LS = {
  sheets:    'sheetviewer:sheets',
  lastSheet: 'sheetviewer:lastSheet',
  data:      name => 'sheetviewer:data:' + name,
};

const els = {
  select:  document.getElementById('sheetSelect'),
  reload:  document.getElementById('reloadBtn'),
  status:  document.getElementById('status'),
  message: document.getElementById('message'),
  wrap:    document.getElementById('tableWrap'),
};

/* ============ localStorage ラッパ ============ */

function lsGet(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function lsSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    // 容量超過時は古いデータキャッシュを捨ててリトライ
    console.warn('localStorage 書き込み失敗', e);
    purgeDataCache();
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e2) {}
  }
}

function purgeDataCache() {
  Object.keys(localStorage)
    .filter(k => k.startsWith('sheetviewer:data:'))
    .forEach(k => localStorage.removeItem(k));
}

/* ============ 通信 ============ */

async function apiGet(params) {
  const url = new URL(API_URL);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), { method: 'GET' });
  if (!res.ok) throw new Error('HTTP ' + res.status);

  const body = await res.json();
  if (!body.ok) throw new Error(body.error || '不明なエラー');
  return body;
}

/* ============ 表示 ============ */

function setStatus(text, stale) {
  els.status.textContent = text;
  els.status.classList.toggle('stale', !!stale);
}

function showMessage(text) {
  els.message.textContent = text;
  els.message.hidden = false;
  els.wrap.innerHTML = '';
}

function hideMessage() {
  els.message.hidden = true;
}

function formatTime(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '不明';
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} `
       + `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function setBusy(busy) {
  els.reload.classList.toggle('spinning', busy);
  els.reload.disabled = busy;
}

/**
 * 1行目を見出し行、1列目を見出し列として描画する。
 * DocumentFragment に組み立ててから一括で差し込む。
 */
function renderTable(values) {
  els.wrap.innerHTML = '';
  if (!values || values.length === 0) {
    showMessage('このシートにはデータがありません。');
    return;
  }
  hideMessage();

  const frag = document.createDocumentFragment();
  const table = document.createElement('table');

  // --- ヘッダー行 ---
  const thead = document.createElement('thead');
  const headTr = document.createElement('tr');
  values[0].forEach((cell, i) => {
    const th = document.createElement('th');
    th.textContent = cell;
    th.scope = 'col';
    if (i === 0) th.className = 'corner';
    headTr.appendChild(th);
  });
  thead.appendChild(headTr);
  table.appendChild(thead);

  // --- 本体 ---
  const tbody = document.createElement('tbody');
  for (let r = 1; r < values.length; r++) {
    const tr = document.createElement('tr');
    const row = values[r];
    for (let c = 0; c < row.length; c++) {
      const cellEl = document.createElement(c === 0 ? 'th' : 'td');
      if (c === 0) {
        cellEl.className = 'rowhead';
        cellEl.scope = 'row';
      }
      cellEl.textContent = row[c];   // textContent なのでエスケープ不要
      tr.appendChild(cellEl);
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);

  frag.appendChild(table);
  els.wrap.appendChild(frag);
}

function fillSelect(names, selected) {
  els.select.innerHTML = '';
  names.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    els.select.appendChild(opt);
  });
  if (selected && names.includes(selected)) els.select.value = selected;
}

/* ============ 読み込みフロー(SWR) ============ */

/** キャッシュを即描画。描画できたら true */
function renderFromCache(sheetName) {
  const cached = lsGet(LS.data(sheetName));
  if (!cached) return false;
  renderTable(cached.values);
  setStatus(`最終更新: ${formatTime(cached.fetchedAt)}(キャッシュ)`, true);
  return true;
}

/** ネットワークから取得して描画・保存 */
async function refreshSheet(sheetName) {
  setBusy(true);
  const hadCache = !!lsGet(LS.data(sheetName));
  try {
    const body = await apiGet({ action: 'data', sheet: sheetName });
    lsSet(LS.data(sheetName), { values: body.values, fetchedAt: body.fetchedAt });
    renderTable(body.values);
    setStatus(`最終更新: ${formatTime(body.fetchedAt)}`, false);
  } catch (err) {
    console.error(err);
    if (hadCache) {
      const cached = lsGet(LS.data(sheetName));
      setStatus(
        `オフライン — 最終更新: ${formatTime(cached.fetchedAt)}(キャッシュ表示中)`,
        true
      );
    } else {
      setStatus('', false);
      showMessage(
        'データを取得できませんでした。\n'
        + 'オフラインのため、保存済みのデータもありません。\n'
        + '通信できる状態で再度お試しください。'
      );
    }
  } finally {
    setBusy(false);
  }
}

/** シート一覧を取得(失敗時はキャッシュを維持) */
async function refreshSheetList() {
  try {
    const body = await apiGet({ action: 'sheets' });
    lsSet(LS.sheets, body.sheets);
    fillSelect(body.sheets, els.select.value || lsGet(LS.lastSheet));
    return body.sheets;
  } catch (err) {
    console.error(err);
    return null;
  }
}

async function onSelectChange() {
  const name = els.select.value;
  if (!name) return;
  lsSet(LS.lastSheet, name);
  if (!renderFromCache(name)) {
    els.wrap.innerHTML = '';
    setStatus('読み込み中…', false);
  }
  await refreshSheet(name);
}

/* ============ 起動 ============ */

async function init() {
  els.select.addEventListener('change', onSelectChange);
  els.reload.addEventListener('click', () => {
    if (els.select.value) refreshSheet(els.select.value);
  });

  // 1. キャッシュから即座に画面を組む
  const cachedSheets = lsGet(LS.sheets);
  const lastSheet = lsGet(LS.lastSheet);

  if (cachedSheets && cachedSheets.length) {
    fillSelect(cachedSheets, lastSheet);
    if (els.select.value) renderFromCache(els.select.value);
  } else {
    setStatus('読み込み中…', false);
  }

  // 2. 裏で最新のシート一覧を取得
  const sheets = await refreshSheetList();

  // 3. 表示対象を決めてデータ取得
  const target = els.select.value
    || (sheets && sheets[0])
    || (cachedSheets && cachedSheets[0]);

  if (!target) {
    showMessage(
      'シート一覧を取得できませんでした。\n'
      + '通信できる状態で再度お試しください。'
    );
    setStatus('', false);
    return;
  }

  els.select.value = target;
  lsSet(LS.lastSheet, target);
  await refreshSheet(target);
}

// Service Worker 登録
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(console.error);
  });
}

init();
