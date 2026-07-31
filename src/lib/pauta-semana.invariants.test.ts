import { describe, it, expect } from "vitest";
import {
  usaPautaNoFormato, copyLeaksName, sanitizeNomesDePessoa, entidadesPermitidas,
  copyCobreCaso, pickNewsTopic, newsSlug,
} from "./pauta-semana";

// Invariantes da PAUTA QUENTE. Regra do dono (27/07/2026): "a crítica deve ser sobre
// o escândalo do governo, que cada dia tem coisa diferente". A divisão passou a ser
// por FORMATO em 31/07/2026 (ver pauta-semana.ts).
describe("quais publicações nascem do noticiário", () => {
  it("REEL sempre nasce da notícia", () => {
    expect(usaPautaNoFormato("reel")).toBe(true);
  });

  it("CARROSSEL é a espinha atemporal", () => {
    expect(usaPautaNoFormato("carrossel")).toBe(false);
  });

  it("dos 4 posts do dia (1 carrossel + 3 reels) exatamente 3 usam pauta", () => {
    const grade = ["carrossel", "reel", "reel", "reel"] as const;
    expect(grade.filter(usaPautaNoFormato).length).toBe(3);
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

  it("LIBERA instituição nomeada — sem o órgão o escândalo não é reconhecível", () => {
    expect(copyLeaksName(["o STF decidiu em segredo"])).toBe(false);
    expect(copyLeaksName(["O INSS deixou sumir R$ 547 milhões e ninguém foi preso"])).toBe(false);
    expect(copyLeaksName(["A Receita Federal perdeu o controle do próprio cofre"])).toBe(false);
    expect(copyLeaksName(["O Congresso Nacional votou o próprio aumento"])).toBe(false);
  });

  it("libera a régua da marca (termos abstratos em maiúscula)", () => {
    expect(copyLeaksName(["A Servidão Voluntária é o contrato que ninguém leu"])).toBe(false);
  });

  // 31/07/2026: a guarda derrubava 6 de 13 manchetes da pauta do dia — o post citava
  // o caso, ela via "par de maiúsculas" e mandava refazer SEM a notícia.
  it("libera entidade institucional da própria manchete", () => {
    const h = "Três presos na Operação Brasil Contra o Crime Organizado";
    const allow = entidadesPermitidas(h);
    expect(copyLeaksName(["A Operação Brasil Contra o Crime prendeu três"], allow)).toBe(false);
    expect(copyLeaksName(["A Operação Brasil Contra o Crime prendeu três"])).toBe(true); // sem allow, barra
  });

  it("libera município citado na manchete, mas não nome de pessoa com cargo", () => {
    const allow = entidadesPermitidas("Ex-secretário de Saúde de Mata Roma é condenado por fraude");
    expect(allow.has("mata roma")).toBe(true);
    const allow2 = entidadesPermitidas("O ministro Fulano de Tal foi denunciado");
    expect(allow2.has("fulano de")).toBe(false);
  });
});

describe("sanitização — corrige em vez de descartar", () => {
  it("tira o nome e mantém o cargo (e a crítica sobrevive)", () => {
    expect(sanitizeNomesDePessoa("o ministro Fulano de Tal decidiu sozinho"))
      .toBe("o ministro decidiu sozinho");
    expect(sanitizeNomesDePessoa("a relatora Beltrana aprovou")).toBe("a relatora aprovou");
  });

  it("copy sanitizada passa na guarda", () => {
    const bruto = "o ministro Fulano decidiu que o INSS pode pagar mais";
    expect(copyLeaksName([bruto])).toBe(true);
    expect(copyLeaksName([sanitizeNomesDePessoa(bruto)])).toBe(false);
  });
});

describe("checagem POSITIVA — a crítica é mesmo sobre a notícia?", () => {
  const h = "Programa federal teve R$ 1,3 milhão em superfaturamento, aponta CGU";

  it("aprova copy que cita o órgão", () => {
    expect(copyCobreCaso(["A CGU achou o rombo e ninguém devolveu"], h)).toBe(true);
  });

  it("aprova copy que cita o valor", () => {
    expect(copyCobreCaso(["Sumiram R$ 1,3 milhão do seu bolso"], h)).toBe(true);
  });

  it("REPROVA copy atemporal — era exatamente o que saía no Reel", () => {
    expect(copyCobreCaso([
      "Você não é livre: é assistido com a sua própria grana",
      "Metade do seu salário vira imposto e você nem percebe",
    ], h)).toBe(false);
  });
});

describe("escolha da manchete — 3 escândalos distintos por dia", () => {
  it("pula o que já foi usado", () => {
    const primeira = pickNewsTopic(1);
    expect(primeira).not.toBeNull();
    const usados = new Set([newsSlug(primeira!.headline)]);
    const segunda = pickNewsTopic(1, usados);
    expect(segunda).not.toBeNull();
    expect(newsSlug(segunda!.headline)).not.toBe(newsSlug(primeira!.headline));
  });

  it("é determinística — mesmo seed, mesma manchete", () => {
    expect(pickNewsTopic(42)?.headline).toBe(pickNewsTopic(42)?.headline);
  });
});
