/* scroll-reveal + subtle parallax for the sections below the hero.
   Uses a scroll-position check (NOT IntersectionObserver) so it fires reliably
   in every browser. Independent from the particle hero (main.js). */

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* footer year */
const yr = document.getElementById("yr");
if (yr) yr.textContent = new Date().getFullYear();

/* --- reveal: fade + rise in as each element scrolls into view --- */
const reveals = Array.from(document.querySelectorAll(".reveal"));

if (reduceMotion) {
  reveals.forEach((el) => el.classList.add("is-visible"));
} else {
  // stagger elements that share a parent so they cascade in
  const seen = new Map();
  reveals.forEach((el) => {
    const p = el.parentElement;
    const i = seen.get(p) || 0;
    seen.set(p, i + 1);
    el.style.transitionDelay = `${Math.min(i * 90, 360)}ms`;
  });

  // rAF poll: check positions every frame. Does NOT rely on scroll events or
  // IntersectionObserver (both proved unreliable in some environments); rAF is
  // the same mechanism the particle hero uses, so it always runs.
  const checkLoop = () => {
    const trigger = window.innerHeight * 0.86;
    for (let i = reveals.length - 1; i >= 0; i--) {
      const el = reveals[i];
      const r = el.getBoundingClientRect();
      if (r.top < trigger && r.bottom > 0) {
        el.classList.add("is-visible");
        reveals.splice(i, 1); // reveal once, then stop tracking it
      }
    }
    if (reveals.length > 0) requestAnimationFrame(checkLoop);
  };
  requestAnimationFrame(checkLoop);

  // safety net: never leave content stuck invisible if position-detection fails
  // in some browser/environment — force-reveal anything still hidden after 3s
  setTimeout(() => {
    document.querySelectorAll(".reveal:not(.is-visible)").forEach((el) => {
      el.classList.add("is-visible");
    });
  }, 3000);
}

/* --- photo placeholder fallback: show the hint only if the image fails --- */
const aboutFrame = document.querySelector(".about__frame");
const aboutPhoto = document.querySelector(".about__photo");
if (aboutFrame && aboutPhoto) {
  const markEmpty = () => aboutFrame.classList.add("is-empty");
  if (aboutPhoto.complete && aboutPhoto.naturalWidth === 0) markEmpty();
  aboutPhoto.addEventListener("error", markEmpty);
}

/* --- section 07 cinematic photo: placeholder fallback + slow scroll parallax --- */
const actionMedia = document.querySelector(".action__media");
const actionPhoto = document.querySelector(".action__photo");
if (actionMedia && actionPhoto) {
  const markEmpty = () => actionMedia.classList.add("is-empty");
  if (actionPhoto.complete && actionPhoto.naturalWidth === 0) markEmpty();
  actionPhoto.addEventListener("error", markEmpty);
  if (!reduceMotion) {
    const section = document.querySelector(".action");
    function actTick() {
      const r = section.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const progress = (r.top + r.height / 2 - vh / 2) / vh; // -1..1
      actionMedia.style.transform = `translateY(${progress * -34}px)`;
      requestAnimationFrame(actTick);
    }
    actTick();
  }
}

/* --- gentle parallax: photo drifts on scroll + reacts subtly to the mouse --- */
const frame = document.querySelector(".about__frame");
if (frame && !reduceMotion) {
  let mx = 0;
  let my = 0;

  const aboutSection = document.querySelector(".about");
  aboutSection.addEventListener("pointermove", (e) => {
    const r = aboutSection.getBoundingClientRect();
    mx = ((e.clientX - r.left) / r.width - 0.5) * 2;
    my = ((e.clientY - r.top) / r.height - 0.5) * 2;
  });
  aboutSection.addEventListener("pointerleave", () => {
    mx = 0;
    my = 0;
  });

  let cx = 0;
  let cy = 0;
  const t0 = performance.now();
  function tick() {
    // VERY light movement — barely perceptible drift once the photo is settled
    const r = frame.getBoundingClientRect();
    const vh = window.innerHeight || 1;
    const progress = (r.top + r.height / 2 - vh / 2) / vh; // -1..1, 0 = centered
    const scrollShift = progress * -8; // gentle scroll parallax
    const t = (performance.now() - t0) / 1000;
    const idle = Math.sin(t * 0.5) * 1.5; // slow breathing float
    cx += (mx - cx) * 0.04; // slower easing = softer
    cy += (my - cy) * 0.04;
    frame.style.transform = `translate3d(${cx * 3}px, ${scrollShift + cy * 3 + idle}px, 0)`;
    requestAnimationFrame(tick);
  }
  tick();
}
