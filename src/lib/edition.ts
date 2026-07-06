// ─── Número de edição (Nº na capa) ────────────────────────────────────────────
// O "Nº" do cabeçalho (ex.: "DR. LIBERTAD · Nº 102") era COUNT(posts)+1. Só o
// CARROSSEL grava em `posts`; o Reel registra apenas no livro-razão. Logo o
// contador NÃO andava entre carrosséis → todo Reel pegava o MESMO número e o
// "Nº 102" se repetia em todos os posts (visível no @dr.liberdade.br).
//
// Aqui o número é atribuído por VAGA (dia, run) e é o MESMO p/ ES e PT (é o mesmo
// conteúdo traduzido — uma edição em dois idiomas). Monotônico, único por vaga,
// idempotente (reruns / 2º idioma lêem o mesmo) e CONTÍNUO (segue de onde o
// esquema antigo estava: nunca anda pra trás). Tudo best-effort: falha de banco
// devolve 0 e o chamador cai no esquema antigo (COUNT+1).

// Próximo número: 1 acima do maior já atribuído E do piso do esquema antigo
// (COUNT de posts), pra continuar de ~102 sem repetir nem regredir. Função PURA
// (testável); a parte SQL fica em editionFor.
export function pickNextEdition(maxAssigned: number, postsBase: number): number {
  const m = Number.isFinite(maxAssigned) ? maxAssigned : 0;
  const b = Number.isFinite(postsBase) ? postsBase : 0;
  return Math.max(m, b) + 1;
}

// Atribui (ou lê) o Nº da vaga (dia, run). Mesmo (dia,run) → mesmo número, pra
// qualquer idioma e em qualquer rerun. Devolve 0 se o banco falhar (fail-open).
export async function editionFor(day: string, run: number): Promise<number> {
  try {
    const { sql } = await import("@vercel/postgres");
    await sql`
      CREATE TABLE IF NOT EXISTS editions (
        day TEXT NOT NULL, run INT NOT NULL, ed INT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (day, run)
      )
    `;
    // Já atribuído (rerun / 2º idioma)? → devolve o MESMO número.
    const ex = await sql`SELECT ed FROM editions WHERE day = ${day} AND run = ${run}`;
    if (ex.rows[0]) return Number(ex.rows[0].ed);

    const mx = await sql`SELECT COALESCE(MAX(ed), 0) AS m FROM editions`;
    const base = await sql`SELECT COUNT(*) AS n FROM posts`;
    const next = pickNextEdition(Number(mx.rows[0]?.m ?? 0), Number(base.rows[0]?.n ?? 0));

    // Atribui atomicamente. Corrida ES/PT da MESMA vaga: o 1º insere; o 2º bate no
    // ON CONFLICT (PK dia,run), não insere e lê o número do 1º logo abaixo.
    const ins = await sql`
      INSERT INTO editions (day, run, ed) VALUES (${day}, ${run}, ${next})
      ON CONFLICT (day, run) DO NOTHING
      RETURNING ed
    `;
    if (ins.rows[0]) return Number(ins.rows[0].ed);

    const again = await sql`SELECT ed FROM editions WHERE day = ${day} AND run = ${run}`;
    return again.rows[0] ? Number(again.rows[0].ed) : next;
  } catch {
    return 0; // fail-open → chamador usa o esquema antigo (COUNT+1)
  }
}
