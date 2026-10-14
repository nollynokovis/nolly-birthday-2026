// VALORANT 參賽隊伍介紹：完整隊伍頁 (#teamDirectory) 與 schedule-valo 頁的人數統計 ([data-stat]) 共用 data/valorant-teams.json
// 卡片沿用 SF6 選手卡片（.player-card）的樣式，每隊為隊長＋隊員 4 人＋候補 1 人
(() => {
    const directory = document.getElementById('teamDirectory');
    if (!directory && !document.querySelector('[data-stat]')) return;

    const TEAMS_URL     = 'data/valorant-teams.json';

    const I18N = {
        zh: {
            captain: '隊長', sub: '候補', tbd: '隊名未定',
            count: n => `共 ${n} 組隊伍`,
            empty: '找不到符合條件的隊伍',
            error: '隊伍資料載入失敗，請稍後再試',
            prev: '上一頁',
            next: '下一頁',
            page: n => `第 ${n} 頁`,
        },
        ja: {
            captain: 'キャプテン', sub: '控え', tbd: 'チーム名未定',
            count: n => `全 ${n} チーム`,
            empty: '該当するチームが見つかりません',
            error: 'チームデータの読み込みに失敗しました。しばらくしてから再度お試しください',
            prev: '前のページ',
            next: '次のページ',
            page: n => `${n} ページ目`,
        },
        en: {
            captain: 'CAPTAIN', sub: 'SUB', tbd: 'TEAM NAME TBD',
            count: n => `${n} ${n === 1 ? 'team' : 'teams'}`,
            empty: 'No teams found.',
            error: 'Failed to load team data. Please try again later.',
            prev: 'Previous page',
            next: 'Next page',
            page: n => `Page ${n}`,
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

    // 牌位名稱 → 顏色分級（對應 CSS 的 .team-member[data-tier]）
    const TIERS = ['radiant', 'immortal', 'ascendant', 'diamond', 'platinum', 'gold', 'silver', 'bronze', 'iron'];
    const rankTier = rank => TIERS.find(name => rank.toLowerCase().includes(name));

    // 全形／半形、大小寫視為相同
    const normalize = str => str.normalize('NFKC').toLowerCase().trim();

    // role：captain／member／sub；沒有候補時顯示「—」，讓每張卡片的名單列數一致
    function createMember(player, role) {
        const item = el('li', `team-member is-${role}`);
        const rank = (player && player.rank) || '';
        const tier = rankTier(rank);
        if (tier) item.dataset.tier = tier;

        const name = el('span', 'team-member-name', (player && player.name) || '—');
        if (role !== 'member') name.append(el('span', 'team-role', t[role]));

        item.append(name, el('span', 'team-member-rank', player ? rank || '—' : ''));
        return item;
    }

    // 尚未湊齊、還沒有隊名的組別：隊名顯示「隊名未定」，空的隊員欄位顯示「—」
    function createCard(team, index) {
        const card = el('article', 'player-card team-card');
        card.style.setProperty('--i', index);
        card.style.setProperty('--hue', team.hue);

        const roster = el('ol', 'team-roster');
        team.members.forEach((player, i) => roster.append(createMember(player, i === 0 ? 'captain' : 'member')));
        roster.append(createMember(team.sub, 'sub'));

        const name = el('h3', team.name ? 'player-name' : 'player-name is-tbd', team.name || t.tbd);
        card.append(name, el('p', 'team-intro', team.intro || ''), roster);
        return card;
    }

    const showMessage = (grid, text) => grid.replaceChildren(el('p', 'player-empty', text));

    // 總報名人數（summary.total）／總組數／未加入隊伍人數（總報名人數 − 已在隊伍中的人數，含候補）
    function renderStats(teams, summary) {
        const teamed = teams.reduce((sum, team) => sum + team.players.length, 0);
        const total = summary && summary.total;
        const stats = { total: total || teamed, teams: teams.length, free: total ? total - teamed : 0 };
        document.querySelectorAll('[data-stat]').forEach(node => {
            node.textContent = stats[node.dataset.stat];
        });
    }

    function initDirectory(teams) {
        const grid        = directory.querySelector('.player-grid');
        const search      = directory.querySelector('#teamSearch');
        const result      = directory.querySelector('.player-result');
        const pagination  = directory.querySelector('.pagination');
        const controls    = directory.querySelector('.player-controls');
        const sortToggle  = directory.querySelector('.sort-toggle');
        const sortMenu    = directory.querySelector('.sort-menu');
        const sortCurrent = directory.querySelector('.sort-current');
        const sortItems   = sortMenu.querySelectorAll('[data-sort]');

        const state = { query: '', sort: 'entry', page: 1 };

        // 每頁隊數：電腦版 4 排 × 2＝8 隊，平板／手機 6 排 × 1＝6 隊；斷點與 CSS 的 .team-grid 改為 1 欄（max-width: 1024px）相同
        const oneColumn = window.matchMedia('(max-width: 1024px)');
        const perPage = () => (oneColumn.matches ? 6 : 8);
        let shownPerPage = perPage();

        // 排序：entry＝報名順序；name-asc／name-desc＝隊名 A→Z／Z→A（隊名未定的組別一律排最後）。同值時維持報名順序
        const collator = new Intl.Collator(lang || undefined, { numeric: true, sensitivity: 'base' });
        const SORTS = {
            'name-asc':  (a, b) => !a.name - !b.name || collator.compare(a.name, b.name),
            'name-desc': (a, b) => !a.name - !b.name || collator.compare(b.name, a.name),
        };

        // 頁碼按鈕與 SF6 選手名鑑相同（.pagination／.page-btn）；隊伍頁最多只有幾頁，不需要「…」省略
        const pageButton = (label, page, { disabled = false, active = false, ariaLabel } = {}) => {
            const btn = el('button', 'page-btn', label);
            btn.type = 'button';
            btn.disabled = disabled;
            if (active) {
                btn.classList.add('active');
                btn.setAttribute('aria-current', 'page');
            }
            btn.setAttribute('aria-label', ariaLabel || t.page(page));
            btn.addEventListener('click', () => {
                if (active || disabled) return;
                state.page = page;
                render();
                controls.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
            return btn;
        };

        function renderPagination(totalPages) {
            pagination.hidden = totalPages <= 1;
            if (totalPages <= 1) {
                pagination.replaceChildren();
                return;
            }
            const { page } = state;
            pagination.replaceChildren(
                pageButton('❮', page - 1, { disabled: page === 1, ariaLabel: t.prev }),
                ...Array.from({ length: totalPages }, (_, i) => pageButton(String(i + 1), i + 1, { active: i + 1 === page })),
                pageButton('❯', page + 1, { disabled: page === totalPages, ariaLabel: t.next }),
            );
        }

        // 搜尋隊名與隊員（含候補）名稱；每頁隊數見 perPage
        function render() {
            const query = normalize(state.query);
            const list = teams.filter(team => !query || team.searchKey.includes(query));
            const compare = SORTS[state.sort];
            list.sort((a, b) => (compare ? compare(a, b) : 0) || a.order - b.order);
            const size = perPage();
            const totalPages = Math.max(1, Math.ceil(list.length / size));
            state.page = Math.min(state.page, totalPages);
            shownPerPage = size;

            result.textContent = t.count(list.length);
            if (list.length === 0) {
                showMessage(grid, t.empty);
            } else {
                const start = (state.page - 1) * size;
                grid.replaceChildren(...list.slice(start, start + size).map(createCard));
            }
            renderPagination(list.length === 0 ? 0 : totalPages);
        }

        // 跨過斷點（例如旋轉平板）時重新分頁，並停在包含原本第一隊的那一頁
        oneColumn.addEventListener('change', () => {
            state.page = Math.floor((state.page - 1) * shownPerPage / perPage()) + 1;
            render();
        });

        search.addEventListener('input', () => {
            state.query = search.value;
            state.page = 1;
            render();
        });

        // 排序下拉選單：點按鈕開關，點外面或按 Esc 關閉
        const setSortMenu = open => {
            sortMenu.hidden = !open;
            sortToggle.setAttribute('aria-expanded', String(open));
        };

        sortToggle.addEventListener('click', () => {
            setSortMenu(sortMenu.hidden);
            if (!sortMenu.hidden) sortMenu.querySelector('[aria-checked="true"]').focus();
        });

        sortItems.forEach(item => {
            item.addEventListener('click', () => {
                sortItems.forEach(i => i.setAttribute('aria-checked', String(i === item)));
                sortCurrent.textContent = item.textContent;
                setSortMenu(false);
                sortToggle.focus();
                if (state.sort === item.dataset.sort) return;
                state.sort = item.dataset.sort;
                state.page = 1;
                render();
            });
        });

        document.addEventListener('click', e => {
            if (!sortMenu.hidden && !e.target.closest('.player-sort')) setSortMenu(false);
        });

        document.addEventListener('keydown', e => {
            if (e.key !== 'Escape' || sortMenu.hidden) return;
            setSortMenu(false);
            sortToggle.focus();
        });

        render();
    }

    fetch(TEAMS_URL, { cache: 'no-cache' })
        .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        })
        .then(data => {
            // order＝報名順序（JSON 內的順序）；players＝隊員＋候補（略過空的欄位）
            // hue＝書籤色相，第一隊紅（0）到最後一隊紫（280）平均分配，搜尋或排序後顏色仍跟著隊伍
            const last = Math.max(data.teams.length - 1, 1);
            const teams = data.teams.map((team, order) => {
                const players = [...team.members, team.sub].filter(Boolean);
                return {
                    ...team,
                    name: team.name || '',
                    order,
                    hue: Math.round(order / last * 280),
                    players,
                    searchKey: normalize([team.name || '', ...players.map(p => p.name)].join('\n')),
                };
            });
            renderStats(teams, data.summary);
            if (directory) initDirectory(teams);
        })
        .catch(err => {
            console.error('Failed to load valorant-teams.json', err);
            if (directory) showMessage(directory.querySelector('.player-grid'), t.error);
        });
})();
