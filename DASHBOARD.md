# Dashboard de Performance — Landing Page Daniel Magalhães

Especificação da arquitetura do dashboard antes da implementação no Looker Studio.
Documento vivo: toda métrica nova deve ser registrada aqui antes de virar gráfico.

- **Propriedade GA4:** `Daniel Magalhaes - Site` — `G-EKHN0CPSNT` (property ID `547463540`)
- **Container GTM:** `GTM-K6WFBM6S`
- **Conta Google Ads:** `586-665-8445` (xeroxholmes)
- **Site:** https://daniel-site-seven.vercel.app/
- **Ferramenta:** Looker Studio (conector nativo GA4 + conector nativo Google Ads)

---

## 1. Princípios de design

1. **Decisão, não vitrine.** Todo elemento do dashboard responde a uma pergunta de decisão
   (pausar keyword? escalar orçamento? mexer na copy da seção X?). Se não responde, sai.
2. **Volume baixo é a realidade atual.** 28 usuários em 28 dias. Por isso:
   - Período padrão = **últimos 28 dias**, nunca "hoje". Com n<30 diário, gráfico diário é ruído.
   - Toda taxa (%) vem acompanhada do **numerador absoluto**. "50% de conversão" com n=2 é mentira estatística.
   - Nenhum alerta automático por variação percentual enquanto o volume não passar de ~100 sessões/semana.
3. **Usuários únicos, não contagem de eventos.** O funil mede *pessoas* que passaram pela etapa.
   `scroll_50` teve 24 disparos mas só 10 usuários — usar 24 infla o funil.
4. **Uma fonte por bloco sempre que possível.** Blend (mistura de fontes) só onde é inevitável (custo).

---

## 2. Estado real da coleta (auditado em 2026-08-03)

### 2.1 Eventos que chegam no GA4 hoje

Fonte: `daniel-site/src/v3/tracking.js` + `popup-v3.js` + Enhanced Measurement nativo do GA4.

| Evento | Origem | Parâmetros enviados | Volume 28d |
|---|---|---|---|
| `page_view` | GA4 nativo | — | 69 |
| `session_start` | GA4 nativo | — | 35 |
| `first_visit` | GA4 nativo | — | 28 |
| `user_engagement` | GA4 nativo | — | 48 |
| `scroll` | GA4 nativo (90%) | — | 14 |
| `click` | GA4 nativo (outbound) | — | 5 |
| `form_start` | GA4 nativo | — | 1 |
| `scroll_50` | `tracking.js` | — | 24 |
| `scroll_90` | `tracking.js` | — | 13 |
| `faq_open` | `tracking.js` | `question` | 8 |
| `whatsapp_click` | `tracking.js` | `click_section`, `first_touch`, `last_touch` | 5 |
| `external_link_click` | `tracking.js` | `destination` | 1 |
| `lead_submit` | `popup-v3.js` | `first_touch`, `last_touch` | 1 |

### 2.2 Dimensões personalizadas registradas

Criadas em **2026-08-03**, escopo Evento. **Só populam dados a partir dessa data** — GA4 não retroage.

| Dimensão | Parâmetro | Alimentada por |
|---|---|---|
| `click_section` | `click_section` | `whatsapp_click` |
| `question` | `question` | `faq_open` |
| `destination` | `destination` | `external_link_click` |

### 2.3 Problemas encontrados no código — corrigir antes de implementar

**P1 — `first_touch` / `last_touch` nunca chegam no GA4 (bloqueia atribuição própria).**

`tracking.js:72-79` monta o payload como **objeto aninhado**:

```js
payload.first_touch = { utm_source: "google", gclid: "abc123", ... };
```

GA4 só aceita parâmetros **escalares** (string/número). Objeto aninhado é descartado
silenciosamente — não aparece em lugar nenhum, nem como dimensão personalizada.
Além disso, o GTM hoje só tem 3 variáveis Data Layer (`click_section`, `question`,
`destination`), nenhuma lê atribuição.

*Impacto:* o Bloco 4 (Performance por origem) fica **100% dependente do modelo de
atribuição padrão do GA4**, sem cruzamento com o UTM/gclid que o site já captura.
Não é fatal — GA4 tem `session_source_medium` nativo — mas perde-se o first-touch real
de quem voltou depois por outro canal.

*Correção:* achatar em `first_utm_source`, `first_gclid`, etc. (strings), criar as
variáveis DLV correspondentes no GTM e registrar como dimensões personalizadas.

