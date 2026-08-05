# Caderno de experimentos

Registro de todo teste A/B rodado no site. Um experimento por seção, mais recente no topo. Antes de criar um novo experimento, ler este arquivo pra não repetir hipótese já testada.

---

## 001 — search_intent_landing

**Status:** em desenvolvimento (variante pronta, experimento ainda não criado no Google Ads).
**Início:** 2026-08-05.

**Hipótese:** o anúncio do Google Ads promete solução pra um problema financeiro, mas a landing atual (variante A) abre institucional — apresenta o Daniel e a metodologia antes de engajar com a dor de quem pesquisou. Existe uma quebra entre a intenção de busca e a experiência entregue. Uma landing que abre alinhada à intenção de busca deve aumentar retenção (scroll_50/90) e conversão (whatsapp_click/lead_submit).

**Contexto que motivou o teste:** CTR do Google Ads ≈9%, CPC ≈R$0,64, maior parte dos usuários abandona antes do scroll_50 — gargalo é logo após a Hero, não no CTA. Keywords principais: consultoria financeira, consultor financeiro, planejamento financeiro, planejamento patrimonial, planejamento para aposentadoria.

**Variantes:**
- **A (controle):** `index.html` — Hero institucional (Daniel + metodologia) → Sobre → resto do site, sem alteração.
- **B:** `variante-b.html` — Hero reescrita (fala direto da dor de busca) → nova seção Calculadora → Sobre (título ajustado pra transição) → resto do site idêntico à A.

**O que muda entre A e B:**
- Hero: copy nova, CTA ghost aponta pra `#calculadora` em vez de `#metodo`.
- Seção nova "Calculadora" (entre Hero e Sobre): simula patrimônio necessário pra viver de renda, formula com o Daniel (ver Decisões abaixo).
- Sobre: só a primeira frase do título muda (gancho de transição vindo da calculadora).
- Resto do site (Benefícios, Filosofia, Método, Acompanhamento, FAQ, CTA, Footer): **idêntico**, mesmo CSS/JS.
- Botão flutuante do WhatsApp: adicionado em **ambas** as variantes (não é parte da hipótese — se ficasse só na B, contaminaria a comparação).

**Funil esperado (com o evento novo):**
`page_view → calculator_used → scroll_50 → scroll_90 → whatsapp_click → lead_submit`

**Tracking:**
- `experiment_name=search_intent_landing` e `experiment_variant=A|B` anexados automaticamente em todo evento (`tracking.js`, lido de `data-experiment-*` no `<body>` — variante A não tem o atributo, cai no default `"A"`).
- Evento novo: `calculator_used` (dispara ao clicar "Calcular", carrega `renda_desejada`, `taxa_mensal`, `idade_atual`, `patrimonio_atual`, `aporte_mensal`).
- `variante-b.html` tem `<meta name="robots" content="noindex,nofollow">` + canonical pra `index.html` (não duplicar conteúdo pro Google).

**Decisões da calculadora (revisadas com o Daniel):**
- Fórmula original (`patrimônio = renda / taxa%`) tava certa matematicamente, mas faltava contexto — Daniel apontou 3 problemas: (1) "idade alvo" não devia ser input, e sim OUTPUT calculado a partir de aporte mensal; (2) faltava inflação; (3) calculadora "pobre" demais.
- Modelo atual: patrimônio-alvo por perpetuidade em termos reais (Fisher: taxa real = (1+nominal)/(1+inflação)−1) → idade de chegada calculada via valor futuro de aportes mensais (juros compostos, resolvido pra tempo) → valor nominal na data futura também exibido.
- Inflação **fixa em 4,5% a.a.** (não é input do usuário, só aparece citada no disclaimer).
- Disclaimer fixo: "Projeção hipotética a partir dos valores informados por você — não é promessa nem recomendação de rentabilidade. Rentabilidade passada ou simulada não garante resultado futuro. Cálculo em termos reais (poder de compra de hoje), descontada uma inflação projetada de 4,5% a.a."

**Decisões de layout (pós-revisão visual):**
- Identidade 100% reaproveitada do site (mesma tipografia/cores/botões) — sem cards arredondados, sem ícones decorativos extras, sem estética de template SaaS.
- Resultado em painel navy (mesmo idioma visual do `.perfil` da seção "Para quem é": fundo navy + barra dourada no topo), centralizado verticalmente em relação à altura TOTAL da coluna esquerda (título+form), não só o formulário — evita vazio assimétrico.
- Seção da calculadora tem teto de largura próprio (1680px, maior que o `--content` de 1240px do resto do site) — só ela usa mais espaço horizontal, decisão explícita do usuário.
- Texto de transição ("Descobrir esse número é só o primeiro passo...") fica dentro da coluna de resultado, logo abaixo do patrimônio — sem CTA no fim da seção, só gera curiosidade pra seção Sobre (sem foto do Daniel aqui, ela some aparece na próxima seção).

**Pendências antes de rodar de verdade:**
1. GTM: criar `DLV - experiment_name` / `DLV - experiment_variant`, adicionar como parâmetro de evento na tag GA4 config.
2. GA4: registrar as duas como dimensão personalizada.
3. Google Ads: criar Experimento (Drafts & Experiments) na campanha "Pesquisa - Leads Daniel", draft com final URL `/variante-b.html`, split 50/50.
4. Rodar até significância estatística antes de declarar vencedora (campanha ainda tem volume baixo — 110 cliques/9 dias na medição de 2026-07-28).

**Resultado:** _(preencher quando o experimento rodar no Google Ads)_
