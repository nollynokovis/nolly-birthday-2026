// 結果區（2026 Nolly生日盃三個賽事的最終結果）：統一用「結果文字＋原本網站的決賽賽程元件」呈現
//   資料：data/results.json（正式結果，不是即時更新；名字照資料顯示，不翻譯）；標題與名次標籤依 <html lang> 取 I18N（zh／ja／en）
//   首頁（#results-mount）：每個賽事一個區塊——上面是結果文字（冠軍、MVP、前三名），下面是賽程頁原本的決賽賽程元件
//     （.schedule-image-container[data-bracket][data-group="Final"]＋js/bracket.js 的疊字：名字可點、連到隊伍／選手個人頁）
//     決賽賽程的資料沿用賽程頁的資料來源（VALORANT：data/valorant-schedule.json，由 js/match-schedule.js 的資料模式送出；
//     SF6：data/sf6-*-results.json，由 js/sf6-live.js 送出），這裡不另外建立一套勝負資料；三個賽事一律用歷史紀錄樣式（敗方不變灰，見 style.css）
//     賽程元件的容器必須在 bracket.js 執行前就建好，所以先同步建好骨架（這支 script 要排在 bracket.js 前面），結果文字等 JSON 讀到再填入
//   賽程頁（[data-result-info]）：只在頁面最上方顯示結果文字，賽程元件就是頁面原本的決賽賽程圖
(() => {
    const mount = document.getElementById('results-mount');
    const pageMounts = [...document.querySelectorAll('[data-result-info]')];
    if (!mount && !pageMounts.length) return;

    const RESULTS_URL = 'data/results.json';

    // roles：名次標籤 [本地語言, 英文]（英文版只有一個）；games：賽事標題與賽制；bracketAlt：決賽賽程圖的替代文字
    const I18N = {
        zh: {
            roles: { champion: ['冠軍', 'CHAMPION'], mvp: ['MVP'], first: ['冠軍', '1ST'], second: ['亞軍', '2ND'], third: ['季軍', '3RD'] },
            games: {
                valorant: ['VALORANT', '5v5 團體賽'],
                sf6Individual: ['STREET FIGHTER 6', '個人淘汰賽'],
                sf6Team: ['STREET FIGHTER 6', '3v3 團體賽'],
            },
            bracketAlt: '決賽賽程',
            error: '比賽結果載入失敗，請稍後再試',
        },
        ja: {
            roles: { champion: ['優勝', 'CHAMPION'], mvp: ['MVP'], first: ['優勝', '1ST'], second: ['準優勝', '2ND'], third: ['3位', '3RD'] },
            games: {
                valorant: ['VALORANT', '5v5チーム戦'],
                sf6Individual: ['STREET FIGHTER 6', '個人トーナメント'],
                sf6Team: ['STREET FIGHTER 6', '3v3チーム戦'],
            },
            bracketAlt: '決勝トーナメント',
            error: '大会結果の読み込みに失敗しました。しばらくしてから再度お試しください',
        },
        en: {
            roles: { champion: ['CHAMPION'], mvp: ['MVP'], first: ['1ST'], second: ['2ND'], third: ['3RD'] },
            games: {
                valorant: ['VALORANT', '5v5 TEAM TOURNAMENT'],
                sf6Individual: ['STREET FIGHTER 6', '1v1 TOURNAMENT'],
                sf6Team: ['STREET FIGHTER 6', '3v3 TEAM TOURNAMENT'],
            },
            bracketAlt: 'Finals bracket',
            error: 'Failed to load the results. Please try again later.',
        },
    };
    const lang = document.documentElement.lang;
    const t = I18N[lang.startsWith('ja') ? 'ja' : lang.startsWith('en') ? 'en' : 'zh'];

    // kind：賽程元件的種類（同 bracket.js 的 data-bracket）；bracket：該賽事的決賽賽程圖（1x／0.5x）：VALORANT、SF6 團體賽用賽程頁的同一張；SF6 個人賽用結果專用背景（多了季軍、亞軍、冠軍獎盃，框的位置與決賽圖相同，疊字位置不變）
    // theme：VALORANT 紅、SF6 橘（同首頁卡片的配色）；rows：由上到下的名次，第一列字級最大；沒有值的列（例如 mvp 為 null）不顯示
    const EVENTS = [
        { key: 'valorant', kind: 'valorant', theme: 'valo', bracket: ['img/1x/VALO決賽.webp', 'img/0.5x/VALO決賽@0.5x.webp'], rows: d => [
            { role: 'champion', value: d.champion, members: d.members },
            { role: 'mvp', value: d.mvp, note: d.mvpTeam },
        ] },
        { key: 'sf6Individual', kind: 'sf6Solo', theme: 'sf6', bracket: ['img/1x/sf6個人結果背景.webp', 'img/0.5x/sf6個人結果背景@0.5x.webp'], rows: d => [
            { role: 'first', value: d.first },
            { role: 'second', value: d.second },
            { role: 'third', value: d.third },
        ] },
        { key: 'sf6Team', kind: 'sf6Team', theme: 'sf6', bracket: ['img/1x/團體賽決賽.webp', 'img/0.5x/團體賽決賽@0.5x.webp'], rows: d => [
            { role: 'champion', value: Array.isArray(d.champion) ? d.champion.join(' / ') : d.champion, compact: true },
        ] },
    ];

    const el = (tag, className, text) => {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    };

    const rowOf = ({ role, value, note, members, compact }, main) => {
        const row = el('div', `result-row${main ? ' is-main' : ''}`);
        const label = el('dt', 'result-role');
        const [local, english] = t.roles[role];
        label.append(el('span', 'result-role-name', local));
        if (english) label.append(el('span', 'result-role-en', english));
        const name = el('dd', `result-name${compact ? ' is-compact' : ''}`, value);    // compact：三位隊員的名字縮小成一行
        if (note && note !== value) name.append(el('small', 'result-note', note));
        if (members && Array.isArray(members)) name.append(el('div', 'result-members', members.join(' / ')));
        row.append(label, name);
        return row;
    };

    const listOf = (event, data) => {
        const list = el('dl', 'result-list');
        list.append(...event.rows(data).filter(row => row.value).map((row, i) => rowOf(row, i === 0)));
        return list;
    };

    // 首頁區塊骨架：標題與賽制先放好，名次列等資料讀到再填；決賽賽程圖的容器同步建好（見檔案開頭說明）
    const blockOf = event => {
        const [game, format] = t.games[event.key];
        const block = el('article', `result-block is-${event.theme}`);
        block.id = `result-${event.key}`;    // hero 的按鈕連到 #result-valorant／#result-sf6Individual
        const info = el('div', 'result-info');
        const head = el('div', 'result-head');
        head.append(el('h3', 'result-game', game), el('p', 'result-format', format));
        info.append(head);

        const figure = el('figure', 'result-figure');
        const container = el('div', 'schedule-image-container');
        container.dataset.bracket = event.kind;
        container.dataset.group = 'Final';
        const img = el('img', 'prize-img active');
        [img.src, img.srcset] = [event.bracket[0], `${event.bracket[0]} 1920w, ${event.bracket[1]} 960w`];
        img.sizes = '(min-width: 1000px) 960px, 100vw';
        img.width = 1920;
        img.height = 1080;
        img.loading = 'lazy';
        img.alt = `${game} ${format} ${t.bracketAlt}`;
        container.append(img);
        figure.append(container);

        block.append(info, figure);
        return { event, info, block };
    };

    const blocks = mount ? EVENTS.map(blockOf) : [];
    if (mount) mount.replaceChildren(...blocks.map(b => b.block));

    // 賽程頁：每個 [data-result-info="賽事 key"] 一份名次列；有 data-result-head 時前面加賽制名稱（SF6 頁個人賽、團體賽並排時用）
    const pageInfos = pageMounts.map(node => ({ node, event: EVENTS.find(e => e.key === node.dataset.resultInfo) })).filter(p => p.event);

    fetch(RESULTS_URL, { cache: 'no-cache' })
        .then(res => {
            if (!res.ok) throw new Error(`${RESULTS_URL}: HTTP ${res.status}`);
            return res.json();
        })
        .then(data => {
            blocks.forEach(({ event, info }) => { if (data[event.key]) info.append(listOf(event, data[event.key])); });
            pageInfos.forEach(({ node, event }) => {
                if (!data[event.key]) return;
                if ('resultHead' in node.dataset) node.append(el('p', 'result-format result-head', t.games[event.key][1]));
                node.append(listOf(event, data[event.key]));
            });
        })
        .catch(err => {
            console.error(err);
            const message = () => el('p', 'results-error', t.error);
            blocks.forEach(({ info }) => info.append(message()));
            pageInfos.forEach(({ node }) => node.append(message()));
        });
})();