**P2 — eventos nativos duplicam eventos próprios (polui relatório).**

- `scroll` (nativo, 90%) ≈ `scroll_90` (próprio) → 14 vs 13
- `click` (nativo, outbound) engloba `whatsapp_click` + `external_link_click` → 5 vs 5+1

*Impacto:* quem abrir "Eventos" no GA4 sem saber disso vai contar a mesma ação duas vezes.

*Correção:* não usar os nativos em nenhum gráfico deste dashboard (decisão de design, não
precisa desligar). Documentado na seção 8 para não confundir manutenção futura.

**P3 — `lead_submit` não carrega `click_section`.**

O popup dispara sempre na seção Benefícios, então a informação é redundante *hoje*.
Se um dia houver segundo formulário, vira cegueira. Registrado como dívida técnica.

---

## 3. Estrutura do dashboard

Cinco páginas. Daniel usa a página 1 no dia a dia; as outras são para investigação.

```
Página 1 — Visão Executiva        (uso diário do Daniel)
Página 2 — Aquisição              (de onde vem o tráfego)
Página 3 — Comportamento no Site  (o que fazem na página)
Página 4 — Google Ads             (keyword / campanha / custo)
Página 5 — Dicionário de Métricas (documentação embutida)
```

### 3.1 Controles globais (fixos no topo de todas as páginas)

| Controle | Tipo | Padrão | Observação |
|---|---|---|---|
| Período | Date range control | Últimos 28 dias | Nunca "hoje" — ver princípio 2 |
| Comparação | Date range comparison | Período anterior | Desligado por padrão enquanto n<100/semana |
| Canal | Drop-down (`Session default channel group`) | Todos | |
| Dispositivo | Drop-down (`Device category`) | Todos | |
| Campanha | Drop-down (`Session campaign`) | Todas | Páginas 2 e 4 apenas |

---

## 4. Página 1 — Visão Executiva

Responde: *"o que gastei, o que voltou, e está melhorando ou piorando?"*

### 4.1 Linha de scorecards (6 cards)

| # | KPI | Fonte | Cálculo | Decisão que informa |
|---|---|---|---|---|
| 1 | Investimento | Google Ads | `Cost` | Quanto saiu do bolso |
| 2 | Usuários | GA4 | `Total users` | Alcance real |
| 3 | Contatos WhatsApp | GA4 | `Total users` filtrado `Event name = whatsapp_click` | Volume de intenção quente |
| 4 | Leads (newsletter) | GA4 | `Total users` filtrado `Event name = lead_submit` | Volume de intenção morna |
| 5 | Custo por Contato | Blend | `Cost` ÷ usuários com `whatsapp_click` | **KPI mestre.** Vale a pena escalar? |
| 6 | Taxa de Contato | GA4 | usuários `whatsapp_click` ÷ `Total users` | Qualidade do tráfego + da página |

> **Regra de exibição:** cards 5 e 6 mostram `—` quando o denominador < 5. Evita
> "R$ 35,51 por contato" derivado de n=2 virar decisão de orçamento.

### 4.2 Gráfico de tendência

- **Tipo:** série temporal combinada, granularidade **semanal** (não diária).
- **Eixo esquerdo:** Usuários (área)
- **Eixo direito:** Contatos WhatsApp + Leads (linhas)
- **Objetivo:** ver se crescimento de tráfego está virando contato ou só volume vazio.

### 4.3 Funil de engajamento

Looker Studio **não tem gráfico de funil nativo**. Implementação escolhida:

- **Barra horizontal** com as 5 etapas, ordenada, uma métrica por etapa.
- Abaixo, linha de scorecards com a **taxa de passagem** entre etapas consecutivas.

| Etapa | Métrica (GA4) | Filtro do gráfico | Baseline 28d |
|---|---|---|---|
| 1. Visitantes | `Total users` | — | 28 |
| 2. Leram metade | `Total users` | `Event name = scroll_50` | 10 (36%) |
| 3. Leram até o fim | `Total users` | `Event name = scroll_90` | 6 (21%) |
| 4. Clicaram WhatsApp | `Total users` | `Event name = whatsapp_click` | 4 (14%) |
| 5. Enviaram lead | `Total users` | `Event name = lead_submit` | 1 (4%) |

