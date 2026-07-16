// ─── Base do Reel COMPARTILHADA entre idiomas ────────────────────────────────
// O Reel ES e o PT do MESMO tópico/dia devem ser o MESMO vídeo: mesmo footage
// (Pexels) e mesma pesquisa (Tavily) — só a COPY muda por idioma (regenerada
// pelo marketBrief, não traduzida). Antes, cada idioma refazia a busca (Tavily
// pago 2×) e escolhia footage próprio (o seed incluía o @handle DE PROPÓSITO) →
// dois vídeos visualmente diferentes. Aqui a parte LÍNGUA-INDEPENDENTE (pesquisa
// + videoQueries + clipes do footage) é resolvida UMA vez por (tópico, dia) e
// cacheada; o 2º idioma reusa tudo. Espelha o padrão de `illustration.ts`.
//
// TUDO best-effort/fail-open: qualquer falha de banco/Pexels devolve null e o
// pipeline segue como antes (cada idioma busca o seu). Nunca quebra a publicação.

import { FOOTAGE_LIBRARY, beatPillars } from "./footage-library";

// Sorteio determinístico por seed (LCG) — mesmo (tópico,dia) → mesmos clipes ES/PT.
// Exportado p/ o preflight de saúde (footage-health.ts) sortear o SUBSTITUTO de um
// clipe morto com a mesma regra determinística — ES e PT repõem o mesmo clipe.
export function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = arr.slice();
  let s = seed >>> 0 || 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface SearchResult { title: string; content: string; url: string }

export interface ReelSharedBundle {
  research: SearchResult[];   // resultados da Tavily (contexto p/ a copy)
  videoQueries: string[];     // termos de footage canônicos (inglês, do 1º idioma)
  clips: string[];            // URLs dos clipes Pexels escolhidos (footage idêntico)
}

