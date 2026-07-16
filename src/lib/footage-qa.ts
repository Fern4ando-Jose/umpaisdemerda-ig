// ─── QA de CONTEÚDO do footage (incidente 2026-07-01) ─────────────────────────
// Um Reel PT saiu com clipes de MACRO de pele/textura (aspecto de nudez). O footage
// (Pexels) não tinha NENHUM QA: pegava o 1º vídeo retrato ≥4s por termo (só filtrava
// orientação/duração), e a grade quente/vintage amplifica pele → borrão impróprio.
// A ilustração já tinha QA de visão; o footage não. Aqui está o juiz que faltava:
// olha o POSTER do clipe (Pexels expõe `video.image`, barato — sem baixar o mp4) e
// REJEITA close extremo de pele/corpo, textura abstrata sem cena, ou aspecto NSFW.
//
// Reputacional (marca de psicologia) → FAIL-SAFE: com a chave presente, veredito
// ilegível ou erro de API = REJEITA (descarta o clipe, tenta o próximo; se todos
// caírem, o Reel usa a ilustração estática — fallback que já existe). SEM a chave
// (config), o QA é PULADO (aceita) p/ não degradar TODO Reel — a trava de prompt
// (videoQueries endurecido) ainda reduz o risco. Espelhado em scripts/fetch-footage.mjs
// (que roda no CI e não importa TS) — manter os dois em sincronia.
import { type Automation, anthropicCost, logSpend } from "@/lib/spend";

// Visão BARATA: o check é grosseiro (é pele/corpo/textura/NSFW?), não conta dedos como
// a ilustração → Haiku basta (~US$0,005/imagem). Modelo na tabela de preços de spend.ts.
const QA_MODEL = "claude-haiku-4-5-20251001";

export const FOOTAGE_QA_PROMPT = `You review a single stock-video POSTER FRAME for a serious mental-health / psychology Instagram brand.
Answer ONLY with JSON: {"reject": boolean, "reason": "<=8 words"}.
Set reject=true if the frame is ANY of:
- an extreme close-up of bare skin or body parts (arm, leg, torso, lips, etc.) filling the frame;
- an abstract skin/flesh/body texture with no clear scene or subject;
- nudity, lingerie, or sexually suggestive content;
- a child or teenager (anyone who looks under ~18) as a subject in the frame;
- anything a psychology brand would be embarrassed to post.
Set reject=false only for a clear, tasteful scene with a discernible ADULT subject in context (a person doing something, a place, an object, nature).
When in doubt, reject=true.`;

// Parser PURO do veredito. FAIL-SAFE: JSON ilegível → REJEITA (melhor descartar um
// clipe do que publicar conteúdo impróprio). PURA/testável.
export function parseFootageVerdict(text: unknown): { reject: boolean; reason: string } {
  const s = typeof text === "string" ? text : "";
  try {
    const start = s.indexOf("{");
    const end = s.lastIndexOf("}");
    if (start >= 0 && end > start) {
      const o = JSON.parse(s.slice(start, end + 1)) as { reject?: unknown; reason?: unknown };
      if (typeof o.reject === "boolean") {
        return { reject: o.reject, reason: typeof o.reason === "string" ? o.reason : "" };
      }
    }
  } catch { /* cai no fail-safe abaixo */ }
  return { reject: true, reason: "veredito ilegível → rejeitado (fail-safe)" };
}

// Julga o POSTER (frame) de um clipe Pexels. FAIL-SAFE (chave presente): erro/HTTP ruim
// → reject. FAIL-OPEN (config): sem ANTHROPIC_API_KEY → aceita (QA pulado). Sem poster
// → aceita (nada a verificar). Loga o gasto no balde `automation`.
export async function judgeFootagePoster(
  posterUrl: string | undefined,
  apiKey: string | undefined,
  automation: Automation,
  meta?: Record<string, unknown>,
): Promise<{ reject: boolean; reason: string }> {
  if (!apiKey) return { reject: false, reason: "sem ANTHROPIC_API_KEY — QA pulado" };
  if (!posterUrl) return { reject: false, reason: "sem poster — QA pulado" };
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: QA_MODEL,
        max_tokens: 100,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "url", url: posterUrl } },
            { type: "text", text: FOOTAGE_QA_PROMPT },
          ],
        }],
      }),
    });
    if (!res.ok) return { reject: true, reason: `QA HTTP ${res.status} → rejeitado (fail-safe)` };
    const data = await res.json();
    await logSpend({ automation, platform: "anthropic", operation: "footage-qa", model: QA_MODEL, units: (data?.usage?.input_tokens ?? 0) + (data?.usage?.output_tokens ?? 0), costUsd: anthropicCost(QA_MODEL, data?.usage), meta });
    return parseFootageVerdict(data?.content?.[0]?.text);
  } catch (e) {
    return { reject: true, reason: `QA erro (${e instanceof Error ? e.message : String(e)}) → rejeitado (fail-safe)` };
  }
}

// ── CACHE de veredito por videoId (corta o ralo do QA) ────────────────────────
// O poster de um clipe Pexels é IMUTÁVEL → o veredito vale p/ sempre. Sem cache,
// um clipe rejeitado hoje reaparece na busca de amanhã (mesmos termos por categoria)
// e é re-julgado — pagando de novo (07/07: ~20 vereditos num preview, ~US$0,03/tema,
// espremendo o teto ig-reels de US$0,30). Padrão do repo (illustration_cache/
// content_cache). FAIL-OPEN: erro de banco → julga como antes (o QA nunca é pulado
// por causa do cache; só o PAGAMENTO repetido é evitado).
export function isCacheableVerdictReason(reason: string): boolean {
  // Não cacheia veredito de config ausente/erro transitório/JSON ilegível — um
  // soluço de rede/modelo condenaria o clipe pra sempre. Só o veredito REAL é permanente.
  return !/QA pulado|QA HTTP|QA erro|ilegível/.test(reason);
}

export async function readFootageVerdictCache(videoId: number): Promise<{ reject: boolean; reason: string } | null> {
  try {
    const { sql } = await import("@vercel/postgres");
    const r = await sql<{ reject: boolean; reason: string }>`
      SELECT reject, reason FROM footage_qa_cache WHERE video_id = ${videoId}
    `;
    const row = r.rows[0];
    return row ? { reject: row.reject, reason: row.reason ?? "" } : null;
  } catch { return null; }
}

export async function writeFootageVerdictCache(videoId: number, verdict: { reject: boolean; reason: string }): Promise<void> {
  try {
    const { sql } = await import("@vercel/postgres");
    await sql`
      INSERT INTO footage_qa_cache (video_id, reject, reason, ts)
      VALUES (${videoId}, ${verdict.reject}, ${verdict.reason}, NOW())
      ON CONFLICT (video_id) DO NOTHING
    `;
  } catch { /* fail-open */ }
}

// Juiz com cache: veredito conhecido → devolve sem pagar; desconhecido → julga
// (fail-safe intacto) e grava.
export async function judgeFootagePosterCached(
  videoId: number,
  posterUrl: string | undefined,
  apiKey: string | undefined,
  automation: Automation,
): Promise<{ reject: boolean; reason: string }> {
  const hit = await readFootageVerdictCache(videoId);
  if (hit) return hit;
  const verdict = await judgeFootagePoster(posterUrl, apiKey, automation, { videoId });
  if (isCacheableVerdictReason(verdict.reason)) await writeFootageVerdictCache(videoId, verdict);
  return verdict;
}
