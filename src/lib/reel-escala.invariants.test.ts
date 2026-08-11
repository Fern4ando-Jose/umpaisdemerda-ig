import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import {
  FATOR_LARGURA,
  REEL_ALTURA_MANCHETE,
  REEL_LARGURA_UTIL,
  REEL_MARGEM_LATERAL,
  REEL_W,
  ocupacaoDoQuadro as ocupacaoCom,
  quebrarPorPalavra,
  tamanhoInsight,
  tamanhoManchete,
} from "./capa-escala";

// Invariantes da escala da letra NO REEL (portadas do dr-libertad-site em 11/08/2026).
// O defeito medido lá: a manchete ocupava 74–76% da largura do quadro, contra 85–95% nas
// contas de referência do nicho. Aqui o corpo era FIXO em 108 (capa) e 88 (insight), com
// `maxWidth: 920` — o mesmo defeito, sem ninguém ter medido.
//
// ⚠️ A conta destes testes é a MESMA que o vídeo usa, mas com o FATOR MÉDIO; o vídeo passa
// `measureText`. Teste que só confere consigo mesmo sempre fecha — a prova final é o quadro
// renderizado (`node scripts/medir-manchete.mjs`).

/** As frases são desta conta: sátira política PT-BR, do catálogo `THEMES`. */
const FRASES = [
  "Ninguém te escraviza: você entrega a chave todo dia",
  "O tirano só é forte porque você ajoelha",
  "Pare de obedecer e o trono cai sozinho",
  "Reclama da coleira, mas é você que segura a guia",
  "Eles não governam o país: governam o seu bolso",
  "O gado reclama do curral mas tem medo do portão aberto",
];

/** A capa manda a manchete em CAIXA ALTA — é assim que ela é medida no vídeo. */
const comoNaTela = (t: string) => t.toUpperCase();

function ocupacaoDoQuadro(t: string): number {
  const alta = comoNaTela(t);
  return ocupacaoCom(alta, tamanhoManchete(alta));
}

describe("a margem lateral do Reel", () => {
  it("deixa a régua de 85% ALCANÇÁVEL — com 90px de cada lado ela não era", () => {
    // Com a margem antiga (90, que era a daqui), o teto absoluto era 900/1080 = 83,3%: nem
    // a frase perfeita chegaria a 85%. Este é o teste que explica por que a margem mudou.
    expect((REEL_W - 2 * 90) / REEL_W).toBeLessThan(0.85);
    expect(REEL_LARGURA_UTIL / REEL_W).toBeGreaterThanOrEqual(0.9);
    expect(REEL_MARGEM_LATERAL).toBeLessThan(90);
  });
});

describe("a manchete do Reel enche a largura", () => {
  it("fica na faixa das contas de referência (85–96% do quadro)", () => {
    for (const t of FRASES) {
      const o = ocupacaoDoQuadro(t);
      expect(o, `${t} → ${(o * 100).toFixed(1)}%`).toBeGreaterThanOrEqual(0.85);
      expect(o, `${t} → ${(o * 100).toFixed(1)}%`).toBeLessThanOrEqual(0.96);
    }
  });

  it("ocupa mais quadro que o tamanho fixo de 108px que estava em produção", () => {
    // A régua é OCUPAÇÃO, não corpo de letra. Antes: corpo fixo de 108 numa caixa de 920px
    // (`maxWidth` do KineticText), com margem de 90 de cada lado.
    for (const t of FRASES) {
      const antes = ocupacaoCom(comoNaTela(t), 108, 920);
      expect(ocupacaoDoQuadro(t), `${t}: antes ${(antes * 100).toFixed(1)}%`).toBeGreaterThan(antes);
    }
  });

  it("corpo MAIOR nem sempre é ocupação maior — a armadilha que o quadro revelou", () => {
    // Com quebra por palavra a ocupação SOBE E DESCE conforme o corpo: subir dois pixels
    // pode empurrar uma palavra inteira para a linha seguinte e encurtar a linha mais
    // longa. É por isso que "o maior corpo que cabe" não serve, e por isso a busca precisa
    // varrer. Se este teste falhar, alguém trocou a busca por uma fórmula fechada — e a
    // peça volta a sair com um terço do quadro vazio.
    const t = comoNaTela("Pare de obedecer e o trono cai sozinho");
    const serie: number[] = [];
    for (let s = 60; s <= 190; s += 2) serie.push(ocupacaoCom(t, s));
    expect(serie.some((v, i) => i > 0 && v < serie[i - 1])).toBe(true);
    // E o corpo escolhido não é o teto: é o maior que ainda cumpre a régua.
    expect(tamanhoManchete(t)).toBeLessThan(190);
  });

  it("nunca estoura a faixa de altura reservada", () => {
    for (const t of [...FRASES.map(comoNaTela), "palavra ".repeat(20)]) {
      const q = quebrarPorPalavra(t, tamanhoManchete(t), REEL_LARGURA_UTIL, FATOR_LARGURA.fraunces);
      expect(q.altura, t.slice(0, 24)).toBeLessThanOrEqual(REEL_ALTURA_MANCHETE);
    }
  });

  it("palavra longa sozinha não vaza da largura útil", () => {
    const t = comoNaTela("Inconstitucionalissimamente desgovernado");
    const q = quebrarPorPalavra(t, tamanhoManchete(t), REEL_LARGURA_UTIL, FATOR_LARGURA.fraunces);
    expect(q.larguraMaxima).toBeLessThanOrEqual(REEL_LARGURA_UTIL);
  });
});

