'use strict';

const msg = document.getElementById('msg');

document.getElementById('ask').addEventListener('click', async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    msg.style.color = 'var(--ok)';
    msg.textContent = '許可されました。このタブを閉じて、もう一度音声入力を始めてください。';
  } catch (e) {
    msg.style.color = 'var(--ng)';
    msg.textContent =
      e && e.name === 'NotFoundError'
        ? 'マイクが見つかりませんでした。接続を確認してください。'
        : '許可されませんでした。アドレスバー左のアイコンから、マイクを「許可」に変更してください。';
  }
});
