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

// Group buttons for schedule images (each button row controls the image container in the same block)
document.querySelectorAll('.group-buttons').forEach(row => {
    const buttons = row.querySelectorAll('.group-btn');
    const images = row.parentElement.querySelectorAll('.schedule-image-container img');
    if (buttons.length === 0 || images.length === 0) return;

    buttons[0].classList.add('active');
    images[0].classList.add('active');

    buttons.forEach((button, index) => {
        button.addEventListener('click', () => {
            buttons.forEach(btn => btn.classList.remove('active'));
            images.forEach(img => img.classList.remove('active'));
            button.classList.add('active');
            images[index].classList.add('active');
        });
    });
});

// Group bracket selector
const groupSelectorBtns = document.querySelectorAll('.group-selector-btn');
const groupBrackets = document.querySelectorAll('.group-bracket');

if (groupSelectorBtns.length > 0) {
    groupSelectorBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const group = btn.dataset.group;

            // Remove active from all buttons and brackets
            groupSelectorBtns.forEach(b => b.classList.remove('active'));
            groupBrackets.forEach(b => b.classList.remove('active-bracket'));

            // Add active to clicked button and corresponding bracket
            btn.classList.add('active');
            const bracket = document.getElementById(`groupBracket${group}`);
            if (bracket) {
                bracket.classList.add('active-bracket');
            }
        });
    });

    // Randomize BYE positions for all groups
    function randomizeBYEs() {
        groupBrackets.forEach(bracket => {
            const byeElements = bracket.querySelectorAll('.bye-text');
            if (byeElements.length === 0) return;

            // Create array of indices for BYE positions
            const byeIndices = Array.from({length: byeElements.length}, (_, i) => i);

            // Shuffle to get random positions
            for (let i = byeIndices.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [byeIndices[i], byeIndices[j]] = [byeIndices[j], byeIndices[i]];
            }

            // Randomly determine how many BYEs to show (2-4 per group)
            const byeCount = Math.floor(Math.random() * 3) + 2;
            const selectedByeIndices = byeIndices.slice(0, byeCount);

            byeElements.forEach((element, index) => {
                if (selectedByeIndices.includes(index)) {
                    element.textContent = 'BYE';
                    element.parentElement.style.opacity = '1';
                } else {
                    element.textContent = '選手X';
                    element.parentElement.style.opacity = '0.5';
                }
            });
        });
    }

    randomizeBYEs();
}
