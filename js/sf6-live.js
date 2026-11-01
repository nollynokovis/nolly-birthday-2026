// SF6 即時賽況（UI Renderer）：schedule-sf6*.html 的組別按鈕進度標記，
// 並把晉級結果交給 bracket.js 更新賽程圖疊字（nolly-bracket:update 事件）、把同一份計算結果交給對戰一覽（js/sf6-schedule.js，nolly-sf6:update 事件）
//   資料來源：js/live-source.js（NollyLive）——比賽結構 data/sf6-*-matches.json 讀一次，結果 data/sf6-*-results.json 定期檢查（間隔見 live-source.js 的 POLL_MS）
//   賽事邏輯：js/sf6-logic.js（NollySF6Logic）——勝方、晉級、BYE、組別進度都在那裡算，這裡只負責畫面
// 結果資料格式錯誤（JSON 壞掉、場次編號或 status／winner 打錯）時整份不套用，畫面保留上一次成功的資料；
// 其他資料問題（還沒確定對手就填勝方、LIVE 互相矛盾等）略過有問題的部分並在 console 提醒，詳細可在本機跑 node tools/validate-results.js
// 自動更新只改有變的地方，不動目前選的組別、搜尋內容與捲動位置
(() => {
    const EVENTS = [
        { kind: 'sf6Solo', structureUrl: 'data/sf6-individual-matches.json', resultsUrl: 'data/sf6-individual-results.json' },
        { kind: 'sf6Team', structureUrl: 'data/sf6-team-matches.json', resultsUrl: 'data/sf6-team-results.json' },
    ];
    const BRACKETS_URL = 'data/brackets.json';
    const PLAYERS_URL  = 'data/players.json';

    // status：狀態標記的說明文字；rounds：比賽結構 roundNames 的名稱 → 顯示文字（對戰一覽的 ROUND 欄）
    const I18N = {
        zh: {
            status: { scheduled: '尚未開始', live: '進行中', completed: '已完成' },
            rounds: { top128: '128強', top64: '64強', top32: '32強', top16: '16強', top8: '8強', top4: '4強', final: '冠軍決賽', thirdPlace: '季軍決定戰' },
        },
        ja: {
            status: { scheduled: '開始前', live: '進行中', completed: '終了' },
            rounds: { top128: 'ベスト128', top64: 'ベスト64', top32: 'ベスト32', top16: 'ベスト16', top8: '準々決勝', top4: '準決勝', final: '決勝', thirdPlace: '3位決定戦' },
        },
        en: {
            status: { scheduled: 'Upcoming', live: 'Live', completed: 'Completed' },
            rounds: { top128: 'Round of 128', top64: 'Round of 64', top32: 'Round of 32', top16: 'Round of 16', top8: 'Quarterfinal', top4: 'Semifinal', final: 'Grand Final', thirdPlace: 'Third Place Match' },
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

    // console 提醒同一句只出現一次（每次自動更新時不會一直重複）
    const warned = new Set();
    const warn = msg => {
        if (warned.has(msg)) return;
        warned.add(msg);
        console.warn(msg);
    };

    // 狀態小標記（純 CSS 圖形，見 style.css 的 .status-mark）；讀螢幕軟體念狀態文字
    const statusMark = status => {
        const mark = el('span', `status-mark is-${status}`);
        mark.setAttribute('role', 'img');
        mark.setAttribute('aria-label', t.status[status]);
        mark.title = t.status[status];
        return mark;
    };

    // 參賽者顯示：個人賽＝選手名；團體賽＝三位隊員（「A / B / C」，不顯示 TEAM 03 這類編號；隊員名稱一樣可以搜尋）
    const participantsOf = (kind, players, brackets) => {
        if (kind === 'sf6Solo') {
            const names = new Map(players.players.map(p => [p.id, p.name]));
            return { has: id => names.has(id), view: id => ({ name: names.get(id), members: [] }) };
        }
        const teams = new Map(Object.values(brackets.sf6Team).flat().filter(Boolean).map(team => [team.no, team]));
        return {
            has: id => teams.has(id),
            view: id => ({ name: teams.get(id).members.join(' / '), members: [] }),
        };
    };

    const setup = async (cfg, shared) => {
        const containers = [...document.querySelectorAll(`.schedule-image-container[data-bracket="${cfg.kind}"]`)];
        const schedule = document.querySelector(`.sf6-schedule[data-live-event="${cfg.kind}"]`);
        if (!containers.length && !schedule) return;

        const [structure, players, brackets] = await Promise.all([NollyLive.load(cfg.structureUrl), shared.players, shared.brackets]);
        const people = participantsOf(cfg.kind, players, brackets);
        const structureIssues = NollySF6Logic.checkStructure(structure, people.has);
        if (structureIssues.some(i => i.level === 'error')) {
            structureIssues.forEach(i => console.error(`${cfg.structureUrl}：${i.message}`));
            throw new Error(`${cfg.structureUrl} 有錯誤，SF6 即時賽況不啟用`);
        }
        const byPosition = new Map(structure.matches.map(m => [`${m.group}|${m.round}|${m.index}`, m.matchId]));

        // 組別按鈕（各圖容器同一區塊裡的 .group-buttons）→ 組別
        const groupButtons = containers.flatMap(container => {
            const row = container.parentElement.querySelector('.group-buttons');
            return row ? [...row.querySelectorAll('.group-btn')] : [];
        });

        // 組別按鈕：進行中＝紅點、已完成＝灰勾、尚未開始不加標記；按鈕本身的顏色與切換功能不變
        const renderGroups = model => {
            groupButtons.forEach(button => {
                const status = model.groups.get(button.dataset.group);
                const old = button.querySelector('.status-mark');
                if (status !== 'live' && status !== 'completed') {
                    if (old) old.remove();
                    return;
                }
                if (old && old.classList.contains(`is-${status}`)) return;
                if (old) old.remove();
                button.append(statusMark(status));
            });
        };

        // 賽程圖：每張圖各欄的參賽者與敗方標記，交給 bracket.js（第 0 欄：預賽是抽籤不動、決賽是第一輪的兩邊；之後各欄＝前一輪各場的勝者）
        const bracketDetail = model => {
            const at = (group, round, index) => model.matches.get(byPosition.get(`${group}|${round}|${index}`));
            const winnerId = m => m && m.winnerSide && m.winnerSide.kind === 'entrant' ? m.winnerSide.id : null;
            const lost = m => m && m.status === 'completed' ? [m.winner !== 'team1', m.winner !== 'team2'] : [false, false];
            const count = (group, round) => structure.matches.filter(m => m.group === group && m.round === round).length;
            const images = {};
            Object.entries(structure.bracketRounds).forEach(([group, rounds]) => {
                const columns = [];
                const firstCount = count(group, rounds[0]);
                const first = Array.from({ length: firstCount }, (_, k) => at(group, rounds[0], k + 1));
                columns.push({
                    ids: group === 'Final' ? first.flatMap(m => m.sides.map(s => s.kind === 'entrant' ? s.id : null)) : null,
                    lost: first.flatMap(lost),
                });
                rounds.forEach((round, r) => {
                    const here = Array.from({ length: count(group, round) }, (_, k) => at(group, round, k + 1));
                    const next = rounds[r + 1] ? Array.from({ length: count(group, rounds[r + 1]) }, (_, k) => at(group, rounds[r + 1], k + 1)) : [];
                    columns.push({ ids: here.map(winnerId), lost: next.length ? next.flatMap(lost) : here.map(() => false) });
                });
                images[group] = columns;
            });
            return { kind: cfg.kind, images };
        };

        let model = null;
        let lastKey = '';
        NollyLive.watch(cfg.resultsUrl, {
            onData: results => {
                const shape = NollySF6Logic.checkResultsShape(results, structure);
                if (shape.length) throw new Error(`${cfg.resultsUrl} 有錯誤，這次更新不套用、保留目前的畫面：${shape.map(i => i.message).join('；')}`);
                const next = NollySF6Logic.evaluate(structure, results, people.has);
                next.issues.forEach(i => warn(`${cfg.resultsUrl}：${i.message}`));
                if (model) {
                    NollySF6Logic.affectedMatches(model, next).forEach(a => warn(`${cfg.resultsUrl}：${a.matchId} 已完成，但上一輪結果改變後對手不同了（${a.before.join(' vs ')} → ${a.after.join(' vs ')}），請重新確認這一場的勝方`));
                }
                model = next;
                // 內容沒變（例如只改了註解）就不動畫面
                const key = JSON.stringify([...model.matches].map(([id, m]) => [id, m.status, m.winner, m.sides.map(s => [s.kind, s.id, s.ref])]).concat([model.currentId, [...model.groups]]));
                if (key === lastKey) return;
                lastKey = key;
                renderGroups(model);
                document.dispatchEvent(new CustomEvent('nolly-bracket:update', { detail: bracketDetail(model) }));
                // 對戰一覽（js/sf6-schedule.js）用同一份計算結果；輪次名稱與參賽者顯示也從這裡給，叫法一致
                document.dispatchEvent(new CustomEvent('nolly-sf6:update', { detail: {
                    kind: cfg.kind, structure, model,
                    roundLabel: code => t.rounds[structure.roundNames[code]] || code,
                    view: id => people.view(id),
                } }));
            },
            onError: err => console.error(err),
        });
    };

    if (!window.NollyLive || !window.NollySF6Logic) return;
    if (!document.querySelector('.schedule-image-container[data-bracket^="sf6"], .sf6-schedule')) return;
    const shared = { players: NollyLive.load(PLAYERS_URL), brackets: NollyLive.load(BRACKETS_URL) };
    EVENTS.forEach(cfg => setup(cfg, shared).catch(err => console.error(err)));
})();
