/* Calculadora "quanto patrimônio preciso" — só existe na Variante B
   (experimento search_intent_landing). Modelo revisado com o Daniel:

   1) Patrimônio-alvo (perpetuidade, em R$ de hoje):
        Alvo = renda_mensal / taxa_real_mensal
      taxa_real via Fisher: (1+nominal) = (1+real)*(1+inflação)

   2) Idade em que atinge o alvo é OUTPUT, não input — valor futuro de
      aportes mensais com juros compostos (tudo em termos reais, aporte
      assumido constante em poder de compra):
        n = ln( (Alvo*i + Aporte) / (P0*i + Aporte) ) / ln(1+i)   [meses]

   3) Valor nominal (R$ na data futura, com inflação embutida):
        Alvo_nominal = Alvo_real * (1+inflação_mensal)^n */

import { trackEvent } from "./tracking.js";

/* inflação fixa (não é input do usuário) — mesma premissa citada no disclaimer */
const INFLACAO_ANUAL = 4.5;

const form = document.getElementById("calcForm");
const resultVal = document.getElementById("calcResultVal");
const resultNote = document.getElementById("calcResultNote");
const resultNominal = document.getElementById("calcResultNominal");

const REDUCE_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function formatBRL(value) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

let displayedValue = 0;
let animationFrame = null;

function animateTo(target) {
  cancelAnimationFrame(animationFrame);

  if (REDUCE_MOTION) {
    displayedValue = target;
    resultVal.textContent = formatBRL(target);
    return;
  }

  const from = displayedValue;
  const duration = 900;
  const start = performance.now();

  function tick(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
    const current = from + (target - from) * eased;
    resultVal.textContent = formatBRL(Math.round(current));
    if (progress < 1) {
      animationFrame = requestAnimationFrame(tick);
    } else {
      displayedValue = target;
    }
  }
  animationFrame = requestAnimationFrame(tick);
}

if (form && resultVal && resultNote && resultNominal) {
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const renda = parseFloat(data.get("renda"));
    const idadeAtual = parseFloat(data.get("idadeAtual"));
    const patrimonioAtual = parseFloat(data.get("patrimonioAtual")) || 0;
    const aporte = parseFloat(data.get("aporte")) || 0;
    const taxaNominalMensal = parseFloat(data.get("taxa"));

    if (!(renda > 0) || !(taxaNominalMensal > 0)) return;

    // Fisher: taxa real mensal a partir da nominal mensal e da inflação fixa
    const inflacaoMensal = Math.pow(1 + INFLACAO_ANUAL / 100, 1 / 12) - 1;
    const iReal = (1 + taxaNominalMensal / 100) / (1 + inflacaoMensal) - 1;

    const alvo = renda / iReal;
    animateTo(alvo);

    if (patrimonioAtual >= alvo) {
      resultNote.textContent = "Com o que você já tem investido, esse patrimônio já foi atingido.";
      resultNominal.textContent = "";
    } else if (aporte <= 0 && patrimonioAtual <= 0) {
      resultNote.textContent = "Sem aporte mensal ou patrimônio inicial, esse número não sai do papel.";
      resultNominal.textContent = "";
    } else {
      // meses até atingir o alvo (termos reais)
      const n = Math.log((alvo * iReal + aporte) / (patrimonioAtual * iReal + aporte)) / Math.log(1 + iReal);
      const anos = Math.floor(n / 12);
      const meses = Math.round(n % 12);
      const idadeAlvo = idadeAtual + n / 12;

      resultNote.textContent = `Investindo ${formatBRL(aporte)}/mês a ${taxaNominalMensal}% a.m., você chega lá aos ${idadeAlvo.toFixed(0)} anos (em ${anos} anos${meses ? ` e ${meses} meses` : ""}).`;

      const alvoNominal = alvo * Math.pow(1 + inflacaoMensal, n);
      resultNominal.textContent = `Em valores nominais dessa data (com ${INFLACAO_ANUAL}% a.a. de inflação), isso equivale a ${formatBRL(alvoNominal)}.`;
    }

    trackEvent("calculator_used", {
      renda_desejada: renda,
      taxa_mensal: taxaNominalMensal,
      idade_atual: idadeAtual || null,
      patrimonio_atual: patrimonioAtual,
      aporte_mensal: aporte,
    });
  });
}
