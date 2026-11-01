// SF6 對戰一覽（MATCH SCHEDULE）：schedule-sf6*.html 的 .sf6-schedule（個人賽 9 個分頁：A–H 組＋決賽階段；團體賽 5 個分頁：A–D 組＋決賽階段）
//   每場：MATCH（狀態標記＋場次編號，分頁內簡化成 R1-1、QF-1、3RD、FINAL）｜ROUND（組內16強…冠軍決賽）｜PLAYERS／TEAMS（左右對稱，VS 固定在中間）
//   BYE 的場次不列出（晉級結果照樣帶到後面的場次）；不顯示比分
// 資料：比賽結構＋結果的計算由 js/sf6-live.js（js/sf6-logic.js）完成，以 nolly-sf6:update 交過來——和組別進度、賽程圖疊字是同一份結果，
//   這裡不另外讀結果、不另外輪詢；組別時間讀 data/sf6-schedule-times.json 一次（當天不會變）
// 搜尋：對戰一覽上方有自己的搜尋欄（.match-search，只篩選對戰一覽）；頁面上方該項目的搜尋欄（.bracket-search[data-scope]，
//   下拉結果與賽程圖標示仍由 bracket.js 負責）輸入時，文字也會同步帶進對戰一覽的搜尋欄一起篩選
//   只用已確定的選手／隊員名稱比對（不搜場次編號），還沒確定晉級的人不會被當成後面場次的參賽者；目前分頁沒有結果時自動切到第一個有結果的分頁
// 場次編號可點：依比賽結構的 group 切到上方對應的組別按鈕（決賽階段＝決賽圖）並捲過去
// 自動更新只換內容有變的列，不改目前的分頁、搜尋內容與捲動位置
(() => {
    const roots = [...document.querySelectorAll('.sf6-schedule[data-live-event]')];
    if (!roots.length || !window.NollyLive) return;

    const TIMES_URL = 'data/sf6-schedule-times.json';
    const EVENT_KEY = { sf6Solo: 'sf6-individual', sf6Team: 'sf6-team' };
    const FINAL_ORDER = ['QF', 'SF', '3RD', 'F'];    // 決賽階段的列順序（季軍決定戰在冠軍決賽前）

    const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const I18N = {
        zh: {
            tab: g => g === 'Final' ? '決賽階段' : `${g}組`,
            title: g => g === 'Final' ? 'FINALS｜決賽階段' : `GROUP ${g}｜${g}組`,
            date: (m, d, w) => `${m}月${d}日(${'日一二三四五六'[w]})`,
            tbd: '未定',
            winner: id => `${id} 勝者`,
            loser: id => `${id} 敗者`,
            groupWinner: g => `${g}組冠軍`,
            status: { scheduled: '尚未開始', live: '進行中', completed: '已完成' },
            bracket: g => g === 'Final' ? '查看決賽賽程圖' : `查看${g}組賽程圖`,
            empty: '找不到符合的比賽',
            none: '這個分頁沒有對戰',
        },
        ja: {
            tab: g => g === 'Final' ? '決勝トーナメント' : `${g}組`,
            title: g => g === 'Final' ? 'FINALS｜決勝トーナメント' : `GROUP ${g}｜${g}組`,
            date: (m, d, w) => `${m}月${d}日(${'日月火水木金土'[w]})`,
            tbd: '未定',
            winner: id => `${id} 勝者`,
            loser: id => `${id} 敗者`,
            groupWinner: g => `${g}組1位`,
            status: { scheduled: '開始前', live: '進行中', completed: '終了' },
            bracket: g => g === 'Final' ? '決勝の対戦表を見る' : `${g}組の対戦表を見る`,
            empty: '該当する試合が見つかりません',
            none: 'このタブに試合はありません',
        },
        en: {
            tab: g => g === 'Final' ? 'Finals' : `Group ${g}`,
            title: g => g === 'Final' ? 'FINALS' : `GROUP ${g}`,
            date: (m, d, w) => `${MONTHS[m - 1]}. ${String(d).padStart(2, '0')} ${['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][w]}`,
            tbd: 'TBA',
            winner: id => `Winner of ${id}`,
            loser: id => `Loser of ${id}`,
            groupWinner: g => `Group ${g} Winner`,
            status: { scheduled: 'Upcoming', live: 'Live', completed: 'Completed' },
            bracket: g => g === 'Final' ? 'View the finals bracket' : `View the Group ${g} bracket`,
            empty: 'No matching matches found',
            none: 'No matches in this tab',
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
    const normalize = str => String(str).normalize('NFKC').toLowerCase().trim();
    const dateText = iso => {
        const [y, m, d] = iso.split('-').map(Number);
        return t.date(m, d, new Date(Date.UTC(y, m - 1, d)).getUTCDay());
    };
    const statusMark = status => {
        const mark = el('span', `status-mark is-${status}`);
        mark.setAttribute('role', 'img');
        mark.setAttribute('aria-label', t.status[status]);
        mark.title = t.status[status];
        return mark;
    };

    // 分頁內顯示的場次編號：組別內 R1-1；決賽階段 QF-1、SF-1、3RD、FINAL（JSON 的 matchId 不變）
    const shortId = def => def.group !== 'Final' ? `${def.round}-${def.index}`
        : def.round === 'F' ? 'FINAL'
        : def.round === '3RD' ? '3RD'
        : `${def.round}-${def.index}`;

    // 組別 → 上方賽程圖：有分組按鈕的圖按那一顆按鈕（main.js 切換），沒有按鈕的（個人賽決賽圖）由容器的 data-group 指定
    const bracketTarget = (kind, group) => {
        for (const container of document.querySelectorAll(`.schedule-image-container[data-bracket="${kind}"]`)) {
            const row = container.parentElement.querySelector('.group-buttons');
            const button = row && row.querySelector(`.group-btn[data-group="${group}"]`);
            if (button && !container.dataset.group) return { button, scrollTo: row };
            if (container.dataset.group === group) return { button: null, scrollTo: container.closest('.subsection') || container };
        }
        return null;
    };
    const showBracket = target => {
        if (target.button && !target.button.classList.contains('active')) target.button.click();
        const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const top = target.scrollTo.getBoundingClientRect().top + window.scrollY - 80;    // 留出固定導覽列的高度
        window.scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' });
    };

    const timesReady = NollyLive.load(TIMES_URL).catch(err => {
        console.error(err);
        return null;
    });

    const setupView = root => {
        const kind = root.dataset.liveEvent;
        const tabsBox = root.querySelector('.match-stages');
        const info = root.querySelector('.sf6-schedule-info');
        const tbody = root.querySelector('.sf6-table tbody');
        const search = document.querySelector(`.bracket-search[data-scope="${kind}"] input`);    // 頁面上方的搜尋欄
        const filter = root.querySelector('.match-search input');                                  // 對戰一覽上方的搜尋欄
        const queryText = () => normalize(filter ? filter.value : search ? search.value : '');

        let items = [];    // { id, def, tab, status, sides: [view], keys, sig }
        let tabs = [];     // 分頁：組別＋Final
        let current = null;
        let tabButtons = [];
        let times = null;
        const rowCache = new Map();
        const messageRows = new Map();

        const setRows = rows => {
            const now = [...tbody.children];
            if (rows.length === now.length && rows.every((row, i) => row === now[i])) return;
            tbody.replaceChildren(...rows);
        };
        const showMessage = text => {
            if (!messageRows.has(text)) {
                const row = el('tr', 'sf6-empty');
                const cell = el('td', '', text);
                cell.colSpan = 3;
                row.append(cell);
                messageRows.set(text, row);
            }
            setRows([messageRows.get(text)]);
        };

        // 分頁上方的組別時間：「GROUP A｜A組」＋日期、CHECK-IN、MATCH；決賽階段有 sessions 時分段顯示
        const renderInfo = () => {
            const key = `${current}|${JSON.stringify(times && times[EVENT_KEY[kind]] && times[EVENT_KEY[kind]][current])}`;
            if (info.dataset.key === key) return;
            info.dataset.key = key;
            const entry = times && times[EVENT_KEY[kind]] && times[EVENT_KEY[kind]][current];
            const line = (session, label) => {
                const p = el('p', 'sf6-schedule-time');
                if (label) p.append(el('span', 'sf6-schedule-stage', label));
                if (entry && entry.date && !label) p.append(el('span', 'sf6-schedule-date', dateText(entry.date)));
                p.append(el('span', '', `CHECK-IN ${session.checkInTime || t.tbd}`), el('span', 'sf6-schedule-sep', '｜'),
                    el('span', '', `MATCH ${session.startTime && session.endTime ? `${session.startTime}–${session.endTime}` : t.tbd}`));
                return p;
            };
            const parts = [el('p', 'sf6-schedule-title', t.title(current))];
            if (entry) {
                if (Array.isArray(entry.sessions) && entry.sessions.length) {
                    if (entry.date) parts.push(el('p', 'sf6-schedule-time', dateText(entry.date)));
                    entry.sessions.forEach(session => parts.push(line(session, (session.rounds || []).map(r => detail.roundLabel(r)).join('・'))));
                } else {
                    parts.push(line(entry));
                }
            }
            info.replaceChildren(...parts);
        };

        const buildRow = item => {
            const row = el('tr');
            row.dataset.match = item.id;

            const matchCell = el('td', 'sf6-match');
            const target = bracketTarget(kind, item.def.group);
            const label = target ? el('a', 'sf6-match-id sf6-match-link') : el('span', 'sf6-match-id');
            label.append(statusMark(item.status), item.label);
            if (target) {
                label.href = `#${(target.scrollTo.id || '')}`;
                label.title = t.bracket(item.def.group);
                label.addEventListener('click', e => {
                    e.preventDefault();
                    showBracket(target);
                });
            }
            matchCell.append(label, el('span', 'sf6-status-text', t.status[item.status]));

            const versus = el('div', 'sf6-versus');
            item.sides.forEach((side, i) => {
                if (i) versus.append(el('span', 'sf6-vs', 'VS'));
                const node = el('div', `sf6-side${side.className}`);
                node.append(el('span', 'sf6-name', side.name));
                if (side.members && side.members.length) node.append(el('span', 'sf6-members', side.members.join(' / ')));
                versus.append(node);
            });
            const sidesCell = el('td', 'sf6-sides');
            sidesCell.append(versus);

            row.append(matchCell, el('td', 'sf6-round', item.round), sidesCell);
            return row;
        };
        const rowOf = item => {
            const cached = rowCache.get(item.id);
            if (cached && cached.sig === item.sig) return cached.row;
            const row = buildRow(item);
            rowCache.set(item.id, { sig: item.sig, row });
            return row;
        };

        const isHit = (item, query) => item.keys.some(key => key.includes(query));

        // 分頁上的組別狀態（與組別按鈕同一份判斷，見 js/sf6-logic.js 的 groups）：進行中＝紅點、全部比完＝灰勾、尚未開始不加
        // 標記放在分頁名稱前面，和下方每一場編號前的標記同一種圖形；狀態沒變就不動 DOM
        const renderTabMark = (button, status) => {
            const old = button.querySelector('.status-mark');
            const want = status === 'live' || status === 'completed' ? status : null;
            if (old && want && old.classList.contains(`is-${want}`)) return;
            if (old) old.remove();
            if (want) button.prepend(statusMark(want));
        };

        const render = () => {
            const query = queryText();
            const found = query ? items.filter(item => isHit(item, query)) : items;
            tabButtons.forEach(({ tab, button, count }) => {
                const n = found.filter(item => item.tab === tab).length;
                button.setAttribute('aria-pressed', String(tab === current));
                button.classList.toggle('is-empty', Boolean(query) && n === 0);
                count.textContent = n;
                count.hidden = !query || n === 0;
                renderTabMark(button, detail && detail.model.groups.get(tab));
            });
            renderInfo();
            const rows = found.filter(item => item.tab === current);
            if (rows.length === 0) showMessage(query ? t.empty : t.none);
            else setRows(rows.map(rowOf));
        };

        // 搜尋時目前的分頁沒有結果，就切到第一個有結果的分頁（手動按分頁時不自動切換；自動更新也不會切換）
        const onSearch = () => {
            const query = queryText();
            if (query && !items.some(item => item.tab === current && isHit(item, query))) {
                const tab = tabs.find(g => items.some(item => item.tab === g && isHit(item, query)));
                if (tab) current = tab;
            }
            render();
        };

        let detail = null;
        const update = next => {
            detail = next;
            const { structure, model } = next;
            const defs = new Map(structure.matches.map(m => [m.matchId, m]));
            const roundOrder = (def) => def.group === 'Final' ? FINAL_ORDER.indexOf(def.round) : structure.bracketRounds[def.group].indexOf(def.round);

            // 還沒確定的一邊：同一分頁裡引用「R1-1 勝者」；決賽階段引用各組冠軍時寫「A組冠軍」
            const sideOf = (side, def, outcome) => {
                if (side.kind === 'entrant') {
                    const view = next.view(side.id);
                    return { name: view.name, members: view.members, className: outcome, keyNames: [view.name, ...view.members] };
                }
                if (side.kind === 'pending') {
                    const from = defs.get(side.ref);
                    const text = from && from.group !== def.group && side.role === 'winner' ? t.groupWinner(from.group) : t[side.role](from ? shortId(from) : side.ref);
                    return { name: text, members: [], className: ' is-pending', keyNames: [] };
                }
                return { name: '—', members: [], className: ' is-pending', keyNames: [] };
            };

            items = structure.matches
                .filter(def => model.matches.get(def.matchId).status !== 'bye')
                .map(def => {
                    const m = model.matches.get(def.matchId);
                    const outcome = i => m.status === 'completed' ? (m.winner === `team${i + 1}` ? ' is-win' : ' is-lose') : '';
                    const sides = m.sides.map((side, i) => sideOf(side, def, outcome(i)));
                    const label = shortId(def);
                    const round = next.roundLabel(def.round);
                    const keys = sides.flatMap(s => s.keyNames).map(normalize);    // 只比對已確定的選手／隊員名稱，不搜場次編號
                    const sig = JSON.stringify([label, round, m.status, sides.map(s => [s.name, s.members, s.className])]);
                    return { id: def.matchId, def, tab: def.group, label, round, status: m.status, sides, keys, sig, order: [roundOrder(def), def.index] };
                })
                // 每個分頁裡依輪次、再依同一輪由上到下的順序（分頁本身在 render 時篩選）
                .sort((a, b) => a.order[0] - b.order[0] || a.order[1] - b.order[1]);

            if (!tabButtons.length) {
                tabs = [...structure.groups, 'Final'];
                current = tabs.includes(model.currentGroup) ? model.currentGroup : tabs[0];
                tabButtons = tabs.map(tab => {
                    const button = el('button', 'match-stage-btn');
                    button.type = 'button';
                    const count = el('span', 'match-stage-count');
                    count.hidden = true;
                    button.append(el('span', 'match-stage-label', t.tab(tab)), count);
                    button.addEventListener('click', () => { current = tab; render(); });
                    tabsBox.append(button);
                    return { tab, button, count };
                });
                // 頁面上方的搜尋欄：文字同步帶進對戰一覽的搜尋欄再篩選；對戰一覽的搜尋欄：只篩選對戰一覽
                if (search) search.addEventListener('input', () => {
                    if (filter) filter.value = search.value;
                    onSearch();
                });
                if (filter) filter.addEventListener('input', onSearch);
                timesReady.then(data => { times = data; render(); });
                root.hidden = false;
                // 瀏覽器還原了頁面上方搜尋欄的文字時，一併帶進對戰一覽的搜尋欄
                if (filter && search && search.value && !filter.value) filter.value = search.value;
                if (queryText()) onSearch();
                else render();
                // 網址帶 #individual-match-schedule 這類錨點（導覽列連結、分享的網址）時，區塊載入前是隱藏的、瀏覽器捲不到，顯示後補捲一次
                if (root.id && location.hash === `#${root.id}`) root.scrollIntoView();
                return;
            }
            render();    // 自動更新：維持目前的分頁與搜尋，只換有變的列
        };

        return { kind, update };
    };

    const views = new Map(roots.map(root => {
        const view = setupView(root);
        return [view.kind, view];
    }));
    document.addEventListener('nolly-sf6:update', e => {
        const view = e.detail && views.get(e.detail.kind);
        if (view) view.update(e.detail);
    });
})();
