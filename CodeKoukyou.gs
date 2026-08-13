/**
 * 業務振り分けボード ― サーバーサイド
 *
 * 【使い方】
 * 1. スプレッドシートを1つ用意し、そのIDを SPREADSHEET_ID に貼る
 *    （スプレッドシートに紐づくコンテナバインドのスクリプトなら空のままでOK）
 * 2. エディタで setup を1回実行して、シートと初期データを作る
 * 3. デプロイ → 新しいデプロイ → 種類「ウェブアプリ」
 */

const SPREADSHEET_ID = ''; // 例: '1AbCdEfG...'

const SHEETS = {
  sections: { name: 'sections', header: ['id', 'group', 'name', 'order'] },
  cards:    { name: 'cards',    header: ['id', 'sectionId', 'order', 'name', 'tagIds', 'revision'] },
  tags:     { name: 'tags',     header: ['id', 'name', 'color'] }
};

const GROUPS = [
  { key: 'line', label: 'スマート公共ラボ（LINE）', note: '問い合わせ・予約' },
  { key: 'logo', label: 'LoGoフォーム',            note: '申請・庁内業務' }
];

// ───────────────────────────────── 画面

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('業務振り分けボード')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// ───────────────────────────────── 初期設定

function setup() {
  const ss = getSs_();
  Object.keys(SHEETS).forEach(function (key) {
    const def = SHEETS[key];
    let sh = ss.getSheetByName(def.name);
    if (!sh) sh = ss.insertSheet(def.name);
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, def.header.length).setValues([def.header]);
      sh.setFrozenRows(1);
    }
  });
  if (readRows_(SHEETS.sections).length === 0) seed_();
  return 'セットアップが完了しました';
}

function seed_() {
  const sections = [
    ['s1', 'line', '問い合わせ対応（チャットボット）', 1],
    ['s2', 'line', '予約・カレンダー系', 2],
    ['s3', 'line', '通知・配信（セグメント配信）', 3],
    ['s4', 'line', 'その他LINE特性を活かす業務', 4],
    ['s5', 'logo', '住民向け申請手続き', 1],
    ['s6', 'logo', '住民アンケート・意見募集', 2],
    ['s7', 'logo', '庁内業務（職員間・自治体間）', 3],
    ['s8', 'logo', '決済・認証を伴う複雑な申請', 4]
  ];

  const cardNames = {
    s1: ['ごみの分別方法・収集日案内', '保育園・幼稚園の空き状況案内', '税金・保険料の支払い方法案内',
         '各種証明書の取得方法案内', '新型感染症・予防接種に関する一般的なQ&A'],
    s2: ['公民館・体育館などの施設予約', '児童遊戯施設・子育て支援施設の利用予約', '健診・予防接種の予約',
         'ワクチン接種会場の予約', '粗大ごみ回収の予約受付'],
    s3: ['防災・避難情報のプッシュ通知', 'ごみ収集日のリマインド配信', 'イベント・広報情報の地域別配信',
         '子育て世帯向けの制度案内配信'],
    s4: ['観光スポット検索・観光案内', '位置情報を使った施設・避難所案内', '災害時モードでの緊急案内'],
    s5: ['給付金・助成金のオンライン申請（子育て世帯応援給付金など）', '各種証明書（住民票・課税証明書等）のオンライン請求',
         '学童クラブ・保育施設の利用申請', '転入・転出に伴う諸手続きの事前申請', '道路・公共施設の不具合通報'],
    s6: ['パブリックコメント募集', '住民満足度調査', 'イベント・講座の申込・アンケート'],
    s7: ['会議室・公用車の予約管理', '職員向け研修申込', '議会・委員会関連の資料請求フォーム',
         '部署間の照会・回答集約（庁内アンケート）', '各種内部申請（休暇届、経費精算関連の簡易フォームなど）'],
    s8: ['施設利用料・手数料のオンライン決済を伴う申請', 'マイナンバーカード認証が必要な複雑な様式の手続き']
  };

  const cards = [];
  let n = 0;
  sections.forEach(function (s) {
    (cardNames[s[0]] || []).forEach(function (name, i) {
      n++;
      const tagIds = s[0] === 's8' ? 't1' : '';
      cards.push(['c' + n, s[0], i + 1, name, tagIds, 1]);
    });
  });

  appendRows_(SHEETS.sections, sections);
  appendRows_(SHEETS.cards, cards);
  appendRows_(SHEETS.tags, [['t1', '決済オプション対象', '#b7791f']]);
}

