import { describe, it, expect } from "vitest";
import {
  montarFala, montarFalaDeCopy, normalizaRoteiro, FECHO_FIXO, TETO_CHARS, CAP,
  type ReelRoteiro,
} from "./reel-script";

const roteiro: ReelRoteiro = {
  gancho: "A CGU achou R$ 1,3 milhão de superfaturamento",
  fato: "O programa pagou 3x o preço e ninguém devolveu",
  mecanismo: "Não é exceção: é assim que a casta se serve",
  espelho: "E você pagou por isso e nem ficou sabendo",
  pergunta: "Quanto mais você vai aceitar calado?",
};

describe("roteiro do Reel — 5 cenas com papel nomeado", () => {
  it("a fala sai na ordem gancho → fato → mecanismo → espelho → fecho", () => {
    const f = montarFala(roteiro);
    expect(f.segments.length).toBe(5);
    expect(f.segments[0]).toContain("CGU");
    expect(f.segments[3]).toContain("nem ficou sabendo");
    expect(f.segments[4]).toContain(FECHO_FIXO);
  });

  it("os blocos falados são n+2 (capa + insights + fecho) — o que o ReelV2 exige", () => {
    const f = montarFala(roteiro);
    expect(f.segments.length).toBe(f.slides.length + 2);
  });

  it("o FECHO conta no teto — era o bug que levava o Reel a ~33s", () => {
    const f = montarFala(roteiro);
    // o tamanho medido tem de incluir a pergunta E a frase fixa do fecho
    expect(f.chars).toBeGreaterThanOrEqual(
      roteiro.gancho.length + roteiro.pergunta.length + FECHO_FIXO.length,
    );
  });

  it("um roteiro dentro dos tetos por cena cabe no teto de fala sem corte", () => {
    const somaDosCaps = CAP.gancho + CAP.fato + CAP.mecanismo + CAP.espelho + CAP.pergunta;
    expect(somaDosCaps + FECHO_FIXO.length).toBeLessThanOrEqual(TETO_CHARS);
    expect(montarFala(roteiro).cortadas).toEqual([]);
  });

  it("estourando o teto, corta o MECANISMO — nunca o gancho, o espelho ou a pergunta", () => {
    const gordo: ReelRoteiro = {
      gancho: "A".repeat(70),
      fato: "B".repeat(70),
      mecanismo: "C".repeat(70),
      espelho: "D".repeat(70),
      pergunta: "E".repeat(70),
    };
    const f = montarFala(gordo);
    expect(f.cortadas).toContain("mecanismo");
    expect(f.title).toBe(gordo.gancho);
    expect(f.cta).toBe(gordo.pergunta);
    expect(f.slides.join(" ")).toContain("D".repeat(70)); // o espelho sobreviveu
  });

  it("nunca fica sem nenhuma cena falada no meio", () => {
    const enorme: ReelRoteiro = {
      gancho: "A".repeat(300), fato: "B".repeat(300), mecanismo: "C".repeat(300),
      espelho: "D".repeat(300), pergunta: "E".repeat(300),
    };
    expect(montarFala(enorme).slides.length).toBeGreaterThanOrEqual(1);
  });

  it("roteiro sem espelho é rejeitado (a crítica viraria jornal)", () => {
    expect(normalizaRoteiro({ ...roteiro, espelho: "" })).toBeNull();
    expect(normalizaRoteiro({ ...roteiro, gancho: "" })).toBeNull();
    expect(normalizaRoteiro({ ...roteiro, pergunta: "" })).toBeNull();
    expect(normalizaRoteiro(roteiro)).not.toBeNull();
  });
});

describe("montarFalaDeCopy — acerto de cache e caminho sem notícia", () => {
  it("também conta o fecho no teto", () => {
    const f = montarFalaDeCopy("t".repeat(60), ["a".repeat(80), "b".repeat(80), "c".repeat(80)], "p".repeat(80));
    expect(f.chars).toBeLessThanOrEqual(TETO_CHARS + 80); // cortou até caber (ou sobrou 1)
    expect(f.cortadas.length).toBeGreaterThan(0);
    expect(f.segments.at(-1)).toContain(FECHO_FIXO);
  });

  it("copy curta passa inteira", () => {
    const f = montarFalaDeCopy("Gancho curto", ["Insight um", "Insight dois"], "E aí?");
    expect(f.slides.length).toBe(2);
    expect(f.cortadas).toEqual([]);
  });
});
