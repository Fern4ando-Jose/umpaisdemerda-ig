// ─── Provedores de footage — 4 fontes normalizadas ─────────────────────────────
// Pexels vídeo (original) + Pexels FOTO (Ken Burns) + Pixabay vídeo + Pixabay
// FOTO (Ken Burns) — cada função devolve uma lista de `FootageCandidate` no MESMO
// formato, pronta pro QA de conteúdo (footage-qa.ts) e pra entrar na whitelist
// (footage-library.ts) ou no fallback ao vivo (selectFootage, reel-shared.ts).
//
// Pixabay é FAIL-OPEN por design (dono ainda não criou a conta/chave, 2026-07-16):
// toda função Pixabay aqui devolve [] se PIXABAY_API_KEY estiver ausente — mesmo
// padrão de chave opcional já usado no repo (ex.: footage-qa sem ANTHROPIC_API_KEY
// = QA pulado, não quebra nada). No instante em que a chave cair no cofre
// (.claude/chaves/dr-libertad.env → Vercel envs), estas funções passam a produzir
// candidatos sem qualquer outra mudança de código.
export type FootageMediaType = "video" | "photo";
export type FootageSource = "pexels" | "pixabay";

export interface FootageCandidate {
  url: string; // arquivo final (mp4 ou imagem) — o que entra em selectFootage/whitelist
  poster: string; // frame/imagem pro QA de conteúdo (footage-qa.judgeFootagePosterCached)
  mediaType: FootageMediaType;
  source: FootageSource;
  sourceId: number; // id numérico do provedor — cacheia o veredito do QA por (source,id)
  width: number;
  height: number;
  duration?: number; // só vídeo
  alt?: string; // legenda/tag do provedor, quando existe — vira `why` na whitelist
}

const PER_PAGE = 20;

function isPortrait(w: number, h: number): boolean {
  return h >= w;
}

// ─── Pexels VÍDEO (fonte 1 — comportamento existente, ver reel-shared.ts) ──────
function pickPexelsVideoFile(video: any): { link: string; width: number; height: number } | null {
  const files = (video.video_files || []).filter((f: any) => f.link && f.width && f.height);
  if (!files.length) return null;
  const portrait = files.filter((f: any) => f.height >= f.width);
  const pool = portrait.length ? portrait : files;
  pool.sort((a: any, b: any) => {
    const sa = (a.width <= 1440 ? 0 : 1) * 1e6 + Math.abs(a.width - 1080);
    const sb = (b.width <= 1440 ? 0 : 1) * 1e6 + Math.abs(b.width - 1080);
    return sa - sb;
  });
  return { link: pool[0].link, width: pool[0].width, height: pool[0].height };
}

export async function searchPexelsVideo(term: string, key: string | undefined): Promise<FootageCandidate[]> {
  if (!key) return [];
  const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(term)}&orientation=portrait&size=medium&per_page=${PER_PAGE}`;
  const res = await fetch(url, { headers: { Authorization: key } });
  if (!res.ok) return [];
  const data = await res.json().catch(() => ({} as any));
  const vids = Array.isArray(data.videos) ? data.videos : [];
  const out: FootageCandidate[] = [];
  for (const v of vids) {
    if (!(v.height >= v.width && (v.duration || 0) >= 4)) continue;
    const file = pickPexelsVideoFile(v);
    if (!file) continue;
    out.push({
      url: file.link,
      poster: v.image,
      mediaType: "video",
      source: "pexels",
      sourceId: v.id,
      width: file.width,
      height: file.height,
      duration: v.duration,
    });
  }
  return out;
}

// ─── Pexels FOTO (fonte 2 — Ken Burns) ─────────────────────────────────────────
// Endpoint DIFERENTE do de vídeo (api.pexels.com/v1/search), mesma PEXELS_API_KEY
// (mesmo provedor, 2º produto) — 10-100× mais opções que o catálogo de vídeo.
export async function searchPexelsPhoto(term: string, key: string | undefined): Promise<FootageCandidate[]> {
  if (!key) return [];
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(term)}&orientation=portrait&size=large&per_page=${PER_PAGE}`;
  const res = await fetch(url, { headers: { Authorization: key } });
  if (!res.ok) return [];
  const data = await res.json().catch(() => ({} as any));
  const photos = Array.isArray(data.photos) ? data.photos : [];
  const out: FootageCandidate[] = [];
  for (const p of photos) {
    const w = Number(p.width) || 0;
    const h = Number(p.height) || 0;
    if (!isPortrait(w, h)) continue;
    const src = p.src?.large2x || p.src?.large || p.src?.original;
    if (!src) continue;
    out.push({
      url: src,
      poster: src, // a própria foto é o "poster" pro QA — sem custo extra de baixar outra coisa
      mediaType: "photo",
      source: "pexels",
      sourceId: p.id,
      width: w,
      height: h,
      alt: typeof p.alt === "string" ? p.alt : undefined,
    });
  }
  return out;
}

