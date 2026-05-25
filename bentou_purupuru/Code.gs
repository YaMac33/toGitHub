// ==============================
// Webアプリ入口
// ==============================

function doPost(e) {
  return handleOrderPost_(e);
}

function doGet(e) {
  return handlePublicOrdersGet_(e);
}