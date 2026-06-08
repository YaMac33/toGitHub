/**************************************************************
 * 一般質問通告フォーム  ―  サーバー側ロジック (Code.gs)
 *
 * 構成：GAS ウェブアプリに統合（フォームはコンテナのHTMLファイル "index" を配信）
 *   - doGet          … フォーム(index.html)を配信
 *   - getSessionName … 現在の定例会名を返す（フロント起動時に取得）
 *   - lookupMember   … 入力メールを議員名簿と照合（その場で本人確認）
 *   - submitNotice   … 検証 → 提出マスタ＋質問明細へ保存 → 控えメール送信
 *   - setupSheets    … 初回のみ手動実行。必要な4シートと見出しを自動生成
 *
 * このスクリプトは集約用スプレッドシートに「コンテナバインド」する想定。
 *
 * シート構成：
 *   1. 設定        … キー / 値（「定例会名」を1行）
 *   2. 議員名簿    … メールアドレス / 議員氏名 / 会派 / 発言順位 / 質問日
 *   3. 提出マスタ  … 提出ID / 発言順位 / 提出日時 / 定例会名 / 議員氏名 /
 *                    会派 / 質問日 / 通告時間(分) / メールアドレス
 *   4. 質問明細    … 提出ID / 大項目番号 / 件名 / 中項目番号 / 小見出し /
 *                    内容番号 / 質問文 / 答弁者
 *                    （中項目・内容が無い場合は、その階層までを1行に記録。
 *                      答弁者列は事務局が①単位で記入する空欄）
 **************************************************************/

// ── シート名 ────────────────────────────────────────────────
const SHEET = {
  SETTINGS: '設定',
  ROSTER:   '議員名簿',
  MASTER:   '提出マスタ',
  DETAIL:   '質問明細',
};

// 通告時間（分）：10分刻み・30〜80分
const ALLOWED_MINUTES = [30, 40, 50, 60, 70, 80];

// ── ウェブアプリのエントリポイント ─────────────────────────
function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('一般質問通告フォーム')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// フロント起動時に呼ばれ、ヘッダー・プレビューの定例会名を埋める
function getSessionName() {
  return getSetting_('定例会名') || '（定例会名 未設定）';
}

// ── 本人確認：メールを名簿と照合（クライアントが入力直後に呼ぶ）──
//   見つかれば氏名・会派・発言順位・質問日を返し、画面に自動セット。
//   見つからなければ found:false（→ フロントでその場で弾く）。
function lookupMember(email) {
  const e = normalizeEmail_(email);
  if (!e) return { found: false };
  const m = findMemberByEmail_(e);
  if (!m) return { found: false };
  return { found: true, name: m.name, group: m.group, order: m.order, date: m.date };
}

// ── 提出処理 ────────────────────────────────────────────────
//   payload = { email, minutes, items:[ {title, subs:[ {subtitle, contents:[text,...]} ]} ] }
//   subs / contents は空配列でも可（大項目のみ／大項目＋中項目 の構成を許容）。
function submitNotice(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000); // 同時提出を直列化（行の混在を防止）
  try {
    // 1) 入力の基本検証
    const email = normalizeEmail_(payload && payload.email);
    if (!email) return fail_('メールアドレスが入力されていません。');

    const minutes = Number(payload.minutes);
    if (ALLOWED_MINUTES.indexOf(minutes) === -1) {
      return fail_('通告時間は10分刻み・上限80分で指定してください。');
    }

    const items = (payload && payload.items) || [];
    const structErr = validateStructure_(items);
    if (structErr) return fail_(structErr);

    // 2) 本人確認（名簿照合）
    const member = findMemberByEmail_(email);
    if (!member) {
      return fail_('入力されたメールアドレスは議員名簿に登録されていません。アドレスをご確認ください。');
    }

    // 3) 一発提出：当該定例会で提出済みなら拒否（修正は事務局経由）
    const sessionName = getSetting_('定例会名') || '';
    if (hasAlreadySubmitted_(email, sessionName)) {
      return fail_('この定例会では既に提出済みです。内容の修正は議会事務局へご連絡ください。');
    }

    // 4) 保存
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const submissionId = Utilities.getUuid();
    const now = new Date();

    // 4-1) 提出マスタ（1提出=1行）
    appendRowByHeader_(ss.getSheetByName(SHEET.MASTER), {
      '提出ID':       submissionId,
      '発言順位':     member.order,
      '提出日時':     now,
      '定例会名':     sessionName,
      '議員氏名':     member.name,
      '会派':         member.group,
      '質問日':       member.date,
      '通告時間(分)': minutes,
      'メールアドレス': email,
    });

    // 4-2) 質問明細（存在する最も深い階層を1行として記録）
    const detailSheet = ss.getSheetByName(SHEET.DETAIL);
    saveDetail_(detailSheet, submissionId, items);

    // 5) 控えメールを入力アドレスへ自動返信（なりすまし抑止）
    sendConfirmationMail_(email, member, sessionName, minutes, items, now);

    return {
      ok: true,
      submissionId: submissionId,
      summary: {
        sessionName: sessionName, name: member.name, group: member.group,
        order: member.order, date: member.date, minutes: minutes,
        submittedAt: Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy/MM/dd HH:mm'),
      },
    };
  } catch (err) {
    return fail_('サーバー側でエラーが発生しました：' + err.message);
  } finally {
    lock.releaseLock();
  }
}

