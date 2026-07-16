// Invariantes do detector de mídia (foto × vídeo) usado pelo RENDER (video/Reel.tsx,
// via SceneBg) pra decidir OffthreadVideo × PhotoKenBurns SÓ pela extensão da URL —
// as 4 fontes (Pexels/Pixabay × vídeo/foto) não carregam um campo extra de tipo.
import { describe, it, expect } from "vitest";
import { isPhotoUrl, hashStr } from "./footage-media";

describe("isPhotoUrl — detecta foto × vídeo pela extensão (sem campo extra no schema)", () => {
  it("reconhece extensões de foto dos 2 provedores", () => {
    expect(isPhotoUrl("https://images.pexels.com/photos/123/foo.jpeg?auto=compress")).toBe(true);
    expect(isPhotoUrl("https://images.pexels.com/photos/123/foo.jpg")).toBe(true);
    expect(isPhotoUrl("https://cdn.pixabay.com/photo/2020/01/01/00/00/foo-123.png")).toBe(true);
    expect(isPhotoUrl("https://cdn.pixabay.com/photo/2020/01/01/00/00/foo-123.webp")).toBe(true);
  });

  it("reconhece extensões de vídeo dos 2 provedores → NÃO é foto", () => {
    expect(isPhotoUrl("https://videos.pexels.com/video-files/123/foo.mp4")).toBe(false);
    expect(isPhotoUrl("https://cdn.pixabay.com/video/2020/01/01/00-123-large.mp4")).toBe(false);
  });

  it("ignora querystring depois da extensão", () => {
    expect(isPhotoUrl("https://images.pexels.com/photos/1/a.jpeg?auto=compress&cs=tinysrgb&w=630")).toBe(true);
    expect(isPhotoUrl("https://videos.pexels.com/video-files/1/a.mp4?x=1")).toBe(false);
  });

  it("entrada ausente/vazia → não é foto (fail-safe, cai no branch de vídeo)", () => {
    expect(isPhotoUrl(undefined)).toBe(false);
    expect(isPhotoUrl(null)).toBe(false);
    expect(isPhotoUrl("")).toBe(false);
  });
});

describe("hashStr — determinístico, 32-bit não-negativo (fonte única, sem duplicar em reel-shared/KenBurns)", () => {
  it("mesma string → mesmo hash sempre", () => {
    expect(hashStr("https://images.pexels.com/photos/1/a.jpeg")).toBe(hashStr("https://images.pexels.com/photos/1/a.jpeg"));
  });

  it("strings diferentes → hashes tipicamente diferentes", () => {
    expect(hashStr("a")).not.toBe(hashStr("b"));
  });

  it("é inteiro não-negativo (32-bit)", () => {
    const h = hashStr("qualquer-url");
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
  });
});
