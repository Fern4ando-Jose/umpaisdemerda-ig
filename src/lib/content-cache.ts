// ─── Cache da COPY por (tópico, dia, idioma) ─────────────────────────────────
// A copy (título/slides/cta/legenda/tags/videoQueries) é regerada pela Anthropic a
// CADA chamada de preview/publish. Com a instabilidade do cron do GitHub, um run cai
// e é REDISPARADO várias vezes/dia → a copy era repaga toda vez (maior ralo do teto:
// ig-reels gastou $0,24 só em `content` num dia, ~2× o esperado, por causa dos
// redisparos). Aqui ela é cacheada por (tópico, dia, idioma) e reusada por 24h →
// redisparo NÃO repaga o texto. Espelha reel-shared.ts / illustration.ts.
//
// Best-effort / fail-open: qualquer erro de banco devolve null e o pipeline gera
// normalmente (comportamento antigo). Nunca quebra a publicação.
//
// Chave INCLUI o idioma (≠ reel-shared, que é língua-independente): a copy é
// regerada por mercado (ES ≠ PT), então cada idioma tem sua entrada.

export function contentCacheKey(topic: string, day: string, lang: string): string {
  return `${topic}|${day}|${lang}`;
}

// Lê a copy cacheada (≤24h). Só devolve se tiver o mínimo válido (postTitle + slides),
// pra um registro corrompido não virar um post vazio.
export async function readContentCache(topic: string, day: string, lang: string): Promise<unknown | null> {
  try {
    const { sql } = await import("@vercel/postgres");
    const key = contentCacheKey(topic, day, lang);
    const rows = await sql<{ content: unknown }>`
      SELECT content FROM content_cache
      WHERE cache_key = ${key} AND created_at > NOW() - INTERVAL '24 hours'
      LIMIT 1
    `;
    const c = rows.rows[0]?.content as { postTitle?: unknown; slides?: unknown } | undefined;
    if (!c || typeof c.postTitle !== "string" || !c.postTitle || !Array.isArray(c.slides)) return null;
    return c;
  } catch {
    return null; // sem cache → gera normalmente (comportamento antigo)
  }
}

export async function writeContentCache(topic: string, day: string, lang: string, content: unknown): Promise<void> {
  try {
    const { sql } = await import("@vercel/postgres");
    const key = contentCacheKey(topic, day, lang);
    await sql`
      INSERT INTO content_cache (cache_key, topic, lang, content, created_at)
      VALUES (${key}, ${topic}, ${lang}, ${JSON.stringify(content)}::jsonb, NOW())
      ON CONFLICT (cache_key) DO UPDATE SET
        content = ${JSON.stringify(content)}::jsonb,
        created_at = NOW()
    `;
  } catch { /* cache é best-effort — nunca quebra o pipeline */ }
}
