// data.js
const TSV_DATA = `氏名\t部署\t案件名\t日付\t状態
山田太郎\t総務課\t○○整備\t2024-04-01\t完了
佐藤花子\t福祉課\t△△支援\t2024-04-05\t進行中`;

// TSVをパースしてオブジェクト配列に変換
const HEADERS = TSV_DATA.trim().split('\n')[0].split('\t');
const DATA = TSV_DATA.trim().split('\n').slice(1).map(row => {
  const cols = row.split('\t');
  return Object.fromEntries(HEADERS.map((h, i) => [h, cols[i] ?? '']));
});