// Dia UTC (YYYY-MM-DD) — entra na chave p/ haver variação diária e expiração natural.
export function dayUTC(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

// Chave do cache: (tópico, dia). NÃO inclui idioma — é o que garante ES e PT
// lerem/escreverem a MESMA base. (Invariante coberto por teste no CI.)
export function reelSharedKey(topic: string, day: string): string {
  return `${topic}|${day}`;
}

// Hash estável (FNV-1a) — seed de seleção do footage, derivado de (tópico, dia).
// Independente de conta/@handle → ES e PT escolhem o MESMO clipe.
export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ─── Cache (Postgres) ─────────────────────────────────────────────────────────

export async function readReelShared(topic: string, day: string): Promise<ReelSharedBundle | null> {
  try {
    const { sql } = await import("@vercel/postgres");
    const key = reelSharedKey(topic, day);
    const rows = await sql<{ research: unknown; video_queries: unknown; clips: unknown }>`
      SELECT research, video_queries, clips FROM reel_shared_cache
      WHERE cache_key = ${key} AND created_at > NOW() - INTERVAL '24 hours'
      LIMIT 1
    `;
    const r = rows.rows[0];
    if (!r) return null;
    const research = Array.isArray(r.research) ? (r.research as SearchResult[]) : [];
    const videoQueries = Array.isArray(r.video_queries) ? (r.video_queries as string[]) : [];
    const clips = Array.isArray(r.clips) ? (r.clips as string[]) : [];
    // Só serve de fonte compartilhada se tiver clipes (o que torna o vídeo idêntico).
    if (!clips.length) return null;
    return { research, videoQueries, clips };
  } catch {
    return null; // sem cache → cada idioma resolve o seu (comportamento antigo)
  }
}

export async function writeReelShared(topic: string, day: string, bundle: ReelSharedBundle): Promise<void> {
  try {
    const { sql } = await import("@vercel/postgres");
    const key = reelSharedKey(topic, day);
    await sql`
      INSERT INTO reel_shared_cache (cache_key, topic, research, video_queries, clips, created_at)
      VALUES (
        ${key}, ${topic},
        ${JSON.stringify(bundle.research)}::jsonb,
        ${JSON.stringify(bundle.videoQueries)}::jsonb,
        ${JSON.stringify(bundle.clips)}::jsonb,
        NOW()
      )
      ON CONFLICT (cache_key) DO UPDATE SET
        research = ${JSON.stringify(bundle.research)}::jsonb,
        video_queries = ${JSON.stringify(bundle.videoQueries)}::jsonb,
        clips = ${JSON.stringify(bundle.clips)}::jsonb,
        created_at = NOW()
    `;
  } catch { /* cache é best-effort — nunca quebra o pipeline */ }
}

// ─── Writeback do footage achado no CI (fallback) ─────────────────────────────
// Quando a API devolve 0 clipes (Pexels falhou naquele instante), cada conta cai
// no fallback do CI (fetch-footage.mjs) e busca sozinha — com videoQueries por
// IDIOMA → ES e PT podiam achar footage DIFERENTE (ou um achava e o outro saía
// preto). Para garantir o MESMO vídeo, a 1ª conta que achar footage no CI grava
// aqui; a 2ª conta (dispara 5 min depois) lê pelo readReelShared e REUSA.
// NÃO sobrescreve a pesquisa (research) já cacheada — só footage/videoQueries.

export interface ShareClipsInput { topic: string; day: string; clips: string[]; videoQueries: string[] }

// Validador PURO (testável): normaliza o corpo do POST /api/reel-share. Retorna
// null se inválido (sem tópico/dia válido ou sem nenhum clipe utilizável).
export function normalizeShareInput(body: unknown): ShareClipsInput | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const topic = typeof b.topic === "string" ? b.topic.trim() : "";
  const day = typeof b.day === "string" ? b.day.trim() : "";
  if (!topic || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const clips = Array.isArray(b.clips) ? b.clips.filter((c): c is string => typeof c === "string" && c.trim() !== "") : [];
  if (!clips.length) return null; // só compartilha quando há footage de verdade
  const videoQueries = Array.isArray(b.videoQueries) ? b.videoQueries.filter((q): q is string => typeof q === "string" && q.trim() !== "") : [];
  return { topic, day, clips, videoQueries };
}

// Grava SÓ o footage (e videoQueries) na base compartilhada, preservando a
// pesquisa já existente (ON CONFLICT não toca em research). Best-effort.
export async function writeReelSharedClips(input: ShareClipsInput): Promise<void> {
  try {
    const { sql } = await import("@vercel/postgres");
    const key = reelSharedKey(input.topic, input.day);
    await sql`
      INSERT INTO reel_shared_cache (cache_key, topic, research, video_queries, clips, created_at)
      VALUES (
        ${key}, ${input.topic},
        '[]'::jsonb,
        ${JSON.stringify(input.videoQueries)}::jsonb,
        ${JSON.stringify(input.clips)}::jsonb,
        NOW()
      )
      ON CONFLICT (cache_key) DO UPDATE SET
        video_queries = ${JSON.stringify(input.videoQueries)}::jsonb,
        clips = ${JSON.stringify(input.clips)}::jsonb,
        created_at = NOW()
    `;
  } catch { /* best-effort — nunca quebra o pipeline do CI */ }
}

// ─── Anti-repetição CROSS-REEL (14 dias) — NOVO 2026-07-16 ─────────────────────
// URLs de footage usadas em Reels recentes, lidas da própria reel_shared_cache
// (mesma tabela que já guarda o footage compartilhado ES↔PT — sem tabela nova).
// Antes a UPM só evitava repetir DENTRO do mesmo reel (`used`); com o acervo
// ainda pequeno, o mesmo clipe podia voltar todo dia. Espelha a correção
// equivalente do DR-Libertad (recentClipIds→recentClipUrls, mas aqui nasce
// direto por URL — não existe versão antiga por ID a migrar). Fail-open: erro de
// banco → conjunto vazio (comportamento anterior, sem regressão).
async function recentClipUrls(excludeKey?: string): Promise<Set<string>> {
  try {
    const { sql } = await import("@vercel/postgres");
    const rows = await sql<{ cache_key: string; clips: unknown }>`
      SELECT cache_key, clips FROM reel_shared_cache WHERE created_at > now() - interval '14 days'`;
    const urls = new Set<string>();
    for (const r of rows.rows) {
      if (excludeKey && r.cache_key === excludeKey) continue;
      const arr = Array.isArray(r.clips) ? (r.clips as string[]) : [];
      for (const u of arr) urls.add(String(u));
    }
    return urls;
  } catch {
    return new Set<string>();
  }
}

// ─── Seleção de footage (biblioteca CURADA, custo zero, 100% vetado) ──────────
// Footage vem SEMPRE do whitelist FOOTAGE_LIBRARY (clipes vetados pelo QA
// automático + à mão). NÃO há busca ao vivo no Pexels/Pixabay: aquela roleta
// não-vetada já trouxe marco dos EUA e cena imprópria — o caminho permanece
// FECHADO (2026-07-16: o mix de 4 fontes amplia a WHITELIST via
// scripts/vet-footage-library.mjs, curadoria em lote com QA antes de entrar;
// nunca busca ao vivo dentro do selectFootage). O seed de diversificação vem de
// (tópico, dia), NÃO do @handle/edição → ES e PT do mesmo run escolhem o MESMO
// clipe; a diversidade entre DIAS/tópicos é mantida.
//
// 2026-07-16: a whitelist agora pode MISTURAR Pexels vídeo/foto + Pixabay
// vídeo/foto (metadado `source`/`mediaType` em cada entrada — o shuffle já
// embaralha as 4 fontes entre si) e o sorteio evita repetir URL usada em Reels
// recentes (cross-fonte, `recentClipUrls`), não só dentro do mesmo reel.

// Seleciona numClips URLs de footage curado, 1 por cena seguindo o ARCO
// (gancho→…→contraste da casta→virada), sem repetir clipe no mesmo reel nem em
// Reels recentes (14d), determinístico por (tópico,dia). `videoQueries` não é
// mais usado na seleção (mantido na assinatura para compatibilidade com os
// chamadores). Só devolve [] se a biblioteca inteira estiver vazia → o Reel cai
// no fallback SEGURO de última instância (ilustração estática). NUNCA busca
// Pexels/Pixabay ao vivo.
export async function selectFootage(
  _videoQueries: string[],
  cat: string,
  seed: number,
  numClips = 5, // 5 cenas do Reel (capa + 3 insights + CTA) → 5 clipes distintos
  excludeKey?: string, // cache_key do PRÓPRIO (tópico,dia) — fora do "avoid" (espelha #126 do DR)
): Promise<string[]> {
  const arc = beatPillars(cat, numClips);
  // Rede de segurança: se um pilar do arco vier vazio (cat desconhecido), sorteia
  // da UNIÃO de todos os clipes curados — ainda 100% vetado, jamais Pexels cru.
  const allCurated = Object.values(FOOTAGE_LIBRARY).flatMap((l) => l.map((c) => c.url));
  const avoid = await recentClipUrls(excludeKey);
  const used = new Set<string>();
  const picked: string[] = [];
  for (let i = 0; i < numClips; i++) {
    const pillar = arc[i];
    const pool = FOOTAGE_LIBRARY[pillar]?.length
      ? FOOTAGE_LIBRARY[pillar].map((c) => c.url)
      : allCurated;
    if (!pool.length) continue;
    const urls = seededShuffle(pool, seed + i * 97);
    // 1ª tentativa: nem usado neste reel, nem usado em Reels recentes (14d).
    let url = urls.find((u) => !used.has(u) && !avoid.has(u));
    // Relaxa (só o recente, não a whitelist inteira): sem opção fresca, aceita
    // repetir um clipe recente antes de deixar a cena sem footage.
    if (!url) url = urls.find((u) => !used.has(u)) ?? urls[0];
    if (url) { used.add(url); picked.push(url); }
  }
  return picked;
}
