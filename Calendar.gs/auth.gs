/** =========================================================
 *  auth.gs
 *  Apps Script のセッション情報による認証まわりを集約したファイル。
 *  - Session.getActiveUser() でアクセスしている本人のメールアドレスを取得
 *  - Whitelist シート(A列/3行目以降)のメールアドレスと照合
 *  同一プロジェクト内なので calendar.gs から各関数を呼び出せる。
 *
 *  注意: Session.getActiveUser() が値を返すには、ウェブアプリのデプロイ設定で
 *  「実行するユーザー: このアプリにアクセスしているユーザー」
 *  「アクセスできるユーザー: Google アカウントを持つ全員」など、
 *  ログインを必須にする設定にしておく必要がある。
 * ========================================================= */

/** ===== 認証設定 ===== */
const WHITELIST_SHEET_NAME = 'Whitelist';   // 許可メールアドレスのシート名

// Whitelistシートの読み取り基準行。calendar.gs の DATA_START_ROW と合わせている。
// (このファイル単体でも動くよう、ここで独自に定義する)
const WL_DATA_START_ROW = 3;   // 3行目からデータ

// ホワイトリストのキャッシュ秒数(0にするとキャッシュしない)
const WL_CACHE_SEC = 300;      // 5分
const WL_CACHE_KEY = 'whitelist_emails_v1';


/** ===== ホワイトリスト ===== */

// Whitelistシートの3行目以降・A列からメールアドレスを読み、
// 前後空白除去・小文字化した配列で返す。CacheServiceで数分キャッシュする。
function getWhitelist_() {
  const cache = CacheService.getScriptCache();
  if (WL_CACHE_SEC > 0) {
    const cached = cache.get(WL_CACHE_KEY);
    if (cached) {
      try { return JSON.parse(cached); } catch (e) { /* 壊れていたら読み直す */ }
    }
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(WHITELIST_SHEET_NAME);
  if (!sh) return [];

  const last = sh.getLastRow();
  if (last < WL_DATA_START_ROW) return [];

  const vals = sh.getRange(WL_DATA_START_ROW, 1, last - WL_DATA_START_ROW + 1, 1).getValues();
  const out = [];
  vals.forEach(function (r) {
    const email = String(r[0] || '').trim().toLowerCase();
    if (email) out.push(email);
  });

  if (WL_CACHE_SEC > 0) {
    cache.put(WL_CACHE_KEY, JSON.stringify(out), WL_CACHE_SEC);
  }
  return out;
}

// ホワイトリストのキャッシュを手動で消したいとき用(シート更新直後などに実行)
function clearWhitelistCache() {
  CacheService.getScriptCache().remove(WL_CACHE_KEY);
}


/** ===== セッション認証 ===== */

// アクセスしている本人の Google アカウントのメールアドレスを取得する(小文字化)。
function getActiveUserEmail_() {
  const email = Session.getActiveUser().getEmail();
  return String(email || '').trim().toLowerCase();
}

// 各APIの先頭で呼ぶ共通ガード。ホワイトリストに無ければ例外を投げる。
function requireAuth_() {
  const email = getActiveUserEmail_();
  if (!email) {
    throw new Error('認証エラー: Googleアカウントを取得できません(ウェブアプリのアクセス設定をご確認ください)');
  }
  if (getWhitelist_().indexOf(email) === -1) {
    throw new Error('認証エラー: このアカウントには利用権限がありません(' + email + ')');
  }
  return email;
}


/** ===== テスト用 ===== */

// ホワイトリストが正しく読めているか確認する。
function test_getWhitelist() {
  clearWhitelistCache();                 // キャッシュを無視して実シートを読む
  const list = getWhitelist_();
  Logger.log('件数: ' + list.length);
  Logger.log(JSON.stringify(list, null, 2));
}

// 自分のメールアドレスが取得できるか・ホワイトリストと照合されるか確認する。
function test_requireAuth() {
  Logger.log('取得したメールアドレス: ' + getActiveUserEmail_());
  Logger.log('認証結果: ' + requireAuth_());
}
