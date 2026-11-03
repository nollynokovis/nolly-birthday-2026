// 賽事時刻表（.event-schedule）：日期頁籤＋垂直時間軸；.event-schedule[data-event="sf6"] 用 SF6 的內容，其餘為 VALORANT
//   VALORANT（schedule-valo*.html）：三天（11/6 前夜祭、11/7 DAY 01、11/8 DAY 02）
//   SF6（schedule-sf6*.html）：兩天（11/14 DAY 01 個人賽預賽、11/15 DAY 02 個人賽決賽＋團體賽），時間照 data/sf6-schedule-times.json
// 時間與場次只在下方的 VALO_DAYS／SF6_DAYS 維護一份（三個語言版本共用）；活動名稱依 <html lang> 取 I18N，沿用 match-schedule.js 的語言判斷方式
// type（兩個項目共用同一套層級）：match＝正式比賽（VALORANT 紅色、SF6 橘色實心圓點，最大字級，標題旁標示組別或場次）、
//   draw＝階段結果（公開抽籤、各組晉級公布：紫色空心菱形、較小字級）、result＝最終結果（冠軍、得獎者公布：紫色實心菱形、字級介於比賽與階段結果之間）、
//   other＝一般活動（直播、賽前準備、閉幕等：灰白空心圓、單行低調小字）
// match（比賽編號，對應 data/valorant-schedule.json 的 matchId）：有的比賽標題可以點，跳到下方比賽時間表對應的那一場
// target（SF6，{ id, group }）：標題可以點，切到 #id 區塊裡對應組別的賽程圖按鈕（沒有 group 就只捲過去）
// 頁籤依 WAI-ARIA tabs 慣例：←／→／Home／End 切換並移動焦點；預設顯示 DAY 01
(() => {
    const root = document.querySelector('.event-schedule');
    if (!root) return;

    const VALO_DEFAULT_DAY = 'd1107';

    // 台灣時間（UTC+8）。time 為 null 時顯示各語言的 afterFinal（決賽結束後）；group（組別代號，顯示時依語言加上「組」或 Group）與 bracket（四強場次代號）是各語言共用的代號，接在比賽名稱後面
    const VALO_DAYS = [
        {
            id: 'd1106', date: '2026-11-06', tab: '11.06 FRI',
            items: [
                { time: '20:00', type: 'draw',  key: 'drawPrelim' },
                { time: '20:30', type: 'match', key: 'eveShow' },
            ],
        },
        {
            id: 'd1107', date: '2026-11-07', tab: '11.07 SAT',
            items: [
                { time: '19:00', type: 'other', key: 'stream' },
                { time: '19:30', type: 'other', key: 'prepPrelim' },
                { time: '20:00', type: 'match', key: 'prelim1', match: 'A1', group: 'A・B' },
                { time: '20:45', type: 'draw',  key: 'drawR16a' },
                { time: '21:00', type: 'match', key: 'prelim2', match: 'C1', group: 'C・D' },
                { time: '21:45', type: 'draw',  key: 'drawR16b' },
                { time: '22:00', type: 'match', key: 'r16a', match: 'E1', group: 'E' },
                { time: '23:00', type: 'match', key: 'r16b', match: 'F1', group: 'F' },
                { time: '23:45', type: 'draw',  key: 'drawQF' },
            ],
        },
        {
            id: 'd1108', date: '2026-11-08', tab: '11.08 SUN',
            items: [
                { time: '19:00', type: 'other', key: 'stream' },
                { time: '19:30', type: 'other', key: 'prepQF' },
                { time: '20:00', type: 'match', key: 'qf', match: 'G1', group: 'G' },
                { time: '20:45', type: 'draw',  key: 'drawSF1' },
                { time: '21:00', type: 'match', key: 'sf1', match: 'H1', bracket: 'H1' },
                { time: '21:45', type: 'draw',  key: 'drawSF2' },
                { time: '22:00', type: 'match', key: 'sf2', match: 'H2', bracket: 'H2' },
                { time: '22:45', type: 'draw',  key: 'drawFinal' },
                { time: '23:00', type: 'match', key: 'final', match: 'FINAL' },
                { time: null,    type: 'result', key: 'champion' },
                { time: null,    type: 'other', key: 'closing' },
            ],
        },
    ];

    // date：月、日、星期幾（0＝日）→ 顯示文字；days：頁籤下方的名稱（tab）與當天標題（title）；items：活動名稱
    const VALO_I18N = {
        zh: {
            tabsLabel: '選擇日期',
            date: (m, d, w) => `${m}月${d}日(${'日一二三四五六'[w]})`,
            afterFinal: '賽後',
            group: code => `${code} 組`,
            days: {
                d1106: { tab: '前夜祭', title: 'VALORANT 前夜祭' },
                d1107: { tab: 'DAY 01', title: 'DAY 01 預賽日' },
                d1108: { tab: 'DAY 02', title: 'DAY 02 決賽日' },
            },
            items: {
                drawPrelim: '預賽地圖及攻守公開抽籤',
                eveShow: 'VALORANT 前夜祭觀眾場',
                stream: '直播開始・賽事介紹',
                prepPrelim: '預賽第一輪賽前準備',
                prelim1: '預賽',
                drawR16a: '16 強 E 組地圖及攻守公開抽籤',
                prelim2: '預賽',
                drawR16b: '16 強 F 組地圖及攻守公開抽籤',
                r16a: '16 強賽',
                r16b: '16 強賽',
                drawQF: '八強晉級隊伍公布・八強地圖及攻守公開抽籤',
                prepQF: '八強賽前準備',
                qf: '八強賽',
                drawSF1: '四強第一場（H1）地圖及攻守公開抽籤',
                sf1: '四強第一場',
                drawSF2: '四強第二場（H2）地圖及攻守公開抽籤',
                sf2: '四強第二場',
                drawFinal: '冠軍決賽地圖及攻守公開抽籤',
                final: '冠軍決賽',
                champion: '冠軍及 MVP 公布',
                closing: '閉幕',
            },
            facts: [
                { label: 'TIMEZONE', value: 'UTC+8 / TAIWAN', text: '所有時間均為台灣時間（UTC+8）。' },
                { label: 'CHECK-IN', value: '開賽前 10 分鐘', text: '詳細報到時間請至比賽時間表確認。' },
            ],
            notes: [
                '實際比賽及公開抽籤時間可能依賽事進度調整。',
                '若前一輪比賽尚未結束，後續場次將依實際情況順延。',
            ],
        },
        ja: {
            tabsLabel: '日付を選択',
            date: (m, d, w) => `${m}月${d}日(${'日月火水木金土'[w]})`,
            afterFinal: '終了後',
            group: code => `${code}組`,
            days: {
                d1106: { tab: '前夜祭', title: 'VALORANT 前夜祭' },
                d1107: { tab: 'DAY 01', title: 'DAY 01 予選日' },
                d1108: { tab: 'DAY 02', title: 'DAY 02 決勝日' },
            },
            items: {
                drawPrelim: '予選 マップ・サイド公開抽選',
                eveShow: 'VALORANT 前夜祭 観客セッション',
                stream: '配信開始・大会紹介',
                prepPrelim: '予選第1ラウンド 試合前準備',
                prelim1: '予選',
                drawR16a: 'ベスト16 E組 マップ・サイド公開抽選',
                prelim2: '予選',
                drawR16b: 'ベスト16 F組 マップ・サイド公開抽選',
                r16a: 'ベスト16',
                r16b: 'ベスト16',
                drawQF: 'ベスト8進出チーム発表・ベスト8 マップ・サイド公開抽選',
                prepQF: 'ベスト8 試合前準備',
                qf: 'ベスト8',
                drawSF1: '準決勝 第1試合（H1）マップ・サイド公開抽選',
                sf1: '準決勝 第1試合',
                drawSF2: '準決勝 第2試合（H2）マップ・サイド公開抽選',
                sf2: '準決勝 第2試合',
                drawFinal: '決勝 マップ・サイド公開抽選',
                final: '決勝',
                champion: '優勝チーム・MVP 発表',
                closing: '閉会',
            },
            facts: [
                { label: 'TIMEZONE', value: 'UTC+8 / TAIWAN', text: 'すべての時間は台湾時間（UTC+8）です。' },
                { label: 'CHECK-IN', value: '開始 10 分前', text: '詳細な受付時間は試合スケジュールでご確認ください。' },
            ],
            notes: [
                '実際の試合および公開抽選の時間は、大会の進行状況により変更となる場合があります。',
                '前のラウンドが終了していない場合、以降の試合は実際の状況に応じて順延されます。',
            ],
        },
        en: {
            tabsLabel: 'Select a day',
            date: (m, d, w) => `${['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][m - 1]}. ${String(d).padStart(2, '0')} ${['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][w]}`,
            afterFinal: 'AFTER',
            group: code => `Group ${code}`,
            days: {
                d1106: { tab: 'EVE', title: 'VALORANT Eve Festival' },
                d1107: { tab: 'DAY 01', title: 'DAY 01 Preliminaries' },
                d1108: { tab: 'DAY 02', title: 'DAY 02 Finals' },
            },
            items: {
                drawPrelim: 'Preliminary Map & Side Public Draw',
                eveShow: 'VALORANT Eve Festival: Viewer Session',
                stream: 'Broadcast Start & Tournament Intro',
                prepPrelim: 'Preliminary Round 1 Pre-Match Prep',
                prelim1: 'Preliminary',
                drawR16a: 'Round of 16 Group E Map & Side Public Draw',
                prelim2: 'Preliminary',
                drawR16b: 'Round of 16 Group F Map & Side Public Draw',
                r16a: 'Round of 16',
                r16b: 'Round of 16',
                drawQF: 'Quarterfinalists Announced & Quarterfinals Map & Side Public Draw',
                prepQF: 'Quarterfinals Pre-Match Prep',
                qf: 'Quarterfinals',
                drawSF1: 'Semifinal 1 (H1) Map & Side Public Draw',
                sf1: 'Semifinal 1',
                drawSF2: 'Semifinal 2 (H2) Map & Side Public Draw',
                sf2: 'Semifinal 2',
                drawFinal: 'Grand Final Map & Side Public Draw',
                final: 'Grand Final',
                champion: 'Champion & MVP Announcement',
                closing: 'Closing Ceremony',
            },
            facts: [
                { label: 'TIMEZONE', value: 'UTC+8 / TAIWAN', text: 'All times are Taiwan Time (UTC+8).' },
                { label: 'CHECK-IN', value: '10 MIN BEFORE START', text: 'Please check the Match Schedule for detailed check-in times.' },
            ],
            notes: [
                'Actual match and public draw times may change depending on how the event progresses.',
                'If the previous round has not finished, later matches will be delayed accordingly.',
            ],
        },
    };

    // SF6：時間與 data/sf6-schedule-times.json 的 startTime 一致；target.id＝賽程圖所在的區塊
    // next：跨過午夜的時間（00:00 起），時間下方標示隔天的日期；每一組結束後，在下一輪開始前 5 分鐘公布該組晉級者（個人賽八強、團體賽四強）
    // 個人賽最後一組（H）的晉級者與八強名單一起在當天賽後公布，所以最後一列是「賽後」那一列
    const SF6_DEFAULT_DAY = 'd1114';
    const indPrelim = (time, group, next) => ({ time, next, type: 'match', key: 'indPrelim', group, target: { id: 'individual-prelim', group } });
    const indAdvance = (time, titleGroup, next) => ({ time, next, type: 'draw', key: 'indAdvance', titleGroup });
    const teamGroup = (time, group, next) => ({ time, next, type: 'match', key: 'teamGroup', group, target: { id: 'team-schedule', group } });
    const teamAdvance = (time, titleGroup, next) => ({ time, next, type: 'draw', key: 'teamAdvance', titleGroup });
    const SF6_DAYS = [
        {
            id: 'd1114', date: '2026-11-14', tab: '11.14 SAT',
            items: [
                { time: '17:00', type: 'other', key: 'stream' },
                { time: '17:30', type: 'other', key: 'prepPrelim' },
                indPrelim('18:00', 'A'),
                indAdvance('18:55', 'A'),
                indPrelim('19:00', 'B'),
                indAdvance('19:55', 'B'),
                indPrelim('20:00', 'C'),
                indAdvance('20:55', 'C'),
                indPrelim('21:00', 'D'),
                indAdvance('21:55', 'D'),
                indPrelim('22:00', 'E'),
                indAdvance('22:55', 'E'),
                indPrelim('23:00', 'F'),
                indAdvance('23:55', 'F'),
                indPrelim('00:00', 'G', true),
                indAdvance('00:55', 'G', true),
                indPrelim('01:00', 'H', true),
                { time: null, type: 'draw', key: 'indTop8' },
            ],
        },
        {
            id: 'd1115', date: '2026-11-15', tab: '11.15 SUN',
            items: [
                { time: '19:00', type: 'other', key: 'stream' },
                { time: '19:30', type: 'other', key: 'prepIndFinal' },
                { time: '20:00', type: 'match', key: 'indFinal', target: { id: 'individual-finals' } },
                { time: '20:55', type: 'result', key: 'indAwards' },
                teamGroup('21:00', 'A'),
                teamAdvance('21:55', 'A'),
                teamGroup('22:00', 'B'),
                teamAdvance('22:55', 'B'),
                teamGroup('23:00', 'C'),
                teamAdvance('23:55', 'C'),
                teamGroup('00:00', 'D', true),
                teamAdvance('00:55', 'D', true),
                { time: '01:00', next: true, type: 'match', key: 'teamFinal', target: { id: 'team-schedule', group: 'Final' } },
                { time: null, type: 'result', key: 'teamChampion' },
                { time: null, type: 'other', key: 'closing' },
            ],
        },
    ];

    const SF6_I18N = {
        zh: {
            tabsLabel: '選擇日期',
            date: (m, d, w) => `${m}月${d}日(${'日一二三四五六'[w]})`,
            afterFinal: '賽後',
            group: code => `${code} 組`,
            days: {
                d1114: { tab: 'DAY 01', title: 'DAY 01 個人賽預賽' },
                d1115: { tab: 'DAY 02', title: 'DAY 02 個人賽決賽・團體賽' },
            },
            items: {
                stream: '直播開始・賽程介紹',
                prepPrelim: '個人賽預賽賽前準備',
                prepIndFinal: '個人賽決賽賽前準備',
                indPrelim: '個人賽預賽',
                indAdvance: g => `${g}八強晉級選手公布`,
                indTop8: '個人賽八強晉級者公布',
                indFinal: '個人賽決賽',
                indAwards: '個人賽得獎者公布',
                teamGroup: '團體賽',
                teamAdvance: g => `${g}四強晉級隊伍公布`,
                teamFinal: '團體賽決賽',
                teamChampion: '團體賽冠軍公布',
                closing: '閉幕',
            },
            facts: [
                { label: 'TIMEZONE', value: 'UTC+8 / TAIWAN', text: '所有時間均為台灣時間（UTC+8）。' },
                { label: 'CHECK-IN', value: '開賽前 10 分鐘', text: '請於集合時間前至 Discord 報到。' },
            ],
            notes: [
                '時間下方標示日期者為隔天凌晨。',
                '實際比賽時間可能依賽事進度調整。',
            ],
        },
        ja: {
            tabsLabel: '日付を選択',
            date: (m, d, w) => `${m}月${d}日(${'日月火水木金土'[w]})`,
            afterFinal: '終了後',
            group: code => `${code}組`,
            days: {
                d1114: { tab: 'DAY 01', title: 'DAY 01 個人戦予選' },
                d1115: { tab: 'DAY 02', title: 'DAY 02 個人戦決勝・チーム戦' },
            },
            items: {
                stream: '配信開始・日程紹介',
                prepPrelim: '個人戦 予選 試合前準備',
                prepIndFinal: '個人戦 決勝 試合前準備',
                indPrelim: '個人戦 予選',
                indAdvance: g => `${g}ベスト8進出選手発表`,
                indTop8: '個人戦 ベスト8進出者発表',
                indFinal: '個人戦 決勝',
                indAwards: '個人戦 入賞者発表',
                teamGroup: 'チーム戦',
                teamAdvance: g => `${g}ベスト4進出チーム発表`,
                teamFinal: 'チーム戦 決勝',
                teamChampion: 'チーム戦 優勝チーム発表',
                closing: '閉会',
            },
            facts: [
                { label: 'TIMEZONE', value: 'UTC+8 / TAIWAN', text: 'すべての時間は台湾時間（UTC+8）です。' },
                { label: 'CHECK-IN', value: '開始 10 分前', text: '集合時間までに Discord でチェックインしてください。' },
            ],
            notes: [
                '時間の下に日付が表示されているものは翌日の深夜です。',
                '実際の試合時間は、大会の進行状況により変更となる場合があります。',
            ],
        },
        en: {
            tabsLabel: 'Select a day',
            date: (m, d, w) => `${['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][m - 1]}. ${String(d).padStart(2, '0')} ${['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][w]}`,
            afterFinal: 'AFTER',
            group: code => `Group ${code}`,
            days: {
                d1114: { tab: 'DAY 01', title: 'DAY 01 Individual Preliminaries' },
                d1115: { tab: 'DAY 02', title: 'DAY 02 Individual Finals & Team Tournament' },
            },
            items: {
                stream: 'Broadcast Start & Schedule Intro',
                prepPrelim: 'Individual Preliminaries Pre-Match Prep',
                prepIndFinal: 'Individual Finals Pre-Match Prep',
                indPrelim: 'Individual Preliminaries',
                indAdvance: g => `${g} Top 8 Qualifier Announced`,
                indTop8: 'Individual Top 8 Qualifiers Announced',
                indFinal: 'Individual Finals',
                indAwards: 'Individual Winners Announced',
                teamGroup: 'Team Tournament',
                teamAdvance: g => `${g} Top 4 Qualifying Team Announced`,
                teamFinal: 'Team Finals',
                teamChampion: 'Team Champion Announced',
                closing: 'Closing Ceremony',
            },
            facts: [
                { label: 'TIMEZONE', value: 'UTC+8 / TAIWAN', text: 'All times are Taiwan Time (UTC+8).' },
                { label: 'CHECK-IN', value: '10 MIN BEFORE START', text: 'Please check in on Discord by the check-in time.' },
            ],
            notes: [
                'Times with a date shown below are early the next morning.',
                'Actual match times may change depending on how the event progresses.',
            ],
        },
    };

    const isSf6 = root.dataset.event === 'sf6';
    const DAYS = isSf6 ? SF6_DAYS : VALO_DAYS;
    const DEFAULT_DAY = isSf6 ? SF6_DEFAULT_DAY : VALO_DEFAULT_DAY;
    const I18N = isSf6 ? SF6_I18N : VALO_I18N;
    const lang = document.documentElement.lang;
    const t = I18N[lang.startsWith('ja') ? 'ja' : lang.startsWith('en') ? 'en' : 'zh'];

    const el = (tag, className, text) => {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    };

    // 日期（YYYY-MM-DD，台灣時間）→ 顯示文字；只看年月日，不受瀏覽器時區影響（同 match-schedule.js）
    const dateText = iso => {
        const [y, m, d] = iso.split('-').map(Number);
        return t.date(m, d, new Date(Date.UTC(y, m - 1, d)).getUTCDay());
    };

    // 跨過午夜的項目：日期（YYYY-MM-DD，該頁籤的比賽日）的隔天，顯示成 (月/日)
    const nextDayText = iso => {
        const [y, m, d] = iso.split('-').map(Number);
        const next = new Date(Date.UTC(y, m - 1, d + 1));
        return `(${next.getUTCMonth() + 1}/${next.getUTCDate()})`;
    };

    const itemRow = (item, day) => {
        const row = el('li', `es-item es-${item.type}`);
        const time = el('span', 'es-time', item.time || t.afterFinal);
        if (item.next) time.append(el('small', 'es-time-next', nextDayText(day.date)));
        const node = el('span', 'es-node');
        node.setAttribute('aria-hidden', 'true');
        const body = el('div', 'es-body', '');
        // 有對應比賽編號的比賽：標題是連到下方「比賽時間表」的連結（點下去由 match-schedule.js 切到那一場的階段並標示；
        // 還沒載入時照 href 捲到時間表）。場次較多的階段連到該階段開頭的那一場（A・B 組 → A1、C・D 組 → C1 …）
        if (item.match) {
            const link = el('a', 'es-name es-link', t.items[item.key]);
            link.href = '#valo-match-schedule';
            link.dataset.match = item.match;
            body.append(link);
        } else if (item.target) {
            // SF6：點下去先切到對應組別的賽程圖按鈕，捲動交給連結本身的錨點
            const { id, group } = item.target;
            const link = el('a', 'es-name es-link', t.items[item.key]);
            link.href = `#${id}`;
            link.addEventListener('click', () => {
                const button = group && document.querySelector(`#${id} .group-btn[data-group="${group}"]`);
                if (button && !button.classList.contains('active')) button.click();
            });
            body.append(link);
        } else {
            // 名稱是函式的項目（SF6 各組晉級公布）：組別寫在標題最前面（titleGroup），不另外接在後面
            const name = t.items[item.key];
            body.append(el('span', 'es-name', typeof name === 'function' ? name(t.group(item.titleGroup)) : name));
        }
        const code = item.group ? t.group(item.group) : item.bracket;
        if (code) body.append(el('span', 'es-aside', code));
        row.append(time, node, body);
        return row;
    };

    const tablist = el('div', 'es-tabs');
    tablist.setAttribute('role', 'tablist');
    tablist.setAttribute('aria-label', t.tabsLabel);
    const panels = el('div', 'es-panels');

    const tabs = DAYS.map(day => {
        const tab = el('button', 'es-tab');
        tab.type = 'button';
        tab.id = `es-tab-${day.id}`;
        tab.setAttribute('role', 'tab');
        tab.setAttribute('aria-controls', `es-panel-${day.id}`);
        const [md, weekday] = day.tab.split(' ');
        const dateLine = el('span', 'es-tab-date', md);
        dateLine.append(el('small', '', weekday));
        tab.append(dateLine, el('span', 'es-tab-name', t.days[day.id].tab));
        tablist.append(tab);

        const panel = el('div', 'es-panel');
        panel.id = `es-panel-${day.id}`;
        panel.setAttribute('role', 'tabpanel');
        panel.setAttribute('aria-labelledby', tab.id);
        panel.tabIndex = 0;
        panel.append(el('h4', 'es-day-title', `${dateText(day.date)}｜${t.days[day.id].title}`));
        const list = el('ol', 'es-list');
        list.append(...day.items.map(item => itemRow(item, day)));
        panel.append(list);
        panels.append(panel);
        return tab;
    });

    const select = (index, focus) => {
        tabs.forEach((tab, i) => {
            const on = i === index;
            tab.setAttribute('aria-selected', String(on));
            tab.tabIndex = on ? 0 : -1;
            panels.children[i].hidden = !on;
        });
        if (focus) tabs[index].focus();
    };

    tabs.forEach((tab, i) => {
        tab.addEventListener('click', () => select(i));
        tab.addEventListener('keydown', e => {
            const last = tabs.length - 1;
            const next = { ArrowRight: i === last ? 0 : i + 1, ArrowLeft: i === 0 ? last : i - 1, Home: 0, End: last }[e.key];
            if (next === undefined) return;
            e.preventDefault();
            select(next, true);
        });
    });

    // 底部：兩個重點資訊（時區、報到時間）＋較小的補充說明
    const foot = el('div', 'es-foot');
    const facts = el('div', 'es-facts');
    facts.append(...t.facts.map(f => {
        const box = el('div', 'es-fact');
        box.append(el('span', 'es-fact-label', f.label), el('strong', 'es-fact-value', f.value), el('span', 'es-fact-text', f.text));
        return box;
    }));
    const notes = el('ul', 'es-notes');
    notes.append(...t.notes.map(text => el('li', '', text)));
    foot.append(facts, notes);

    root.querySelector('.es-mount').replaceChildren(tablist, panels, foot);
    select(DAYS.findIndex(day => day.id === DEFAULT_DAY));
})();
