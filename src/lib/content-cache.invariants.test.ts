import { describe, it, expect } from "vitest";
import { contentCacheKey } from "./content-cache";

// INVARIANTE — cache da copy é POR IDIOMA (≠ reel-shared, que é língua-independente).
// A copy é regerada por mercado (ES ≠ PT), então a chave PRECISA incluir o idioma,
// senão um idioma sobrescreveria a copy do outro.
describe("content-cache — chave por (tópico, dia, idioma)", () => {
  it("inclui o idioma → ES e PT têm entradas distintas", () => {
    const es = contentCacheKey("Nadie te debe nada", "2026-06-20", "es");
    const pt = contentCacheKey("Nadie te debe nada", "2026-06-20", "pt");
    expect(es).not.toBe(pt);
    expect(es).toBe("Nadie te debe nada|2026-06-20|es");
  });

  it("muda por dia → expiração natural diária", () => {
    expect(contentCacheKey("X", "2026-06-20", "es")).not.toBe(contentCacheKey("X", "2026-06-21", "es"));
  });
});
