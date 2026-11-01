// 賽事資料驗證：node tools/validate-results.js
// 檢查 SF6 個人賽／團體賽的比賽結構與結果、VALORANT 的狀態與比分；有 error 時結束代碼為 1（可在 commit 前執行）
// 選用：node tools/validate-results.js --before <資料夾>
//   <資料夾> 放修改前的 sf6-individual-results.json／sf6-team-results.json，會列出「上一輪結果被改了，導致後面已完成的比賽換了對手」的場次
// SF6 的判斷用網頁同一份 js/sf6-logic.js，結果和網頁顯示一致
const fs = require('fs');
const path = require('path');
const Logic = require('../js/sf6-logic.js');

const ROOT = path.resolve(__dirname, '..');
const read = file => JSON.parse(fs.readFileSync(path.isAbsolute(file) ? file : path.join(ROOT, file), 'utf8'));
const args = process.argv.slice(2);
const beforeDir = args.includes('--before') ? args[args.indexOf('--before') + 1] : null;

let errors = 0;
let warnings = 0;
const report = (title, issues) => {
    const e = issues.filter(i => i.level === 'error');
    const w = issues.filter(i => i.level === 'warning');
    errors += e.length;
    warnings += w.length;
    console.log(`\n■ ${title}：${e.length ? `${e.length} 個錯誤` : '沒有錯誤'}${w.length ? `、${w.length} 個警告` : ''}`);
    e.forEach(i => console.log(`  ✗ ${i.message}`));
    w.forEach(i => console.log(`  ! ${i.message}`));
};
const tryRead = (file, issues) => {
    try {
        return read(file);
    } catch (err) {
        issues.push({ level: 'error', message: `${file} 讀不到或不是正確的 JSON：${err.message}` });
        return null;
    }
};

const brackets = read('data/brackets.json');
const players = read('data/players.json').players;
const playerIds = new Set(players.map(p => p.id));
const playerIdByName = new Map(players.map(p => [p.name, p.id]));

// ── SF6 ─────────────────────────────────────────────────────
const SF6 = [
    {
        title: 'SF6 個人賽',
        event: 'sf6-individual',
        structure: 'data/sf6-individual-matches.json',
        results: 'data/sf6-individual-results.json',
        draw: brackets.sf6Solo,
        drawId: entry => entry === null ? null : (playerIdByName.has(entry) ? playerIdByName.get(entry) : `?${entry}`),
        isEntrant: id => playerIds.has(id),
        nameOf: id => id == null ? '（未定）' : (players.find(p => p.id === id) || {}).name || `#${id}`,
        // 決賽圖左側由上到下印的組別（img/1x/個人賽決賽.webp、bracket.js FINAL_LAYOUTS.sf6Solo.seeds）
        seeds: ['A', 'E', 'C', 'G', 'D', 'H', 'B', 'F'],
        firstFinal: 'QF',
        thirdPlace: true,
    },
    {
        title: 'SF6 團體賽',
        event: 'sf6-team',
        structure: 'data/sf6-team-matches.json',
        results: 'data/sf6-team-results.json',
        draw: brackets.sf6Team,
        drawId: entry => entry === null ? null : entry.no,
        isEntrant: id => Object.values(brackets.sf6Team).flat().some(team => team && team.no === id),
        nameOf: id => id == null ? '（未定）' : `TEAM ${String(id).padStart(2, '0')}`,
        // 團體賽決賽圖左側由上到下印的組別（img/1x/團體賽決賽.webp、bracket.js FINAL_LAYOUTS.sf6Team.seeds）
        seeds: ['A', 'B', 'C', 'D'],
        firstFinal: 'SF',
        thirdPlace: false,
    },
];

