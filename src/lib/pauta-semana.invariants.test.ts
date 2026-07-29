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

  it("dos 4 runs diários (carrossel tarde, reel manha, reel tarde, reel noite) exatamente 3 usam", () => {
    // Grade 29/07/2026: carrossel 09:17 (tarde) · reel 12:17 (manha, a espinha
    // atemporal) · reel 17:17 (tarde) · reel 19:47 (noite).
    const slotsDoDia = ["tarde", "manha", "tarde", "noite"];
    expect(slotsDoDia.filter(usaPautaNoSlot).length).toBe(3);
  });
});

describe("guarda apartidária — nome de pessoa e partido NUNCA; órgão e fato APARECEM", () => {
  it("barra sigla de partido", () => {
    expect(copyLeaksName(["O PT aprovou mais um aumento"])).toBe(true);
  });

  it("barra cargo + nome próprio", () => {
    expect(copyLeaksName(["o ministro Fulano decidiu sozinho"])).toBe(true);
  });

  it("barra nome próprio composto (par de Capitalizadas fora do vocabulário)", () => {
    expect(copyLeaksName(["Jair Messias assinou o decreto"])).toBe(true);
    expect(copyLeaksName(["Lula Silva prometeu de novo"])).toBe(true);
  });

  it("LIBERA instituição nomeada — sem o órgão o escândalo não é reconhecível (ordem do dono 29/07)", () => {
    expect(copyLeaksName(["o STF decidiu em segredo"])).toBe(false);
    expect(copyLeaksName(["O INSS deixou sumir R$ 547 milhões e ninguém foi preso"])).toBe(false);
    expect(copyLeaksName(["A Receita Federal perdeu o controle do próprio cofre"])).toBe(false);
    expect(copyLeaksName(["O Congresso Nacional votou o próprio aumento"])).toBe(false);
  });

  it("libera a régua da marca (termos abstratos em maiúscula)", () => {
    expect(copyLeaksName(["A Servidão Voluntária é o contrato que ninguém leu"])).toBe(false);
  });
});
