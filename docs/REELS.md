# Régua do REEL — @umpaisdemerda

**Fonte única de como o Reel deve ser** — e, desde 31/07/2026, de como ele É: a régua
abaixo está implementada (`src/lib/reel-script.ts`, `src/lib/pauta-semana.ts`,
`/api/publish?preview=1`).

> **Esta página NÃO é de sátira — é de CRÍTICA** (ordem do dono, 31/07/2026). O objetivo
> nunca é fazer rir: é fazer o leitor encarar o que está sendo feito com o dinheiro e a
> vida dele. A ironia só entra quando já existe no fato. O brief em `src/lib/accounts.ts`
> foi reescrito nesse sentido — antes ele mandava, literalmente, fazer "sátira afiada que
> faz o brasileiro rir".

O pipeline roda nesta ordem: **buscar a notícia → escolher qual → crítica na voz +
roteiro (uma geração só) → verificar → gravar a voz → legenda → montar e publicar.**

---

## 0. Regra-mãe

> **O Reel é um ROTEIRO FALADO de 5 cenas sobre o escândalo do dia. Não é um post lido em
> voz alta.**

A crítica e o roteiro saem da **mesma geração** (`generateReelScript`). Se a crítica fosse
escrita primeiro e picada em cenas depois, o roteiro viraria resumo e a voz se perderia na
tradução entre etapas — que era exatamente o defeito do Reel antigo.

A voz é o relógio (`ReelV2` + `src/lib/narration-sync.ts`): cada cena começa no frame em
que a voz começa aquela frase. Então o roteiro **é** a edição. Texto comprido = vídeo
comprido; a correção é sempre **cortar texto**, nunca acelerar a voz.

---

## 1. Estrutura obrigatória — 5 cenas

Bate 1‑para‑1 com o motor: `ReelV2` renderiza capa + até 3 insights + CTA, e
`selectFootage(..., numClips = 5)` entrega **5 clipes distintos**, um por cena.

| # | Cena | O que tem de estar ali | Tamanho falado |
|---|------|------------------------|----------------|
| 1 | **GANCHO** (capa) | O escândalo em uma frase, já com **órgão + quantia**. Nada de aquecimento. Trava o dedo em 1–2s. | ≤ 45 chars |
| 2 | **O FATO** | O que aconteceu, com o número citável. O leitor tem de **reconhecer** a notícia. | ≤ 45 chars |
| 3 | **O MECANISMO** | Por que isso não é exceção: é o padrão da casta / do Estado que rouba. Liga o caso ao pilar. | ≤ 45 chars |
| 4 | **O ESPELHO** | **Obrigatório.** A lâmina vira contra o leitor: "e você paga, calado", "e você nem percebeu", "e você ainda agradece". Sem esta cena o Reel virou jornal. | ≤ 45 chars |
| 5 | **FECHO** (CTA) | A pergunta do dia + `Segue o Um País de Merda — amanhã o escândalo é outro.` | ≤ 40 chars + fecho fixo |

Regras de cena:

- **Uma ideia por cena.** Cena que precisa de vírgula pra respirar já é duas cenas.
- **Voz = tela**: a tela mostra exatamente o que a voz fala, palavra acendendo com a voz
  (legenda cinética). Nunca texto na tela que a voz não diz, nem o contrário.
- **Sem título-resumo genérico.** O gancho é o escândalo, não o tema perene.

