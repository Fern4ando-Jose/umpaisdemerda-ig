// ─── A CONTA DA MANCHETE: encher a largura sem estourar a altura ──────────────
// PORTADO do dr-libertad-site em 2026-08-11 (ordem do dono: *"aplicando todas as
// mudanças igual está atual no DR liberdade"*). Lá a conta nasceu porque a manchete
// ocupava 74–76% da largura do quadro, contra 85–95% das contas de referência do nicho:
// letra pequena no feed é letra que ninguém lê no dedo, e o primeiro segundo é onde a
// pessoa decide ficar ou passar.
//
// AQUI o ReelV2 usava corpo FIXO (108 na capa, 88 nos insights) com `maxWidth: 920` —
// ou seja, frase curta saía minúscula e frase longa vazava a altura. Esta peça troca o
// número fixo pelo maior corpo que ENCHE a largura útil.
//
// ⚠️ O QUE **NÃO** VEIO DO DR, de propósito (a voz é desta conta): a FONTE. O Dr.
// Liberdade trocou a frase para Anton (condensada) em 09/08; o Um País de Merda escreve
// em **Fraunces 800**, que é a assinatura do "jornal satírico" travada na linha editorial
// desta marca. A conta abaixo é agnóstica de fonte — quem chama passa como medir.

/**
 * Largura média de um caractere, em fração do corpo da fonte. Só entra em jogo quando
 * NÃO há medição real (testes puros, chamador sem navegador).
 *
 * ⚠️ `fraunces` é uma ESTIMATIVA INICIAL, não um número medido em quadro: a Fraunces 800
 * é bem mais larga que a Anton condensada (0,46 no DR). No vídeo isto não é usado — o
 * `ReelV2` passa `measureText`, a métrica da própria fonte. Trocar este valor exige
 * `node scripts/medir-manchete.mjs` num quadro renderizado, nunca palpite.
 */
export const FATOR_LARGURA = {
  fraunces: 0.62,
} as const;

// ─── A geometria do REEL (1080×1920) ──────────────────────────────────────────
// A margem lateral era 90px de cada lado → largura útil 900px, ou seja **83,3% do quadro
// no melhor caso possível**: com 90px a régua de 85% era inalcançável mesmo com a frase
// perfeita. Com 40px a largura útil vai a 1000px (92,6% do quadro) e a faixa 85–96% passa
// a existir. Medido no DR antes de vir para cá.
export const REEL_W = 1080;
export const REEL_MARGEM_LATERAL = 40;
export const REEL_LARGURA_UTIL = REEL_W - 2 * REEL_MARGEM_LATERAL; // 1000

// ─── ONDE O TEXTO FICA ────────────────────────────────────────────────────────
// Ancorado EMBAIXO, logo acima do @handle — que é como o carrossel desta conta já faz
// (ordem do dono no DR, 11/08: *"o texto do reel deveria descer igual ao do carrossel"*;
// no grid do perfil, Reel com texto no alto destoa dos vizinhos). O ReelV2 do UPM já
// ancorava embaixo por `padding-bottom`; aqui a âncora vira número declarado, igual nas
// duas telas (capa e insight), para a peça inteira ter uma cara só.
export const REEL_TEXTO_BOTTOM = 380; // base do bloco: y = 1920 − 380 = 1540, acima do @
export const REEL_ALTURA_MANCHETE = 740;

/** Espaço entre palavras, em fração do corpo da fonte (o `marginRight` do KineticText). */
export const ESPACO_ENTRE_PALAVRAS = 0.26;
/** Entrelinha do bloco de texto do Reel (o `lineHeight` do KineticText). */
export const ENTRELINHA = 1.12;

export interface Quebra {
  linhas: string[];
  /** Largura da linha mais LONGA, em px — é ela que define a ocupação do quadro. */
  larguraMaxima: number;
  altura: number;
}

/**
 * Como medir a largura de uma palavra. O padrão é a ESTIMATIVA (nº de letras × fator),
 * que é o que dá para fazer sem navegador — serve aos testes e a qualquer chamador puro.
 *
 * ⛔ 2026-08-11 — MAS A ESTIMATIVA ERRA, e com número: no DR, medindo 8 manchetes REAIS em
 * quadro renderizado, só **5 ficaram na régua** de 85–96% e a pior deu **70,6%**. O fator é
 * uma média: frase cheia de letra estreita (i, l, t, r) mede muito menos que a conta prevê,
 * sobra margem à direita e a régua vai ao chão. Com `measureText` do Remotion não há
 * estimativa nenhuma no caminho — é a métrica da fonte, naquele corpo.
 */
export type MedirPalavra = (palavra: string, size: number) => number;

/**
 * Simula a quebra de linha do navegador: gulosa, POR PALAVRA.
 *
 * ⚠️ Quebrar por CARACTERE (a 1ª tentativa no DR) previu 88% e o quadro entregou 69%: o
 * navegador não corta palavra ao meio, então a linha fica curta com o corpo no máximo —
 * o pior dos dois mundos.
 *
 * ⚠️ CADA palavra carrega o seu espaço à direita, inclusive a última da linha: no
 * `KineticText` o espaço é `marginRight` em TODO pedaço, e o navegador soma essa margem ao
 * decidir se a próxima cabe. Modelar o espaço só ENTRE palavras fazia a conta acreditar que
 * cabia mais uma — previsto 90%, entregue 72%.
 */
