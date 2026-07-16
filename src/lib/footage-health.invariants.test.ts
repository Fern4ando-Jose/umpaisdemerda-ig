// ─────────────────────────────────────────────────────────────────────────────
// INVARIANTE — um clipe MORTO não pode matar o Reel do dia.
// Contexto (run 29517163150): o Pexels tirou do ar um clipe da whitelist; o CDN
// passou a devolver 403 permanente e o Remotion abortou o render (exit 1). Como os
// clipes são cacheados por (tópico, dia) e reusados por ES **e** PT, um clipe morto
// envenenava os dois Reels enquanto o cache vivesse.
//
// Estes testes fixam as 3 garantias do conserto:
//   (a) clipe morto → substituído por um VIVO do MESMO pilar da whitelist;
//   (b) o preflight é FAIL-OPEN (erro de rede/timeout/5xx não poda nada);
//   (c) NADA disso reabre a busca ao vivo — substituto sai só da whitelist curada.
// Sem rede: o fetch é mockado (o teste não pode depender do Pexels estar de pé).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect, vi, afterEach } from "vitest";
import { preflightClips } from "./footage-health";
import { FOOTAGE_LIBRARY } from "./footage-library";
import { selectFootage, hashStr, reelSharedKey } from "./reel-shared";
import { probeClip, verdictForStatus } from "../../scripts/footage-probe.mjs";

const CURATED = new Set(Object.values(FOOTAGE_LIBRARY).flatMap((l) => l.map((c) => c.url)));
const pillarOf = (url: string) =>
  Object.entries(FOOTAGE_LIBRARY).find(([, l]) => l.some((c) => c.url === url))?.[0];

// fetch falso: responde por URL. `dead` → 403 (como o CloudFront), resto → 206.
function stubFetch(handler: (url: string) => number | Error) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input);
    const r = handler(url);
    if (r instanceof Error) throw r;
    return { status: r, ok: r >= 200 && r < 300, body: null } as unknown as Response;
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("preflightClips — (a) clipe morto vira clipe VIVO do mesmo pilar", () => {
  const seed = hashStr(reelSharedKey("Dopamina", "2026-07-16"));

  it("substitui o morto por outro clipe do MESMO pilar (nunca devolve o morto)", async () => {
    const clips = await selectFootage([], "freedom", seed);
    const morto = clips[0];
    const pilarDoMorto = pillarOf(morto);
    const fetchSpy = stubFetch((u) => (u === morto ? 403 : 206));

    const r = await preflightClips(clips, "freedom", seed);

    expect(r.changed).toBe(true);
    expect(r.dead).toEqual([morto]);
    expect(r.replaced).toBe(1);
    expect(r.dropped).toBe(0);
    expect(r.clips).toHaveLength(clips.length);
    expect(r.clips).not.toContain(morto);
    // o substituto é do MESMO pilar e está na whitelist curada
    expect(pillarOf(r.clips[0])).toBe(pilarDoMorto);
    expect(CURATED.has(r.clips[0])).toBe(true);
    // os sobreviventes ficam intactos (mesmo vídeo ES↔PT nas outras cenas)
    expect(r.clips.slice(1)).toEqual(clips.slice(1));
    expect(fetchSpy).toHaveBeenCalled();
  });

  it("substituto nunca repete clipe já usado no mesmo Reel", async () => {
    const clips = await selectFootage([], "self", seed);
    stubFetch((u) => (u === clips[1] ? 403 : 206));
    const r = await preflightClips(clips, "self", seed);
    expect(new Set(r.clips).size).toBe(r.clips.length);
    expect(r.clips).not.toContain(clips[1]);
  });

  it("determinístico: ES e PT (mesmo tópico/dia) repõem o MESMO substituto", async () => {
    const clips = await selectFootage([], "freedom", seed);
    stubFetch((u) => (u === clips[0] ? 403 : 206));
    const es = await preflightClips(clips, "freedom", seed);
    const pt = await preflightClips(clips, "freedom", seed);
    expect(pt.clips).toEqual(es.clips);
  });

  it("404/410 também contam como morte (não só o 403 do caso real)", async () => {
    const clips = await selectFootage([], "mind", seed);
    stubFetch((u) => (u === clips[2] ? 404 : 206));
    const r = await preflightClips(clips, "mind", seed);
    expect(r.dead).toEqual([clips[2]]);
    expect(r.clips).not.toContain(clips[2]);
  });

  it("pilar inteiro morto → DESCARTA a cena em vez de devolver URL morta (Reel sai com menos)", async () => {
    const clips = await selectFootage([], "freedom", seed);
    // tudo do pilar freedom está morto; o resto vive
    stubFetch((u) => (pillarOf(u) === "freedom" ? 403 : 206));
    const r = await preflightClips(clips, "freedom", seed);
    expect(r.clips.length).toBeLessThan(clips.length);
    expect(r.clips.every((u) => pillarOf(u) !== "freedom")).toBe(true);
    expect(r.dropped).toBeGreaterThan(0);
    // nada de lista com clipe morto dentro
    for (const u of r.clips) expect(CURATED.has(u)).toBe(true);
  });

  it("todos vivos → NÃO mexe em nada nem marca changed (não regrava o cache à toa)", async () => {
    const clips = await selectFootage([], "network", seed);
    stubFetch(() => 206);
    const r = await preflightClips(clips, "network", seed);
    expect(r.clips).toEqual(clips);
    expect(r.changed).toBe(false);
    expect(r.dead).toEqual([]);
  });
});

