// ─── O ANALISTA DE MÉTRICAS — o placar por FORMATO ───────────────────────────
// POR QUE EXISTE (2026-08-09): a biblioteca de formatos nasceu com uma regra dura —
// *"formato que não performa é DESCARTADO, não melhorado; a biblioteca madura é uma lista
// de sobreviventes"*. Isso é impossível sem medir por formato: até aqui o cargo
// `analista-de-metricas` existia na casa e nunca encostou numa peça publicada, porque ele
// roda no Claude Code e quem publica é o site.
//
// A régua NÃO é curtida. É **alcance** e, principalmente, **envio no direct** — o sinal que
// o Instagram premia em 2026 e que vale 3 a 5 vezes a curtida. Curtida entra só como ruído
// de contexto.
//
// ⚠️ NUNCA estimar: se o número não veio da plataforma, ele não entra no placar. Linha sem
// métrica aparece como `semDados`, não como zero — zero é uma medição, ausência não é.

export interface LinhaPlacar {
  formato: string;
  pecas: number;
  alcance: number | null;
  envios: number | null;
  curtidas: number | null;
  /** peças cuja métrica ainda não voltou da plataforma */
  semDados: number;
}

export interface RegistroPeca {
  formato: string | null;
  reach?: number | null;
  shares?: number | null;
  likes?: number | null;
}

/**
 * Agrega as peças por formato. Função PURA — quem busca no banco/Graph é quem chama, para
 * que o placar seja testável sem rede e sem chave.
 */
export function montarPlacar(pecas: RegistroPeca[]): LinhaPlacar[] {
  const mapa = new Map<string, LinhaPlacar>();
  for (const p of pecas) {
    const f = (p.formato || "").trim();
    if (!f) continue; // peça anterior ao carimbo de formato — não inventa categoria
    if (!mapa.has(f)) mapa.set(f, { formato: f, pecas: 0, alcance: null, envios: null, curtidas: null, semDados: 0 });
    const l = mapa.get(f)!;
    l.pecas++;
    const temAlgo = p.reach != null || p.shares != null || p.likes != null;
    if (!temAlgo) { l.semDados++; continue; }
    if (p.reach != null) l.alcance = (l.alcance ?? 0) + p.reach;
    if (p.shares != null) l.envios = (l.envios ?? 0) + p.shares;
    if (p.likes != null) l.curtidas = (l.curtidas ?? 0) + p.likes;
  }
  // Ordena pelo que decide: envios por peça, depois alcance por peça. Formato sem nenhuma
  // medição vai para o fim — não é "o pior", é o desconhecido.
  return [...mapa.values()].sort((a, b) => {
    const ea = a.envios != null && a.pecas ? a.envios / a.pecas : -1;
    const eb = b.envios != null && b.pecas ? b.envios / b.pecas : -1;
    if (eb !== ea) return eb - ea;
    const aa = a.alcance != null && a.pecas ? a.alcance / a.pecas : -1;
    const ab = b.alcance != null && b.pecas ? b.alcance / b.pecas : -1;
    return ab - aa;
  });
}

/** Quantas peças um formato precisa antes de o placar dele valer alguma coisa. */
export const MINIMO_PARA_JULGAR = 6;

/**
 * O veredito por formato. `manter` | `observar` | `descartar` — e NUNCA "descartar" sem
 * amostra: reprovar um formato com 2 peças é ler ruído como sinal.
 */
export function veredito(l: LinhaPlacar, medianaEnviosPorPeca: number): "manter" | "observar" | "descartar" {
  if (l.pecas < MINIMO_PARA_JULGAR || l.envios == null) return "observar";
  const porPeca = l.envios / l.pecas;
  if (porPeca >= medianaEnviosPorPeca) return "manter";
  return porPeca < medianaEnviosPorPeca * 0.5 ? "descartar" : "observar";
}

// ─── O CRUZAMENTO (2026-08-11): de onde vem cada metade do placar ─────────────
// Este módulo existia desde 09/08 e NUNCA foi ligado a nada — só o próprio teste o
// chamava. Ele respondia "não sei contar" com toda a razão: quem sabe o FORMATO de cada
// peça é o livro-razão do site (`published_runs.formato`), e quem sabe o DESEMPENHO é o
// Instagram (alcance, envios, curtidas por media id). Eram duas metades que nunca se
// encontravam — e sem elas nenhum dos formatos podia ser julgado, o que deixava a regra
// da biblioteca ("formato que não performa é descartado") impossível de cumprir.
//
// A função abaixo é PURA de propósito: quem vai ao banco e à Graph API é a rota. Assim o
// cruzamento é testável sem rede, sem chave e sem banco.

/** Uma linha do livro-razão: a peça que saiu e o esqueleto com que ela foi escrita. */
export interface RunPublicada {
  instagramPostId: string | null;
  formato: string | null;
}

/** O que o Instagram devolve por peça. Ausente = ausente; nunca vira zero. */
export interface MetricaPeca {
  id: string;
  reach?: number | null;
  shares?: number | null;
  likes?: number | null;
}

/**
 * Junta o formato (banco) com o desempenho (Instagram) pelo id da publicação.
 * Peça sem formato carimbado fica de fora — ela é anterior ao carimbo, não é um formato
 * chamado "nenhum". Peça carimbada cuja métrica ainda não voltou entra SEM métrica, para
 * ser contada como `semDados`.
 */
export function cruzarComMetricas(runs: RunPublicada[], metricas: MetricaPeca[]): RegistroPeca[] {
  const porId = new Map(metricas.map((m) => [String(m.id), m]));
  const out: RegistroPeca[] = [];
  for (const r of runs) {
    const f = (r.formato || "").trim();
    if (!f) continue;
    const m = r.instagramPostId ? porId.get(String(r.instagramPostId)) : undefined;
    out.push({ formato: f, reach: m?.reach ?? null, shares: m?.shares ?? null, likes: m?.likes ?? null });
  }
  return out;
}

/** Mediana de envios por peça entre os formatos que TÊM medição. */
export function medianaEnvios(linhas: LinhaPlacar[]): number {
  const vals = linhas.filter((l) => l.envios != null && l.pecas > 0).map((l) => l.envios! / l.pecas).sort((a, b) => a - b);
  if (!vals.length) return 0;
  const meio = Math.floor(vals.length / 2);
  return vals.length % 2 ? vals[meio] : (vals[meio - 1] + vals[meio]) / 2;
}
