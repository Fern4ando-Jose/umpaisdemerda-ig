import { describe, it, expect } from "vitest";
import { usaPautaNoSlot, copyLeaksName } from "./pauta-semana";

// Invariantes da PAUTA QUENTE (TRABALHO.md, bloco `pauta:`).
// A regra do dono (27/07/2026): 3 das 4 publicações do dia nascem do noticiário;
// a 1ª do dia fica atemporal. Aqui se trava a regra e o backstop que protege a conta.
describe("pauta quente — quais publicações usam manchete", () => {
  it("a 1ª do dia (manha) NÃO usa manchete — é a espinha atemporal", () => {
    expect(usaPautaNoSlot("manha")).toBe(false);
  });

  it("tarde e noite usam manchete", () => {
    expect(usaPautaNoSlot("tarde")).toBe(true);
    expect(usaPautaNoSlot("noite")).toBe(true);
  });

  it("dos 4 runs diários (reel manha, reel tarde, post tarde, post noite) exatamente 3 usam", () => {
    const slotsDoDia = ["manha", "tarde", "tarde", "noite"];
    expect(slotsDoDia.filter(usaPautaNoSlot).length).toBe(3);
  });
});

describe("guarda apartidária — a copy não pode entregar a manchete", () => {
  it("barra sigla de partido", () => {
    expect(copyLeaksName(["O PT aprovou mais um aumento"])).toBe(true);
  });

  it("barra cargo + nome próprio", () => {
    expect(copyLeaksName(["o ministro Fulano decidiu sozinho"])).toBe(true);
  });

  it("barra instituição nomeada", () => {
    expect(copyLeaksName(["o STF decidiu em segredo"])).toBe(true);
  });

  it("libera a régua da marca (termos abstratos em maiúscula)", () => {
    expect(copyLeaksName(["A Servidão Voluntária é o contrato que ninguém leu"])).toBe(false);
  });
});
