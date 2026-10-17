// 換頁載入動畫：只在網站第一次打開，以及「語言切換」、「首頁 ⇄ 賽程／參賽者／規則／周邊」、「參賽者 → 賽程」時出現，其他換頁都不顯示；
// 這類換頁兩次相隔不到 2 秒時，第二次不顯示（其他換頁不列入計算）
// 點連結時淡入蓋住換頁前的空白，並在 sessionStorage 記下目的頁；
// 目的頁由 <head> 內的小段程式加上 html.show-loader，進度約 1.5 秒從 0% 跑到 100% 後淡出
// 放在檔案最前面，後面的程式出錯也不會讓載入畫面一直擋著
const LOADER_KEY = 'nollyLoader';
const LOADER_HUB_PAGES = ['schedule-valo', 'schedule-sf6', 'teams', 'players', 'rules', 'goods'];
const LOADER_COOLDOWN_MS = 2000;
const LOADER_LAST_KEY = 'nollyLoaderLast';

// 網站第一次打開（這個分頁還沒有 nollyVisited）時 <head> 的程式也會顯示載入畫面；
// 檔案頁沒有那段程式，這裡補記，之後換到其他頁不會再被當成第一次打開
try { sessionStorage.setItem('nollyVisited', '1'); } catch (e) {}

// 路徑 → 頁名與語言，例如 /schedule-valo-en.html → { name: 'schedule-valo-en', base: 'schedule-valo', lang: '-en' }
const pageInfo = pathname => {
    const name = pathname.split('/').pop().replace(/\.html$/, '') || 'index';
    const m = name.match(/^(.*?)(-en|-ja)?$/);
    return { name, base: m[1], lang: m[2] || '' };
};

const wantsLoader = (from, to) => {
    if (from.base === to.base) return from.lang !== to.lang;
    // 從隊伍／參賽者介紹回到賽程
    if (['teams', 'players'].includes(from.base) && to.base.startsWith('schedule-')) return true;
    return (from.base === 'index' && LOADER_HUB_PAGES.includes(to.base))
        || (to.base === 'index' && LOADER_HUB_PAGES.includes(from.base));
};

const pageLoader = document.querySelector('.page-loader');
if (pageLoader) {
    const LOADER_MS = 1500;
    const root = document.documentElement;
    const loaderBar = pageLoader.querySelector('.page-loader-progress span');
    const loaderNum = pageLoader.querySelector('.page-loader-num');
    let loaderFrame = 0;
    let loaderTimer = 0;

    const setProgress = p => {
        if (loaderBar) loaderBar.style.clipPath = `inset(0 ${100 - p}% 0 0 round 999px)`;
        if (loaderNum) loaderNum.textContent = p + '%';
    };

    const hideLoader = () => {
        cancelAnimationFrame(loaderFrame);
        clearTimeout(loaderTimer);
        root.classList.remove('show-loader');
        pageLoader.classList.remove('is-leaving');
    };

    // 先快後慢（ease-out），到 100% 後停一下再淡出
    if (root.classList.contains('show-loader')) {
        const loaderStart = performance.now();
        const tick = now => {
            const t = Math.min(Math.max((now - loaderStart) / LOADER_MS, 0), 1);
            setProgress(Math.round((1 - (1 - t) * (1 - t)) * 100));
            if (t < 1) loaderFrame = requestAnimationFrame(tick);
            else loaderTimer = setTimeout(hideLoader, 150);
        };
        loaderFrame = requestAnimationFrame(tick);
    }

    // 按上一頁／下一頁從快取還原時，載入畫面還停在離開前的狀態，要收起來
    window.addEventListener('pageshow', e => { if (e.persisted) hideLoader(); });

    document.addEventListener('click', e => {
        const a = e.target.closest('a[href]');
        if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        if ((a.target && a.target !== '_self') || a.hasAttribute('download')) return;

        const url = new URL(a.href, location.href);
        if (url.protocol !== location.protocol || url.origin !== location.origin) return;
        const to = pageInfo(url.pathname);
        if (!wantsLoader(pageInfo(location.pathname), to)) return;

        // 記下這次換頁的時間；和上一次會顯示載入畫面的換頁相隔不到 2 秒就不顯示
        const now = Date.now();
        let last = 0;
        try {
            last = Number(sessionStorage.getItem(LOADER_LAST_KEY)) || 0;
            sessionStorage.setItem(LOADER_LAST_KEY, String(now));
        } catch (err) {}
        if (now - last < LOADER_COOLDOWN_MS) return;

        try { sessionStorage.setItem(LOADER_KEY, to.name); } catch (err) {}
        cancelAnimationFrame(loaderFrame);
        clearTimeout(loaderTimer);
        setProgress(0);
        root.classList.remove('show-loader');
        pageLoader.classList.add('is-leaving');
        // 換頁被取消（例如按了停止）時不要一直擋著
        loaderTimer = setTimeout(hideLoader, 10000);
    });
}

