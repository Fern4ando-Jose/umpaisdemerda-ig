import { NextRequest, NextResponse } from "next/server";
import { dayUTC, publishedRunsToday } from "@/lib/run-ledger";

// Status dos 6 runs do dia por idioma — o que JÁ publicou e o que está FALTANDO
// (vencido por agora e ainda sem publicação). O watchdog (catchup.yml) consome
// `missing` e redispara só esses runs. Atrás do CRON_SECRET, como os demais.
//
//   GET /api/runs-status  → { day, nowMin, missing: [{lang, run}], published }
//
// "Vencido" = a hora do cron daquele run + carência já passou (UTC). Cron real
// atrasado depois é deduplicado pela trava (carrossel) / livro-razão (reel).

// Hora UTC de cada run (espelha os crons dos workflows; minuto :17/:22 ignorado).
const RUN_HOUR_UTC: Record<number, number> = { 0: 15, 1: 20, 2: 0, 3: 22, 4: 12, 5: 17 };
const GRACE_MIN = 75; // carência após o horário do cron antes de considerar "faltando"

// Idiomas com publicação automática ativa (crons ligados). PT no ar desde 2026-06-18.
const ACTIVE_LANGS = ["es", "pt"];

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const now = new Date();
  const day = dayUTC(now);
  const nowMin = now.getUTCHours() * 60 + now.getUTCMinutes();
  const published = await publishedRunsToday(day);

  const missing: { lang: string; run: number }[] = [];
  for (const lang of ACTIVE_LANGS) {
    const done = new Set(published[lang] ?? []);
    for (let run = 0; run <= 5; run++) {
      const dueMin = RUN_HOUR_UTC[run] * 60 + GRACE_MIN; // venceu por agora?
      if (nowMin >= dueMin && !done.has(run)) missing.push({ lang, run });
    }
  }
  return NextResponse.json({ ok: true, day, nowMin, missing, published });
}
