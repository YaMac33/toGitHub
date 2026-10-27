/**
 * ============================================================
 *  音声文字起こしWebアプリ（GAS内完結版） ― サーバー側  Code.gs
 * ============================================================
 *  構成
 *    Code.gs   … このファイル（サーバー処理）
 *    index     … 画面（GASエディタで「HTML」ファイルを追加し、名前を index にする）
 *
 *  スクリプトプロパティ（プロジェクトの設定 → スクリプト プロパティ）
 *    GEMINI_API_KEY … 必須。Gemini APIキー
 *    GEMINI_MODEL   … 任意。使用モデル名（未設定時は CONFIG.DEFAULT_MODEL）
 *                     ※ gemini-2.0-flash は 2026/6/1 に提供終了済みのため既定値を変更
 *    APP_PASSCODE   … 任意。設定すると画面・doPost でパスコードが必須になる
 *                     （「誰でも」公開時に第三者にAPI枠を使われるのを防ぐ）
 *
 *  初回は GASエディタで testConnection を実行して権限を承認し、
 *  実行ログに「接続OK」と出ることを確認してください。
 *
 *  処理の流れ（画面から呼ぶ場合）
 *    1) 音声の受け渡し
 *       ・14MB以下 … Base64のまま transcribeAudio() に渡す（インライン送信）
 *       ・14MB超   … startUpload() → uploadChunk()×n → checkFileState() で
 *                     Gemini Files API に分割アップロードしてから参照
 *       （Geminiのインライン送信は1リクエスト20MBまでのため）
 *    2) transcribeAudio → summarizeText → extractKeywords → formatText を順に実行
 *       1処理＝1回のサーバー呼び出しなので、GASの6分制限を処理ごとに使える
 *
 *  一括処理
 *    processAudio(audioData, fileType, options)
 *      インライン音声を1回の呼び出しで4処理まとめて実行し、仕様どおりのJSONを返す。
 *      doPost もこれを使う。
 *
 *  拡張の想定
 *    ・言語追加 … LANGUAGES にエントリを追加するだけで画面の選択肢に出る
 *    ・字幕生成 … transcribeAudio の options.timestamps=true で [mm:ss] 付き出力
 *    ・複数ファイル一括 … 画面側の runPipeline() をファイルごとに呼べばよい
 */

/* ============================================================
 * 設定
 * ============================================================ */
const CONFIG = Object.freeze({
  API_BASE: 'https://generativelanguage.googleapis.com/v1beta',
  UPLOAD_BASE: 'https://generativelanguage.googleapis.com/upload/v1beta/files',
  DEFAULT_MODEL: 'gemini-3.5-flash',
  THINKING_LEVEL: 'low',              // Gemini 3系の思考量（文字起こしは低めで十分）
  MAX_RETRIES: 3,                     // リトライ最大回数
  RETRY_BASE_MS: 2000,                // リトライ待ち時間の基準（指数バックオフ）
  EXEC_BUDGET_MS: 5 * 60 * 1000,      // 1実行あたりの持ち時間（6分制限に余裕を持たせる）
  INLINE_MAX_BYTES: 14 * 1024 * 1024, // これ以下はインライン送信（Base64化で約1.33倍）
  CHUNK_BYTES: 8 * 1024 * 1024,       // 分割アップロード1回分（256KiBの倍数にすること）
  MAX_FILE_BYTES: 100 * 1024 * 1024,
  MAX_RECORD_SEC: 30 * 60,
  MIN_RECORD_SEC: 1,
  MAX_TEXT_CHARS: 300000,             // 要約などに渡すテキストの上限
  KEYWORDS_MIN: 5,
  KEYWORDS_MAX: 10,
  SUMMARY_RATIO_MIN: 0.2,
  SUMMARY_RATIO_MAX: 0.3,
  DEFAULT_LANG: 'ja',
  UPLOAD_SESSION_TTL_SEC: 6 * 60 * 60,
  FILE_POLL_MAX_MS: 40 * 1000         // checkFileState 1回あたりの待機上限
});