SF6.forEach(cfg => {
    const issues = [];
    const structure = tryRead(cfg.structure, issues);
    if (!structure) return report(cfg.title, issues);
    issues.push(...Logic.checkStructure(structure, cfg.isEntrant));
    const defs = new Map(structure.matches.map(m => [m.matchId, m]));

    // 第一輪的對戰順序必須和抽籤（brackets.json）一模一樣：第 2k-1、2k 格對戰，沒有重新抽籤或調換
    Object.entries(cfg.draw).forEach(([group, slots]) => {
        for (let k = 1; k <= slots.length / 2; k++) {
            const m = defs.get(`${group}-R1-${k}`);
            const expected = [cfg.drawId(slots[2 * k - 2]), cfg.drawId(slots[2 * k - 1])];
            if (!m) issues.push({ level: 'error', message: `少了 ${group}-R1-${k}` });
            else if (m.team1 !== expected[0] || m.team2 !== expected[1]) {
                issues.push({ level: 'error', message: `${group}-R1-${k} 是 ${m.team1} vs ${m.team2}，抽籤是 ${expected[0]} vs ${expected[1]}` });
            }
        }
    });
    // 各組冠軍進決賽的位置必須和決賽圖印的組別順序一致（個人賽八強／團體賽四強）
    const lastRound = group => structure.bracketRounds[group][structure.bracketRounds[group].length - 1];
    cfg.seeds.forEach((group, seat) => {
        const k = Math.floor(seat / 2) + 1;
        const id = structure.matches.filter(m => m.group === 'Final' && m.round === cfg.firstFinal).length === 1 ? `F-${cfg.firstFinal}` : `F-${cfg.firstFinal}-${k}`;
        const slot = seat % 2 ? 'team2' : 'team1';
        const m = defs.get(id);
        const want = `${group}-${lastRound(group)}-1`;
        if (!m || !m[slot] || m[slot].winner !== want) issues.push({ level: 'error', message: `${id} ${slot} 應該是 ${group} 組冠軍（${want}），實際是 ${JSON.stringify(m && m[slot])}` });
    });
    if (cfg.thirdPlace) {
        const third = defs.get('F-3RD');
        if (!third || !third.team1 || third.team1.loser !== 'F-SF-1' || !third.team2 || third.team2.loser !== 'F-SF-2') {
            issues.push({ level: 'error', message: 'F-3RD 應該是 F-SF-1 敗者 vs F-SF-2 敗者' });
        }
    }

    // 結果
    const results = tryRead(cfg.results, issues);
    let model = null;
    if (results) {
        const shape = Logic.checkResultsShape(results, structure);
        issues.push(...shape);
        if (!shape.length) {
            model = Logic.evaluate(structure, results, cfg.isEntrant);
            issues.push(...model.issues);
        }
    }
    if (beforeDir && model) {
        const old = tryRead(path.join(path.resolve(beforeDir), path.basename(cfg.results)), issues);
        if (old && !Logic.checkResultsShape(old, structure).length) {
            Logic.affectedMatches(Logic.evaluate(structure, old, cfg.isEntrant), model).forEach(a => issues.push({
                level: 'error',
                message: `${a.matchId} 已完成，但上一輪結果改變後對手從 ${a.before.map(cfg.nameOf).join(' vs ')} 變成 ${a.after.map(cfg.nameOf).join(' vs ')}，請重新確認這一場的勝方`,
            }));
        }
    }

    // 對戰一覽的組別時間（data/sf6-schedule-times.json）：每個分頁（各組＋Final）都要有，格式正確；還沒確認（null）的列成警告
    const times = tryRead('data/sf6-schedule-times.json', issues);
    if (times) {
        const entries = times[cfg.event];
        const tabs = [...structure.groups, 'Final'];
        const isTime = v => typeof v === 'string' && /^([0-9]|[0-2][0-9]):[0-5][0-9]$/.test(v);
        const checkTime = (where, obj) => {
            ['checkInTime', 'startTime', 'endTime'].forEach(key => {
                const v = obj[key];
                if (v === null || v === undefined) issues.push({ level: 'warning', message: `時間待確認：${where} 的 ${key} 還沒填` });
                else if (!isTime(v)) issues.push({ level: 'error', message: `${where} 的 ${key}「${v}」不是 H:MM／HH:MM（跨夜可寫 24:00、1:00）` });
            });
        };
        if (!entries || typeof entries !== 'object') issues.push({ level: 'error', message: `sf6-schedule-times.json 沒有 ${cfg.event}` });
        else {
            tabs.forEach(tab => {
                const entry = entries[tab];
                const where = `sf6-schedule-times.json ${cfg.event} ${tab}`;
                if (!entry) return issues.push({ level: 'error', message: `${where} 不存在` });
                if (typeof entry.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) issues.push({ level: 'error', message: `${where} 的 date 不是 YYYY-MM-DD` });
                if (Array.isArray(entry.sessions)) {
                    const rounds = new Set(structure.matches.filter(m => m.group === tab).map(m => m.round));
                    entry.sessions.forEach((s, i) => {
                        (s.rounds || []).forEach(r => { if (!rounds.has(r)) issues.push({ level: 'error', message: `${where} sessions[${i}] 的輪次「${r}」不在這個分頁` }); });
                        checkTime(`${where} sessions[${i}]`, s);
                    });
                } else {
                    checkTime(where, entry);
                }
            });
            Object.keys(entries).filter(k => !tabs.includes(k)).forEach(k => issues.push({ level: 'error', message: `sf6-schedule-times.json ${cfg.event} 有不存在的分頁「${k}」` }));
        }
    }

    report(cfg.title, issues);
    if (model) {
        const all = [...model.matches.values()];
        const count = s => all.filter(m => m.status === s).length;
        console.log(`  場次 ${all.length}（BYE ${count('bye')}、尚未開始 ${count('scheduled')}、進行中 ${count('live')}、已完成 ${count('completed')}）`);
        console.log(`  組別：${[...model.groups].map(([g, s]) => `${g}=${s}`).join(' ')}；currentMatch=${model.currentId || 'null'}`);
    }
});