**Onde o funil vaza hoje:** maior perda é etapa 1→2 (64% sai sem passar da metade da página).
Isso é diagnóstico de *hero + primeira dobra*, não de CTA.

> **Nota de manutenção:** análise de funil com ordenação real (quem fez A *depois* B)
> só existe no **GA4 Explore → Exploração de funil**. Este bloco no Looker Studio mostra
> etapas independentes, não sequência garantida. Para investigação profunda, usar o GA4.

---

## 5. Página 2 — Aquisição

Responde: *"qual canal traz gente que realmente engaja?"*

### 5.1 Scorecards

Usuários · Sessões · Novos usuários · Sessões por usuário · Taxa de engajamento

### 5.2 Tabela principal — Performance por Origem

Fonte: GA4. Dimensão primária: `Session source / medium`. Dimensão secundária: `Session campaign`.

| Coluna | Métrica | Por que está aqui |
|---|---|---|
| Origem / Mídia | dimensão | — |
| Campanha | dimensão | separa Ads de orgânico/direto |
| Usuários | `Total users` | tamanho |
| Taxa de engajamento | `Engagement rate` | qualidade bruta |
| Scroll 90% | `Total users` filtrado | leu o argumento inteiro |
| WhatsApp | `Total users` filtrado | intenção quente |
| Leads | `Total users` filtrado | conversão |
| Taxa de Contato | campo calculado | **coluna de decisão** — ordenar por ela |

> **Limitação conhecida:** o GA4 free não permite filtrar por evento *por coluna* dentro de
> uma mesma tabela. Implementação real: uma tabela por métrica de evento, ou usar
> **campos calculados com `COUNT_DISTINCT` condicional**. Ver seção 7.2.

### 5.3 Gráficos de apoio

- **Pizza/rosca:** distribuição por `Device category` — hoje 97,8% do custo é mobile
- **Barra:** `Session default channel group`
- **Tabela:** `City` (top 10) — Daniel atende presencialmente? geografia importa

---

## 6. Página 3 — Comportamento no Site

Responde: *"qual parte da página convence e qual parte perde gente?"*

Esta página **só tem dados a partir de 2026-08-03** (data de criação das dimensões).

### 6.1 CTA mais clicado

- **Tipo:** barra horizontal
- **Dimensão:** `click_section` (dimensão personalizada)
- **Métrica:** `Event count` filtrado `Event name = whatsapp_click`
- **Valores esperados:** `hero`, `daniel`, `problema`, `perfis`, `filosofia`, `metodo`,
  `acompanhamento`, `beneficios`, `autoridade`, `faq`, `cta`, `footer`
- **Decisão:** seção com muito clique = argumento que funciona → replicar tom.
  Seção com zero clique e muito scroll = CTA invisível ou fraco → testar copy/posição.

### 6.2 FAQ — quais dúvidas travam a decisão

- **Tipo:** tabela
- **Dimensão:** `question`
- **Métricas:** `Event count`, `Total users`
- **Decisão:** pergunta muito aberta = objeção real do público → subir para a copy principal
  ou virar seção própria. Também alimenta pauta de conteúdo/Instagram.

### 6.3 Profundidade de leitura

- **Tipo:** barra
- **Métricas:** usuários em `scroll_50` vs `scroll_90`
- **Segmentável por:** `Session source / medium` (tráfego pago lê menos que orgânico?)

### 6.4 Links externos

- **Dimensão:** `destination` (`instagram` / `linkedin`)
- **Decisão:** volume alto = o site está entregando audiência para a rede social;
  vale reforçar o funil lá ou trazer o conteúdo para dentro do site.

---

## 7. Página 4 — Google Ads

Responde: *"qual palavra-chave paga se paga?"*

### 7.1 Decisão de arquitetura: sem blend para keyword

O GA4 **já expõe dimensões de Google Ads nativamente** quando o link GA4↔Ads está ativo
(confirmado: `whatsapp_click` foi importado para o Ads como conversão "Contatos").
Dimensões disponíveis no GA4:

- `Session Google Ads keyword text`
- `Session Google Ads campaign` / `ad group name`
- `Session Google Ads query` (termo de pesquisa real digitado)

**Consequência:** a tabela keyword × comportamento é feita **inteiramente na fonte GA4**,
sem blend. Blend só entra para trazer **custo** (`Cost`, `Clicks`, `Impressions`), que
vive no conector do Google Ads.

