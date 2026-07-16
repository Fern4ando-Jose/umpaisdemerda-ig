// Invariantes das 4 fontes de footage (Pexels vídeo/foto + Pixabay vídeo/foto).
// Pixabay é FAIL-OPEN por design (chave ainda não existe, 2026-07-16): toda
// função Pixabay devolve [] sem PIXABAY_API_KEY, sem tocar a rede — os testes
// abaixo NÃO mockam fetch pra provar exatamente isso (se tocasse a rede, o teste
// erraria por timeout/offline, não silenciosamente passaria).
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  searchPexelsVideo,
  searchPexelsPhoto,
  searchPixabayVideo,
  searchPixabayPhoto,
  availableSources,
  qaCacheId,
  candidateSourceKey,
  FOOTAGE_SOURCES,
} from "./footage-providers";

describe("fail-open sem chave — NENHUMA fonte quebra o pipeline por chave ausente", () => {
  afterEach(() => vi.restoreAllMocks());

  it("Pexels vídeo/foto sem chave → [] sem chamar fetch", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    expect(await searchPexelsVideo("termo", undefined)).toEqual([]);
    expect(await searchPexelsPhoto("termo", undefined)).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("Pixabay vídeo/foto sem PIXABAY_API_KEY → [] sem chamar fetch (dono ainda não criou a conta)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    expect(await searchPixabayVideo("termo", undefined)).toEqual([]);
    expect(await searchPixabayPhoto("termo", undefined)).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("availableSources — Pixabay só entra com a chave; Pexels sempre que tiver a sua", () => {
  it("nenhuma chave → nenhuma fonte disponível", () => {
    expect(availableSources({})).toEqual([]);
  });

  it("só Pexels → 2 fontes (vídeo+foto), Pixabay de fora", () => {
    const sources = availableSources({ pexels: "k" });
    expect(sources).toEqual(["pexels-video", "pexels-photo"]);
  });

  it("as 2 chaves presentes → as 4 fontes disponíveis (mix completo)", () => {
    const sources = availableSources({ pexels: "k", pixabay: "k2" });
    expect(sources).toEqual([...FOOTAGE_SOURCES]);
  });

  it("só Pixabay (sem Pexels) → só as 2 fontes Pixabay", () => {
    expect(availableSources({ pixabay: "k2" })).toEqual(["pixabay-video", "pixabay-photo"]);
  });
});

describe("qaCacheId — chave composta do cache de QA (BIGINT) não colide entre provedores/tipos", () => {
  it("o MESMO (source,id) sempre gera a MESMA chave (cache vale pra sempre)", () => {
    expect(qaCacheId("pexels-video", 12345)).toBe(qaCacheId("pexels-video", 12345));
  });

  it("o MESMO id numérico em fontes DIFERENTES gera chaves DIFERENTES (sem colisão)", () => {
    const ids = new Set([
      qaCacheId("pexels-video", 12345),
      qaCacheId("pexels-photo", 12345),
      qaCacheId("pixabay-video", 12345),
      qaCacheId("pixabay-photo", 12345),
    ]);
    expect(ids.size).toBe(4); // 4 chaves distintas pro mesmo id "12345" em 4 fontes
  });

  it("candidateSourceKey reconstrói a chave a partir de source+mediaType do candidato", () => {
    expect(candidateSourceKey({ source: "pexels", mediaType: "video" })).toBe("pexels-video");
    expect(candidateSourceKey({ source: "pixabay", mediaType: "photo" })).toBe("pixabay-photo");
  });
});