// ───────────────────────────────── 読み取り

function getBoard() {
  setup();
  return readBoard_();
}

function readBoard_() {
  const sections = readRows_(SHEETS.sections)
    .map(function (r) {
      return { id: r.id, group: r.group, name: r.name, order: Number(r.order) || 0 };
    })
    .sort(function (a, b) { return a.order - b.order; });

  const cards = readRows_(SHEETS.cards)
    .map(function (r) {
      return {
        id: r.id,
        sectionId: r.sectionId,
        order: Number(r.order) || 0,
        name: r.name,
        tagIds: String(r.tagIds || '').split(',').filter(String),
        revision: Number(r.revision) || 1
      };
    })
    .sort(function (a, b) { return a.order - b.order; });

  const tags = readRows_(SHEETS.tags).map(function (r) {
    return { id: r.id, name: r.name, color: r.color || '#666666' };
  });

  return { groups: GROUPS, sections: sections, cards: cards, tags: tags };
}

// ───────────────────────────────── 書き込み

/**
 * カードの移動・並べ替え。
 * ops: [{id, sectionId, order, revision}]
 * revision が食い違ったら {conflict:true} を返す（他の職員が先に編集した場合）
 */
function moveCards(ops) {
  return withLock_(function () {
    const sh = sheet_(SHEETS.cards);
    const idx = rowIndex_(sh, SHEETS.cards.header);
    const values = sh.getDataRange().getValues();
    const col = colMap_(SHEETS.cards.header);

    for (let i = 0; i < ops.length; i++) {
      const row = idx[ops[i].id];
      if (!row) return { conflict: true, reason: 'カードが見つかりません' };
      const current = Number(values[row - 1][col.revision]) || 1;
      if (current !== Number(ops[i].revision)) return { conflict: true };
    }

    ops.forEach(function (op) {
      const row = idx[op.id];
      values[row - 1][col.sectionId] = op.sectionId;
      values[row - 1][col.order] = op.order;
      values[row - 1][col.revision] = Number(op.revision) + 1;
    });

    writeAll_(sh, values);
    return { ok: true, board: readBoard_() };
  });
}

function setCardTags(id, tagIds, revision) {
  return withLock_(function () {
    const sh = sheet_(SHEETS.cards);
    const idx = rowIndex_(sh, SHEETS.cards.header);
    const col = colMap_(SHEETS.cards.header);
    const row = idx[id];
    if (!row) return { conflict: true, reason: 'カードが見つかりません' };

    const values = sh.getDataRange().getValues();
    if ((Number(values[row - 1][col.revision]) || 1) !== Number(revision)) return { conflict: true };

    values[row - 1][col.tagIds] = (tagIds || []).join(',');
    values[row - 1][col.revision] = Number(revision) + 1;
    writeAll_(sh, values);
    return { ok: true, board: readBoard_() };
  });
}

function addCard(sectionId, name) {
  return withLock_(function () {
    const rows = readRows_(SHEETS.cards);
    let max = 0;
    let maxOrder = 0;
    rows.forEach(function (r) {
      const n = Number(String(r.id).replace(/\D/g, '')) || 0;
      if (n > max) max = n;
      if (r.sectionId === sectionId && Number(r.order) > maxOrder) maxOrder = Number(r.order);
    });
    appendRows_(SHEETS.cards, [['c' + (max + 1), sectionId, maxOrder + 1, name, '', 1]]);
    return { ok: true, board: readBoard_() };
  });
}

