document.addEventListener("DOMContentLoaded", function () {

    const slides = document.querySelectorAll(".slide");
    const dots = document.querySelectorAll(".dot");

    const prevButton = document.querySelector(".prev");
    const nextButton = document.querySelector(".next");

    let currentSlide = 0;
    let timer;

    function showSlide(index) {

        if (index >= slides.length) {
            index = 0;
        }

        if (index < 0) {
            index = slides.length - 1;
        }

        slides[currentSlide].classList.remove("active");
        dots[currentSlide].classList.remove("active");

        currentSlide = index;

        slides[currentSlide].classList.add("active");
        dots[currentSlide].classList.add("active");
    }

    function nextSlide() {
        showSlide(currentSlide + 1);
        resetTimer();
    }

    function prevSlide() {
        showSlide(currentSlide - 1);
        resetTimer();
    }

    function startTimer() {
        timer = setInterval(function () {
            showSlide(currentSlide + 1);
        }, 5000);
    }

    function resetTimer() {
        clearInterval(timer);
        startTimer();
    }

    nextButton.addEventListener("click", nextSlide);
    prevButton.addEventListener("click", prevSlide);

    dots.forEach(function (dot, index) {
        dot.addEventListener("click", function () {
            showSlide(index);
            resetTimer();
        });
    });

    startTimer();
});