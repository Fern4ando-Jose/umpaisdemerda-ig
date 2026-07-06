import { getInsights, type PostInsight, type Format } from "@/lib/insights";

// Dashboard de desempenho dos posts. Página utilitária (não faz parte do site
// localizado em [lang]); protegida por ?key=CRON_SECRET. Em produção o token da
// Graph API existe; local cai no aviso de token ausente.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const metadata = { title: "Insights", robots: { index: false, follow: false } };

const FORMAT_LABEL: Record<Format, string> = {
  REEL: "Reel",
  CARROSSEL: "Carrossel",
  IMAGEM: "Imagem",
  OUTRO: "Outro",
};

const FORMAT_COLOR: Record<Format, string> = {
  REEL: "var(--color-muted-red)",
  CARROSSEL: "var(--color-warm-gray)",
  IMAGEM: "var(--color-warm-gray)",
  OUTRO: "var(--color-warm-gray)",
};

const nf = (n: number) => n.toLocaleString("pt-BR");
const pf = (x: number | null) => (x == null ? "—" : `${(x * 100).toFixed(1)}%`);

function Gate({ reason }: { reason: string }) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-24">
      <h1 className="font-serif text-3xl">Insights</h1>
      <p className="mt-4 text-warm-gray">{reason}</p>
      <p className="mt-6 text-sm text-warm-gray/70">
        Acesse com <code className="text-offwhite">/insights?key=SEU_CRON_SECRET</code>.
      </p>
    </main>
  );
}

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const { key } = await searchParams;
  const secret = process.env.CRON_SECRET;

  if (!secret || key !== secret) {
    return <Gate reason="Página protegida. Chave inválida ou ausente." />;
  }

  const data = await getInsights();

  if (!data.tokenPresent) {
    return <Gate reason={data.note ?? "Token da Graph API ausente (rode em produção)."} />;
  }
  if (!data.ok) {
    return <Gate reason={data.note ?? "Falha ao buscar as métricas."} />;
  }

  const best = data.byFormat.reduce<typeof data.byFormat[number] | null>(
    (acc, f) => (acc == null || f.avgReach > acc.avgReach ? f : acc),
    null
  );

  return (
    <main className="mx-auto max-w-6xl px-5 py-16">
      <header className="mb-2">
        <h1 className="font-serif text-4xl tracking-tight">Insights</h1>
        <p className="mt-2 text-sm text-warm-gray">
          {data.items.length} posts · ordenados por alcance · atualizado{" "}
          {new Date(data.generatedAt).toLocaleString("pt-BR")}
        </p>
      </header>

      {/* Comparativo por formato — a alavanca principal */}
      <section className="mt-8">
        <h2 className="font-serif text-xl">Média por formato</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {data.byFormat.map((f) => (
            <div
              key={f.format}
              className="rounded-xl border border-warm-gray/15 bg-white/[0.03] p-4"
              style={best?.format === f.format ? { borderColor: "var(--color-muted-red)" } : undefined}
            >
              <div className="flex items-center justify-between">
                <span
                  className="text-xs uppercase tracking-[0.18em]"
                  style={{ color: FORMAT_COLOR[f.format] }}
                >
                  {FORMAT_LABEL[f.format]}
                </span>
                <span className="text-xs text-warm-gray">{f.count}</span>
              </div>
              <div className="mt-3 font-serif text-3xl">{nf(f.avgReach)}</div>
              <div className="text-xs text-warm-gray">alcance médio</div>
              <dl className="mt-3 space-y-1 text-xs text-warm-gray">
                <div className="flex justify-between">
                  <dt>Views/dia</dt>
                  <dd className="text-offwhite">{nf(f.avgViewsPerDay)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Engajamento</dt>
                  <dd className="text-offwhite">{pf(f.avgEngagementRate)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Save rate</dt>
                  <dd className="text-offwhite">{pf(f.avgSaveRate)}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
        {best && (
          <p className="mt-3 text-sm text-warm-gray">
            Maior alcance médio:{" "}
            <strong className="text-offwhite">{FORMAT_LABEL[best.format]}</strong> ({nf(best.avgReach)}).
          </p>
        )}
      </section>

      {/* Tabela detalhada */}
      <section className="mt-12">
        <h2 className="font-serif text-xl">Todos os posts</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-warm-gray/20 text-left text-xs uppercase tracking-wider text-warm-gray">
                <th className="py-2 pr-3 font-normal">#</th>
                <th className="py-2 pr-3 font-normal">Post</th>
                <th className="py-2 pr-3 font-normal">Formato</th>
                <th className="py-2 pr-3 text-right font-normal">Idade</th>
                <th className="py-2 pr-3 text-right font-normal">Alcance</th>
                <th className="py-2 pr-3 text-right font-normal">Views</th>
                <th className="py-2 pr-3 text-right font-normal">Views/dia</th>
                <th className="py-2 pr-3 text-right font-normal">Eng%</th>
                <th className="py-2 pr-3 text-right font-normal">Saves</th>
                <th className="py-2 pr-3 text-right font-normal">Shares</th>
                <th className="py-2 pr-3 text-right font-normal">Watch</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((p, i) => (
                <Row key={p.id} p={p} rank={i + 1} />
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 max-w-3xl text-xs leading-relaxed text-warm-gray/70">
          <strong className="text-warm-gray">Como ler:</strong> <em>Alcance</em> = contas únicas
          que viram (melhor que &quot;views&quot;, que conta replays). <em>Views/dia</em> normaliza
          pela idade do post. <em>Eng%</em> = interações ÷ alcance. <em>Saves</em> e{" "}
          <em>Shares</em> são o sinal mais forte pro algoritmo. <em>Watch</em> = tempo médio
          assistido (só Reels). Posts recém-publicados têm números baixos só por serem novos.
        </p>
      </section>
    </main>
  );
}

function Row({ p, rank }: { p: PostInsight; rank: number }) {
  return (
    <tr className="border-b border-warm-gray/10 align-middle">
      <td className="py-2 pr-3 text-warm-gray">{rank}</td>
      <td className="py-2 pr-3">
        <a
          href={p.permalink ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 hover:text-muted-red"
        >
          {p.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={p.thumbnail}
              alt=""
              className="h-10 w-10 flex-none rounded object-cover"
              loading="lazy"
            />
          ) : (
            <span className="h-10 w-10 flex-none rounded bg-white/5" />
          )}
          <span className="line-clamp-2 max-w-[22ch]">{p.title}</span>
        </a>
      </td>
      <td className="py-2 pr-3">
        <span
          className="rounded px-2 py-0.5 text-[11px] uppercase tracking-wide"
          style={{
            color: FORMAT_COLOR[p.format],
            border: `1px solid ${p.format === "REEL" ? "var(--color-muted-red)" : "rgba(185,176,162,0.3)"}`,
          }}
        >
          {FORMAT_LABEL[p.format]}
        </span>
      </td>
      <td className="py-2 pr-3 text-right text-warm-gray">{p.ageDays}d</td>
      <td className="py-2 pr-3 text-right">{nf(p.reach)}</td>
      <td className="py-2 pr-3 text-right">{nf(p.views)}</td>
      <td className="py-2 pr-3 text-right">{nf(p.viewsPerDay)}</td>
      <td className="py-2 pr-3 text-right">{pf(p.engagementRate)}</td>
      <td className="py-2 pr-3 text-right">{nf(p.saved)}</td>
      <td className="py-2 pr-3 text-right">{nf(p.shares)}</td>
      <td className="py-2 pr-3 text-right text-warm-gray">
        {p.avgWatchSec != null ? `${p.avgWatchSec}s` : "—"}
      </td>
    </tr>
  );
}