/** ブラウザが報告するMIMEタイプ → Gemini に渡すMIMEタイプ */
const MIME_ALIASES = Object.freeze({
  'audio/mpeg': 'audio/mp3', 'audio/mp3': 'audio/mp3', 'audio/mpeg3': 'audio/mp3', 'audio/x-mpeg-3': 'audio/mp3',
  'audio/wav': 'audio/wav', 'audio/x-wav': 'audio/wav', 'audio/wave': 'audio/wav', 'audio/vnd.wave': 'audio/wav',
  'audio/mp4': 'audio/mp4', 'audio/x-m4a': 'audio/mp4', 'audio/m4a': 'audio/mp4',
  'audio/flac': 'audio/flac', 'audio/x-flac': 'audio/flac',
  'audio/ogg': 'audio/ogg', 'application/ogg': 'audio/ogg', 'audio/vorbis': 'audio/ogg'
});

/** 拡張子 → Gemini に渡すMIMEタイプ（ブラウザがMIMEを報告しない場合の補完） */
const MIME_BY_EXT = Object.freeze({
  mp3: 'audio/mp3', wav: 'audio/wav', m4a: 'audio/mp4', flac: 'audio/flac', ogg: 'audio/ogg'
});

/**
 * 言語ごとのプロンプト定義。
 * 言語を増やすときはここに追加する（画面の選択肢にも自動で反映）。
 */
const LANGUAGES = Object.freeze({
  ja: {
    label: '日本語',
    prompts: {
      transcribe: function (opt) {
        return [
          'この音声を日本語で文字起こししてください。',
          '- 話された内容を省略・要約・言い換えせず、聞こえたとおりに書き起こす',
          '- 「えー」「あのー」などの意味のないつなぎ言葉は除いてよい',
          '- 話の区切りで改行する',
          '- 聞き取れない箇所は［聞き取り不能］と書く',
          opt && opt.timestamps ? '- 各行の先頭に [mm:ss] 形式で、その行の話し始めの時刻を付ける' : '',
          '- 文字起こし本文以外（前置き・説明・見出し）は出力しない'
        ].filter(Boolean).join('\n');
      },
      summarize: function (text, min, max) {
        return [
          '次の文字起こしを要約してください。',
          '- 分量の目安：' + min + '〜' + max + '文字',
          '- 重要な論点を漏らさず、事実関係を変えない',
          '- 内容に合わせて箇条書き（各行「・」で始める）か段落形式を選ぶ',
          '- 要約本文のみを出力する（前置きや見出しは不要）',
          '', '# 文字起こし', text
        ].join('\n');
      },
      keywords: function (text, min, max) {
        return [
          '次の文章から重要なキーワードを' + min + '〜' + max + '個抽出し、重要度の高い順に並べてください。',
          '- 名詞（固有名詞・専門用語を含む）を優先し、必要に応じて動詞・形容詞も含める',
          '- 各キーワードは短い語句にする（目安：1〜15文字）',
          '- 重複や表記ゆれは1つにまとめる',
          '- 文章が短い場合は、無理に数を増やさない',
          '', '# 文章', text
        ].join('\n');
      },
      format: function (text) {
        return [
          '次の文字起こしに句読点を補い、読みやすい自然な日本語に整えてください。',
          '- 語句の追加・削除・言い換えはしない',
          '- 元の改行はそのまま保持する',
          '- 句読点は必要な箇所だけに入れ、過剰に入れない',
          '- 整形後の本文のみを出力する（前置きや説明は不要）',
          '', '# 文字起こし', text
        ].join('\n');
      }
    }
  },
  en: {
    label: 'English',
    prompts: {
      transcribe: function (opt) {
        return [
          'Transcribe this audio in English.',
          '- Write exactly what is said without omitting, summarizing or paraphrasing',
          '- Filler words such as "um" and "uh" may be removed',
          '- Start a new line at natural breaks',
          '- Mark inaudible parts as [inaudible]',
          opt && opt.timestamps ? '- Prefix each line with its start time in [mm:ss] format' : '',
          '- Output only the transcript, with no preface or headings'
        ].filter(Boolean).join('\n');
      },
      summarize: function (text, min, max) {
        return [
          'Summarize the following transcript.',
          '- Target length: about ' + min + '-' + max + ' characters',
          '- Keep all key points and do not alter facts',
          '- Use bullet points ("- ") or paragraphs, whichever suits the content',
          '- Output only the summary',
          '', '# Transcript', text
        ].join('\n');
      },
      keywords: function (text, min, max) {
        return [
          'Extract ' + min + '-' + max + ' important keywords from the text below, ordered by importance.',
          '- Prefer nouns (including proper nouns and technical terms); include verbs or adjectives if useful',
          '- Keep each keyword short',
          '- Merge duplicates and spelling variants',
          '- If the text is short, do not pad the list',
          '', '# Text', text
        ].join('\n');
      },
      format: function (text) {
        return [
          'Add punctuation and capitalization to the following transcript so it reads naturally.',
          '- Do not add, remove or reword any words',
          '- Keep the original line breaks',
          '- Do not over-punctuate',
          '- Output only the formatted text',
          '', '# Transcript', text
        ].join('\n');
      }
    }
  }
});

