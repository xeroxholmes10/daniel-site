/* V3 reveal — IntersectionObserver de verdade: cada elemento aparece quando
   entra na viewport, com fade + rise. Sem o force-reveal prematuro que
   desligava o efeito em páginas longas. Mantém os parallax da V1. */

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* footer year */
const yr = document.getElementById("yr");
if (yr) yr.textContent = new Date().getFullYear();

/* --- reveal on enter --- */
const reveals = Array.from(document.querySelectorAll(".reveal"));

if (reduceMotion || !("IntersectionObserver" in window)) {
  reveals.forEach((el) => el.classList.add("is-visible"));
} else {
  const io = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const el = e.target;
        const sibs = Array.from(el.parentElement.children).filter((c) =>
          c.classList.contains("reveal")
        );
        const i = sibs.indexOf(el);
        el.style.transitionDelay = `${Math.min(i * 90, 360)}ms`;
        el.classList.add("is-visible");
        obs.unobserve(el);
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -10% 0px" }
  );
  reveals.forEach((el) => io.observe(el));
}

/* sinaliza pro fallback do v3.html que o motor de reveal real rodou —
   assim a rede de segurança só força reveal se este módulo não carregar */
document.documentElement.dataset.revealReady = "1";

/* --- placeholder fallbacks (foto sobre / ação) --- */
function guardPhoto(frameSel, photoSel) {
  const frame = document.querySelector(frameSel);
  const photo = document.querySelector(photoSel);
  if (!frame || !photo) return;
  const markEmpty = () => frame.classList.add("is-empty");
  if (photo.complete && photo.naturalWidth === 0) markEmpty();
  photo.addEventListener("error", markEmpty);
}
guardPhoto(".about__frame", ".about__photo");
guardPhoto(".action__media", ".action__photo");

/* --- carrosséis mobile (Perfis, Benefícios): dots acompanham o card centralizado --- */
function initCarouselDots(gridSel, dotsSel) {
  const grid = document.querySelector(gridSel);
  const dots = document.querySelectorAll(dotsSel);
  if (!grid || !dots.length) return;
  let ticking = false;
  grid.addEventListener(
    "scroll",
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const cards = Array.from(grid.children);
        const center = grid.scrollLeft + grid.clientWidth / 2;
        let closest = 0, min = Infinity;
        cards.forEach((c, i) => {
          const d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - center);
          if (d < min) { min = d; closest = i; }
        });
        dots.forEach((d, i) => d.classList.toggle("is-active", i === closest));
        ticking = false;
      });
    },
    { passive: true }
  );
}
initCarouselDots(".perfis__grid", ".perfis__dots span");
initCarouselDots(".benefits__cards", ".bcard__dots span");

/* --- setas dos carrosséis mobile: quando o swipe não pega, o botão navega --- */
document.querySelectorAll(".carousel__arrow").forEach((btn) => {
  btn.addEventListener("click", () => {
    const grid = document.querySelector(btn.dataset.carousel);
    if (!grid) return;
    const card = grid.children[0];
    const gap = parseFloat(getComputedStyle(grid).columnGap || getComputedStyle(grid).gap || "0");
    const step = card.getBoundingClientRect().width + gap;
    const dir = btn.classList.contains("carousel__arrow--prev") ? -1 : 1;
    grid.scrollBy({ left: step * dir, behavior: "smooth" });
  });
});

/* --- parallax cinematográfico da seção Acompanhamento --- */
const actionMedia = document.querySelector(".action__media");
const actionSection = document.querySelector(".action");
if (actionMedia && actionSection && !reduceMotion) {
  const tick = () => {
    const r = actionSection.getBoundingClientRect();
    const vh = window.innerHeight || 1;
    const progress = (r.top + r.height / 2 - vh / 2) / vh;
    actionMedia.style.transform = `translateY(${progress * -34}px)`;
    requestAnimationFrame(tick);
  };
  tick();
}

/* --- parallax sutil da foto do Daniel (scroll + mouse + breathing) ---
   Só no desktop: a rodada de otimização mobile pede zero rAF/parallax lá. */
const frame = document.querySelector(".about__frame");
const aboutSection = document.querySelector(".about");
const isDesktop = matchMedia("(min-width: 861px)").matches;
if (frame && aboutSection && !reduceMotion && isDesktop) {
  let mx = 0, my = 0, cx = 0, cy = 0;
  aboutSection.addEventListener("pointermove", (e) => {
    const r = aboutSection.getBoundingClientRect();
    mx = ((e.clientX - r.left) / r.width - 0.5) * 2;
    my = ((e.clientY - r.top) / r.height - 0.5) * 2;
  });
  aboutSection.addEventListener("pointerleave", () => { mx = 0; my = 0; });
  const t0 = performance.now();
  const tick = () => {
    const r = frame.getBoundingClientRect();
    const vh = window.innerHeight || 1;
    const progress = (r.top + r.height / 2 - vh / 2) / vh;
    const scrollShift = progress * -8;
    const t = (performance.now() - t0) / 1000;
    const idle = Math.sin(t * 0.5) * 1.5;
    cx += (mx - cx) * 0.04;
    cy += (my - cy) * 0.04;
    frame.style.transform = `translate3d(${cx * 3}px, ${scrollShift + cy * 3 + idle}px, 0)`;
    requestAnimationFrame(tick);
  };
  tick();
}
