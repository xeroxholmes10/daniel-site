/* Popup newsletter — dispara na seção "O que muda" (Benefícios),
   1x por sessão. Envia para o endpoint do Google Apps Script. */

import { trackEvent, getFirstTouch, getAttributionPayload } from "./tracking.js";

/* ===== CONFIG ===== */
/* Cole aqui a chave do Web3Forms (gerada com o e-mail de destino do Daniel).
   Enquanto estiver vazia, o form mostra sucesso mas não envia o e-mail. */
const ACCESS_KEY = "64b2250a-4013-416b-b8f4-7a8493faa392";
const ASSUNTO = "Novo inscrito - Newsletter Daniel";
/* ================== */

const overlay = document.getElementById("npOverlay");
const modal = overlay?.querySelector(".np-modal");
const closeBtn = document.getElementById("npClose");
const form = document.getElementById("npForm");
const errorEl = document.getElementById("npError");
const successEl = document.getElementById("npSuccess");
const trigger = document.getElementById("beneficios");

const SHOWN_KEY = "dm_np_shown";
let isOpen = false;

function open() {
  if (isOpen || sessionStorage.getItem(SHOWN_KEY)) return;
  isOpen = true;
  sessionStorage.setItem(SHOWN_KEY, "1");
  overlay.hidden = false;
  requestAnimationFrame(() => overlay.classList.add("is-open"));
  document.body.style.overflow = "hidden";
}

function close() {
  if (!isOpen) return;
  isOpen = false;
  overlay.classList.remove("is-open");
  document.body.style.overflow = "";
  setTimeout(() => { overlay.hidden = true; }, 350);
}

/* gatilho: quando a seção Benefícios entra na tela */
if (overlay && trigger && !sessionStorage.getItem(SHOWN_KEY)) {
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((e) => {
          if (e.isIntersecting) { open(); obs.disconnect(); }
        });
      },
      { threshold: 0.35 }
    );
    io.observe(trigger);
  }
}

/* fechar: X, clique no fundo, ESC */
closeBtn?.addEventListener("click", close);
overlay?.addEventListener("click", (e) => { if (e.target === overlay) close(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });

/* envio */
form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = new FormData(form);
  const nome = (data.get("nome") || "").toString().trim();
  const email = (data.get("email") || "").toString().trim();
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  if (!nome || !validEmail) {
    errorEl.hidden = false;
    return;
  }
  errorEl.hidden = true;

  const btn = form.querySelector(".np-prim");
  btn.disabled = true;
  btn.textContent = "Enviando…";

  try {
    if (ACCESS_KEY) {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          access_key: ACCESS_KEY,
          subject: ASSUNTO,
          from_name: "Site Daniel Magalhães",
          nome,
          email,
          telefone: (data.get("telefone") || "").toString().trim(),
          ...(getFirstTouch() || {}),
        }),
      });
      if (res.ok) trackEvent("lead_submit", getAttributionPayload());
    }
  } catch (_) {
    /* segue otimista mesmo se a rede falhar (evento lead_submit não dispara) */
  }

  form.hidden = true;
  successEl.hidden = false;
  setTimeout(close, 3200);
});
