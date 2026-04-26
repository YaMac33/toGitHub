# koutei4

申請した交通手段・交通費と、実際に利用した交通手段・交通費を比較するための静的HTMLアプリです。

## 使い方

`index.html` をブラウザで開くと、以下の2つのデータを読み込んで比較します。

- `data/request.js`: 経理部門へ申請する交通手段・交通費
- `data/actual.js`: 実際に利用した交通手段・交通費

比較は `schedule_id` が同じ行同士で行います。

## 表示ルール

- `category` が `移動` の行だけを表示します。
- 申請と実績に相違がある行だけを表示します。
- 相違がない移動行、移動以外の行は表示しません。
- 移動手段は `detail` を比較します。
- 交通費は `transport_cost` を比較します。
- 差額は `実績 - 申請` として表示します。

## データ形式

申請データは `window.KOUTEI_COMPARE.request` に入れます。

```js
window.KOUTEI_COMPARE = window.KOUTEI_COMPARE || {};

window.KOUTEI_COMPARE.request = {
  meta: {
    "title": "交通費比較表",
    "subtitle": "経理申請内容と実績内容の比較",
    "period_start": "2026/10/13",
    "period_end": "2026/10/14",
    "participants": "視察団 5名",
    "note": ""
  },
  itinerary: [
    {
      "schedule_id": "100001",
      "day_no": "1",
      "date": "2026-10-13",
      "start_time": "07:45",
      "end_time": "08:50",
      "category": "移動",
      "title": "○○駅 → 首都空港第1ターミナル",
      "detail": "空港連絡バス",
      "distance": "35km",
      "transport_cost": "1500",
      "note": "",
      "sort_order": "101"
    }
  ]
};
```

実績データは `window.KOUTEI_COMPARE.actual` に入れます。

```js
window.KOUTEI_COMPARE.actual = {
  meta: {
    "title": "交通費比較表",
    "subtitle": "経理申請内容と実績内容の比較",
    "period_start": "2026/10/13",
    "period_end": "2026/10/14",
    "participants": "視察団 5名",
    "note": ""
  },
  itinerary: [
    {
      "schedule_id": "100001",
      "day_no": "1",
      "date": "2026-10-13",
      "start_time": "07:45",
      "end_time": "08:50",
      "category": "移動",
      "title": "○○駅 → 首都空港第1ターミナル",
      "detail": "タクシー",
      "distance": "35km",
      "transport_cost": "6800",
      "note": "早朝でバスに間に合わず",
      "sort_order": "101"
    }
  ]
};
```

## itinerary の列

Excelなどから出力する場合は、以下の列を想定しています。

```text
schedule_id
day_no
date
start_time
end_time
category
title
detail
distance
transport_cost
note
sort_order
```

## 交通費の入力

`transport_cost` は以下のような形式に対応しています。

- `"1500"`
- `"1,500"`
- `"1,500円"`
- `"¥1,500"`

空欄の場合は交通費なしとして扱います。

## ファイル構成

```text
koutei4/
  index.html
  app.js
  style.css
  README.md
  data/
    request.js
    actual.js
    itinerary.js
```

`itinerary.js` は旧形式または参考用のデータです。現在の比較画面では `request.js` と `actual.js` を読み込みます。
