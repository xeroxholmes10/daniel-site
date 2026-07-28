/* Busca ações na brapi.dev e grava public/data/market.json.
   Roda sob demanda (npm run fetch:market) — nada disso entra no bundle do
   navegador, o token só existe aqui, do lado do Node. Pensado pra virar um
   passo de GitHub Actions (1x/dia) assim que o repo existir.

   IMPORTANTE: no plano free da brapi, /api/quote/{ticker} (cotação individual,
   usada pra índice/moeda) e /api/v2/currency retornam MONTHLY_LIMIT_EXCEEDED —
   não fazem parte do free tier de verdade, só /api/quote/list. Por isso este
   script só busca ações (que É o que veio via /api/quote/list, sem limite
   visível no teste). Ibovespa/Dólar continuam com o valor estático que já
   existia em market-v3.js até decidirmos uma fonte alternativa pra eles. */

import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const TOKEN = process.env.BRAPI_TOKEN;
if (!TOKEN) {
  console.error("BRAPI_TOKEN não definido. Rode com: node --env-file=.env scripts/fetch-market.mjs");
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.join(__dirname, "..", "public", "data", "market.json");
const ASSET_LIMIT = 200; // tamanho da lista grande que alimenta a rotação

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

async function fetchStocks() {
  const url = new URL("https://brapi.dev/api/quote/list");
  url.searchParams.set("token", TOKEN);
  url.searchParams.set("type", "stock");
  url.searchParams.set("sortBy", "market_cap_basic");
  url.searchParams.set("sortOrder", "desc");
  url.searchParams.set("limit", String(ASSET_LIMIT * 2)); // sobra pra filtrar fracionário/duplicata

  const res = await fetch(url);
  if (!res.ok) throw new Error(`quote/list falhou: ${res.status} ${await res.text()}`);
  return res.json();
}

function cleanAssets(stocks) {
  const seen = new Set();
  const out = [];
  for (const s of stocks || []) {
    const ticker = s.stock;
    if (!ticker || /F$/.test(ticker)) continue; // remove mercado fracionário (ex.: PETR4F)
    if (seen.has(ticker)) continue;
    const price = num(s.close);
    const changePercent = num(s.change);
    if (price === null || changePercent === null) continue;
    seen.add(ticker);
    out.push({ ticker, name: s.name || ticker, price, changePercent });
    if (out.length >= ASSET_LIMIT) break;
  }
  return out;
}

async function main() {
  const listData = await fetchStocks();
  const assets = cleanAssets(listData.stocks);

  const payload = {
    updatedAt: new Date().toISOString(),
    assets,
  };

  await mkdir(path.dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(payload, null, 2));
  console.log(`OK: ${assets.length} ativos gravados em ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
