window.APP_DATA = window.APP_DATA || {};

// 以下がVBAから自動生成される想定のJSONデータです
Object.assign(window.APP_DATA, {
  // 1. 会議マスタ（会議ファイルから生成）
  meetings: [
    {
      meeting_id: "R06-1",
      session_name: "令和6年第1回定例会",
      session_type: "REGULAR", // 定例会
      start_date: "2026-02-15", // 会期開始日
      end_date: "2026-03-20",   // 会期終了日
      schedule_file_path: "docs/R06-1_schedule.pdf",
      sort_order: 1
    },
    {
      meeting_id: "R06-2",
      session_name: "令和6年第2回臨時会",
      session_type: "EXTRA", // 臨時会
      start_date: "2026-05-10",
      end_date: "2026-05-12",
      schedule_file_path: "",
      sort_order: 2
    }
  ],

  // 2. イベント日程（会議ファイルの1行1行から生成）
  events: [
    {
      event_id: "20260215-1", // 日付-同日開催番号
      meeting_id: "R06-1",
      event_date: "2026-02-15",
      event_type_id: "PLENARY", // 本会議
      committee_id: "",
      duration: 2.5, // 実時間数（2.5時間）
      note: "市長施政方針"
    },
    {
      event_id: "20260218-1",
      meeting_id: "R06-1",
      event_date: "2026-02-18",
      event_type_id: "STEERING_COMMITTEE", // 議会運営委員会
      committee_id: "",
      duration: 1.0,
      note: ""
    },
    {
      event_id: "20260305-1",
      meeting_id: "R06-1",
      event_date: "2026-03-05",
      event_type_id: "COMMITTEE",
      committee_id: "C-SOMU", // 常任委員会（総務）
      duration: 3.0,
      note: "議案審査"
    },
    {
      event_id: "20260320-1",
      meeting_id: "R06-1",
      event_date: "2026-03-20",
      event_type_id: "PLENARY",
      committee_id: "",
      duration: 1.5,
      note: "委員長報告・採決"
    }
  ],

  // 常任委員会マスタ（固定値でOK）
  committees: [
    { committee_id: "C-SOMU", committee_name: "総務委員会" },
    { committee_id: "C-KYOIKU", committee_name: "教育福祉委員会" }
  ],

  // 3. 案件マスタ（案件ファイルから重複を除いて生成）
  items: [
    {
      item_id: "ITEM-R06-1-B1",
      item_class: "BILL", // 議案
      item_no: "議案第1号",
      item_no_numeric: 1, // ソート用
      title: "令和6年度一般会計予算"
    },
    {
      item_id: "ITEM-R06-1-B2",
      item_class: "BILL",
      item_no: "議案第2号",
      item_no_numeric: 2,
      title: "○○市税条例の一部を改正する条例"
    },
    {
      item_id: "ITEM-R06-1-P1",
      item_class: "PETITION", // 請願
      item_no: "請願第1号",
      item_no_numeric: 1,
      title: "こども医療費の無償化を求める請願"
    }
  ],

  // 4. 案件アクション履歴（案件ファイルの日付列から生成）
  item_actions: [
    // 議案第1号の履歴
    { action_id: "A1", item_id: "ITEM-R06-1-B1", meeting_id: "R06-1", action_type: "PROPOSED", action_date: "2026-02-15" },
    { action_id: "A2", item_id: "ITEM-R06-1-B1", meeting_id: "R06-1", action_type: "REFERRED", action_date: "2026-02-15" },
    { action_id: "A3", item_id: "ITEM-R06-1-B1", meeting_id: "R06-1", action_type: "DECIDED", action_date: "2026-03-20", result_label: "原案可決" },
    
    // 議案第2号の履歴
    { action_id: "A4", item_id: "ITEM-R06-1-B2", meeting_id: "R06-1", action_type: "PROPOSED", action_date: "2026-02-15" },
    { action_id: "A5", item_id: "ITEM-R06-1-B2", meeting_id: "R06-1", action_type: "REFERRED", action_date: "2026-02-15" },
    { action_id: "A6", item_id: "ITEM-R06-1-B2", meeting_id: "R06-1", action_type: "DECIDED", action_date: "2026-03-20", result_label: "原案可決" },

    // 請願第1号の履歴（継続審査になるパターン）
    { action_id: "A7", item_id: "ITEM-R06-1-P1", meeting_id: "R06-1", action_type: "REFERRED", action_date: "2026-02-15" },
    { action_id: "A8", item_id: "ITEM-R06-1-P1", meeting_id: "R06-1", action_type: "CONTINUED", action_date: "2026-03-20" }
  ],

  // 5. 議員マスタ
  members: [
    { member_id: "M-001", member_name: "山田 太郎", member_no: 1 },
    { member_id: "M-002", member_name: "佐藤 花子", member_no: 2 }
  ],

  // 6. 一般質問（質問ファイルから生成）
  questions: [
    {
      meeting_id: "R06-1",
      question_date: "2026-02-25",
      notice_no: 1, // 通告番号
      member_name: "山田 太郎",
      group_name: "みらい会派",
      allotted_minutes: 60,
      note: "防災対策の強化について"
    },
    {
      meeting_id: "R06-1",
      question_date: "2026-02-25",
      notice_no: 2,
      member_name: "佐藤 花子",
      group_name: "市民ネットワーク",
      allotted_minutes: 45,
      note: "子育て支援策について"
    }
  ],

  // --- 以下、特別委員会関連 ---
  special_committees: [
    { special_committee_id: "SC-01", special_committee_name: "新庁舎建設特別委員会", active_flag: "1", sort_order: 1 }
  ],
  special_committee_instances: [
    {
      special_committee_instance_id: "SCI-R06-1-SC01",
      special_committee_id: "SC-01",
      meeting_id: "R06-1",
      established_date: "2025-06-01",
      end_date: "",
      note: "基本設計について協議"
    }
  ],
  special_committee_meetings: [
    { special_committee_instance_id: "SCI-R06-1-SC01", meeting_date: "2026-03-10", note: "第5回会議" }
  ],
  special_committee_members: [
    { special_committee_instance_id: "SCI-R06-1-SC01", member_id: "M-001", role_name: "委員長" },
    { special_committee_instance_id: "SCI-R06-1-SC01", member_id: "M-002", role_name: "副委員長" }
  ]
});
