// Invariante da trava anti-amenização: em tema-convicção a diretiva entra e PROÍBE
// trocar a frase-verdade pela palavra de marca ("libertad"); em tema aberto não
// injeta nada (título livre). Foi o bug do ED 106. A função é pura; a lista de temas
// literais mora no flag `literal` do THEMES (fonte única).
import { describe, it, expect } from "vitest";
import { buildLiteralDirective } from "./literal-lock";

describe("buildLiteralDirective (trava anti-amenização)", () => {
  it("tema-convicção: injeta a trava, exige preservar a frase e proíbe trocar por libertad", () => {
    const d = buildLiteralDirective(true, "libertad");
    expect(d).toContain("INVIOLABLE");
    expect(d).toContain("PRESERVA");
    expect(d).toMatch(/NUNCA en el título/);
    expect(d.toLowerCase()).toContain("la frase completa");
    // o miolo: não sustituir a frase pela palavra de marca
    expect(d).toMatch(/sustituyas la frase por/);
  });

  it("tema aberto: não injeta nada (título pode ser criado livremente)", () => {
    expect(buildLiteralDirective(false, "libertad")).toBe("");
  });

  it("usa o termo de marca da conta (freedom) — ES 'libertad' e PT 'liberdade'", () => {
    expect(buildLiteralDirective(true, "liberdade")).toContain("liberdade");
    expect(buildLiteralDirective(true, "libertad")).toContain("libertad");
  });
});
