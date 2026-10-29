'use strict';

const $ = (id) => document.getElementById(id);
const D = GV.DEFAULTS;
const TEXTS = ['apiKey', 'ttsModel', 'style', 'sttModel', 'glossary'];
const SELECTS = ['voice', 'localVoice', 'lang', 'finish'];
const CHECKS = ['insert', 'copy', 'showOverlay'];

$('logo').innerHTML = GV.ICONS.wave;

// ---------- 保存 ----------

let toastTimer;
function toast(text, error) {
  const t = $('toast');
  t.textContent = text;
  t.classList.toggle('error', !!error);
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1600);
}

function collect() {
  const s = {};
  for (const k of TEXTS) s[k] = $(k).value.trim();
  for (const k of SELECTS) s[k] = $(k).value;
  for (const k of CHECKS) s[k] = $(k).checked;
  s.readEngine = (document.querySelector('input[name=readEngine]:checked') || {}).value || D.readEngine;
  s.speed = Number($('speed').value) || 1;
  if (!s.ttsModel) s.ttsModel = D.ttsModel;
  if (!s.sttModel) s.sttModel = D.sttModel;
  return s;
}

async function save(quiet) {
  await chrome.storage.local.set(collect());
  if (!quiet) toast('保存しました');
}

let saveTimer;
function saveSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => save(), 500);
}

// ---------- 読み込み ----------

function rankVoice(v) {
  const ja = (v.lang || '').toLowerCase().startsWith('ja');
  return (ja ? 0 : 2) + (v.remote ? 1 : 0);
}

async function loadLocalVoices(selected) {
  const voices = await new Promise((r) => chrome.tts.getVoices((v) => r(v || [])));
  voices.sort((a, b) => rankVoice(a) - rankVoice(b) || a.voiceName.localeCompare(b.voiceName));
  const sel = $('localVoice');
  sel.replaceChildren(new Option('自動（日本語の声を自動で選ぶ）', ''));
  for (const v of voices) {
    sel.add(new Option(`${v.voiceName}（${v.lang || '言語不明'}）${v.remote ? '　※ネット接続が必要' : ''}`, v.voiceName));
  }
  sel.value = voices.some((v) => v.voiceName === selected) ? selected : '';
  const jaLocal = voices.filter((v) => rankVoice(v) === 0).length;
  $('localVoiceNote').textContent = !voices.length
    ? 'この端末では、使える声が見つかりませんでした。'
    : jaLocal
      ? `この端末には、オフラインで使える日本語の声が ${jaLocal} 種類あります。`
      : 'オフラインで使える日本語の声が見つかりません。OSの設定で日本語の音声を追加すると使えるようになります。';
}

function showEngine() {
  const local = (document.querySelector('input[name=readEngine]:checked') || {}).value === 'local';
  $('geminiFields').hidden = local;
  $('localFields').hidden = !local;
}

async function load() {
  for (const [name, desc] of GV.VOICES) $('voice').add(new Option(`${name}（${desc}）`, name));
  const s = { ...D, ...(await chrome.storage.local.get(D)) };
  for (const k of TEXTS) $(k).value = s[k];
  for (const k of ['voice', 'lang', 'finish']) $(k).value = s[k];
  for (const k of CHECKS) $(k).checked = !!s[k];
  const radio = document.querySelector(`input[name=readEngine][value="${s.readEngine}"]`);
  if (radio) radio.checked = true;
  $('speed').value = s.speed;
  $('speedVal').textContent = Number(s.speed).toFixed(1) + 'x';
  showEngine();
  await loadLocalVoices(s.localVoice);
  loadShortcuts();
  loadHistoryCount();
  loadMicState();
}

// ---------- 入力の反映 ----------

for (const k of TEXTS) $(k).addEventListener('input', saveSoon);
for (const k of [...SELECTS, ...CHECKS]) $(k).addEventListener('change', () => save());
for (const r of document.querySelectorAll('input[name=readEngine]')) {
  r.addEventListener('change', () => {
    showEngine();
    save();
  });
}
$('speed').addEventListener('input', () => {
  $('speedVal').textContent = Number($('speed').value).toFixed(1) + 'x';
  saveSoon();
});

