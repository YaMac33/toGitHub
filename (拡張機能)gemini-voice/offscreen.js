// 画面に出ない裏側のページ。Gemini APIの呼び出し、音声の再生、録音を担当する。
// （ポップアップは閉じると止まってしまうため、長く続く処理はここで行う）
'use strict';

const MAX_BASE64 = 19 * 1024 * 1024; // 1回のリクエスト上限（20MB）に収める

function send(status) {
  chrome.runtime.sendMessage({ target: 'background', type: 'status', status }).catch(() => {});
}

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (!msg || msg.target !== 'offscreen') return;
  reply({ ok: true });
  switch (msg.type) {
    case 'read-start':
      Reader.start(msg.text, msg.settings);
      break;
    case 'read-control':
      Reader.control(msg.action, msg.value);
      break;
    case 'dict-start':
      Recorder.start(msg.settings, msg.maxSeconds);
      break;
    case 'dict-stop':
      Recorder.stop(false);
      break;
    case 'dict-cancel':
      Recorder.stop(true);
      break;
  }
});

// ---------- Gemini API ----------

const abortError = () => new DOMException('Aborted', 'AbortError');

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal && signal.aborted) return reject(abortError());
    const t = setTimeout(resolve, ms);
    if (signal) {
      signal.addEventListener('abort', () => {
        clearTimeout(t);
        reject(abortError());
      }, { once: true });
    }
  });
}

// 混み合い（429）や一時的なエラーのときは、待ってから数回やり直す
async function callApi(body, apiKey, signal, onWait) {
  for (let attempt = 0; ; attempt++) {
    let res;
    try {
      res = await fetch(`${GV.API_BASE}/interactions`, {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(body),
      });
    } catch (e) {
      if (e && e.name === 'AbortError') throw e;
      throw new Error('Geminiに接続できませんでした。ネット接続やプロキシの設定を確認してください。');
    }
    if (res.ok) return res.json();

    const err = await GV.readApiError(res);
    const retryable = [429, 500, 502, 503, 504].includes(err.status);
    const daily = err.status === 429 && /per ?day|daily/i.test(err.message);
    if (!retryable || daily || attempt >= 3) throw new Error(GV.describeApiError(err));
    const wait = Math.min(err.retryMs || 2000 * 2 ** attempt, 60000);
    if (onWait) onWait(wait);
    await sleep(wait, signal);
  }
}

// ---------- 読み上げ（Geminiの声） ----------

