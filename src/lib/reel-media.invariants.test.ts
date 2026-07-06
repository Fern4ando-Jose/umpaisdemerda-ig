// Invariante #3 — NUNCA publicar Reel preto.
// hasVisualMedia (scripts/reel-media.cjs) é a regra única que decide se um Reel
// tem fundo de verdade (footage OU ilustração). O workflow pula a publicação
// quando ela é falsa. Este teste barra o merge se a regra afrouxar.
import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { hasVisualMedia } = require("../../scripts/reel-media.cjs") as {
  hasVisualMedia: (props: unknown) => boolean;
};

describe("hasVisualMedia (guarda anti-preto do Reel)", () => {
  it("SEM clips e SEM img → não tem mídia (deve pular publicação)", () => {
    expect(hasVisualMedia({ clips: [], img: undefined })).toBe(false);
    expect(hasVisualMedia({})).toBe(false);
    expect(hasVisualMedia(null)).toBe(false);
    expect(hasVisualMedia({ clips: [], img: "" })).toBe(false);
    expect(hasVisualMedia({ clips: ["", "  "], img: "   " })).toBe(false);
  });

  it("≥1 clipe de footage não-vazio → tem mídia", () => {
    expect(hasVisualMedia({ clips: ["https://x/a.mp4"] })).toBe(true);
    expect(hasVisualMedia({ clips: ["", "https://x/b.mp4"] })).toBe(true);
  });

  it("ilustração (img) presente, mesmo sem clips → tem mídia", () => {
    expect(hasVisualMedia({ clips: [], img: "https://x/cover.png" })).toBe(true);
    expect(hasVisualMedia({ img: "https://x/cover.png" })).toBe(true);
  });

  it("entradas inválidas não derrubam a guarda", () => {
    expect(hasVisualMedia(undefined)).toBe(false);
    expect(hasVisualMedia({ clips: "not-an-array" } as unknown)).toBe(false);
    expect(hasVisualMedia({ clips: [123, null] } as unknown)).toBe(false);
  });
});
