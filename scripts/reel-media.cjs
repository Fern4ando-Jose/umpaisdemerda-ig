// ─── Mídia visual REAL de um Reel (guarda anti-preto, #3) ─────────────────────
// Um Reel só tem fundo de verdade se houver ≥1 CLIPE de footage (Pexels) OU uma
// ILUSTRAÇÃO (img). Sem nenhum dos dois, o Reel.tsx cai no último recurso (fundo
// INK quase preto + marca d'água) — visualmente "quebrado". Esse Reel NÃO pode ir
// ao ar (caso Nº 102, capa preta). Esta função é a FONTE ÚNICA da regra: o
// workflow decide pular a publicação por ela, e o teste invariante a fixa.
//
// CommonJS de propósito: o passo do GitHub Actions a chama via `node -e require()`
// sem build de TS; o teste (src/lib/reel-media.invariants.test.ts) usa a MESMA
// implementação (sem duplicar a lógica → não dessincroniza).

/** @param {{clips?: unknown, img?: unknown}|null|undefined} props */
function hasVisualMedia(props) {
  if (!props || typeof props !== "object") return false;
  const clips = props.clips;
  if (Array.isArray(clips) && clips.some((c) => typeof c === "string" && c.trim() !== "")) {
    return true;
  }
  if (typeof props.img === "string" && props.img.trim() !== "") return true;
  return false;
}

module.exports = { hasVisualMedia };
