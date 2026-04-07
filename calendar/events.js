window.APP_DATA = window.APP_DATA || {};

window.APP_DATA.events = [

  // ■ 定例会（複数日）
  {
    event_id: "EVT20260401_01",
    date: "2026-04-01",
    end_date: "2026-04-20",
    title: "令和8年第1回定例会（会期）",
    start_time: "",
    end_time: "",
    is_all_day: 1,
    category: "TERM",
    department_name: "議会事務局",
    location: "",
    note: "会期全体",
    sort_order: 0
  },

  // ■ 本会議（初日）
  {
    event_id: "EVT20260401_02",
    date: "2026-04-01",
    end_date: "",
    title: "本会議（初日）",
    start_time: "10:00",
    end_time: "16:00",
    is_all_day: 0,
    category: "MEETING",
    department_name: "議会事務局",
    location: "本会議場",
    note: "開会・議案上程",
    sort_order: 1
  },

  // ■ 議運
  {
    event_id: "EVT20260402_01",
    date: "2026-04-02",
    end_date: "",
    title: "議会運営委員会",
    start_time: "09:30",
    end_time: "11:00",
    is_all_day: 0,
    category: "COMMITTEE",
    department_name: "議会事務局",
    location: "第1委員会室",
    note: "日程調整",
    sort_order: 1
  },

  // ■ 一般質問（1日目）
  {
    event_id: "EVT20260405_01",
    date: "2026-04-05",
    end_date: "",
    title: "一般質問（1日目）",
    start_time: "10:00",
    end_time: "17:00",
    is_all_day: 0,
    category: "QUESTION",
    department_name: "議会事務局",
    location: "本会議場",
    note: "5人登壇",
    sort_order: 1
  },

  // ■ 同日イベント（3件超テスト）
  {
    event_id: "EVT20260405_02",
    date: "2026-04-05",
    end_date: "",
    title: "会議室予約（総務課）",
    start_time: "13:00",
    end_time: "15:00",
    is_all_day: 0,
    category: "RESERVE",
    department_name: "総務課",
    location: "会議室A",
    note: "内部打合せ",
    sort_order: 2
  },
  {
    event_id: "EVT20260405_03",
    date: "2026-04-05",
    end_date: "",
    title: "来客対応",
    start_time: "15:30",
    end_time: "16:30",
    is_all_day: 0,
    category: "OTHER",
    department_name: "企画課",
    location: "応接室",
    note: "",
    sort_order: 3
  },
  {
    event_id: "EVT20260405_04",
    date: "2026-04-05",
    end_date: "",
    title: "庁内調整会議",
    start_time: "17:00",
    end_time: "18:00",
    is_all_day: 0,
    category: "OTHER",
    department_name: "総務課",
    location: "会議室B",
    note: "",
    sort_order: 4
  },

  // ■ 一般質問（2日目）
  {
    event_id: "EVT20260406_01",
    date: "2026-04-06",
    end_date: "",
    title: "一般質問（2日目）",
    start_time: "10:00",
    end_time: "17:00",
    is_all_day: 0,
    category: "QUESTION",
    department_name: "議会事務局",
    location: "本会議場",
    note: "4人登壇",
    sort_order: 1
  },

  // ■ 常任委員会
  {
    event_id: "EVT20260410_01",
    date: "2026-04-10",
    end_date: "",
    title: "総務常任委員会",
    start_time: "10:00",
    end_time: "12:00",
    is_all_day: 0,
    category: "COMMITTEE",
    department_name: "議会事務局",
    location: "第1委員会室",
    note: "条例審査",
    sort_order: 1
  },

  {
    event_id: "EVT20260415_01",
    date: "2026-04-15",
    end_date: "",
    title: "都市環境常任委員会",
    start_time: "10:00",
    end_time: "12:00",
    is_all_day: 0,
    category: "COMMITTEE",
    department_name: "議会事務局",
    location: "第2委員会室",
    note: "議案審査",
    sort_order: 1
  },

  // ■ 本会議（最終日）
  {
    event_id: "EVT20260420_01",
    date: "2026-04-20",
    end_date: "",
    title: "本会議（最終日）",
    start_time: "10:00",
    end_time: "15:00",
    is_all_day: 0,
    category: "MEETING",
    department_name: "議会事務局",
    location: "本会議場",
    note: "採決",
    sort_order: 1
  },

  // ■ 休館日
  {
    event_id: "EVT20260422_01",
    date: "2026-04-22",
    end_date: "",
    title: "休館日",
    start_time: "",
    end_time: "",
    is_all_day: 1,
    category: "HOLIDAY",
    department_name: "",
    location: "庁舎",
    note: "全館休館",
    sort_order: 0
  },

  // ■ 別日の予約
  {
    event_id: "EVT20260425_01",
    date: "2026-04-25",
    end_date: "",
    title: "会議室予約（企画課）",
    start_time: "09:00",
    end_time: "10:00",
    is_all_day: 0,
    category: "RESERVE",
    department_name: "企画課",
    location: "会議室B",
    note: "",
    sort_order: 1
  }

];