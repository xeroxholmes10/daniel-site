/* Daniel Magalhães — V2 · interações (sem dependências) */

/* ---- ano no footer ---- */
const yr = document.getElementById("yr");
if (yr) yr.textContent = new Date().getFullYear();

/* ---- header sticky ao scroll ---- */
const header = document.getElementById("siteHeader");
const stickyCta = document.getElementById("stickyCta");
const onScroll = () => {
  const y = window.scrollY;
  header?.classList.toggle("is-stuck", y > 40);
  stickyCta?.classList.toggle("is-visible", y > 640);
};
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

/* ---- menu mobile ---- */
const toggle = document.getElementById("navToggle");
const menu = document.getElementById("mobileMenu");
if (toggle && menu) {
  const setOpen = (open) => {
    toggle.setAttribute("aria-expanded", String(open));
    menu.hidden = !open;
  };
  toggle.addEventListener("click", () =>
    setOpen(toggle.getAttribute("aria-expanded") !== "true")
  );
  menu.querySelectorAll("a").forEach((a) =>
    a.addEventListener("click", () => setOpen(false))
  );
}

/* ---- reveal on scroll ---- */
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const revealEls = document.querySelectorAll(".reveal");
if (reduce || !("IntersectionObserver" in window)) {
  revealEls.forEach((el) => el.classList.add("is-in"));
} else {
  const io = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const el = e.target;
        const siblings = [...el.parentElement.children].filter((c) =>
          c.classList.contains("reveal")
        );
        const idx = siblings.indexOf(el);
        el.style.transitionDelay = `${Math.min(idx, 5) * 80}ms`;
        el.classList.add("is-in");
        obs.unobserve(el);
      });
    },
    { threshold: 0.14, rootMargin: "0px 0px -8% 0px" }
  );
  revealEls.forEach((el) => io.observe(el));
}

/* ---- FAQ: fecha os outros ao abrir um (accordion) ---- */
const faqItems = document.querySelectorAll(".faq__item");
faqItems.forEach((item) => {
  item.addEventListener("toggle", () => {
    if (item.open) {
      faqItems.forEach((o) => {
        if (o !== item) o.open = false;
      });
    }
  });
});