### 7.2 Tabela — Performance por Palavra-chave

Fonte: GA4 (+ blend com Google Ads para custo, chave = `Date` + `Campaign`).

| Coluna | Fonte | Cálculo |
|---|---|---|
| Palavra-chave | GA4 | `Session Google Ads keyword text` |
| Cliques | Ads | `Clicks` |
| Custo | Ads | `Cost` |
| Usuários | GA4 | `Total users` |
| Scroll 90% | GA4 | `Total users` filtrado |
| WhatsApp | GA4 | `Total users` filtrado |
| Custo por Contato | calculado | `Cost` ÷ WhatsApp |

**Baseline 26/jul–03/ago (9 dias, R$ 71,02, 110 cliques, CTR 8,89%):**

| Palavra-chave | Impr. | Cliques | CTR | Custo | Leitura |
|---|---|---|---|---|---|
| "consultoria financeira" | 80 | 27 | 33,75% | R$ 15,22 | campeã disparada |
| "planejamento patrimonial" | 176 | 13 | 7,39% | R$ 18,22 | volume alto, CTR médio |
| "planejamento para aposentadoria" | 142 | 5 | 3,52% | R$ 8,68 | CTR fraco |
| "planejamento de aposentadoria" | 109 | 3 | 2,75% | R$ 1,07 | CTR fraco |
| "quanto preciso para me aposentar" | 120 | 3 | 2,50% | R$ 2,85 | CTR fraco |
| "assessoria para aposentadoria" | 43 | 0 | 0% | R$ 0,00 | **zero clique** |
| "assessoria de investimentos" | 20 | 0 | 0% | R$ 0,00 | **zero clique** |

### 7.3 Divergência Ads × GA4 — DIAGNOSTICADO em 2026-08-03

| Métrica | Valor | Fonte |
|---|---|---|
| Cliques reportados pelo Google Ads (9d) | 110 | Ads |
| Sessões totais no GA4 (28d) | 35 | GA4 |
| Sessões `google / cpc` no GA4 (7d) | 15 | GA4 |
| Sessões `(direct) / (none)` no GA4 (7d) | 14 | GA4 |

#### Hipóteses testadas e DESCARTADAS

| Hipótese | Teste realizado | Resultado |
|---|---|---|
| Auto-tagging desligado | Google Ads → Configurações da conta | ❌ **Falso.** "Codificação automática: **Sim**" — está ligado |
| Redirect removendo parâmetros | Acesso real a `/?gclid=...&utm_*` em produção | ❌ **Falso.** URL preservada integralmente. Não existe `vercel.json`, nenhum redirect |
| `tracking.js` não captura gclid | `localStorage.dm_first_touch` após acesso | ❌ **Falso.** Capturou `{"utm_source":"google","utm_medium":"cpc","gclid":"..."}` |
| GA4 não recebe o gclid | Inspeção do request `/g/collect` | ❌ **Falso.** Parâmetro `dl` carrega a URL completa com o gclid |

#### CAUSA RAIZ CONFIRMADA — Consent Mode bloqueando cookies

Teste executado em produção (`daniel-site-seven.vercel.app`), visitante novo, com gclid.

**Estado ANTES de clicar "Aceitar"** (= todo clique de anúncio, sempre):

```
gcs  = G100          → ad_storage: DENIED, analytics_storage: DENIED
npa  = 1             → anúncios não-personalizados
cookies = (nenhum)   → sem _ga, sem _gcl_aw
```

**Estado DEPOIS de clicar "Aceitar":**

```
gcs  = G111          → tudo concedido
npa  = 0
cookies = _ga=GA1.1.1112691197...
          _gcl_aw=GCL.1785766052.TESTE_DIAGNOSTICO_456   ← gclid gravado
          _ga_EKHN0CPSNT=GS2.1...
```

**O mecanismo da perda:**

1. `index.html:9-15` define Consent Mode v2 com **tudo `denied` por padrão** (correto para LGPD).
2. Todo clique de anúncio chega como visitante novo → banner aparece → consentimento negado.
3. Sem consentimento, o GA4 envia apenas **cookieless ping**: não grava `_ga`, então o
   `client_id` é gerado em memória e **se perde a cada carregamento**. GA4 não consegue
   montar usuário nem sessão confiável a partir disso.
4. Sem `_gcl_aw`, o **Google Ads não tem como amarrar a conversão ao clique** — é esse
   cookie que carrega o gclid para o casamento de conversão.