export function quebrarPorPalavra(
  text: string,
  size: number,
  maxWidth: number,
  fator: number,
  medir?: MedirPalavra,
): Quebra {
  const palavras = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const espaco = ESPACO_ENTRE_PALAVRAS * size;
  const custo = (w: string) => (medir ? medir(w, size) : w.length * fator * size) + espaco;
  const linhas: string[] = [];
  const larguras: number[] = [];
  let atual = "";
  let ocupado = 0; // com o espaço à direita incluído
  for (const p of palavras) {
    const c = custo(p);
    if (!atual) {
      atual = p;
      ocupado = c;
    } else if (ocupado + c <= maxWidth) {
      atual += ` ${p}`;
      ocupado += c;
    } else {
      linhas.push(atual);
      larguras.push(ocupado - espaco); // a tinta visível não inclui a margem final
      atual = p;
      ocupado = c;
    }
  }
  if (atual) {
    linhas.push(atual);
    larguras.push(ocupado - espaco);
  }
  return {
    linhas,
    larguraMaxima: larguras.length ? Math.max(...larguras) : 0,
    altura: linhas.length * size * ENTRELINHA,
  };
}

/**
 * A régua das contas de referência: a letra ocupa de 85% a 96% da largura do quadro.
 *
 * ⚠️ Subir este número para "compensar" a estimativa foi TENTADO no DR e PIOROU: com 0,89
 * nenhum corpo alcançava o alvo, a busca caía no plano B e a ocupação real desabava para
 * 71,4%. Alvo inalcançável não é rigor — é desligar a regra. Item fora da régua se fecha
 * com amostra MEDIDA (`scripts/medir-manchete.mjs`), nunca apertando o alvo no escuro.
 */
export const OCUPACAO_ALVO = 0.85;

/**
 * O MAIOR corpo de letra que ainda cumpre a régua de ocupação, dentro da altura livre.
 *
 * Duas armadilhas, as duas descobertas medindo quadro renderizado e não estimativa:
 *   1. escolher o maior corpo que CABE não é escolher o mais CHEIO — com quebra por
 *      palavra, subir o corpo empurra uma palavra inteira para a linha seguinte e ENCOLHE
 *      a linha mais longa (corpo 170 deu 69% onde corpo 116 dá 90%);
 *   2. só maximizar a ocupação leva ao extremo oposto — o corpo despenca para letra miúda
 *      porque frase longa "encaixa" melhor pequena.
 * Critério: do maior para o menor, fica com o PRIMEIRO que atinge o alvo; se nenhum
 * atingir, o de maior ocupação (degrada para o melhor disponível, nunca em silêncio fora
 * da régua sem que o medidor consiga apontar).
 */
export function tamanhoQueEnche(
  text: string,
  maxWidth: number,
  maxAlturaPx: number,
  teto = 190,
  piso = 56,
  fator: number = FATOR_LARGURA.fraunces,
  alvoDoQuadro: number = OCUPACAO_ALVO,
  quadro: number = REEL_W,
  medir?: MedirPalavra,
): number {
  const alvo = (alvoDoQuadro * quadro) / maxWidth;
  let melhor = piso;
  let melhorEnche = -1;
  for (let s = teto; s >= piso; s -= 2) {
    const q = quebrarPorPalavra(text, s, maxWidth, fator, medir);
    // Palavra que não cabe sozinha na linha vaza para fora do quadro.
    if (q.larguraMaxima > maxWidth) continue;
    if (maxAlturaPx > 0 && q.altura > maxAlturaPx) continue;
    const enche = q.larguraMaxima / maxWidth;
    if (enche >= alvo) return s; // o maior corpo que cumpre a régua
    if (enche > melhorEnche + 1e-9) {
      melhorEnche = enche;
      melhor = s;
    }
  }
  return melhor;
}

/** Quanto da largura do QUADRO a frase ocupa com esse corpo — a régua das contas de referência. */
export function ocupacaoDoQuadro(
  text: string,
  size: number,
  maxWidth = REEL_LARGURA_UTIL,
  quadro = REEL_W,
  medir?: MedirPalavra,
): number {
  return quebrarPorPalavra(text, size, maxWidth, FATOR_LARGURA.fraunces, medir).larguraMaxima / quadro;
}

/** O tamanho da manchete da CAPA do Reel. `medir` = largura real da fonte, quando houver. */
export function tamanhoManchete(title: string, medir?: MedirPalavra): number {
  return tamanhoQueEnche(title, REEL_LARGURA_UTIL, REEL_ALTURA_MANCHETE, 190, 56, FATOR_LARGURA.fraunces, OCUPACAO_ALVO, REEL_W, medir);
}

/** O tamanho de cada insight do Reel — mesma largura útil, teto um pouco menor. */
export function tamanhoInsight(text: string, medir?: MedirPalavra): number {
  return tamanhoQueEnche(text, REEL_LARGURA_UTIL, REEL_ALTURA_MANCHETE, 170, 52, FATOR_LARGURA.fraunces, OCUPACAO_ALVO, REEL_W, medir);
}
