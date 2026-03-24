const toggle = document.querySelector(".nav-toggle");
const nav = document.getElementById("primary-nav");

toggle.addEventListener("click", () => {
  const open = nav.classList.toggle("open");
  toggle.classList.toggle("open");
  toggle.setAttribute("aria-expanded", open);
});

// Image slider
const sliders = document.querySelectorAll(".slider");

sliders.forEach((slider) => {
  const track = slider.querySelector(".slider-track");
  const dots = slider.querySelectorAll(".dot");
  let current = 0;
  const total = slider.querySelectorAll(".slide").length;

  function goTo(index) {
    current = (index + total) % total;
    track.style.transform = `translateX(-${current * 100}%)`;
    dots.forEach((d, i) => d.classList.toggle("active", i === current));
  }

  slider
    .querySelector(".prev")
    ?.addEventListener("click", () => goTo(current - 1));
  slider
    .querySelector(".next")
    ?.addEventListener("click", () => goTo(current + 1));
  dots.forEach((dot, i) => dot.addEventListener("click", () => goTo(i)));
});
