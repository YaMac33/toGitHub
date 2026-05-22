/*
 * 設定ファイルのサンプルです。
 * 本番接続時はこのファイルを js/config.js にコピーし、
 * index.html の読み込み先を config.js に変更して利用する想定です。
 */
const APP_CONFIG = {
  API_BASE_URL: "https://script.google.com/macros/s/AKfycbwWiGOu7LjvHPllRMkt52Wc02NS5YbqD-Ic7q9UkjjSnLfLfocpfYX4IHfwHzPvc1cDpA/exec",
  USE_MOCK_API: true
};

window.APP_CONFIG = APP_CONFIG;
