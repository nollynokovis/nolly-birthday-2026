// SF6 賽事邏輯（Match Logic）：比賽結構＋結果 → 每場的對戰雙方、勝方、晉級、組別進度、目前對戰
// 只做計算，不讀檔、不碰畫面：網頁（js/sf6-live.js）與驗證腳本（tools/validate-results.js）共用這一份，判斷規則一致
// 資料來源以後改成 D1 也不用改這裡，只要交進來的 structure／results 格式相同
//   structure：data/sf6-*-matches.json（tools/build-sf6-matches.js 產生）
//   results：data/sf6-*-results.json（{ currentGroup, currentMatch, matches: { 編號: { status, winner } } }）
//   isEntrant(id)：這個 ID 是不是有效的參賽者（個人賽＝players.json 的 id，團體賽＝隊伍編號 no）
// 問題回傳成 issues：{ level: 'error'|'warning', matchId?, message }；error 代表資料有錯（網頁會略過那個欄位或整份不套用，見各函式說明）
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.NollySF6Logic = factory();
})(typeof self !== 'undefined' ? self : this, () => {
    const STATUSES = ['scheduled', 'live', 'completed'];
    const SIDES = ['team1', 'team2'];

    const refOf = value => value && typeof value === 'object'
        ? (typeof value.winner === 'string' ? { role: 'winner', id: value.winner } : typeof value.loser === 'string' ? { role: 'loser', id: value.loser } : null)
        : null;

    // ── 結構檢查 ──────────────────────────────────────────────
    // matchId 唯一、參賽者 ID 有效、勝者／敗者引用存在、沒有循環引用、沒有 BYE 對 BYE、
    // nextMatch／nextSlot（以及 loserNextMatch／loserNextSlot）與下一場的引用互相對得上、每一場的勝者只被引用一次
    const checkStructure = (structure, isEntrant) => {
        const issues = [];
        const error = (message, matchId) => issues.push({ level: 'error', matchId, message });
        if (!structure || !Array.isArray(structure.matches)) {
            error('matches 不是陣列');
            return issues;
        }
        const defs = new Map();
        structure.matches.forEach(m => {
            if (!m || typeof m.matchId !== 'string' || !m.matchId) return error('有一場缺少 matchId');
            if (defs.has(m.matchId)) error(`matchId 重複：${m.matchId}`, m.matchId);
            defs.set(m.matchId, m);
            if (!(structure.groups || []).includes(m.group) && m.group !== 'Final') error(`${m.matchId} 的 group「${m.group}」不在 groups 裡`, m.matchId);
        });

        const winnerRefs = new Map();    // 被引用的場次 → 引用它的位置
        const loserRefs = new Map();
        defs.forEach(m => {
            SIDES.forEach(slot => {
                const value = m[slot];
                if (value === null) return;
                if (typeof value === 'number') {
                    if (!isEntrant(value)) error(`${m.matchId} 的 ${slot} 參賽者 ID ${value} 不存在`, m.matchId);
                    return;
                }
                const ref = refOf(value);
                if (!ref) return error(`${m.matchId} 的 ${slot} 看不懂：${JSON.stringify(value)}`, m.matchId);
                if (!defs.has(ref.id)) return error(`${m.matchId} 的 ${slot} 引用不存在的場次 ${ref.id}`, m.matchId);
                const map = ref.role === 'winner' ? winnerRefs : loserRefs;
                if (map.has(ref.id)) error(`${ref.id} 的${ref.role === 'winner' ? '勝者' : '敗者'}被引用了兩次（${map.get(ref.id)}、${m.matchId} ${slot}）`, m.matchId);
                map.set(ref.id, `${m.matchId} ${slot}`);
            });
            if (m.team1 === null && m.team2 === null) error(`${m.matchId} 是 BYE 對 BYE`, m.matchId);
            if ((m.team1 === null || m.team2 === null) && SIDES.some(slot => refOf(m[slot]))) error(`${m.matchId} 的 BYE 只能出現在第一輪（對手是引用）`, m.matchId);
        });

        // 晉級位置雙向對得上：A 的 nextMatch／nextSlot ＝ 下一場那一邊寫的 { winner: A }
        defs.forEach(m => {
            const check = (next, slot, role) => {
                const label = role === 'winner' ? 'nextMatch' : 'loserNextMatch';
                const target = defs.get(next);
                if (!target) return error(`${m.matchId} 的 ${label}「${next}」不存在`, m.matchId);
                const ref = refOf(target[slot]);
                if (!ref || ref.role !== role || ref.id !== m.matchId) error(`${m.matchId} 的 ${label} 是 ${next} ${slot}，但那一邊不是 { "${role}": "${m.matchId}" }`, m.matchId);
            };
            if (m.nextMatch != null) check(m.nextMatch, m.nextSlot, 'winner');
            else if (winnerRefs.has(m.matchId)) error(`${m.matchId} 沒有 nextMatch，但被 ${winnerRefs.get(m.matchId)} 引用`, m.matchId);
            if (m.loserNextMatch != null) check(m.loserNextMatch, m.loserNextSlot, 'loser');
            else if (loserRefs.has(m.matchId)) error(`${m.matchId} 沒有 loserNextMatch，但被 ${loserRefs.get(m.matchId)} 引用為敗者`, m.matchId);
            if (m.nextMatch != null && !winnerRefs.has(m.matchId)) error(`${m.matchId} 的勝者沒有被任何一場引用`, m.matchId);
        });

        // 循環引用
        const state = new Map();    // 1＝檢查中、2＝完成
        const visit = (id, path) => {
            if (state.get(id) === 2) return;
            if (state.get(id) === 1) return error(`循環引用：${[...path, id].join(' → ')}`, id);
            state.set(id, 1);
            const m = defs.get(id);
            SIDES.forEach(slot => {
                const ref = refOf(m[slot]);
                if (ref && defs.has(ref.id)) visit(ref.id, [...path, id]);
            });
            state.set(id, 2);
        };
        defs.forEach((m, id) => visit(id, []));
        return issues;
    };

    // ── 結果格式檢查 ──────────────────────────────────────────
    // 這裡的錯誤都是「整份不能用」：JSON 結構不對、場次編號打錯、status／winner 的值打錯
    // 網頁遇到時不套用這一次的資料、保留上一次成功的畫面
    const checkResultsShape = (results, structure) => {
        const issues = [];
        const error = (message, matchId) => issues.push({ level: 'error', matchId, message });
        if (!results || typeof results !== 'object' || Array.isArray(results)) {
            error('results 不是物件');
            return issues;
        }
        const ids = new Set(structure.matches.map(m => m.matchId));
        if (results.currentMatch != null && typeof results.currentMatch !== 'string') error('currentMatch 必須是場次編號字串或 null');
        if (results.currentGroup != null && typeof results.currentGroup !== 'string') error('currentGroup 必須是組別字串或 null');
        const matches = results.matches == null ? {} : results.matches;
        if (typeof matches !== 'object' || Array.isArray(matches)) {
            error('matches 不是物件');
            return issues;
        }
        Object.entries(matches).forEach(([id, r]) => {
            if (!ids.has(id)) return error(`matches 裡的「${id}」不是比賽結構裡的場次`, id);
            if (!r || typeof r !== 'object' || Array.isArray(r)) return error(`${id} 的內容不是物件`, id);
            if (r.status !== undefined && !STATUSES.includes(r.status)) error(`${id} 的 status「${r.status}」只能是 ${STATUSES.join('、')}`, id);
            if (r.winner != null && !SIDES.includes(r.winner)) error(`${id} 的 winner「${r.winner}」只能是 "team1"、"team2" 或 null`, id);
        });
        return issues;
    };

    // ── 計算 ──────────────────────────────────────────────────
    // 回傳 { matches: Map(編號 → 計算結果), groups: Map(組別 → 'scheduled'|'live'|'completed'), current, currentGroup, issues }
    // 每場的計算結果：{ def, sides: [Side, Side], status: 'bye'|'scheduled'|'live'|'completed', winner: 'team1'|'team2'|null, winnerSide, loserSide }
    // Side：{ kind: 'entrant', id } 已確定的參賽者｜{ kind: 'pending', role, ref } 還沒確定（某場的勝者／敗者）｜{ kind: 'bye' }｜{ kind: 'invalid' }
    // 規則：
    //   - BYE 的場次不用比：另一邊自動晉級（status 'bye'），results 裡寫了也不採用
    //   - 只有兩邊都已確定、winner 是 team1／team2 時才算正式結果（status 視為 completed），勝者晉級、敗者可被季軍賽引用
    //   - winner 已填但參賽者還沒確定 → 不採用（error）；status 寫 completed 但沒有勝方 → 當作尚未開始（error）
    //   - 不看時間、不用其他場次推測勝方
    const evaluate = (structure, results, isEntrant) => {
        const issues = [];
        const add = (level, message, matchId) => issues.push({ level, matchId, message });
        const defs = new Map(structure.matches.map(m => [m.matchId, m]));
        const entries = (results && results.matches && typeof results.matches === 'object') ? results.matches : {};
        const memo = new Map();
        const visiting = new Set();

        const sideOf = value => {
            if (value === null) return { kind: 'bye' };
            if (typeof value === 'number') return isEntrant(value) ? { kind: 'entrant', id: value } : { kind: 'invalid' };
            const ref = refOf(value);
            if (!ref || !defs.has(ref.id)) return { kind: 'invalid' };
            const from = evalMatch(ref.id);
            const side = from && (ref.role === 'winner' ? from.winnerSide : from.loserSide);
            if (side && side.kind === 'entrant') return { kind: 'entrant', id: side.id, role: ref.role, ref: ref.id };
            return { kind: 'pending', role: ref.role, ref: ref.id };
        };

        const evalMatch = id => {
            if (memo.has(id)) return memo.get(id);
            if (visiting.has(id)) {
                add('error', `循環引用經過 ${id}`, id);
                return null;
            }
            visiting.add(id);
            const def = defs.get(id);
            const sides = [sideOf(def.team1), sideOf(def.team2)];
            const entry = entries[id] && typeof entries[id] === 'object' ? entries[id] : {};
            let status;
            let winner = null;
            const byes = sides.map(s => s.kind === 'bye');
            if (byes[0] && byes[1]) {
                status = 'bye';
                add('error', `${id} 是 BYE 對 BYE`, id);
            } else if (byes[0] || byes[1]) {
                status = 'bye';
                winner = byes[0] ? 'team2' : 'team1';
                if (entry.winner != null || (entry.status && entry.status !== 'scheduled')) add('warning', `${id} 是 BYE（自動晉級），results 裡的資料不會採用`, id);
            } else {
                const ready = sides.every(s => s.kind === 'entrant');
                const declared = STATUSES.includes(entry.status) ? entry.status : 'scheduled';
                if (SIDES.includes(entry.winner)) {
                    if (ready) {
                        winner = entry.winner;
                        status = 'completed';
                        if (declared !== 'completed') add('warning', `${id} 已填勝方，但 status 是 ${declared}（視為已完成）`, id);
                    } else {
                        status = declared === 'completed' ? 'scheduled' : declared;
                        add('error', `${id} 的參賽者還沒確定，不能先設定勝方（這個勝方不會採用）`, id);
                    }
                } else if (declared === 'completed') {
                    status = 'scheduled';
                    add('error', `${id} 的 status 是 completed，但沒有有效的勝方（視為尚未開始）`, id);
                } else {
                    status = declared;
                }
            }
            const at = side => side === 'team1' ? 0 : 1;
            const result = {
                def, sides, status, winner,
                winnerSide: winner ? sides[at(winner)] : null,
                loserSide: winner && status === 'completed' ? sides[1 - at(winner)] : null,
            };
            visiting.delete(id);
            memo.set(id, result);
            return result;
        };

        defs.forEach((def, id) => evalMatch(id));
        const matches = new Map([...defs.keys()].map(id => [id, memo.get(id)]));

        // 目前對戰：currentMatch 指到不存在的場次就當作沒有（不顯示錯的對戰）
        const currentId = results && typeof results.currentMatch === 'string' ? results.currentMatch : null;
        let current = null;
        if (currentId) {
            if (matches.has(currentId)) current = matches.get(currentId);
            else add('error', `currentMatch「${currentId}」不存在`);
        }
        const groupNames = [...(structure.groups || []), 'Final'];
        const currentGroup = results && typeof results.currentGroup === 'string' ? results.currentGroup : null;
        if (currentGroup && !groupNames.includes(currentGroup)) add('error', `currentGroup「${currentGroup}」不是有效的組別（${groupNames.join('、')}）`);
        if (current && currentGroup && current.def.group !== currentGroup) add('warning', `currentGroup 是 ${currentGroup}，但 currentMatch ${currentId} 在 ${current.def.group}`);
        if (current && current.status === 'bye') add('warning', `currentMatch ${currentId} 是 BYE，不用比`);

        // LIVE 狀態不能互相矛盾：同時只能有一場 live，而且要和 currentMatch 一致
        const live = [...matches.values()].filter(m => m.status === 'live').map(m => m.def.matchId);
        if (live.length > 1) add('error', `同時有 ${live.length} 場是 live：${live.join('、')}`);
        if (live.length >= 1 && !live.includes(currentId)) add('error', `${live.join('、')} 是 live，但 currentMatch 是 ${currentId || 'null'}`);

        // 組別進度：所有要實際比的場次（BYE 不算）都有正式勝方＝完成；有場次在進行、已有結果或 currentGroup 是這組＝進行中
        const groups = new Map(groupNames.map(group => {
            const real = [...matches.values()].filter(m => m.def.group === group && m.status !== 'bye');
            if (real.length === 0) return [group, 'scheduled'];
            if (real.every(m => m.status === 'completed')) return [group, 'completed'];
            if (currentGroup === group || real.some(m => m.status === 'live' || m.status === 'completed')) return [group, 'live'];
            return [group, 'scheduled'];
        }));

        return { matches, groups, current, currentId, currentGroup, issues };
    };

    // ── 前後兩次結果比較 ──────────────────────────────────────
    // 修改上一輪的結果會讓後面已完成的比賽換了對手：列出這些場次（勝方 team1／team2 指的人已經不同）
    const affectedMatches = (before, after) => {
        const out = [];
        after.matches.forEach((m, id) => {
            const old = before.matches.get(id);
            if (!old || old.status !== 'completed' || m.status === 'bye') return;
            const ids = s => s.kind === 'entrant' ? s.id : null;
            const changed = [0, 1].some(i => ids(old.sides[i]) !== ids(m.sides[i]));
            if (changed) out.push({ matchId: id, before: old.sides.map(ids), after: m.sides.map(ids) });
        });
        return out;
    };

    return { STATUSES, SIDES, checkStructure, checkResultsShape, evaluate, affectedMatches };
});
