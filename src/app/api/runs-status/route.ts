import { NextRequest, NextResponse } from "next/server";
import { dayUTC, publishedRunsToday, pendingRuns } from "@/lib/run-ledger";

// Status dos runs do dia (conta única PT-BR) — o que JÁ publicou e o que está
// FALTANDO (vencido por agora e ainda sem publicação). O watchdog (catchup.yml)
// consome `missing` e redispara só esses runs. Atrás do CRON_SECRET, como os demais.
//
//   GET /api/runs-status  → { day, nowMin, missing: [{lang, run}], published }
//
// Cronograma (idiomas + runs ativos + carência) mora em run-ledger.ts (fonte única).
// "Vencido" = a hora do cron daquele run + carência já passou (UTC). Cron real
// atrasado depois é deduplicado pela trava (carrossel) / livro-razão (reel).

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const now = new Date();
  const day = dayUTC(now);
  const nowMin = now.getUTCHours() * 60 + now.getUTCMinutes();
  const published = await publishedRunsToday(day);

  const missing = pendingRuns(published, nowMin);
  return NextResponse.json({ ok: true, day, nowMin, missing, published });
}
