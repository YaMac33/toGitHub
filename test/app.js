(function () {
  "use strict";

  const result1 = document.getElementById("result1");
  const result2 = document.getElementById("result2");
  const result3 = document.getElementById("result3");
  const envInfo = document.getElementById("envInfo");

  function setOk(el, message) {
    el.innerHTML = '<span class="ok">OK</span><br>' + escapeHtml(message);
  }

  function setNg(el, message) {
    el.innerHTML = '<span class="ng">NG</span><br>' + escapeHtml(message);
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function showEnvInfo() {
    const lines = [
      "URL: " + location.href,
      "protocol: " + location.protocol,
      "userAgent: " + navigator.userAgent,
      "fetch available: " + (typeof fetch === "function"),
      "JSON available: " + (typeof JSON === "object"),
      "JSON.parse available: " + (typeof JSON.parse === "function"),
      "JSON.stringify available: " + (typeof JSON.stringify === "function")
    ];
    envInfo.textContent = lines.join("\n");
  }

  function testJsonBasic() {
    try {
      const jsonText = '{"name":"テスト","year":2026,"items":["A","B","C"]}';
      const data = JSON.parse(jsonText);
      const backToText = JSON.stringify(data);

      setOk(
        result1,
        "JSON.parse / JSON.stringify は使えました。\n" +
        "name = " + data.name + "\n" +
        "year = " + data.year + "\n" +
        "stringify結果 = " + backToText
      );
    } catch (error) {
      setNg(result1, "JSON機能エラー: " + error.message);
    }
  }

  function testFetchJson() {
    if (typeof fetch !== "function") {
      setNg(result2, "fetch API が使えません。かなり古いブラウザの可能性があります。");
      result3.textContent = "test.json の取得テストは未実行です。";
      return;
    }

    fetch("./test.json")
      .then(function (response) {
        if (!response.ok) {
          throw new Error("HTTPエラー: " + response.status + " " + response.statusText);
        }
        return response.json();
      })
      .then(function (data) {
        setOk(
          result2,
          "fetch で test.json を読み込めました。"
        );
        result3.textContent = JSON.stringify(data, null, 2);
      })
      .catch(function (error) {
        setNg(
          result2,
          "fetch または JSON読込に失敗しました。\n" +
          "考えられる原因:\n" +
          "・file:// では fetch が禁止されている\n" +
          "・CORS制限\n" +
          "・ブラウザが古い\n" +
          "・test.json の場所が違う\n\n" +
          "詳細: " + error.message
        );
        result3.textContent = "読込失敗";
      });
  }

  showEnvInfo();
  testJsonBasic();
  testFetchJson();
})();