/** 実行開始時刻（GASは呼び出しごとに新しい実行になるため、実行単位の経過時間計測に使う） */
const EXEC_START_MS = Date.now();

/** リトライ対象のHTTPステータス */
const RETRYABLE_STATUS = [408, 429, 500, 502, 503, 504];

/* ============================================================
 * エラー型
 * ============================================================ */
/**
 * 利用者に見せてよいエラー。
 * @param {string} message 画面に出すメッセージ（日本語）
 * @param {{retryable?:boolean, status?:number, code?:string}} [opts]
 */
class AppError extends Error {
  constructor(message, opts) {
    super(message);
    this.name = 'AppError';
    this.retryable = !!(opts && opts.retryable);
    this.status = opts && opts.status;
    this.code = (opts && opts.code) || 'APP';
  }
}

/* ============================================================
 * Webアプリの入口
 * ============================================================ */

/**
 * 画面を返す。
 * HtmlService の応答は常に text/html; charset=utf-8 で、HTTPヘッダーは変更できない。
 * キャッシュ対策は index 側の meta タグで行っている。
 */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('音声文字起こし')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

/**
 * 外部から JSON で呼ぶための入口（画面は google.script.run を使うので通常は不要）。
 * 期待するボディ：
 *   { "action":"process_audio", "audio_data":"<Base64>", "file_type":"audio/mpeg",
 *     "language":"ja"(任意), "passcode":"..."(APP_PASSCODE設定時), "file_name":"a.mp3"(任意) }
 * ※ ContentService の応答は Content-Type: text/plain で送ればブラウザからも
 *    プリフライトなしで取得できる（GAS側で独自のCORSヘッダーは付けられない）。
 * ※ GASの受信サイズ上限があるため、インライン上限（約14MB）を超える音声は画面から処理する。
 */
function doPost(e) {
  let body;
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json_({ success: false, error: 'リクエストボディがJSON形式ではありません。' });
  }
  if (body.action !== 'process_audio') {
    return json_({ success: false, error: '未対応の action です：' + body.action });
  }
  return json_(processAudio(body.audio_data, body.file_type, {
    language: body.language,
    passcode: body.passcode,
    fileName: body.file_name
  }));
}

/* ============================================================
 * 画面から呼ぶ関数（google.script.run）
 *   すべて { ok:true, data } または { ok:false, error, retryable, code } を返す。
 *   例外を画面に投げないので、通信エラーとサーバーエラーを区別できる。
 * ============================================================ */

/** 画面の初期設定に使う情報（APIキーやパスコードそのものは返さない） */
function getAppConfig() {
  try {
    return {
      ok: true,
      data: {
        model: getModel_(),
        apiKeyConfigured: !!getProp_('GEMINI_API_KEY'),
        requiresPasscode: !!getProp_('APP_PASSCODE'),
        defaultLanguage: CONFIG.DEFAULT_LANG,
        languages: Object.keys(LANGUAGES).map(function (code) {
          return { code: code, label: LANGUAGES[code].label };
        }),
        limits: {
          maxFileBytes: CONFIG.MAX_FILE_BYTES,
          inlineMaxBytes: CONFIG.INLINE_MAX_BYTES,
          chunkBytes: CONFIG.CHUNK_BYTES,
          maxRecordSec: CONFIG.MAX_RECORD_SEC,
          minRecordSec: CONFIG.MIN_RECORD_SEC,
          extensions: Object.keys(MIME_BY_EXT),
          acceptedMimeTypes: Object.keys(MIME_ALIASES)
        }
      }
    };
  } catch (e) {
    return toFailure_(e);
  }
}

