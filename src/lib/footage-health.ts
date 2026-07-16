// ─── Preflight de saúde do footage (antes de CACHEAR) ─────────────────────────
// Por que existe: um clipe da whitelist pode MORRER no CDN muito depois de vetado
// (o Pexels remove/move o arquivo → CloudFront devolve 403 permanente). Quando o
// sorteio caía nele, o Remotion abortava o render ("status code of 403 while
// downloading file") e o Reel do dia NÃO saía. Pior: os clipes são cacheados em
// reel_shared_cache por (tópico, dia) e reusados por ES **e** PT — um clipe morto
// envenenava os DOIS Reels e continuava envenenando enquanto o cache vivesse.
//
// O que isto faz: confere se cada clipe ESCOLHIDO ainda serve e troca o morto por
// outro VIVO **do mesmo pilar da whitelist** — antes do writeReelShared.
//
// O que isto NÃO faz (e não pode fazer):
//  • NÃO vai dentro do `selectFootage` — ele é PURO/sem rede de propósito, e há
//    teste invariante fixando isso. Este preflight é uma etapa SEPARADA, chamada
//    pelo consumidor (o route do preview).
//  • NÃO busca footage ao vivo no Pexels/Pixabay. Substituto sai SÓ da whitelist
//    curada (a roleta ao vivo já trouxe marco dos EUA + cena imprópria — fechada
//    de propósito no 6801ca0). Aqui só se faz uma sonda HTTP (GET Range 0-64, $0)
//    em URL que JÁ estava vetada.
//  • NÃO gasta: nenhuma API paga (P2).
//
// FAIL-OPEN: qualquer erro (rede, timeout, 5xx, bug) → devolve os clipes como
// vieram. O pior caso é voltar ao comportamento de hoje, nunca ficar pior.

import { FOOTAGE_LIBRARY, beatPillars } from "./footage-library";
import { seededShuffle } from "./reel-shared";
import { probeClips, probeClip } from "../../scripts/footage-probe.mjs";

// Quantos substitutos sondar por cena antes de desistir (e deixar a cena sem clipe).
// 3 é o suficiente: a chance de 3 clipes do mesmo pilar estarem mortos é remota, e
// segura o preflight em ~1 round-trip a mais no pior caso.
const MAX_SUBSTITUTE_TRIES = 3;

// URL → pilar (reverso da whitelist). É o jeito EXATO de saber de que pilar um
// clipe morto veio — melhor que reconstruir o arco por índice (que erra quando o
// `cat` do post mudou ou quando o clipe veio do cache de outro run).
function pillarOfUrl(): Map<string, string> {
  const m = new Map<string, string>();
  for (const [pillar, clips] of Object.entries(FOOTAGE_LIBRARY)) {
    for (const c of clips) if (!m.has(c.url)) m.set(c.url, pillar);
  }
  return m;
}

export interface PreflightResult {
  clips: string[];      // lista saneada (mortos trocados por vivos do mesmo pilar)
  dead: string[];       // o que foi comprovadamente reprovado (log/diagnóstico)
  replaced: number;     // quantos ganharam substituto da whitelist
  dropped: number;      // quantos saíram sem substituto (Reel roda com menos cenas)
  changed: boolean;     // mudou algo? (→ regravar o cache compartilhado)
}

/**
 * Confere a saúde dos clipes e repõe os mortos com clipes VIVOS do MESMO pilar
 * da whitelist curada. Determinístico por seed → ES e PT chegam à mesma lista.
 *
 * Quando não há substituto vivo, o clipe é DESCARTADO: o Reel.tsx cicla o pool
 * (`pool[i % pool.length]`), então menos clipes = cenas repetidas — feio, mas o
 * Reel SAI. Reel com menos clipes > Reel nenhum.
 */
export async function preflightClips(
  clips: string[],
  cat: string,
  seed: number,
  opts: { timeoutMs?: number } = {},
): Promise<PreflightResult> {
  const original = Array.isArray(clips) ? clips.filter((c) => typeof c === "string" && c.trim() !== "") : [];
  const none: PreflightResult = { clips: original, dead: [], replaced: 0, dropped: 0, changed: false };
  if (!original.length) return none;

  try {
    const verdicts = await probeClips(original, opts);
    // Nada morto (o caso normal) → sai sem tocar em nada e sem regravar o cache.
    if (!verdicts.some((v) => v === "dead")) return none;

    const pillarOf = pillarOfUrl();
    const arc = beatPillars(cat, original.length);
    const allCurated = Object.values(FOOTAGE_LIBRARY).flatMap((l) => l.map((c) => c.url));
    const dead = new Set<string>();
    original.forEach((u, i) => { if (verdicts[i] === "dead") dead.add(u); });
    // "used" começa com os SOBREVIVENTES: o substituto não pode repetir clipe do
    // mesmo Reel (nem outro morto).
    const used = new Set<string>(original.filter((u) => !dead.has(u)));

    const out: string[] = [];
    let replaced = 0;
    let dropped = 0;

    for (let i = 0; i < original.length; i++) {
      const url = original[i];
      if (!dead.has(url)) { out.push(url); continue; }

      const pillar = pillarOf.get(url) ?? arc[i] ?? cat;
      const pool = FOOTAGE_LIBRARY[pillar]?.length ? FOOTAGE_LIBRARY[pillar].map((c) => c.url) : allCurated;
      const candidates = seededShuffle(pool, seed + i * 97).filter((u) => !used.has(u) && !dead.has(u));

      let picked: string | null = null;
      for (const cand of candidates.slice(0, MAX_SUBSTITUTE_TRIES)) {
        const v = await probeClip(cand, opts);
        if (v === "dead") { dead.add(cand); continue; }
        picked = cand; // "alive" ou "unknown" (fail-open: só condenamos com prova)
        break;
      }

      if (picked) { used.add(picked); out.push(picked); replaced++; }
      else dropped++; // sem reposição viva → cena a menos (o pool cicla no Reel.tsx)
    }

    return {
      clips: out,
      dead: [...dead].filter((u) => original.includes(u)),
      replaced,
      dropped,
      changed: out.length !== original.length || out.some((u, i) => u !== original[i]),
    };
  } catch {
    return none; // FAIL-OPEN: preflight quebrado nunca derruba a publicação
  }
}
