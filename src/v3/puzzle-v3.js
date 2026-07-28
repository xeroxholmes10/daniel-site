/* Big Idea — renderiza as peças como quebra-cabeça (SVG).
   Cada peça se ajusta à largura do texto; layout espalhado (peças soltas)
   + uma peça tracejada ("plano") que falta. */

const host = document.getElementById("bigideaPuzzle");
function renderPuzzle() {
  if (!host) return;
  const words = (host.dataset.pecas || "").split(",").map((s) => s.trim()).filter(Boolean);
  const missing = (host.dataset.falta || "plano").trim();

  const H = 62;          // altura da peça
  const R = 12;          // raio do encaixe (tab/blank)
  const PADX = 22;       // respiro horizontal do texto
  const GAP = 16;        // espaço entre peças no fluxo
  const ROWGAP = 20;     // espaço entre linhas
  const FONT = "600 13px Inter, sans-serif";
  const jitterY = [6, 20, 2, 16, 8, 22, 4, 18, 10];
  const rot = [-6, 5, -3, 4, -5, 3, -4, 6, -2];

  // medir largura do texto
  const cv = document.createElement("canvas").getContext("2d");
  cv.font = FONT;
  const bodyW = (t) => Math.max(84, Math.ceil(cv.measureText(t).width) + PADX * 2);

  // caminho da peça: topo/base retos, tab à direita (out), blank à esquerda (in)
  const path = (W) => {
    const cy = H / 2, k = R * 1.7;
    return `M0,0 L${W},0 L${W},${cy - R} C${W + k},${cy - R - 2} ${W + k},${cy + R + 2} ${W},${cy + R} `
         + `L${W},${H} L0,${H} L0,${cy + R} C${k},${cy + R + 2} ${k},${cy - R - 2} 0,${cy - R} Z`;
  };

  const items = words.map((t) => ({ t, w: bodyW(t), missing: false }));
  items.push({ t: missing, w: bodyW(missing), missing: true });

  // largura disponível (fallback 560)
  const avail = host.clientWidth || 560;

  // layout em fluxo com quebra de linha + jitter/rotação
  let x = 0, y = 0, rowH = H + 28, maxX = 0, idx = 0;
  const placed = [];
  for (const it of items) {
    const pieceW = it.w + R * 1.7; // inclui saliência do tab
    if (x > 0 && x + it.w > avail) { x = 0; y += rowH + ROWGAP; }
    placed.push({ ...it, x, y: y + (jitterY[idx % jitterY.length]), rot: rot[idx % rot.length] });
    x += it.w + GAP;
    maxX = Math.max(maxX, x);
    idx++;
  }
  const vbW = Math.max(maxX, avail);
  const vbH = y + rowH + 24;

  const parts = placed.map((p, i) => {
    const cx = p.w / 2, cyy = H / 2;
    const g = `translate(${p.x},${p.y}) rotate(${p.rot} ${cx} ${cyy})`;
    if (p.missing) {
      return `<g transform="${g}">`
        + `<path d="${path(p.w)}" fill="none" stroke="#b8b0a0" stroke-width="1.4" stroke-dasharray="5 5"/>`
        + `<text x="${cx}" y="${cyy + 5}" text-anchor="middle" font-family="'Playfair Display',serif" `
        + `font-size="15" font-style="italic" fill="#a8842f">${p.t}</text></g>`;
    }
    const fill = i % 2 ? "#fff" : "#fbf8f1";
    return `<g transform="${g}">`
      + `<path d="${path(p.w)}" fill="${fill}" stroke="#c9a24b" stroke-width="1.4"/>`
      + `<text x="${cx}" y="${cyy + 4}" text-anchor="middle" font-family="Inter,sans-serif" `
      + `font-size="13" font-weight="600" letter-spacing="0.6" fill="#14202e">${p.t}</text></g>`;
  });

  host.innerHTML =
    `<svg viewBox="-16 -10 ${vbW + 40} ${vbH + 20}" width="100%" role="img" `
    + `aria-label="${host.getAttribute("aria-label")}">${parts.join("")}</svg>`;
}

if (host) {
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(renderPuzzle);
  } else {
    renderPuzzle();
  }
  // re-render em resize (layout do fluxo depende da largura)
  let t;
  window.addEventListener("resize", () => {
    clearTimeout(t);
    t = setTimeout(renderPuzzle, 200);
  });
}