/**
 * 【一括処理】インライン音声を受け取り、4処理を順に実行して仕様どおりの形式で返す。
 * @param {string} audioData Base64（data:～, の接頭辞があっても可）
 * @param {string} fileType  MIMEタイプ（例 audio/mpeg）
 * @param {{language?:string, passcode?:string, fileName?:string, timestamps?:boolean}} [options]
 */
function processAudio(audioData, fileType, options) {
  const started = Date.now();
  options = options || {};
  try {
    assertAccess_(options.passcode);
    const lang = resolveLang_(options.language);
    const source = { inlineData: audioData, mimeType: fileType, fileName: options.fileName };

    const tr = transcribe_(source, lang, options);      // a. 音声認識
    const sm = summarize_(tr.text, lang);                // b. 要約
    const keywords = extractKeywords_(tr.text, lang);    // c. キーワード
    const fm = format_(tr.text, lang);                   // d. 句読点挿入・整形

    return {
      success: true,
      transcription: tr.text,
      summary: sm.text,
      keywords: keywords,
      formatted_text: fm.text,
      processing_time: round1_((Date.now() - started) / 1000),
      timestamp: new Date().toISOString(),
      language: lang,
      model: getModel_(),
      warnings: collectWarnings_([tr, sm, fm])
    };
  } catch (e) {
    const f = toFailure_(e);
    return {
      success: false,
      error: f.error,
      code: f.code,
      processing_time: round1_((Date.now() - started) / 1000),
      timestamp: new Date().toISOString()
    };
  }
}

/** a. 音声認識。source は {inlineData, mimeType, fileName} か {fileUri, mimeType} */
function transcribeAudio(passcode, source, language, options) {
  return handle_(passcode, function () {
    return transcribe_(source, resolveLang_(language), options || {});
  });
}

/** b. 要約生成 */
function summarizeText(passcode, text, language) {
  return handle_(passcode, function () {
    return summarize_(text, resolveLang_(language));
  });
}

/** c. キーワード抽出 */
function extractKeywords(passcode, text, language) {
  return handle_(passcode, function () {
    return extractKeywords_(text, resolveLang_(language));
  });
}

/** d. 句読点挿入・文章整形 */
function formatText(passcode, text, language) {
  return handle_(passcode, function () {
    return format_(text, resolveLang_(language));
  });
}

/* ---------- 大きいファイル用：Gemini Files API への分割アップロード ---------- */

/**
 * アップロードを開始し、セッションIDを返す（アップロード先URLはサーバー側にだけ保持）。
 * @param {{name:string, size:number, mimeType:string}} meta
 */
function startUpload(passcode, meta) {
  return handle_(passcode, function () {
    if (!meta || !(meta.size > 0)) throw new AppError('ファイルサイズが不正です。');
    if (meta.size > CONFIG.MAX_FILE_BYTES) {
      throw new AppError('ファイルが大きすぎます（上限 ' + Math.round(CONFIG.MAX_FILE_BYTES / 1048576) + 'MB）。');
    }
    const mime = normalizeMime_(meta.mimeType, meta.name);
    const res = fetchWithRetry_(CONFIG.UPLOAD_BASE, {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'x-goog-api-key': getApiKey_(),
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': String(meta.size),
        'X-Goog-Upload-Header-Content-Type': mime
      },
      payload: JSON.stringify({ file: { display_name: 'transcribe_' + Date.now() } })
    });
    if (res.getResponseCode() !== 200) throw apiError_(res);
    const uploadUrl = getHeader_(res, 'x-goog-upload-url');
    if (!uploadUrl) throw new AppError('アップロード先URLを取得できませんでした。', { retryable: true });

    const sessionId = Utilities.getUuid();
    CacheService.getScriptCache().put(
      'upl_' + sessionId,
      JSON.stringify({ url: uploadUrl, size: meta.size, mime: mime }),
      CONFIG.UPLOAD_SESSION_TTL_SEC
    );
    return { sessionId: sessionId, mimeType: mime };
  });
}

