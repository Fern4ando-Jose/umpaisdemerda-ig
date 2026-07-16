// ─── Detecção de mídia + hash — PURO, seguro no bundle do Remotion ────────────
// video/*.tsx importa isto com caminho RELATIVO (../src/lib/footage-media), não
// via alias `@/` — o webpack do Remotion não resolve o alias (mesmo motivo do
// `normalizePhrase` em ReelV2.tsx, ver comentário lá). Por isso este módulo é
// estritamente PURO: sem `next/*`, sem `@vercel/postgres`, sem `process.env` —
// só funções determinísticas de string. Fonte ÚNICA do hash FNV-1a (antes
// duplicado em reel-shared.ts e scripts/fetch-footage.mjs); reel-shared.ts agora
// REEXPORTA `hashStr` daqui em vez de declarar o seu.
//
// 4 fontes de footage (Pexels vídeo/foto + Pixabay vídeo/foto, ver
// footage-providers.ts) viram UMA lista de URLs misturada em `selectFootage`. O
// RENDER (video/Reel.tsx) precisa saber se cada URL é vídeo (OffthreadVideo) ou
// foto (Ken Burns, video/KenBurns.tsx) — em vez de carregar um 5º campo por clipe
// (mudaria o schema de reel-props.json e o writeback do reel_shared_cache), a
// extensão da própria URL já entrega isso sem ambiguidade: todo provedor serve
// foto como .jpg/.jpeg/.png/.webp e vídeo como .mp4/.webm — CDN de imagem nunca
// serve extensão de vídeo e vice-versa.
export function isPhotoUrl(url: string | undefined | null): boolean {
  return /\.(jpe?g|png|webp|gif)(\?.*)?$/i.test(String(url || ""));
}

// Hash estável (FNV-1a, 32-bit) — usado tanto pro SEED de seleção (tópico,dia)
// quanto pro modo Ken Burns por clipe (determinístico pela própria URL: o mesmo
// clipe sempre pan/zoom do mesmo jeito, sem estado extra).
export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
