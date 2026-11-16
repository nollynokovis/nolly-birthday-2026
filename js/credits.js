// THANK YOU 工作人員・賽評名單（首頁 #thanks）：讀 data/credits.json，依比賽分開顯示（左 VALORANT、右 SF6），每個賽事分 STAFF／COMMENTATORS 兩組，
//   另外有不分賽事的 SPECIAL THANKS；名單全部是空的時候，整個區塊維持隱藏（HTML 上有 hidden），沒有資料的分組不顯示
//   名字各語系共用不翻譯；每個人可以是文字，或 { name, role }（role 是文字或 { zh, ja, en }）
(() => {
    const section = document.getElementById('thanks');
    const mount = document.getElementById('credits-mount');
    if (!section || !mount) return;

    const CREDITS_URL = 'data/credits.json';

    const I18N = {
        zh: { staff: ['工作人員', 'STAFF'], commentators: ['賽評', 'COMMENTATORS'], specialThanks: ['特別感謝', 'SPECIAL THANKS'] },
        ja: { staff: ['スタッフ', 'STAFF'], commentators: ['解説', 'COMMENTATORS'], specialThanks: ['スペシャルサンクス', 'SPECIAL THANKS'] },
        en: { staff: ['STAFF'], commentators: ['COMMENTATORS'], specialThanks: ['SPECIAL THANKS'] },
    };
    const lang = document.documentElement.lang;
    const code = lang.startsWith('ja') ? 'ja' : lang.startsWith('en') ? 'en' : 'zh';
    const t = I18N[code];
    const EVENTS = [['valorant', 'VALORANT', 'is-valo'], ['sf6', 'STREET FIGHTER 6', 'is-sf6']];

    const el = (tag, className, text) => {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    };

    const peopleOf = list => (Array.isArray(list) ? list : [])
        .map(person => typeof person === 'string' ? { name: person } : person)
        .filter(person => person && person.name);
    const roleOf = role => role && typeof role === 'object' ? role[code] || role.zh || role.en || '' : role || '';

    const groupOf = (key, people) => {
        const group = el('div', 'credits-group');
        const title = el('h4', 'credits-title');
        const [local, english] = t[key];
        title.append(el('span', '', local));
        if (english) title.append(el('span', 'credits-title-en', english));
        const list = el('ul', 'credits-list');
        people.forEach(person => {
            const item = el('li', 'credits-item');
            item.append(el('span', 'credit-name', person.name));
            const role = roleOf(person.role);
            if (role) item.append(el('span', 'credit-role', role));
            list.append(item);
        });
        group.append(title, list);
        return group;
    };

    fetch(CREDITS_URL, { cache: 'no-cache' })
        .then(res => {
            if (!res.ok) throw new Error(`${CREDITS_URL}: HTTP ${res.status}`);
            return res.json();
        })
        .then(data => {
            const columns = EVENTS.map(([key, game, theme]) => {
                const groups = ['staff', 'commentators']
                    .map(role => [role, peopleOf((data[key] || {})[role])])
                    .filter(([, people]) => people.length)
                    .map(([role, people]) => groupOf(role, people));
                if (!groups.length) return null;
                const column = el('div', `credits-col ${theme}`);
                column.append(el('h3', 'credits-game', game), ...groups);
                return column;
            }).filter(Boolean);
            const nodes = [];
            if (columns.length) {
                const row = el('div', 'credits-columns');
                row.append(...columns);
                nodes.push(row);
            }
            const special = peopleOf(data.specialThanks);
            if (special.length) nodes.push(groupOf('specialThanks', special));
            if (!nodes.length) return;
            mount.replaceChildren(...nodes);
            section.hidden = false;
        })
        .catch(err => console.error(err));
})();