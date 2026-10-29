'use strict';

const $ = (id) => document.getElementById(id);
const { h, icon } = GV.panel;
let status = null;
let ticker = null;
let dismissedJob = null;

const send = (msg) => chrome.runtime.sendMessage({ target: 'background', ...msg }).catch(() => {});

async function activeTabId() {
  const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
  return t && t.id >= 0 ? t.id : null;
}

// ---------- 見た目の準備 ----------

$('logo').innerHTML = GV.ICONS.wave;
$('settings').innerHTML = GV.ICONS.gear;
$('readIcon').innerHTML = GV.ICONS.speaker;
$('dictIcon').innerHTML = GV.ICONS.mic;

$('read').addEventListener('click', async () => send({ type: 'read', tabId: await activeTabId() }));
$('dict').addEventListener('click', async () => send({ type: 'dictate', tabId: await activeTabId() }));
$('settings').addEventListener('click', () => chrome.runtime.openOptionsPage());

// ---------- 状態の表示 ----------

function render() {
  clearInterval(ticker);
  const st = status;
  const busy = GV.isBusy(st);
  const show = !!st && st.state !== 'idle' && st.jobId !== dismissedJob;
  $('home').hidden = busy;
  $('panel').hidden = !show;
  if (!show) return;
  const r = GV.panel.render($('panel'), st, {
    send: (action, value) => send({ type: 'control', action, value }),
    copy: GV.copyText,
    dismiss: () => {
      dismissedJob = st.jobId;
      render();
    },
    level: true,
    showResult: true,
  });
  if (r.tick) ticker = setInterval(r.tick, 500);
}

// 録音中のマイクの音量
chrome.runtime.onMessage.addListener((m) => {
  if (!m || m.target !== 'ui' || m.type !== 'level') return;
  const bar = document.querySelector('#panel .level > i');
  if (bar) bar.style.width = Math.min(100, Math.round(Math.sqrt(m.value) * 160)) + '%';
});

// ---------- 履歴 ----------

function timeLabel(at) {
  const d = new Date(at);
  const now = new Date();
  const hm = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  return d.toDateString() === now.toDateString() ? `今日 ${hm}` : `${d.getMonth() + 1}/${d.getDate()} ${hm}`;
}

async function renderHistory() {
  const { history = [] } = await chrome.storage.local.get('history');
  const ul = $('history');
  ul.replaceChildren();
  $('historyEmpty').hidden = history.length > 0;
  for (const item of history.slice(0, 5)) {
    const copy = h('button', { title: 'コピー', 'aria-label': 'コピー' }, icon('copy'));
    copy.addEventListener('click', async () => {
      const ok = await GV.copyText(item.text);
      copy.replaceChildren(icon(ok ? 'check' : 'copy'));
      copy.classList.toggle('ok', ok);
      setTimeout(() => {
        copy.replaceChildren(icon('copy'));
        copy.classList.remove('ok');
      }, 1200);
    });
    ul.append(h('li', null, h('div', { class: 'ht' }, h('p', { title: item.text }, item.text), h('time', null, timeLabel(item.at))), copy));
  }
}

// ---------- 下の案内 ----------

async function renderFoot() {
  const s = { ...GV.DEFAULTS, ...(await chrome.storage.local.get(GV.DEFAULTS)) };
  const foot = $('foot');
  foot.replaceChildren();
  if (!s.apiKey) {
    const link = h('a', null, '設定を開く');
    link.addEventListener('click', () => chrome.runtime.openOptionsPage());
    const what = s.readEngine === 'local' ? '音声入力' : '音声入力とGeminiの声';
    foot.append(h('div', { class: 'warn' }, `APIキーが未設定のため、${what}は使えません。`, link));
  }
  foot.append(h('div', null, s.readEngine === 'local' ? '読み上げ：端末の声（APIキー不要）' : `読み上げ：Geminiの声（${s.voice}）`));

  const cmds = await chrome.commands.getAll();
  const key = (name) => (cmds.find((c) => c.name === name) || {}).shortcut || '';
  const rk = key('toggle-read');
  const dk = key('toggle-dictation');
  $('readKey').textContent = rk;
  $('readKey').hidden = !rk;
  $('dictKey').textContent = dk;
  $('dictKey').hidden = !dk;
}

// ---------- 起動 ----------

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'session' && changes.status) {
    status = changes.status.newValue || null;
    render();
  }
  if (area === 'local') {
    if (changes.history) renderHistory();
    if (changes.apiKey || changes.readEngine || changes.voice) renderFoot();
  }
});

(async () => {
  await send({ type: 'sync' });
  status = (await chrome.storage.session.get('status')).status || null;
  render();
  renderHistory();
  renderFoot();
})();
