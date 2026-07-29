// ─── De-dup na ORIGEM: o 1º slide não pode REPETIR o título ───────────────────
// A geração (haiku) às vezes faz `slides[0] === postTitle` → no Reel a CAPA e o
// insight 1 mostram a MESMA frase (~8s repetidos = sangria de retenção); no CARROSSEL
// a capa e o slide 1 repetem. O ReelV2 já descarta no render, mas a CAUSA é a copy —
// consertar aqui conserta os DOIS formatos. Função PURA → testável por invariante.

export function normalizePhrase(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // tira acentos
    .replace(/[^a-z0-9 ]/g, " ") // só letras/dígitos
    .replace(/\s+/g, " ")
    .trim();
}

/** True se ALGUM slide repete o título (normalizado: ignora acento/pontuação/caixa). */
export function titleDupedInSlides(title: string, slides: string[] | undefined): boolean {
  const t = normalizePhrase(title);
  if (!t) return false;
  return (slides ?? []).some((s) => normalizePhrase(s) === t);
}

/** Slides que o Reel REALMENTE mostra: os 3 primeiros menos os que repetem o título
 *  (se sobrar 0, mantém os 3 — fail-safe). Espelha `video/ReelV2.dedupeSlides`. PURO.
 *  Usado na API p/ dimensionar a JANELA DE VOZ da narração com a MESMA contagem do render
 *  — senão a voz é calibrada p/ um vídeo mais longo do que o renderizado e a frase final
 *  ("Me siga") é cortada (bug pego na auditoria 29/06). */
export function dedupeSlides(title: string, slides: string[] | undefined): string[] {
  const raw = (slides ?? []).slice(0, 3);
  const t = normalizePhrase(title);
  const distinct = raw.filter((s) => normalizePhrase(s) !== t);
  return distinct.length ? distinct : raw;
}
