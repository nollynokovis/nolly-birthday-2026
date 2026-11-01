// SF6 比賽結構產生器：由 data/brackets.json 的抽籤結果（sf6Solo／sf6Team）與 data/players.json 的選手 ID，
// 產生 data/sf6-individual-matches.json 與 data/sf6-team-matches.json（每場的編號、組別、輪次、對戰雙方、晉級位置）
// 抽籤結果有改時再執行一次：node tools/build-sf6-matches.js（結果檔 sf6-*-results.json 只在不存在時建立，不會覆寫；產生後請跑 node tools/validate-results.js）
//
// 賽程形狀照賽程圖與 js/bracket.js 的 LAYOUTS（第 c 欄第 2k、2k+1 格的勝者進第 c+1 欄第 k 格；每欄先左側由上到下、再右側由上到下）：
//   個人賽每組 16 格：R1（8 場）→ R2（4）→ R3（2）→ R4（1，晉級八強）；決賽 F-QF（4）→ F-SF（2）→ F-F，另有 F-3RD（兩場準決賽敗方）
//   團體賽每組 8 格：R1（4 場）→ R2（2）→ R3（1，晉級四強）；決賽 F-SF（2）→ F-F（規則沒有季軍賽）
//   決賽第一輪的組別順序＝決賽圖左側由上到下印的組別（同 bracket.js FINAL_LAYOUTS 的 seeds）
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = file => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));

const brackets = read('data/brackets.json');
const players = read('data/players.json').players;
const playerIdByName = new Map(players.map(p => [p.name, p.id]));

const EVENTS = [
    {
        file: 'data/sf6-individual-matches.json',
        event: 'sf6-individual',
        draw: brackets.sf6Solo,
        // 選手：抽籤裡是名字 → players.json 的 id
        idOf: entry => {
            if (entry === null) return null;
            if (!playerIdByName.has(entry)) throw new Error(`sf6Solo：players.json 找不到「${entry}」`);
            return playerIdByName.get(entry);
        },
        seeds: ['A', 'E', 'C', 'G', 'D', 'H', 'B', 'F'],
        groupRounds: ['R1', 'R2', 'R3', 'R4'],
        finalRounds: ['QF', 'SF', 'F'],
        thirdPlace: true,
        roundNames: { R1: 'top128', R2: 'top64', R3: 'top32', R4: 'top16', QF: 'top8', SF: 'top4', F: 'final', '3RD': 'thirdPlace' },
        note: 'SF6 個人賽比賽結構（由 tools/build-sf6-matches.js 依 brackets.json 的 sf6Solo 抽籤產生，請不要手動修改；比賽當天的結果請改 sf6-individual-results.json）。',
        participants: 'team1／team2：數字＝players.json 的選手 id；{ "winner": "A-R1-1" }＝那一場的勝者；{ "loser": "F-SF-1" }＝那一場的敗者；null＝BYE。',
    },
    {
        file: 'data/sf6-team-matches.json',
        event: 'sf6-team',
        draw: brackets.sf6Team,
        // 隊伍：brackets.json sf6Team 的隊伍編號 no（同 sf6-team.html?id=N）
        idOf: entry => entry === null ? null : entry.no,
        seeds: ['A', 'B', 'C', 'D'],
        groupRounds: ['R1', 'R2', 'R3'],
        finalRounds: ['SF', 'F'],
        thirdPlace: false,
        roundNames: { R1: 'top32', R2: 'top16', R3: 'top8', SF: 'top4', F: 'final' },
        note: 'SF6 團體賽比賽結構（由 tools/build-sf6-matches.js 依 brackets.json 的 sf6Team 抽籤產生，請不要手動修改；比賽當天的結果請改 sf6-team-results.json）。',
        participants: 'team1／team2：數字＝brackets.json sf6Team 的隊伍編號 no；{ "winner": "A-R1-1" }＝那一場的勝者；null＝BYE。',
    },
];

