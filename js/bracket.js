// 賽程圖疊字＋名字搜尋：把 data/brackets.json 的抽籤結果疊在預賽賽程圖（.schedule-image-container[data-bracket]）的空白框上，
// 並提供賽程頁的名字搜尋（.bracket-search）。原始圖片不動：每張圖後面插一層 .bracket-layer，只在該圖 .active 時顯示（見 CSS）
// brackets.json 的 results（晉級結果）疊在之後各輪與決賽圖的框上，比賽當天只要改 JSON（no-cache 讀取，不必改版本號）
// VALORANT 賽程頁例外：晉級格跟著下方比賽時間表的 valorant-schedule.json（自動更新）走；
// SF6 賽程頁的晉級格跟著 sf6-*-results.json（js/sf6-live.js，自動更新）走，見「晉級格的自動更新」
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

    const I18N = {
        zh: {
            teamPage: 'team.html', playerPage: 'player.html', sf6TeamPage: 'sf6-team.html',
            group: g => `${g}組`, teamNo: n => `第${n}隊`, finalMatch: '決賽',
            empty: '找不到符合的名字',
            error: '賽程資料載入失敗，請稍後再試',
        },
        ja: {
            teamPage: 'team-ja.html', playerPage: 'player-ja.html', sf6TeamPage: 'sf6-team-ja.html',
            group: g => `${g}組`, teamNo: n => `チーム${n}`, finalMatch: '決勝',
            empty: '該当する名前が見つかりません',
            error: '対戦表データの読み込みに失敗しました。しばらくしてから再度お試しください',
        },
        en: {
            teamPage: 'team-en.html', playerPage: 'player-en.html', sf6TeamPage: 'sf6-team-en.html',
            group: g => `Group ${g}`, teamNo: n => `Team ${n}`, finalMatch: 'Final',
            empty: 'No matching names found',
            error: 'Failed to load the bracket. Please try again later.',
        },
    };
    const lang = document.documentElement.lang;
    const t = I18N[lang.startsWith('ja') ? 'ja' : lang.startsWith('en') ? 'en' : 'zh'];

    // ── 框的位置 ──────────────────────────────────────────────
    // 單位是賽程圖原始尺寸（1920×1080）的 px，量的是框內深色底（#45497b）的範圍；圖片改版時只要改這裡
    //   box：框的寬高；pad：文字與框邊的距離 [左右, 上下]；font：最大字級（放不下時自動縮小，必要時換成兩行）
    //   grow：（選填）名字單行放得下時改用這個較大的字級；放不下的長名字不放大，照 font 的規則縮小
    //   radius：框的圓角半徑（標示顏色時與圖上的框角對齊）
    //   slots：每一格左上角的 [x, y]，順序與 brackets.json 相同（BYE 的格子在 JSON 裡是 null）
    //   bye：圖上沒有印 BYE 的賽程設 true，由這裡疊「BYE」字；SF6 的圖已印好 BYE，不另外疊
    //   lines：（選填）指定換行位置的名字：名字 → 各行文字；只有一行＝不換行。這些名字只縮字級，不再自動換行
    //   rounds：第一輪之後各欄晉級的格子（由左到右），順序與 brackets.json 的 results 相同；
    //           每欄 { slots, box?, font? }，box、font 沒寫就用上面的值
    //   seeds：（SF6 決賽）第一輪由上到下是哪幾組的晉級者（圖上印的組別）
    //   codes：（選填）對戰代號（data/VALORANT賽程.csv 的 A1、E1…），標在每場兩格之間、括號線內側的空白處
    //          at：每個代號文字中心的 [x, y]，由左到右各欄、欄內由上到下；names：各組依 at 的順序對應的比賽編號
    //          （同 data/valorant-schedule.json 的 matchId；FINAL 依語言顯示成決賽／決勝／Final）
    //          頁面上有比賽時間表（.match-schedule）時，代號做成連到時間表的連結，點下去由 match-schedule.js 切到那一場
    const column = (x, ys) => ys.map(y => [x, y]);
    const every104 = top => Array.from({ length: 8 }, (_, i) => top + 104 * i);
    const every208 = top => Array.from({ length: 4 }, (_, i) => top + 208 * i);
    const matchesOf = (group, next) => [1, 2, 3, 4].map(i => `${group}${i}`).concat(next);
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
        // VALORANT 預賽 A–D 組：最左邊第一輪，由上到下 8 格；之後第二輪 4 格、第三輪 2 格（晉級決賽）
        valorant: { box: [440, 59], pad: [16, 0], font: 30, radius: 10, bye: true, slots: column(134, every104(256)), rounds: [
            { slots: column(726, every208(308)) },
            { slots: column(1358, [412, 828]) },
        ], codes: { font: 26, at: [...column(628, [337, 545, 753, 961]), ...column(1225, [441, 857])], names: {
            A: matchesOf('A', ['E1', 'E2']), B: matchesOf('B', ['E3', 'E4']), C: matchesOf('C', ['F1', 'F2']), D: matchesOf('D', ['F3', 'F4']),
        } } },
        // SF6 個人賽 A–H 組：左側 1–8 格＋右側 1–8 格；之後各輪同樣左側再右側，最後中間上方是晉級八強
        sf6Solo:  { box: [161, 52], pad: [8, 0], font: 24, radius: 10, lines: SOLO_LINES, slots: [...column(55, every104(260)), ...column(1704, every104(260))], rounds: [
            { slots: [...column(275, every208(312)), ...column(1485, every208(312))], box: [160, 52] },
            { slots: [...column(509, [416, 832]), ...column(1250, [416, 832])] },
            { slots: [[753, 624], [1006, 624]] },
            { slots: [[845, 467]], box: [230, 74], font: 28 },
        ] },
        // SF6 團體賽 A–D 組：左側 1–4 格＋右側 1–4 格，每格三位隊員各佔一行；之後各輪同樣左側再右側，最後中間上方是晉級四強
        sf6Team:  { box: [219, 168], pad: [10, 6], font: 22, grow: 26, radius: 12, lines: TEAM_LINES, linesFont: 20, slots: [...column(67, [275, 473, 671, 869]), ...column(1646, [275, 473, 671, 869])], rounds: [
            { slots: [...column(375, [374, 770]), ...column(1337, [374, 770])], box: [220, 169] },
            { slots: [[680, 572], [1032, 572]], box: [220, 169] },
            { slots: [[850, 349]], box: [220, 169] },
        ] },
    };
    // 決賽圖（分組按鈕的 Final，或容器的 data-group="Final"）：第一輪由上到下，之後各輪到冠軍
    const FINAL_LAYOUTS = {
        valorant: { box: [284, 59], pad: [16, 0], font: 28, radius: 10, slots: column(134, every104(256)), rounds: [
            { slots: column(526, every208(308)) },
            { slots: column(943, [412, 828]) },
            { slots: [[1349, 620]] },
        ], codes: { font: 24, at: [...column(458, [337, 545, 753, 961]), ...column(853, [441, 857]), [1267, 649]], names: {
            Final: ['G1', 'G2', 'G3', 'G4', 'H1', 'H2', 'FINAL'],
        } } },
        sf6Solo:  { box: [269, 59], pad: [12, 0], font: 26, radius: 10, lines: SOLO_LINES, seeds: ['A', 'E', 'C', 'G', 'D', 'H', 'B', 'F'], slots: column(158, every104(256)), rounds: [
            { slots: column(540, every208(308)) },
            { slots: column(940, [412, 828]) },
            { slots: [[1373, 620]] },
        ] },
        sf6Team:  { box: [368, 168], pad: [10, 6], font: 22, grow: 26, radius: 12, lines: TEAM_LINES, linesFont: 20, seeds: ['A', 'B', 'C', 'D'], slots: column(200, [271, 469, 667, 865]), rounds: [
            { slots: column(701, [370, 766]), box: [368, 169] },
            { slots: [[1197, 568]], box: [368, 169] },
        ] },
    };
    const STAGE_WIDTH = 1920;
    const LINE_HEIGHT = 1.2;    // 與 CSS .bracket-slot 的 line-height 相同
    const WRAP_BELOW  = 0.8;    // 字級縮到最大字級的 80% 以下仍放不下單行，才允許換成兩行
    const MIN_RATIO   = 0.4;    // 最小縮到最大字級的 40%（框本身 overflow:hidden，再長也不會超出框）
    const MAX_RESULTS = 50;

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
            else fitName(cell, name, Number(cell.parentElement.dataset.font) || max, grow);
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

    // columns：第一輪＋之後各輪，每欄 { slots, box, font, bye, entries }；entries＝VALORANT 隊名、SF6 個人賽選手名，
    // 或 SF6 團體賽的隊伍（{ no, members }），沒對到資料的晉級名字也是字串
    // linkOf(entry, n)：n＝整張圖的第幾格（各欄接續編號）；回傳個人頁網址（沒有就回傳 null）
    // group：這張圖是哪一組（Final＝決賽），用來取 layout.codes 的對戰代號
    // 回傳 { slots：所有格子（沒疊字的是 null）, columnSlots：各欄的格子, stage, layer, firstCode：第一個對戰代號（之後補的格子插在它前面，維持在代號下層） }

    // 一欄的格子：n0＝這一欄第一格在整張圖的編號；回傳每一格，沒疊字的是 null
    const makeSlots = (stage, layout, { slots: positions, box: [width, height], font, bye, entries }, linkOf, n0, before = null) =>
        positions.map((position, i) => {
            const at = n0 + i;
            const entry = entries[i];
            if (!entry && !bye) return null;
            // 整格是一個連結：VALORANT 隊名、SF6 個人賽連到隊伍／選手個人頁，SF6 團體賽（格內三位隊員各一行）連到隊伍個人頁
            const slot = !entry ? el('div', 'bracket-slot is-bye') : linkOr('bracket-slot', linkOf(entry, at));
            Object.assign(slot.style, { left: `${position[0]}px`, top: `${position[1]}px`, width: `${width}px`, height: `${height}px` });
            if (font) slot.dataset.font = font;
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
            stage.insertBefore(slot, before);
            return slot;
        });

    const createLayer = (img, layout, columns, linkOf, group) => {
        const layer = el('div', 'bracket-layer');
        const stage = el('div', 'bracket-stage');
        layer.dataset.font = layout.font;
        if (layout.grow) layer.dataset.grow = layout.grow;
        if (layout.linesFont) layer.dataset.linesFont = layout.linesFont;
        layer.style.setProperty('--pad-x', `${layout.pad[0]}px`);
        layer.style.setProperty('--pad-y', `${layout.pad[1]}px`);
        layer.style.setProperty('--radius', `${layout.radius}px`);

        let n = 0;
        const columnSlots = columns.map(column => {
            const slots = makeSlots(stage, layout, column, linkOf, n);
            n += column.slots.length;
            return slots;
        });

        const codes = layout.codes && layout.codes.names[group];
        const schedule = document.querySelector('.match-schedule[id]');
        let firstCode = null;
        if (codes) codes.forEach((code, i) => {
            const [x, y] = layout.codes.at[i];
            const text = code === 'FINAL' ? t.finalMatch : code;
            const label = schedule ? el('a', 'bracket-code', text) : el('div', 'bracket-code', text);
            if (schedule) {
                label.href = `#${schedule.id}`;
                label.dataset.match = code;
            }
            Object.assign(label.style, { left: `${x}px`, top: `${y}px`, fontSize: `${layout.codes.font}px` });
            stage.append(label);
            firstCode = firstCode || label;
        });

        layer.append(stage);
        img.after(layer);
        layers.push(layer);
        resizer.observe(layer);
        return { slots: columnSlots.flat(), columnSlots, stage, layer, firstCode };
    };

    // ── 晉級結果 ──────────────────────────────────────────────
    // brackets.json 的 results：每組一串陣列，對應 LAYOUTS 的 rounds（VALORANT 決賽多一欄第一輪，SF6 決賽第一輪由 seeds 帶入）
    // 名字 → 抽籤資料；團體賽用任一位隊員的名字都對得到隊伍
    const lookupOf = bracket => {
        const byName = new Map();
        Object.values(bracket).flat().forEach(entry => {
            if (entry) (typeof entry === 'string' ? [entry] : entry.members).forEach(name => byName.set(normalize(name), entry));
        });
        return byName;
    };

    // 晉級格填的值 → 抽籤資料。""＝還沒打完；名字（全形／半形、大小寫視為相同）；數字＝這張圖第一輪（first）的第幾格
    // 對不到的名字照原樣顯示（沒有連結），對不到的數字不顯示，兩者都會在 console 提醒
    const resolve = (value, first, byName) => {
        const text = value == null ? '' : String(value).trim();
        if (!text) return null;
        const isNumber = /^\d+$/.test(text);
        const found = byName.get(normalize(text)) || (isNumber ? first[Number(text) - 1] : null);
        if (found) return found;
        console.warn(`brackets.json results：對不到「${text}」`);
        return isNumber ? null : text;
    };

    // ── 搜尋 ──────────────────────────────────────────────────
    const index = [];    // { name, key, meta, button, img, slot }
    const slotsByAt = new Map();    // '<賽程>-<組>-<格>' → { button, img, slot }，從個人頁回來時用

    // ── 晉級格的自動更新（VALORANT、SF6） ──────────────────────
    // VALORANT：頁面上有比賽時間表時，match-schedule.js 每次讀到有變化的 valorant-schedule.json 會發出 valorant-schedule:update，
    // detail＝Map(比賽編號 → { sides: [隊伍 1, 隊伍 2], winner })，都是已確定的隊名（還沒確定是 null），判斷規則與時間表相同
    // 收到後 VALORANT 各圖第一輪之後的格子改用這份資料（不再看 brackets.json 的 results）；預賽圖第一輪的抽籤不動：
    //   有對戰代號的一欄＝這一欄各場的兩隊（例如預賽圖的 16強欄＝E1、E2 的兩隊，輪空直接晉級的隊伍也會出現），
    //   最後一欄（晉級決賽／冠軍）＝前一欄各場的勝隊。哪一場在哪一欄由 LAYOUTS／FINAL_LAYOUTS 的 codes 決定（由左到右每兩格一場）
    // SF6：js/sf6-live.js 每次讀到有變化的 sf6-*-results.json 會發出 nolly-bracket:update，
    //   detail＝{ kind: 'sf6Solo'|'sf6Team', images: { 組別: [各欄 { ids, lost }] } }（由 js/sf6-logic.js 算好）
    //   ids＝這一欄由上到下（左側先、右側後）的參賽者 ID（選手 id／隊伍編號，還沒確定是 null；null 整欄＝不動，用在預賽圖第一欄的抽籤）
    //   lost＝這一欄哪幾格是已完成比賽的敗方（字變淡，見 CSS 的 .bracket-slot.is-lose）
    //   收到後 SF6 各圖之後各輪的格子改用這份資料（不再看 brackets.json 的 results）
    // 只重畫內容有變的欄（敗方標記只切換 class）；還沒顯示的圖等第一次顯示時再量字（同 fitLayer）
    let live = null;
    const liveByKind = {};    // SF6：kind → nolly-bracket:update 的 detail
    const liveImages = [];    // { kind, img, button, group, isFinal, layout, columns, columnSlots, stage, layer, firstCode, linkOf, atOf, starts, keys, entryOf }

    const liveEntries = (info, data) => {
        const codes = info.layout.codes && info.layout.codes.names[info.group];
        if (!codes) return [];
        const sidesOf = code => (data.get(code) || { sides: [null, null] }).sides;
        const winnerOf = code => (data.get(code) || {}).winner || null;
        let k = 0;
        let previous = [];
        return info.columns.map((column, c) => {
            const pairs = c < info.columns.length - 1 ? column.slots.length / 2 : 0;
            const here = codes.slice(k, k + pairs);
            k += pairs;
            if (here.length === 0) return previous.map(winnerOf);
            previous = here;
            return c === 0 && !info.isFinal ? null : here.flatMap(sidesOf);
        });
    };

    // 每張圖各欄要顯示的內容：[{ entries（null＝不動）, lost（null＝不標）}]
    const liveColumns = info => {
        if (info.kind === 'valorant') return live ? liveEntries(info, live).map(entries => ({ entries, lost: null })) : [];
        const detail = liveByKind[info.kind];
        const columns = detail && detail.images[info.group];
        if (!columns) return [];
        return columns.map(column => ({
            entries: column.ids ? column.ids.map(id => id == null ? null : info.entryOf(id)) : null,
            lost: column.lost || null,
        }));
    };

    const applyLive = () => {
        liveImages.forEach(info => {
            let changed = false;
            liveColumns(info).forEach(({ entries, lost }, c) => {
                if (!info.columns[c]) return;
                if (entries) {
                    const key = JSON.stringify(entries);
                    if (info.keys[c] !== key) {
                        info.keys[c] = key;
                        changed = true;
                        const n0 = info.starts[c];
                        info.columnSlots[c].forEach((slot, i) => {
                            if (slot) slot.remove();
                            slotsByAt.delete(info.atOf(n0 + i));
                        });
                        info.columnSlots[c] = makeSlots(info.stage, info.layout, { ...info.columns[c], entries }, info.linkOf, n0, info.firstCode);
                        info.columnSlots[c].forEach((slot, i) => { if (slot) slotsByAt.set(info.atOf(n0 + i), { button: info.button, img: info.img, slot }); });
                    }
                }
                if (lost) info.columnSlots[c].forEach((slot, i) => { if (slot) slot.classList.toggle('is-lose', Boolean(lost[i])); });
            });
            if (changed) {
                delete info.layer.dataset.fitted;
                if (info.layer.clientWidth) fitLayer(info.layer);
            }
        });
    };

    document.addEventListener('valorant-schedule:update', e => {
        live = e.detail;
        applyLive();
    });
    document.addEventListener('nolly-bracket:update', e => {
        if (!e.detail || !e.detail.kind) return;
        liveByKind[e.detail.kind] = e.detail;
        applyLive();
    });

    const buildBracket = (container, data, teamsByName, playerIds) => {
        const kind = container.dataset.bracket;
        const bracket = data[kind];
        if (!LAYOUTS[kind] || !bracket) return;

        const results = (data.results && data.results[kind]) || {};
        const byName = lookupOf(bracket);
        const pick = (value, first) => resolve(value, first, byName);
        // 某組最後一格（晉級八強／四強），SF6 決賽第一輪用
        const winnerOf = group => {
            const rounds = results[group] || [];
            const last = rounds[rounds.length - 1];
            return pick(last && last[0], bracket[group] || []);
        };

        const pageOf = kind === 'valorant'
            ? name => teamsByName.has(name) ? `${t.teamPage}?id=${teamsByName.get(name).id}` : null
            : kind === 'sf6Team'
                ? team => team.no ? `${t.sf6TeamPage}?id=${team.no}` : null
                : name => playerIds.has(name) ? `${t.playerPage}?id=${playerIds.get(name)}` : null;
        // 晉級格自動更新用：SF6 的參賽者 ID → 這張圖的格子內容（個人賽＝選手名、團體賽＝隊伍資料）
        const playerNames = kind === 'sf6Solo' ? new Map([...playerIds].map(([name, id]) => [id, name])) : null;
        const teamsByNo = kind === 'sf6Team' ? new Map(Object.values(bracket).flat().filter(Boolean).map(team => [team.no, team])) : null;
        const entryOf = kind === 'sf6Solo' ? id => playerNames.get(id) || null
            : kind === 'sf6Team' ? no => teamsByNo.get(no) || null
            : null;

        // 沒有分組按鈕的圖（VALORANT、SF6 個人賽的決賽）由容器的 data-group 指定是哪一組
        const row = buttonRowOf(container);
        const buttons = row ? [...row.querySelectorAll('.group-btn')] : [];
        container.querySelectorAll(':scope > img').forEach((img, i) => {
            const button = buttons[i] || null;
            const group = button ? button.dataset.group : container.dataset.group;
            const isFinal = group === 'Final';
            const layout = (isFinal ? FINAL_LAYOUTS : LAYOUTS)[kind];
            const picks = results[group] || [];
            // 第一輪：預賽是抽籤；SF6 決賽是各組的晉級者；VALORANT 決賽是 results 的第一欄
            const first = !isFinal ? bracket[group]
                : layout.seeds ? layout.seeds.map(winnerOf)
                : (picks[0] || []).map(value => pick(value, []));
            if (!first) return;
            const later = isFinal && !layout.seeds ? picks.slice(1) : picks;
            const columns = [
                { slots: layout.slots, box: layout.box, bye: layout.bye, entries: first },
                ...layout.rounds.map((round, k) => ({ box: layout.box, ...round, entries: (later[k] || []).map(value => pick(value, first)) })),
            ];

            const atOf = n => `${kind}-${group}-${n + 1}`;
            const linkOf = (entry, n) => {
                const page = pageOf(entry);
                return page && `${page}&from=${atOf(n)}`;
            };
            const built = createLayer(img, layout, columns, linkOf, group);
            const slots = built.slots;
            slots.forEach((slot, n) => { if (slot) slotsByAt.set(atOf(n), { button, img, slot }); });
            const starts = [];
            columns.forEach((column, c) => starts.push(c ? starts[c - 1] + columns[c - 1].slots.length : 0));
            liveImages.push({ ...built, kind, img, button, group, isFinal, layout, columns, linkOf, atOf, starts, keys: [], entryOf });
            if (isFinal) return;    // 搜尋結果只指到預賽抽籤的位置

            const add = (name, meta, slot) => index.push({ name, key: normalize(name), meta: meta.join(' · '), kind, button, img, slot });
            first.forEach((entry, s) => {
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
            applyLive();    // 比賽時間表的資料比賽程圖先讀到時，這裡補上晉級格
            const back = returnTo && slotsByAt.get(returnTo[1]);
            if (back) reveal(back);
        })
        .catch(err => {
            console.error(err);
            loadError = true;
        })
        .finally(() => searches.forEach(search => { if (search.input.value) search.render(); }));
})();
