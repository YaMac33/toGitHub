// 共通の設定と、画面に依存しない処理をまとめたファイル。
// background・offscreen・ポップアップ・設定画面・ページ側のすべてから読み込む。
// 同じページに何度読み込まれても壊れないよう、全体を関数で包んでいる。
(function () {
  'use strict';

  const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

  const DEFAULTS = {
    apiKey: '',
    // 読み上げ
    readEngine: 'gemini', // 'gemini'（Geminiの声） | 'local'（端末の声）
    ttsModel: 'gemini-3.8-flash-lite-tts',
    voice: 'Kore',
    style: '',
    localVoice: '',
    speed: 1.0,
    // 音声入力
    sttModel: 'gemini-3.8-flash',
    lang: '',
    finish: 'clean', // verbatim | clean | bullets | formal
    glossary: '',
    insert: true,
    copy: true,
    // 表示
    showOverlay: true,
  };

  const LIMITS = {
    readChars: 30000, // 1回に読み上げる最大文字数
    recordSeconds: 20 * 60, // 1回の録音の上限
    historyItems: 20, // 音声入力の履歴の保存件数
  };

  // Gemini の声（名前と、公式の説明を訳したもの）
  const VOICES = [
    ['Kore', 'きっぱり'], ['Puck', '弾む'], ['Charon', '知的'], ['Zephyr', '明るい'],
    ['Fenrir', '興奮気味'], ['Leda', '若々しい'], ['Orus', 'きっぱり'], ['Aoede', '軽やか'],
    ['Callirrhoe', '気さく'], ['Autonoe', '明るい'], ['Enceladus', '息まじり'], ['Iapetus', '澄んだ'],
    ['Umbriel', '気さく'], ['Algieba', 'なめらか'], ['Despina', 'なめらか'], ['Erinome', '澄んだ'],
    ['Algenib', 'しゃがれ声'], ['Rasalgethi', '知的'], ['Laomedeia', '弾む'], ['Achernar', 'やわらか'],
    ['Alnilam', 'きっぱり'], ['Schedar', '落ち着いた'], ['Gacrux', '大人っぽい'], ['Pulcherrima', '前向き'],
    ['Achird', '親しみやすい'], ['Zubenelgenubi', 'くだけた'], ['Vindemiatrix', 'やさしい'],
    ['Sadachbia', '生き生き'], ['Sadaltager', '物知り'], ['Sulafat', 'あたたかい'],
  ];

  const BUSY = {
    read: ['loading', 'waiting', 'playing', 'paused'],
    dict: ['starting', 'recording', 'transcribing'],
  };
  const isBusy = (st) => !!st && (BUSY[st.mode] || []).includes(st.state);

  // ---------- 読み上げ用の文章の下ごしらえ ----------

  function normalizeForSpeech(text) {
    return String(text || '')
      .replace(/https?:\/\/[^\s<>"'）」』]+/g, 'リンク')
      .replace(/[-─━=＝_＿*＊#＃~～]{3,}/g, ' ')
      .replace(/[​-‍﻿]/g, '');
  }

  // 長文を、読み上げAPIに渡しやすい長さの塊に分ける。
  // sizes は「1個目の上限、2個目の上限、…」。最初を短くして、再生開始までの待ちを減らす。
  function splitText(text, sizes) {
    const sz = sizes && sizes.length ? sizes : [120, 400, 1000];
    const maxLen = Math.max(...sz);
    const lines = String(text || '')
      .replace(/\r/g, '')
      .replace(/[ \t　 ]+/g, ' ')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    // 文の単位に分ける（日本語は「。」など、英語は「. 」など）
    const pieces = [];
    for (const line of lines) {
      let first = true;
      for (const part of line.split(/(?<=[.!?;:])\s+/)) {
        const sentences = part.match(/[^。．！？]+[。．！？]*[」』）)”"]*|[。．！？]+[」』）)”"]*/g) || [];
        for (const s0 of sentences) {
          const s = s0.trim();
          if (!s) continue;
          pieces.push({ text: s, nl: first });
          first = false;
        }
      }
    }

    const chunks = [];
    let cur = '';
    const limit = () => sz[Math.min(chunks.length, sz.length - 1)];
    const flush = () => {
      if (cur) chunks.push(cur);
      cur = '';
    };
    for (const p of pieces) {
      if (p.text.length > maxLen) {
        flush();
        chunks.push(...hardSplit(p.text, maxLen));
        continue;
      }
      if (cur && cur.length + p.text.length + 1 > limit()) flush();
      let sep = '';
      if (cur) {
        if (p.nl) sep = '\n';
        else if (/[\x21-\x7e]$/.test(cur) && /^[\x21-\x7e]/.test(p.text)) sep = ' ';
      }
      cur += sep + p.text;
    }
    flush();
    return chunks;
  }

  // 1文が長すぎるときに、読点やカンマの位置を探して切る。
  function hardSplit(s, max) {
    const out = [];
    let rest = s;
    while (rest.length > max) {
      const head = rest.slice(0, max);
      let cut = -1;
      for (const mark of ['、', '，', ', ', '；', '; ', ' ']) {
        const i = head.lastIndexOf(mark);
        if (i > max * 0.5) cut = Math.max(cut, i + mark.length);
      }
      if (cut < 0) cut = max;
      out.push(rest.slice(0, cut).trim());
      rest = rest.slice(cut);
    }
    if (rest.trim()) out.push(rest.trim());
    return out.filter(Boolean);
  }

  // ---------- 文字起こしの指示文 ----------

  function buildPrompt(opts) {
    const o = { ...DEFAULTS, ...(opts || {}) };
    const L = ['添付の音声を、正確に文字にしてください。'];
    if (o.lang === 'ja') L.push('- 音声は主に日本語です');
    if (o.lang === 'en') L.push('- 音声は主に英語です');
    L.push('- 話された言語のまま書く（翻訳しない）');
    switch (o.finish) {
      case 'verbatim':
        L.push('- 言い淀みや言い直しも含め、聞こえた通りに書く');
        L.push('- 句読点は自然に入れる');
        break;
      case 'bullets':
        L.push('- 話の要点を、短い箇条書き（各行を「・」で始める）にまとめる');
        L.push('- 話されていない内容は足さない');
        break;
      case 'formal':
        L.push('- ビジネス文書として自然な、です・ます調の文章に整える');
        L.push('- 意味は変えず、話されていない内容は足さない');
        break;
      default:
        L.push('- 「えー」「あのー」などの言い淀みと、言い直しによる重複は取り除く');
        L.push('- 句読点と、話題の切れ目での改行を入れて読みやすくする');
        L.push('- それ以外の言い回しや内容は変えない');
    }
    const words = String(o.glossary || '')
      .split(/[\n,、]+/)
      .map((w) => w.trim())
      .filter(Boolean)
      .slice(0, 100);
    if (words.length) L.push('- 次の言葉が出てきたら、この表記で書く：' + words.join('、'));
    L.push('- 結果の本文だけを出力し、前置き・説明・引用符は付けない');
    L.push('- 聞き取れる話し声がない場合は、何も出力しない');
    return L.join('\n');
  }

  function cleanTranscript(text) {
    return String(text || '')
      .replace(/^\s*```[a-z]*\s*\n?/i, '')
      .replace(/\n?```\s*$/, '')
      .trim();
  }

  // ---------- APIの応答の読み取り ----------

  function findText(json) {
    if (!json) return '';
    if (typeof json.output_text === 'string' && json.output_text.trim()) return json.output_text.trim();
    const parts = [];
    for (const step of json.steps || []) {
      if (step.type !== 'model_output') continue;
      for (const c of step.content || []) {
        if (c.type === 'text' && typeof c.text === 'string') parts.push(c.text);
      }
    }
    return parts.join('').trim();
  }

  function findAudio(json) {
    if (!json) return null;
    let found = null;
    for (const step of json.steps || []) {
      if (step.type !== 'model_output') continue;
      for (const c of step.content || []) {
        if (c.type === 'audio' && c.data) found = { data: c.data, mime: c.mime_type || '' };
      }
    }
    if (!found && json.output_audio && json.output_audio.data) {
      found = { data: json.output_audio.data, mime: json.output_audio.mime_type || '' };
    }
    return found;
  }

  function b64ToBytes(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  // 生のPCM（16bit・モノラル）に、WAVのヘッダーを付ける
  function pcmToWav(pcm, rate) {
    const header = new ArrayBuffer(44);
    const v = new DataView(header);
    const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
    w(0, 'RIFF');
    v.setUint32(4, 36 + pcm.length, true);
    w(8, 'WAVE');
    w(12, 'fmt ');
    v.setUint32(16, 16, true);
    v.setUint16(20, 1, true);
    v.setUint16(22, 1, true);
    v.setUint32(24, rate, true);
    v.setUint32(28, rate * 2, true);
    v.setUint16(32, 2, true);
    v.setUint16(34, 16, true);
    w(36, 'data');
    v.setUint32(40, pcm.length, true);
    return new Blob([header, pcm], { type: 'audio/wav' });
  }

  // APIから返ってきた音声（base64）を、再生できるファイルにする
  function audioBlob(b64, mime) {
    const bytes = b64ToBytes(b64);
    const m = String(mime || '').toLowerCase();
    const head = String.fromCharCode(...bytes.slice(0, 4));
    if (head === 'RIFF') return new Blob([bytes], { type: 'audio/wav' });
    if (/mpeg|mp3|ogg|opus|webm|aac|flac/.test(m)) return new Blob([bytes], { type: m.split(';')[0] });
    const rate = Number((m.match(/rate=(\d+)/) || [])[1]) || 24000;
    return pcmToWav(bytes, rate);
  }

  async function readApiError(res) {
    let message = '';
    let retryMs = 0;
    try {
      const j = await res.json();
      const e = j.error || j;
      message = e.message || JSON.stringify(j).slice(0, 200);
      for (const d of e.details || []) {
        if (d.retryDelay) retryMs = Math.round(parseFloat(d.retryDelay) * 1000) || 0;
      }
    } catch (_) {
      message = res.statusText || '';
    }
    return { status: res.status, message, retryMs };
  }

  function describeApiError(e) {
    const s = e.status;
    const m = e.message || '';
    let head;
    if (s === 400 && /api key/i.test(m)) head = 'APIキーが正しくありません。設定を確認してください。';
    else if (s === 401 || s === 403) head = 'このAPIキーは使えません（権限がないか、無効になっています）。';
    else if (s === 404) head = 'モデルが見つかりません。設定のモデル名を確認してください。';
    else if (s === 429) head = 'APIの利用上限に達しました。しばらく待つか、利用枠を確認してください。';
    else if (s >= 500) head = 'Gemini側で一時的なエラーが起きています。少し待ってから試してください。';
    else head = 'APIの呼び出しに失敗しました。';
    return `${head}（${s}${m ? '：' + m.slice(0, 160) : ''}）`;
  }

  // ---------- その他 ----------

  function formatDuration(sec) {
    const s = Math.max(0, Math.floor(sec));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;left:-9999px;top:0';
      (document.body || document.documentElement).appendChild(ta);
      ta.select();
      let ok = false;
      try {
        ok = document.execCommand('copy');
      } catch (_) {}
      ta.remove();
      return ok;
    }
  }

  const svg = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${d}</svg>`;
  const ICONS = {
    prev: svg('<path d="M6 6h2v12H6zm3.5 6L18 18V6z"/>'),
    next: svg('<path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>'),
    play: svg('<path d="M8 5v14l11-7z"/>'),
    pause: svg('<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>'),
    stop: svg('<path d="M6 6h12v12H6z"/>'),
    close: svg('<path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>'),
    mic: svg('<path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z"/>'),
    speaker: svg('<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.47 4.47 0 0 0 2.5-4zM14 3.23v2.06a7 7 0 0 1 0 13.42v2.06A9 9 0 0 0 14 3.23z"/>'),
    check: svg('<path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>'),
    copy: svg('<path d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11v14z"/>'),
    alert: svg('<path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>'),
    minus: svg('<path d="M5 11h14v2H5z"/>'),
    plus: svg('<path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/>'),
    gear: svg('<path d="M19.14 12.94a7.07 7.07 0 0 0 .05-.94 7.07 7.07 0 0 0-.05-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7 7 0 0 0-1.62-.94l-.36-2.54A.5.5 0 0 0 13.9 2h-3.84a.5.5 0 0 0-.49.42l-.36 2.54a7 7 0 0 0-1.62.94l-2.39-.96a.5.5 0 0 0-.6.22L2.68 8.48a.5.5 0 0 0 .12.64l2.03 1.58a7.07 7.07 0 0 0-.05.94c0 .32.02.63.05.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.5.38 1.04.7 1.62.94l.36 2.54a.5.5 0 0 0 .49.42h3.84a.5.5 0 0 0 .49-.42l.36-2.54a7 7 0 0 0 1.62-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z"/>'),
    wave: svg('<rect x="3" y="9" width="2.4" height="6" rx="1.2"/><rect x="7.2" y="6" width="2.4" height="12" rx="1.2"/><rect x="11.4" y="3" width="2.4" height="18" rx="1.2"/><rect x="15.6" y="6" width="2.4" height="12" rx="1.2"/><rect x="19.8" y="9" width="2.4" height="6" rx="1.2"/>'),
  };

  const api = {
    API_BASE, DEFAULTS, LIMITS, VOICES, ICONS, isBusy,
    normalizeForSpeech, splitText, hardSplit, buildPrompt, cleanTranscript,
    findText, findAudio, b64ToBytes, pcmToWav, audioBlob, readApiError, describeApiError,
    formatDuration, copyText,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else globalThis.GV = Object.assign(globalThis.GV || {}, api);
})();
