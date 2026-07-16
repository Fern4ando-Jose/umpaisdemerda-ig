// Invariantes da grade de cor da marca — FONTE ÚNICA (antes redeclarada só em
// video/Reel.tsx; agora também consumida por video/KenBurns.tsx, a 2ª fonte de
// footage). Ao contrário do DR-Libertad (irmão desta automação), a UPM NÃO
// ganhou variação de intensidade por pilar nesta rodada (acento por pilar já
// existe via CAT_ACCENT, intocado) — só a duplicação foi eliminada.
import { describe, it, expect } from "vitest";
import { GRADE_FILTER, DUO_FLOOR, DUO_HIGHLIGHT, WARM_WASH } from "./brand-grade";

describe("constantes da grade — hex fixo, fonte única", () => {
  it("os 3 tons do duotone são os hex vigentes", () => {
    expect(DUO_FLOOR).toBe("#1F1A18");
    expect(DUO_HIGHLIGHT).toBe("#ECDCC4");
    expect(WARM_WASH).toBe("#5A4636");
  });

  it("GRADE_FILTER é uma string CSS de filter válida", () => {
    expect(GRADE_FILTER).toMatch(/^saturate\([\d.]+\) contrast\([\d.]+\) brightness\([\d.]+\) sepia\([\d.]+\)$/);
  });
});
