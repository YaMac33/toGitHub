// 全体の司令塔。読み上げ・音声入力の開始と停止、状態の管理、ページへの文字の挿入を行う。
'use strict';
importScripts('lib.js');

// ページ側の小さな操作パネルが、状態を読めるようにする
try {
  chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' });
} catch (_) {}

const PAGE_FILES = ['lib.js', 'panel.js', 'content.js'];

// ---------- 状態 ----------

async function getSettings() {
  const s = await chrome.storage.local.get(GV.DEFAULTS);
  return { ...GV.DEFAULTS, ...s };
}
async function getJob() {
  const { job } = await chrome.storage.session.get('job');
  return job || null;
}
async function getStatus() {
  const { status } = await chrome.storage.session.get('status');
  return status || null;
}

async function beginJob(mode, engine, tabId) {
  const job = { id: Date.now() + Math.random().toString(36).slice(2, 6), mode, engine, tabId: tabId ?? null };
  await chrome.storage.session.set({ job });
  return job;
}
async function updateJob(patch) {
  const job = await getJob();
  if (job) await chrome.storage.session.set({ job: { ...job, ...patch } });
}

async function setStatus(partial) {
  const job = (await getJob()) || {};
  const status = {
    mode: job.mode,
    engine: job.engine,
    tabId: job.tabId ?? null,
    jobId: job.id,
    truncated: !!job.truncated,
    ...partial,
    at: Date.now(),
  };
  await chrome.storage.session.set({ status });
  updateBadge(status);
  return status;
}

function updateBadge(st) {
  const text = {
    loading: '…', waiting: '…', playing: '▶', paused: '❚❚',
    starting: '…', recording: '●', transcribing: '…', error: '!',
  }[st.state] || '';
  const red = st.state === 'recording' || st.state === 'error';
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color: red ? '#dc2626' : '#4f46e5' });
  if (chrome.action.setBadgeTextColor) chrome.action.setBadgeTextColor({ color: '#ffffff' });
}

// 状態だけが「動作中」のまま残っていたら（ブラウザの不具合などで）、待機中に戻す
async function currentStatus() {
  const st = await getStatus();
  if (!GV.isBusy(st)) return st;
  const job = await getJob();
  const alive = job && job.engine === 'local' && job.mode === 'read' ? Local.active : await hasOffscreen();
  return alive ? st : setStatus({ state: 'idle' });
}

// ---------- オフスクリーン文書（音声の再生・録音・APIの呼び出しを担当） ----------

async function hasOffscreen() {
  const c = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
  return c.length > 0;
}

let creating = null;
async function ensureOffscreen() {
  if (await hasOffscreen()) return;
  if (!creating) {
    creating = chrome.offscreen
      .createDocument({
        url: 'offscreen.html',
        reasons: ['AUDIO_PLAYBACK', 'USER_MEDIA', 'CLIPBOARD'],
        justification: 'Gemini APIで作った音声の再生、音声入力の録音、文字起こし結果のコピーのため',
      })
      .finally(() => (creating = null));
  }
  await creating;
}

async function closeOffscreen() {
  if (creating) await creating.catch(() => {});
  if (await hasOffscreen()) {
    try {
      await chrome.offscreen.closeDocument();
    } catch (_) {}
  }
}

async function toOffscreen(msg) {
  try {
    return await chrome.runtime.sendMessage({ target: 'offscreen', ...msg });
  } catch (_) {
    return null;
  }
}

// ---------- ページ側 ----------

async function prepareTab(tabId, s) {
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: PAGE_FILES });
    await callPage(tabId, 'setTab', tabId, !!s.showOverlay);
    return true;
  } catch (_) {
    return false; // ブラウザの設定画面やストアなど、拡張機能が入れないページ
  }
}

async function callPage(tabId, method, ...args) {
  const [r] = await chrome.scripting.executeScript({
    target: { tabId },
    func: (m, a) => (window.__gvPage ? window.__gvPage[m](...a) : null),
    args: [method, args],
  });
  return r ? r.result : null;
}

async function activeTabId() {
  const [t] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return t && t.id >= 0 ? t.id : null;
}

// ---------- 開始・停止 ----------

async function stopAll() {
  Local.stop();
  await closeOffscreen();
}

async function needKey() {
  await setStatus({ state: 'error', message: 'Gemini APIキーが未設定です。設定画面で入力してください。' });
  chrome.runtime.openOptionsPage();
}

