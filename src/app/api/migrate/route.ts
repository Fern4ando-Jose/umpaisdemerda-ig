import { NextRequest, NextResponse } from "next/server";
import { accountFor } from "@/lib/accounts";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const { sql } = await import("@vercel/postgres");
  const results: string[] = [];

  // Tabela posts — colunas que podem faltar
  const postsCols = [
    { name: "topic", def: "TEXT NOT NULL DEFAULT 'geral'" },
    { name: "slot", def: "TEXT NOT NULL DEFAULT 'manha'" },
    { name: "body", def: "TEXT NOT NULL DEFAULT ''" },
    { name: "instagram_caption", def: "TEXT NOT NULL DEFAULT ''" },
    { name: "tags", def: "JSONB NOT NULL DEFAULT '[]'" },
    { name: "instagram_post_id", def: "TEXT" },
    // Conta/idioma do post — usado pela trava anti-dup POR CONTA (ES e PT não se
    // bloqueiam). Registros antigos são todos ES (conta única original).
    { name: "lang", def: "TEXT NOT NULL DEFAULT 'es'" },
  ];

  for (const col of postsCols) {
    try {
      await sql.query(
        `ALTER TABLE posts ADD COLUMN IF NOT EXISTS ${col.name} ${col.def}`
      );
      results.push(`posts.${col.name}: ok`);
    } catch (e) {
      results.push(`posts.${col.name}: ${String(e)}`);
    }
  }

  // Tabela config — guarda token e outras configs dinâmicas
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS config (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    results.push("config table: ok");
  } catch (e) {
    results.push("config table: " + String(e));
  }

  // Tabela illustration_cache — reuso da ilustração do dia (corta gasto na fal).
  // A mesma (model, cat, subject) gerada e aprovada no QA é reusada por 24h entre
  // publish / preview / dryrun (e entre carrossel e Reel), em vez de regerar.
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS illustration_cache (
        cache_key  TEXT PRIMARY KEY,
        url        TEXT NOT NULL,
        subject    TEXT,
        cat        TEXT,
        model      TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    results.push("illustration_cache table: ok");
  } catch (e) {
    results.push("illustration_cache table: " + String(e));
  }

  // Tabela reel_shared_cache — base do Reel COMPARTILHADA entre idiomas (mesmo
  // vídeo ES/PT): pesquisa (Tavily) + videoQueries + clipes do footage (Pexels)
  // resolvidos UMA vez por (tópico, dia). O 2º idioma reusa → footage idêntico e
  // sem pagar Tavily de novo. Só a copy muda por idioma. Ver src/lib/reel-shared.ts.
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS reel_shared_cache (
        cache_key     TEXT PRIMARY KEY,
        topic         TEXT,
        research      JSONB NOT NULL DEFAULT '[]',
        video_queries JSONB NOT NULL DEFAULT '[]',
        clips         JSONB NOT NULL DEFAULT '[]',
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    results.push("reel_shared_cache table: ok");
  } catch (e) {
    results.push("reel_shared_cache table: " + String(e));
  }

  // Tabela published_runs — livro-razão (dia, run, idioma) de publicações. Dá
  // idempotência ao reel (dedup) e alimenta o watchdog (catchup.yml), que redispara
  // só os runs que faltaram no dia. Ver src/lib/run-ledger.ts.
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS published_runs (
        day               TEXT NOT NULL,
        run               INT  NOT NULL,
        lang              TEXT NOT NULL,
        kind              TEXT,
        instagram_post_id TEXT,
        ts                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (day, run, lang)
      )
    `;
    results.push("published_runs table: ok");
  } catch (e) {
    results.push("published_runs table: " + String(e));
  }

  // Coluna published_runs.topic — rastro do tópico por publicação (reel + carrossel)
  // p/ a trava anti-dup CROSS-FORMATO (não repetir o mesmo tema reel↔carrossel).
  try {
    await sql`ALTER TABLE published_runs ADD COLUMN IF NOT EXISTS topic TEXT`;
    results.push("published_runs.topic: ok");
  } catch (e) {
    results.push("published_runs.topic: " + String(e));
  }

  // Tabela editions — número de edição (Nº na capa) por VAGA (dia, run), o MESMO
  // p/ ES e PT (é o mesmo conteúdo traduzido). Antes o Nº vinha de COUNT(posts)+1,
  // que NÃO andava pra Reels (só carrossel grava em posts) → "Nº 102" repetia em
  // todo Reel. Aqui cada vaga ganha um número monotônico único. Ver src/lib/edition.ts.
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS editions (
        day        TEXT NOT NULL,
        run        INT  NOT NULL,
        ed         INT  NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (day, run)
      )
    `;
    results.push("editions table: ok");
  } catch (e) {
    results.push("editions table: " + String(e));
  }

  // Tabela spend_log — contabiliza cada chamada paga (fal/Anthropic/Tavily) por
  // automação, p/ a visão de /api/spend e o teto diário por automação (src/lib/spend.ts).
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS spend_log (
        id         BIGSERIAL PRIMARY KEY,
        ts         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        automation TEXT NOT NULL DEFAULT 'manual',
        platform   TEXT NOT NULL,
        operation  TEXT NOT NULL,
        model      TEXT,
        units      NUMERIC NOT NULL DEFAULT 0,
        cost_usd   NUMERIC NOT NULL DEFAULT 0,
        meta       JSONB
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS spend_log_ts_idx ON spend_log (ts)`;
    await sql`CREATE INDEX IF NOT EXISTS spend_log_auto_ts_idx ON spend_log (automation, ts)`;
    results.push("spend_log table: ok");
  } catch (e) {
    results.push("spend_log table: " + String(e));
  }

  // Seed: insere o token atual do env var se a linha ainda não existe
  try {
    // Conta do produto (isolamento chave-por-produto): env + chave-de-config
    // do UPM via accounts.ts (fonte única). getAccessToken lê acc.dbTokenKey.
    const acc = accountFor("pt");
    const dbKey = acc.dbTokenKey ?? "meta_access_token";
    const token = process.env[acc.tokenEnv];
    if (token) {
      await sql`
        INSERT INTO config (key, value, updated_at)
        VALUES (${dbKey}, ${token}, NOW())
        ON CONFLICT (key) DO UPDATE SET value = ${token}, updated_at = NOW()
      `;
      results.push("config seed token: ok");
    } else {
      results.push(`config seed token: ${acc.tokenEnv} env var nao definida`);
    }
  } catch (e) {
    results.push("config seed token: " + String(e));
  }

  const cols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'posts' ORDER BY ordinal_position
  `;

  return NextResponse.json({
    ok: true,
    results,
    posts_columns: cols.rows.map((r) => r.column_name),
  });
}
