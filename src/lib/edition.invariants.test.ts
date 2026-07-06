// Invariante do Nº de edição: NUNCA repetir e NUNCA regredir.
// O bug era "Nº 102" em todo Reel (COUNT(posts) não andava pra Reels).
// pickNextEdition é a regra pura que decide o próximo número; editionFor a
// persiste por (dia,run) — mesmo número p/ ES e PT, idempotente em reruns.
import { describe, it, expect } from "vitest";
import { pickNextEdition } from "./edition";

describe("pickNextEdition (Nº monotônico, contínuo, sem repetir)", () => {
  it("continua de onde o esquema antigo estava (piso = COUNT posts)", () => {
    // editions vazio, 101 posts → próximo = 102 (não reinicia em 1)
    expect(pickNextEdition(0, 101)).toBe(102);
  });

  it("+1 sobre o maior já atribuído", () => {
    expect(pickNextEdition(102, 101)).toBe(103);
    expect(pickNextEdition(107, 101)).toBe(108);
  });

  it("nunca regride: usa o piso de posts quando ele é maior", () => {
    // se carrosséis fizeram posts crescer além das edições atribuídas
    expect(pickNextEdition(105, 110)).toBe(111);
  });

  it("é estritamente crescente ao aplicar em sequência", () => {
    let max = 0;
    const base = 101;
    const seen = new Set<number>();
    for (let i = 0; i < 20; i++) {
      const next = pickNextEdition(max, base);
      expect(seen.has(next)).toBe(false); // nunca repete
      expect(next).toBeGreaterThan(max);  // sempre sobe
      seen.add(next);
      max = next;
    }
    expect(max).toBe(base + 20);
  });

  it("tolera entradas inválidas (NaN) sem quebrar", () => {
    expect(pickNextEdition(NaN, 101)).toBe(102);
    expect(pickNextEdition(102, NaN)).toBe(103);
    expect(pickNextEdition(NaN, NaN)).toBe(1);
  });
});
