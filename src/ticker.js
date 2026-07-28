/* market ticker (InfoMoney-style) — small horizontal, continuous loop.
   REAL quotes from two free sources:
   - AwesomeAPI (economia.awesomeapi.com.br): currencies + crypto, no key needed.
   - brapi.dev: B3 stocks + Ibovespa, needs a free token (set BRAPI_TOKEN below).
   Only genuinely live data is shown — the tag says "ao vivo" and means it. */

const BRAPI_TOKEN = "dHFuFn6UhMP7KCVwQHiirM";

const AWESOME_PAIRS = "USD-BRL,EUR-BRL,GBP-BRL,BTC-BRL,ETH-BRL,LTC-BRL,DOGE-BRL";
const AWESOME_URL = `https://economia.awesomeapi.com.br/last/${AWESOME_PAIRS}`;

// free brapi plan allows only 1 ticker per request -> fetch each separately
const BRAPI_TICKERS = [
  "%5EBVSP", // Ibovespa
  "PETR4",
  "VALE3",
  "ITUB4",
  "BBDC4",
  "ABEV3",
  "WEGE3",
  "BBAS3",
  "B3SA3",
  "MGLU3",
];

const REFRESH_MS = 45000;

const AWESOME_LABELS = {
  USDBRL: "DÓLAR",
  EURBRL: "EURO",
  GBPBRL: "LIBRA",
  BTCBRL: "BITCOIN",
  ETHBRL: "ETHEREUM",
  LTCBRL: "LITECOIN",
  DOGEBRL: "DOGECOIN",
};
const BRAPI_LABELS = {
  "^BVSP": "IBOVESPA",
  PETR4: "PETR4",
  VALE3: "VALE3",
  ITUB4: "ITUB4",
  BBDC4: "BBDC4",
  ABEV3: "ABEV3",
  WEGE3: "WEGE3",
  BBAS3: "BBAS3",
  B3SA3: "B3SA3",
  MGLU3: "MGLU3",
};

function fmtMoney(n, decimals) {
  return "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
function fmtChange(n) {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}
function itemHTML(name, value, change) {
  const dir = change > 0 ? "up" : change < 0 ? "down" : "flat";
  const arrow = dir === "up" ? "▲" : dir === "down" ? "▼" : "•";
  return `
    <span class="tk">
      <span class="tk__name">${name}</span>
      <span class="tk__val">${value}</span>
      <span class="tk__chg tk__chg--${dir}">${arrow} ${fmtChange(change)}</span>
    </span>`;
}

async function fetchAwesome() {
  const res = await fetch(AWESOME_URL);
  if (!res.ok) throw new Error("awesomeapi " + res.status);
  const data = await res.json();
  return Object.keys(AWESOME_LABELS)
    .filter((code) => data[code])
    .map((code) => {
      const q = data[code];
      const n = parseFloat(q.bid);
      const decimals = n >= 100 ? 0 : n >= 1 ? 2 : 4;
      return { name: AWESOME_LABELS[code], value: fmtMoney(n, decimals), change: parseFloat(q.pctChange) };
    });
}

async function fetchBrapiOne(ticker) {
  const res = await fetch(`https://brapi.dev/api/quote/${ticker}?token=${BRAPI_TOKEN}`);
  if (!res.ok) throw new Error("brapi " + ticker + " " + res.status);
  const data = await res.json();
  const r = (data.results || [])[0];
  if (!r || typeof r.regularMarketPrice !== "number") throw new Error("brapi " + ticker + " no data");
  const label = BRAPI_LABELS[r.symbol] || r.symbol;
  const isIndex = r.symbol === "^BVSP";
  const value = isIndex
    ? Math.round(r.regularMarketPrice).toLocaleString("pt-BR") + " pts"
    : fmtMoney(r.regularMarketPrice, 2);
  return { name: label, value, change: r.regularMarketChangePercent || 0 };
}

async function fetchBrapi() {
  const settled = await Promise.allSettled(BRAPI_TICKERS.map(fetchBrapiOne));
  return settled.filter((s) => s.status === "fulfilled").map((s) => s.value);
}

function render(quotes) {
  const track = document.getElementById("tickerTrack");
  if (!track || quotes.length === 0) return;
  const oneSet = quotes.map((q) => itemHTML(q.name, q.value, q.change)).join("");
  track.innerHTML = oneSet + oneSet; // doubled for seamless -50% loop
}

function setStatus(live) {
  const tag = document.querySelector(".ticker__tag");
  if (!tag) return;
  tag.textContent = live ? "Cotações ao vivo" : "Cotações indisponíveis";
  tag.classList.toggle("ticker__tag--offline", !live);
}

async function tick() {
  const [brapi, awesome] = await Promise.allSettled([fetchBrapi(), fetchAwesome()]);
  const quotes = [
    ...(brapi.status === "fulfilled" ? brapi.value : []),
    ...(awesome.status === "fulfilled" ? awesome.value : []),
  ];
  if (quotes.length > 0) {
    render(quotes);
    setStatus(true);
  } else {
    setStatus(false);
  }
}

tick();
setInterval(tick, REFRESH_MS);
