import { NextRequest, NextResponse } from "next/server";
import { dayUTC, publishedRunsToday } from "@/lib/run-ledger";

// ─── Catch-up acionável DE FORA (agendador externo) ──────────────────────────
// Espelha o catchup.yml, mas como ENDPOINT — pra um cron EXTERNO (ex.: cron-job.org)
// dispará-lo de forma confiável, independente do cron do GitHub (que atrasa/derruba
// até o próprio catchup.yml). Consulta o que JÁ publicou (published_runs), descobre
// os runs do dia que venceram e ainda NÃO saíram, e REDISPARA os workflows certos via
// a REST API do GitHub. Idempotente: a trava (carrossel 7d) / livro-razão (reel)
// deduplicam, então um cron real atrasado que chegue depois não duplica.
//
// Segurança: Bearer CRON_SECRET (igual aos outros). Dispara via GH_DISPATCH_TOKEN
// (PAT fine-grained com Actions: read+write no repo) — guardado na Vercel, NÃO no
// serviço de cron externo. Sem o token → 500 avisando (inerte até o dono configurar).

const RUN_HOUR_UTC: Record<number, number> = { 0: 15, 1: 20, 2: 0, 3: 22, 4: 12, 5: 17 };
const GRACE_MIN = 75;
const ACTIVE_LANGS = ["es", "pt"];
const REPO = process.env.GH_REPO || "Fern4ando-Jose/dr-libertad-site";

// run → (workflow, inputs). Espelha o mapeamento do catchup.yml.
function workflowFor(run: number, lang: string): { file: string; inputs: Record<string, string> } | null {
  let base: string;
  let inputs: Record<string, string>;
  if (run >= 0 && run <= 2) { base = "instagram-reels"; inputs = { run: String(run), publish: "yes" }; }
  else if (run === 3) { base = "instagram-reels-classic"; inputs = { run: String(run), publish: "yes" }; }
  else if (run === 4 || run === 5) { base = "instagram-posts"; inputs = { run: String(run) }; }
  else return null;
  const file = lang === "pt" ? `${base}-pt.yml` : `${base}.yml`;
  return { file, inputs };
}

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const token = process.env.GH_DISPATCH_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "GH_DISPATCH_TOKEN ausente — configure o PAT na Vercel (ver docs/AGENDADOR-EXTERNO.md)" }, { status: 500 });
  }

  const now = new Date();
  const day = dayUTC(now);
  const nowMin = now.getUTCHours() * 60 + now.getUTCMinutes();
  const published = await publishedRunsToday(day);

  const dispatched: { lang: string; run: number; file: string }[] = [];
  const failed: { lang: string; run: number; file: string; status: number; body: string }[] = [];

  for (const lang of ACTIVE_LANGS) {
    const done = new Set(published[lang] ?? []);
    for (let run = 0; run <= 5; run++) {
      const dueMin = RUN_HOUR_UTC[run] * 60 + GRACE_MIN;
      if (nowMin < dueMin || done.has(run)) continue;
      const wf = workflowFor(run, lang);
      if (!wf) continue;
      try {
        const res = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${wf.file}/dispatches`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
            "Content-Type": "application/json",
            "User-Agent": "umpaisdemerda-catchup",
            "X-GitHub-Api-Version": "2022-11-28",
          },
          body: JSON.stringify({ ref: "main", inputs: wf.inputs }),
        });
        if (res.ok) dispatched.push({ lang, run, file: wf.file });
        else failed.push({ lang, run, file: wf.file, status: res.status, body: (await res.text()).slice(0, 200) });
      } catch (e) {
        failed.push({ lang, run, file: wf.file, status: 0, body: e instanceof Error ? e.message : String(e) });
      }
    }
  }

  return NextResponse.json({ ok: true, day, nowMin, published, dispatched, failed });
}