describe("o insight segue a mesma régua", () => {
  it("ocupa mais quadro que o 88px fixo e cabe na faixa livre", () => {
    for (const t of ["O algoritmo decide por você quando você não decide", "A casta nunca entra em crise"]) {
      const s = tamanhoInsight(t);
      expect(ocupacaoCom(t, s), t).toBeGreaterThan(ocupacaoCom(t, 88, 920));
      expect(quebrarPorPalavra(t, s, REEL_LARGURA_UTIL, FATOR_LARGURA.fraunces).altura).toBeLessThanOrEqual(
        REEL_ALTURA_MANCHETE,
      );
    }
  });
});

describe("a largura vem da FONTE, não de uma média (2026-08-11)", () => {
  it("o vídeo passa um medidor real para a conta — sem ele, a régua não se cumpre", () => {
    // Medido no DR em 8 manchetes reais, em quadro renderizado: com a estimativa por
    // caractere só 5 de 8 ficavam em 85–96% e a pior caía a 70,6%; com `measureText`, 8 de
    // 8 entre 86,6% e 88,0%. Se este teste falhar, alguém tirou a medição real do caminho.
    const reelV2 = readFileSync(join(__dirname, "..", "..", "video", "ReelV2.tsx"), "utf8");
    expect(reelV2).toMatch(/measureText\(\{[\s\S]*?fontFamily: FRAUNCES/);
    expect(reelV2).toMatch(/tamanhoManchete\(manchete, medirFraunces\)/);
    expect(reelV2).toMatch(/tamanhoInsight\(text, medirFraunces\)/);
  });

  it("mede com a MESMA fonte e o MESMO peso com que desenha", () => {
    // Medir com uma fonte e desenhar com outra é voltar a estimar, só que pior. A frase é
    // desenhada em Fraunces 800 — o medidor tem de dizer exatamente isso.
    const reelV2 = readFileSync(join(__dirname, "..", "..", "video", "ReelV2.tsx"), "utf8");
    expect(reelV2).toMatch(/fontFamily: FRAUNCES, fontSize: size, fontWeight: 800/);
    expect(reelV2).toMatch(/fontFamily: FRAUNCES, fontWeight: 800, fontSize/);
  });

  it("a conta ACEITA um medidor e o usa em vez do fator médio", () => {
    // Medidor de mentira: toda palavra tem 100px. A quebra tem de obedecer a ele.
    const q = quebrarPorPalavra("uma frase de teste aqui", 100, 500, FATOR_LARGURA.fraunces, () => 100);
    // 500px de largura, cada palavra custa 100 + espaço (26) = 126 → 3 por linha.
    expect(q.linhas[0].split(" ")).toHaveLength(3);
  });
});
