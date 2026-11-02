// VALORANT 賽事時刻表（schedule-valo*.html 的 .event-schedule）：三天（11/6 前夜祭、11/7 DAY 01、11/8 DAY 02）的日期頁籤＋垂直時間軸
// 時間與場次只在下方的 DAYS 維護一份（三個語言版本共用）；活動名稱依 <html lang> 取 I18N，沿用 match-schedule.js 的語言判斷方式
// type：match＝正式比賽（紅色圓點、最大字級，標題旁標示組別或場次）、draw＝公開抽籤（紫色實心菱形、較小字級）、other＝直播、賽前準備、閉幕等（單行低調小字）
// match（比賽編號，對應 data/valorant-schedule.json 的 matchId）：有的比賽標題可以點，跳到下方比賽時間表對應的那一場
// 頁籤依 WAI-ARIA tabs 慣例：←／→／Home／End 切換並移動焦點；預設顯示 DAY 01
(() => {
    const root = document.querySelector('.event-schedule');
    if (!root) return;

    const DEFAULT_DAY = 'd1107';

    // 台灣時間（UTC+8）。time 為 null 時顯示各語言的 afterFinal（決賽結束後）；group（組別代號，顯示時依語言加上「組」或 Group）與 bracket（四強場次代號）是各語言共用的代號，接在比賽名稱後面
    const DAYS = [
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
                { time: null,    type: 'other', key: 'closing' },
            ],
        },
    ];

    // date：月、日、星期幾（0＝日）→ 顯示文字；days：頁籤下方的名稱（tab）與當天標題（title）；items：活動名稱
    const I18N = {
        zh: {
            tabsLabel: '選擇日期',
            date: (m, d, w) => `${m}月${d}日(${'日一二三四五六'[w]})`,
            afterFinal: '決賽結束後',
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
                closing: '冠軍及 MVP 公布・閉幕',
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
            afterFinal: '決勝終了後',
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
                closing: '優勝チーム・MVP 発表・閉会',
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
            afterFinal: 'After the Final',
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
                closing: 'Champion & MVP Announcement · Closing Ceremony',
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

    const itemRow = item => {
        const row = el('li', `es-item es-${item.type}`);
        const time = el('span', 'es-time', item.time || t.afterFinal);
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
        } else {
            body.append(el('span', 'es-name', t.items[item.key]));
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
        list.append(...day.items.map(itemRow));
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
