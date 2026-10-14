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