// ---------- APIキー ----------

function keyStatus(text, kind) {
  const el = $('keyStatus');
  el.textContent = text;
  el.className = 'status' + (kind ? ' ' + kind : '');
}

$('toggleKey').addEventListener('click', () => {
  const show = $('apiKey').type === 'password';
  $('apiKey').type = show ? 'text' : 'password';
  $('toggleKey').textContent = show ? '隠す' : '表示';
});

$('testKey').addEventListener('click', async () => {
  const key = $('apiKey').value.trim();
  if (!key) return keyStatus('APIキーを入力してください。', 'ng');
  await save(true);
  keyStatus('確認しています…');
  try {
    const res = await fetch(`${GV.API_BASE}/models?pageSize=1`, { headers: { 'x-goog-api-key': key } });
    if (res.ok) keyStatus('接続できました。このキーは使えます。', 'ok');
    else keyStatus(GV.describeApiError(await GV.readApiError(res)), 'ng');
  } catch (_) {
    keyStatus('Geminiに接続できませんでした。ネット接続やプロキシの設定を確認してください。', 'ng');
  }
});

// ---------- 試聴 ----------

$('preview').addEventListener('click', async () => {
  await save(true);
  $('previewStatus').className = 'status';
  $('previewStatus').textContent = '準備しています…';
  chrome.runtime.sendMessage({
    target: 'background',
    type: 'preview',
    text: 'こんにちは。Gemini ボイスの読み上げテストです。この声と速さで、ページを読み上げます。',
  });
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.history) loadHistoryCount();
  if (area !== 'session' || !changes.status) return;
  const st = changes.status.newValue;
  if (!st || st.mode !== 'read' || st.tabId != null) return; // 試聴（ページなし）の状態だけ見る
  const el = $('previewStatus');
  const text = { loading: '準備しています…', waiting: st.message, playing: '再生中…', paused: '一時停止中', done: '再生しました', idle: '' }[st.state];
  el.className = 'status' + (st.state === 'error' ? ' ng' : st.state === 'done' ? ' ok' : '');
  el.textContent = st.state === 'error' ? st.message : text || '';
});

// ---------- マイク ----------

async function loadMicState() {
  const el = $('micState');
  try {
    const p = await navigator.permissions.query({ name: 'microphone' });
    const show = () => {
      el.textContent = { granted: '許可済み', denied: 'ブロックされています', prompt: 'まだ許可されていません' }[p.state] || p.state;
      el.style.color = p.state === 'granted' ? 'var(--ok)' : p.state === 'denied' ? 'var(--ng)' : '';
      $('mic').hidden = p.state === 'granted';
    };
    show();
    p.onchange = show;
  } catch (_) {
    el.textContent = '確認できませんでした';
  }
}

$('mic').addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('mic.html') }));

// ---------- ショートカット・履歴 ----------

async function loadShortcuts() {
  const cmds = await chrome.commands.getAll();
  const ul = $('keys');
  ul.replaceChildren();
  for (const c of cmds) {
    if (!c.description) continue;
    const li = document.createElement('li');
    const name = document.createElement('span');
    name.textContent = c.description;
    const key = document.createElement(c.shortcut ? 'kbd' : 'span');
    key.textContent = c.shortcut || '未設定';
    if (!c.shortcut) key.className = 'muted';
    li.append(name, key);
    ul.append(li);
  }
}

$('shortcuts').addEventListener('click', () => {
  const scheme = navigator.userAgent.includes('Edg/') ? 'edge' : 'chrome';
  chrome.tabs.create({ url: `${scheme}://extensions/shortcuts` });
});

async function loadHistoryCount() {
  const { history = [] } = await chrome.storage.local.get('history');
  $('historyCount').textContent = history.length ? `${history.length} 件（最大 ${GV.LIMITS.historyItems} 件まで保存）` : '履歴はありません';
  $('clearHistory').hidden = !history.length;
}

$('clearHistory').addEventListener('click', async () => {
  await chrome.storage.local.remove('history');
  toast('履歴を消しました');
});

load();