// ── 質問明細の書き込み ──────────────────────────────────────
//   ・大項目に中項目が無い   → 件名までを1行
//   ・中項目に内容が無い     → 小見出しまでを1行
//   ・内容がある             → ①ごとに1行
function saveDetail_(sheet, submissionId, items) {
  items.forEach(function (it, i) {
    const majorNo = String(i + 1);                 // 1. 2. 3.
    const subs = it.subs || [];

    if (subs.length === 0) {
      appendRowByHeader_(sheet, {
        '提出ID': submissionId, '大項目番号': majorNo, '件名': it.title,
      });
      return;
    }

    subs.forEach(function (sub, j) {
      const midNo = '(' + (j + 1) + ')';           // (1) (2) (3)
      const contents = sub.contents || [];

      if (contents.length === 0) {
        appendRowByHeader_(sheet, {
          '提出ID': submissionId, '大項目番号': majorNo, '件名': it.title,
          '中項目番号': midNo, '小見出し': sub.subtitle,
        });
        return;
      }

      contents.forEach(function (text, k) {
        appendRowByHeader_(sheet, {
          '提出ID': submissionId, '大項目番号': majorNo, '件名': it.title,
          '中項目番号': midNo, '小見出し': sub.subtitle,
          '内容番号': circledNumber_(k + 1),         // ①..⑳ → 以降 (21)
          '質問文': text, '答弁者': '',
        });
      });
    });
  });
}

// ── 検証：大項目の件名のみ必須。中項目・内容は任意（あれば本文必須）──
function validateStructure_(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return '大項目を1つ以上入力してください。';
  }
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (!it.title || !String(it.title).trim()) {
      return (i + 1) + '番目の大項目（件名）が未入力です。';
    }
    const subs = it.subs || [];
    for (let j = 0; j < subs.length; j++) {
      const sub = subs[j];
      if (!sub.subtitle || !String(sub.subtitle).trim()) {
        return '大項目「' + it.title + '」の (' + (j + 1) + ') の小見出しが未入力です。';
      }
      const contents = sub.contents || [];
      for (let k = 0; k < contents.length; k++) {
        if (!contents[k] || !String(contents[k]).trim()) {
          return '中項目「' + sub.subtitle + '」の ' + circledNumber_(k + 1) + ' の質問文が未入力です。';
        }
      }
    }
  }
  return null; // OK
}

// ── 名簿照合 ────────────────────────────────────────────────
function findMemberByEmail_(email) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET.ROSTER);
  if (!sheet || sheet.getLastRow() < 2) return null;

  const values = sheet.getDataRange().getValues();
  const head = headerIndex_(values[0]);
  const cEmail = head['メールアドレス'];
  const cName  = head['議員氏名'];
  const cGroup = head['会派'];
  const cOrder = head['発言順位'];
  const cDate  = head['質問日'];

  for (let r = 1; r < values.length; r++) {
    if (normalizeEmail_(values[r][cEmail]) === email) {
      return {
        name:  values[r][cName],
        group: values[r][cGroup],
        order: values[r][cOrder],
        date:  formatDateMaybe_(values[r][cDate]),
      };
    }
  }
  return null;
}

// 既に当該定例会で提出済みか
function hasAlreadySubmitted_(email, sessionName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET.MASTER);
  if (!sheet || sheet.getLastRow() < 2) return false;

  const values = sheet.getDataRange().getValues();
  const head = headerIndex_(values[0]);
  const cEmail = head['メールアドレス'];
  const cSession = head['定例会名'];

  for (let r = 1; r < values.length; r++) {
    if (normalizeEmail_(values[r][cEmail]) === email &&
        String(values[r][cSession]) === String(sessionName)) {
      return true;
    }
  }
  return false;
}

