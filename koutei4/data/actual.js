window.KOUTEI_COMPARE = window.KOUTEI_COMPARE || {};

window.KOUTEI_COMPARE.actual = {
  meta: {
    "title": "交通費比較表（サンプル）",
    "subtitle": "経理申請内容と実績内容の比較",
    "period_start": "2026/10/13",
    "period_end": "2026/10/14",
    "participants": "視察団 5名",
    "note": "実績データは出張後に確定した交通手段・交通費です。"
  },
  itinerary: [
    {
      "schedule_id": "100001",
      "day_no": "1",
      "date": "2026-10-13",
      "start_time": "07:30",
      "end_time": "07:45",
      "category": "集合",
      "title": "○○駅南口ロータリー",
      "detail": "7:30集合",
      "distance": "",
      "transport_cost": "",
      "note": "",
      "sort_order": "101"
    },
    {
      "schedule_id": "100002",
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
      "sort_order": "102"
    },
    {
      "schedule_id": "100003",
      "day_no": "1",
      "date": "2026-10-13",
      "start_time": "09:40",
      "end_time": "11:10",
      "category": "移動",
      "title": "首都空港 → ○○空港",
      "detail": "国内線フライト",
      "distance": "850km",
      "transport_cost": "28000",
      "note": "航空券手配済",
      "sort_order": "103"
    },
    {
      "schedule_id": "100004",
      "day_no": "1",
      "date": "2026-10-13",
      "start_time": "12:30",
      "end_time": "13:40",
      "category": "移動",
      "title": "○○空港 → ○○市役所",
      "detail": "路線バス",
      "distance": "45km",
      "transport_cost": "1300",
      "note": "運賃改定後料金",
      "sort_order": "104"
    },
    {
      "schedule_id": "200001",
      "day_no": "2",
      "date": "2026-10-14",
      "start_time": "09:10",
      "end_time": "09:30",
      "category": "移動",
      "title": "ホテル → △△市役所",
      "detail": "徒歩",
      "distance": "1.2km",
      "transport_cost": "0",
      "note": "",
      "sort_order": "201"
    },
    {
      "schedule_id": "200002",
      "day_no": "2",
      "date": "2026-10-14",
      "start_time": "13:10",
      "end_time": "15:00",
      "category": "移動",
      "title": "△△市 → □□市",
      "detail": "高速バス",
      "distance": "118km",
      "transport_cost": "3600",
      "note": "列車運休のため変更",
      "sort_order": "202"
    }
  ]
};
