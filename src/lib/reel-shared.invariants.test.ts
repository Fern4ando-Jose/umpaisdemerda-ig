import { describe, it, expect, vi, afterEach } from "vitest";
import { reelSharedKey, hashStr, dayUTC, normalizeShareInput, selectFootage } from "./reel-shared";
import { FOOTAGE_LIBRARY } from "./footage-library";

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

// SEGURANÇA (footage): o Reel NUNCA busca Pexels ao vivo (roleta não-vetada que já
// trouxe marco dos EUA / cena imprópria). selectFootage devolve SÓ clipes da
// biblioteca CURADA (whitelist vetado à mão), para qualquer pilar, sem rede.
describe("selectFootage é curado-only (nunca Pexels ao vivo)", () => {
  const CATS = ["self", "network", "anxiety", "freedom", "dopamine", "mind"];
  const curatedSet = new Set(
    Object.values(FOOTAGE_LIBRARY).flatMap((l) => l.map((c) => c.url)),
  );

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("cada pilar tem >= numClips (5) clipes curados — cobre o Reel sem fallback", () => {
    for (const cat of CATS) {
      expect(FOOTAGE_LIBRARY[cat].length).toBeGreaterThanOrEqual(5);
    }
  });

  it("retorna 5 URLs, TODAS do whitelist curado, e NÃO chama fetch (mesmo com PEXELS_API_KEY)", async () => {
    vi.stubEnv("PEXELS_API_KEY", "should-never-be-used");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    for (const cat of CATS) {
      const clips = await selectFootage(["hands counting cash"], cat, hashStr(`t|2026-07-14`));
      expect(clips).toHaveLength(5);
      for (const url of clips) expect(curatedSet.has(url)).toBe(true);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("cat DESCONHECIDO cai na UNIÃO curada — jamais Pexels cru", async () => {
    vi.stubEnv("PEXELS_API_KEY", "should-never-be-used");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const clips = await selectFootage([], "categoria-inexistente", 12345);
    expect(clips.length).toBeGreaterThan(0);
    for (const url of clips) expect(curatedSet.has(url)).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("determinístico por seed — mesmo (tópico,dia) → mesmos clipes ES/PT", async () => {
    const seed = hashStr(reelSharedKey("Dopamina", "2026-07-14"));
    const a = await selectFootage([], "self", seed);
    const b = await selectFootage([], "self", seed);
    expect(a).toEqual(b);
  });

  // 2026-07-16: novo 5º parâmetro (excludeKey, anti-repetição cross-reel via
  // recentClipUrls) é OPCIONAL e não muda o contrato — sem banco disponível (aqui
  // em teste), fail-open devolve conjunto vazio, mesmo resultado de antes.
  it("aceita o novo parâmetro excludeKey sem mudar o formato do retorno (fail-open sem DB)", async () => {
    const seed = hashStr(reelSharedKey("Dopamina", "2026-07-14"));
    const clips = await selectFootage([], "self", seed, 5, reelSharedKey("Dopamina", "2026-07-14"));
    expect(clips).toHaveLength(5);
    for (const url of clips) expect(curatedSet.has(url)).toBe(true);
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