// ── VALORANT ───────────────────────────────────────────────
// 狀態與比分（判斷規則同 js/match-schedule.js 的 resultOf）
(() => {
    const issues = [];
    const add = (level, message) => issues.push({ level, message });
    const schedule = tryRead('data/valorant-schedule.json', issues);
    if (!schedule) return report('VALORANT', issues);
    const teams = read('data/valorant-teams.json').teams;
    const ids = new Set();
    const byId = new Map();
    (schedule.matches || []).forEach(m => {
        if (ids.has(m.matchId)) add('error', `matchId 重複：${m.matchId}`);
        ids.add(m.matchId);
        byId.set(m.matchId, m);
    });
    const isScore = v => Number.isInteger(v) && v >= 0;
    byId.forEach(m => {
        ['team1', 'team2'].forEach(slot => {
            const v = m[slot];
            if (typeof v === 'number' && !teams[v - 1]) add('error', `${m.matchId} 的 ${slot} 隊伍 ID ${v} 不存在`);
            if (v && typeof v === 'object' && !byId.has(v.winner)) add('error', `${m.matchId} 的 ${slot} 引用不存在的場次 ${v.winner}`);
        });
        if (m.status !== undefined && !['scheduled', 'live', 'completed'].includes(m.status)) add('error', `${m.matchId} 的 status「${m.status}」只能是 scheduled、live、completed`);
        if (m.winner != null && m.winner !== 'team1' && m.winner !== 'team2') add('error', `${m.matchId} 的 winner「${m.winner}」只能是 "team1"、"team2" 或 null`);
        [['score1', m.score1], ['score2', m.score2]].forEach(([k, v]) => { if (v != null && !isScore(v)) add('error', `${m.matchId} 的 ${k}「${v}」不是 0 以上的整數`); });
        let official = false;
        if (m.winner === 'team1' || m.winner === 'team2') {
            const [s1, s2] = [m.score1 == null ? null : m.score1, m.score2 == null ? null : m.score2];
            if (s1 === null && s2 === null) official = true;
            else if (s1 === null || s2 === null) add('error', `${m.matchId} 只填了一邊的比分`);
            else if ((m.winner === 'team1' ? s1 - s2 : s2 - s1) <= 0) add('error', `${m.matchId} 的 winner 是 ${m.winner}，但比分 ${s1}:${s2} 不符`);
            else official = true;
        }
        if (official && m.status && m.status !== 'completed') add('warning', `${m.matchId} 已有勝方，但 status 是 ${m.status}（網頁顯示已結束）`);
        if (!official && m.status === 'completed') add('warning', `${m.matchId} 的 status 是 completed，但沒有有效的勝方（網頁顯示尚未開始）`);
    });
    // 循環引用
    const state = new Map();
    const visit = (id, trail) => {
        if (state.get(id) === 2) return;
        if (state.get(id) === 1) return add('error', `循環引用：${[...trail, id].join(' → ')}`);
        state.set(id, 1);
        const m = byId.get(id);
        ['team1', 'team2'].forEach(slot => { const v = m[slot]; if (v && typeof v === 'object' && byId.has(v.winner)) visit(v.winner, [...trail, id]); });
        state.set(id, 2);
    };
    byId.forEach((m, id) => visit(id, []));
    report('VALORANT', issues);
})();

console.log(`\n合計：${errors} 個錯誤、${warnings} 個警告`);
process.exit(errors ? 1 : 0);
