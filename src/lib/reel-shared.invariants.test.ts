import { describe, it, expect } from "vitest";
import { reelSharedKey, hashStr, dayUTC, normalizeShareInput } from "./reel-shared";

// ─────────────────────────────────────────────────────────────────────────────
// INVARIANTE MULTI-IDIOMA (Reel): o VÍDEO é o MESMO entre as contas (ES, PT, …).
// A base língua-independente — pesquisa (Tavily) + videoQueries + footage (Pexels)
// — é resolvida UMA vez por (tópico, dia) e COMPARTILHADA; só a copy muda.
// (Regra do CLAUDE.md: "Mesma máquina (footage, render, design); muda só a copy.")
//
// Estes testes barram a volta da regressão em que cada idioma escolhia footage
// DIFERENTE (o seed incluía o @handle de propósito) → dois vídeos distintos.
// ─────────────────────────────────────────────────────────────────────────────

describe("chave da base compartilhada NÃO depende de idioma", () => {
  it("reelSharedKey é (tópico, dia) — ES e PT batem na MESMA entrada", () => {
    const k = reelSharedKey("Neuroplasticidad", "2026-06-18");
    expect(k).toBe("Neuroplasticidad|2026-06-18");
    expect(k).not.toMatch(/\b(es|pt|lang|handle)\b/i);
  });

  it("mesmo (tópico, dia) → mesma chave, independente de quem chamou", () => {
    const es = reelSharedKey("Límites sanos", "2026-06-18");
    const pt = reelSharedKey("Límites sanos", "2026-06-18");
    expect(pt).toBe(es);
  });

  it("tópico ou dia diferentes → chave diferente (variação por tema/dia)", () => {
    expect(reelSharedKey("A", "2026-06-18")).not.toBe(reelSharedKey("B", "2026-06-18"));
    expect(reelSharedKey("A", "2026-06-18")).not.toBe(reelSharedKey("A", "2026-06-19"));
  });
});

describe("seed do footage é determinístico e independente de conta", () => {
  it("o seed deriva da chave (tópico,dia) — mesmo seed p/ ES e PT", () => {
    const seed = (t: string, d: string) => hashStr(reelSharedKey(t, d));
    expect(seed("Dopamina", "2026-06-18")).toBe(seed("Dopamina", "2026-06-18"));
  });

  it("dias/tópicos diferentes → seeds diferentes (footage varia entre dias)", () => {
    const seed = (t: string, d: string) => hashStr(reelSharedKey(t, d));
    expect(seed("Dopamina", "2026-06-18")).not.toBe(seed("Dopamina", "2026-06-19"));
    expect(seed("Dopamina", "2026-06-18")).not.toBe(seed("Ansiedad", "2026-06-18"));
  });

  it("hashStr é inteiro não-negativo (32-bit)", () => {
    const h = hashStr("qualquer|2026-06-18");
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
  });
});

describe("dayUTC", () => {
  it("formata YYYY-MM-DD em UTC", () => {
    expect(dayUTC(new Date("2026-06-18T23:30:00Z"))).toBe("2026-06-18");
  });
});

// Writeback do footage do CI: o que a 1ª conta achar precisa virar a base que a
// 2ª conta REUSA (mesmo vídeo ES/PT). normalizeShareInput é o contrato de entrada.
describe("normalizeShareInput (writeback footage compartilhado)", () => {
  it("aceita topic + day válido + ≥1 clipe", () => {
    const r = normalizeShareInput({ topic: "Dopamina", day: "2026-06-22", clips: ["https://x/a.mp4"], videoQueries: ["q1", ""] });
    expect(r).toEqual({ topic: "Dopamina", day: "2026-06-22", clips: ["https://x/a.mp4"], videoQueries: ["q1"] });
  });

  it("rejeita sem clipe utilizável (não grava base vazia)", () => {
    expect(normalizeShareInput({ topic: "X", day: "2026-06-22", clips: [] })).toBeNull();
    expect(normalizeShareInput({ topic: "X", day: "2026-06-22", clips: ["", "  "] })).toBeNull();
  });

  it("rejeita topic vazio ou day fora de YYYY-MM-DD", () => {
    expect(normalizeShareInput({ topic: "", day: "2026-06-22", clips: ["https://x/a.mp4"] })).toBeNull();
    expect(normalizeShareInput({ topic: "X", day: "22/06/2026", clips: ["https://x/a.mp4"] })).toBeNull();
    expect(normalizeShareInput({ topic: "X", clips: ["https://x/a.mp4"] })).toBeNull();
  });

  it("entradas inválidas não derrubam o validador", () => {
    expect(normalizeShareInput(null)).toBeNull();
    expect(normalizeShareInput("nope")).toBeNull();
    expect(normalizeShareInput({ clips: [123] })).toBeNull();
  });
});