// ── 控えメール ──────────────────────────────────────────────
function sendConfirmationMail_(email, member, sessionName, minutes, items, now) {
  try {
    const intro = member.name + ' 様\n\n' +
      '以下の内容で一般質問の通告を受け付けました。記載内容をご確認ください。\n\n';
    const body = intro +
      buildPlainText_(sessionName, member, minutes, items, now) +
      '\n\n――――――――――――――――――\n' +
      '※このメールは提出された通告内容（全文）の控えです。\n' +
      '※心当たりがない場合は議会事務局までご連絡ください。\n' +
      '※内容の修正は議会事務局へお申し出ください。\n';
    MailApp.sendEmail({
      to: email,
      subject: '【提出控え】' + sessionName + ' 一般質問通告',
      body: body,
    });
  } catch (e) {
    // メール送信失敗でも保存は確定済み。ここでは握りつぶす（事務局がシートで把握可能）。
  }
}

// 通告書体裁のプレーンテキスト（控えメール用。空の階層はスキップ）
function buildPlainText_(sessionName, member, minutes, items, now) {
  const tz = Session.getScriptTimeZone();
  const lines = [];
  lines.push(sessionName + '　一般質問通告書');
  lines.push('');
  lines.push('発言順位　' + member.order);
  lines.push('議員氏名　' + member.name + '（' + member.group + '）');
  lines.push('質問日　　' + member.date);
  lines.push('通告時間　' + minutes + '分');
  lines.push('申請日時　' + Utilities.formatDate(now, tz, 'yyyy/MM/dd HH:mm'));
  lines.push('');
  items.forEach(function (it, i) {
    lines.push((i + 1) + '　' + it.title);
    (it.subs || []).forEach(function (sub, j) {
      lines.push('　(' + (j + 1) + ')　' + sub.subtitle);
      (sub.contents || []).forEach(function (text, k) {
        lines.push('　　' + circledNumber_(k + 1) + '　' + text);
      });
    });
  });
  return lines.join('\n');
}

// ── 内容番号：①..⑳、それを超えたら (21) 相当の括弧表記で吸収 ──
function circledNumber_(n) {
  if (n >= 1 && n <= 20) return String.fromCharCode(0x2460 + (n - 1)); // ① = U+2460
  return '(' + n + ')';
}

// ── 設定シート読込（キー/値）────────────────────────────────
function getSetting_(key) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET.SETTINGS);
  if (!sheet || sheet.getLastRow() < 1) return '';
  const values = sheet.getDataRange().getValues();
  for (let r = 0; r < values.length; r++) {
    if (String(values[r][0]).trim() === key) return String(values[r][1]).trim();
  }
  return '';
}

// ── 汎用ヘルパー ────────────────────────────────────────────
function normalizeEmail_(s) {
  return String(s || '').trim().toLowerCase();
}

function formatDateMaybe_(v) {
  if (v instanceof Date) {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'M月d日');
  }
  return String(v || '');
}

// 見出し行 → {見出し名: 列index} のマップ
function headerIndex_(headerRow) {
  const map = {};
  headerRow.forEach(function (h, i) { map[String(h).trim()] = i; });
  return map;
}

// 見出し名をキーにした連想配列を、シートの列順に合わせて1行追記
function appendRowByHeader_(sheet, obj) {
  const lastCol = sheet.getLastColumn();
  const headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const row = headerRow.map(function (h) {
    const key = String(h).trim();
    return Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : '';
  });
  sheet.appendRow(row);
}

function fail_(message) {
  return { ok: false, error: message };
}

/**************************************************************
 * 初回セットアップ（手動で1回だけ実行）
 *   GASエディタでこの関数を選んで実行すると、必要な4シートと
 *   見出し・サンプルを自動生成します。
 **************************************************************/
function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  ensureSheetWithHeaders_(ss, SHEET.SETTINGS, ['キー', '値']);
  if (!getSetting_('定例会名')) {
    ss.getSheetByName(SHEET.SETTINGS).appendRow(['定例会名', '令和8年第2回定例会']);
  }

  ensureSheetWithHeaders_(ss, SHEET.ROSTER,
    ['メールアドレス', '議員氏名', '会派', '発言順位', '質問日']);

  ensureSheetWithHeaders_(ss, SHEET.MASTER,
    ['提出ID', '発言順位', '提出日時', '定例会名', '議員氏名',
     '会派', '質問日', '通告時間(分)', 'メールアドレス']);

  ensureSheetWithHeaders_(ss, SHEET.DETAIL,
    ['提出ID', '大項目番号', '件名', '中項目番号', '小見出し',
     '内容番号', '質問文', '答弁者']);

  ss.toast('セットアップ完了：4シートを用意しました。');
}

function ensureSheetWithHeaders_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
}