Os papéis são a fonte única em `src/lib/reel-script.ts` (`ReelRoteiro`, `CAP`), com testes
de invariante. Antes, as cenas 2–4 eram os `slides[]` do prompt do carrossel ("insight
1/2/3 de 80 chars"), sem papel definido — daí saírem dois insights dizendo a mesma coisa e
nenhum espelho.

---

## 2. Duração — teto de 24s de fala

Ritmo medido da voz: **11,6 chars/seg**. O vídeo é a fala + 2s de respiro no card final
(`HOLD` em `video/ReelV2.tsx`).

- **Teto: 24s de fala = 278 chars falados no TOTAL** (`TETO_CHARS` em `reel-script.ts`),
  gancho + 3 cenas + pergunta + **fecho fixo**, tudo dentro da conta. Vídeo ≈ 26s.
- Os tetos por cena da tabela acima somados com o fecho cabem no teto — um roteiro
  bem-comportado passa inteiro e o corte nunca dispara (invariante testado).
- Estourou? Corta na ordem `mecanismo → fato`. **Nunca** o gancho, **nunca** o espelho,
  **nunca** a pergunta/fecho.

**O bug que isso corrigiu (31/07/2026):** o teto media só `postTitle + slides`; o
`fechoFalado` (pergunta + os 54 chars de "Segue o Um País de Merda — amanhã o escândalo é
outro.") era montado **depois** e nunca entrava na conta. Fala real ≈ 380 chars ≈ **33s** —
e, como o corte só via título + insights (até 295 chars > 232), ele derrubava o **3º
insight**, justamente onde mora o espelho. Medido nos Reels de 30/07: 26,3s e 29,0s.

---

## 3. Pauta — os 3 Reels do dia são SEMPRE do escândalo

Grade vigente (29/07/2026): **1 carrossel + 3 Reels**.

| Horário | Formato | run | slot | Deve ser |
|---------|---------|-----|------|----------|
| 09:17 | carrossel | 4 | tarde | **a espinha atemporal** (servidão voluntária) |
| 12:17 | Reel | 0 | manha | escândalo do dia |
| 17:17 | Reel | 1 | tarde | escândalo do dia |
| 19:47 | Reel | 2 | noite | escândalo do dia |

O livro (La Boétie, servidão voluntária) é o que impede a conta de virar jornal e morrer
quando a notícia esfria — mas esse papel é do **carrossel**, que é o formato que se salva e
se relê. O Reel vive de reconhecimento imediato: ele é vídeo de feed, tem 1 segundo pra
provar que fala do que a pessoa acabou de ver no noticiário.

A regra é `usaPautaNoFormato()` — por **formato**, não por slot. A regra antiga
(`slot !== "manha"`) era da grade velha: na grade de 29/07 o único slot `manha` é o Reel das
12:17, então a espinha atemporal caía num Reel e a pauta ia parar no único carrossel do dia.

O `topic` do Reel passou a ser a própria notícia (`noticia:<slug>`), não um dos 29 temas
perenes. Efeito colateral importante: 4 posts/dia × 7 dias queimavam 28 dos 29 temas na
janela anti-duplicata e o carrossel parava de sair; agora só o carrossel (1/dia) consome a
rotação perene.

Ainda sobre a pauta no Reel:

- **Órgão, quantia e fato APARECEM** (CGU, Receita, Congresso, "R$ 1,3 milhão"). Cobrado por
  código: `copyCobreCaso()` reprova a copy que não carrega o caso e manda regerar.
- **Nome de pessoa, partido ou sigla NUNCA.** `sanitizeNomesDePessoa()` troca "o ministro
  Fulano" por "o ministro" (corrige em vez de descartar) e `copyLeaksName()` fica de
  backstop, já com as entidades da própria manchete liberadas (`entidadesPermitidas`).
- Escândalo diferente por Reel no mesmo dia e entre dias: `pickNewsTopic(seed, usados)`
  pula o que já saiu (livro-razão + threading dos runs anteriores).

---

## 4. Voz

- Português do Brasil cru, de quem encheu o saco. Trata por "você" e vai pra cima.
- **O leitor é rebanho, não crítico.** Nunca escrever como se ele já estivesse revoltado.
  O choque é mostrar que ele é parte do problema: aceita calado, se acostuma, agradece.
- **Aumento gradual** é o tema irmão: cada abuso aceito em silêncio é a licença pro
  próximo, maior.
- Palavrão pontual quando aumenta o impacto, sempre mirando o sistema/a casta abstrata —
  **jamais** pessoa ou grupo. Sem xingamento de encher linguiça.
- **Caixa normal de frase** na copy (a tela já sobe pra maiúsculas sozinha). Nunca Title
  Case, nunca TUDO MAIÚSCULO.
- Frase falada é frase curta: sem oração subordinada, sem número escrito por extenso longo
  ("R$ 1,3 milhão" fala bem; "mil trezentos e cinquenta e sete reais" não).

---

## 5. Imagem

- Footage **só da whitelist curada** (`src/lib/footage-library.ts`) — nunca busca ao vivo
  em Pexels/Pixabay. 5 clipes distintos, 1 por cena, seguindo o arco de pilares
  (`beatPillars`): vítima → quem ganha → virada.
- **Contraste** é a alavanca: texto sobre imposto + imagem de jantar de luxo. O gap
  imagem↔texto é a denúncia — não a piada.
- Enquadramento fechado, um sujeito legível em <1s, com rosto/mãos em emoção ou movimento.
- **Proibido:** texto legível na tela do clipe, pessoa reconhecível, símbolo partidário,
  marco que grite "EUA" (Capitólio, bandeira).
- Sem repetir clipe dentro do Reel nem em Reels dos últimos **14 dias**
  (`recentClipUrls`).
- Grade da marca por cima de tudo: papel `#F4F0E8`, wash mono `#A45A5A`, grão + vinheta,
  acento de UI por pilar, Fraunces no texto.
- **Nunca publicar Reel preto**: cascata footage → ilustração (fal) → pular a publicação
  (`scripts/reel-media.cjs`).

---

## 6. Legenda

- 1ª linha repete o escândalo com órgão e valor (é o que aparece cortado no feed).
- Desenvolvimento curto ligando o caso ao padrão.
- Fecha **sempre** com: seguir `@umpaisdemerda` **com motivo na voz da marca** ("Segue se
  você prefere a verdade incômoda ao aplauso fácil" — não "siga para mais conteúdo"),
  salvar (🔖) e compartilhar (📩).
- 4–5 hashtags, base `#UmPaisDeMerda #ServidaoVoluntaria`.

---

## 7. Checklist de aprovação (antes de considerar o Reel bom)

1. Nos primeiros 2 segundos dá pra saber **qual escândalo** é? (órgão + número)
2. Tem a cena do **espelho**? A culpa chega no leitor, não só na casta?
3. Fala ≤ 20s / vídeo ≤ 28s?
4. A voz fala **exatamente** o que a tela mostra?
5. Zero nome de pessoa/partido?
6. 5 clipes diferentes, nenhum repetido nos últimos 14 dias, nenhum com texto legível?
7. A legenda fecha com o CTA de seguir com motivo?

---

## 8. O pipeline, etapa por etapa (onde cada uma mora)

| # | Etapa | Onde |
|---|-------|------|
| 1 | Buscar a notícia | `scripts/coletor-pauta.mjs` (cron 06:00 BRT) → `data/pauta-semana.json` |
| 2 | Escolher qual | `pickNewsTopic(seed, usados)` — pula o que já saiu (livro-razão + runs anteriores de hoje) |
| 3 | Crítica na voz **+** roteiro | `generateReelScript()` — uma geração só (crítica + 5 cenas + legenda) |
| 4 | Verificar | `sanitizeNomesDePessoa` → `copyLeaksName(campos, allow)` → `copyCobreCaso` — 2 tentativas |
| 5 | Gravar a voz | `generateNarration()` sobre `fala.segments` (voz = tela) |
| 6 | Legenda | sai na mesma geração da etapa 3 |
| 7 | Montar e publicar | footage curado → `ReelV2` (Remotion) → GitHub Release → `/api/publish-reel` |

**Observabilidade** (o que faltava e escondia tudo): o preview devolve `pauta`,
`newsFront` e `newsGuard`, e o servidor loga `[pauta] REEL run=N …` com a manchete usada,
o motivo de um descarte e o corte por teto. Se o Reel cair no tema perene, isso aparece —
antes acontecia calado. Os workflows também não dão mais verde falso: Reel `skipped` falha
e carrossel com `posts: []` emite warning.
