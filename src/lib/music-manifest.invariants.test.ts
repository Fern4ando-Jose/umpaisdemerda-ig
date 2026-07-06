import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import pickMusicMod from "../../scripts/pick-music.cjs";

// ─────────────────────────────────────────────────────────────────────────────
// INVARIANTE — MÚSICA POR TEMA. Cada tema tem faixa própria; pick-music.cjs escolhe
// pelo `topic` via public/music/manifest.json (gerado por scripts/generate-music.mjs).
// Garante: (1) todo arquivo do manifest existe e segue o padrão bed-NN-slug.mp3;
// (2) o picker resolve o tema pelo manifest; (3) tema fora do manifest NÃO quebra
// (fail-open → string vazia ou rotação legado). Ver CLAUDE.md (pipeline do Reel).
// ─────────────────────────────────────────────────────────────────────────────

const { pickMusic } = pickMusicMod as unknown as { pickMusic: (a: unknown) => string };
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", ".."); // src/lib → raiz
const manifest = JSON.parse(
  readFileSync(resolve(ROOT, "public/music/manifest.json"), "utf8"),
) as Record<string, string>;

describe("música por tema — manifest", () => {
  it("não está vazio e todo arquivo existe no padrão music/bed-NN-slug.mp3", () => {
    const entries = Object.entries(manifest);
    expect(entries.length).toBeGreaterThan(0);
    for (const [, file] of entries) {
      expect(file).toMatch(/^music\/bed-\d{2}-[a-z0-9-]+\.mp3$/);
      expect(existsSync(resolve(ROOT, "public", file))).toBe(true);
    }
  });
});

describe("música por tema — picker", () => {
  it("resolve o tema pela entrada do manifest", () => {
    const [topic, file] = Object.entries(manifest)[0];
    expect(pickMusic({ topic, run: 0 })).toBe(file);
  });

  it("tema fora do manifest é fail-open (devolve string, nunca lança)", () => {
    const r = pickMusic({ topic: "Tema inexistente para teste", run: 1 });
    expect(typeof r).toBe("string");
  });
});
