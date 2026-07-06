import { NextRequest, NextResponse } from "next/server";
import { ACCOUNTS, AccountCfg } from "@/lib/accounts";

/**
 * GET /api/refresh-token
 *
 * Renova o token de longa duração da Instagram (Instagram API with Instagram Login)
 * de TODAS as contas que têm `dbTokenKey` (ES e PT). Chame via cron mensal (antes
 * dos 60 dias expirarem).
 *
 * Fluxo correto para tokens "IGAF..." (graph.instagram.com):
 *   GET https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=...
 * Não usa app_id/app_secret (esse é o fluxo do Facebook Login, que não se aplica aqui).
 *
 * Requisito da Meta: o token precisa ter pelo menos 24h e ainda estar válido.
 *
 * Fluxo por conta:
 *  1. Lê o token atual do banco (tabela config, chave `dbTokenKey`) com fallback
 *     para a env var da conta (`tokenEnv`).
 *  2. Chama o endpoint de refresh do Instagram para obter um novo token de 60 dias.
 *  3. Salva o novo token no banco sob a mesma `dbTokenKey`.
 *
 * Na 1ª rodada do PT o DB ainda está vazio → usa a env `META_ACCESS_TOKEN_PT`,
 * renova e **semeia** o DB. A partir daí o DB é a fonte (sem intervenção manual).
 * O publish/publish-reel sempre leem o token do banco (com fallback env).
 *
 * Falhas são isoladas por conta: se o token PT ainda não tem 24h, o ES renova
 * mesmo assim. HTTP 500 só se NENHUMA conta renovou.
 */

interface RefreshResult {
  lang: string;
  key: string;
  ok: boolean;
  expires_in_days?: number;
  error?: unknown;
}

async function refreshAccount(
  acc: AccountCfg,
  sql: typeof import("@vercel/postgres").sql
): Promise<RefreshResult> {
  const key = acc.dbTokenKey!;

  // 1. Token atual: DB → fallback env
  const rows = await sql`SELECT value FROM config WHERE key = ${key}`;
  const currentToken = rows.rows[0]?.value ?? process.env[acc.tokenEnv];

  if (!currentToken) {
    return { lang: acc.lang, key, ok: false, error: "Sem token no banco nem na env var" };
  }

  // 2. Renovar via fluxo do Instagram Login (ig_refresh_token)
  const refreshUrl =
    `https://graph.instagram.com/refresh_access_token` +
    `?grant_type=ig_refresh_token&access_token=${currentToken}`;

  const res = await fetch(refreshUrl);
  const data = await res.json();

  if (!res.ok || !data.access_token) {
    // Não ecoar o objeto cru da Meta (pode conter detalhes de token/conta) — só logar no servidor.
    console.error(`[refresh-token] falha ao renovar ${acc.lang}: status=${res.status}`);
    return { lang: acc.lang, key, ok: false, error: "falha ao renovar token" };
  }

  const newToken: string = data.access_token;
  const expiresIn: number = data.expires_in ?? 5183944; // ~60 dias

  // 3. Salvar novo token no banco (semeia o PT na 1ª vez)
  await sql`
    INSERT INTO config (key, value, updated_at)
    VALUES (${key}, ${newToken}, NOW())
    ON CONFLICT (key) DO UPDATE SET value = ${newToken}, updated_at = NOW()
  `;

  return { lang: acc.lang, key, ok: true, expires_in_days: Math.round(expiresIn / 86400) };
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const { sql } = await import("@vercel/postgres");

  // Toda conta com refresh automático (dbTokenKey definido) é renovada.
  const accounts = Object.values(ACCOUNTS).filter((a) => a.dbTokenKey);

  const results: RefreshResult[] = [];
  for (const acc of accounts) {
    try {
      results.push(await refreshAccount(acc, sql));
    } catch (error) {
      console.error(`[refresh-token] erro inesperado ${acc.lang}:`, error);
      results.push({ lang: acc.lang, key: acc.dbTokenKey!, ok: false, error: "erro ao renovar token" });
    }
  }

  const anyOk = results.some((r) => r.ok);
  return NextResponse.json(
    {
      ok: anyOk,
      message: anyOk ? "Refresh concluído" : "Nenhuma conta renovou",
      results,
      updated_at: new Date().toISOString(),
    },
    { status: anyOk ? 200 : 500 }
  );
}