const navbar      = document.getElementById('navbar');
const heroOverlay = document.getElementById('heroOverlay');
const heroContent = document.querySelector('.hero-content');

const MAX_OVERLAY = 0.82;

window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;
    const h = window.innerHeight;

    // nav 背景
    navbar.style.background = scrollY > 40
        ? 'rgba(40, 43, 66, 0.98)'
        : 'rgba(40, 43, 66, 0.92)';


    // 以下只在有 hero 區塊的首頁執行
    if (!heroOverlay || !heroContent) return;

    // 背景漸暗：0 ~ 0.6vh 達到最暗，之後收斂
    heroOverlay.style.opacity = Math.min(scrollY / (h * 0.6), 1) * MAX_OVERLAY;

    // 大海報淡入：0.8vh ~ 1.1vh 之間從 0 到 1
    heroContent.style.opacity = Math.min(Math.max((scrollY - h * 0.8) / (h * 0.3), 0), 1);
});

// mobile nav toggle
const navToggle = document.getElementById('navToggle');
const navLinks  = document.getElementById('navLinks');
navToggle.addEventListener('click', () => navLinks.classList.toggle('open'));
navLinks.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => navLinks.classList.remove('open'));
});

// 語言選單：點擊切換（手機與鍵盤無法依賴 hover），點外面或按 Esc 關閉
document.querySelectorAll('.language-dropdown').forEach(dropdown => {
    const btn = dropdown.querySelector('.language-btn');
    btn.setAttribute('aria-haspopup', 'true');
    btn.setAttribute('aria-expanded', 'false');

    const setOpen = open => {
        dropdown.classList.toggle('open', open);
        btn.setAttribute('aria-expanded', String(open));
    };

    btn.addEventListener('click', e => {
        e.stopPropagation();
        setOpen(!dropdown.classList.contains('open'));
    });
    document.addEventListener('click', e => {
        if (!dropdown.contains(e.target)) setOpen(false);
    });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') setOpen(false);
    });
});

// Group buttons for schedule images (each button row controls the image container in the same block)
document.querySelectorAll('.group-buttons').forEach(row => {
    const buttons = row.querySelectorAll('.group-btn');
    const images = row.parentElement.querySelectorAll('.schedule-image-container img');
    if (buttons.length === 0 || images.length === 0) return;

    buttons[0].classList.add('active');
    images[0].classList.add('active');

    // Lazy images under display:none never load, so preload the other groups once the first one has loaded
    const preloadAll = () => images.forEach(img => { img.loading = 'eager'; });
    if (images[0].complete) preloadAll();
    else images[0].addEventListener('load', preloadAll, { once: true });

    buttons.forEach((button, index) => {
        button.addEventListener('click', () => {
            buttons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            // Keep the current image visible until the target is decoded, so there's no blank flash
            const target = images[index];
            target.loading = 'eager';
            const show = () => {
                if (!button.classList.contains('active')) return;
                images.forEach(img => img.classList.remove('active'));
                target.classList.add('active');
            };
            target.decode().then(show, show);
        });
    });
});
