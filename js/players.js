// SF6 選手名鑑：完整名鑑頁 (#playerDirectory)、選手個人頁 (#playerProfile，player.html?id=N)
// 與 schedule 頁的人數統計 ([data-stat]) 共用 data/players.json
(() => {
    const directory = document.getElementById('playerDirectory');
    const profile   = document.getElementById('playerProfile');
    if (!directory && !profile && !document.querySelector('[data-stat]')) return;

    const PLAYERS_URL  = 'data/players.json';
    const PER_PAGE     = 24;
    const EVENTS       = ['SOLO', 'TEAM'];
    // 名鑑狀態（網址參數字串、主辦彩蛋位置、最後點開的選手）；選手個人頁的「返回選手名鑑」也讀這裡
    const STATE_KEY    = 'nolly-sf6-directory';
    // 個人頁欄位的英文小標（中文／日文頁顯示在欄位名稱下方）
    const FIELDS_EN    = { rank: 'HIGHEST RANK', control: 'CONTROL TYPE', events: 'EVENTS' };
    // 主辦個人頁彩蛋最後一面的按鈕連結
    const HOST_LINK    = 'https://7.gigafile.nu/0109-d835ab6a27fd5d7d8f30b2928905329e';
    // 選手個人頁的參賽紀念卡背景模板（SF6 專用直式版，原始尺寸 1080×1350；下方空白框放選手資訊，見 CSS .player-memorial）
    const MEMORIAL_BG   = 'img/1x/參賽者紀念卡sf6.webp?v=20261020f';
    const MEMORIAL_SIZE = { width: 1080, height: 1350 };
    // 紀念卡存成 PNG 用的 html2canvas（MIT，1.4.1），第一次按下載時才載入
    const HTML2CANVAS_URL = 'js/vendor/html2canvas.min.js';

    const I18N = {
        zh: {
            directory: 'players.html',
            profile: 'player.html',
            events: { SOLO: '個人', TEAM: '團體' },
            controls: { MODERN: '現代', CLASSIC: '經典' },
            count: n => `共 ${n} 位選手`,
            empty: '找不到符合條件的選手',
            error: '選手資料載入失敗，請稍後再試',
            prev: '上一頁',
            next: '下一頁',
            page: n => `第 ${n} 頁`,
            fields: { no: '選手編號', rank: '最高牌位', control: '操作模式', events: '參賽項目' },
            eventNames: { SOLO: '個人賽', TEAM: '團體賽' },
            host: '主辦',
            brand: '生日盃',
            hostBack: '你沒資格啊，你沒資格',
            hostRoll: '前有翻滾',
            hostMsg: '居然是訊息......',
            hostView: '前有絕景',
            hostLink: '敬請見證',
            download: '下載參賽紀念卡',
            downloadNote: '※本紀念卡僅供個人收藏及非商業分享使用，請勿擅自修改或用於商業用途。',
            downloading: '圖片產生中…',
            downloadError: '圖片產生失敗，請再試一次',
            notFound: '找不到這位選手',
            notFoundHint: '連結可能有誤，請回到選手名鑑重新選擇。',
            back: '← 返回選手名鑑',
            title: name => `${name}｜STREET FIGHTER 6 選手介紹｜Nolly生日盃`,
        },
        ja: {
            directory: 'players-ja.html',
            profile: 'player-ja.html',
            events: { SOLO: '個人', TEAM: 'チーム' },
            controls: { MODERN: 'モダン', CLASSIC: 'クラシック' },
            count: n => `全 ${n} 名`,
            empty: '該当する選手が見つかりません',
            error: '選手データの読み込みに失敗しました。しばらくしてから再度お試しください',
            prev: '前のページ',
            next: '次のページ',
            page: n => `${n} ページ目`,
            fields: { no: '選手番号', rank: '最高ランク', control: '操作タイプ', events: '出場部門' },
            eventNames: { SOLO: '個人戦', TEAM: 'チーム戦' },
            host: '主催',
            brand: '生日杯',
            hostBack: 'その資格はないおぉ、その資格はない',
            hostRoll: 'この先、ローリングがあるぞ',
            hostMsg: 'メッセージだ……',
            hostView: 'この先、絶景があるぞ',
            hostLink: '見届けるがよい！',
            download: '参加記念カードをダウンロード',
            downloadNote: '※本記念カードは個人での保存および非営利目的での共有に限りご利用いただけます。無断での改変や商用利用はご遠慮ください。',
            downloading: '画像を作成中…',
            downloadError: '画像の作成に失敗しました。もう一度お試しください',
            notFound: 'この選手は見つかりませんでした',
            notFoundHint: 'リンクが正しくない可能性があります。選手名鑑からもう一度お選びください。',
            back: '← 選手名鑑へ戻る',
            title: name => `${name}｜STREET FIGHTER 6 選手プロフィール｜Nolly生日杯`,
        },
        en: {
            directory: 'players-en.html',
            profile: 'player-en.html',
            events: { SOLO: 'SOLO', TEAM: 'TEAM' },
            controls: { MODERN: 'Modern', CLASSIC: 'Classic' },
            count: n => `${n} ${n === 1 ? 'player' : 'players'}`,
            empty: 'No players found.',
            error: 'Failed to load player data. Please try again later.',
            prev: 'Previous page',
            next: 'Next page',
            page: n => `Page ${n}`,
            fields: { no: 'Player No.', rank: 'Highest Rank', control: 'Control Type', events: 'Events' },
            eventNames: { SOLO: 'SOLO', TEAM: 'TEAM' },
            host: 'HOST',
            brand: 'CUP',
            hostBack: "You don't have the right\nO you don't have the right",
            hostRoll: 'Rolling ahead',
            hostMsg: "It's a message...",
            hostView: 'Behold, scenery!',
            hostLink: 'Bear Witness!',
            download: 'DOWNLOAD MEMORIAL CARD',
            downloadNote: '※ This memorial card is for personal collection and non-commercial sharing only. Please do not modify it or use it for commercial purposes.',
            downloading: 'CREATING IMAGE…',
            downloadError: 'Failed to create the image. Please try again.',
            notFound: 'Player not found',
            notFoundHint: 'The link may be incorrect. Please choose a player from the player list.',
            back: '← BACK TO PLAYER LIST',
            title: name => `${name} | STREET FIGHTER 6 Player Profile | Nolly CUP`,
        },
    };
    const lang = document.documentElement.lang;
    const isEn = lang.startsWith('en');
    const t = I18N[lang.startsWith('ja') ? 'ja' : isEn ? 'en' : 'zh'];

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

    // 牌位文字：每個字各自一個 span；複合牌位（High／Grand／Ultimate Master）的 Master 用 Master 的綠色
    function createRankText(rank) {
        const rankText = el('span', 'player-rank-text');
        const words = (rank || '—').split(' ');
        words.forEach((word, i) => {
            if (i) rankText.append(' ');
            const isMaster = words.length > 1 && word.toLowerCase() === 'master';
            rankText.append(el('span', isMaster ? 'player-rank-word rank-master' : 'player-rank-word', word));
        });
        return rankText;
    }

    function createCard(player, index) {
        const card = el('article', 'player-card');
        card.style.setProperty('--i', index);
        const tier = rankTier(player.rank);
        if (tier) card.dataset.tier = tier;

        const meta = el('p', 'player-meta');
        const rank = el('span', 'player-rank');
        rank.append(createRankText(player.rank));
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

        // 整張卡片可點：名稱是連往個人頁的連結，其 ::after 蓋滿卡片（見 CSS .player-card-link）
        // 連結與錨點都用 players.json 的 id，不受搜尋／篩選／排序後的位置影響
        card.id = `player-${player.id}`;
        const link = el('a', 'player-card-link', player.name);
        link.href = `${t.profile}?id=${player.id}`;
        const name = el('h3', 'player-name');
        name.append(link);

        card.append(name, info);
        return card;
    }

    const showMessage = (grid, text) => grid.replaceChildren(el('p', 'player-empty', text));

    // sessionStorage 在部分隱私模式下會丟錯，此時就不保留名鑑狀態
    const loadSaved = () => {
        try { return JSON.parse(sessionStorage.getItem(STATE_KEY)) || {}; } catch (e) { return {}; }
    };
    const save = patch => {
        try { sessionStorage.setItem(STATE_KEY, JSON.stringify({ ...loadSaved(), ...patch })); } catch (e) { /* 略過 */ }
    };

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

        // 從個人頁返回（返回連結帶 #player-ID）或按上一頁回到名鑑時，捲到剛才點開的選手卡片；
        // 並沿用同一個主辦彩蛋位置，分頁內容才不會因此錯開一格
        const saved = loadSaved();
        const navType = (performance.getEntriesByType('navigation')[0] || {}).type;
        const hashId = (location.hash.match(/^#player-(\d+)$/) || [])[1];
        const returnId = hashId !== undefined ? Number(hashId)
            : navType === 'back_forward' ? saved.lastId : undefined;
        const hostSlot = returnId !== undefined && typeof saved.hostSlot === 'number' ? saved.hostSlot : Math.random();
        save({ hostSlot, lastId: undefined });

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
            saveState();

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

        // 搜尋／篩選／排序／分頁狀態寫回網址（?q=&filter=&sort=&page=，預設值省略）與 sessionStorage，
        // 上一頁與個人頁的「返回選手名鑑」都能回到同樣的狀態
        function saveState() {
            const params = new URLSearchParams();
            if (state.query) params.set('q', state.query);
            if (state.filter !== 'all') params.set('filter', state.filter);
            if (state.sort !== 'entry') params.set('sort', state.sort);
            if (state.page > 1) params.set('page', state.page);
            const query = String(params) ? `?${params}` : '';
            if (location.search !== query || location.hash) {
                // Safari 短時間內呼叫太多次會丟錯，略過即可
                try { history.replaceState(history.state, '', location.pathname + query); } catch (e) { /* 略過 */ }
            }
            save({ search: query });
        }

        search.addEventListener('input', () => {
            state.query = search.value;
            state.page = 1;
            render();
        });

        const selectFilter = btn => {
            filterBtns.forEach(b => {
                b.classList.toggle('active', b === btn);
                b.setAttribute('aria-pressed', String(b === btn));
            });
            state.filter = btn.dataset.filter;
        };

        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                selectFilter(btn);
                state.page = 1;
                render();
            });
        });

        // 排序下拉選單：點按鈕開關，點外面或按 Esc 關閉
        const setSortMenu = open => {
            sortMenu.hidden = !open;
            sortToggle.setAttribute('aria-expanded', String(open));
        };

        const markSort = item => {
            sortItems.forEach(i => i.setAttribute('aria-checked', String(i === item)));
            sortCurrent.textContent = item.textContent;
        };

        sortToggle.addEventListener('click', () => {
            setSortMenu(sortMenu.hidden);
            if (!sortMenu.hidden) sortMenu.querySelector('[aria-checked="true"]').focus();
        });

        sortItems.forEach(item => {
            item.addEventListener('click', () => {
                markSort(item);
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

        // 記下點開的選手，按上一頁回來時捲回這張卡片
        grid.addEventListener('click', e => {
            const link = e.target.closest('.player-card-link');
            if (link) save({ lastId: Number(link.closest('.player-card').id.replace('player-', '')) });
        });

        // 從網址還原狀態；不認得的值維持預設，頁數超出範圍時 render() 會收到最後一頁
        const params = new URLSearchParams(location.search);
        const filterBtn = [...filterBtns].find(b => b.dataset.filter === params.get('filter'));
        const sortItem  = [...sortItems].find(i => i.dataset.sort === params.get('sort'));
        if (filterBtn) selectFilter(filterBtn);
        if (sortItem) {
            markSort(sortItem);
            state.sort = sortItem.dataset.sort;
        }
        state.query = search.value = params.get('q') || '';
        state.page = Math.max(1, parseInt(params.get('page'), 10) || 1);

        render();

        const returnCard = returnId !== undefined && document.getElementById(`player-${returnId}`);
        if (returnCard) {
            returnCard.scrollIntoView({ block: 'center', behavior: 'instant' });
            returnCard.querySelector('.player-card-link').focus({ preventScroll: true });
        }
    }

    // ── 選手個人頁（player.html?id=N）：網址的 id 對應 players.json 的 id ──
    const profileId = profile && new URLSearchParams(location.search).get('id');
    const validProfileId = /^\d+$/.test(profileId || '');
    const profileBack = profile && document.querySelector('.profile-back');

    if (profile) {
        // 返回名鑑：帶回名鑑最後的搜尋／篩選／排序／分頁（名鑑會再捲到這位選手的卡片）
        profileBack.href = t.directory + (loadSaved().search || '') + (validProfileId ? `#player-${profileId}` : '');
        // 切換語言時停留在同一位選手
        if (profileId) {
            document.querySelectorAll('.language-menu a').forEach(a => {
                a.href = `${a.getAttribute('href')}?id=${encodeURIComponent(profileId)}`;
            });
        }
    }

    // 找不到選手／載入失敗：訊息＋返回名鑑按鈕（取代上方的返回連結）
    function showProfileMessage(title, hint) {
        const box = el('div', 'profile-missing');
        box.append(el('p', 'profile-missing-title', title));
        if (hint) box.append(el('p', 'profile-missing-text', hint));
        const back = el('a', 'btn-goods', t.back);
        back.href = profileBack.href.replace(/#.*$/, '');
        box.append(back);
        profileBack.hidden = true;
        profile.replaceChildren(box);
        profile.removeAttribute('aria-busy');
    }

    function profileField(key, value, className) {
        const item = el('div', className ? `profile-field ${className}` : 'profile-field');
        const label = el('dt', 'profile-label');
        label.append(el('span', 'profile-label-main', t.fields[key]));
        if (!isEn) label.append(el('span', 'profile-label-en', FIELDS_EN[key]));
        const data = el('dd', 'profile-value');
        data.append(value);
        item.append(label, data);
        return item;
    }

    // 參賽項目名稱；主辦沒有參賽項目，改寫彩蛋留言（hostRoll）
    const eventNamesOf = player => (player.host ? [t.hostRoll]
        : EVENTS.filter(ev => player.events.includes(ev)).map(ev => t.eventNames[ev]));

    function initProfile(players) {
        const player = validProfileId && players.find(p => p.id === Number(profileId));
        if (!player) {
            showProfileMessage(t.notFound, t.notFoundHint);
            return;
        }

        const tier = rankTier(player.rank);
        // 主辦是翻面彩蛋（沿用資料卡樣式）；其他選手是參賽紀念卡，卡片下方加「下載 PNG」按鈕
        if (player.host) {
            profile.replaceChildren(createFlip(createHostCard(player, tier), tier));
        } else {
            const card = createMemorial(player, tier);
            profile.replaceChildren(card, createDownload(card, player.name));
            // 字型載入完成、卡片尺寸改變時重新調整字級
            new ResizeObserver(() => fitMemorial(card)).observe(card);
            document.fonts.ready.then(() => fitMemorial(card));
        }
        profile.removeAttribute('aria-busy');
        document.title = t.title(player.name);
    }

    // 主辦翻面彩蛋的正面：資料卡（.profile-card）
    function createHostCard(player, tier) {
        const card = el('article', 'profile-card');
        if (tier) card.dataset.tier = tier;

        const head = el('div', 'profile-head');
        // 名稱上方：主辦不編號，顯示「主辦」
        const no = el('p', 'profile-no');
        no.append(el('span', 'profile-no-num', t.host));
        head.append(no, el('h2', 'profile-name', player.name));
        // 自訂標籤（同名鑑卡片）
        if (player.tags && player.tags.length) {
            const tags = el('ul', 'profile-tags');
            player.tags.forEach(tag => tags.append(el('li', null, tag)));
            head.append(tags);
        }

        const eventNames = eventNamesOf(player);
        const events = eventNames.length ? el('ul', 'profile-events') : '—';
        eventNames.forEach(name => events.append(el('li', null, name)));

        const fields = el('dl', 'profile-fields');
        fields.append(
            profileField('rank', createRankText(player.rank), 'profile-field-rank'),
            profileField('control', t.controls[player.control] || '—'),
            profileField('events', events),
        );

        // 底部品牌列：Nolly 頭像＋網站 Logo 字樣
        const foot = el('div', 'profile-foot');
        const avatar = el('img', 'profile-foot-avatar');
        avatar.src = 'favicon.png';
        avatar.alt = '';
        avatar.width = avatar.height = 44;
        const logo = el('span', 'profile-foot-logo', 'NOLLY');
        logo.append(el('span', null, t.brand));
        foot.append(avatar, logo, el('span', 'profile-foot-en', 'NOLLY BIRTHDAY CUP 2026'));

        card.append(head, fields, foot);
        return card;
    }

    // 紀念卡的資料欄位（欄位名稱，中文／日文頁下方加英文小標）
    function memorialField(key, value, className) {
        const item = el('div', className ? `memorial-field ${className}` : 'memorial-field');
        const label = el('dt', 'memorial-label');
        label.append(el('span', 'memorial-label-main', t.fields[key]));
        if (!isEn) label.append(el('span', 'memorial-label-en', FIELDS_EN[key]));
        const data = el('dd', 'memorial-value');
        data.append(value);
        item.append(label, data);
        return item;
    }

    // 參賽紀念卡（版面同 teams.js）：SF6 直式背景模板完整鋪滿固定 4:5 的卡片，選手資訊疊在下方空白框（.memorial-info，位置見 CSS）
    function createMemorial(player, tier) {
        const card = el('article', 'player-memorial');
        if (tier) card.dataset.tier = tier;
        const bg = el('img', 'memorial-bg');
        bg.src = MEMORIAL_BG;
        bg.alt = '';
        bg.width = MEMORIAL_SIZE.width;
        bg.height = MEMORIAL_SIZE.height;

        // 選手編號（三位數）＋名稱＋自訂標籤
        const no = el('p', 'memorial-no');
        no.append(el('span', 'memorial-no-label', t.fields.no), el('span', 'memorial-no-num', String(player.id).padStart(3, '0')));
        const name = el('h2', 'memorial-name', player.name);
        name.dataset.fit = '';
        const head = el('div', 'memorial-head');
        head.append(no, name);
        if (player.tags && player.tags.length) {
            const tags = el('ul', 'memorial-tags');
            player.tags.forEach(tag => tags.append(el('li', null, tag)));
            head.append(tags);
        }

        const eventNames = eventNamesOf(player);
        const events = eventNames.length ? el('ul', 'memorial-events') : '—';
        eventNames.forEach(item => events.append(el('li', null, item)));

        const fields = el('dl', 'memorial-fields');
        fields.append(
            memorialField('rank', createRankText(player.rank), 'memorial-field-rank'),
            memorialField('control', t.controls[player.control] || '—'),
            memorialField('events', events),
        );

        const body = el('div', 'memorial-body');
        body.append(head, fields);
        const info = el('div', 'memorial-info');
        info.append(body);
        card.append(bg, info);
        return card;
    }

    // 文字超過 CSS 的行數上限（max-height＋overflow: hidden）時逐步縮小字級（--fit，最小 0.5 倍）；
    // 整塊資訊仍超出下方空白框時，再整體縮小（--scale，最小 0.7 倍）（同 teams.js）
    function fitMemorial(card) {
        const info = card.querySelector('.memorial-info');
        const body = card.querySelector('.memorial-body');
        const fitTexts = () => card.querySelectorAll('[data-fit]').forEach(node => {
            let fit = 1;
            node.style.setProperty('--fit', fit);
            while (node.scrollHeight > node.clientHeight + 1 && fit > 0.5) {
                fit = Math.round((fit - 0.05) * 100) / 100;
                node.style.setProperty('--fit', fit);
            }
        });

        let scale = 1;
        info.style.setProperty('--scale', scale);
        fitTexts();
        while (body.offsetHeight > info.clientHeight && scale > 0.7) {
            scale = Math.round((scale - 0.04) * 100) / 100;
            info.style.setProperty('--scale', scale);
            fitTexts();
        }
    }

    // ── 紀念卡下載成 PNG：html2canvas 截圖，輸出為背景模板的原始尺寸（1080×1350） ──
    let html2canvasLoading;
    const loadHtml2canvas = () => html2canvasLoading || (html2canvasLoading = new Promise((resolve, reject) => {
        const script = el('script');
        script.src = HTML2CANVAS_URL;
        script.onload = () => resolve(window.html2canvas);
        script.onerror = () => {
            html2canvasLoading = null; // 下次按下載時重新載入
            reject(new Error(`Failed to load ${HTML2CANVAS_URL}`));
        };
        document.head.append(script);
    }));

    // 在畫面外放一張模板原寬（1080px）的複本來截圖（.memorial-stage，同 teams.js）：字級與位置都以卡片寬度為單位，
    // 版面與畫面上的預覽等比例，輸出不受螢幕寬度、瀏覽器縮放與裝置像素比影響；只截卡片，不含按鈕等 UI
    async function captureCard(card) {
        const html2canvas = await loadHtml2canvas();
        await document.fonts.ready;

        const stage = el('div', 'memorial-stage');
        stage.setAttribute('aria-hidden', 'true');
        stage.style.width = `${MEMORIAL_SIZE.width}px`;
        const copy = card.cloneNode(true);
        stage.append(copy);
        document.body.append(stage);

        try {
            await copy.querySelector('.memorial-bg').decode();
            fitMemorial(copy);
            const canvas = await html2canvas(copy, {
                scale: 1,
                width: MEMORIAL_SIZE.width,
                height: MEMORIAL_SIZE.height,
                backgroundColor: null,
                logging: false,
            });
            return await new Promise((resolve, reject) => {
                canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('canvas.toBlob failed'))), 'image/png');
            });
        } finally {
            stage.remove();
        }
    }

    function saveFile(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = el('a');
        link.href = url;
        link.download = filename;
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
    }

    // 卡片下方的下載按鈕；檔名 NollyCup-SF6-選手名稱.png（去掉檔名不能用的字元）
    function createDownload(card, name) {
        const button = el('button', 'btn-goods', t.download);
        button.type = 'button';
        const status = el('p', 'profile-download-status');
        status.setAttribute('role', 'status');

        button.addEventListener('click', async () => {
            button.disabled = true;
            button.textContent = t.downloading;
            status.textContent = '';
            try {
                const blob = await captureCard(card);
                saveFile(blob, `NollyCup-SF6-${name.replace(/[\\/:*?"<>|]+/g, '_').trim()}.png`);
            } catch (err) {
                console.error('Failed to create profile image', err);
                status.textContent = t.downloadError;
            } finally {
                button.disabled = false;
                button.textContent = t.download;
            }
        });

        // 按鈕下方加使用說明（僅供個人收藏及非商業分享）
        const actions = el('div', 'profile-actions');
        actions.append(button, status, el('p', 'profile-download-note', t.downloadNote));
        return actions;
    }

    // 主辦（Nolly）個人頁彩蛋：點卡片（或聚焦後按 Enter／空白鍵）翻面，正面參賽項目寫著留言 hostRoll，
    // 依序翻成 正面 → hostMsg → hostBack → hostView → hostLink＋連到 HOST_LINK 的 DOWNLOAD 按鈕 → 回到正面…（文字見 I18N，\n 為換行）
    function createFlip(card, tier) {
        const message = (text, ...extra) => {
            const node = el('div', 'profile-card profile-card-reverse');
            if (tier) node.dataset.tier = tier;
            node.append(el('p', 'profile-reverse-text', text), ...extra);
            return node;
        };
        const link = el('a', 'btn-goods', 'DOWNLOAD');
        link.href = HOST_LINK;
        link.target = '_blank';
        link.rel = 'noopener';
        const faces = [card, message(t.hostMsg), message(t.hostBack), message(t.hostView), message(t.hostLink, link)];

        const inner = el('div', 'profile-flip-inner');
        inner.append(...faces);
        const flip = el('div', 'profile-flip');
        flip.tabIndex = 0;
        flip.append(inner);

        // 卡片只有正反兩側，每按一次多轉半圈：要出現的面先放到目前朝下、即將轉上來的那一側，
        // 轉動中只留新舊兩面，其餘隱藏（隱藏時仍佔位，卡片高度一律以正面資料卡為準）；
        // 只有朝上的面能被螢幕閱讀器讀到、按鈕能被 Tab 選到（inert）
        let step = 0;
        const show = () => {
            const current = step % faces.length;
            const previous = step ? (step - 1) % faces.length : current;
            faces.forEach((node, i) => {
                if (i === current) node.style.transform = step % 2 ? 'rotateY(180deg)' : '';
                node.classList.toggle('is-off', i !== current && i !== previous);
                node.setAttribute('aria-hidden', String(i !== current));
                node.inert = i !== current;
            });
            inner.style.transform = step ? `rotateY(${step * 180}deg)` : '';
        };
        const next = () => {
            step += 1;
            show();
        };
        show();
        // 點按鈕是開連結，不翻面
        flip.addEventListener('click', e => {
            if (!e.target.closest('a')) next();
        });
        flip.addEventListener('keydown', e => {
            if (e.target !== flip || (e.key !== 'Enter' && e.key !== ' ')) return;
            e.preventDefault();
            next();
        });
        return flip;
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
            if (profile) initProfile(players);
        })
        .catch(err => {
            console.error('Failed to load players.json', err);
            if (directory) showMessage(directory.querySelector('.player-grid'), t.error);
            if (profile) showProfileMessage(t.error);
        });
})();
