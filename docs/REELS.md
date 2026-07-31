# Régua do REEL — @umpaisdemerda

**Fonte única de como o Reel deve ser.** Os posts (carrossel) já foram redefinidos em
27–29/07/2026 (escândalo do dia com órgão, valor e fato citáveis + o espelho do rebanho).
O Reel **ainda sai no modo antigo**: ele é hoje um *carrossel narrado* — mesma copy, mesmo
prompt, mesma cabeça de post estático — e por isso perde o escândalo, perde o espelho e
estoura a duração. Este documento diz **como deve ser**.

Onde o código já implementa a régua, está anotado. Onde ele ainda contraria, está marcado
como **[ANTIGO]** com o delta exato.

---

## 0. Regra-mãe

> **O Reel é um ROTEIRO FALADO de 5 cenas sobre o escândalo do dia. Não é um post lido em
> voz alta.**

A voz é o relógio (`ReelV2` + `src/lib/narration-sync.ts`): cada cena começa no frame em
que a voz começa aquela frase. Então o roteiro **é** a edição. Texto comprido = vídeo
comprido; a correção é sempre **cortar texto**, nunca acelerar a voz.

---

## 1. Estrutura obrigatória — 5 cenas

Bate 1‑para‑1 com o motor: `ReelV2` renderiza capa + até 3 insights + CTA, e
`selectFootage(..., numClips = 5)` entrega **5 clipes distintos**, um por cena.

| # | Cena | O que tem de estar ali | Tamanho falado |
|---|------|------------------------|----------------|
| 1 | **GANCHO** (capa) | O escândalo em uma frase, já com **órgão + quantia**. Nada de aquecimento. Trava o dedo em 1–2s. | ≤ 55 chars |
| 2 | **O FATO** | O que aconteceu, com o número citável. O leitor tem de **reconhecer** a notícia. | ≤ 70 chars |
| 3 | **O MECANISMO** | Por que isso não é exceção: é o padrão da casta / do Estado que rouba. Liga o caso ao pilar. | ≤ 70 chars |
| 4 | **O ESPELHO** | **Obrigatório.** A lâmina vira contra o leitor: "e você paga, calado", "e você nem percebeu", "e você ainda agradece". Sem esta cena o Reel virou jornal. | ≤ 70 chars |
| 5 | **FECHO** (CTA) | A pergunta do dia + `Segue o Um País de Merda — amanhã o escândalo é outro.` | ≤ 100 chars + fecho fixo |

Regras de cena:

- **Uma ideia por cena.** Cena que precisa de vírgula pra respirar já é duas cenas.
- **Voz = tela**: a tela mostra exatamente o que a voz fala, palavra acendendo com a voz
  (legenda cinética). Nunca texto na tela que a voz não diz, nem o contrário.
- **Sem título-resumo genérico.** O gancho é o escândalo, não o tema perene.

**[ANTIGO]** hoje as cenas 2–4 são os `slides[]` do prompt do carrossel ("insight 1/2/3 de
80 chars"), sem papel definido. Resultado: dois insights dizendo a mesma coisa e nenhum
espelho. O delta é um bloco de roteiro **próprio do Reel** em `generateContent` (ou uma
`generateReelScript`), com estes 5 papéis nomeados.

---

## 2. Duração — teto real de 20s de fala

Ritmo medido da voz: **11,6 chars/seg**. O vídeo é a fala + 2s de respiro no card final
(`HOLD` em `video/ReelV2.tsx`).

- **Alvo: 18–24s de vídeo.** Nunca passar de 28s.
- Teto de roteiro: **≈ 230 chars falados no TOTAL** — gancho + 3 cenas + pergunta +
  fecho fixo, tudo dentro da conta.
- Estourou? Corta o texto de trás pra frente, **nunca** o espelho (cena 4) e **nunca** o
  fecho.

**[ANTIGO] — bug ativo.** Em `src/app/api/publish/route.ts` o teto conta só
`postTitle + slides`:

```
const TETO_CHARS = Math.round(20 * 11.6);           // 232 chars
const tamanhoRoteiro = (ss) => [content.postTitle, ...ss].join(" ").length;
```

O `fechoFalado` (pergunta de 60–100 chars + os 46 chars de "Segue o Um País de Merda —
amanhã o escândalo é outro.") é montado **depois** e nunca entra na conta. Fala real ≈
232 + 150 = **~380 chars ≈ 33s**, mais 2s de hold. É exatamente o Reel de 32s que o
comentário do código diz ter corrigido. Dois efeitos:

1. o Reel sai longo demais pro pico de retenção;
2. como o corte só vê título + insights (até 55 + 3×80 = 295 chars > 232), ele **derruba o
   3º insight** — que é justamente onde o espelho deveria estar.

Delta: incluir o fecho no `tamanhoRoteiro` e baixar o teto por cena (tabela acima), pra o
corte sobrar nas cenas descartáveis, não no espelho.

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

**[ANTIGO]** `usaPautaNoSlot()` em `src/lib/pauta-semana.ts` devolve `slot !== "manha"` —
regra escrita para a grade velha (4 posts, o primeiro do dia era carrossel). Na grade nova
o único slot `manha` é o **Reel das 12:17**: ou seja, 1 dos 3 Reels sai atemporal e o único
carrossel do dia sai com pauta — exatamente ao contrário. Delta: a regra passa a ser por
**formato**, não por slot — Reel sempre com pauta, carrossel sempre atemporal.

Ainda sobre a pauta no Reel:

- **Órgão, quantia e fato APARECEM** (CGU, Receita, Congresso, "R$ 1,3 milhão"). Sem isso a
  pesquisa é invisível e o Reel podia ser de qualquer dia.
- **Nome de pessoa, partido ou sigla NUNCA** — "o ministro", "a excelência", "o partido da
  vez". Backstop de código: `copyLeaksName()` rejeita e o run cai no tema fixo.
- Escândalo diferente por Reel no mesmo dia (seed por `dia|run` em `pickNewsTopic`).

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
- **Contraste irônico** é a alavanca: texto amargo sobre imposto + imagem de jantar de
  luxo. O gap imagem↔texto é a piada.
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

## 8. Deltas de código pendentes (o que ainda faz o Reel sair antigo)

| # | Arquivo | Hoje | Deve ser |
|---|---------|------|----------|
| 1 | `src/app/api/publish/route.ts` (`generateContent`) | Reel usa o prompt do carrossel; `slides[]` sem papel | Bloco de roteiro do Reel com os 5 papéis (gancho/fato/mecanismo/espelho/fecho) |
| 2 | `src/app/api/publish/route.ts` (`TETO_CHARS`) | Fecho falado fora da conta → ~33s | Fecho dentro da conta; corte nunca derruba o espelho |
| 3 | `src/lib/pauta-semana.ts` (`usaPautaNoSlot`) | Regra por slot → o Reel das 12:17 sai atemporal | Regra por formato: Reel sempre com pauta, carrossel atemporal |

Enquanto os três não entrarem, o Reel continua saindo no modo antigo mesmo com a copy dos
posts já redefinida.