async function startRead({ tabId = null, text = null } = {}) {
  const s = await getSettings();
  await stopAll();
  await beginJob('read', s.readEngine, tabId);
  if (s.readEngine === 'gemini' && !s.apiKey) return needKey();

  const pageOk = tabId != null && (await prepareTab(tabId, s));
  let truncated = false;
  if (text == null) {
    if (!pageOk) return setStatus({ state: 'error', message: 'このページでは使えません（ブラウザの設定画面やストアのページなど）。' });
    let r = null;
    try {
      r = await callPage(tabId, 'extract', GV.LIMITS.readChars);
    } catch (_) {}
    if (!r || !r.text || !r.text.trim()) return setStatus({ state: 'error', message: '読み上げる文章が見つかりませんでした。' });
    text = r.text;
    truncated = r.truncated;
  } else if (text.length > GV.LIMITS.readChars) {
    text = text.slice(0, GV.LIMITS.readChars);
    truncated = true;
  }
  await updateJob({ truncated });
  await setStatus({ state: 'loading', index: 0, total: 0, speed: s.speed });

  if (s.readEngine === 'local') return Local.start(text, s);

  await ensureOffscreen();
  const r = await toOffscreen({ type: 'read-start', text, settings: s });
  if (!r) await setStatus({ state: 'error', message: '再生の準備に失敗しました。もう一度お試しください。' });
}

async function startDictation(tabId) {
  const s = await getSettings();
  await stopAll();
  await beginJob('dict', 'gemini', tabId);
  if (!s.apiKey) return needKey();

  let hasTarget = false;
  if (tabId != null && (await prepareTab(tabId, s))) {
    try {
      hasTarget = !!(await callPage(tabId, 'mark'));
    } catch (_) {}
  }
  await updateJob({ hasTarget });
  await setStatus({ state: 'starting' });
  await ensureOffscreen();
  const r = await toOffscreen({ type: 'dict-start', settings: s, maxSeconds: GV.LIMITS.recordSeconds });
  if (!r) await setStatus({ state: 'error', message: '録音の準備に失敗しました。もう一度お試しください。' });
}

async function addHistory(text) {
  const { history = [] } = await chrome.storage.local.get('history');
  history.unshift({ text, at: Date.now() });
  await chrome.storage.local.set({ history: history.slice(0, GV.LIMITS.historyItems) });
}

async function finishDictation(st) {
  const s = await getSettings();
  const job = await getJob();
  let inserted = false;
  if (s.insert && job && job.tabId != null) {
    try {
      inserted = !!(await callPage(job.tabId, 'insert', st.text));
    } catch (_) {}
  }
  await addHistory(st.text);
  await setStatus({ ...st, inserted });
  await closeOffscreen();
}

async function handleStatus(st) {
  const job = await getJob();
  if (!job || st.mode !== job.mode) return; // 前の作業の、遅れて届いた知らせは無視
  if (st.mode === 'dict' && st.state === 'done') return finishDictation(st);
  await setStatus(st);
  if (['idle', 'done', 'error'].includes(st.state)) {
    await closeOffscreen();
    if (st.code === 'mic') chrome.tabs.create({ url: chrome.runtime.getURL('mic.html') });
  }
}

async function control(action, value) {
  const job = await getJob();
  const st = await currentStatus();
  if (!job || !GV.isBusy(st)) return;

  if (action === 'stop' || action === 'cancel') {
    await stopAll();
    await setStatus({ state: 'idle' });
    return;
  }

  if (job.mode === 'dict') {
    if (action === 'finish') {
      const r = await toOffscreen({ type: 'dict-stop' });
      if (!r) await setStatus({ state: 'idle' });
    }
    return;
  }

  if (action === 'speed') {
    value = Math.min(2, Math.max(0.5, Number(value) || 1));
    await chrome.storage.local.set({ speed: value });
  }
  if (job.engine === 'local') return Local.control(action, value);
  const r = await toOffscreen({ type: 'read-control', action, value });
  if (!r) await setStatus({ state: 'idle' });
}

// ---------- 端末の声（オフライン可）での読み上げ ----------

function getVoices() {
  return new Promise((resolve) => chrome.tts.getVoices((v) => resolve(v || [])));
}

async function pickLocalVoice(name) {
  const voices = await getVoices();
  if (name) {
    const v = voices.find((x) => x.voiceName === name);
    if (v) return v;
  }
  const ja = voices.filter((v) => (v.lang || '').toLowerCase().startsWith('ja'));
  return ja.find((v) => !v.remote) || ja[0] || voices.find((v) => !v.remote) || voices[0] || null;
}