describe("preflightClips — (b) FAIL-OPEN: checagem falha ≠ publicação cai", () => {
  const seed = 12345;

  it("erro de rede em TODOS os clipes → mantém a lista intacta", async () => {
    const clips = await selectFootage([], "self", seed);
    stubFetch(() => new Error("ECONNRESET"));
    const r = await preflightClips(clips, "self", seed);
    expect(r.clips).toEqual(clips);
    expect(r.changed).toBe(false);
    expect(r.dead).toEqual([]);
  });

  it("timeout (abort) → mantém a lista intacta", async () => {
    const clips = await selectFootage([], "self", seed);
    stubFetch(() => Object.assign(new Error("The operation was aborted"), { name: "AbortError" }));
    const r = await preflightClips(clips, "self", seed);
    expect(r.clips).toEqual(clips);
    expect(r.changed).toBe(false);
  });

  it("5xx/429 são TRANSITÓRIOS — não condenam clipe (sem falso positivo)", async () => {
    const clips = await selectFootage([], "anxiety", seed);
    stubFetch((u) => (u === clips[0] ? 500 : u === clips[1] ? 429 : 206));
    const r = await preflightClips(clips, "anxiety", seed);
    expect(r.clips).toEqual(clips);
    expect(r.changed).toBe(false);
  });

  it("lista vazia / entradas sujas não derrubam o preflight", async () => {
    stubFetch(() => 403);
    expect((await preflightClips([], "self", seed)).clips).toEqual([]);
    expect((await preflightClips(["", "  "], "self", seed)).clips).toEqual([]);
    expect((await preflightClips(null as unknown as string[], "self", seed)).clips).toEqual([]);
  });

  it("se a sonda LANÇA de forma inesperada, devolve os clipes como vieram", async () => {
    const clips = await selectFootage([], "self", seed);
    vi.spyOn(globalThis, "fetch").mockImplementation(() => {
      throw new Error("boom síncrono");
    });
    const r = await preflightClips(clips, "self", seed);
    expect(r.clips).toEqual(clips);
  });
});

describe("preflightClips — (c) a trava 'nunca busca ao vivo' continua valendo", () => {
  const seed = 999;

  it("selectFootage segue SEM rede, mesmo com PEXELS_API_KEY (trava original intacta)", async () => {
    vi.stubEnv("PEXELS_API_KEY", "should-never-be-used");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const clips = await selectFootage([], "freedom", seed);
    expect(clips).toHaveLength(5);
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it("o preflight só fala com as URLs que JÁ estavam na whitelist — nunca com a API do Pexels/Pixabay", async () => {
    vi.stubEnv("PEXELS_API_KEY", "should-never-be-used");
    const clips = await selectFootage([], "freedom", seed);
    const visitadas: string[] = [];
    stubFetch((u) => {
      visitadas.push(u);
      return u === clips[0] ? 403 : 206;
    });

    const r = await preflightClips(clips, "freedom", seed);

    // toda URL sondada é da whitelist curada; nenhum endpoint de busca (api.pexels.com,
    // pixabay.com/api) foi tocado
    for (const u of visitadas) {
      expect(CURATED.has(u)).toBe(true);
      expect(u).not.toMatch(/api\.pexels\.com|pixabay\.com\/api/);
    }
    // e o resultado é 100% whitelist
    for (const u of r.clips) expect(CURATED.has(u)).toBe(true);
    vi.unstubAllEnvs();
  });

  it("substituto sai SÓ do whitelist, em qualquer pilar", async () => {
    for (const cat of ["self", "network", "anxiety", "freedom", "dopamine", "mind"]) {
      const clips = await selectFootage([], cat, seed);
      stubFetch((u) => (u === clips[0] ? 403 : 206));
      const r = await preflightClips(clips, cat, seed);
      for (const u of r.clips) expect(CURATED.has(u)).toBe(true);
      vi.restoreAllMocks();
    }
  });
});

describe("sonda (scripts/footage-probe.mjs) — regra status→veredito é fonte única", () => {
  it("2xx/3xx = alive · 403/404/410 = dead · 429/5xx/timeout = unknown (fail-open)", () => {
    expect(verdictForStatus(200)).toBe("alive");
    expect(verdictForStatus(206)).toBe("alive"); // Range 0-64
    expect(verdictForStatus(302)).toBe("alive");
    expect(verdictForStatus(403)).toBe("dead");  // o caso real (CloudFront AccessDenied)
    expect(verdictForStatus(404)).toBe("dead");
    expect(verdictForStatus(410)).toBe("dead");
    expect(verdictForStatus(429)).toBe("unknown");
    expect(verdictForStatus(500)).toBe("unknown");
    expect(verdictForStatus(503)).toBe("unknown");
  });

  it("URL inválida não é condenada (unknown) e não gera requisição", async () => {
    const fetchSpy = stubFetch(() => 403);
    expect(await probeClip("")).toBe("unknown");
    expect(await probeClip("nao-e-url")).toBe("unknown");
    expect(await probeClip(null as unknown as string)).toBe("unknown");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("usa GET com Range 0-64 (não baixa o vídeo: custo ~0 e $0)", async () => {
    const fetchSpy = stubFetch(() => 206);
    await probeClip("https://videos.pexels.com/video-files/1/x.mp4");
    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("GET");
    expect((init.headers as Record<string, string>).Range).toBe("bytes=0-64");
  });
});
