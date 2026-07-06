import { NextRequest, NextResponse } from "next/server";
import { type Automation, spendSummary, setBudget } from "@/lib/spend";

// Visão de gasto por plataforma/automação (hoje e mês) + orçamentos vigentes.
// Atrás do CRON_SECRET (igual aos demais endpoints operacionais).
//
//   GET  /api/spend                          → resumo (hoje, mês, orçamentos)
//   POST /api/spend?automation=ig-posts&budget=1.00  → ajusta o teto ("liberar")
//
// Ambos exigem: Authorization: Bearer <CRON_SECRET>.

function authorized(req: NextRequest): boolean {
  return req.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  try {
    const summary = await spendSummary();
    return NextResponse.json({ ok: true, ...summary });
  } catch (e) {
    console.error("GET /api/spend:", e);
    return NextResponse.json({ ok: false, error: "erro interno" }, { status: 500 });
  }
}

// "Liberar" mais orçamento p/ uma automação sem redeploy (grava em config).
export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  const automation = sp.get("automation") as Automation | null;
  const budget = parseFloat(sp.get("budget") ?? "");
  const valid: Automation[] = ["ig-posts", "ig-reels", "manual"];
  if (!automation || !valid.includes(automation) || Number.isNaN(budget) || budget < 0) {
    return NextResponse.json({ error: "Use ?automation=ig-posts|ig-reels|manual&budget=<USD>" }, { status: 400 });
  }
  try {
    await setBudget(automation, budget);
    return NextResponse.json({ ok: true, automation, budget });
  } catch (e) {
    console.error("POST /api/spend:", e);
    return NextResponse.json({ ok: false, error: "erro interno" }, { status: 500 });
  }
}