function renameCard(id, name, revision) {
  return withLock_(function () {
    const sh = sheet_(SHEETS.cards);
    const idx = rowIndex_(sh, SHEETS.cards.header);
    const col = colMap_(SHEETS.cards.header);
    const row = idx[id];
    if (!row) return { conflict: true, reason: 'カードが見つかりません' };

    const values = sh.getDataRange().getValues();
    if ((Number(values[row - 1][col.revision]) || 1) !== Number(revision)) return { conflict: true };

    values[row - 1][col.name] = name;
    values[row - 1][col.revision] = Number(revision) + 1;
    writeAll_(sh, values);
    return { ok: true, board: readBoard_() };
  });
}

function deleteCard(id) {
  return withLock_(function () {
    const sh = sheet_(SHEETS.cards);
    const idx = rowIndex_(sh, SHEETS.cards.header);
    if (idx[id]) sh.deleteRow(idx[id]);
    return { ok: true, board: readBoard_() };
  });
}

/**
 * タグの一括保存。tags: [{id, name, color}]（id が空なら新規）
 * 消えたタグは全カードから自動的に外す。
 */
function saveTags(tags) {
  return withLock_(function () {
    const existing = readRows_(SHEETS.tags);
    let max = 0;
    existing.forEach(function (r) {
      const n = Number(String(r.id).replace(/\D/g, '')) || 0;
      if (n > max) max = n;
    });

    const rows = (tags || []).map(function (t) {
      const id = t.id || 't' + (++max);
      return [id, t.name, t.color || '#666666'];
    });

    const shTags = sheet_(SHEETS.tags);
    if (shTags.getLastRow() > 1) shTags.deleteRows(2, shTags.getLastRow() - 1);
    if (rows.length) appendRows_(SHEETS.tags, rows);

    const alive = {};
    rows.forEach(function (r) { alive[r[0]] = true; });

    const shCards = sheet_(SHEETS.cards);
    const col = colMap_(SHEETS.cards.header);
    const values = shCards.getDataRange().getValues();
    let changed = false;
    for (let i = 1; i < values.length; i++) {
      const ids = String(values[i][col.tagIds] || '').split(',').filter(String);
      const kept = ids.filter(function (id) { return alive[id]; });
      if (kept.length !== ids.length) {
        values[i][col.tagIds] = kept.join(',');
        values[i][col.revision] = (Number(values[i][col.revision]) || 1) + 1;
        changed = true;
      }
    }
    if (changed) writeAll_(shCards, values);

    return { ok: true, board: readBoard_() };
  });
}

// ───────────────────────────────── 共通処理

function getSs_() {
  if (SPREADSHEET_ID) return SpreadsheetApp.openById(SPREADSHEET_ID);
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) throw new Error('SPREADSHEET_ID にスプレッドシートのIDを設定してください');
  return active;
}

function sheet_(def) {
  const sh = getSs_().getSheetByName(def.name);
  if (!sh) throw new Error(def.name + ' シートがありません。setup を実行してください');
  return sh;
}

function colMap_(header) {
  const map = {};
  header.forEach(function (h, i) { map[h] = i; });
  return map;
}

function readRows_(def) {
  const sh = getSs_().getSheetByName(def.name);
  if (!sh || sh.getLastRow() < 2) return [];
  const values = sh.getRange(2, 1, sh.getLastRow() - 1, def.header.length).getValues();
  return values
    .filter(function (row) { return String(row[0]).length > 0; })
    .map(function (row) {
      const obj = {};
      def.header.forEach(function (h, i) { obj[h] = row[i]; });
      return obj;
    });
}

function appendRows_(def, rows) {
  if (!rows.length) return;
  const sh = sheet_(def);
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, def.header.length).setValues(rows);
}

function rowIndex_(sh, header) {
  const ids = sh.getRange(1, 1, sh.getLastRow(), 1).getValues();
  const map = {};
  for (let i = 1; i < ids.length; i++) map[ids[i][0]] = i + 1;
  return map;
}

function writeAll_(sh, values) {
  sh.getRange(1, 1, values.length, values[0].length).setValues(values);
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return { conflict: true, reason: '他の人が編集中です' };
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}