const Reader = {
  active: false,
  token: 0,
  chunks: [],
  index: 0,
  loadedIndex: -1,
  s: null,
  audio: null,
  url: null,
  cache: new Map(), // 段落番号 → 音声ファイルを待つPromise
  ready: new Set(), // 音声が届いた段落番号
  chain: Promise.resolve(), // APIを1件ずつ順番に呼ぶための列
  abort: null,
  paused: false,

  start(text, s) {
    this.stop();
    const chunks = GV.splitText(GV.normalizeForSpeech(text), [120, 400, 1000]);
    if (!chunks.length) {
      send({ mode: 'read', state: 'error', message: '読み上げる文章が見つかりませんでした。' });
      return;
    }
    this.active = true;
    this.chunks = chunks;
    this.s = { ...s };
    this.abort = new AbortController();

    const a = new Audio();
    a.preservesPitch = true; // 速さを変えても声の高さを変えない
    a.addEventListener('ended', () => this.onEnded());
    a.addEventListener('error', () => {
      if (this.active && this.loadedIndex === this.index) this.fail(new Error('音声を再生できませんでした。'));
    });
    this.audio = a;
    this.play(0);
  },

  report(state, extra = {}) {
    if (!this.active) return;
    send({
      mode: 'read',
      engine: 'gemini',
      state,
      index: this.index,
      total: this.chunks.length,
      preview: (this.chunks[this.index] || '').slice(0, 140),
      speed: this.s.speed,
      ...extra,
    });
  },

  get(i) {
    if (!this.active || i < 0 || i >= this.chunks.length) return null;
    const have = this.cache.get(i);
    if (have) return have;
    const signal = this.abort.signal;
    const p = this.chain.then(() => {
      if (signal.aborted) throw abortError();
      return this.fetchChunk(i, signal);
    });
    this.chain = p.catch(() => {});
    this.cache.set(i, p);
    p.then(
      () => this.cache.get(i) === p && this.ready.add(i),
      () => this.cache.get(i) === p && this.cache.delete(i),
    );
    return p;
  },

  async fetchChunk(i, signal) {
    const s = this.s;
    const content = { type: 'text', text: this.chunks[i] };
    if (s.style) content.annotations = [{ type: 'speech_metadata', style: s.style }];
    const body = {
      model: s.ttsModel,
      input: [{ type: 'user_input', content: [content] }],
      response_format: { type: 'audio' },
      generation_config: { speech_config: [{ voice: s.voice }] },
    };
    const json = await callApi(body, s.apiKey, signal, (ms) => {
      if (this.index === i && this.loadedIndex !== i) {
        this.report('waiting', { message: `混み合っているため、${Math.ceil(ms / 1000)}秒待ってから再試行します…` });
      }
    });
    const audio = GV.findAudio(json);
    if (!audio) throw new Error('音声データが返ってきませんでした。設定のモデル名を確認してください。');
    return GV.audioBlob(audio.data, audio.mime);
  },

  // 今の段落の前後だけを手元に残し、それ以外は捨てる（メモリの節約）
  prune() {
    for (const k of [...this.cache.keys()]) {
      if (k < this.index - 1 || k > this.index + 2) {
        this.cache.delete(k);
        this.ready.delete(k);
      }
    }
  },

  async play(i) {
    if (!this.active) return;
    const t = ++this.token;
    this.index = i;
    this.paused = false;
    this.audio.pause();
    this.prune();
    const p = this.get(i);
    this.get(i + 1); // 次の段落も先に作り始める
    if (!this.ready.has(i)) this.report('loading');

    let blob;
    try {
      blob = await p;
    } catch (e) {
      if (t === this.token && this.active) this.fail(e);
      return;
    }
    if (t !== this.token || !this.active) return;

    if (this.url) URL.revokeObjectURL(this.url);
    this.url = URL.createObjectURL(blob);
    const a = this.audio;
    a.src = this.url;
    a.defaultPlaybackRate = a.playbackRate = this.s.speed;
    this.loadedIndex = i;
    if (this.paused) {
      this.report('paused');
      return;
    }
    try {
      await a.play();
    } catch (e) {
      if (t === this.token && this.active && !(e && e.name === 'AbortError')) this.fail(e);
      return;
    }
    if (t !== this.token || !this.active) return;
    this.report('playing');
    this.get(i + 2);
  },

  onEnded() {
    if (!this.active || this.paused) return;
    if (this.index + 1 < this.chunks.length) this.play(this.index + 1);
    else this.finish();
  },

  control(action, value) {
    if (!this.active) {
      send({ mode: 'read', state: 'idle' });
      return;
    }
    const a = this.audio;
    const loaded = this.loadedIndex === this.index;
    switch (action) {
      case 'pause':
        this.paused = true;
        a.pause();
        this.report('paused');
        break;
      case 'resume':
        this.paused = false;
        if (loaded) {
          a.play().catch(() => {});
          this.report('playing');
        } else {
          this.report('loading');
        }
        break;
      case 'next':
        if (this.index + 1 < this.chunks.length) this.play(this.index + 1);
        else this.finish();
        break;
      case 'prev':
        if (loaded && a.currentTime > 3) {
          a.currentTime = 0; // 段落の途中なら、まずその段落の頭へ
          if (this.paused) this.control('resume');
        } else {
          this.play(Math.max(0, this.index - 1));
        }
        break;
      case 'speed':
        this.s.speed = Number(value) || 1;
        a.defaultPlaybackRate = a.playbackRate = this.s.speed;
        this.report(this.paused ? 'paused' : loaded ? 'playing' : 'loading');
        break;
    }
  },

  stop() {
    this.active = false;
    this.token++;
    if (this.abort) this.abort.abort();
    if (this.audio) {
      this.audio.pause();
      this.audio.removeAttribute('src');
      this.audio.load();
    }
    if (this.url) URL.revokeObjectURL(this.url);
    this.url = null;
    this.audio = null;
    this.cache.clear();
    this.ready.clear();
    this.chain = Promise.resolve();
    this.loadedIndex = -1;
    this.paused = false;
  },

  finish() {
    this.stop();
    send({ mode: 'read', state: 'done' });
  },

  fail(e) {
    this.stop();
    send({ mode: 'read', state: 'error', message: String((e && e.message) || e) });
  },
};

// ---------- 音声入力（録音と文字起こし） ----------

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(new Error('録音データの変換に失敗しました。'));
    r.readAsDataURL(blob);
  });
}

function copyToClipboard(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch (_) {}
  ta.remove();
  return ok;
}

