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
}, { passive: true });
