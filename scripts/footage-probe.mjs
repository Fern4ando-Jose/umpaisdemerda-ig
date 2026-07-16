// ─── Sonda de saúde de um clipe de footage (custo ZERO, fail-open) ────────────
// Um clipe da whitelist pode MORRER no CDN depois de vetado (o Pexels remove/move
// o arquivo). O CloudFront passa a devolver 403 permanente (`<Code>AccessDenied</Code>`,
// sem query string de assinatura — não é expiração) e o Remotion mata o render:
//   "Received a status code of 403 while downloading file …" → exit 1 → Reel não sai.
// (Caso real: pexels 28759715, pilar `freedom`, run 29517163150.)
//
// Esta sonda diz se uma URL ainda serve, com um GET Range 0-64 (só o header do
// arquivo, ~0 bytes de tráfego, $0 — CDN público, nada de API paga). NÃO busca
// footage: nunca descobre URL nova, só confere as que já estão na whitelist.
//
// FONTE ÚNICA da regra status→veredito: o preflight da API (src/lib/footage-health.ts)
// e o passo do CI (scripts/fetch-footage.mjs) usam esta MESMA implementação, e o
// teste invariante (src/lib/footage-health.invariants.test.ts) a fixa.
//
// ESM puro de propósito: o CI a importa direto (`node scripts/fetch-footage.mjs`,
// sem build de TS) e o bundler do Next a importa do route (allowJs).
//
// FAIL-OPEN é a regra: só "dead" com veredito PERMANENTE do servidor (403/404/410).
// Rede caída, timeout, 5xx ou 429 → "unknown" = mantém o clipe. O pior caso volta a
// ser o de hoje (um render que pode falhar), nunca um Reel a menos por falso positivo.

/** @typedef {"alive"|"dead"|"unknown"} ProbeVerdict */

export const PROBE_TIMEOUT_MS = 6000;

/**
 * Classifica um status HTTP. Fonte única do "o que é morte".
 * @param {number} status
 * @returns {ProbeVerdict}
 */
export function verdictForStatus(status) {
  // 2xx/3xx (inclui 206 Partial Content do Range) → o arquivo está lá.
  if (status >= 200 && status < 400) return "alive";
  // Transitório/infra → NUNCA condena (fail-open).
  if (status === 408 || status === 429 || status >= 500) return "unknown";
  // 403 (AccessDenied do CloudFront), 404, 410 … → o arquivo saiu do ar de vez.
  return "dead";
}

/**
 * Sonda uma URL de footage. Nunca lança.
 * @param {string} url
 * @param {{timeoutMs?: number}} [opts]
 * @returns {Promise<ProbeVerdict>}
 */
export async function probeClip(url, opts = {}) {
  if (typeof url !== "string" || !/^https?:\/\//i.test(url.trim())) return "unknown";
  const timeoutMs = opts.timeoutMs ?? PROBE_TIMEOUT_MS;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Range: "bytes=0-64" }, // só o cabeçalho do arquivo — não baixa o vídeo
      redirect: "follow",
      signal: ac.signal,
    });
    // Descarta o corpo: sem isso o socket fica aberto até o vídeo inteiro chegar.
    try { await res.body?.cancel?.(); } catch { /* corpo já consumido/ausente */ }
    return verdictForStatus(res.status);
  } catch {
    return "unknown"; // rede/timeout/abort → fail-open (mantém o clipe)
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Sonda várias URLs EM PARALELO (o preflight inteiro custa ~1 round-trip).
 * @param {string[]} urls
 * @param {{timeoutMs?: number}} [opts]
 * @returns {Promise<ProbeVerdict[]>}
 */
export async function probeClips(urls, opts = {}) {
  if (!Array.isArray(urls) || !urls.length) return [];
  return Promise.all(urls.map((u) => probeClip(u, opts)));
}

/**
 * Poda as URLs comprovadamente MORTAS de uma lista (sem repor — quem repõe é o
 * preflight da API, que conhece a whitelist por pilar). Fail-open: em erro de
 * rede nada é podado.
 * @param {string[]} urls
 * @param {{timeoutMs?: number}} [opts]
 * @returns {Promise<{kept: string[], dead: string[]}>}
 */
export async function pruneDeadUrls(urls, opts = {}) {
  const list = Array.isArray(urls) ? urls.filter((u) => typeof u === "string" && u.trim() !== "") : [];
  if (!list.length) return { kept: [], dead: [] };
  const verdicts = await probeClips(list, opts);
  /** @type {string[]} */ const kept = [];
  /** @type {string[]} */ const dead = [];
  list.forEach((u, i) => (verdicts[i] === "dead" ? dead : kept).push(u));
  return { kept, dead };
}