// ─── Pixabay VÍDEO (fonte 3 — NOVO provedor, fail-open sem chave) ──────────────
// API não tem filtro "orientation" pra vídeo (ao contrário do endpoint de foto) —
// filtramos portrait manualmente entre os 4 tamanhos que a Pixabay devolve
// (large/medium/small/tiny), preferindo o mais próximo de 1080p, igual Pexels.
export async function searchPixabayVideo(term: string, key: string | undefined): Promise<FootageCandidate[]> {
  if (!key) return [];
  const url = `https://pixabay.com/api/videos/?key=${encodeURIComponent(key)}&q=${encodeURIComponent(term)}&safesearch=true&per_page=${PER_PAGE}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json().catch(() => ({} as any));
  const hits = Array.isArray(data.hits) ? data.hits : [];
  const out: FootageCandidate[] = [];
  for (const h of hits) {
    const sizes = h.videos || {};
    const candidates = [sizes.large, sizes.medium, sizes.small, sizes.tiny].filter(
      (s: any) => s && s.url && s.width && s.height,
    );
    const portrait = candidates.filter((s: any) => s.height >= s.width);
    const pool = portrait.length ? portrait : candidates;
    if (!pool.length) continue;
    // mesma heurística de proximidade a 1080p do Pexels
    pool.sort((a: any, b: any) => {
      const sa = (a.width <= 1440 ? 0 : 1) * 1e6 + Math.abs(a.width - 1080);
      const sb = (b.width <= 1440 ? 0 : 1) * 1e6 + Math.abs(b.width - 1080);
      return sa - sb;
    });
    const pick = pool[0];
    if (!(pick.height >= pick.width)) continue; // sem opção retrato → descarta (evita paisagem esticada)
    if ((h.duration || 0) < 4) continue;
    out.push({
      url: pick.url,
      poster: h.picture_id ? `https://i.vimeocdn.com/video/${h.picture_id}_295x166.jpg` : pick.url,
      mediaType: "video",
      source: "pixabay",
      sourceId: h.id,
      width: pick.width,
      height: pick.height,
      duration: h.duration,
      alt: typeof h.tags === "string" ? h.tags : undefined,
    });
  }
  return out;
}

// ─── Pixabay FOTO (fonte 4 — NOVO provedor, fail-open sem chave) ───────────────
export async function searchPixabayPhoto(term: string, key: string | undefined): Promise<FootageCandidate[]> {
  if (!key) return [];
  const url = `https://pixabay.com/api/?key=${encodeURIComponent(key)}&q=${encodeURIComponent(term)}&image_type=photo&orientation=vertical&safesearch=true&per_page=${PER_PAGE}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json().catch(() => ({} as any));
  const hits = Array.isArray(data.hits) ? data.hits : [];
  const out: FootageCandidate[] = [];
  for (const h of hits) {
    const w = Number(h.imageWidth) || 0;
    const hgt = Number(h.imageHeight) || 0;
    if (!isPortrait(w, hgt)) continue;
    const src = h.largeImageURL || h.webformatURL;
    if (!src) continue;
    out.push({
      url: src,
      poster: src,
      mediaType: "photo",
      source: "pixabay",
      sourceId: h.id,
      width: w,
      height: hgt,
      alt: typeof h.tags === "string" ? h.tags : undefined,
    });
  }
  return out;
}

// Nome canônico de cada fonte, na ORDEM em que o seededShuffle do chamador
// embaralha — cada chamador decide a ordem final (aleatória/ponderada); esta
// lista só documenta as 4 combinações (mediaType × source) disponíveis.
export const FOOTAGE_SOURCES = ["pexels-video", "pexels-photo", "pixabay-video", "pixabay-photo"] as const;
export type FootageSourceKey = (typeof FOOTAGE_SOURCES)[number];

export async function searchBySourceKey(
  sourceKey: FootageSourceKey,
  term: string,
  keys: { pexels?: string; pixabay?: string },
): Promise<FootageCandidate[]> {
  switch (sourceKey) {
    case "pexels-video":
      return searchPexelsVideo(term, keys.pexels);
    case "pexels-photo":
      return searchPexelsPhoto(term, keys.pexels);
    case "pixabay-video":
      return searchPixabayVideo(term, keys.pixabay);
    case "pixabay-photo":
      return searchPixabayPhoto(term, keys.pixabay);
  }
}

// Fontes DISPONÍVEIS de fato (Pixabay só entra com a chave presente) — usado
// pelo sorteio ponderado/aleatório do fallback ao vivo (selectFootage) e pelo
// script de vetagem em massa (scripts/vet-footage-library.mjs).
export function availableSources(keys: { pexels?: string; pixabay?: string }): FootageSourceKey[] {
  return FOOTAGE_SOURCES.filter((s) => (s.startsWith("pixabay") ? !!keys.pixabay : !!keys.pexels));
}

// ─── Chave composta do cache de QA (footage_qa_cache, video_id BIGINT) ─────────
// O cache de veredito era só por `videoId` do Pexels-vídeo (única fonte antes de
// 2026-07-16) — com 4 fontes, IDs numéricos de provedores DIFERENTES podem
// colidir (ex.: Pexels #12345 ≠ Pixabay #12345, mas o mesmo INT). Codifica
// (source,mediaType,sourceId) num único BIGINT injetivo: sourceId*10+tag, tag em
// [0,3] — cabe folgado no BIGINT da coluna, e o mesmo clipe sempre cai na MESMA
// chave (cache continua valendo pra sempre, incidente 07/07 do teto ig-reels).
const SOURCE_TAG: Record<FootageSourceKey, number> = {
  "pexels-video": 0,
  "pexels-photo": 1,
  "pixabay-video": 2,
  "pixabay-photo": 3,
};

export function qaCacheId(sourceKey: FootageSourceKey, sourceId: number): number {
  return sourceId * 10 + SOURCE_TAG[sourceKey];
}

export function candidateSourceKey(c: Pick<FootageCandidate, "source" | "mediaType">): FootageSourceKey {
  return `${c.source}-${c.mediaType}` as FootageSourceKey;
}
