// Coleta de métricas (Insights) dos posts do @umpaisdemerda via Instagram Graph API.
//
// Por que existe: "view" no grid do Instagram some o contexto (idade do post, de
// onde veio o alcance, retenção). Para decidir o que replicar precisamos de
// alcance + interações + saves/shares + tempo médio assistido (Reels), tudo lado
// a lado e normalizado. Este módulo busca a mídia, puxa as insights por tipo e
// devolve as linhas já enriquecidas (derivadas + comparativo por formato).
//
// Usado tanto pela rota /api/insights (JSON) quanto pela página /insights (UI).

import { accountFor } from "@/lib/accounts";

const GRAPH = "https://graph.instagram.com/v25.0";

export type Format = "REEL" | "CARROSSEL" | "IMAGEM" | "OUTRO";

export type PostInsight = {
  id: string;
  title: string;
  format: Format;
  permalink: string | null;
  timestamp: string | null;
  ageDays: number;
  thumbnail: string | null;
  // métricas brutas
  reach: number;
  views: number;
  likes: number;
  comments: number;
  saved: number;
  shares: number;
  interactions: number;
  avgWatchSec: number | null; // só Reels
  // derivadas
  viewsPerDay: number;
  engagementRate: number | null; // interações / alcance
  saveRate: number | null; // saves / alcance
  shareRate: number | null; // shares / alcance
};

export type FormatSummary = {
  format: Format;
  count: number;
  avgReach: number;
  avgViews: number;
  avgViewsPerDay: number;
  avgEngagementRate: number | null;
  avgSaveRate: number | null;
};

export type InsightsResult = {
  ok: boolean;
  generatedAt: string;
  tokenPresent: boolean;
  items: PostInsight[];
  byFormat: FormatSummary[];
  note?: string;
};

type IgMedia = {
  id: string;
  caption?: string;
  media_type?: string; // IMAGE | VIDEO | CAROUSEL_ALBUM
  media_product_type?: string; // FEED | REELS | STORY | AD
  permalink?: string;
  timestamp?: string;
  thumbnail_url?: string;
  media_url?: string;
  like_count?: number;
  comments_count?: number;
};

function firstSentence(caption: string): string {
  const clean = caption
    .replace(/\*\*/g, "")
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .trim();
  const sentence = clean.split(/(?<=[.!?])\s|\n/)[0] ?? clean;
  return sentence.slice(0, 80);
}

function classify(m: IgMedia): Format {
  if (m.media_product_type === "REELS") return "REEL";
  if (m.media_type === "CAROUSEL_ALBUM") return "CARROSSEL";
  if (m.media_type === "IMAGE") return "IMAGEM";
  return "OUTRO";
}

async function fetchMedia(accountId: string, token: string): Promise<IgMedia[]> {
  const fields =
    "id,caption,media_type,media_product_type,permalink,timestamp,thumbnail_url,media_url,like_count,comments_count";
  const url = `${GRAPH}/${accountId}/media?fields=${fields}&limit=50&access_token=${token}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`media list ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return (data.data ?? []) as IgMedia[];
}

// Puxa as insights de UMA mídia. A Graph API derruba a chamada inteira se um
// único metric não for suportado pelo tipo — então degradamos: tentamos o set
// ideal e vamos reduzindo até algo responder. Devolve nome->valor.
async function fetchInsightRow(
  id: string,
  token: string,
  preferred: string[]
): Promise<Record<string, number>> {
  const attempts = [
    preferred,
    ["reach", "views", "total_interactions", "saved", "shares"],
    ["reach", "views"],
    ["reach"],
  ];
  for (const set of attempts) {
    const url = `${GRAPH}/${id}/insights?metric=${set.join(",")}&access_token=${token}`;
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      const json = await res.json();
      const out: Record<string, number> = {};
      for (const m of json.data ?? []) {
        // Formato clássico (values[0].value) e o novo (total_value.value).
        const v = m?.values?.[0]?.value ?? m?.total_value?.value;
        if (typeof v === "number") out[m.name] = v;
      }
      return out;
    } catch {
      // tenta o próximo set mais conservador
    }
  }
  return {};
}

