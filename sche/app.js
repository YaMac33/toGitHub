// === グローバル状態の管理 ===
window.calendarData = window.calendarData || {}; // データ格納用の箱
let currentDate = new Date(); // 現在表示している基準日
let currentView = 'month'; // 'month' | 'week' | 'day'
let activeFilters = new Set(); // 表示対象（チェックがON）のファイル名
const colors = ['#3498db', '#e67e22', '#2ecc71', '#9b59b6', '#e74c3c', '#1abc9c']; // 予定の色分け用

// === 1. アプリの初期化とデータ読み込み ===
document.addEventListener('DOMContentLoaded', () => {
    // list.jsが存在しない、または空の場合は初期化のみ行う
    if (typeof fileList === 'undefined' || fileList.length === 0) {
        initializeApp();
        return;
    }

    let loadedCount = 0;

    // fileListの配列をもとに、すべてのJSファイルを動的に読み込む
    fileList.forEach((fileName) => {
        const script = document.createElement('script');
        script.src = `${fileName}.js`;
        
        script.onload = () => {
            loadedCount++;
            if (loadedCount === fileList.length) initializeApp();
        };
        
        script.onerror = () => {
            console.error(`${fileName}.js の読み込みに失敗しました。`);
            loadedCount++;
            if (loadedCount === fileList.length) initializeApp();
        };
        
        document.body.appendChild(script);
    });
});

function initializeApp() {
    setupSidebar();
    setupEventListeners();
    renderCalendar();
}

// === 2. サイドバー（フィルター）の構築 ===
function setupSidebar() {
    const container = document.getElementById('calendar-toggles');
    container.innerHTML = '';

    if (typeof fileList === 'undefined') return;

    fileList.forEach((fileName, index) => {
        // 初期状態はすべてON
        activeFilters.add(fileName);

        const label = document.createElement('label');
        label.className = 'toggle-label';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = true;
        checkbox.value = fileName;
        
        // 色を割り当て（要素ごとに色を変える）
        const colorIndicator = `<span style="display:inline-block; width:12px; height:12px; background-color:${colors[index % colors.length]}; border-radius:2px;"></span>`;

        label.innerHTML = `${checkbox.outerHTML} ${colorIndicator} ${fileName}`;
        
        // チェックボックス切り替え時のイベント
        label.querySelector('input').addEventListener('change', (e) => {
            if (e.target.checked) {
                activeFilters.add(e.target.value);
            } else {
                activeFilters.delete(e.target.value);
            }
            renderCalendar(); // 画面を再描画
        });

        container.appendChild(label);
    });
}

// === 3. ボタン等のイベントリスナー設定 ===
function setupEventListeners() {
    document.getElementById('btn-prev').addEventListener('click', () => changeDate(-1));
    document.getElementById('btn-next').addEventListener('click', () => changeDate(1));

    const views = ['month', 'week', 'day'];
    views.forEach(view => {
        document.getElementById(`btn-${view}`).addEventListener('click', (e) => {
            currentView = view;
            
            // ボタンの見た目（アクティブ状態）を更新
            views.forEach(v => document.getElementById(`btn-${v}`).classList.remove('active'));
            e.target.classList.add('active');
            
            renderCalendar();
        });
    });
}

// 日付の移動ロジック
function changeDate(direction) {
    if (currentView === 'month') {
        currentDate.setMonth(currentDate.getMonth() + direction);
    } else if (currentView === 'week') {
        currentDate.setDate(currentDate.getDate() + (direction * 7));
    } else if (currentView === 'day') {
        currentDate.setDate(currentDate.getDate() + direction);
    }
    renderCalendar();
}

// === 4. カレンダーの描画メインロジック ===
function renderCalendar() {
    const viewContainer = document.getElementById('calendar-view');
    viewContainer.innerHTML = ''; // クリア

    updateDateDisplay();

    // フィルタリングされたすべての予定を1つの配列にまとめる
    const allEvents = getFilteredEvents();

    if (currentView === 'month') {
        renderMonthView(viewContainer, allEvents);
    } else if (currentView === 'week') {
        renderWeekView(viewContainer, allEvents);
    } else if (currentView === 'day') {
        renderDayView(viewContainer, allEvents);
    }
}

// ヘッダーの日付表示を更新
function updateDateDisplay() {
    const display = document.getElementById('current-date-display');
    const y = currentDate.getFullYear();
    const m = currentDate.getMonth() + 1;
    const d = currentDate.getDate();

    if (currentView === 'month') {
        display.textContent = `${y}年 ${m}月`;
    } else if (currentView === 'week') {
        // 週の始まり（日曜日）を計算
        const startOfWeek = new Date(currentDate);
        startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        display.textContent = `${y}年 ${m}月 ${startOfWeek.getDate()}日 〜 ${endOfWeek.getMonth() + 1}月 ${endOfWeek.getDate()}日`;
    } else {
        display.textContent = `${y}年 ${m}月 ${d}日`;
    }
}