/**
 * 分割データを1つ送る。最後の分割（isLast=true）の応答にファイル情報が入る。
 * 失敗時は画面側で queryUpload() により受信済みバイト数を確認して再送する。
 */
function uploadChunk(passcode, sessionId, base64Chunk, offset, isLast) {
  return handle_(passcode, function () {
    const sess = getUploadSession_(sessionId);
    const bytes = Utilities.base64Decode(String(base64Chunk || ''));
    if (!bytes.length) throw new AppError('送信データが空です。');

    let res;
    try {
      res = UrlFetchApp.fetch(sess.url, {
        method: 'post',
        contentType: 'application/octet-stream',
        headers: {
          'X-Goog-Upload-Command': isLast ? 'upload, finalize' : 'upload',
          'X-Goog-Upload-Offset': String(offset)
        },
        payload: bytes,
        muteHttpExceptions: true
      });
    } catch (e) {
      throw new AppError('アップロード中に通信エラーが発生しました：' + e.message, { retryable: true });
    }
    if (res.getResponseCode() !== 200) throw apiError_(res);
    if (!isLast) return { received: offset + bytes.length };

    const json = parseJson_(res.getContentText());
    if (!json || !json.file) throw new AppError('アップロード結果を読み取れませんでした。');
    return { file: pickFile_(json.file) };
  });
}

/** 受信済みバイト数の確認（分割送信の再開用） */
function queryUpload(passcode, sessionId) {
  return handle_(passcode, function () {
    const sess = getUploadSession_(sessionId);
    const res = fetchWithRetry_(sess.url, {
      method: 'post',
      headers: { 'X-Goog-Upload-Command': 'query' }
    });
    if (res.getResponseCode() !== 200) throw apiError_(res);
    const status = getHeader_(res, 'x-goog-upload-status');
    const received = Number(getHeader_(res, 'x-goog-upload-size-received') || 0);
    const out = { status: status, received: received };
    if (status === 'final') {
      const json = parseJson_(res.getContentText());
      if (json && json.file) out.file = pickFile_(json.file);
    }
    return out;
  });
}

/**
 * アップロード済みファイルが使える状態（ACTIVE）になるまで待つ。
 * 1回あたり最大 FILE_POLL_MAX_MS 待ち、まだ PROCESSING なら画面側が再度呼ぶ。
 */
function checkFileState(passcode, fileName) {
  return handle_(passcode, function () {
    assertFileName_(fileName);
    const until = Date.now() + CONFIG.FILE_POLL_MAX_MS;
    while (true) {
      const res = fetchWithRetry_(CONFIG.API_BASE + '/' + fileName, {
        method: 'get',
        headers: { 'x-goog-api-key': getApiKey_() }
      });
      if (res.getResponseCode() !== 200) throw apiError_(res);
      const file = pickFile_(parseJson_(res.getContentText()) || {});
      if (file.state === 'FAILED') throw new AppError('Gemini側で音声ファイルの処理に失敗しました。別の形式で試してください。');
      if (file.state !== 'PROCESSING' || Date.now() > until) return file;
      Utilities.sleep(2000);
    }
  });
}

/** アップロードしたファイルを削除する（Gemini側でも48時間で自動削除される） */
function deleteUploadedFile(passcode, fileName) {
  return handle_(passcode, function () {
    assertFileName_(fileName);
    const res = UrlFetchApp.fetch(CONFIG.API_BASE + '/' + fileName, {
      method: 'delete',
      headers: { 'x-goog-api-key': getApiKey_() },
      muteHttpExceptions: true
    });
    const code = res.getResponseCode();
    if (code !== 200 && code !== 404) throw apiError_(res);
    return { deleted: code === 200 };
  });
}

/* ============================================================
 * 4つの処理の本体
 * ============================================================ */

