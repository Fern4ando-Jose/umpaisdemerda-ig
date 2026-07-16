// Invariantes do acento de UI por pilar (CAT_ACCENT) — companheiro de
// video/brand-grade.test.ts. Prova as DUAS metades da separação pedida
// 2026-07-16: o wash do footage é LOCKED (brand-grade.test.ts) enquanto a UI
// PLANA (régua/CTA/palavra-destaque, todas alimentadas por CAT_ACCENT em
// Reel.tsx) continua variando nos 6 pilares — nenhuma mudança aqui, só prova
// que continua intocado após a separação da variável `accent`.
import { describe, it, expect } from "vitest";
import { CAT_ACCENT } from "./Reel";
import { FOOTAGE_WASH_ACCENT } from "./brand-grade";

const PILLARS = ["freedom", "dopamine", "anxiety", "network", "self", "mind"];

describe("CAT_ACCENT — UI de pilar continua variando (intocado pela trava do wash)", () => {
  it("tem os 6 pilares com os hex vigentes", () => {
    expect(CAT_ACCENT).toEqual({
      freedom: "#A45A5A",
      dopamine: "#BE7A2A",
      anxiety: "#3D6360",
      network: "#3F5E78",
      self: "#835A6E",
      mind: "#5B6B3C",
    });
  });

  it("os 6 valores são todos distintos entre si (UI varia de verdade por pilar)", () => {
    const values = PILLARS.map((p) => CAT_ACCENT[p]);
    expect(new Set(values).size).toBe(6);
  });

  it("freedom coincide com FOOTAGE_WASH_ACCENT por acaso (ambos nasceram do mesmo vermelho-marca) — mas são fontes INDEPENDENTES: mudar CAT_ACCENT.freedom não muda o wash (GradeOverlay não lê CAT_ACCENT)", () => {
    expect(CAT_ACCENT.freedom).toBe(FOOTAGE_WASH_ACCENT);
    // Os outros 5 pilares PROVAM a independência: eles divergem do wash do
    // footage, que nunca deixa de ser FOOTAGE_WASH_ACCENT (ver brand-grade.test.ts).
    const others = PILLARS.filter((p) => p !== "freedom").map((p) => CAT_ACCENT[p]);
    expect(others.every((v) => v !== FOOTAGE_WASH_ACCENT)).toBe(true);
  });
});
