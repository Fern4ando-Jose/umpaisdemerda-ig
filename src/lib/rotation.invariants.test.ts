import { describe, it, expect } from "vitest";
import { buildRotation, topicIndexForRun, slotForRun, pickFreshTopicIndex } from "./rotation";

// Espelha THEMES[].cat de api/publish/route.ts (51 temas, em ordem). Se THEMES
// mudar, atualizar aqui. O bug antigo: reembaralho semanal repetia o mesmo tema
// em 1–3 dias e a anti-dup de 7d bloqueava o post. Estes testes barram a volta.
const CATS = ["dopamine","dopamine","dopamine","anxiety","dopamine","dopamine","dopamine","mind","self","network","network","network","network","network","dopamine","network","network","network","network","network","network","network","network","anxiety","freedom","self","network","self","freedom","self","anxiety","freedom","mind","self","freedom","self","anxiety","freedom","anxiety","self","dopamine","freedom","freedom","freedom","anxiety","freedom","freedom","freedom","self","anxiety","freedom"];

describe("rotação — sem repetição antes de fechar o ciclo", () => {
  it("buildRotation é uma permutação válida (cada índice exatamente 1×)", () => {
    const rot = buildRotation(CATS);
    expect(rot.length).toBe(CATS.length);
    expect(new Set(rot).size).toBe(CATS.length);
    expect([...rot].sort((a, b) => a - b)).toEqual(CATS.map((_, i) => i));
  });

  it("nenhum tema repete dentro de N posts (gap ≥ ciclo ≈ 8,5 dias > anti-dup 7d)", () => {
    const rot = buildRotation(CATS);
    const N = rot.length;
    const seq: number[] = [];
    const base = new Date(Date.UTC(2026, 5, 16, 12, 0, 0));
    for (let d = 0; d < 60; d++) {
      const date = new Date(base.getTime() + d * 86400000);
      for (let r = 0; r < 6; r++) seq.push(topicIndexForRun(rot, date, r));
    }
    // toda janela de N slots consecutivos tem N temas DISTINTOS (zero repetição no ciclo)
    for (let i = 0; i + N <= seq.length; i++) {
      expect(new Set(seq.slice(i, i + N)).size).toBe(N);
    }
  });

  it("intercala categorias — nenhum cat aparece > 3× num dia (janela de 6)", () => {
    const rot = buildRotation(CATS);
    let worst = 0;
    for (let s = 0; s < rot.length; s++) {
      const counts: Record<string, number> = {};
      for (let k = 0; k < 6; k++) {
        const cat = CATS[rot[(s + k) % rot.length]];
        counts[cat] = (counts[cat] || 0) + 1;
        worst = Math.max(worst, counts[cat]);
      }
    }
    expect(worst).toBeLessThanOrEqual(3); // o esquema antigo dava 4 (ex.: 4 dopamina/network no dia)
  });

  it("determinística — mesma entrada, mesma ordem (ES e PT batem)", () => {
    expect(buildRotation(CATS)).toEqual(buildRotation(CATS));
  });
});

// TRAVA ANTI-DUP REAL (cross-formato). A rotação determinística sozinha NÃO
// impedia repetição: trocar o algoritmo no meio do ciclo, ou o Reel não gravar o
// tópico, fazia o MESMO tema sair Reel num dia e carrossel no outro ("El padre
// ausente": reel 21/06 + carrossel 22/06). pickFreshTopicIndex pula o que saiu
// nos últimos 7d em QUALQUER formato → repetição impossível.
describe("pickFreshTopicIndex — não repete tema usado recentemente", () => {
  const n = 51;
  const rot = Array.from({ length: n }, (_, i) => i); // a propriedade não depende da permutação

  it("sem recentes → tema-base do slot", () => {
    expect(pickFreshTopicIndex(rot, 10, new Set())).toBe(10);
  });

  it("pula o(s) recente(s) e devolve o próximo livre", () => {
    expect(pickFreshTopicIndex(rot, 10, new Set([10]))).toBe(11);
    expect(pickFreshTopicIndex(rot, 10, new Set([10, 11, 12]))).toBe(13);
  });

  it("NUNCA devolve um tema usado (salvo se todos usados)", () => {
    const used = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    for (let s = 0; s < n; s++) {
      expect(used.has(pickFreshTopicIndex(rot, s, used))).toBe(false);
    }
  });

  it("regressão 'padre ausente': tema de ontem não reaparece hoje no seu slot", () => {
    const padre = 30;            // saiu ontem (Reel) → está nos recentes
    const used = new Set([padre]);
    expect(pickFreshTopicIndex(rot, padre, used)).not.toBe(padre);
  });

  it("simulação 14 dias × 6/dia com janela 7d (42 slots) → ZERO repetição em 7d", () => {
    const realRot = buildRotation(CATS);
    const history: number[] = [];
    for (let day = 0; day < 14; day++) {
      for (let run = 0; run < 6; run++) {
        const used = new Set(history.slice(-42)); // últimos 7 dias (qualquer formato)
        const idx = pickFreshTopicIndex(realRot, day * 6 + run, used);
        expect(used.has(idx)).toBe(false); // nunca repete dentro de 7d
        history.push(idx);
      }
    }
  });

  it("slotForRun é contínuo (dia avança 6 slots)", () => {
    const d1 = new Date(Date.UTC(2026, 5, 21, 12));
    const d2 = new Date(Date.UTC(2026, 5, 22, 12));
    expect(slotForRun(d2, 0) - slotForRun(d1, 0)).toBe(6);
  });

  // Threading intra-dia (igual ao getFreshTopicForRun): com base de recentes DENSA
  // (pior caso), os 6 runs do dia avançariam todos p/ o mesmo "1º livre" se não
  // houvesse threading. Incluindo os picks anteriores no `used`, saem 6 DISTINTOS —
  // sem depender da ordem/timing de gravação (robusto a re-disparo do catchup).
  it("threading intra-dia → 6 runs do dia DISTINTOS, nenhum recente", () => {
    const realRot = buildRotation(CATS);
    const baseUsed = new Set<number>();
    for (let i = 0; i < 20; i++) baseUsed.add(i); // 20 recentes (força avanço)
    const day = 200;
    const used = new Set(baseUsed);
    const picks: number[] = [];
    for (let run = 0; run < 6; run++) {
      const idx = pickFreshTopicIndex(realRot, day * 6 + run, used);
      used.add(idx);
      picks.push(idx);
    }
    expect(new Set(picks).size).toBe(6);            // 6 distintos (sem colisão)
    for (const p of picks) expect(baseUsed.has(p)).toBe(false); // nenhum recente
  });
});
