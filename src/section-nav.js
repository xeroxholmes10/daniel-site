/* persistent right-side section-nav (lobod-style): one dot per section, the
   active section shows filled + its label, the rest are small hollow dots.
   Uses rAF position polling (not IntersectionObserver/scroll events) — the
   same pattern already proven reliable in reveal.js. */

const sections = Array.from(document.querySelectorAll("[data-nav]"));
const nav = document.getElementById("sectionNav");
if (nav && sections.length) {
  nav.innerHTML = sections
    .map(
      (s, i) => `
      <button class="section-nav__item" data-i="${i}" aria-label="${s.dataset.nav}">
        <span class="section-nav__dot"></span>
        <span class="section-nav__label">${s.dataset.nav}</span>
      </button>`
    )
    .join("");

  const items = Array.from(nav.querySelectorAll(".section-nav__item"));
  items.forEach((btn, i) => {
    btn.addEventListener("click", () => {
      sections[i].scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  let activeIndex = -1;
  function update() {
    const line = window.innerHeight * 0.5; // section crossing viewport middle = active
    let idx = 0;
    for (let i = 0; i < sections.length; i++) {
      if (sections[i].getBoundingClientRect().top <= line) idx = i;
    }
    if (idx !== activeIndex) {
      activeIndex = idx;
      items.forEach((btn, i) => btn.classList.toggle("is-active", i === idx));
    }
    requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}
