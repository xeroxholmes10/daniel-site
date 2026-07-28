/* Banner de consentimento de cookies (LGPD). O padrão "negado" já foi setado
   inline no <head> (antes do GTM carregar, via Google Consent Mode v2) —
   aqui só decidimos se atualiza pra "concedido" e lembramos a escolha. */

const STORAGE_KEY = "dm_cookie_consent";

function updateConsent(choice) {
  const granted = choice === "granted";
  window.dataLayer = window.dataLayer || [];
  window.gtag =
    window.gtag ||
    function () {
      window.dataLayer.push(arguments);
    };
  window.gtag("consent", "update", {
    analytics_storage: granted ? "granted" : "denied",
    ad_storage: granted ? "granted" : "denied",
    ad_user_data: granted ? "granted" : "denied",
    ad_personalization: granted ? "granted" : "denied",
  });
}

const banner = document.getElementById("consentBanner");
const stored = localStorage.getItem(STORAGE_KEY);

if (stored === "granted" || stored === "denied") {
  updateConsent(stored);
} else if (banner) {
  banner.hidden = false;
}

function decide(choice) {
  try {
    localStorage.setItem(STORAGE_KEY, choice);
  } catch (_) {
    /* localStorage indisponível (modo privado/quota) — decisão vale só pra essa visita */
  }
  updateConsent(choice);
  if (banner) banner.hidden = true;
}

document.getElementById("consentAccept")?.addEventListener("click", () => decide("granted"));
document.getElementById("consentReject")?.addEventListener("click", () => decide("denied"));