5. GA4 só recupera esses dados via **modelagem comportamental**, que exige um mínimo de
   ~1.000 eventos/dia com consentimento negado, por 7 dias. O site faz ~9 eventos/dia —
   duas ordens de grandeza abaixo. **Nenhuma modelagem acontece. O dado é simplesmente perdido.**

#### Consistência numérica

35 sessões registradas ÷ 110 cliques ≈ **32%**. Compatível com taxa típica de aceite de
banner de cookies no Brasil (30–50%). Ou seja: **os números batem com a hipótese de que
essencialmente só quem clicou "Aceitar" virou sessão no GA4.**

Isso é forte indício, não prova formal — parte dos 110 cliques também some por bounce
antes do script carregar e por filtragem de cliques inválidos.

#### Consequências para o dashboard

- **Todo o Bloco 4 (Google Ads) está medindo ~1/3 da realidade.** Custo por Contato real
  é melhor do que o dashboard mostra.
- `(direct) / (none)` está inflado com tráfego pago não identificado.
- Conversões importadas no Ads (2 registradas) estão subcontadas.
- **Nada disso é bug de código.** É o custo esperado de rodar Consent Mode com padrão
  negado — comportamento correto do ponto de vista de LGPD.

#### Opções (decisão do usuário — nenhuma executada)

| Opção | Ganho | Risco / custo |
|---|---|---|
| **A. Não mexer** | Conformidade LGPD máxima | Segue medindo ~1/3. Aceitável se o objetivo é tendência, não número absoluto |
| **B. Adicionar `url_passthrough: true`** | Passa gclid entre páginas via URL mesmo sem cookie; melhora casamento de conversão no Ads | Baixo risco. **Não recupera a sessão no GA4** — resolve só o lado Ads. Site é uma página só, ganho limitado |
| **C. Adicionar `ads_data_redaction: true`** | Reforça privacidade quando `ad_storage` negado | Não melhora medição; melhora postura de privacidade |
| **D. Melhorar taxa de aceite do banner** | Ataca a causa real. Subir aceite de ~32% para ~60% quase dobra o dado | Exige mudança de UX do banner (texto, contraste, posição). Legítimo desde que "Rejeitar" continue igualmente acessível |
| **E. Consent Mode básico (bloquear tags até aceitar)** | — | ❌ **Pior.** Perderia até o cookieless ping. Não recomendado |

**Recomendação:** **B + D**. `url_passthrough` é uma linha de código e melhora atribuição
de conversão no Ads sem custo de privacidade. A taxa de aceite do banner é o único ponto
que realmente move o ponteiro do GA4 — e mexer nela é legítimo desde que a recusa
permaneça com o mesmo peso visual.

#### B + D — IMPLEMENTADO em 2026-08-03 (validado local, ainda NÃO em produção)

**B — `url_passthrough`** (`index.html`, logo após o `consent default`):

```js
gtag('set', 'url_passthrough', true);
```

Validado: `dataLayer` registra `CONSENT:default` → `SET:url_passthrough=true` → `gtm.js`,
nessa ordem. Repassa o gclid pela URL quando não há cookie de anúncio. Não grava nada
no navegador.

**D — alvo tátil do banner** (`v3.css`). Diagnóstico: com 97,8% do tráfego em mobile e
botões de ~36px (abaixo dos 44px recomendados), muitos visitantes simplesmente ignoravam
o banner. **Ignorar = permanecer negado.** O ganho aqui não vem de empurrar ninguém para
"Aceitar" — vem de converter *não-decisão* em *decisão*.

Mudanças: `min-height: 44px`, fonte 12px → 14px, botões dividindo a largura igualmente
no mobile, texto do banner mais específico e honesto (cita Google Analytics e Google Ads
pelo nome, em vez do vago "melhorar sua experiência").

**Verificação de não-manipulação (dark pattern):**

| Medição | Mobile 375px | Desktop 1280px |
|---|---|---|
| Aceitar | 167 × 44px | 101 × 44px |
| Rejeitar | 167 × 44px | 105 × 44px |
| Mesma altura | ✅ | ✅ |
| Um clique cada | ✅ | ✅ |

Rejeitar testado: salva `denied`, fecha o banner, **zero cookies gravados**. Aceitar
testado: grava `_ga`, `_gcl_aw` e `_ga_EKHN0CPSNT`. Zero erro de console nos dois caminhos.

