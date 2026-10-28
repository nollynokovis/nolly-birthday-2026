// SF6 團體賽隊伍介紹：完整隊伍頁 (#sf6TeamDirectory)、隊伍個人頁 (#sf6TeamProfile，sf6-team.html?id=N)
// 與 schedule-sf6 頁的隊伍統計 ([data-sf6-stat]；不用 [data-stat]，那是 players.js 的選手人數)
// 隊伍與分組來自 data/brackets.json 的 sf6Team（抽籤結果，隊伍編號 1–N、每隊 3 人），牌位／操作模式由隊員名稱對到 data/players.json
// 卡片沿用 VALORANT 隊伍卡片（.player-card.team-card）的樣式；隊伍個人頁沿用 SF6 選手個人頁的直式紀念卡模板（可下載 PNG）
(() => {
    const directory = document.getElementById('sf6TeamDirectory');
    const profile   = document.getElementById('sf6TeamProfile');
    if (!directory && !profile && !document.querySelector('[data-sf6-stat]')) return;

    const BRACKETS_URL = 'data/brackets.json';
    const PLAYERS_URL  = 'data/players.json';
    // 隊伍頁狀態（網址參數字串、最後點開的隊伍）；隊伍個人頁的「返回」連結也讀這裡
    const STATE_KEY    = 'nolly-sf6-team-directory';
    // 紀念卡欄位的英文小標（中文／日文頁顯示在欄位名稱下方；同 players.js）
    const FIELDS_EN    = { event: 'EVENTS' };
    // 紀念卡背景：同 players.js 的 SF6 選手紀念卡（1080×1350 直式）
    const MEMORIAL_BG   = 'img/1x/參賽者紀念卡sf6.webp?v=20261020f';
    const MEMORIAL_SIZE = { width: 1080, height: 1350 };
    // 紀念卡存成 PNG 用的 html2canvas（MIT，1.4.1），第一次按下載時才載入（同 players.js）
    const HTML2CANVAS_URL = 'js/vendor/html2canvas.min.js';

    const I18N = {
        zh: {
            directory: 'sf6-teams.html',
            profile: 'sf6-team.html',
            playerProfile: 'player.html',
            controls: { MODERN: '現代', CLASSIC: '經典' },
            count: n => `共 ${n} 支隊伍`,
            empty: '找不到符合條件的隊伍',
            error: '隊伍資料載入失敗，請稍後再試',
            prev: '上一頁',
            next: '下一頁',
            page: n => `第 ${n} 頁`,
            fields: { event: '參賽項目' },
            event: 'STREET FIGHTER 6 團體賽',
            download: '下載參賽紀念卡',
            downloadNote: '※本紀念卡僅供個人收藏及非商業分享使用，請勿擅自修改或用於商業用途。',
            downloading: '圖片產生中…',
            downloadError: '圖片產生失敗，請再試一次',
            notFound: '找不到這支隊伍',
            notFoundHint: '連結可能有誤，請回到團體賽隊伍介紹重新選擇。',
            schedule: 'schedule-sf6.html',
            backSchedule: '← 返回賽程表',
            title: name => `${name}｜STREET FIGHTER 6 團體賽隊伍介紹｜Nolly生日盃`,
        },
        ja: {
            directory: 'sf6-teams-ja.html',
            profile: 'sf6-team-ja.html',
            playerProfile: 'player-ja.html',
            controls: { MODERN: 'モダン', CLASSIC: 'クラシック' },
            count: n => `全 ${n} チーム`,
            empty: '該当するチームが見つかりません',
            error: 'チームデータの読み込みに失敗しました。しばらくしてから再度お試しください',
            prev: '前のページ',
            next: '次のページ',
            page: n => `${n} ページ目`,
            fields: { event: '出場部門' },
            event: 'STREET FIGHTER 6 チーム戦',
            download: '参加記念カードをダウンロード',
            downloadNote: '※本記念カードは個人での保存および非営利目的での共有に限りご利用いただけます。無断での改変や商用利用はご遠慮ください。',
            downloading: '画像を作成中…',
            downloadError: '画像の作成に失敗しました。もう一度お試しください',
            notFound: 'このチームは見つかりませんでした',
            notFoundHint: 'リンクが正しくない可能性があります。チーム戦出場チーム紹介からもう一度お選びください。',
            schedule: 'schedule-sf6-ja.html',
            backSchedule: '← 日程へ戻る',
            title: name => `${name}｜STREET FIGHTER 6 チーム戦チームプロフィール｜Nolly生日杯`,
        },
        en: {
            directory: 'sf6-teams-en.html',
            profile: 'sf6-team-en.html',
            playerProfile: 'player-en.html',
            controls: { MODERN: 'Modern', CLASSIC: 'Classic' },
            count: n => `${n} ${n === 1 ? 'team' : 'teams'}`,
            empty: 'No teams found.',
            error: 'Failed to load team data. Please try again later.',
            prev: 'Previous page',
            next: 'Next page',
            page: n => `Page ${n}`,
            fields: { event: 'Events' },
            event: 'STREET FIGHTER 6 TEAM',
            download: 'DOWNLOAD MEMORIAL CARD',
            downloadNote: '※ This memorial card is for personal collection and non-commercial sharing only. Please do not modify it or use it for commercial purposes.',
            downloading: 'CREATING IMAGE…',
            downloadError: 'Failed to create the image. Please try again.',
            notFound: 'Team not found',
            notFoundHint: 'The link may be incorrect. Please choose a team from the team list.',
            schedule: 'schedule-sf6-en.html',
            backSchedule: '← BACK TO SCHEDULE',
            title: name => `${name} | STREET FIGHTER 6 Team Profile | Nolly CUP`,
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

    // 隊名＝「TEAM」＋隊伍編號（兩位數），例如「TEAM 01」；隨機組隊不另取隊名，三語系都用英文
    const teamNo = team => String(team.no).padStart(2, '0');
    const teamName = team => `TEAM ${teamNo(team)}`;

    // SF6 牌位 → 顏色分級（同 players.js；對應 CSS 的 .team-member[data-sf6-tier]，不用 data-tier 以免套到 VALORANT 牌位色）
    const TIERS = ['legend', 'ultimate master', 'grand master', 'high master', 'master',
        'diamond', 'platinum', 'gold', 'silver', 'bronze', 'iron', 'rookie'];
    const rankTier = rank => {
        const tier = TIERS.find(name => rank.toLowerCase().includes(name));
        return tier && tier.replace(' ', '-');
    };

    // 全形／半形、大小寫視為相同
    const normalize = str => str.normalize('NFKC').toLowerCase().trim();

    // 隊員一列：名稱（＋操作模式標籤）在左，牌位靠右；players.json 對不到的隊員只顯示名稱
    function createMember(member) {
        const item = el('li', 'team-member');
        const tier = rankTier(member.rank);
        if (tier) item.dataset.sf6Tier = tier;

        const name = el('span', 'team-member-name', member.name);
        const control = t.controls[member.control];
        if (control) name.append(el('span', 'team-role', control));

        item.append(name, el('span', 'team-member-rank', member.rank || '—'));
        return item;
    }

    function createRoster(team, className) {
        const roster = el('ol', className);
        team.members.forEach(member => roster.append(createMember(member)));
        return roster;
    }

    function createCard(team, index) {
        const card = el('article', 'player-card team-card');
        card.style.setProperty('--i', index);
        card.dataset.sf6Group = team.group;

        // 整張卡片可點：隊名是連往隊伍頁的連結，其 ::after 蓋滿卡片（見 CSS .player-card-link）
        // 連結與錨點都用隊伍編號，不受搜尋／篩選後的位置影響
        card.id = `team-${team.no}`;
        const link = el('a', 'player-card-link', teamName(team));
        link.href = `${t.profile}?id=${team.no}`;
        const name = el('h3', 'player-name');
        name.append(link);

        // 不標組別（書籤顏色已依組別區分）
        card.append(name, createRoster(team, 'team-roster'));
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

    // 隊伍數／團體賽人數（隊伍中的隊員）
    function renderStats(teams) {
        const stats = { teams: teams.length, players: teams.reduce((sum, team) => sum + team.members.length, 0) };
        document.querySelectorAll('[data-sf6-stat]').forEach(node => {
            node.textContent = stats[node.dataset.sf6Stat];
        });
    }

    function initDirectory(teams) {
        const grid       = directory.querySelector('.player-grid');
        const search     = directory.querySelector('#sf6TeamSearch');
        const filterBtns = directory.querySelectorAll('.filter-btn');
        const result     = directory.querySelector('.player-result');
        const pagination = directory.querySelector('.pagination');
        const controls   = directory.querySelector('.player-controls');

        const state = { query: '', group: 'all', page: 1 };

        // 從隊伍頁返回（返回連結帶 #team-N）或按上一頁回來時，捲到剛才點開的隊伍卡片
        const saved = loadSaved();
        const navType = (performance.getEntriesByType('navigation')[0] || {}).type;
        const hashId = (location.hash.match(/^#team-(\d+)$/) || [])[1];
        const returnId = hashId !== undefined ? Number(hashId)
            : navType === 'back_forward' ? saved.lastId : undefined;
        save({ lastId: undefined });

        // 每頁隊數同 VALORANT 隊伍頁：電腦版 4 排 × 2＝8 隊，平板／手機 6 排 × 1＝6 隊（斷點同 CSS 的 .team-grid）
        const oneColumn = window.matchMedia('(max-width: 1024px)');
        const perPage = () => (oneColumn.matches ? 6 : 8);
        let shownPerPage = perPage();

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

        // 搜尋隊員名稱；只輸入數字時也比對隊伍編號（「1」「01」都會找到 TEAM 01）
        const matches = (team, query) => !query || team.searchKey.includes(query)
            || (/^\d+$/.test(query) && Number(query) === team.no);

        function render() {
            const query = normalize(state.query);
            const list = teams.filter(team => (state.group === 'all' || team.group === state.group) && matches(team, query));
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

        // 搜尋／組別／分頁狀態寫回網址（?q=&group=&page=，預設值省略）與 sessionStorage，
        // 上一頁與隊伍頁的「返回」連結都能回到同樣的狀態
        function saveState() {
            const params = new URLSearchParams();
            if (state.query) params.set('q', state.query);
            if (state.group !== 'all') params.set('group', state.group);
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

        const selectFilter = btn => {
            filterBtns.forEach(b => {
                b.classList.toggle('active', b === btn);
                b.setAttribute('aria-pressed', String(b === btn));
            });
            state.group = btn.dataset.filter;
        };

        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                selectFilter(btn);
                state.page = 1;
                render();
            });
        });

        // 記下點開的隊伍，按上一頁回來時捲回這張卡片
        grid.addEventListener('click', e => {
            const link = e.target.closest('.player-card-link');
            if (link) save({ lastId: Number(link.closest('.team-card').id.replace('team-', '')) });
        });

        // 從網址還原狀態；不認得的值維持預設，頁數超出範圍時 render() 會收到最後一頁
        const params = new URLSearchParams(location.search);
        const filterBtn = [...filterBtns].find(b => b.dataset.filter === params.get('group'));
        if (filterBtn) selectFilter(filterBtn);
        state.query = search.value = params.get('q') || '';
        state.page = Math.max(1, parseInt(params.get('page'), 10) || 1);

        render();

        const returnCard = returnId !== undefined && document.getElementById(`team-${returnId}`);
        if (returnCard) {
            returnCard.scrollIntoView({ block: 'center', behavior: 'instant' });
            returnCard.querySelector('.player-card-link').focus({ preventScroll: true });
        }
    }

    // ── 隊伍個人頁（sf6-team.html?id=N）：網址的 id＝隊伍編號（brackets.json sf6Team 的 no） ──
    const profileId = profile && new URLSearchParams(location.search).get('id');
    const validProfileId = /^\d+$/.test(profileId || '');
    const profileBack = profile && document.querySelector('.profile-back');
    // 從賽程圖點進來時帶 from=<賽程>-<組>-<格>（見 bracket.js），返回連結改回賽程頁的那一格；
    // 再點進隊員的選手頁時 from 會一路帶著，選手頁返回這裡後，這裡的返回仍是賽程頁（同 teams.js）
    const fromSchedule = profile && new URLSearchParams(location.search).get('from');
    const validFromSchedule = /^\w+-\w+-\d+$/.test(fromSchedule || '');
    const fromQuery = validFromSchedule ? `&from=${fromSchedule}` : '';

    if (profile) {
        if (validFromSchedule) {
            profileBack.href = `${t.schedule}#bracket-${fromSchedule}`;
            profileBack.textContent = t.backSchedule;
        } else {
            // 返回隊伍頁：帶回最後的搜尋／組別／分頁（隊伍頁會再捲到這隊的卡片）
            profileBack.href = t.directory + (loadSaved().search || '') + (validProfileId ? `#team-${profileId}` : '');
        }
        // 切換語言時停留在同一隊
        if (profileId) {
            document.querySelectorAll('.language-menu a').forEach(a => {
                a.href = `${a.getAttribute('href')}?id=${encodeURIComponent(profileId)}${fromQuery}`;
            });
        }
    }

    // 找不到隊伍／載入失敗：訊息＋返回按鈕（文字與連結同上方的返回連結，並取代它）
    function showProfileMessage(title, hint) {
        const box = el('div', 'profile-missing');
        box.append(el('p', 'profile-missing-title', title));
        if (hint) box.append(el('p', 'profile-missing-text', hint));
        const back = el('a', 'btn-goods', profileBack.textContent);
        back.href = profileBack.href.replace(/#team-.*$/, '');
        box.append(back);
        profileBack.hidden = true;
        profile.replaceChildren(box);
        profile.removeAttribute('aria-busy');
    }

    // 紀念卡的資料欄位（欄位名稱，中文／日文頁下方加英文小標；同 players.js）
    function memorialField(key, value) {
        const item = el('div', `memorial-field memorial-field-${key}`);
        const label = el('dt', 'memorial-label');
        label.append(el('span', 'memorial-label-main', t.fields[key]));
        if (!isEn) label.append(el('span', 'memorial-label-en', FIELDS_EN[key]));
        const data = el('dd', 'memorial-value');
        data.append(value);
        item.append(label, data);
        return item;
    }

    // 紀念卡的隊員格（同 teams.js 的 .memorial-member）：操作模式標籤、名稱、牌位；牌位色用 data-sf6-tier
    // 名稱直接連到該隊員的 SF6 選手個人頁（取代卡片上方的隊員按鈕），帶 team=<隊伍編號> 讓選手頁的返回連結回到這支隊伍；
    // 對不到選手資料的隊員只顯示文字
    function createMemorialMember(member, team) {
        const item = el('li', 'memorial-member');
        const tier = rankTier(member.rank);
        if (tier) item.dataset.sf6Tier = tier;

        const name = el(member.id ? 'a' : 'span', 'memorial-member-name', member.name);
        if (member.id) {
            name.classList.add('memorial-member-link');
            name.href = `${t.playerProfile}?id=${member.id}&team=${team.no}${fromQuery}`;
        }
        name.dataset.fit = '';
        const control = t.controls[member.control];
        if (control) item.append(el('span', 'memorial-role', control));
        item.append(name, el('span', 'memorial-member-rank', member.rank || '—'));
        return item;
    }

    // 文字超過 CSS 的行數上限時逐步縮小字級（--fit，最小 0.5 倍）；
    // 整塊資訊仍超出下方空白框時，再整體縮小（--scale，最小 0.7 倍）（同 players.js／teams.js）
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

    // 參賽紀念卡（同 SF6 選手個人頁的 .player-memorial）：背景模板鋪滿 4:5 卡片，隊伍資訊疊在下方空白框
    // 框內為「TEAM NO.」＋大號隊伍編號（01）、三名隊員，細線下方是參賽項目；不標組別、不放比賽日期；卡片下方加「下載 PNG」按鈕
    function initProfile(teams) {
        const team = validProfileId && teams.find(tm => tm.no === Number(profileId));
        if (!team) {
            showProfileMessage(t.notFound, t.notFoundHint);
            return;
        }

        const card = el('article', 'player-memorial sf6-team-memorial');
        const bg = el('img', 'memorial-bg');
        bg.src = MEMORIAL_BG;
        bg.alt = '';
        bg.width = MEMORIAL_SIZE.width;
        bg.height = MEMORIAL_SIZE.height;

        // 隊伍編號：小字標籤「TEAM NO.」（三語系相同）＋大號兩位數字，數字前不再寫 TEAM
        const no = el('p', 'memorial-no');
        no.append(el('span', 'memorial-no-label', 'TEAM NO.'));
        const name = el('h2', 'memorial-name', teamNo(team));
        name.setAttribute('aria-label', teamName(team));
        const head = el('div', 'memorial-head');
        head.append(no, name);

        const members = el('ol', 'memorial-members');
        team.members.forEach(member => members.append(createMemorialMember(member, team)));

        // 參賽項目：欄位名稱在左，「STREET FIGHTER 6 團體賽」寫在右側（見 CSS .sf6-team-memorial .memorial-field-event）
        const fields = el('dl', 'memorial-fields');
        fields.append(memorialField('event', t.event));

        const body = el('div', 'memorial-body');
        body.append(head, members, fields);
        const info = el('div', 'memorial-info');
        info.append(body);
        card.append(bg, info);

        profile.replaceChildren(card, createDownload(card, `Team-${teamNo(team)}`));
        profile.removeAttribute('aria-busy');
        document.title = t.title(teamName(team));

        // 字型載入完成、卡片尺寸改變時重新調整字級
        new ResizeObserver(() => fitMemorial(card)).observe(card);
        document.fonts.ready.then(() => fitMemorial(card));
    }

    // ── 紀念卡下載成 PNG：html2canvas 截圖，輸出為背景模板的原始尺寸（1080×1350）（同 players.js） ──
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

    // 在畫面外放一張模板原寬（1080px）的複本來截圖（.memorial-stage）：版面與畫面上的預覽等比例，
    // 輸出不受螢幕寬度、瀏覽器縮放與裝置像素比影響；只截卡片，不含按鈕等 UI
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

    // 卡片下方的下載按鈕＋使用說明；檔名 NollyCup-SF6-Team-01.png
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
                saveFile(blob, `NollyCup-SF6-${name}.png`);
            } catch (err) {
                console.error('Failed to create team memorial image', err);
                status.textContent = t.downloadError;
            } finally {
                button.disabled = false;
                button.textContent = t.download;
            }
        });

        const actions = el('div', 'profile-actions');
        actions.append(button, status, el('p', 'profile-download-note', t.downloadNote));
        return actions;
    }

    Promise.all([BRACKETS_URL, PLAYERS_URL].map(url => fetch(url, { cache: 'no-cache' }).then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
    })))
        .then(([brackets, playerData]) => {
            const byName = new Map(playerData.players.map(p => [p.name, p]));
            // 各組依賽程格子順序列出（null＝BYE），整理成依隊伍編號排列；書籤顏色依組別（CSS [data-sf6-group]）
            const teams = Object.entries(brackets.sf6Team || {})
                .flatMap(([group, slots]) => slots.filter(Boolean).map(entry => ({ ...entry, group })))
                .sort((a, b) => a.no - b.no);
            teams.forEach(team => {
                team.members = team.members.map(name => {
                    const player = byName.get(name);
                    return { name, id: player && player.id, rank: (player && player.rank) || '', control: player && player.control };
                });
                team.searchKey = normalize(team.members.map(m => m.name).join('\n'));
            });
            renderStats(teams);
            if (directory) initDirectory(teams);
            if (profile) initProfile(teams);
        })
        .catch(err => {
            console.error('Failed to load SF6 team data', err);
            if (directory) showMessage(directory.querySelector('.player-grid'), t.error);
            if (profile) showProfileMessage(t.error);
        });
})();
