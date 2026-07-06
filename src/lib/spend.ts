// ─── Governança de custo (spend log + teto por automação) ────────────────────
// Centraliza TODA a contabilidade de gasto em APIs pagas do projeto:
//   • tabela de preços de referência por modelo;
//   • logSpend() — registra cada chamada paga (fal/Anthropic) em spend_log;
//     (Tavily aposentada em 23/06 — pesquisa agora é grátis via Wikipedia);
//   • checkBudget() — teto DIÁRIO por automação (ig-posts/ig-reels/manual);
//     o orçamento é aprovado pelo dono; se a automação for estourar, é BLOQUEADA
//     e o GitHub Actions falha com ::error:: (o dono libera subindo o orçamento).
//
// Tudo é best-effort/fail-open: falha de banco nunca quebra o pipeline de publicação.
// O modelo de governança está documentado na memória `cost-governance`.

export type Platform = "fal" | "anthropic" | "tavily";
export type Automation = "ig-posts" | "ig-reels" | "manual";

// Preço Anthropic por 1M tokens (entrada/saída). Confirmado via skill claude-api.
const ANTHROPIC_PRICES: Record<string, { in: number; out: number }> = {
  "claude-haiku-4-5": { in: 1, out: 5 },
  "claude-haiku-4-5-20251001": { in: 1, out: 5 },
  "claude-sonnet-4-6": { in: 3, out: 15 },
};

// Preço fal por imagem gerada (flux/dev ~1,3 MP). Default conservador p/ modelos novos.
const FAL_PRICES: Record<string, number> = {
  "fal-ai/flux/dev": 0.028,
};
const FAL_DEFAULT_PRICE = 0.03;

// Preço Tavily por busca (LEGADO — Tavily aposentada em 23/06; a pesquisa de
// contexto passou a ser grátis via Wikipedia. Mantido só p/ ler rows antigas de
// spend_log com platform "tavily").
const TAVILY_PRICE = 0.01;

// Orçamento DIÁRIO aprovado por automação (USD). Override em runtime via
// config (key `budget:<automation>`) — é assim que o dono "libera" mais gasto
// sem precisar de deploy. Steady-state hoje: ig-posts ~0,45 · ig-reels ~0,02.
// Tetos APERTADOS p/ "Um País de Merda" (política aprovada 2026-06-24, cenário A
// SEM fal). Custo real ~US$0,007/post → ~US$0,04–0,08/dia. Tetos ~2× o pior caso:
// freio próximo do real (teto total ~US$0,18/dia ≈ US$5,4/mês), sem bloquear posts
// legítimos. Dono libera mais via POST /api/spend?automation=&budget= se precisar.
const DEFAULT_BUDGETS: Record<Automation, number> = {
  "ig-posts": 0.05, // 2 carrosséis/dia (só copy Anthropic, sem fal)
  "ig-reels": 0.08, // 4 reels/dia (só copy; footage Pexels é grátis)
  manual: 0.05,     // testes/dryrun
};

// Estimativa CONSERVADORA do custo de uma execução, por caminho. Usada só pelo
// gate para decidir se a PRÓXIMA execução cabe no orçamento (o gasto real já
// gravado é a base; isto é só a margem da execução atual). Assume retries cheios.
// Estimativa por execução (cenário A, SEM fal): só a copy do haiku (~US$0,007,
// ~US$0,013 com 1 retry de JSON). Antes assumia fal (0,07–0,15) e superestimava o
// gate → bloqueava posts legítimos cedo demais. Sem fal, o gate fica realista.
export const EST_RUN_COST: Record<"publish" | "preview" | "dryrun", number> = {
  publish: 0.02, // haiku (copy) + margem p/ 1 retry
  preview: 0.02, // haiku (copy) — footage Pexels é grátis
  dryrun: 0.01,  // diagnóstico
};

// ─── Cálculo de custo ─────────────────────────────────────────────────────────

export function anthropicCost(model: string, usage: { input_tokens?: number; output_tokens?: number } | undefined): number {
  const p = ANTHROPIC_PRICES[model];
  if (!p || !usage) return 0;
  const inT = usage.input_tokens ?? 0;
  const outT = usage.output_tokens ?? 0;
  return (inT * p.in + outT * p.out) / 1_000_000;
}

export function falCost(model: string): number {
  return FAL_PRICES[model] ?? FAL_DEFAULT_PRICE;
}

export function tavilyCost(): number {
  return TAVILY_PRICE;
}

// ─── Log de gasto ─────────────────────────────────────────────────────────────

