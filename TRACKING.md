# Tracking — V3

Camada de tracking do `v3.html`. Só captura eventos/atribuição no `dataLayer` —
**nenhuma tag de plataforma (GA4, Google Ads, Meta Pixel, TikTok Pixel) está
configurada ainda.** Isso é etapa futura (GTM).

## Onde está

- `src/v3/tracking.js` — toda a lógica (função central `trackEvent`, captura de
  UTM/click ids, listeners de clique/scroll/FAQ/links externos). Carregado como
  primeiro `<script type="module">` no `v3.html`.
- `src/v3/popup-v3.js` — importa `tracking.js` pra disparar `lead_submit` e
  anexar dados de origem no envio do Web3Forms.

## `trackEvent(eventName, params)`

Garante `window.dataLayer`, faz `push({ event: eventName, ...params })`. Toda
função de tracking do projeto deve passar por aqui — não duplicar lógica de
`dataLayer.push` em outros arquivos.

## Captura de UTM / click ids

Na carga de qualquer página, `tracking.js` lê da URL (via `URLSearchParams`):

`utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `gclid`,
`fbclid`, `ttclid`, `msclkid`.

Só os parâmetros presentes na URL entram no objeto — nada é inventado.

- **`last_touch`**: sempre que a URL trouxer pelo menos um desses parâmetros,
  sobrescreve `localStorage.dm_last_touch`.
- **`first_touch`**: grava em `localStorage.dm_first_touch` **só se ainda não
  existir** — preserva a origem original do usuário mesmo que ele volte depois
  por outro canal.

`getFirstTouch()` / `getLastTouch()` / `getAttributionPayload()` (exportadas
de `tracking.js`) leem esses valores. `getAttributionPayload()` retorna
`{ first_touch, last_touch }` (só as chaves que existirem) — é isso que vai
junto nos eventos de conversão.

## Eventos implementados

| Evento | Disparo | Parâmetros | Conversão |
|---|---|---|---|
| `whatsapp_click` | Clique em qualquer `a[href*="wa.me"]` | `click_section` + `first_touch`/`last_touch` (se existirem) | SIM |
| `lead_submit` | Envio do popup Web3Forms com resposta `res.ok` (não no clique do botão) | `first_touch`/`last_touch` (se existirem) | SIM/secundária |
| `scroll_50` | ~50% da altura da página, 1x por pageview | — | NÃO |
| `scroll_90` | ~90% da altura da página, 1x por pageview | — | NÃO |
| `faq_open` | Abertura de um `<details class="faq__item">` | `question` (slug) | NÃO |
| `external_link_click` | Clique em link Instagram/LinkedIn | `destination` (`instagram`/`linkedin`) | NÃO |

`page_view` não foi implementado de propósito — fica a cargo do GA4/GTM quando
entrarem, pra não duplicar visualização de página.

## `whatsapp_click` — como a seção é identificada

Listener global no `document` (não em cada CTA individualmente) escuta clique
em qualquer link `wa.me`. Resolução da seção, nessa ordem:

1. `link.closest('[data-section]')` — usado nos 2 CTAs do hero
   (`.mobile-menu__cta` e `.hero__cta`), que não estão dentro de `<section>`.
2. `link.closest('section')?.id` — usado nos demais (ex.: `acompanhamento`,
   `faq`, `contato`, `para-quem` → normalizado pra `para_quem` via
   `SECTION_ALIASES`).
3. `link.closest('footer')` → `"footer"` (link de WhatsApp do rodapé).
4. Fallback `"unknown"` se nada bater.

O link da comunidade WhatsApp no popup (`np-wa`, `chat.whatsapp.com/...`) **não
é capturado** — o seletor é `a[href*="wa.me"]`, propositalmente restrito ao
CTA de conversa direta.

## `faq_open` — identificador da pergunta

Cada `<details class="faq__item">` no `v3.html` ganhou um atributo
`data-question` (slug curto, snake_case):

`como_funciona_primeira_conversa`, `patrimonio_minimo`, `custodia_dinheiro`,
`remuneracao`, `investimentos_existentes`, `acompanhar_mercado`,
`depois_primeira_conversa`.

`tracking.js` escuta o evento nativo `toggle` de cada `<details>` e dispara
`faq_open` só quando `item.open === true` (abrindo, não fechando). Isso roda em
paralelo ao `faq-v3.js` (que só fecha os outros itens ao abrir um) — não
substitui nem duplica aquele comportamento.

## Web3Forms — dados de origem no e-mail do Daniel

O popup não usa um `<form>` nativo apontando pro Web3Forms — ele já envia via
`fetch` com corpo JSON (`src/v3/popup-v3.js`). Por isso, em vez de `<input
type="hidden">` no HTML, os campos de atribuição do **`first_touch`** (se
existir) são espalhados direto no corpo JSON enviado:

```js
body: JSON.stringify({
  access_key, subject, from_name, nome, email, telefone,
  ...(getFirstTouch() || {}), // utm_source, utm_medium, gclid, etc. — só o que existir
}),
```

Resultado prático: o e-mail que o Daniel recebe do Web3Forms passa a ter
campos tipo `utm_source: google`, `utm_medium: cpc`, `gclid: ...` junto do
nome/e-mail/telefone, quando esses parâmetros estiverem presentes.

Nenhum dado pessoal (nome, telefone, e-mail, mensagem) vai pro `dataLayer` —
`lead_submit` carrega só `first_touch`/`last_touch`.

## Performance / segurança

- Nenhuma lib externa. Sem `requestAnimationFrame`. Scroll usa listener
  `passive: true` com duas flags booleanas (`scroll50Fired`/`scroll90Fired`) —
  o listener se remove sozinho assim que os dois já dispararam.
- Nenhum listener é anexado por CTA individual — tudo é delegação de evento no
  `document`, então os cliques nos links de WhatsApp continuam abrindo
  normalmente (nada de `preventDefault`).
- `localStorage` é acessado dentro de `try/catch` (modo privado ou quota cheia
  não quebra o site — só não persiste).

## Como testar

1. Abrir o site sem parâmetro nenhum → `localStorage.dm_first_touch` deve
   continuar vazio.
2. Abrir com `?utm_source=google&utm_medium=cpc&utm_campaign=teste` → conferir
   `localStorage.dm_first_touch` e `dm_last_touch` no DevTools.
3. Recarregar com uma UTM **diferente** → `dm_last_touch` muda,
   `dm_first_touch` continua igual ao da primeira visita.
4. Abrir o Console → `window.dataLayer` deve existir desde o load.
5. Clicar em qualquer CTA de WhatsApp (hero, perfis, acompanhamento, FAQ, CTA
   final, footer) → conferir no console (`dataLayer` array) o evento
   `whatsapp_click` com `click_section` correto e só um push por clique.
6. Rolar a página até passar de 50% e depois 90% → conferir `scroll_50` e
   `scroll_90`, cada um só uma vez.
7. Abrir uma pergunta do FAQ → conferir `faq_open` com o `question` certo;
   fechar e abrir de novo → dispara de novo (comportamento esperado, é
   "abertura", não "primeira abertura").
8. Clicar em Instagram/LinkedIn (hero ou footer) → `external_link_click`.
9. Preencher e enviar o popup de newsletter → conferir `lead_submit` no
   `dataLayer` (sem dados pessoais) e, no Web3Forms/e-mail do Daniel, os
   campos de UTM/gclid presentes quando aplicável.
