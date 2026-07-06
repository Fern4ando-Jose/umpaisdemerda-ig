import { NextRequest, NextResponse } from "next/server";
import { normalizeShareInput, writeReelSharedClips } from "@/lib/reel-shared";

// ─── Writeback do footage do CI → base compartilhada ES/PT ─────────────────────
// O fetch-footage.mjs (fallback do CI) chama aqui quando ELE mesmo achou footage
// na Pexels (a API tinha devolvido 0). Grava os clipes por (tópico, dia) pra que
// a 2ª conta (PT dispara 5 min depois) leia e REUSE o MESMO vídeo — fechando a
// divergência que deixava ES com footage e PT preto. Autenticado por CRON_SECRET.
// Fail-open: corpo inválido → 400; nunca derruba o pipeline (o CI ignora o erro).

export const runtime = "edge";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const input = normalizeShareInput(body);
  if (!input) {
    return NextResponse.json({ ok: false, error: "Faltam topic/day válidos ou clips utilizáveis" }, { status: 400 });
  }

  await writeReelSharedClips(input);
  return NextResponse.json({ ok: true, topic: input.topic, day: input.day, clips: input.clips.length });
}
