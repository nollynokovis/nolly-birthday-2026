// VALORANT 參賽隊伍介紹：完整隊伍頁 (#teamDirectory)、隊伍個人頁 (#teamProfile，team.html?id=N，參賽紀念卡)
// 與 schedule-valo 頁的人數統計 ([data-stat]) 共用 data/valorant-teams.json
// 隊伍頁卡片沿用 SF6 選手卡片（.player-card）的樣式，每隊為隊長＋隊員 4 人＋候補 1 人
(() => {
    const directory = document.getElementById('teamDirectory');
    const profile   = document.getElementById('teamProfile');
    if (!directory && !profile && !document.querySelector('[data-stat]')) return;

    const TEAMS_URL     = 'data/valorant-teams.json';
    // 隊伍頁狀態（網址參數字串、最後點開的隊伍）；隊伍個人頁的「返回」連結也讀這裡
    const STATE_KEY     = 'nolly-valo-directory';
    // 隊伍個人頁的參賽紀念卡背景模板（原始尺寸 1920×1080；左側人物插畫，右側空白區放隊伍資訊，見 CSS .team-memorial）
    const MEMORIAL_BG   = 'img/1x/參賽紀念卡.webp?v=20261020f';
    const MEMORIAL_SIZE = { width: 1920, height: 1080 };
    // 紀念卡存成 PNG 用的 html2canvas（MIT，1.4.1），第一次按下載時才載入（同 players.js）
    const HTML2CANVAS_URL = 'js/vendor/html2canvas.min.js';

    const I18N = {
        zh: {
            directory: 'teams.html',
            profile: 'team.html',
            captain: '隊長', member: '隊員', sub: '候補', tbd: '隊名未定',
            count: n => `共 ${n} 組隊伍`,
            empty: '找不到符合條件的隊伍',
            error: '隊伍資料載入失敗，請稍後再試',
            prev: '上一頁',
            next: '下一頁',
            page: n => `第 ${n} 頁`,
            fields: { no: '隊伍編號' },
            banMaps: 'BAN\nMAP',
            notFound: '找不到這支隊伍',
            notFoundHint: '連結可能有誤，請回到參賽隊伍介紹重新選擇。',
            back: '← 返回參賽隊伍介紹',
            download: '下載參賽紀念卡',
            downloadNote: '※本紀念卡僅供個人收藏及非商業分享使用，請勿擅自修改或用於商業用途。',
            downloading: '圖片產生中…',
            downloadError: '圖片產生失敗，請再試一次',
            title: name => `${name}｜VALORANT 隊伍介紹｜Nolly生日盃`,
        },
        ja: {
            directory: 'teams-ja.html',
            profile: 'team-ja.html',
            captain: 'キャプテン', member: 'メンバー', sub: '控え', tbd: 'チーム名未定',
            count: n => `全 ${n} チーム`,
            empty: '該当するチームが見つかりません',
            error: 'チームデータの読み込みに失敗しました。しばらくしてから再度お試しください',
            prev: '前のページ',
            next: '次のページ',
            page: n => `${n} ページ目`,
            fields: { no: 'チーム番号' },
            banMaps: 'BAN\nマップ',
            notFound: 'このチームは見つかりませんでした',
            notFoundHint: 'リンクが正しくない可能性があります。出場チーム紹介からもう一度お選びください。',
            back: '← 出場チーム紹介へ戻る',
            download: '参加記念カードをダウンロード',
            downloadNote: '※本記念カードは個人での保存および非営利目的での共有に限りご利用いただけます。無断での改変や商用利用はご遠慮ください。',
            downloading: '画像を作成中…',
            downloadError: '画像の作成に失敗しました。もう一度お試しください',
            title: name => `${name}｜VALORANT チームプロフィール｜Nolly生日杯`,
        },
        en: {
            directory: 'teams-en.html',
            profile: 'team-en.html',
            captain: 'CAPTAIN', member: 'MEMBER', sub: 'SUB', tbd: 'TEAM NAME TBD',
            count: n => `${n} ${n === 1 ? 'team' : 'teams'}`,
            empty: 'No teams found.',
            error: 'Failed to load team data. Please try again later.',
            prev: 'Previous page',
            next: 'Next page',
            page: n => `Page ${n}`,
            fields: { no: 'Team No.' },
            banMaps: 'BAN\nMAPS',
            notFound: 'Team not found',
            notFoundHint: 'The link may be incorrect. Please choose a team from the team list.',
            back: '← BACK TO TEAM LIST',
            download: 'DOWNLOAD MEMORIAL CARD',
            downloadNote: '※ This memorial card is for personal collection and non-commercial sharing only. Please do not modify it or use it for commercial purposes.',
            downloading: 'CREATING IMAGE…',
            downloadError: 'Failed to create the image. Please try again.',
            title: name => `${name} | VALORANT Team Profile | Nolly CUP`,
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

        // 整張卡片可點：隊名是連往隊伍頁的連結，其 ::after 蓋滿卡片（見 CSS .player-card-link）
        // 連結與錨點都用隊伍編號（報名順序），不受搜尋／排序後的位置影響
        card.id = `team-${team.id}`;
        const link = el('a', 'player-card-link', team.name || t.tbd);
        link.href = `${t.profile}?id=${team.id}`;
        const name = el('h3', team.name ? 'player-name' : 'player-name is-tbd');
        name.append(link);

        card.append(name, el('p', 'team-intro', team.intro || ''), roster);
        return card;
    }

    const showMessage = (grid, text) => grid.replaceChildren(el('p', 'player-empty', text));

    // sessionStorage 在部分隱私模式下會丟錯，此時就不保留隊伍頁狀態
    const loadSaved = () => {
        try { return JSON.parse(sessionStorage.getItem(STATE_KEY)) || {}; } catch (e) { return {}; }
    };
    const save = patch => {
        try { sessionStorage.setItem(STATE_KEY, JSON.stringify({ ...loadSaved(), ...patch })); } catch (e) { /* 略過 */ }
    };

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

        // 從隊伍頁返回（返回連結帶 #team-ID）或按上一頁回來時，捲到剛才點開的隊伍卡片
        const saved = loadSaved();
        const navType = (performance.getEntriesByType('navigation')[0] || {}).type;
        const hashId = (location.hash.match(/^#team-(\d+)$/) || [])[1];
        const returnId = hashId !== undefined ? Number(hashId)
            : navType === 'back_forward' ? saved.lastId : undefined;
        save({ lastId: undefined });

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
            saveState();

            result.textContent = t.count(list.length);
            if (list.length === 0) {
                showMessage(grid, t.empty);
            } else {
                const start = (state.page - 1) * size;
                grid.replaceChildren(...list.slice(start, start + size).map(createCard));
            }
            renderPagination(list.length === 0 ? 0 : totalPages);
        }

        // 搜尋／排序／分頁狀態寫回網址（?q=&sort=&page=，預設值省略）與 sessionStorage，
        // 上一頁與隊伍頁的「返回」連結都能回到同樣的狀態
        function saveState() {
            const params = new URLSearchParams();
            if (state.query) params.set('q', state.query);
            if (state.sort !== 'entry') params.set('sort', state.sort);
            if (state.page > 1) params.set('page', state.page);
            const query = String(params) ? `?${params}` : '';
            if (location.search !== query || location.hash) {
                // Safari 短時間內呼叫太多次會丟錯，略過即可
                try { history.replaceState(history.state, '', location.pathname + query); } catch (e) { /* 略過 */ }
            }
            save({ search: query });
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

        // 記下點開的隊伍，按上一頁回來時捲回這張卡片
        grid.addEventListener('click', e => {
            const link = e.target.closest('.player-card-link');
            if (link) save({ lastId: Number(link.closest('.team-card').id.replace('team-', '')) });
        });

        // 從網址還原狀態；不認得的值維持預設，頁數超出範圍時 render() 會收到最後一頁
        const params = new URLSearchParams(location.search);
        const sortItem = [...sortItems].find(i => i.dataset.sort === params.get('sort'));
        if (sortItem) {
            markSort(sortItem);
            state.sort = sortItem.dataset.sort;
        }
        state.query = search.value = params.get('q') || '';
        state.page = Math.max(1, parseInt(params.get('page'), 10) || 1);

        render();

        const returnCard = returnId !== undefined && document.getElementById(`team-${returnId}`);
        if (returnCard) {
            returnCard.scrollIntoView({ block: 'center', behavior: 'instant' });
            returnCard.querySelector('.player-card-link').focus({ preventScroll: true });
        }
    }

    // ── 隊伍個人頁（team.html?id=N）：網址的 id＝隊伍編號（valorant-teams.json 內的報名順序，從 1 起算） ──
    const profileId = profile && new URLSearchParams(location.search).get('id');
    const validProfileId = /^\d+$/.test(profileId || '');
    const profileBack = profile && document.querySelector('.profile-back');

    if (profile) {
        // 返回隊伍頁：帶回最後的搜尋／排序／分頁（隊伍頁會再捲到這隊的卡片）
        profileBack.href = t.directory + (loadSaved().search || '') + (validProfileId ? `#team-${profileId}` : '');
        // 切換語言時停留在同一隊
        if (profileId) {
            document.querySelectorAll('.language-menu a').forEach(a => {
                a.href = `${a.getAttribute('href')}?id=${encodeURIComponent(profileId)}`;
            });
        }
    }

    // 找不到隊伍／載入失敗：訊息＋返回隊伍頁按鈕（取代上方的返回連結）
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

    // 紀念卡的成員格：身分（隊長／隊員／候補）、名稱、牌位；空的欄位顯示「—」
    function createMemorialMember(player, role) {
        const item = el('li', `memorial-member is-${role}`);
        const rank = (player && player.rank) || '';
        const tier = rankTier(rank);
        if (tier) item.dataset.tier = tier;
        if (!player) item.classList.add('is-empty');

        const name = el('span', 'memorial-member-name', (player && player.name) || '—');
        name.dataset.fit = '';
        item.append(el('span', 'memorial-role', t[role]), name, el('span', 'memorial-member-rank', rank || '—'));
        return item;
    }

    // 日文頁的地圖名稱（VALORANT 日文版官方譯名），以 CSV 的英文名稱查表；查不到時沿用英文
    const MAP_JA = {
        ABYSS: 'アビス', ASCENT: 'アセント', BIND: 'バインド', BREEZE: 'ブリーズ',
        CORRODE: 'カロード', FRACTURE: 'フラクチャー', HAVEN: 'ヘイヴン', ICEBOX: 'アイスボックス',
        LOTUS: 'ロータス', PEARL: 'パール', SPLIT: 'スプリット', SUMMIT: 'サミット', SUNSET: 'サンセット'
    };

    // 紀念卡底部的 Ban Map（valorant-teams.json 的 banMaps，來自 CSV 的 Ban Map 1／2）：
    // 欄位名稱分成兩行（文字內的 \n），不加英文小標；地圖為英文名稱（日文頁改為日文名稱），中文頁下方再加中文名稱。還沒有資料時顯示「—」
    function createBanMaps(maps) {
        const section = el('div', 'memorial-bans');
        const label = el('p', 'memorial-label');
        label.append(el('span', 'memorial-label-main', t.banMaps));

        const list = el('ul', 'memorial-maps');
        (maps && maps.length ? maps : [null]).forEach(map => {
            const item = el('li', map ? 'memorial-map' : 'memorial-map is-empty');
            const mapName = map ? (lang.startsWith('ja') && MAP_JA[map.en.toUpperCase()]) || map.en : '—';
            item.append(el('span', 'memorial-map-en', mapName));
            if (map && map.zh && lang.startsWith('zh')) item.append(el('span', 'memorial-map-zh', map.zh));
            list.append(item);
        });

        section.append(label, list);
        return section;
    }

    // 文字超過 CSS 的行數上限（max-height＋overflow: hidden）時逐步縮小字級（--fit，最小 0.5 倍）；
    // 整塊資訊仍超出右側空白區時，再整體縮小（--scale，最小 0.7 倍）
    // 字級都以卡片寬度為單位，縮放比例在預覽與 1920px 截圖時相同，兩邊各自計算一次即可
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

    // 參賽紀念卡：背景模板完整鋪滿固定 16:9 的卡片，隊伍資訊疊在右側空白區（.memorial-info，位置見 CSS）
    function initProfile(teams) {
        const team = validProfileId && teams.find(tm => tm.id === Number(profileId));
        if (!team) {
            showProfileMessage(t.notFound, t.notFoundHint);
            return;
        }

        const card = el('article', 'team-memorial');
        const bg = el('img', 'memorial-bg');
        bg.src = MEMORIAL_BG;
        bg.alt = '';
        bg.width = MEMORIAL_SIZE.width;
        bg.height = MEMORIAL_SIZE.height;

        // 隊伍編號（兩位數）＋隊名（＋隊伍介紹）
        const no = el('p', 'memorial-no');
        no.append(el('span', 'memorial-no-label', t.fields.no), el('span', 'memorial-no-num', String(team.id).padStart(2, '0')));
        const name = el('h2', team.name ? 'memorial-name' : 'memorial-name is-tbd', team.name || t.tbd);
        name.dataset.fit = '';
        const head = el('div', 'memorial-head');
        head.append(no, name);
        if (team.intro) {
            const intro = el('p', 'memorial-intro', team.intro);
            intro.dataset.fit = '';
            head.append(intro);
        }

        const members = el('ol', 'memorial-members');
        team.members.forEach((player, i) => members.append(createMemorialMember(player, i === 0 ? 'captain' : 'member')));
        // 候補放在正式隊員後面（三欄剛好兩排）；沒有候補時顯示「—」
        members.append(createMemorialMember(team.sub, 'sub'));

        const body = el('div', 'memorial-body');
        body.append(head, members, createBanMaps(team.banMaps));

        const info = el('div', 'memorial-info');
        info.append(body);
        card.append(bg, info);

        // 卡片下方加「下載 PNG」按鈕；隊名未定時檔名用隊伍編號
        profile.replaceChildren(card, createDownload(card, team.name || `Team-${String(team.id).padStart(2, '0')}`));
        profile.removeAttribute('aria-busy');
        document.title = t.title(team.name || t.tbd);

        // 字型載入完成、卡片尺寸改變時重新調整字級
        new ResizeObserver(() => fitMemorial(card)).observe(card);
        document.fonts.ready.then(() => fitMemorial(card));
    }

    // ── 紀念卡下載成 PNG：html2canvas 截圖，輸出為背景模板的原始尺寸（1920×1080） ──
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

    // 在畫面外放一張寬 1920px 的複本來截圖（.memorial-stage）：字級與位置都以卡片寬度為單位，
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

    // 卡片下方的下載按鈕；檔名 NollyCup-VALORANT-隊名.png（去掉檔名不能用的字元）
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
                saveFile(blob, `NollyCup-VALORANT-${name.replace(/[\\/:*?"<>|]+/g, '_').trim()}.png`);
            } catch (err) {
                console.error('Failed to create team image', err);
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

    fetch(TEAMS_URL, { cache: 'no-cache' })
        .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        })
        .then(data => {
            // order＝報名順序（JSON 內的順序）；id＝隊伍編號（order＋1，個人頁網址與卡片錨點用）
            // players＝隊員＋候補（略過空的欄位）
            // hue＝書籤色相，第一隊紅（0）到最後一隊紫（280）平均分配，搜尋或排序後顏色仍跟著隊伍
            const last = Math.max(data.teams.length - 1, 1);
            const teams = data.teams.map((team, order) => {
                const players = [...team.members, team.sub].filter(Boolean);
                return {
                    ...team,
                    name: team.name || '',
                    order,
                    id: order + 1,
                    hue: Math.round(order / last * 280),
                    players,
                    searchKey: normalize([team.name || '', ...players.map(p => p.name)].join('\n')),
                };
            });
            renderStats(teams, data.summary);
            if (directory) initDirectory(teams);
            if (profile) initProfile(teams);
        })
        .catch(err => {
            console.error('Failed to load valorant-teams.json', err);
            if (directory) showMessage(directory.querySelector('.player-grid'), t.error);
            if (profile) showProfileMessage(t.error);
        });
})();
