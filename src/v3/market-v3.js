/* Seção 07 — Acompanhamento: cards de mercado flutuantes sobre a foto.
   Ibovespa e Dólar: fixos, valor estático (brapi free não libera índice/moeda
   — só a lista de ações). Cards rotativos: puxam de public/data/market.json,
   gerado por `npm run fetch:market` (ver scripts/fetch-market.mjs), sorteando
   entre a lista grande de ações reais em vez de girar sempre os mesmos 3-4
   tickers. Sem linguagem de recomendação, sem prometer tempo real. */

const marketFixed = [
  { sym: "Ibovespa", val: "128.316 pts", delta: "1,23%", dir: "up", series: [4, 6, 5, 8, 7, 10, 9, 12] },
  { sym: "Dólar", val: "R$ 5,17", delta: "0,42%", dir: "down", series: [10, 9, 9.5, 8, 8.5, 7, 7.3, 6] },
];

const market = document.getElementById("market");

if (market) {
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const sparkPoints = (series) => {
    const min = Math.min(...series);
    const max = Math.max(...series);
    const range = max - min || 1;
    const step = 100 / (series.length - 1);
    return series
      .map((v, i) => `${(i * step).toFixed(1)},${(22 - ((v - min) / range) * 20).toFixed(1)}`)
      .join(" ");
  };

  /* sparkline decorativo: tendência coerente com a variação real do dia,
     com um leve ruído (determinístico por ticker, pra não "piscar" trocado
     a cada re-render) — não é histórico intradiário de verdade. */
  const seedFrom = (str) => {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    return () => ((h = (h * 1103515245 + 12345) >>> 0) / 4294967295);
  };
  const genSeries = (ticker, changePercent) => {
    const rnd = seedFrom(ticker);
    const points = 8;
    const trend = changePercent >= 0 ? 1 : -1;
    let v = 5;
    const out = [v];
    for (let i = 1; i < points; i++) {
      v += trend * (0.6 + rnd() * 0.8) + (rnd() - 0.5) * 0.6;
      out.push(v);
    }
    return out;
  };

  const cardInner = (item) => `
    <div class="mkt-card__sym">${item.sym}</div>
    <div class="mkt-card__row">
      <span class="mkt-card__val">${item.val}</span>
      <span class="mkt-card__delta ${item.dir}">${item.dir === "up" ? "▲" : "▼"} ${item.delta}</span>
    </div>
    <svg class="mkt-card__spark" width="100%" height="22" viewBox="0 0 100 22" preserveAspectRatio="none" aria-hidden="true">
      <polyline points="${sparkPoints(item.series)}" fill="none"
        stroke="${item.dir === "up" ? "#7fd1a8" : "#e2938a"}" stroke-width="1.6" />
    </svg>`;

  const toCard = (asset) => ({
    sym: asset.ticker,
    val: `R$ ${asset.price.toFixed(2).replace(".", ",")}`,
    delta: `${Math.abs(asset.changePercent).toFixed(2).replace(".", ",")}%`,
    dir: asset.changePercent >= 0 ? "up" : "down",
    series: genSeries(asset.ticker, asset.changePercent),
  });

  const updatedLabel = (iso) => {
    if (!iso) return "Dados de mercado";
    const d = new Date(iso);
    const date = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
    return `Dados atualizados em ${date}`;
  };

  market.innerHTML = `
    <div class="mkt-grid">
      <div class="mkt-card" data-slot="fixed-0" data-depth="0.5"></div>
      <div class="mkt-card" data-slot="fixed-1" data-depth="0.6"></div>
      <div class="mkt-card" data-slot="rot-0" data-depth="0.8"></div>
      <div class="mkt-card" data-slot="rot-1" data-depth="0.85"></div>
      <div class="mkt-card" data-slot="rot-2" data-depth="0.9"></div>
      <div class="mkt-card" data-slot="rot-3" data-depth="0.95"></div>
      <div class="mkt-tag"><span class="mkt-tag__dot"></span><span id="mktUpdated">Dados de mercado</span></div>
    </div>
  `;

  const fixedEls = market.querySelectorAll('[data-slot^="fixed-"]');
  fixedEls.forEach((el, i) => (el.innerHTML = cardInner(marketFixed[i])));

  fetch("/data/market.json")
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
    .then((data) => {
      const assets = Array.isArray(data.assets) ? data.assets : [];
      if (!assets.length) return;

      const tagEl = document.getElementById("mktUpdated");
      if (tagEl) tagEl.textContent = updatedLabel(data.updatedAt);

      const rotEls = Array.from(market.querySelectorAll('[data-slot^="rot-"]'));
      const shown = new Set(); // tickers atualmente visíveis, pra não repetir entre slots

      const pickAsset = () => {
        const pool = assets.filter((a) => !shown.has(a.ticker));
        const source = pool.length ? pool : assets;
        return source[Math.floor(Math.random() * source.length)];
      };

      const rotate = (el, startDelay) => {
        let current = pickAsset();
        shown.add(current.ticker);
        el.innerHTML = cardInner(toCard(current));

        const schedule = () => {
          if (hovered || reduceMotion) return;
          const periodMs = 8000 + Math.random() * 7000; // 8-15s, variando a cada ciclo
          timer = setTimeout(swap, periodMs);
        };
        let timer = null;
        let hovered = false;
        const swap = () => {
          el.classList.add("is-leaving");
          setTimeout(() => {
            shown.delete(current.ticker);
            current = pickAsset();
            shown.add(current.ticker);
            el.innerHTML = cardInner(toCard(current));
            el.classList.remove("is-leaving");
            el.classList.add("is-entering");
            setTimeout(() => el.classList.remove("is-entering"), 40);
            schedule();
          }, 420);
        };
        el.addEventListener("mouseenter", () => {
          hovered = true;
          if (timer) clearTimeout(timer);
        });
        el.addEventListener("mouseleave", () => {
          hovered = false;
          schedule();
        });
        if (!reduceMotion) setTimeout(schedule, startDelay);
      };

      rotEls.forEach((el, i) => rotate(el, 1200 + i * 1100));
    })
    .catch(() => {
      /* sem o JSON (dev local sem rodar o fetch, ou falha de rede): cards
         rotativos ficam vazios — os fixos (Ibovespa/Dólar) continuam de pé */
    });

  /* parallax sutil de profundidade, reagindo ao mouse sobre a seção
     Só no desktop: a rodada de otimização mobile pede zero rAF/parallax lá. */
  if (!reduceMotion && matchMedia("(min-width: 861px)").matches) {
    const section = document.getElementById("acompanhamento");
    const cards = market.querySelectorAll(".mkt-card");
    let mx = 0, my = 0, cx = 0, cy = 0;
    section.addEventListener("pointermove", (e) => {
      const r = section.getBoundingClientRect();
      mx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      my = ((e.clientY - r.top) / r.height - 0.5) * 2;
    });
    section.addEventListener("pointerleave", () => { mx = 0; my = 0; });
    const tick = () => {
      cx += (mx - cx) * 0.05;
      cy += (my - cy) * 0.05;
      cards.forEach((c) => {
        const depth = parseFloat(c.dataset.depth || "0.6");
        c.style.setProperty("--px", `${(cx * depth * 6).toFixed(2)}px`);
        c.style.setProperty("--py", `${(cy * depth * 5).toFixed(2)}px`);
      });
      requestAnimationFrame(tick);
    };
    tick();
  }
}
