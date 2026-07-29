// Trava da VOZ APROVADA — a narração do UPM usa a MESMA voz BR que o dono escolheu
// ouvindo 6 amostras no DR (2026-07-27: "Candidata 3 — Bill") e mandou ligar aqui
// (2026-07-29: "ligar no um pais de merda a mesma narração do reel que existe no
// dr liberdade"). Mudar qualquer parâmetro muda a voz que ele aprovou — este teste
// quebra ANTES de a voz errada chegar ao feed.
import { describe, it, expect } from "vitest";
import { VOZ_POR_IDIOMA, hashRoteiro } from "./narration";

describe("voz da narração — exatamente a amostra que o dono aprovou", () => {
  it("BR (código interno pt) = ElevenLabs Bill com os parâmetros exatos", () => {
    expect(VOZ_POR_IDIOMA.pt).toEqual({
      provedor: "elevenlabs",
      voz: "Bill",
      speed: 0.95,
      stability: 0.45,
      similarity: 0.8,
      style: 0.1,
    });
  });

  it("não existe voz de outro idioma — o UPM publica só em BR", () => {
    expect(Object.keys(VOZ_POR_IDIOMA)).toEqual(["pt"]);
  });
});

describe("cache da voz preso ao TEXTO — voz = tela, sempre (bug do 1º reel narrado, 29/07)", () => {
  it("o mesmo roteiro dá o mesmo hash (re-disparo reusa, não repaga)", () => {
    const t = "Eleição é a casta dividindo quem vai te ordenhar.";
    expect(hashRoteiro(t)).toBe(hashRoteiro(t));
  });

  it("roteiro diferente dá hash diferente — voz velha nunca toca sobre texto novo", () => {
    expect(hashRoteiro("Enquanto você vota, eles dividem o dinheiro."))
      .not.toBe(hashRoteiro("Enquanto você briga sobre cores, eles roubam."));
  });
});
