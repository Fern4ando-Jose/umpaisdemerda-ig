import { NextRequest, NextResponse } from "next/server";
import { getInsights } from "@/lib/insights";
import {
  MINIMO_PARA_JULGAR,
  cruzarComMetricas,
  medianaEnvios,
  montarPlacar,
  veredito,
  type MetricaPeca,
  type RunPublicada,
} from "@/lib/placar-formatos";

// ─── O PLACAR POR FORMATO — o julgamento que faltava ──────────────────────────
// PORTADO do dr-libertad-site em 2026-08-11. O redator desta conta já escreve dentro de um
// dos 7 esqueletos desde 09/08 e a peça sai carimbada — mas o carimbo morria ali: nada
// contava qual esqueleto está funcionando. Sem isso a regra dura da biblioteca de formatos
// (*"formato que não performa é DESCARTADO, não melhorado"*) não tem como ser cumprida.
//
// As duas metades vivem em lugares diferentes e é isto que a rota junta:
//   · o FORMATO de cada peça está no livro-razão do site (`published_runs.formato`);
//   · o DESEMPENHO está no Instagram (alcance, ENVIOS, curtidas), por id de publicação.
//
// ⚠️ AS DUAS TRAVAS DO MÓDULO CONTINUAM DE PÉ, e não se afrouxam por conveniência:
//   1. formato com menos de 6 peças NÃO é reprovado (`MINIMO_PARA_JULGAR`) — reprovar com
//      2 peças é ler ruído como sinal;
//   2. peça sem medição entra como `semDados`, NUNCA como zero. Ausência não é medição, e
//      um zero inventado reprovaria formato bom.
//
// A régua não é curtida: é ENVIO no direct (vale 3 a 5 vezes a curtida na régua de 2026),
// com alcance como desempate. Curtida entra só como contexto.
//
// ⚠️ DIFERENÇA DESTA CONTA: aqui é UMA conta (@umpaisdemerda, PT-BR), não duas — o laço
// ES/BR do DR não existe. E o leitor de métricas desta casa (`src/lib/insights.ts`) já
// COLAPSA ausência em zero (`ins.reach ?? 0`), o que atropelaria a trava 2. Não se mexe
// nele (ele serve a outro consumidor e está no ar): aqui o `reach` é usado como sinal de
// "a medição voltou" — alcance 0 numa peça publicada é ausência, não medição. Com alcance
// > 0, envios e curtidas valem como vieram, inclusive quando são 0 de verdade.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Peças publicadas com formato carimbado. */
async function runsCarimbadas(dias: number): Promise<{ runs: RunPublicada[]; erro: string | null }> {
  try {
    const { sql } = await import("@vercel/postgres");
    // A coluna `formato` é recente: onde ela ainda não existir, a consulta falha e a
    // resposta diz isso em vez de fingir um placar vazio.
    const r = await sql`
      SELECT instagram_post_id, formato
      FROM published_runs
      WHERE formato IS NOT NULL
        AND ts > NOW() - (${dias} || ' days')::interval
    `;
    return {
      runs: r.rows.map((x) => ({
        instagramPostId: (x.instagram_post_id as string) ?? null,
        formato: (x.formato as string) ?? null,
      })),
      erro: null,
    };
  } catch (e) {
    return { runs: [], erro: String(e) };
  }
}

export async function GET(req: NextRequest) {
  // Mesma porta do /api/insights: o placar consome quota da Graph API e mostra
  // desempenho do perfil.
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const key = req.nextUrl.searchParams.get("key");
  const autorizado = Boolean(secret) && (auth === `Bearer ${secret}` || key === secret);
  if (!autorizado) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const dias = Math.min(Math.max(Number(req.nextUrl.searchParams.get("dias") ?? 90), 7), 365);

  const { runs, erro } = await runsCarimbadas(dias);

  const metricas: MetricaPeca[] = [];
  let metricasErro: string | null = null;
  try {
    const ins = await getInsights();
    if (!ins.ok) metricasErro = ins.note ?? "métricas indisponíveis";
    for (const it of ins.items) {
      const medido = (it.reach ?? 0) > 0; // ver a nota do cabeçalho: 0 aqui é ausência
      metricas.push({
        id: it.id,
        reach: medido ? it.reach : null,
        shares: medido ? it.shares : null,
        likes: medido ? it.likes : null,
      });
    }
  } catch (e) {
    metricasErro = String(e);
  }

  const pecas = cruzarComMetricas(runs, metricas);
  const linhas = montarPlacar(pecas);
  const mediana = medianaEnvios(linhas);

  return NextResponse.json(
    {
      ok: !erro,
      geradoEm: new Date().toISOString(),
      janelaDias: dias,
      minimoParaJulgar: MINIMO_PARA_JULGAR,
      medianaEnviosPorPeca: mediana,
      // Sem peça carimbada o placar diz isso na cara — não devolve lista vazia como se
      // fosse resultado. Foi o defeito que fez a casa achar que "o placar não funciona".
      diagnostico: erro
        ? `banco indisponível ou coluna formato ausente: ${erro}`
        : runs.length === 0
          ? "nenhuma peça com formato carimbado na janela — o placar não tem o que contar"
          : metricasErro,
      pecasCarimbadas: runs.length,
      linhas: linhas.map((l) => ({ ...l, veredito: veredito(l, mediana) })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