> A diferença de 4px na largura em desktop é só o comprimento da palavra
> ("Aceitar" vs "Rejeitar"), não hierarquia visual imposta.

**Pendente:** deploy. As mudanças estão só no local — o site em produção ainda roda a
versão antiga.

> **Regra para leitura do dashboard, enquanto B/D não forem feitos:** use o GA4 para
> **proporções e tendências** (qual canal engaja mais, onde o funil vaza) e o **painel do
> Google Ads para números absolutos** de clique e custo. Não some as duas fontes esperando
> que fechem.

### 7.4 Termos de pesquisa (search terms)

- **Dimensão:** `Session Google Ads query`
- **Objetivo:** achar keyword nova ou negativa.
- **Achado atual:** "holding patrimonial" / "o que é holding patrimonial" aparecendo sem
  ser keyword cadastrada. Decidir: vira keyword (se o público bate) ou negativa (se for
  busca informacional que não converte).

### 7.5 Sobre atribuição de conversão por keyword

Testado em 03/08: no relatório de Palavras-chave do Google Ads, **toda linha individual
mostra 0,00 conversões** e só o total mostra 2,00. Causa provável: atribuição fracionada
(crédito repartido entre múltiplos cliques, cada fatia arredonda para 0,00 com 2 casas).

**Não force conclusão de "qual keyword converteu" com n=2 em 9 dias.** O dashboard mostra
o dado, mas a leitura honesta só existe a partir de ~30 conversões acumuladas.

---

## 8. Página 5 — Dicionário de Métricas

Página de texto dentro do próprio dashboard. Conteúdo mínimo:

### 8.1 Definições que não são óbvias

| Termo no dashboard | Definição exata |
|---|---|
| Contato WhatsApp | Usuário único que clicou em qualquer link `wa.me`. **Não** significa conversa iniciada — só o clique. |
| Lead | Usuário único que enviou o popup de newsletter com sucesso (`res.ok` do Web3Forms). |
| Taxa de Contato | usuários com `whatsapp_click` ÷ total de usuários. Não é a "taxa de conversão" padrão do GA4. |
| Custo por Contato | `Cost` (Google Ads) ÷ usuários com `whatsapp_click` (GA4). Cruza duas fontes — sujeito ao gap da seção 7.3. |
| Leram até o fim | Usuário que passou de 90% da altura da página. Não garante leitura. |

### 8.2 Eventos que este dashboard IGNORA de propósito

`scroll` (nativo) · `click` (nativo) · `user_engagement` · `page_view`

Motivo: duplicam eventos próprios (ver P2, seção 2.3) ou são métricas de vaidade.

### 8.3 Data de corte

Dimensões `click_section`, `question`, `destination`: **dados a partir de 2026-08-03**.
Qualquer análise da Página 3 anterior a essa data virá vazia — é esperado, não é bug.

---

## 9. Métricas propostas ainda NÃO coletadas

Ordenadas por relação valor/esforço. Nenhuma é métrica de vaidade.

| # | Métrica | Por que importa | O que exige |
|---|---|---|---|
| 1 | **Taxa de abandono do popup** | `form_start` vs `lead_submit` já existem, é de graça. Mede fricção do formulário. | Só montar o gráfico |
| 2 | **First-touch real (UTM/gclid)** | Hoje o dado é capturado e jogado fora (P1). Permite ver o canal que *descobriu* o cliente, não só o último. | Achatar payload + DLV no GTM + dimensões |
| 3 | **Tempo até o primeiro clique no WhatsApp** | Distingue "convenceu rápido" de "precisou ler tudo". Informa onde colocar o CTA. | Novo parâmetro `seconds_on_page` no `whatsapp_click` |
| 4 | **Visitante recorrente que converte** | Assessoria é venda de confiança; quase ninguém contrata na 1ª visita. Medir a 2ª/3ª visita é medir o ciclo real. | Dimensão `New / returning` (nativa GA4) |
| 5 | **Qual FAQ foi aberta antes de converter** | Liga objeção → decisão. Melhor insumo de copy que existe. | Já coletado; exige Explore com sequência |

---

## 10. Eventos/parâmetros a implementar — com justificativa

Ordem de execução recomendada.

### 10.1 Achatar atribuição (corrige P1) — prioridade alta

