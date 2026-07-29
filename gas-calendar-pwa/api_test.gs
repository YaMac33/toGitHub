/** ===== API疎通確認用(検証専用・本実装ではない) ===== */
function doGet(e) {
  // 既存の doGet(HTML配信)と名前が重複するため、検証中は一時的にこちらだけ使う
  if (e.parameter.action === 'ping') {
    const payload = { ok: true, time: new Date().toISOString(), from: 'GAS' };
    return ContentService.createTextOutput(JSON.stringify(payload))
      .setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'unknown action' }))
    .setMimeType(ContentService.MimeType.JSON);
}