function transcribe_(source, lang, options) {
  const L = LANGUAGES[lang];
  let audioPart;
  if (source && source.fileUri) {
    if (!/^https:\/\/generativelanguage\.googleapis\.com\//.test(source.fileUri)) {
      throw new AppError('音声ファイルの参照先が不正です。');
    }
    audioPart = { fileData: { mimeType: normalizeMime_(source.mimeType, source.fileName), fileUri: source.fileUri } };
  } else if (source && source.inlineData) {
    const b64 = String(source.inlineData).replace(/^data:[^,]*,/, '');
    const approxBytes = Math.floor(b64.length * 3 / 4);
    if (approxBytes > CONFIG.INLINE_MAX_BYTES) {
      throw new AppError('音声が大きすぎるため一括送信できません（上限 約'
        + Math.round(CONFIG.INLINE_MAX_BYTES / 1048576) + 'MB）。画面から分割アップロードで処理してください。');
    }
    audioPart = { inlineData: { mimeType: normalizeMime_(source.mimeType, source.fileName), data: b64 } };
  } else {
    throw new AppError('音声データがありません。');
  }
  const out = generate_([audioPart, { text: L.prompts.transcribe(options) }]);
  if (!out.text) throw new AppError('音声から文字を認識できませんでした。音量や録音状態を確認してください。');
  return out;
}

function summarize_(text, lang) {
  text = checkText_(text);
  const len = text.replace(/\s/g, '').length;
  const min = Math.max(30, Math.round(len * CONFIG.SUMMARY_RATIO_MIN));
  const max = Math.max(min + 20, Math.round(len * CONFIG.SUMMARY_RATIO_MAX));
  return generate_([{ text: LANGUAGES[lang].prompts.summarize(text, min, max) }]);
}

function extractKeywords_(text, lang) {
  text = checkText_(text);
  const out = generate_(
    [{ text: LANGUAGES[lang].prompts.keywords(text, CONFIG.KEYWORDS_MIN, CONFIG.KEYWORDS_MAX) }],
    {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: { keywords: { type: 'ARRAY', items: { type: 'STRING' } } },
        required: ['keywords']
      }
    }
  );
  const json = parseJson_(out.text.replace(/^```(?:json)?\s*|\s*```$/g, ''));
  const list = (json && Array.isArray(json.keywords)) ? json.keywords : [];
  const seen = {};
  return list
    .map(function (k) { return String(k).trim(); })
    .filter(function (k) {
      if (!k || seen[k]) return false;
      seen[k] = true;
      return true;
    })
    .slice(0, CONFIG.KEYWORDS_MAX);
}

function format_(text, lang) {
  text = checkText_(text);
  return generate_([{ text: LANGUAGES[lang].prompts.format(text) }]);
}

/* ============================================================
 * Gemini API 呼び出し
 * ============================================================ */

/**
 * generateContent を呼び、テキストを返す。
 * @return {{text:string, truncated:boolean}}
 */
function generate_(parts, extraConfig) {
  const model = getModel_();
  const url = CONFIG.API_BASE + '/models/' + encodeURIComponent(model) + ':generateContent';
  const baseConfig = Object.assign({}, extraConfig || {});
  const thinking = thinkingConfigFor_(model);
  const body = {
    contents: [{ role: 'user', parts: parts }],
    generationConfig: thinking ? Object.assign({}, baseConfig, { thinkingConfig: thinking }) : baseConfig
  };

  let json;
  try {
    json = requestJson_(url, body);
  } catch (e) {
    // モデルが思考設定に対応していない場合は、設定を外して1回だけ再実行
    if (thinking && e.status === 400 && /thinking/i.test(e.message)) {
      body.generationConfig = baseConfig;
      json = requestJson_(url, body);
    } else {
      throw e;
    }
  }
  return extractText_(json);
}

/** モデル世代に合わせた思考設定（不要な思考を抑えて速度を上げる） */
function thinkingConfigFor_(model) {
  if (/^gemini-3/.test(model)) return { thinkingLevel: CONFIG.THINKING_LEVEL };
  if (/^gemini-2\.5-flash/.test(model)) return { thinkingBudget: 0 };
  return null;
}

function requestJson_(url, body) {
  const res = fetchWithRetry_(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-goog-api-key': getApiKey_() },
    payload: JSON.stringify(body)
  });
  if (res.getResponseCode() !== 200) throw apiError_(res);
  const json = parseJson_(res.getContentText());
  if (!json) throw new AppError('Gemini APIの応答を読み取れませんでした。', { retryable: true });
  return json;
}

