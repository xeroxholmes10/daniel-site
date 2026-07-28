/* Camada central de tracking (dataLayer). Nenhuma tag de plataforma (GA4/Ads/
   Meta/TikTok) configurada ainda — só captura eventos e atribuição pro GTM
   consumir depois. */

const STORAGE_FIRST_TOUCH = "dm_first_touch";
const STORAGE_LAST_TOUCH = "dm_last_touch";

const ATTRIBUTION_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "gclid",
  "fbclid",
  "ttclid",
  "msclkid",
];

/* ---------- núcleo: push no dataLayer ---------- */
export function trackEvent(eventName, params = {}) {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: eventName, ...params });
}

/* ---------- atribuição (UTMs + clicks ids) ---------- */
function readAttributionFromUrl() {
  const search = new URLSearchParams(window.location.search);
  const data = {};
  ATTRIBUTION_KEYS.forEach((key) => {
    const value = search.get(key);
    if (value) data[key] = value;
  });
  return data;
}

function readStored(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

function writeStored(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (_) {
    /* localStorage indisponível (modo privado/quota cheia) — segue sem persistir */
  }
}

function captureAttribution() {
  const fromUrl = readAttributionFromUrl();
  if (Object.keys(fromUrl).length === 0) return;

  writeStored(STORAGE_LAST_TOUCH, fromUrl);
  if (!readStored(STORAGE_FIRST_TOUCH)) {
    writeStored(STORAGE_FIRST_TOUCH, fromUrl);
  }
}

export function getFirstTouch() {
  return readStored(STORAGE_FIRST_TOUCH);
}

export function getLastTouch() {
  return readStored(STORAGE_LAST_TOUCH);
}

export function getAttributionPayload() {
  const payload = {};
  const first = getFirstTouch();
  const last = getLastTouch();
  if (first) payload.first_touch = first;
  if (last) payload.last_touch = last;
  return payload;
}

captureAttribution();

/* ---------- whatsapp_click ---------- */
const SECTION_ALIASES = { "para-quem": "para_quem" };

function resolveSection(link) {
  const withDataSection = link.closest("[data-section]");
  if (withDataSection) return withDataSection.dataset.section;

  const section = link.closest("section");
  if (section?.id) return SECTION_ALIASES[section.id] || section.id;

  if (link.closest("footer")) return "footer";

  return "unknown";
}

document.addEventListener("click", (e) => {
  const link = e.target.closest('a[href*="wa.me"]');
  if (!link) return;
  trackEvent("whatsapp_click", {
    click_section: resolveSection(link),
    ...getAttributionPayload(),
  });
});

/* ---------- external_link_click ---------- */
const EXTERNAL_DESTINATIONS = [
  { match: "instagram.com", name: "instagram" },
  { match: "linkedin.com", name: "linkedin" },
];

document.addEventListener("click", (e) => {
  const link = e.target.closest("a[href]");
  if (!link) return;
  const destination = EXTERNAL_DESTINATIONS.find((d) => link.href.includes(d.match));
  if (!destination) return;
  trackEvent("external_link_click", { destination: destination.name });
});

/* ---------- faq_open ---------- */
document.querySelectorAll(".faq__item[data-question]").forEach((item) => {
  item.addEventListener("toggle", () => {
    if (item.open) trackEvent("faq_open", { question: item.dataset.question });
  });
});

/* ---------- scroll_50 / scroll_90 ---------- */
let scroll50Fired = false;
let scroll90Fired = false;

function scrollPercent() {
  const doc = document.documentElement;
  const scrollable = doc.scrollHeight - doc.clientHeight;
  if (scrollable <= 0) return 100;
  return ((window.scrollY || doc.scrollTop) / scrollable) * 100;
}

function onScroll() {
  const pct = scrollPercent();
  if (!scroll50Fired && pct >= 50) {
    scroll50Fired = true;
    trackEvent("scroll_50");
  }
  if (!scroll90Fired && pct >= 90) {
    scroll90Fired = true;
    trackEvent("scroll_90");
  }
  if (scroll50Fired && scroll90Fired) {
    window.removeEventListener("scroll", onScroll);
  }
}

window.addEventListener("scroll", onScroll, { passive: true });
onScroll();