const Local = {
  active: false,
  chunks: [],
  index: 0,
  token: 0,
  s: null,
  voice: null,
  paused: false,
  keepAlive: null,

  async start(text, s) {
    this.stop();
    const chunks = GV.splitText(GV.normalizeForSpeech(text), [200, 300]);
    if (!chunks.length) return setStatus({ state: 'error', message: '読み上げる文章が見つかりませんでした。' });
    const voice = await pickLocalVoice(s.localVoice);
    if (!voice) {
      return setStatus({
        state: 'error',
        message: 'この端末で使える読み上げの声が見つかりませんでした。OSの設定で日本語の音声を追加してください。',
      });
    }
    Object.assign(this, { active: true, chunks, s: { ...s }, voice });
    // 読み上げ中に、裏側の処理が眠ってしまわないようにする
    this.keepAlive = setInterval(() => chrome.runtime.getPlatformInfo(() => {}), 20000);
    this.speak(0);
  },

  report(state, extra = {}) {
    return setStatus({
      mode: 'read',
      engine: 'local',
      state,
      index: this.index,
      total: this.chunks.length,
      preview: (this.chunks[this.index] || '').slice(0, 140),
      speed: this.s ? this.s.speed : 1,
      ...extra,
    });
  },

  speak(i) {
    const t = ++this.token;
    this.index = i;
    this.paused = false;
    this.report('playing');
    chrome.tts.speak(
      this.chunks[i],
      {
        voiceName: this.voice.voiceName,
        lang: this.voice.lang,
        rate: this.s.speed,
        enqueue: false,
        onEvent: (e) => {
          if (t !== this.token || !this.active) return;
          if (e.type === 'end') {
            if (i + 1 < this.chunks.length) this.speak(i + 1);
            else this.finish();
          } else if (e.type === 'error') {
            this.fail(e.errorMessage);
          }
        },
      },
      () => {
        const err = chrome.runtime.lastError;
        if (err && t === this.token) this.fail(err.message);
      },
    );
  },

  control(action, value) {
    if (!this.active) return setStatus({ state: 'idle' });
    switch (action) {
      case 'pause':
        chrome.tts.pause();
        this.paused = true;
        this.report('paused');
        break;
      case 'resume':
        chrome.tts.resume();
        this.paused = false;
        this.report('playing');
        break;
      case 'next':
        if (this.index + 1 < this.chunks.length) this.speak(this.index + 1);
        else this.finish();
        break;
      case 'prev':
        this.speak(Math.max(0, this.index - 1));
        break;
      case 'speed':
        this.s.speed = value;
        this.speak(this.index); // 端末の声は途中で速さを変えられないので、段落の頭から読み直す
        break;
    }
  },

  stop() {
    if (!this.active) return;
    this.active = false;
    this.token++;
    clearInterval(this.keepAlive);
    chrome.tts.stop();
    this.chunks = [];
  },

  finish() {
    this.stop();
    setStatus({ state: 'done' });
  },

  fail(message) {
    const remote = this.voice && this.voice.remote;
    this.stop();
    setStatus({
      state: 'error',
      message:
        '読み上げでエラーが起きました' + (message ? `：${message}` : '。') +
        (remote ? '（選んだ声はネット接続が必要です。オフラインなら、設定で別の声を選んでください）' : ''),
    });
  },
};

// ---------- イベント ----------

// 処理が重ならないよう、届いた順に1つずつ実行する
let queue = Promise.resolve();
function run(fn) {
  const p = queue.then(fn).catch((e) => console.error('[Gemini ボイス]', e));
  queue = p;
  return p;
}

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (!msg || msg.target !== 'background') return;
  run(async () => {
    switch (msg.type) {
      case 'read':
        return startRead({ tabId: msg.tabId ?? null });
      case 'dictate':
        return startDictation(msg.tabId ?? null);
      case 'preview':
        return startRead({ text: msg.text });
      case 'control':
        return control(msg.action, msg.value);
      case 'status':
        return handleStatus(msg.status);
      case 'sync':
        return currentStatus();
    }
  }).finally(() => {
    try {
      reply({ ok: true });
    } catch (_) {}
  });
  return true;
});

chrome.commands.onCommand.addListener((command, tab) =>
  run(async () => {
    const st = await currentStatus();
    const tabId = tab && tab.id >= 0 ? tab.id : await activeTabId();
    if (command === 'toggle-read') {
      if (st && st.mode === 'read' && GV.isBusy(st)) return control('stop');
      return startRead({ tabId });
    }
    if (command === 'toggle-dictation') {
      if (st && st.mode === 'dict') {
        if (st.state === 'recording') return control('finish');
        if (GV.isBusy(st)) return; // 準備中・文字起こし中は何もしない
      }
      return startDictation(tabId);
    }
  }),
);

chrome.runtime.onInstalled.addListener((details) => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: 'read-page', title: 'このページを読み上げ', contexts: ['page'] });
    chrome.contextMenus.create({ id: 'read-selection', title: '選択した文章を読み上げ', contexts: ['selection'] });
    chrome.contextMenus.create({ id: 'dictate', title: 'ここに音声入力', contexts: ['editable'] });
  });
  if (details.reason === 'install') {
    chrome.runtime.openOptionsPage().catch(() => chrome.tabs.create({ url: chrome.runtime.getURL('options.html') }));
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) =>
  run(async () => {
    const tabId = tab && tab.id >= 0 ? tab.id : null;
    if (info.menuItemId === 'read-page') return startRead({ tabId });
    if (info.menuItemId === 'read-selection') return startRead({ tabId, text: info.selectionText || '' });
    if (info.menuItemId === 'dictate') return startDictation(tabId);
  }),
);