function extractText_(json) {
  if (json.promptFeedback && json.promptFeedback.blockReason) {
    throw new AppError('入力内容が安全フィルタによりブロックされました（' + json.promptFeedback.blockReason + '）。');
  }
  const cand = (json.candidates || [])[0];
  if (!cand) throw new AppError('Gemini APIから結果が返りませんでした。', { retryable: true });
  const text = ((cand.content && cand.content.parts) || [])
    .filter(function (p) { return !p.thought && typeof p.text === 'string'; })
    .map(function (p) { return p.text; })
    .join('')
    .trim();
  const reason = cand.finishReason || '';
  if (!text && (reason === 'SAFETY' || reason === 'RECITATION' || reason === 'PROHIBITED_CONTENT' || reason === 'BLOCKLIST')) {
    throw new AppError('出力が安全フィルタによりブロックされました（' + reason + '）。');
  }
  return { text: text, truncated: reason === 'MAX_TOKENS' };
}

/**
 * UrlFetchApp をリトライ付きで呼ぶ。
 * ・リトライ：最大 CONFIG.MAX_RETRIES 回（408/429/5xx と通信例外が対象）、指数バックオフ
 * ・タイムアウト：UrlFetchApp では待ち時間を指定できないため、実行全体の持ち時間
 *   （EXEC_BUDGET_MS）を超えそうな場合はリトライせず打ち切る
 */
function fetchWithRetry_(url, params) {
  const opts = Object.assign({ muteHttpExceptions: true }, params);
  for (let attempt = 0; ; attempt++) {
    let res = null;
    let err = null;
    try {
      res = UrlFetchApp.fetch(url, opts);
    } catch (e) {
      err = e;
    }
    const code = res ? res.getResponseCode() : 0;
    if (!err && RETRYABLE_STATUS.indexOf(code) < 0) return res;

    const wait = CONFIG.RETRY_BASE_MS * Math.pow(2, attempt) + Math.floor(Math.random() * 500);
    const outOfBudget = Date.now() - EXEC_START_MS + wait > CONFIG.EXEC_BUDGET_MS;
    if (attempt >= CONFIG.MAX_RETRIES || outOfBudget) {
      if (res) return res; // 呼び出し元で apiError_ に変換
      const msg = /timeout|timed out/i.test(String(err && err.message))
        ? 'Gemini APIの応答がタイムアウトしました。時間をおいて再試行してください。'
        : 'Gemini APIとの通信に失敗しました：' + (err && err.message);
      throw new AppError(msg, { retryable: true });
    }
    console.warn('リトライ ' + (attempt + 1) + '/' + CONFIG.MAX_RETRIES + '（' + (err ? err.message : 'HTTP ' + code) + '）');
    Utilities.sleep(wait);
  }
}

/** HTTPエラー応答を、利用者向けの日本語メッセージに変換する */
function apiError_(res) {
  const code = res.getResponseCode();
  const json = parseJson_(res.getContentText());
  const detail = (json && json.error && json.error.message) ? json.error.message : res.getContentText().slice(0, 300);
  let msg;
  if (code === 400) msg = 'リクエストが不正です。音声形式やデータを確認してください。';
  else if (code === 401 || code === 403) msg = 'APIキーが無効か、権限がありません。スクリプトプロパティの GEMINI_API_KEY を確認してください。';
  else if (code === 404) msg = 'モデルまたはファイルが見つかりません。スクリプトプロパティの GEMINI_MODEL（現在：' + getModel_() + '）を確認してください。';
  else if (code === 413) msg = 'データが大きすぎます。';
  else if (code === 429) msg = 'Gemini APIの利用上限に達しました。しばらく待ってから再試行してください。';
  else if (code >= 500) msg = 'Gemini API側で一時的なエラーが発生しました。時間をおいて再試行してください。';
  else msg = 'Gemini APIでエラーが発生しました。';
  return new AppError(msg + '（HTTP ' + code + '：' + detail + '）', {
    status: code,
    retryable: RETRYABLE_STATUS.indexOf(code) >= 0,
    code: 'API_' + code
  });
}

/* ============================================================
 * 補助関数
 * ============================================================ */