**Justificativa:** hoje o site captura `utm_*` + `gclid` e o dado morre no navegador.
Sem isso, o dashboard depende só da atribuição de sessão do GA4, que já sabemos estar
distorcida pelo gap da seção 7.3. Corrigir destrava a única atribuição própria do projeto.

Mudança em `tracking.js` — de objeto aninhado para parâmetros escalares:

```js
export function getAttributionPayload() {
  const payload = {};
  const first = getFirstTouch();
  const last = getLastTouch();
  if (first) {
    if (first.utm_source)   payload.first_utm_source   = first.utm_source;
    if (first.utm_medium)   payload.first_utm_medium   = first.utm_medium;
    if (first.utm_campaign) payload.first_utm_campaign = first.utm_campaign;
    if (first.gclid)        payload.first_gclid        = first.gclid;
  }
  if (last) {
    if (last.utm_source) payload.last_utm_source = last.utm_source;
    if (last.gclid)      payload.last_gclid      = last.gclid;
  }
  return payload;
}
```

Depois: criar variáveis DLV no GTM, adicionar como parâmetros nas tags `GA4 Event - *`,
registrar como dimensões personalizadas.

> **Atenção — limite de cota:** GA4 free permite **50 dimensões personalizadas de escopo
> Evento**. Hoje: 3 usadas. Adicionando 6 de atribuição → 9. Folga confortável, mas cada
> dimensão nova é permanente na prática (arquivar não libera slot imediatamente).

### 10.2 `generate_lead` como nome canônico — prioridade média

**Justificativa:** `generate_lead` é nome recomendado do GA4. O Smart Bidding do Google Ads
reconhece eventos recomendados com mais peso do que eventos custom ao otimizar campanhas.
Relevante **quando** o orçamento subir e a campanha migrar para lance automático — hoje,
com 2 conversões, não muda nada.

Implementação: disparar `generate_lead` **em paralelo** a `whatsapp_click` (não substituir —
substituir quebraria o histórico e a conversão já importada no Ads).

### 10.3 `seconds_on_page` no `whatsapp_click` — prioridade média

**Justificativa:** hoje sabemos *onde* clicaram (`click_section`) mas não *quando*.
Clique no hero aos 5 segundos = tráfego de alta intenção que já chegou decidido.
Clique no CTA final aos 3 minutos = a página fez o trabalho de convencimento.
São dois públicos diferentes que pedem estratégias de anúncio diferentes.

Custo de implementação: baixo — `Math.round(performance.now() / 1000)` no payload.

### 10.4 `form_location` no `lead_submit` — prioridade baixa

**Justificativa:** resolve P3. Redundante hoje (formulário único), vira necessário no
primeiro dia em que existir um segundo ponto de captura. Registrar agora evita
retrabalho e quebra de histórico depois.

---

## 11. Ordem de implementação

| Etapa | O que | Bloqueia? |
|---|---|---|
| 0 | ~~Verificar etiquetagem automática~~ — **concluído 03/08**, ver 7.3 | Não bloqueia mais |
| 0b | Decidir opções B/D da seção 7.3 (`url_passthrough` + banner) | Não bloqueia a construção; muda a leitura dos números |
| 1 | Criar fonte GA4 + fonte Google Ads no Looker Studio | Sim |
| 2 | Página 1 (Visão Executiva) + controles globais | — |
| 3 | Página 2 (Aquisição) | — |
| 4 | Página 4 (Google Ads) + blend de custo | — |
| 5 | Achatar atribuição (10.1) + GTM + dimensões | — |
| 6 | Página 3 (Comportamento) — esperar ~7 dias de dados pós-03/08 | — |
| 7 | Página 5 (Dicionário) | — |

---

## 12. Histórico

| Data | Mudança |
|---|---|
| 2026-08-03 | Documento criado. Dimensões `click_section`, `question`, `destination` registradas no GA4. Auditoria do `tracking.js` identificou P1, P2, P3. |
| 2026-08-03 | Opções **B + D** implementadas e validadas em localhost (`url_passthrough` + alvo tátil de 44px no banner). **Não deployadas.** |
| 2026-08-03 | Diagnóstico do gap Ads×GA4 concluído (seção 7.3). Auto-tagging **está ligado**; hipótese inicial descartada. Causa raiz: Consent Mode com padrão negado impede `_ga` e `_gcl_aw`, e o volume do site está ~100× abaixo do limiar de modelagem do GA4. Testado ao vivo em produção. |