const Recorder = {
  active: false,
  rec: null,
  stream: null,
  parts: [],
  s: null,
  timer: null,
  startedAt: 0,
  cancelled: false,
  mime: 'audio/webm',
  ctx: null,
  meter: null,
  peak: 0,
  meterOk: false,
  abort: null,

  async start(s, maxSeconds) {
    if (this.active) return;
    Object.assign(this, { active: true, s, cancelled: false, parts: [], peak: 0, meterOk: false, abort: null });

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (e) {
      this.active = false;
      const name = e && e.name;
      const denied = name === 'NotAllowedError' || name === 'SecurityError';
      send({
        mode: 'dict',
        state: 'error',
        code: denied ? 'mic' : '',
        message: denied
          ? 'マイクの使用が許可されていません。開いたタブで許可してから、もう一度お試しください。'
          : name === 'NotFoundError'
            ? 'マイクが見つかりませんでした。接続を確認してください。'
            : 'マイクを使えませんでした：' + ((e && e.message) || e),
      });
      return;
    }
    if (!this.active) {
      stream.getTracks().forEach((t) => t.stop()); // 準備中にキャンセルされた
      return;
    }
    this.stream = stream;
    this.startMeter(stream);

    const type = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm'].find((t) => MediaRecorder.isTypeSupported(t)) || '';
    const rec = new MediaRecorder(stream, type ? { mimeType: type, audioBitsPerSecond: 48000 } : {});
    this.mime = (rec.mimeType || type || 'audio/webm').split(';')[0];
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size) this.parts.push(e.data);
    };
    rec.onstop = () => this.onStopped();
    this.rec = rec;
    rec.start(1000);
    this.startedAt = Date.now();
    this.timer = setTimeout(() => this.stop(false), maxSeconds * 1000);
    send({ mode: 'dict', state: 'recording', startedAt: this.startedAt, maxSeconds });
  },

  // マイクの音量を測る（画面のメーター表示と、無音の検出に使う）
  async startMeter(stream) {
    try {
      const ctx = new AudioContext();
      const an = ctx.createAnalyser();
      an.fftSize = 1024;
      ctx.createMediaStreamSource(stream).connect(an);
      this.ctx = ctx;
      await ctx.resume().catch(() => {});
      this.meterOk = ctx.state === 'running';
      const buf = new Float32Array(an.fftSize);
      this.meter = setInterval(() => {
        an.getFloatTimeDomainData(buf);
        let sum = 0;
        for (const v of buf) sum += v * v;
        const rms = Math.sqrt(sum / buf.length);
        if (rms > this.peak) this.peak = rms;
        chrome.runtime.sendMessage({ target: 'ui', type: 'level', value: rms }).catch(() => {});
      }, 100);
    } catch (_) {
      this.meterOk = false;
    }
  },

  stop(cancel) {
    if (!this.active) {
      send({ mode: 'dict', state: 'idle' });
      return;
    }
    if (cancel) {
      this.cancelled = true;
      if (this.abort) this.abort.abort();
    }
    if (this.rec && this.rec.state !== 'inactive') {
      clearTimeout(this.timer);
      this.rec.stop(); // 続きは onStopped で
      return;
    }
    if (cancel && !this.rec && !this.abort) {
      this.active = false; // マイクの準備中にキャンセルされた
      this.cleanup();
      send({ mode: 'dict', state: 'idle' });
    }
  },

  cleanup() {
    clearTimeout(this.timer);
    clearInterval(this.meter);
    this.meter = null;
    if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
    if (this.ctx) this.ctx.close().catch(() => {});
    this.stream = null;
    this.ctx = null;
  },

  async onStopped() {
    this.rec = null;
    this.cleanup();
    const seconds = (Date.now() - this.startedAt) / 1000;
    const parts = this.parts;
    this.parts = [];
    const end = (st) => {
      this.active = false;
      if (!this.cancelled) send({ mode: 'dict', ...st });
    };

    if (this.cancelled) {
      this.active = false;
      send({ mode: 'dict', state: 'idle' });
      return;
    }
    if (seconds < 0.8) return end({ state: 'error', message: '録音が短すぎます。もう少し長く話してください。' });
    if (this.meterOk && this.peak < 0.004) {
      return end({ state: 'error', message: '音が入っていませんでした。マイクが正しく選ばれているか、ミュートになっていないか確認してください。' });
    }

    send({ mode: 'dict', state: 'transcribing', seconds });
    this.abort = new AbortController();
    try {
      const b64 = await blobToBase64(new Blob(parts, { type: this.mime }));
      if (b64.length > MAX_BASE64) throw new Error('録音が長すぎて、一度に送れません。');
      const s = this.s;
      const body = {
        model: s.sttModel,
        input: [
          { type: 'text', text: GV.buildPrompt(s) },
          { type: 'audio', data: b64, mime_type: this.mime },
        ],
      };
      const json = await callApi(body, s.apiKey, this.abort.signal, (ms) => {
        send({ mode: 'dict', state: 'transcribing', message: `混み合っているため、${Math.ceil(ms / 1000)}秒待ってから再試行します…` });
      });
      const text = GV.cleanTranscript(GV.findText(json));
      if (!text) throw new Error('声を聞き取れませんでした。もう一度お試しください。');
      const copied = s.copy ? copyToClipboard(text) : false;
      end({ state: 'done', text, copied, seconds });
    } catch (e) {
      if (this.cancelled || (e && e.name === 'AbortError')) {
        this.active = false;
        return;
      }
      end({ state: 'error', message: String((e && e.message) || e) });
    }
  },
};