const finalId = (round, k, count) => count === 1 ? `F-${round}` : `F-${round}-${k}`;

const build = cfg => {
    const matches = [];
    const groups = Object.keys(cfg.draw);
    const lastGroupRound = cfg.groupRounds[cfg.groupRounds.length - 1];

    groups.forEach(group => {
        const slots = cfg.draw[group];
        if (slots.length !== 2 ** cfg.groupRounds.length) throw new Error(`${cfg.event} ${group} 組有 ${slots.length} 格，和輪數不符`);
        cfg.groupRounds.forEach((round, r) => {
            const count = slots.length / 2 ** (r + 1);
            for (let k = 1; k <= count; k++) {
                const isFirst = r === 0;
                const team1 = isFirst ? cfg.idOf(slots[2 * k - 2]) : { winner: `${group}-${cfg.groupRounds[r - 1]}-${2 * k - 1}` };
                const team2 = isFirst ? cfg.idOf(slots[2 * k - 1]) : { winner: `${group}-${cfg.groupRounds[r - 1]}-${2 * k}` };
                let nextMatch;
                let nextSlot;
                if (round === lastGroupRound) {
                    // 各組冠軍 → 決賽第一輪：照決賽圖印的組別順序
                    const seat = cfg.seeds.indexOf(group);
                    if (seat < 0) throw new Error(`${cfg.event}：seeds 沒有 ${group} 組`);
                    nextMatch = finalId(cfg.finalRounds[0], Math.floor(seat / 2) + 1, cfg.seeds.length / 2);
                    nextSlot = seat % 2 ? 'team2' : 'team1';
                } else {
                    nextMatch = `${group}-${cfg.groupRounds[r + 1]}-${Math.ceil(k / 2)}`;
                    nextSlot = k % 2 ? 'team1' : 'team2';
                }
                matches.push({ matchId: `${group}-${round}-${k}`, group, round, index: k, team1, team2, nextMatch, nextSlot });
            }
        });
    });

    cfg.finalRounds.forEach((round, r) => {
        const count = cfg.seeds.length / 2 ** (r + 1);
        for (let k = 1; k <= count; k++) {
            const team1 = r === 0
                ? { winner: `${cfg.seeds[2 * k - 2]}-${lastGroupRound}-1` }
                : { winner: finalId(cfg.finalRounds[r - 1], 2 * k - 1, count * 2) };
            const team2 = r === 0
                ? { winner: `${cfg.seeds[2 * k - 1]}-${lastGroupRound}-1` }
                : { winner: finalId(cfg.finalRounds[r - 1], 2 * k, count * 2) };
            const isLast = r === cfg.finalRounds.length - 1;
            const match = {
                matchId: finalId(round, k, count), group: 'Final', round, index: k, team1, team2,
                nextMatch: isLast ? null : finalId(cfg.finalRounds[r + 1], Math.ceil(k / 2), count / 2),
                nextSlot: isLast ? null : (k % 2 ? 'team1' : 'team2'),
            };
            // 準決賽敗方 → 季軍賽
            if (cfg.thirdPlace && r === cfg.finalRounds.length - 2) {
                match.loserNextMatch = 'F-3RD';
                match.loserNextSlot = k % 2 ? 'team1' : 'team2';
            }
            matches.push(match);
        }
    });

    if (cfg.thirdPlace) {
        const semis = cfg.finalRounds[cfg.finalRounds.length - 2];
        matches.push({
            matchId: 'F-3RD', group: 'Final', round: '3RD', index: 1,
            team1: { loser: finalId(semis, 1, 2) }, team2: { loser: finalId(semis, 2, 2) },
            nextMatch: null, nextSlot: null,
        });
    }
    return {
        groups,
        bracketRounds: Object.fromEntries([...groups.map(g => [g, cfg.groupRounds]), ['Final', cfg.finalRounds]]),
        matches,
    };
};