const REEL_METRICS = [
  "reach",
  "views",
  "total_interactions",
  "likes",
  "comments",
  "saved",
  "shares",
  "ig_reels_avg_watch_time",
];
const POST_METRICS = [
  "reach",
  "views",
  "total_interactions",
  "likes",
  "comments",
  "saved",
  "shares",
];

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export async function getInsights(): Promise<InsightsResult> {
  const generatedAt = new Date().toISOString();
  // Conta do produto (isolamento chave-por-produto): as envs Meta do UPM têm
  // sufixo _UPM porque compartilham o app do DR — accounts.ts é a fonte única.
  const acc = accountFor("pt");
  const accountId = process.env[acc.accountIdEnv];
  const token = process.env[acc.tokenEnv];
  const tokenPresent = Boolean(accountId && token);

  if (!tokenPresent) {
    return {
      ok: false,
      generatedAt,
      tokenPresent: false,
      items: [],
      byFormat: [],
      note: `${acc.accountIdEnv}/${acc.tokenEnv} ausentes (só existem em produção).`,
    };
  }

  let media: IgMedia[];
  try {
    media = await fetchMedia(accountId!, token!);
  } catch (err) {
    return {
      ok: false,
      generatedAt,
      tokenPresent: true,
      items: [],
      byFormat: [],
      note: `Falha ao listar mídia: ${String(err)}`,
    };
  }

  // Mapa instagram_post_id -> título do banco (melhor que a 1ª frase da legenda).
  const titleById = new Map<string, string>();
  try {
    const { sql } = await import("@vercel/postgres");
    const rows = await sql<{ instagram_post_id: string | null; title: string }>`
      SELECT instagram_post_id, title FROM posts
      WHERE instagram_post_id IS NOT NULL
      ORDER BY published_at DESC LIMIT 100
    `;
    for (const r of rows.rows) if (r.instagram_post_id) titleById.set(r.instagram_post_id, r.title);
  } catch {
    // sem banco — usa a legenda
  }

  const now = Date.now();
  const items: PostInsight[] = await Promise.all(
    media.map(async (m) => {
      const format = classify(m);
      const metrics = format === "REEL" ? REEL_METRICS : POST_METRICS;
      const ins = await fetchInsightRow(m.id, token!, metrics);

      const reach = ins.reach ?? 0;
      const views = ins.views ?? 0;
      const likes = ins.likes ?? m.like_count ?? 0;
      const comments = ins.comments ?? m.comments_count ?? 0;
      const saved = ins.saved ?? 0;
      const shares = ins.shares ?? 0;
      const interactions = ins.total_interactions ?? likes + comments + saved + shares;
      const avgWatchSec = format === "REEL" ? ins.ig_reels_avg_watch_time ?? null : null;

      const ts = m.timestamp ? new Date(m.timestamp).getTime() : now;
      const ageDays = Math.max((now - ts) / 86_400_000, 0);
      const ageDivisor = Math.max(ageDays, 1); // evita inflar posts < 1 dia

      const title = titleById.get(m.id) ?? (m.caption ? firstSentence(m.caption) : "(sem título)");

      return {
        id: m.id,
        title,
        format,
        permalink: m.permalink ?? null,
        timestamp: m.timestamp ?? null,
        ageDays: Math.round(ageDays * 10) / 10,
        thumbnail: m.thumbnail_url ?? m.media_url ?? null,
        reach,
        views,
        likes,
        comments,
        saved,
        shares,
        interactions,
        // ig_reels_avg_watch_time vem em MILISSEGUNDOS → converte p/ segundos.
        avgWatchSec: avgWatchSec != null ? Math.round(avgWatchSec / 100) / 10 : null,
        viewsPerDay: Math.round(views / ageDivisor),
        engagementRate: reach > 0 ? interactions / reach : null,
        saveRate: reach > 0 ? saved / reach : null,
        shareRate: reach > 0 ? shares / reach : null,
      } satisfies PostInsight;
    })
  );

  // Ordena por alcance desc (a métrica que melhor aproxima "quem viu de verdade").
  items.sort((a, b) => b.reach - a.reach);

  // Comparativo por formato — a alavanca que o usuário quer entender.
  const formats: Format[] = ["REEL", "CARROSSEL", "IMAGEM", "OUTRO"];
  const byFormat: FormatSummary[] = formats
    .map((f) => {
      const group = items.filter((i) => i.format === f);
      if (group.length === 0) return null;
      const er = group.map((i) => i.engagementRate).filter((x): x is number => x != null);
      const sr = group.map((i) => i.saveRate).filter((x): x is number => x != null);
      return {
        format: f,
        count: group.length,
        avgReach: Math.round(avg(group.map((i) => i.reach))),
        avgViews: Math.round(avg(group.map((i) => i.views))),
        avgViewsPerDay: Math.round(avg(group.map((i) => i.viewsPerDay))),
        avgEngagementRate: er.length ? avg(er) : null,
        avgSaveRate: sr.length ? avg(sr) : null,
      } satisfies FormatSummary;
    })
    .filter((x): x is FormatSummary => x != null);

  return { ok: true, generatedAt, tokenPresent: true, items, byFormat };
}
