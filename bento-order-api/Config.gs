var BENTO_SHEET_NAMES = {
  ordersAdmin: 'orders_admin',
  ordersPublic: 'orders_public',
  summaryDepartment: 'summary_department',
  summaryTotal: 'summary_total',
  menuMaster: 'menu_master',
  deliveryDates: 'delivery_dates',
  settings: 'settings',
  logs: 'logs'
};

var BENTO_HEADERS = {
  ordersAdmin: [
    '注文ID',
    '受付日時',
    '受取日',
    '担当部署',
    '注文担当者名',
    'メールアドレス',
    'メニューID',
    'メニュー',
    '単価',
    '個数',
    '小計',
    'ステータス',
    '変更前注文ID',
    '備考',
    '締切判定',
    '処理種別',
    '更新日時',
    '内部メモ'
  ],
  ordersPublic: [
    '注文ID',
    '受付日時',
    '受取日',
    '担当部署',
    '注文担当者名',
    'メニュー',
    '個数',
    'ステータス',
    '変更前注文ID',
    '更新日時'
  ],
  summaryDepartment: [
    '受取日',
    '担当部署',
    'メニュー',
    '単価',
    '合計個数',
    '合計金額'
  ],
  summaryTotal: [
    '受取日',
    'メニュー',
    '単価',
    '合計個数',
    '合計金額'
  ],
  menuMaster: [
    'メニューID',
    'メニュー名',
    '単価',
    '説明',
    '受付中',
    '表示順',
    '備考'
  ],
  deliveryDates: [
    '受取日',
    '表示名',
    '受付中',
    '締切日時',
    '表示順',
    '備考'
  ],
  settings: [
    '設定名',
    '値',
    '説明'
  ],
  logs: [
    '日時',
    '種別',
    '内容',
    'メールアドレス',
    '注文ID',
    '詳細'
  ]
};

var BENTO_STATUS = {
  ACTIVE: 'ACTIVE',
  CHANGED: 'CHANGED',
  CANCELED: 'CANCELED',
  REJECTED: 'REJECTED'
};

var BENTO_PROCESS_TYPE = {
  ORDER: 'ORDER',
  CHANGE: 'CHANGE',
  CANCEL: 'CANCEL'
};

var BENTO_SAMPLE_MENUS = [
  ['B001', '鮭弁当', 750, '', true, 10, ''],
  ['B002', 'のり弁当', 650, '', true, 20, ''],
  ['B003', '唐揚げ弁当', 700, '', true, 30, ''],
  ['B004', 'カレー', 650, '', true, 40, ''],
  ['B005', 'ハンバーグ弁当', 800, '', true, 50, ''],
  ['B006', '幕の内弁当', 850, '', true, 60, '']
];

var BENTO_SAMPLE_DELIVERY_DATES = [
  ['2026-05-25', '5月25日（月）', true, '2026-05-24 12:00:00', 10, ''],
  ['2026-05-26', '5月26日（火）', true, '2026-05-25 12:00:00', 20, ''],
  ['2026-05-27', '5月27日（水）', true, '2026-05-26 12:00:00', 30, '']
];

var BENTO_SAMPLE_SETTINGS = [
  ['MAIL_ENABLED', 'TRUE', 'TRUEの場合、MailApp.sendEmailで通知メールを送信します。'],
  ['MAIL_FROM_NAME', '弁当注文システム', '通知メールの差出人名として使います。'],
  ['ADMIN_EMAIL', '', '必要に応じて管理者メールアドレスを入れます。'],
  ['TEST_EMAIL', '', 'テスト関数の送信先。空欄なら実行ユーザーのメールアドレスを使います。']
];

var BENTO_TIMEZONE = 'Asia/Tokyo';
var BENTO_ORDER_ID_RANDOM_LENGTH = 4;
var BENTO_LOCK_WAIT_MS = 30000;