// 有効なカレンダーデータを収集
function getFilteredEvents() {
    let events = [];
    activeFilters.forEach(fileName => {
        if (window.calendarData[fileName]) {
            // イベントに色とファイル名を付与して追加
            const colorIndex = typeof fileList !== 'undefined' ? fileList.indexOf(fileName) : 0;
            const fileEvents = window.calendarData[fileName].map(e => ({
                ...e,
                _source: fileName,
                _color: colors[colorIndex % colors.length]
            }));
            events = events.concat(fileEvents);
        }
    });
    return events;
}

// === 5. 各ビューのHTML生成 ===

// 月間表示
function renderMonthView(container, allEvents) {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    // カレンダーの枠組みを作成
    const grid = document.createElement('div');
    grid.className = 'calendar-grid';

    // 曜日のヘッダー
    const daysOfWeek = ['日', '月', '火', '水', '木', '金', '土'];
    daysOfWeek.forEach((day, index) => {
        const dayDiv = document.createElement('div');
        dayDiv.className = `calendar-header-day ${index === 0 ? 'sun' : ''} ${index === 6 ? 'sat' : ''}`;
        dayDiv.textContent = day;
        grid.appendChild(dayDiv);
    });

    // 前月のはみ出し分
    for (let i = 0; i < firstDay.getDay(); i++) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'calendar-day other-month';
        grid.appendChild(emptyDiv);
    }

    // 当月の日付
    for (let d = 1; d <= lastDay.getDate(); d++) {
        const dayDiv = createDayCell(year, month + 1, d, allEvents);
        grid.appendChild(dayDiv);
    }

    container.appendChild(grid);
}

// 週間表示（月間グリッドを1行にした簡易版）
function renderWeekView(container, allEvents) {
    const grid = document.createElement('div');
    grid.className = 'calendar-grid';

    const daysOfWeek = ['日', '月', '火', '水', '木', '金', '土'];
    daysOfWeek.forEach((day, index) => {
        const dayDiv = document.createElement('div');
        dayDiv.className = `calendar-header-day ${index === 0 ? 'sun' : ''} ${index === 6 ? 'sat' : ''}`;
        dayDiv.textContent = day;
        grid.appendChild(dayDiv);
    });

    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());

    for (let i = 0; i < 7; i++) {
        const currentDay = new Date(startOfWeek);
        currentDay.setDate(startOfWeek.getDate() + i);
        const dayDiv = createDayCell(currentDay.getFullYear(), currentDay.getMonth() + 1, currentDay.getDate(), allEvents);
        grid.appendChild(dayDiv);
    }

    container.appendChild(grid);
}

// 1日表示
function renderDayView(container, allEvents) {
    const dayDiv = createDayCell(currentDate.getFullYear(), currentDate.getMonth() + 1, currentDate.getDate(), allEvents);
    dayDiv.style.minHeight = '400px'; // 1日表示は大きく
    dayDiv.style.border = '1px solid #ddd';
    container.appendChild(dayDiv);
}

// 共通：1日分のマスを作成し、該当する予定を挿入する関数
function createDayCell(y, m, d, allEvents) {
    const cell = document.createElement('div');
    cell.className = 'calendar-day';
    
    // 日付ラベル
    const dateLabel = document.createElement('div');
    dateLabel.className = 'date-number';
    dateLabel.textContent = d;
    cell.appendChild(dateLabel);

    // YYYY/M/D の形式でフォーマット（ゼロ埋めしない、Excel出力の形式に合わせる）
    const targetDateStr = `${y}/${m}/${d}`;

    // その日に該当するイベントを抽出
    const dayEvents = allEvents.filter(e => {
        // Excelから出力される「開始日」のフォーマット(例: 2026/3/9)と一致するか
        // ※必要に応じて「終了日」までのまたがり処理を追加可能です
        return e["開始日"] === targetDateStr;
    });

    // 時間順にソート
    dayEvents.sort((a, b) => (a["開始時刻"] || "").localeCompare(b["開始時刻"] || ""));

    // イベント要素を作成
    dayEvents.forEach(e => {
        const eventEl = document.createElement('div');
        eventEl.className = 'event-item';
        eventEl.style.backgroundColor = e._color; // ファイルごとの色を適用
        
        // 表示内容：時刻 + 予定 + (名前)
        const time = e["開始時刻"] ? `${e["開始時刻"]} ` : '';
        const title = e["予定詳細"] || e["予定"] || '予定あり';
        eventEl.textContent = `${time}${title} (${e._source})`;
        
        // クリックで詳細を表示する簡易アラート（モーダルに発展可能）
        eventEl.addEventListener('click', () => {
            alert(`【詳細】\n日時: ${e["開始日"]} ${e["開始時刻"]} ～ ${e["終了時刻"]}\n予定: ${e["予定"]} / ${e["予定詳細"]}\n場所: ${e["場所"]} ${e["場所詳細"]}\n内容: ${e["内容"]}`);
        });

        cell.appendChild(eventEl);
    });

    return cell;
}
