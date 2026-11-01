// 賽事資料來源（Data Source）：讀取 data/*.json，並每 5 分鐘（300 秒）檢查一次有沒有更新
// 畫面（js/match-schedule.js、js/sf6-live.js）只拿到解析好的資料，不自己 fetch；以後改成 D1 API 只要換這一支
//   NollyLive.load(url)：讀一次（隊伍、選手、抽籤這類當天不會變的資料）
//   NollyLive.watch(url, { onData, onError })：定期讀取
//     - 網址加時間參數＋cache: no-store，不會拿到瀏覽器或 Cloudflare 的舊檔
//     - 同時只有一個請求；檔案內容沒變就不呼叫 onData（畫面不重畫）
//     - onData 丟出錯誤（例如資料驗證不過）＝這次不算成功，畫面保留上一次的資料，下一輪再試；失敗原因交給 onError
//     - 分頁在背景時暫停，回到頁面（或按上一頁從快取還原）時立刻檢查；只有一個計時器
//     - 路徑以目前頁面為基準解析（各語系的賽程頁都在網站根目錄，Cloudflare Pages 不帶 .html 的網址也一樣）
(() => {
    const POLL_MS = 300 * 1000;    // 檢查間隔：5 分鐘（要調整只改這裡，所有賽事頁一起生效）

    const load = url => fetch(url, { cache: 'no-cache' }).then(res => {
        if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
        return res.json();
    });

    const watch = (url, { onData, onError = err => console.error(err), interval = POLL_MS }) => {
        let lastText = null;
        let inFlight = null;
        let timer = 0;

        const check = () => inFlight || (inFlight = (async () => {
            try {
                const target = new URL(url, document.baseURI);
                target.searchParams.set('t', Date.now());
                const res = await fetch(target.href, { cache: 'no-store' });
                if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
                const text = await res.text();
                if (text === lastText) return;
                await onData(JSON.parse(text));
                lastText = text;
            } catch (err) {
                onError(err);
            } finally {
                inFlight = null;
            }
        })());

        const poll = () => {
            clearTimeout(timer);
            timer = 0;
            return check().finally(() => {
                clearTimeout(timer);
                timer = document.hidden ? 0 : setTimeout(poll, interval);
            });
        };

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                clearTimeout(timer);
                timer = 0;
            } else {
                poll();
            }
        });
        window.addEventListener('pageshow', e => { if (e.persisted) poll(); });
        poll();
        return { refresh: poll };
    };

    window.NollyLive = { load, watch, POLL_MS };
})();
