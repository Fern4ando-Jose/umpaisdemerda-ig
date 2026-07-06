// ─── Rotação determinística dos temas (SEM repetição) ───────────────────────
// O esquema antigo reembaralhava a lista INTEIRA toda semana (`weekNum`). Como o
// ciclo dos temas (N posts) não fecha numa semana, o reembaralho caía no meio do
// ciclo e fazia o MESMO tema voltar em 1–3 dias — e a trava anti-dup de 7 dias
// então BLOQUEAVA o post (não saía). Medido: 50 repetições com gap < 7 dias em
// 28 dias, menor gap 0,5 dia.
//
// Aqui a ordem é FIXA: percorre os N temas continuamente, cada um 1× por ciclo
// (gap = N posts; com 51 temas e 6/dia ≈ 8,5 dias > 7d → nunca colide com a
// anti-dup). E INTERCALA as categorias por rank fracionário, pra não agrupar o
// mesmo `cat` (ex.: dopamina/network) no mesmo dia. Determinística → ES e PT batem.

// Ordem de rotação (índices no array original) intercalando categorias: cada cat
// é espalhada o mais uniformemente possível ao longo do ciclo (técnica de rank
// fracionário (k+0,5)/tamanho — quanto maior o cat, mais perto fica de cada post).
export function buildRotation(cats: string[]): number[] {
  const byCat = new Map<string, number[]>();
  cats.forEach((c, i) => {
    const arr = byCat.get(c) ?? [];
    arr.push(i);
    byCat.set(c, arr);
  });
  const ranked: { idx: number; rank: number; cat: string }[] = [];
  for (const [cat, idxs] of byCat) {
    idxs.forEach((idx, k) => ranked.push({ idx, rank: (k + 0.5) / idxs.length, cat }));
  }
  // rank crescente; empate → estável por cat e idx (100% determinístico)
  ranked.sort((a, b) => a.rank - b.rank || a.cat.localeCompare(b.cat) || a.idx - b.idx);
  return ranked.map((r) => r.idx);
}

// Dia do ano — mesma conta do esquema antigo (continuidade). Na Vercel = UTC.
export function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date.getTime() - start.getTime()) / 86400000);
}

// Índice do tema (no array original) para um (data, run): caminha a rotação fixa
// continuamente → cada tema 1× por ciclo. 6 posts por dia (runs 0..5).
export function topicIndexForRun(rotation: number[], date: Date, runIndex: number): number {
  const slot = dayOfYear(date) * 6 + runIndex;
  const n = rotation.length;
  return rotation[((slot % n) + n) % n];
}

// Slot inicial (contínuo) de um (data, run). Separado p/ o caminhar-pulando abaixo.
export function slotForRun(date: Date, runIndex: number): number {
  return dayOfYear(date) * 6 + runIndex;
}

// Escolhe o tema do slot PULANDO os já usados recentemente (em QUALQUER formato,
// na conta) — a trava anti-dup REAL, robusta a mudanças de rotação e a repetição
// reel↔carrossel. Caminha a rotação a partir de `startSlot` e devolve o 1º índice
// de tema que NÃO está em `used` (índices de tema publicados nos últimos N dias).
// Se todos estiverem usados (degenerado — N temas < janela), cai no tema-base do
// slot. Função PURA → testável.
export function pickFreshTopicIndex(rotation: number[], startSlot: number, used: Set<number>): number {
  const n = rotation.length;
  for (let i = 0; i < n; i++) {
    const idx = rotation[(((startSlot + i) % n) + n) % n];
    if (!used.has(idx)) return idx;
  }
  return rotation[((startSlot % n) + n) % n]; // tudo usado → base (não deve ocorrer: N > 6×7)
}
