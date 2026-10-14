// SF6 選手名鑑：完整名鑑頁 (#playerDirectory) 與 schedule 頁的人數統計 ([data-stat]) 共用 data/players.json
(() => {
    const directory = document.getElementById('playerDirectory');
    if (!directory && !document.querySelector('[data-stat]')) return;

    const PLAYERS_URL  = 'data/players.json';
    const PER_PAGE     = 24;
    const EVENTS       = ['SOLO', 'TEAM'];

    const I18N = {
        zh: {
            events: { SOLO: '個人', TEAM: '團體' },
            controls: { MODERN: '現代', CLASSIC: '經典' },
            count: n => `共 ${n} 位選手`,
            empty: '找不到符合條件的選手',
            error: '選手資料載入失敗，請稍後再試',
            prev: '上一頁',
            next: '下一頁',
            page: n => `第 ${n} 頁`,
        },
        ja: {
            events: { SOLO: '個人', TEAM: 'チーム' },
            controls: { MODERN: 'モダン', CLASSIC: 'クラシック' },
            count: n => `全 ${n} 名`,
            empty: '該当する選手が見つかりません',
            error: '選手データの読み込みに失敗しました。しばらくしてから再度お試しください',
            prev: '前のページ',
            next: '次のページ',
            page: n => `${n} ページ目`,
        },
        en: {
            events: { SOLO: 'SOLO', TEAM: 'TEAM' },
            controls: { MODERN: 'Modern', CLASSIC: 'Classic' },
            count: n => `${n} ${n === 1 ? 'player' : 'players'}`,
            empty: 'No players found.',
            error: 'Failed to load player data. Please try again later.',
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

    // 牌位名稱 → 顏色分級（對應 CSS 的 .player-card[data-tier]；較長的名稱要排在前面，避免 "Ultimate Master" 被判成 master）
    const TIERS = ['legend', 'ultimate master', 'grand master', 'high master', 'master',
        'diamond', 'platinum', 'gold', 'silver', 'bronze', 'iron', 'rookie'];
    const rankTier = rank => {
        const tier = TIERS.find(name => rank.toLowerCase().includes(name));
        return tier && tier.replace(' ', '-');
    };
    // 牌位高低（TIERS 由高到低排列），無牌位排最後
    const rankOrder = rank => {
        const index = TIERS.findIndex(name => rank.toLowerCase().includes(name));
        return index === -1 ? TIERS.length : index;
    };

    // 全形／半形、大小寫視為相同
    const normalize = str => str.normalize('NFKC').toLowerCase().trim();

    function createCard(player, index) {
        const card = el('article', 'player-card');
        card.style.setProperty('--i', index);
        const tier = rankTier(player.rank);
        if (tier) card.dataset.tier = tier;

        const meta = el('p', 'player-meta');
        const rank = el('span', 'player-rank');
        // 每個字各自一個 span；複合牌位（High／Grand／Ultimate Master）的 Master 用 Master 的綠色
        const rankText = el('span', 'player-rank-text');
        const words = (player.rank || '—').split(' ');
        words.forEach((word, i) => {
            if (i) rankText.append(' ');
            const isMaster = words.length > 1 && word.toLowerCase() === 'master';
            rankText.append(el('span', isMaster ? 'player-rank-word rank-master' : 'player-rank-word', word));
        });
        rank.append(rankText);
        meta.append(rank);

        const controlName = t.controls[player.control];
        if (controlName) meta.append(el('span', 'player-control', controlName));

        const events = el('ul', 'player-events');
        EVENTS.filter(ev => player.events.includes(ev))
            .forEach(ev => events.append(el('li', `tag-${ev.toLowerCase()}`, t.events[ev])));
        // 自訂標籤（players.json 的 tags，各語言顯示相同文字）
        (player.tags || []).forEach(tag => events.append(el('li', 'tag-custom', tag)));

        const info = el('div', 'player-info');
        info.append(meta, events);

        card.append(el('h3', 'player-name', player.name), info);
        return card;
    }

    const showMessage = (grid, text) => grid.replaceChildren(el('p', 'player-empty', text));

    // 總人數／個人賽／團體賽（名鑑頁與 schedule 頁的 [data-stat]）：
    // 優先使用 summary（正式名單未完整前），否則由資料計算；主辦（host）不計入人數
    function renderStats(players, summary) {
        const entrants = players.filter(p => !p.host);
        const stats = summary || {
            total: entrants.length,
            solo: entrants.filter(p => p.events.includes('SOLO')).length,
            team: entrants.filter(p => p.events.includes('TEAM')).length,
        };
        document.querySelectorAll('[data-stat]').forEach(node => {
            node.textContent = stats[node.dataset.stat];
        });
    }

    function initDirectory(players) {
        const grid       = directory.querySelector('.player-grid');
        const search     = directory.querySelector('#playerSearch');
        const filterBtns = directory.querySelectorAll('.filter-btn');
        const result     = directory.querySelector('.player-result');
        const pagination = directory.querySelector('.pagination');
        const controls   = directory.querySelector('.player-controls');
        const sortToggle  = directory.querySelector('.sort-toggle');
        const sortMenu    = directory.querySelector('.sort-menu');
        const sortCurrent = directory.querySelector('.sort-current');
        const sortItems   = sortMenu.querySelectorAll('[data-sort]');

        const state = { query: '', filter: 'all', sort: 'entry', page: 1 };
        const hostSlot = Math.random();

        // 排序：entry＝報名順序；rank-desc／rank-asc＝牌位高→低／低→高（無牌位一律排最後）；
        // name-asc／name-desc＝名稱 A→Z／Z→A。同值時維持報名順序
        const collator = new Intl.Collator(lang || undefined, { numeric: true, sensitivity: 'base' });
        const SORTS = {
            'rank-desc': (a, b) => a.rankOrder - b.rankOrder,
            'rank-asc':  (a, b) => (a.rankOrder === TIERS.length) - (b.rankOrder === TIERS.length) || b.rankOrder - a.rankOrder,
            'name-asc':  (a, b) => collator.compare(a.name, b.name),
            'name-desc': (a, b) => collator.compare(b.name, a.name),
        };

        const filtered = () => {
            const query = normalize(state.query);
            const list = players.filter(p =>
                (state.filter === 'all' || p.events.includes(state.filter.toUpperCase())) &&
                (!query || p.searchKey.includes(query)));
            const compare = SORTS[state.sort];
            // 依牌位／名稱排序時，主辦（host）跟其他人一起排
            if (compare) return list.sort((a, b) => compare(a, b) || a.id - b.id);
            // 報名順序時當彩蛋：主辦每次載入隨機藏在列表某處（篩選／搜尋改變時維持相對位置）
            const others = list.filter(p => !p.host);
            const at = Math.floor(hostSlot * (others.length + 1));
            others.splice(at, 0, ...list.filter(p => p.host));
            return others;
        };

        // 頁數多時以「…」省略：1 … 4 5 6 … 10
        const pageItems = (current, total) => {
            if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
            const start = Math.max(2, current - 1);
            const end   = Math.min(total - 1, current + 1);
            const items = [1];
            if (start > 2) items.push('…');
            for (let i = start; i <= end; i++) items.push(i);
            if (end < total - 1) items.push('…');
            items.push(total);
            return items;
        };

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
                ...pageItems(page, totalPages).map(item => item === '…'
                    ? el('span', 'page-gap', '…')
                    : pageButton(String(item), item, { active: item === page })),
                pageButton('❯', page + 1, { disabled: page === totalPages, ariaLabel: t.next }),
            );
        }

        function render() {
            const list = filtered();
            const totalPages = Math.max(1, Math.ceil(list.length / PER_PAGE));
            state.page = Math.min(state.page, totalPages);

            // 人數不含主辦（host），與上方統計的總報名人數一致
            result.textContent = t.count(list.filter(p => !p.host).length);
            if (list.length === 0) {
                showMessage(grid, t.empty);
            } else {
                const start = (state.page - 1) * PER_PAGE;
                grid.replaceChildren(...list.slice(start, start + PER_PAGE).map(createCard));
            }
            renderPagination(list.length === 0 ? 0 : totalPages);
        }

        search.addEventListener('input', () => {
            state.query = search.value;
            state.page = 1;
            render();
        });

        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                filterBtns.forEach(b => {
                    b.classList.toggle('active', b === btn);
                    b.setAttribute('aria-pressed', String(b === btn));
                });
                state.filter = btn.dataset.filter;
                state.page = 1;
                render();
            });
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

    fetch(PLAYERS_URL, { cache: 'no-cache' })
        .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        })
        .then(data => {
            // 一律依報名順序（編號）排列
            const players = data.players
                .map(p => ({ ...p, rank: p.rank || '', events: p.events || [], searchKey: normalize(p.name), rankOrder: rankOrder(p.rank || '') }))
                .sort((a, b) => a.id - b.id);
            renderStats(players, data.summary);
            if (directory) initDirectory(players);
        })
        .catch(err => {
            console.error('Failed to load players.json', err);
            if (directory) showMessage(directory.querySelector('.player-grid'), t.error);
        });
})();
