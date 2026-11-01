// VALORANT 比賽時間表（schedule-valo*.html 的 .match-schedule）：讀 data/valorant-schedule.json，用比賽階段 Tab
// （32強／16強／8強／4強／決賽，對應 JSON 的 round）切換；Tab 下方顯示這個階段的比賽日期（跨日時顯示範圍，表格內再依日期分段）
// 各階段內依日期 → 開賽時間 → 比賽編號排序。桌面版是 <table>，手機版由 CSS 改排成直式資訊列（見 style.css 的 .match-table）
// 跟著賽程頁上方的搜尋欄（#bracketSearch，下拉結果與賽程圖標示仍由 bracket.js 負責）一起篩選：
// 隊名、選手名（透過 valorant-teams.json 找到所屬隊伍；不搜場次編號）；搜尋時各 Tab 顯示符合的場數，目前的階段沒有結果時自動切到第一個有結果的階段
// MATCH 編號點下去會切到上方對應的賽程圖並捲過去（組別由 brackets.json 的抽籤結果判斷，見 groupResolver）；
// 反過來，賽程圖上的對戰代號（bracket.js 畫的 A1、E1…）點下去會切到這裡那一場並短暫標示（見 showMatch）
// 比賽結果（score1／score2／winner）：確認勝方後顯示比分、下一場的「A1 勝者」自動換成勝隊（見 resultOf、sideResolver）
// 自動更新：定期重新讀一次 JSON（間隔見 js/live-source.js 的 POLL_MS；NollyLive.watch：分頁在背景時暫停，回到頁面立刻檢查），資料有變才更新畫面，不改目前的 Tab、搜尋與捲動位置
// 比賽狀態：MATCH 編號旁的小標記（灰點＝尚未開始、紅點＝進行中、灰勾＝已結束），見 statusOf
(() => {
    const root = document.querySelector('.match-schedule');
    if (!root) return;

    const SCHEDULE_URL = 'data/valorant-schedule.json';
    const TEAMS_URL    = 'data/valorant-teams.json';
    const BRACKETS_URL = 'data/brackets.json';
    const STAGES       = ['R32', 'R16', 'QF', 'SF', 'F'];    // Tab 由左到右；預設顯示第一個（32強）
    const PRELIM       = ['R32', 'R16'];    // 在預賽 A–D 組賽程圖上的階段；8強之後在決賽圖上（同 bracket.js 的 LAYOUTS／FINAL_LAYOUTS）

    // date：比賽日期（月、日、星期幾 0＝日）；rounds：比賽階段（JSON 的 round）；bracket：MATCH 編號連結的說明（組別或 Final）
    const I18N = {
        zh: {
            date: (m, d, w) => `${m}月${d}日(${'日一二三四五六'[w]})`,
            rounds: { R32: '32強', R16: '16強', QF: '8強', SF: '4強', F: '決賽' },
            final: '決賽',
            winner: id => `${id} 勝者`,
            status: { scheduled: '尚未開始', live: '進行中', completed: '已完成' },
            bracket: g => g === 'Final' ? '查看決賽賽程圖' : `查看${g}組賽程圖`,
            empty: '找不到符合的比賽',
            none: '這個階段的賽程尚未公布',
            test: '※ 測試資料：以下比賽時間僅供版面確認，並非正式時間。',
            error: '比賽時間表載入失敗，請稍後再試',
        },
        ja: {
            date: (m, d, w) => `${m}月${d}日(${'日月火水木金土'[w]})`,
            rounds: { R32: 'ベスト32', R16: 'ベスト16', QF: '準々決勝', SF: '準決勝', F: '決勝' },
            final: '決勝',
            winner: id => `${id} 勝者`,
            status: { scheduled: '開始前', live: '進行中', completed: '終了' },
            bracket: g => g === 'Final' ? '決勝の対戦表を見る' : `${g}組の対戦表を見る`,
            empty: '該当する試合が見つかりません',
            none: 'このラウンドの試合日程はまだ発表されていません',
            test: '※ テスト用データです。以下の時間はレイアウト確認用で、正式な試合時間ではありません。',
            error: '試合スケジュールの読み込みに失敗しました。しばらくしてから再度お試しください',
        },
        en: {
            date: (m, d, w) => `${['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][m - 1]}. ${String(d).padStart(2, '0')} ${['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][w]}`,
            rounds: { R32: 'Round of 32', R16: 'Round of 16', QF: 'Quarterfinals', SF: 'Semifinals', F: 'Final' },
            final: 'FINAL',
            winner: id => `Winner of ${id}`,
            status: { scheduled: 'Upcoming', live: 'Live', completed: 'Completed' },
            bracket: g => g === 'Final' ? 'View the finals bracket' : `View the Group ${g} bracket`,
            empty: 'No matching matches found',
            none: 'The schedule for this round has not been announced yet',
            test: '※ Test data: the times below are for layout checking only and are not the official schedule.',
            error: 'Failed to load the match schedule. Please try again later.',
        },
    };
    const lang = document.documentElement.lang;
    const t = I18N[lang.startsWith('ja') ? 'ja' : lang.startsWith('en') ? 'en' : 'zh'];

    const stagesBox = root.querySelector('.match-stages');
    const stageInfo = root.querySelector('.match-stage-info');
    const testNote  = root.querySelector('.match-test');
    const liveNote  = root.querySelector('.match-live');
    const tbody     = root.querySelector('.match-table tbody');
    const input     = document.getElementById('bracketSearch');    // 頁面上方的搜尋欄（賽程圖的下拉結果與標示由 bracket.js 負責）
    const filter    = root.querySelector('.match-search input');   // 時間表上方的搜尋欄：只篩選時間表
    // 篩選文字以時間表上方的搜尋欄為準；在頁面上方搜尋時文字會同步帶過來（見 apply），兩邊顯示一致
    const queryText = () => normalize(filter ? filter.value : input ? input.value : '');

    const el = (tag, className, text) => {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    };

    // 資料有問題時給開發者看的提醒（console），同一句只出現一次，每次自動更新時不會一直重複
    const warned = new Set();
    const warn = msg => {
        if (warned.has(msg)) return;
        warned.add(msg);
        console.warn(`valorant-schedule.json：${msg}`);
    };

    // 全形／半形、大小寫視為相同（同 bracket.js）
    const normalize = str => str.normalize('NFKC').toLowerCase().trim();

    // 決賽的編號 FINAL 依語言顯示（決賽／決勝／FINAL），其他編號照原樣
    const labelOf = id => id === 'FINAL' ? t.final : id;

    // JSON 的日期（YYYY-MM-DD，台灣時間的日期）→ 顯示文字；只看年月日，不受瀏覽器時區影響
    const dateText = iso => {
        const [y, m, d] = iso.split('-').map(Number);
        return t.date(m, d, new Date(Date.UTC(y, m - 1, d)).getUTCDay());
    };

    // 表格欄數（MATCH｜TEAMS｜MAP｜CHECK-IN｜START），訊息列與日期列橫跨整列用
    const COLUMNS = 5;

    // tbody 換成這些列；和目前完全相同（同一批節點、同樣順序）就不動 DOM，自動更新沒有變化時畫面不會閃、焦點也不會跑掉
    const setRows = rows => {
        const now = [...tbody.children];
        if (rows.length === now.length && rows.every((row, i) => row === now[i])) return;
        tbody.replaceChildren(...rows);
    };

    // 訊息列（找不到、尚未公布、載入失敗）：同樣的訊息重複使用同一列
    const messageRows = new Map();
    const showMessage = (className, text) => {
        const key = `${className}|${text}`;
        if (!messageRows.has(key)) {
            const row = el('tr', className);
            const cell = el('td', '', text);
            cell.colSpan = COLUMNS;
            row.append(cell);
            messageRows.set(key, row);
        }
        setRows([messageRows.get(key)]);
    };

    let matches = [];    // { data, label, sides, result, status, keys, group, sig }（group：A–D／Final／null＝不加連結；sig：這一列顯示內容的摘要）
    let current = STAGES[0];
    let stageButtons = [];

    const isHit = (match, query) => match.keys.some(key => key.includes(query));

    // ── 比賽結果 ──────────────────────────────────────────────
    // 正式結果＝winner 是 "team1"／"team2"，而且比分兩邊都沒填（棄權等），或兩邊都是 0 以上的整數、勝方分數較高（延長賽不設上限）
    // 只有比分、沒有 winner＝還沒確認：照常顯示 VS、不判定勝負、不晉級
    // winner 與比分矛盾、只填一邊比分、值的格式不對：在 console 警告並當作還沒確認（不修改原始資料、不自行判斷）
    const isScore = value => Number.isInteger(value) && value >= 0;
    const resultOf = data => {
        const score1 = data.score1 == null ? null : data.score1;
        const score2 = data.score2 == null ? null : data.score2;
        const winner = data.winner == null ? null : data.winner;
        const bad = [['score1', score1], ['score2', score2]].filter(([, v]) => v !== null && !isScore(v)).map(([k, v]) => `${k}「${v}」`);
        if (bad.length) warn(`${data.matchId} 的 ${bad.join('、')} 不是 0 以上的整數`);
        if (winner === null) return null;
        if (winner !== 'team1' && winner !== 'team2') {
            warn(`${data.matchId} 的 winner「${winner}」只能是 "team1"、"team2" 或 null，這一場先不顯示結果`);
            return null;
        }
        if (bad.length) return null;
        if (score1 === null && score2 === null) return { winner, scores: null };
        if (score1 === null || score2 === null) {
            warn(`${data.matchId} 只填了一邊的比分（${score1}:${score2}），這一場先不顯示結果`);
            return null;
        }
        const [won, lost] = winner === 'team1' ? [score1, score2] : [score2, score1];
        if (won <= lost) {
            warn(`${data.matchId} 的 winner 是 ${winner}，但比分 ${score1}:${score2} 不符，這一場先不顯示結果`);
            return null;
        }
        return { winner, scores: [score1, score2] };
    };

    // 比賽狀態（MATCH 編號旁的標記）：有正式結果＝completed；否則看 JSON 的 status（"live"＝進行中，其他＝尚未開始）
    // status 與 winner 矛盾時以結果為準並在 console 警告（tools/validate-results.js 也會列出）
    const statusOf = (data, result) => {
        if (data.status !== undefined && !['scheduled', 'live', 'completed'].includes(data.status)) {
            warn(`${data.matchId} 的 status「${data.status}」只能是 scheduled、live、completed`);
        }
        if (result) {
            if (data.status && data.status !== 'completed') warn(`${data.matchId} 已有勝方，但 status 是 ${data.status}（顯示為已結束）`);
            return 'completed';
        }
        if (data.status === 'completed') warn(`${data.matchId} 的 status 是 completed，但沒有有效的勝方（顯示為尚未開始）`);
        return data.status === 'live' ? 'live' : 'scheduled';
    };

    // ── 對戰隊伍 ──────────────────────────────────────────────
    // team1／team2 → 顯示內容：數字＝隊伍 ID，null＝BYE，{ winner: "A1" }＝A1 的勝隊
    // A1 有正式結果時往回找 A1 勝方那一邊的隊伍（可以跨好幾輪），否則維持「A1 勝者」；只看 JSON 明確寫的 winner 引用，不用編號猜晉級關係
    // 引用的場次不存在、循環引用、勝方那一邊是 BYE 或還沒確定的隊伍時都不晉級，維持「A1 勝者」
    // 回傳 { text, kind: team／tbd／bye, members：搜尋用的選手名, ref：引用的場次 }；原始 JSON 不會被改動
    const sideResolver = (rawMatches, teams, results) => {
        const byId = new Map(rawMatches.map(data => [data.matchId, data]));

        const resolve = (value, seen) => {
            if (value == null) return { text: 'BYE', kind: 'bye', members: [] };
            if (typeof value === 'number') {
                const team = teams[value - 1];
                if (team) return { text: team.name, kind: 'team', members: [...(team.members || []), team.sub].filter(Boolean).map(p => p.name) };
                warn(`找不到隊伍 ID ${value}`);
                return { text: '—', kind: 'tbd', members: [] };
            }
            if (typeof value === 'object' && typeof value.winner === 'string') {
                const ref = value.winner;
                const pending = { text: t.winner(labelOf(ref)), kind: 'tbd', members: [], ref };
                const from = byId.get(ref);
                if (!from) {
                    warn(`引用的場次 ${ref} 不存在`);
                    return pending;
                }
                if (seen.has(ref)) {
                    warn(`${[...seen].join(' → ')} → ${ref} 循環引用`);
                    return pending;
                }
                const result = results.get(ref);
                if (!result) return pending;
                const advanced = resolve(from[result.winner], new Set(seen).add(ref));
                if (advanced.kind !== 'team') {
                    if (advanced.kind === 'bye') warn(`${ref} 的 winner 指向 BYE，不晉級`);
                    return pending;
                }
                return { ...advanced, ref };
            }
            if (typeof value === 'string') return { text: value, kind: 'tbd', members: [] };
            warn(`看不懂的隊伍資料 ${JSON.stringify(value)}`);
            return { text: '—', kind: 'tbd', members: [] };
        };

        return data => [resolve(data.team1, new Set([data.matchId])), resolve(data.team2, new Set([data.matchId]))];
    };

    // ── MATCH 編號 → 上方哪一張賽程圖 ─────────────────────────
    // 32強、16強在預賽 A–D 組的圖上：組別看對戰隊伍在 brackets.json 抽籤結果裡是哪一組，
    // 「A1 勝者」則往回找 valorant-schedule.json 裡 A1 那一場的隊伍；8強之後都在決賽圖上
    // 不看編號的英文字母猜組別；兩邊至少要有一邊對得到組別（淘汰賽中 A1 勝者的下一場一定在同一張圖上），
    // 兩邊都對不到、或兩邊的組別不一致就回傳 null（不加連結）
    const groupResolver = (rawMatches, teams, draw) => {
        const groupByTeam = new Map();
        Object.entries(draw || {}).forEach(([group, names]) => names.forEach(name => { if (name) groupByTeam.set(name, group); }));
        const byId = new Map(rawMatches.map(data => [data.matchId, data]));

        // 一邊隊伍的組別；BYE 或對不到是 null
        const sideGroup = (value, seen) => {
            if (value == null) return null;
            if (typeof value === 'number') return (teams[value - 1] && groupByTeam.get(teams[value - 1].name)) || null;
            if (value.winner) {
                const from = byId.get(value.winner);
                return from && !seen.has(from.matchId) ? matchGroup(from, seen) : null;
            }
            return null;
        };

        const matchGroup = (data, seen = new Set()) => {
            if (!PRELIM.includes(data.round)) return null;
            seen.add(data.matchId);
            const groups = [sideGroup(data.team1, seen), sideGroup(data.team2, seen)].filter(Boolean);
            return groups.length > 0 && groups.every(g => g === groups[0]) ? groups[0] : null;
        };

        return data => STAGES.includes(data.round) && !PRELIM.includes(data.round) ? 'Final' : matchGroup(data);
    };

    // 組別 → 賽程圖：預賽是有 A–D 分組按鈕的那張（按鈕由 main.js 切換），決賽是 data-group="Final" 的那張；捲動到圖所在的 .subsection
    const bracketTarget = group => {
        const container = document.querySelector(group === 'Final'
            ? '.schedule-image-container[data-bracket="valorant"][data-group="Final"]'
            : '.schedule-image-container[data-bracket="valorant"]:not([data-group])');
        const section = container && container.closest('.subsection');
        if (!section || !section.id) return null;
        const button = group === 'Final' ? null : container.parentElement.querySelector(`.group-btn[data-group="${group}"]`);
        if (group !== 'Final' && !button) return null;
        return { section, button };
    };

    // 平滑捲動；系統設定減少動態效果時直接跳過去
    const scrollBehavior = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';

    const showBracket = (group, { section, button }) => {
        if (button && !button.classList.contains('active')) button.click();
        section.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
    };

    // attackSide → [隊伍 1, 隊伍 2] 的攻守（'atk'／'def'）；null、沒有這個欄位或其他值＝還沒決定（不顯示）
    const sidesOf = data => {
        if (data.attackSide === 'team1') return ['atk', 'def'];
        if (data.attackSide === 'team2') return ['def', 'atk'];
        if (data.attackSide != null) warn(`${data.matchId} 的 attackSide「${data.attackSide}」只能是 "team1"、"team2" 或 null`);
        return null;
    };

    const buildRow = match => {
        const row = el('tr');
        row.dataset.match = match.data.matchId;

        // MATCH 編號：對得到賽程圖的做成連結，點下去切到那張圖並捲過去（見 showBracket）
        const id = el('td', 'match-id');
        const target = match.group && bracketTarget(match.group);
        if (target) {
            const link = el('a', 'match-tag match-link', match.label);
            link.href = `#${target.section.id}`;
            link.title = t.bracket(match.group);
            link.addEventListener('click', e => {
                e.preventDefault();
                showBracket(match.group, target);
            });
            id.append(link);
        } else {
            id.append(el('span', 'match-tag', match.label));
        }
        // 比賽狀態：編號旁的小標記（純 CSS 圖形，見 style.css 的 .status-mark），讀螢幕軟體念狀態文字
        const mark = el('span', `status-mark is-${match.status}`);
        mark.setAttribute('role', 'img');
        mark.setAttribute('aria-label', t.status[match.status]);
        mark.title = t.status[match.status];
        id.append(mark);

        // 隊伍 1｜VS｜隊伍 2：VS 固定在中間，兩隊各佔一半（見 style.css 的 .match-versus）
        // 攻守（attackSide＝"team1"／"team2"，另一隊自動是防守方）：ATK／DEF 小字放在隊名外側（隊伍 1 的左邊、隊伍 2 的右邊）
        // 正式結果：有比分時用「13 : 8」取代中間的 VS；沒有比分（棄權等）保留 VS，勝方隊名旁加 WIN；勝方白字、敗方稍暗
        const sides = sidesOf(match.data);
        const result = match.result;
        const teams = el('td', 'match-teams');
        const versus = el('div', 'match-versus');
        match.sides.forEach((side, i) => {
            if (i) versus.append(result && result.scores ? scoreOf(result) : el('span', 'match-vs', 'VS'));
            const outcome = result ? (result.winner === `team${i + 1}` ? 'win' : 'lose') : '';
            const team = el('span', `match-team is-${side.kind}${outcome ? ` is-${outcome}` : ''}`, side.text);
            const tags = [];
            if (sides) tags.push(el('span', `match-side is-${sides[i]}`, sides[i].toUpperCase()));
            if (outcome === 'win' && !result.scores) tags.push(el('span', 'match-win', 'WIN'));
            if (i) team.append(...tags.reverse());
            else team.prepend(...tags);
            versus.append(team);
        });
        teams.append(versus);

        // 地圖：英文名稱，還沒抽出（null 或沒有這個欄位）顯示 TBD；手機版排在隊伍下方，前面加 MAP
        const mapName = typeof match.data.map === 'string' ? match.data.map.trim() : '';
        const map = el('td', `match-map${mapName ? '' : ' is-tbd'}`);
        map.append(el('span', 'match-label', 'MAP'), mapName || 'TBD');

        // 開賽時間在手機版排在編號同一行，不另外加標籤；集合時間在手機版自己一行，前面加 CHECK-IN
        const time = (className, value, label) => {
            const cell = el('td', className);
            if (label) cell.append(el('span', 'match-label', label));
            cell.append(typeof value === 'string' && value ? value : '—');
            return cell;
        };

        row.append(id, teams, map, time('match-checkin', match.data.checkInTime, 'CHECK-IN'), time('match-start', match.data.startTime));
        return row;
    };

    // 比分「13 : 8」：勝方的數字較粗
    const scoreOf = result => {
        const score = el('span', 'match-score');
        result.scores.forEach((value, i) => {
            if (i) score.append(el('span', 'match-score-sep', ':'));
            score.append(el('span', `match-score-num${result.winner === `team${i + 1}` ? ' is-win' : ''}`, String(value)));
        });
        return score;
    };

    // 每一場的列：顯示內容（sig）沒變就沿用同一個 <tr>，自動更新時只有內容改變的場次會換掉
    const rowCache = new Map();
    const rowOf = match => {
        const cached = rowCache.get(match.data.matchId);
        if (cached && cached.sig === match.sig) return cached.row;
        const row = buildRow(match);
        rowCache.set(match.data.matchId, { sig: match.sig, row });
        return row;
    };

    // 跨日的階段：每一天的第一場前面加一列日期
    const dateRows = new Map();
    const dateRow = iso => {
        if (!dateRows.has(iso)) {
            const row = el('tr', 'match-date-row');
            const cell = el('th', '', dateText(iso));
            cell.colSpan = COLUMNS;
            cell.scope = 'colgroup';
            row.append(cell);
            dateRows.set(iso, row);
        }
        return dateRows.get(iso);
    };

    // Tab 下方的次要資訊：「11月7日(六) / 32強」，跨日時「第一天 – 最後一天」，還沒有賽程的階段只顯示階段名稱
    const renderInfo = dates => {
        const range = dates.length > 1 ? `${dateText(dates[0])} – ${dateText(dates[dates.length - 1])}` : dates.length ? dateText(dates[0]) : '';
        const text = `${range}|${t.rounds[current]}`;
        if (stageInfo.dataset.text === text) return;
        stageInfo.dataset.text = text;
        const parts = [];
        if (range) parts.push(el('span', 'match-stage-date', range), el('span', 'match-stage-sep', '/'));
        parts.push(el('span', 'match-stage-name', t.rounds[current]));
        stageInfo.replaceChildren(...parts);
    };

    // 手機版 Tab 列放不下時可以左右捲動：選取中的 Tab 不在看得見的範圍就捲過去（只捲 Tab 列，不捲整頁）
    const revealTab = button => {
        const left = button.offsetLeft;
        const right = left + button.offsetWidth;
        if (left < stagesBox.scrollLeft || right > stagesBox.scrollLeft + stagesBox.clientWidth) {
            stagesBox.scrollLeft = left - (stagesBox.clientWidth - button.offsetWidth) / 2;
        }
    };

    const render = () => {
        const query = queryText();
        const found = query ? matches.filter(match => isHit(match, query)) : matches;

        stageButtons.forEach(({ stage, button, count }) => {
            const n = found.filter(match => match.data.round === stage).length;
            button.setAttribute('aria-pressed', String(stage === current));
            button.classList.toggle('is-empty', Boolean(query) && n === 0);
            count.textContent = n;
            count.hidden = !query || n === 0;
            if (stage === current) revealTab(button);
        });

        // matches 已依日期排序，所以 dates 由早到晚
        const dates = [...new Set(matches.filter(match => match.data.round === current).map(match => match.data.date))];
        renderInfo(dates);

        const rows = found.filter(match => match.data.round === current);
        if (rows.length === 0) {
            showMessage('match-empty', query ? t.empty : t.none);
            return;
        }
        setRows(rows.flatMap((match, i) => dates.length > 1 && (i === 0 || match.data.date !== rows[i - 1].data.date)
            ? [dateRow(match.data.date), rowOf(match)]
            : [rowOf(match)]));
    };

    // 搜尋時目前的階段沒有符合的比賽，就切到第一個有結果的階段（手動按 Tab 時不自動切換；自動更新也不會切換）
    const onSearch = () => {
        const query = queryText();
        if (query && !matches.some(match => match.data.round === current && isHit(match, query))) {
            const stage = STAGES.find(s => matches.some(match => match.data.round === s && isHit(match, query)));
            if (stage) current = stage;
        }
        render();
    };

    // 賽程圖上的對戰代號（bracket.js 的 a.bracket-code，data-match＝比賽編號）點下去：
    // 切到那一場的階段 Tab、捲到那一列並短暫標示；目前的搜尋會把那一場篩掉時先清空搜尋
    // 時間表上沒有的場次（輪空）或資料還沒載入時不攔截，照連結原本的 # 捲到時間表
    let targetTimer = 0;
    const showMatch = matchId => {
        const match = matches.find(m => m.data.matchId === matchId);
        if (!match) return false;
        if (queryText() && !isHit(match, queryText())) {
            if (filter) filter.value = '';
            if (input && input.value) {
                input.value = '';
                input.dispatchEvent(new Event('input'));    // bracket.js 的下拉結果一起清掉
            }
        }
        current = match.data.round;
        render();
        const row = [...tbody.children].find(tr => tr.dataset.match === matchId);
        if (!row) return true;
        clearTimeout(targetTimer);
        row.classList.add('is-target');
        targetTimer = setTimeout(() => row.classList.remove('is-target'), 2500);
        row.scrollIntoView({ behavior: scrollBehavior(), block: 'center' });
        return true;
    };

    document.addEventListener('click', e => {
        const code = e.target.closest('a.bracket-code[data-match]');
        if (code && showMatch(code.dataset.match)) e.preventDefault();
    });

    // ── 資料讀取與驗證 ────────────────────────────────────────
    // 讀檔與自動更新由 js/live-source.js（NollyLive）負責，這裡只處理拿到的資料

    // 檢查 JSON 結構：matches 要是陣列，每一場至少要有 matchId（不重複）、date（YYYY-MM-DD）、team1、team2 這兩個欄位（值可以是 null＝BYE）
    // 結構有問題的場次略過（console 警告）；但如果因此讓目前畫面上已有的場次消失（存檔到一半、打錯字），整份不套用、保留上一次成功的資料
    const sanitize = (json, shownIds) => {
        if (!json || typeof json !== 'object' || !Array.isArray(json.matches)) throw new Error('matches 不是陣列');
        const ids = new Set();
        const list = [];
        const broken = [];
        json.matches.forEach((data, i) => {
            const where = data && typeof data.matchId === 'string' && data.matchId ? data.matchId : `第 ${i + 1} 場`;
            const problems = [];
            if (!data || typeof data !== 'object') problems.push('不是物件');
            else {
                if (typeof data.matchId !== 'string' || !data.matchId.trim()) problems.push('缺少 matchId');
                else if (ids.has(data.matchId)) problems.push('matchId 重複');
                if (typeof data.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) problems.push('date 不是 YYYY-MM-DD');
                if (!('team1' in data) || !('team2' in data)) problems.push('缺少 team1／team2');
            }
            if (problems.length) {
                broken.push(`${where}（${problems.join('、')}）`);
                return;
            }
            ids.add(data.matchId);
            list.push(data);
        });
        if (broken.length && [...shownIds].some(id => !ids.has(id))) {
            throw new Error(`資料有誤，這次更新不套用、保留目前的畫面：${broken.join('；')}`);
        }
        broken.forEach(msg => warn(`${msg}，這一場略過`));
        if (list.length === 0) throw new Error('沒有可用的比賽資料');
        return { isTest: json.isTest === true, matches: list };
    };

    // ── 套用資料 ──────────────────────────────────────────────
    let teams = null;      // valorant-teams.json 的 teams（隊伍 ID＝順序）
    let draw;              // brackets.json 的 valorant 抽籤結果；undefined＝還沒讀，null＝讀不到（不加賽程圖連結）
    let lastKey = null;    // 上一次套用的賽程資料（JSON 字串），內容沒變就不重畫
    let shownIds = new Set();    // 上一次套用的場次編號
    let started = false;

    const apply = schedule => {
        testNote.hidden = !schedule.isTest;
        testNote.textContent = schedule.isTest ? t.test : '';

        const raw = schedule.matches;
        const groupOf = groupResolver(raw, teams, draw);
        const results = new Map(raw.map(data => [data.matchId, resultOf(data)]));
        const sidesFor = sideResolver(raw, teams, results);

        // 上方賽程圖（bracket.js）的晉級格用同一份資料更新：每一場（含輪空）已確定的兩隊與勝隊隊名，還沒確定的是 null
        const teamName = side => side.kind === 'team' ? side.text : null;
        document.dispatchEvent(new CustomEvent('valorant-schedule:update', { detail: new Map(raw.map(data => {
            const sides = sidesFor(data);
            const result = results.get(data.matchId);
            return [data.matchId, { sides: sides.map(teamName), winner: result ? teamName(sides[result.winner === 'team1' ? 0 : 1]) : null }];
        })) }));

        // 輪空的場次（team1／team2 是 null＝BYE）不顯示；其餘依日期 → 開賽時間（沒填的排最後）→ 比賽編號排序
        const timeKey = time => typeof time === 'string' && time ? time : '99:99';
        matches = raw
            .filter(data => data.team1 != null && data.team2 != null)
            .sort((a, b) => a.date.localeCompare(b.date)
                || timeKey(a.startTime).localeCompare(timeKey(b.startTime))
                || a.matchId.localeCompare(b.matchId, 'en', { numeric: true }))
            .map(data => {
                if (!STAGES.includes(data.round)) warn(`${data.matchId} 的 round「${data.round}」不是 ${STAGES.join('／')}，不會顯示`);
                const label = labelOf(data.matchId);
                const sides = sidesFor(data);
                const result = results.get(data.matchId);
                // 搜尋：只比對已確定的隊名與選手名（含替補）；不比對場次編號，也不比對「A1 勝者」這類還沒確定的位置
                const keys = sides.filter(side => side.kind === 'team').flatMap(side => [side.text, ...side.members])
                    .filter(Boolean).map(normalize);
                const group = groupOf(data);
                const status = statusOf(data, result);
                const sig = JSON.stringify([label, group, status, sides.map(side => [side.text, side.kind]), result,
                    data.map, data.attackSide, data.checkInTime, data.startTime]);
                return { data, label, sides, result, status, keys, group, sig };
            });

        if (!started) {
            started = true;
            // 文字型 Tab：「32強」＋搜尋時的符合場數
            stageButtons = STAGES.map(stage => {
                const button = el('button', 'match-stage-btn');
                button.type = 'button';
                const count = el('span', 'match-stage-count');
                count.hidden = true;
                button.append(el('span', 'match-stage-label', t.rounds[stage]), count);
                button.addEventListener('click', () => { current = stage; render(); });
                stagesBox.append(button);
                return { stage, button, count };
            });
            // 頁面上方的搜尋欄：文字同步帶進時間表的搜尋欄再篩選；時間表的搜尋欄：只篩選時間表
            if (input) input.addEventListener('input', () => {
                if (filter) filter.value = input.value;
                onSearch();
            });
            if (filter) filter.addEventListener('input', onSearch);
            if (liveNote) liveNote.hidden = false;
            // 瀏覽器還原了頁面上方搜尋欄的文字時，一併帶進時間表的搜尋欄
            if (filter && input && input.value && !filter.value) filter.value = input.value;
            if (queryText()) onSearch();
            else render();
            return;
        }
        // 自動更新：維持目前的 Tab 與搜尋，只重畫內容
        render();
    };

    // 定期讀一次最新的賽程 JSON（NollyLive.watch：同時只有一個請求、檔案沒變不呼叫、背景分頁暫停）
    // 失敗（部署中、網路中斷、HTTP 錯誤、JSON 格式錯誤、資料驗證不過）時保留目前畫面，等下一次再試；只有還沒有任何資料時才顯示錯誤訊息
    const onSchedule = async json => {
        if (!teams) {
            const [teamData, brackets] = await Promise.all([
                NollyLive.load(TEAMS_URL),
                draw === undefined ? NollyLive.load(BRACKETS_URL).catch(err => { console.error(err); return null; }) : null,
            ]);
            if (!teamData || !Array.isArray(teamData.teams)) throw new Error(`${TEAMS_URL}: teams 不是陣列`);
            if (draw === undefined) draw = (brackets && brackets.valorant) || null;
            teams = teamData.teams;
        }
        const schedule = sanitize(json, shownIds);
        const key = JSON.stringify(schedule);
        if (key === lastKey) return;
        apply(schedule);
        lastKey = key;
        shownIds = new Set(schedule.matches.map(data => data.matchId));
    };

    NollyLive.watch(SCHEDULE_URL, {
        onData: onSchedule,
        onError: err => {
            console.error(err);
            if (!started) showMessage('match-empty', t.error);
        },
    });
})();
