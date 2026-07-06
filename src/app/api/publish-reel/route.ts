import { NextRequest, NextResponse } from "next/server";
import { Lang, accountFor, getLang } from "@/lib/accounts";
import { dayUTC, runAlreadyPublished, recordRun } from "@/lib/run-ledger";

// Publicação de REELS (vídeo) no @umpaisdemerda via Instagram Graph API v25.
// O vídeo já precisa estar hospedado em URL pública (ex.: Vercel Blob).
// Recebe ?video=<url> e ?caption=<texto> (ou JSON no POST) e publica seguindo
// o fluxo: criar container REELS → polling de status → media_publish.

export const maxDuration = 300;

// ─── Token do Instagram (mesma estratégia do /api/publish) ────────────────────
async function getAccessToken(lang: Lang = "pt"): Promise<string> {
  const acc = accountFor(lang);
  // ES: token no config do DB (refresh automático) → env. PT: só env.
  if (acc.dbTokenKey) {
    try {
      const { sql } = await import("@vercel/postgres");
      const rows = await sql`SELECT value FROM config WHERE key = ${acc.dbTokenKey}`;
      if (rows.rows[0]?.value) return rows.rows[0].value;
    } catch {
      /* fallback para env var */
    }
  }
  return process.env[acc.tokenEnv] ?? "";
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── Publicação como REEL ─────────────────────────────────────────────────────
async function publishReel(videoUrl: string, caption: string, lang: Lang = "pt"): Promise<string> {
  const acc = accountFor(lang);
  const accountId = process.env[acc.accountIdEnv] ?? "";
  const token = await getAccessToken(lang);
  const graphRoot = "https://graph.instagram.com/v25.0";
  const base = `${graphRoot}/${accountId}`;

  // 1. Criar container do reel
  // Capa = frame 0 (footage, SEM título por cima) — preferência do dono pelo visual
  // limpo. NÃO definir thumb_offset (tentamos 2000ms p/ mostrar o título, revertido:
  // o dono não quis o título na capa). Se um clipe sair escuro demais na capa, tratar
  // no FOOTAGE (clipe/seleção), não forçando um frame com texto.
  const createRes = await fetch(`${base}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      media_type: "REELS",
      video_url: videoUrl,
      caption,
      access_token: token,
    }),
  });
  if (!createRes.ok) throw new Error(`Reel container error: ${await createRes.text()}`);
  const { id: creationId } = await createRes.json();
  if (!creationId) throw new Error("Reel container sem creation_id");

  // 2. Polling do status — o vídeo precisa ser processado antes de publicar.
  //    Reels podem levar alguns minutos; espera até ~250s (a função permite 300s).
  //    Aborta em ERROR.
  let finished = false;
  let lastStatus = "?";
  for (let attempt = 1; attempt <= 50; attempt++) {
    await sleep(5000);
    // O container é consultado pelo seu ID na RAIZ do graph (NÃO sob o accountId).
    const statusRes = await fetch(
      `${graphRoot}/${creationId}?fields=status_code&access_token=${token}`
    );
    if (!statusRes.ok) {
      // erro transitório — segue tentando dentro do limite
      continue;
    }
    const { status_code } = await statusRes.json();
    lastStatus = status_code ?? "(sem status_code)";
    if (status_code === "FINISHED") {
      finished = true;
      break;
    }
    if (status_code === "ERROR") {
      throw new Error(`Reel processamento falhou (status ERROR) na tentativa ${attempt}`);
    }
    // IN_PROGRESS / PUBLISHED / EXPIRED → continua o loop
  }
  if (!finished) throw new Error(`Timeout: reel não finalizou (último status=${lastStatus})`);

  // 3. Publicar
  const pubRes = await fetch(`${base}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: creationId, access_token: token }),
  });
  if (!pubRes.ok) throw new Error(`Publish error: ${await pubRes.text()}`);
  const { id: postId } = await pubRes.json();
  return postId;
}

// ─── Handler ──────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}

async function handle(req: NextRequest) {
  // Autenticação do cron
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  // Lê parâmetros da querystring; se ausentes, tenta o body JSON (POST)
  const params = req.nextUrl.searchParams;
  let video = params.get("video") ?? "";
  let caption = params.get("caption") ?? "";
  const slot = params.get("slot") ?? ""; // opcional — só para log
  const lang = getLang(params.get("lang")); // "es" (default) | "pt"
  const runParam = params.get("run");      // 0..3 — p/ o livro-razão/dedup do watchdog
  const run = runParam !== null && runParam !== "" ? parseInt(runParam, 10) : null;
  let topic = params.get("topic") ?? "";   // tópico do Reel → livro-razão (anti-dup cross-formato)
  const day = dayUTC();

  if ((!video || !caption || !topic) && req.method === "POST") {
    try {
      const body = await req.json();
      video = video || body.video || "";
      caption = caption || body.caption || "";
      topic = topic || body.topic || "";
    } catch {
      /* sem body JSON — segue com o que veio da query */
    }
  }

  const log: Record<string, unknown> = { slot, video: video ? "(presente)" : "(ausente)" };

  if (!video) {
    return NextResponse.json({ ok: false, error: "Parâmetro 'video' (URL pública) é obrigatório" }, { status: 400 });
  }

  // Dedup por (dia,run,lang): se o watchdog redisparar um run que já saiu, NÃO
  // republica. Reel não tinha trava (carrossel tinha por tópico) — esta é a dele.
  if (run !== null && Number.isFinite(run) && await runAlreadyPublished(day, run, lang)) {
    return NextResponse.json({ ok: true, skipped: true, reason: `run ${run} (${lang}) já publicado hoje`, log });
  }

  try {
    const postId = await publishReel(video, caption || "", lang);
    log.postId = postId;
    log.ok = true;
    // Livro-razão p/ o watchdog + anti-dup cross-formato (grava o tópico).
    // run 3 = Reel clássico; 0..2 = Reel footage.
    if (run !== null && Number.isFinite(run)) await recordRun(day, run, lang, run === 3 ? "reel-classic" : "reel", postId, topic || null);
    return NextResponse.json({ ok: true, postId, log });
  } catch (err) {
    console.error("[publish-reel] erro:", err);
    return NextResponse.json({ ok: false, error: "erro ao publicar reel", log }, { status: 500 });
  }
}
