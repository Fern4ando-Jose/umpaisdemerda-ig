// ─── Livro-razão de publicações por (dia, run, idioma) ───────────────────────
// Registra CADA publicação (carrossel e reel) numa linha (day, run, lang). Serve
// a dois fins:
//   1) idempotência: o reel passa a ter dedup (antes não tinha) → re-disparo do
//      watchdog não republica o que já saiu.
//   2) o watchdog (catchup.yml) consulta o que faltou publicar hoje e só redispara
//      os runs ausentes — sobrevive ao atraso/derrubada de cron do GitHub.
// Tudo best-effort/fail-open: erro de banco nunca bloqueia/derruba a publicação.

export function dayUTC(date = new Date()): string {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

// Já existe publicação registrada para (dia, run, lang)? Fail-open: em erro de
// banco devolve false (NÃO bloqueia o publish — preferimos publicar a travar).
export async function runAlreadyPublished(day: string, run: number, lang: string): Promise<boolean> {
  try {
    const { sql } = await import("@vercel/postgres");
    const rows = await sql`
      SELECT 1 FROM published_runs
      WHERE day = ${day} AND run = ${run} AND lang = ${lang} AND instagram_post_id IS NOT NULL
      LIMIT 1
    `;
    return rows.rows.length > 0;
  } catch {
    return false;
  }
}

// Registra (ou atualiza) a publicação. Best-effort. Grava o `topic` (coluna nova)
// para a trava anti-dup CROSS-FORMATO: assim um Reel deixa rastro do tópico e o
// carrossel (e vice-versa) não repete o mesmo tema no dia seguinte.
export async function recordRun(
  day: string, run: number, lang: string, kind: string, instagramPostId: string | null,
  topic?: string | null,
): Promise<void> {
  try {
    const { sql } = await import("@vercel/postgres");
    await sql`
      INSERT INTO published_runs (day, run, lang, kind, instagram_post_id, topic, ts)
      VALUES (${day}, ${run}, ${lang}, ${kind}, ${instagramPostId}, ${topic ?? null}, NOW())
      ON CONFLICT (day, run, lang) DO UPDATE SET
        kind = ${kind}, instagram_post_id = ${instagramPostId},
        topic = COALESCE(${topic ?? null}, published_runs.topic), ts = NOW()
    `;
  } catch { /* livro-razão é best-effort — nunca quebra o pipeline */ }
}

// Tópicos publicados na conta (lang) nos últimos `days` dias, em QUALQUER formato:
// reels (livro-razão `published_runs.topic`) ∪ carrosséis (`posts.topic`). É a
// base da trava anti-dup REAL na seleção do tema. Fail-open: erro → conjunto vazio
// (não bloqueia; volta ao comportamento antigo).
export async function recentTopicsForLang(lang: string, days = 7): Promise<Set<string>> {
  const out = new Set<string>();
  try {
    const { sql } = await import("@vercel/postgres");
    const a = await sql<{ topic: string }>`
      SELECT DISTINCT topic FROM published_runs
      WHERE lang = ${lang} AND topic IS NOT NULL
        AND instagram_post_id IS NOT NULL
        AND ts > NOW() - (${days} || ' days')::interval
    `;
    for (const r of a.rows) if (r.topic) out.add(r.topic);
    const b = await sql<{ topic: string }>`
      SELECT DISTINCT topic FROM posts
      WHERE lang = ${lang} AND topic IS NOT NULL
        AND published_at > NOW() - (${days} || ' days')::interval
    `;
    for (const r of b.rows) if (r.topic) out.add(r.topic);
  } catch { /* fail-open */ }
  return out;
}

// Tópicos publicados em QUALQUER conta nos últimos `days` dias (reels ∪ carrosséis).
// Base UNIFICADA da seleção: ES e PT usam a MESMA base de recentes → escolhem o
// MESMO tema por vaga (vídeo compartilhado) E nenhum repete. Fail-open: vazio.
//
// TRÊS fontes (pra não ter ponto cego): (1) `published_runs.topic` — reels que
// gravaram o tópico (a coluna nasceu em 22/06, então reels ANTERIORES têm NULL);
// (2) `posts.topic` — carrosséis (sempre gravaram); (3) `reel_shared_cache.topic`
// — o tópico REAL de cada reel por dia (resolvido no preview do footage), que
// COBRE os reels antigos sem `published_runs.topic`. Sem (3), a trava era cega aos
// reels da semana e repetia o tema deles num carrossel dias depois.
export async function recentTopicsAllLangs(days = 7): Promise<Set<string>> {
  const out = new Set<string>();
  try {
    const { sql } = await import("@vercel/postgres");
    const a = await sql<{ topic: string }>`
      SELECT DISTINCT topic FROM published_runs
      WHERE topic IS NOT NULL AND instagram_post_id IS NOT NULL
        AND ts > NOW() - (${days} || ' days')::interval
    `;
    for (const r of a.rows) if (r.topic) out.add(r.topic);
    const b = await sql<{ topic: string }>`
      SELECT DISTINCT topic FROM posts
      WHERE topic IS NOT NULL
        AND published_at > NOW() - (${days} || ' days')::interval
    `;
    for (const r of b.rows) if (r.topic) out.add(r.topic);
    const c = await sql<{ topic: string }>`
      SELECT DISTINCT topic FROM reel_shared_cache
      WHERE topic IS NOT NULL
        AND created_at > NOW() - (${days} || ' days')::interval
    `;
    for (const r of c.rows) if (r.topic) out.add(r.topic);
  } catch { /* fail-open */ }
  return out;
}

// Quais runs do dia já têm publicação, por idioma. Usado pelo watchdog (via
// /api/runs-status) para decidir o que falta. Retorna ex.: { es: [4], pt: [] }.
export async function publishedRunsToday(day: string): Promise<Record<string, number[]>> {
  const out: Record<string, number[]> = {};
  try {
    const { sql } = await import("@vercel/postgres");
    const rows = await sql<{ run: number; lang: string }>`
      SELECT run, lang FROM published_runs
      WHERE day = ${day} AND instagram_post_id IS NOT NULL
    `;
    for (const r of rows.rows) {
      (out[r.lang] ??= []).push(r.run);
    }
  } catch { /* fail-open: devolve o que tiver */ }
  return out;
}
