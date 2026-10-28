// 賽程圖疊字＋名字搜尋：把 data/brackets.json 的抽籤結果疊在預賽賽程圖（.schedule-image-container[data-bracket]）的空白框上，
// 並提供賽程頁的名字搜尋（.bracket-search）。原始圖片不動：每張圖後面插一層 .bracket-layer，只在該圖 .active 時顯示（見 CSS）
// 分組切換仍由 main.js 的 .group-buttons 負責；搜尋結果點下去時就是代按對應的分組按鈕
// 圖上的名字可點：VALORANT 連到隊伍個人頁（team.html?id=N），SF6 個人賽連到選手個人頁（player.html?id=N），
// SF6 團體賽整格連到隊伍個人頁（sf6-team.html?id=N）
// 連結帶 from=<賽程>-<組>-<格>（例如 sf6Team-B-3），個人頁的返回連結據此回到賽程頁的 #bracket-sf6Team-B-3；
// 點下去時也把這段 # 記到目前網址，按瀏覽器的上一頁回來時同樣會切到那一組並捲到那一格
(() => {
    const containers = [...document.querySelectorAll('.schedule-image-container[data-bracket]')];
    if (containers.length === 0) return;

    // 網址帶 #bracket-… 時由這裡捲到那一格，不讓瀏覽器自己還原捲動位置（還原時分組已變回 A 組，位置會不對）
    const returnTo = location.hash.match(/^#bracket-(\w+-\w+-\d+)$/);
    if (returnTo && 'scrollRestoration' in history) history.scrollRestoration = 'manual';

    const BRACKETS_URL = 'data/brackets.json';
    const TEAMS_URL    = 'data/valorant-teams.json';
    const PLAYERS_URL  = 'data/players.json';

    // ── 框的位置 ──────────────────────────────────────────────
    // 單位是賽程圖原始尺寸（1920×1080）的 px，量的是框內深色底（#45497b）的範圍；圖片改版時只要改這裡
    //   box：框的寬高；pad：文字與框邊的距離 [左右, 上下]；font：最大字級（放不下時自動縮小，必要時換成兩行）
    //   grow：（選填）名字單行放得下時改用這個較大的字級；放不下的長名字不放大，照 font 的規則縮小
    //   radius：框的圓角半徑（標示顏色時與圖上的框角對齊）
    //   slots：每一格左上角的 [x, y]，順序與 brackets.json 相同（BYE 的格子在 JSON 裡是 null）
    //   bye：圖上沒有印 BYE 的賽程設 true，由這裡疊「BYE」字；SF6 的圖已印好 BYE，不另外疊
    //   lines：（選填）指定換行位置的名字：名字 → 各行文字；只有一行＝不換行。這些名字只縮字級，不再自動換行
    const column = (x, ys) => ys.map(y => [x, y]);
    const every104 = top => Array.from({ length: 8 }, (_, i) => top + 104 * i);
    const SOLO_LINES = {
        '寶萊塢巨星豬大哥':           ['寶萊塢巨星', '豬大哥'],
        '高中牲18HITBOX練習中':       ['高中牲', '18HITBOX練習中'],
        'FOX小隊怎麼這麼香-狼師檔案': ['FOX小隊怎麼', '這麼香-狼師檔案'],
        'こひなた民二億人':           ['こひなた民', '二億人'],
        '紅魔館門番紅美鈴':           ['紅魔館門番', '紅美鈴'],
        'EVOJP#4霍普粉絲的粉絲':      ['EVOJP#4', '霍普粉絲的粉絲'],
        '来自东南亚的神秘力量':       ['来自东南亚的', '神秘力量'],
        'tuki.(17)様のファン':        ['tuki.(17)様の', 'ファン'],
        'OnlyBelongToYou':            ['OnlyBelongToYou'],
        'sapiumsebiferum':            ['sapiumsebiferum'],
    };
    // 團體賽格子較寬，只有特別長的名字要指定換行（不指定的話會縮到很小才換行）；linesFont＝這些名字的最大字級
    const TEAM_LINES = {
        'FOX小隊怎麼這麼香-狼師檔案': ['FOX小隊怎麼', '這麼香-狼師檔案'],
        '我是TOWA常闇的狗-小空TW':    ['我是TOWA常闇的狗', '-小空TW'],
    };
    const LAYOUTS = {
        // VALORANT 預賽 A–D 組：最左邊第一輪，由上到下 8 格
        valorant: { box: [440, 59], pad: [16, 0], font: 30, radius: 10, bye: true, slots: column(134, every104(256)) },
        // SF6 個人賽 A–H 組：左側 1–8 格＋右側 1–8 格
        sf6Solo:  { box: [161, 52], pad: [8, 0], font: 24, radius: 10, lines: SOLO_LINES, slots: [...column(55, every104(260)), ...column(1704, every104(260))] },
        // SF6 團體賽 A–D 組：左側 1–4 格＋右側 1–4 格，每格三位隊員各佔一行
        sf6Team:  { box: [219, 168], pad: [10, 6], font: 22, grow: 26, radius: 12, lines: TEAM_LINES, linesFont: 20, slots: [...column(67, [275, 473, 671, 869]), ...column(1646, [275, 473, 671, 869])] },
    };
    const STAGE_WIDTH = 1920;
    const LINE_HEIGHT = 1.2;    // 與 CSS .bracket-slot 的 line-height 相同
    const WRAP_BELOW  = 0.8;    // 字級縮到最大字級的 80% 以下仍放不下單行，才允許換成兩行
    const MIN_RATIO   = 0.4;    // 最小縮到最大字級的 40%（框本身 overflow:hidden，再長也不會超出框）
    const MAX_RESULTS = 50;

    const I18N = {
        zh: {
            teamPage: 'team.html', playerPage: 'player.html', sf6TeamPage: 'sf6-team.html',
            group: g => `${g}組`, teamNo: n => `第${n}隊`,
            empty: '找不到符合的名字',
            error: '賽程資料載入失敗，請稍後再試',
        },
        ja: {
            teamPage: 'team-ja.html', playerPage: 'player-ja.html', sf6TeamPage: 'sf6-team-ja.html',
            group: g => `${g}組`, teamNo: n => `チーム${n}`,
            empty: '該当する名前が見つかりません',
            error: '対戦表データの読み込みに失敗しました。しばらくしてから再度お試しください',
        },
        en: {
            teamPage: 'team-en.html', playerPage: 'player-en.html', sf6TeamPage: 'sf6-team-en.html',
            group: g => `Group ${g}`, teamNo: n => `Team ${n}`,
            empty: 'No matching names found',
            error: 'Failed to load the bracket. Please try again later.',
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

    // 全形／半形、大小寫視為相同（同 players.js / teams.js）
    const normalize = str => str.normalize('NFKC').toLowerCase().trim();

    // 分組按鈕列與圖片容器在同一個區塊裡（同 main.js 的對應方式）
    const buttonRowOf = container => container.parentElement.querySelector('.group-buttons');

    // ── 文字縮放 ──────────────────────────────────────────────
    // 疊字層內以原圖 px 排版，量字只看排版尺寸（不受 transform 縮放影響），所以每層只需在第一次顯示時量一次，
    // 之後視窗大小改變只更新縮放比例 --s；網頁字型載入完成時再重量一次
    const fitName = (cell, name, max, grow) => {
        const fixed = 'lines' in name.dataset;    // LAYOUTS 的 lines 指定過換行位置（或不換行）的名字
        const fits = size => name.scrollWidth <= name.clientWidth
            && name.offsetHeight <= cell.clientHeight
            && name.offsetHeight <= size * LINE_HEIGHT * 2 + 1;
        if (grow) {
            name.style.fontSize = `${grow}px`;
            name.classList.add('is-nowrap');
            if (fits(grow)) return;
        }
        for (let size = max; size >= Math.round(max * MIN_RATIO); size--) {
            name.style.fontSize = `${size}px`;
            name.classList.add('is-nowrap');
            if (fits(size)) return;
            if (fixed || size > max * WRAP_BELOW) continue;
            name.classList.remove('is-nowrap');
            if (fits(size)) return;
        }
    };

    const fitLayer = layer => {
        const max = Number(layer.dataset.font);
        const grow = Number(layer.dataset.grow) || 0;
        const linesFont = Number(layer.dataset.linesFont) || max;
        layer.querySelectorAll('.bracket-cell').forEach(cell => {
            const name = cell.firstElementChild;
            if ('lines' in name.dataset) fitName(cell, name, linesFont, 0);
            else fitName(cell, name, max, grow);
        });
        layer.dataset.fitted = '';
    };

    const layers = [];
    const resizer = new ResizeObserver(entries => entries.forEach(({ target }) => {
        const width = target.clientWidth;
        if (!width) return;    // 圖片沒在顯示（display:none）
        target.style.setProperty('--s', width / STAGE_WIDTH);
        if (!('fitted' in target.dataset)) fitLayer(target);
    }));
    const refit = () => layers.forEach(layer => {
        delete layer.dataset.fitted;
        if (layer.clientWidth) fitLayer(layer);
    });
    document.fonts.ready.then(refit);
    document.fonts.addEventListener('loadingdone', refit);

    // ── 疊字層 ────────────────────────────────────────────────
    // 有個人頁的名字做成 <a>（.bracket-link），沒有的（BYE、對不到資料）維持 <div>
    const linkOr = (className, href) => {
        if (!href) return el('div', className);
        const link = el('a', `${className} bracket-link`);
        link.href = href;
        return link;
    };

    // linkOf(entry, i)：entry＝VALORANT 隊名、SF6 個人賽選手名，或 SF6 團體賽的隊伍（{ no, members }），i＝第幾格；回傳個人頁網址（沒有就回傳 null）
    const createLayer = (img, layout, entries, linkOf) => {
        const layer = el('div', 'bracket-layer');
        const stage = el('div', 'bracket-stage');
        const [width, height] = layout.box;
        layer.dataset.font = layout.font;
        if (layout.grow) layer.dataset.grow = layout.grow;
        if (layout.linesFont) layer.dataset.linesFont = layout.linesFont;
        layer.style.setProperty('--pad-x', `${layout.pad[0]}px`);
        layer.style.setProperty('--pad-y', `${layout.pad[1]}px`);
        layer.style.setProperty('--radius', `${layout.radius}px`);

        const slots = entries.map((entry, i) => {
            const position = layout.slots[i];
            if (!position || (!entry && !layout.bye)) return null;
            // 整格是一個連結：VALORANT 隊名、SF6 個人賽連到隊伍／選手個人頁，SF6 團體賽（格內三位隊員各一行）連到隊伍個人頁
            const slot = !entry ? el('div', 'bracket-slot is-bye') : linkOr('bracket-slot', linkOf(entry, i));
            Object.assign(slot.style, { left: `${position[0]}px`, top: `${position[1]}px`, width: `${width}px`, height: `${height}px` });
            const names = !entry ? ['BYE'] : typeof entry === 'string' ? [entry] : entry.members;
            names.forEach(name => {
                const cell = el('div', 'bracket-cell');
                const lines = layout.lines && layout.lines[name];
                const span = el('span', 'bracket-name', lines ? undefined : name);
                if (lines) {
                    span.dataset.lines = '';
                    span.append(...lines.flatMap((line, k) => k ? [el('br'), line] : [line]));
                }
                cell.append(span);
                slot.append(cell);
            });
            stage.append(slot);
            return slot;
        });

        layer.append(stage);
        img.after(layer);
        layers.push(layer);
        resizer.observe(layer);
        return slots;
    };

    // ── 搜尋 ──────────────────────────────────────────────────
    const index = [];    // { name, key, meta, button, img, slot }
    const slotsByAt = new Map();    // '<賽程>-<組>-<格>' → { button, img, slot }，從個人頁回來時用

    const buildBracket = (container, data, teamsByName, playerIds) => {
        const kind = container.dataset.bracket;
        const layout = LAYOUTS[kind];
        const bracket = data[kind];
        const row = buttonRowOf(container);
        if (!layout || !bracket || !row) return;

        const pageOf = kind === 'valorant'
            ? name => teamsByName.has(name) ? `${t.teamPage}?id=${teamsByName.get(name).id}` : null
            : kind === 'sf6Team'
                ? team => `${t.sf6TeamPage}?id=${team.no}`
                : name => playerIds.has(name) ? `${t.playerPage}?id=${playerIds.get(name)}` : null;
        const buttons = row.querySelectorAll('.group-btn');
        const images = container.querySelectorAll(':scope > img');
        buttons.forEach((button, i) => {
            const group = button.dataset.group;
            const entries = bracket[group];
            const img = images[i];
            if (!entries || !img) return;    // 決賽等沒有抽籤資料的圖

            const atOf = s => `${kind}-${group}-${s + 1}`;
            const linkOf = (entry, s) => {
                const page = pageOf(entry);
                return page && `${page}&from=${atOf(s)}`;
            };
            const slots = createLayer(img, layout, entries, linkOf);
            slots.forEach((slot, s) => { if (slot) slotsByAt.set(atOf(s), { button, img, slot }); });
            const add = (name, meta, slot) => index.push({ name, key: normalize(name), meta: meta.join(' · '), kind, button, img, slot });
            entries.forEach((entry, s) => {
                if (!entry) return;
                if (kind === 'valorant') {
                    add(entry, [t.group(group)], slots[s]);
                    const team = teamsByName.get(entry);
                    if (team) [...team.members, team.sub].filter(Boolean)
                        .forEach(player => add(player.name, [t.group(group), entry], slots[s]));
                } else if (kind === 'sf6Solo') {
                    add(entry, [t.group(group)], slots[s]);
                } else {
                    entry.members.forEach(name => add(name, [t.group(group), t.teamNo(entry.no)], slots[s]));
                }
            });
        });
    };

    let hitSlot = null;
    let pending = null;
    const reveal = item => {
        if (pending) pending.disconnect();
        const show = () => {
            pending = null;
            if (hitSlot) hitSlot.classList.remove('is-hit');
            hitSlot = item.slot;
            hitSlot.classList.add('is-hit');
            // 剛切換過來的圖，ResizeObserver 還沒設好縮放比例（--s），先補上，否則會捲到錯的位置
            const layer = hitSlot.closest('.bracket-layer');
            if (layer.clientWidth) layer.style.setProperty('--s', layer.clientWidth / STAGE_WIDTH);
            hitSlot.scrollIntoView({ block: 'center' });
        };
        if (item.img.classList.contains('active')) { show(); return; }
        // main.js 會等圖片解碼完才把它設為 .active，等到那時再捲動
        pending = new MutationObserver(() => {
            if (item.img.classList.contains('active')) { pending.disconnect(); show(); }
        });
        pending.observe(item.img, { attributes: true, attributeFilter: ['class'] });
        item.button.click();
    };

    // 標示的格子在點畫面其他地方時取消（點標示的格子本身則保留）；搜尋結果按鈕的 click 會在之後再標示新的一格
    document.addEventListener('pointerdown', e => {
        if (!hitSlot || hitSlot.contains(e.target)) return;
        hitSlot.classList.remove('is-hit');
        hitSlot = null;
    });

    // 點圖上的名字離開前，把目前這一格記到網址的 #，按上一頁回來時才知道要切到哪一組、捲到哪一格
    document.addEventListener('click', e => {
        const link = e.target.closest('.bracket-link');
        if (!link) return;
        const at = new URL(link.href).searchParams.get('from');
        if (at) history.replaceState(history.state, '', `#bracket-${at}`);
    });

    // 每個 .bracket-search 是一個獨立的搜尋框；data-scope 指定只搜哪一種賽程（SF6 個人賽、團體賽分開搜），沒寫就搜整頁
    let loadError = false;
    const searches = [...document.querySelectorAll('.bracket-search')].map(box => {
        const input = box.querySelector('input[type="search"]');
        const results = box.querySelector('.bracket-search-results');
        const scope = box.dataset.scope;

        const render = () => {
            const query = normalize(input.value);
            results.replaceChildren();
            results.hidden = !query;
            if (!query) return;
            if (loadError) { results.append(el('li', 'bracket-search-empty', t.error)); return; }

            // 開頭就符合的排前面，其餘維持賽程表順序
            const matches = index.filter(item => (!scope || item.kind === scope) && item.key.includes(query))
                .sort((a, b) => !a.key.startsWith(query) - !b.key.startsWith(query))
                .slice(0, MAX_RESULTS);
            if (matches.length === 0) { results.append(el('li', 'bracket-search-empty', t.empty)); return; }
            matches.forEach(item => {
                const button = el('button', 'bracket-result');
                button.type = 'button';
                button.append(el('span', 'bracket-result-name', item.name), el('span', 'bracket-result-meta', item.meta));
                button.addEventListener('click', () => reveal(item));
                const li = el('li');
                li.append(button);
                results.append(li);
            });
        };

        input.addEventListener('input', render);
        input.addEventListener('keydown', e => {
            if (e.key !== 'Enter') return;
            const first = results.querySelector('.bracket-result');
            if (first) first.click();
        });
        return { input, render };
    });

    const getJSON = url => fetch(url, { cache: 'no-cache' }).then(res => {
        if (!res.ok) throw new Error(`${url}: ${res.status}`);
        return res.json();
    });
    const needsTeams = containers.some(container => container.dataset.bracket === 'valorant');
    const needsPlayers = containers.some(container => container.dataset.bracket !== 'valorant');

    Promise.all([getJSON(BRACKETS_URL), needsTeams ? getJSON(TEAMS_URL) : null, needsPlayers ? getJSON(PLAYERS_URL) : null])
        .then(([data, teams, players]) => {
            // 隊伍編號＝valorant-teams.json 內的報名順序（從 1 起算，同 teams.js 的 team.html?id=N）
            const teamsByName = new Map((teams ? teams.teams : []).map((team, i) => [team.name, { ...team, id: i + 1 }]));
            const playerIds = new Map((players ? players.players : []).map(player => [player.name, player.id]));
            containers.forEach(container => buildBracket(container, data, teamsByName, playerIds));
            const back = returnTo && slotsByAt.get(returnTo[1]);
            if (back) reveal(back);
        })
        .catch(err => {
            console.error(err);
            loadError = true;
        })
        .finally(() => searches.forEach(search => { if (search.input.value) search.render(); }));
})();
