/* Seção 09 — Perguntas que importam.
   Scroll-driven: a pergunta que cruza a faixa central da viewport fica ativa
   (opacidade cheia); as demais recuam. O indicador de progresso 01/04 segue
   a pergunta ativa. Fallback: sem JS ou com prefers-reduced-motion, todas
   as perguntas ficam visíveis e estáticas (a classe .is-live nunca é adicionada,
   então o CSS de dim/active não aplica). */

const section = document.getElementById("autoridade");

if (section) {
  const qs = Array.from(section.querySelectorAll(".questions__q"));
  const cur = section.querySelector(".questions__cur");
  const track = section.querySelector(".questions__track");
  const marker = section.querySelector(".questions__marker");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!reduce && "IntersectionObserver" in window && qs.length) {
    section.classList.add("is-live");
    qs[0].classList.add("is-active");

    const setActive = (el) => {
      if (el.classList.contains("is-active")) return;
      qs.forEach((q) => q.classList.toggle("is-active", q === el));
      const idx = parseInt(el.dataset.i, 10); // 1..n
      if (cur) cur.textContent = String(idx).padStart(2, "0");
      /* marcador desce no trilho e a linha preenche até ele */
      const pct = qs.length > 1 ? ((idx - 1) / (qs.length - 1)) * 100 : 0;
      if (track) track.style.setProperty("--fill", pct + "%");
      if (marker) marker.style.setProperty("--pp", pct + "%");
    };

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(e.target);
        });
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 }
    );

    qs.forEach((q) => io.observe(q));
  }
}