export interface SpendEntry {
  automation: Automation;
  platform: Platform;
  operation: string;            // ex.: "illustration", "qa-anatomy", "content", "search"
  model?: string;
  units?: number;               // imagens, buscas ou tokens (informativo)
  costUsd: number;
  meta?: Record<string, unknown>;
}

export async function logSpend(entry: SpendEntry): Promise<void> {
  try {
    const { sql } = await import("@vercel/postgres");
    await sql`
      INSERT INTO spend_log (automation, platform, operation, model, units, cost_usd, meta)
      VALUES (
        ${entry.automation}, ${entry.platform}, ${entry.operation},
        ${entry.model ?? null}, ${entry.units ?? 0}, ${entry.costUsd},
        ${JSON.stringify(entry.meta ?? {})}::jsonb
      )
    `;
  } catch { /* fail-open: nunca quebra o pipeline por causa do log */ }
}

// ─── Teto por automação ───────────────────────────────────────────────────────

export async function getBudget(automation: Automation): Promise<number> {
  try {
    const { sql } = await import("@vercel/postgres");
    const rows = await sql<{ value: string }>`SELECT value FROM config WHERE key = ${`budget:${automation}`}`;
    const v = rows.rows[0]?.value;
    if (v != null && !Number.isNaN(parseFloat(v))) return parseFloat(v);
  } catch { /* usa o default */ }
  return DEFAULT_BUDGETS[automation];
}

export async function setBudget(automation: Automation, usd: number): Promise<void> {
  const { sql } = await import("@vercel/postgres");
  await sql`
    INSERT INTO config (key, value, updated_at)
    VALUES (${`budget:${automation}`}, ${String(usd)}, NOW())
    ON CONFLICT (key) DO UPDATE SET value = ${String(usd)}, updated_at = NOW()
  `;
}

export async function spentToday(automation: Automation): Promise<number> {
  try {
    const { sql } = await import("@vercel/postgres");
    const rows = await sql<{ total: number }>`
      SELECT COALESCE(SUM(cost_usd), 0)::float8 AS total
      FROM spend_log
      WHERE automation = ${automation}
        AND (ts AT TIME ZONE 'utc')::date = (NOW() AT TIME ZONE 'utc')::date
    `;
    return rows.rows[0]?.total ?? 0;
  } catch {
    return 0; // sem dados → não bloqueia (fail-open)
  }
}

export interface BudgetCheck {
  ok: boolean;
  spent: number;
  budget: number;
  est: number;
  automation: Automation;
}

// Decide se a execução atual (custo estimado `est`) cabe no orçamento do dia.
// ok=false → a automação deve ser BLOQUEADA (route devolve HTTP 402 e o GH Actions falha).
export async function checkBudget(automation: Automation, est: number): Promise<BudgetCheck> {
  const [spent, budget] = await Promise.all([spentToday(automation), getBudget(automation)]);
  return { ok: spent + est <= budget, spent, budget, est, automation };
}

// ─── Visão agregada (para /api/spend) ─────────────────────────────────────────

export interface SpendSummaryRow {
  automation: string;
  platform: string;
  cost_usd: number;
  calls: number;
}

export async function spendSummary(): Promise<{
  today: SpendSummaryRow[];
  month: SpendSummaryRow[];
  budgets: { automation: Automation; budget: number; spentToday: number }[];
}> {
  const { sql } = await import("@vercel/postgres");
  const today = await sql<SpendSummaryRow>`
    SELECT automation, platform, COALESCE(SUM(cost_usd),0)::float8 AS cost_usd, COUNT(*)::int AS calls
    FROM spend_log
    WHERE (ts AT TIME ZONE 'utc')::date = (NOW() AT TIME ZONE 'utc')::date
    GROUP BY automation, platform ORDER BY cost_usd DESC
  `;
  const month = await sql<SpendSummaryRow>`
    SELECT automation, platform, COALESCE(SUM(cost_usd),0)::float8 AS cost_usd, COUNT(*)::int AS calls
    FROM spend_log
    WHERE ts >= date_trunc('month', NOW() AT TIME ZONE 'utc')
    GROUP BY automation, platform ORDER BY cost_usd DESC
  `;
  const autos: Automation[] = ["ig-posts", "ig-reels", "manual"];
  const budgets = await Promise.all(
    autos.map(async (a) => ({ automation: a, budget: await getBudget(a), spentToday: await spentToday(a) }))
  );
  return { today: today.rows, month: month.rows, budgets };
}