// 一場一行，方便在 GitHub 上閱讀
const format = (cfg, built) => {
    const head = {
        _note: cfg.note,
        _fields: `matchId：比賽編號（組別-輪次-第幾場；決賽階段是 F-QF-1、F-SF-1、F-F${cfg.thirdPlace ? '、F-3RD' : ''}，group 是 "Final"）。index：同一輪由上到下第幾場（左側先、右側後，同賽程圖）。${cfg.participants} nextMatch／nextSlot：勝者晉級到哪一場的哪一邊${cfg.thirdPlace ? '；loserNextMatch／loserNextSlot：敗者去季軍賽' : ''}。BYE 的場次不用比，另一邊自動晉級。`,
        event: cfg.event,
        groups: built.groups,
        seeds: cfg.seeds,
        bracketRounds: built.bracketRounds,
        roundNames: cfg.roundNames,
    };
    const lines = Object.entries(head).map(([key, value]) => `  ${JSON.stringify(key)}: ${JSON.stringify(value)},`);
    const body = built.matches.map((m, i) => `    ${JSON.stringify(m).replace(/":/g, '": ').replace(/,"/g, ', "')}${i < built.matches.length - 1 ? ',' : ''}`);
    return `{\n${lines.join('\n')}\n  "matches": [\n${body.join('\n')}\n  ]\n}\n`;
};

// 結果檔（比賽當天手動更新的那一份）：還不存在時才建立，列出所有要實際比的場次（BYE 不列），已存在就不動
const RESULTS = {
    'sf6-individual': 'data/sf6-individual-results.json',
    'sf6-team': 'data/sf6-team-results.json',
};
const writeResults = (cfg, built) => {
    const file = RESULTS[cfg.event];
    if (fs.existsSync(path.join(ROOT, file))) return console.log(`${file}：已存在，不覆寫`);
    const real = built.matches.filter(m => m.team1 !== null && m.team2 !== null);
    const head = [
        `  "_note": ${JSON.stringify(`${cfg.event === 'sf6-individual' ? 'SF6 個人賽' : 'SF6 團體賽'}比賽結果（比賽當天手動更新；網頁每 5 分鐘讀一次）。只記錄勝負，不記比分。改完可在本機執行 node tools/validate-results.js 檢查。`)},`,
        `  "_fields": ${JSON.stringify('currentGroup：目前進行中的組別（"A"…，決賽階段是 "Final"），沒有填 null。currentMatch：目前進行中的場次編號，沒有填 null。matches：status＝"scheduled"（尚未開始）／"live"（進行中，同時只能有一場，且要和 currentMatch 相同）／"completed"（已完成）；winner＝"team1"／"team2"（勝方，對應比賽結構裡的左右兩邊）或 null。填了 winner 就算完成、勝者自動晉級；對手還沒確定的場次不能先填 winner。BYE 的場次自動晉級，不用列在這裡。')},`,
        '  "currentGroup": null,',
        '  "currentMatch": null,',
        '  "matches": {',
        ...real.map((m, i) => `    ${JSON.stringify(m.matchId)}: { "status": "scheduled", "winner": null }${i < real.length - 1 ? ',' : ''}`),
        '  }',
    ];
    fs.writeFileSync(path.join(ROOT, file), `{\n${head.join('\n')}\n}\n`, 'utf8');
    console.log(`${file}：建立，${real.length} 場`);
};

EVENTS.forEach(cfg => {
    const built = build(cfg);
    fs.writeFileSync(path.join(ROOT, cfg.file), format(cfg, built), 'utf8');
    const byes = built.matches.filter(m => m.team1 === null || m.team2 === null).length;
    console.log(`${cfg.file}：${built.matches.length} 場（其中 BYE ${byes} 場、實際對戰 ${built.matches.length - byes} 場）`);
    writeResults(cfg, built);
});