/** アクセス確認＋例外を {ok:false} に変換する共通ラッパー */
function handle_(passcode, fn) {
  try {
    assertAccess_(passcode);
    return { ok: true, data: fn() };
  } catch (e) {
    return toFailure_(e);
  }
}

function toFailure_(e) {
  const isApp = e instanceof AppError;
  if (isApp) console.warn(e.message);
  else console.error((e && e.stack) || e);
  return {
    ok: false,
    error: isApp ? e.message : '予期しないエラーが発生しました：' + ((e && e.message) || e),
    retryable: isApp ? e.retryable : false,
    code: isApp ? e.code : 'INTERNAL'
  };
}

function assertAccess_(passcode) {
  const required = getProp_('APP_PASSCODE');
  if (required && String(passcode || '') !== required) {
    throw new AppError('パスコードが正しくありません。', { code: 'AUTH' });
  }
}

function getProp_(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}

function getApiKey_() {
  const key = getProp_('GEMINI_API_KEY');
  if (!key) {
    throw new AppError('Gemini APIキーが未設定です。プロジェクトの設定 → スクリプト プロパティに GEMINI_API_KEY を登録してください。', { code: 'NO_KEY' });
  }
  return key;
}

function getModel_() {
  const m = (getProp_('GEMINI_MODEL') || CONFIG.DEFAULT_MODEL).trim();
  if (!/^[a-z0-9.\-]+$/i.test(m)) throw new AppError('GEMINI_MODEL の値が不正です：' + m);
  return m;
}

function resolveLang_(code) {
  return LANGUAGES[code] ? code : CONFIG.DEFAULT_LANG;
}

function normalizeMime_(type, fileName) {
  const t = String(type || '').toLowerCase().split(';')[0].trim();
  if (MIME_ALIASES[t]) return MIME_ALIASES[t];
  const m = /\.([a-z0-9]+)$/i.exec(String(fileName || ''));
  const ext = m ? m[1].toLowerCase() : '';
  if (MIME_BY_EXT[ext]) return MIME_BY_EXT[ext];
  throw new AppError('対応していない音声形式です（' + (t || ext || '不明') + '）。mp3 / wav / m4a / flac / ogg を使用してください。');
}

function checkText_(text) {
  const s = String(text || '').trim();
  if (!s) throw new AppError('処理するテキストが空です。');
  if (s.length > CONFIG.MAX_TEXT_CHARS) throw new AppError('テキストが長すぎます（上限 ' + CONFIG.MAX_TEXT_CHARS + ' 文字）。');
  return s;
}

function getUploadSession_(sessionId) {
  const raw = sessionId ? CacheService.getScriptCache().get('upl_' + sessionId) : null;
  if (!raw) throw new AppError('アップロードの有効期限が切れました。最初からやり直してください。', { code: 'UPLOAD_EXPIRED' });
  return JSON.parse(raw);
}

function assertFileName_(fileName) {
  if (!/^files\/[A-Za-z0-9_-]+$/.test(String(fileName || ''))) throw new AppError('ファイル名が不正です。');
}

function pickFile_(f) {
  return { name: f.name, uri: f.uri, mimeType: f.mimeType, state: f.state, sizeBytes: Number(f.sizeBytes || 0) };
}

function getHeader_(res, name) {
  const headers = res.getAllHeaders();
  const target = name.toLowerCase();
  for (const k in headers) {
    if (k.toLowerCase() === target) return Array.isArray(headers[k]) ? headers[k][0] : headers[k];
  }
  return null;
}

function parseJson_(s) {
  try { return JSON.parse(s); } catch (e) { return null; }
}

function collectWarnings_(results) {
  return results.some(function (r) { return r && r.truncated; })
    ? ['出力が長すぎたため、結果の一部が途中で切れている可能性があります。']
    : [];
}

function round1_(n) {
  return Math.round(n * 10) / 10;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ============================================================
 * 動作確認用（GASエディタで選択して実行）
 * ============================================================ */

/** APIキーとモデルの接続確認。初回実行時に外部通信の権限承認も行われる。 */
function testConnection() {
  const out = generate_([{ text: '「接続OK」とだけ返してください。' }]);
  console.log('モデル：' + getModel_() + ' / 応答：' + out.text);
}
