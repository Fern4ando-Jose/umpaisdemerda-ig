// ─── Narração (voz TTS) do Reel — fal.ai / ElevenLabs multilingual-v2 ─────────
// PORTADO do dr-libertad-site em 2026-07-29 por ordem do dono: "ligar no um pais
// de merda a mesma narração do reel que existe no dr liberdade". Mesma mecânica
// (O ÁUDIO É O RELÓGIO — fonte única do COMO: .claude/marca/PADRAO-VIDEO-NARRADO.md)
// e a MESMA voz BR que o dono escolheu ouvindo 6 amostras (2026-07-27): "Bill".
//
// GATED: só roda com REEL_NARRATION_ENABLED=on. Em qualquer falha (sem chave,
// fal caída, saldo esgotado) devolve null → o Reel renderiza SEM narração
// (comportamento de sempre), nunca quebra.
//
// Custo (UPM é só BR): ElevenLabs devolve o tempo de cada palavra NA RESPOSTA →
// dispensa a transcrição paga. ~US$0,10/1000 chars ≈ US$0,02/Reel. Cache por
// (tópico,dia,idioma) → re-disparo reusa, não repaga.
//
// A ordem certa (a mesma que consertou a dessincronia no DR): a voz sai em
// velocidade natural FIXA, mede-se a duração REAL do mp3 e os tempos por palavra
// dizem ONDE cada palavra caiu. Vídeo, cenas e legenda se dimensionam por essa
// medida (ver src/lib/narration-sync.ts) — NUNCA espremer a voz numa janela
// estimada.

import { type Automation, logSpend, checkBudget } from "@/lib/spend";
import { wordsFromElevenLabsTimestamps, type NarrationWord } from "@/lib/narration-sync";

const FAL_STT_MODEL = "fal-ai/elevenlabs/speech-to-text"; // Scribe: words[] com start/end (reserva)
const FAL_TTS_11LABS = "fal-ai/elevenlabs/tts/multilingual-v2"; // dá timestamps NATIVOS
const COST_PER_1K = 0.10;                   // US$/1000 chars
const STT_COST_PER_MIN = 0.03;              // US$/minuto (ElevenLabs Scribe via fal)

// ─── VOZ É CONFIGURAÇÃO POR IDIOMA ───────────────────────────────────────────
// ⚠️ Os parâmetros abaixo são EXATAMENTE os da amostra que o dono ouviu e escolheu
// no DR (BR, 2026-07-27: "Candidata 3 — Bill"). Mudar qualquer um muda a voz que
// ele aprovou — não mexa sem novo OK dele. O UPM publica SÓ em BR (código interno
// `pt`), então há uma entrada única; idioma desconhecido cai nela.
type VozCfg = { provedor: "elevenlabs"; voz: string; speed: number; stability: number; similarity: number; style: number };

export const VOZ_POR_IDIOMA: Record<string, VozCfg> = {
  pt: { provedor: "elevenlabs", voz: "Bill", speed: 0.95, stability: 0.45, similarity: 0.8, style: 0.1 },
};

function vozDe(lang: string): VozCfg {
  return VOZ_POR_IDIOMA[lang] ?? VOZ_POR_IDIOMA.pt;
}

// Scribe usa ISO 639-3 ("por"), não o código de 2 letras do resto do projeto.
function sttLanguageCode(_lang: string): string {
  return "por";
}

export interface NarrationResult {
  url: string | null;
  error?: string;
  cached?: boolean;
  // Duração REAL do mp3 (medida, não estimada) — é ela que dimensiona o vídeo.
  durationSec?: number;
  // Tempo de CADA palavra falada — trava a legenda na voz. Vazio quando os tempos
  // falharam: o Reel ainda sai sincronizado pela duração real, só a legenda cai
  // para distribuição proporcional (degrada, não quebra).
  words?: NarrationWord[];
}

// VERSÃO DO ROTEIRO no fim da chave: quando a FORMA do roteiro muda, o áudio
// guardado da forma antiga NÃO pode ser reaproveitado (dessincroniza). Mudou a
// forma do roteiro? Suba o número — o cache velho simplesmente nunca casa.
const ROTEIRO_VERSAO = "v1"; // v1 = título + insights, sem fecho falado (como o DR v2)

// HASH do TEXTO falado na chave (29/07/2026): a voz só pode ser reusada para o
// MESMO roteiro. Foi o bug do 1º reel narrado: a copy mudou entre chamadas (a
// content_cache não existia no banco) e o cache por (tópico,dia,idioma) serviu a
// voz de um texto sobre a tela de outro — 2ª metade toda dessincronizada. Com o
// hash, texto diferente NUNCA casa com voz velha; no pior caso regenera (~US$0,02).
export function hashRoteiro(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function cacheKey(topic: string, day: string, lang: string, roteiro: string): string {
  return `${topic}|${day}|${lang}|${ROTEIRO_VERSAO}|${hashRoteiro(roteiro)}`;
}

// O cache guarda a MEDIDA junto com o áudio (duração real + tempo de cada palavra).
// Sem isso o re-disparo reusaria o mp3 mas perderia a sincronia.
async function readCachedNarration(
  topic: string, day: string, lang: string, roteiro: string,
): Promise<{ url: string; durationSec: number; words: NarrationWord[] } | null> {
  try {
    const { sql } = await import("@vercel/postgres");
    const key = cacheKey(topic, day, lang, roteiro);
    const rows = await sql<{ url: string; duration_sec: number | null; words: unknown }>`
      SELECT url, duration_sec, words FROM narration_cache
      WHERE cache_key = ${key} AND url <> 'PENDING' AND created_at > NOW() - INTERVAL '48 hours'
      LIMIT 1`;
    const row = rows.rows[0];
    if (!row?.url) return null;
    try { const c = await fetch(row.url, { method: "GET" }); if (!c.ok) return null; } catch { return null; }
    const words = Array.isArray(row.words) ? (row.words as NarrationWord[]) : [];
    return { url: row.url, durationSec: Number(row.duration_sec ?? 0), words };
  } catch {
    return null;
  }
}

async function writeCachedNarration(
  topic: string, day: string, lang: string, roteiro: string, url: string, durationSec: number, words: NarrationWord[],
): Promise<void> {
  try {
    const { sql } = await import("@vercel/postgres");
    const key = cacheKey(topic, day, lang, roteiro);
    const wordsJson = JSON.stringify(words ?? []);
    await sql`
      INSERT INTO narration_cache (cache_key, url, topic, lang, duration_sec, words, created_at)
      VALUES (${key}, ${url}, ${topic}, ${lang}, ${durationSec}, ${wordsJson}::jsonb, NOW())
      ON CONFLICT (cache_key) DO UPDATE SET
        url = ${url}, duration_sec = ${durationSec}, words = ${wordsJson}::jsonb, created_at = NOW()`;
  } catch { /* cache é best-effort */ }
}

// ─── GUARDA DE IDIOMA DA VOZ ─────────────────────────────────────────────────
// Herdada do DR (um Reel ES saiu com a voz em INGLÊS lá): se a transcrição de
// checagem detectar idioma diferente do esperado com confiança alta, a narração
// inteira é DESCARTADA — o Reel cai pro fallback (sem voz), nunca publica áudio
// no idioma errado. No caminho normal do UPM (ElevenLabs com tempos nativos) a
// checagem nem roda — limite conhecido, o mesmo do DR/BR.
export function idiomaDaVozBate(esperado: string, detectado: string | null | undefined, prob: number): boolean {
  if (!detectado) return true;         // Scribe não detectou nada → não bloqueia (fail-open)
  if (!(prob >= 0.5)) return true;     // baixa confiança → não confia no detector, não bloqueia
  return detectado === esperado;
}

// ─── Transcrição da PRÓPRIA voz gerada (reserva p/ quando faltarem os tempos) ─
async function transcribeWords(
  audioUrl: string, lang: string, durationSec: number,
  automation: Automation, meta: Record<string, unknown>,
): Promise<{ words: NarrationWord[]; error?: string; languageMismatch?: boolean }> {
  const FAL_KEY = process.env.FAL_KEY;
  if (!FAL_KEY || !audioUrl) return { words: [], error: "sem chave/áudio p/ transcrever" };
  try {
    const res = await fetch(`https://fal.run/${FAL_STT_MODEL}`, {
      method: "POST",
      headers: { Authorization: `Key ${FAL_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        audio_url: audioUrl,
        // SEM language_code: forçar esconderia voz no idioma errado (Scribe "leria"
        // como português o que não é). Omitido, o Scribe DETECTA — é a guarda.
        tag_audio_events: false,
        diarize: false,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { words: [], error: `STT HTTP ${res.status}: ${body.slice(0, 160)}` };
    }
    const data = await res.json();
    const esperado = sttLanguageCode(lang);
    const detectado = typeof data?.language_code === "string" ? data.language_code : null;
    const prob = Number(data?.language_probability ?? 0);
    const raw = Array.isArray(data?.words) ? (data.words as Array<Record<string, unknown>>) : [];
    const words: NarrationWord[] = raw
      .filter((w) => String(w?.type ?? "word") === "word")
      .map((w) => ({
        text: String(w?.text ?? "").trim(),
        start: Number(w?.start ?? 0),
        end: Number(w?.end ?? w?.start ?? 0),
      }))
      .filter((w) => w.text && Number.isFinite(w.start) && Number.isFinite(w.end));
    await logSpend({
      automation, platform: "fal", operation: "narration-stt", model: FAL_STT_MODEL,
      units: Math.max(1, Math.round(durationSec)),
      costUsd: Math.max(0.005, (durationSec / 60) * STT_COST_PER_MIN),
      meta: { ...meta, lang, durationSec, words: words.length, detectado, prob },
    });
    if (!idiomaDaVozBate(esperado, detectado, prob)) {
      return {
        words: [], languageMismatch: true,
        error: `VOZ NO IDIOMA ERRADO: esperava "${esperado}", Scribe detectou "${detectado}" (confiança ${prob.toFixed(2)}) — narração descartada`,
      };
    }
    if (!words.length) return { words: [], error: "STT sem palavras" };
    return { words };
  } catch (e) {
    return { words: [], error: `exceção STT: ${e instanceof Error ? e.message : String(e)}` };
  }
}

// Re-hospeda o mp3 da fal no Vercel Blob (URL permanente; as da fal expiram).
async function rehostToBlob(srcUrl: string, lang: string): Promise<string | null> {
  try {
    const raw = process.env.BLOB_READ_WRITE_TOKEN || "";
    const m = raw.match(/vercel_blob_rw_[A-Za-z0-9_-]+/);
    const token = m ? m[0] : raw.trim();
    if (!token) return null;
    const res = await fetch(srcUrl);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const { put } = await import("@vercel/blob");
    const blob = await put(`narration/${lang}.mp3`, buf, {
      access: "public", contentType: "audio/mpeg", token, addRandomSuffix: true,
    });
    return blob.url;
  } catch {
    return null; // best-effort → segue com a URL da fal
  }
}

// Gera a narração (ou reusa do cache). text = roteiro (título + insights falados).
// Devolve a voz JUNTO COM A MEDIDA (duração real + tempo de cada palavra) — é isso
// que permite ao vídeo se dimensionar pela voz, em vez de espremer a voz no vídeo.
export async function generateNarration(
  text: string,
  lang: string,
  topic: string,
  day: string,
  opts: { automation?: Automation; meta?: Record<string, unknown> } = {},
): Promise<NarrationResult> {
  if ((process.env.REEL_NARRATION_ENABLED ?? "").toLowerCase() !== "on") {
    return { url: null, error: "narração desligada (REEL_NARRATION_ENABLED≠on)" };
  }
  const FAL_KEY = process.env.FAL_KEY;
  const clean = (text ?? "").trim();
  if (!FAL_KEY) return { url: null, error: "FAL_KEY ausente" };
  if (clean.length < 20) return { url: null, error: "roteiro de narração vazio/curto" };

  // Cache por (tópico, dia, idioma, HASH do texto) — re-disparo do MESMO roteiro
  // reusa (gasto fal = 0); texto diferente nunca casa (voz = tela, sempre).
  const hit = await readCachedNarration(topic, day, lang, clean);
  if (hit) return { url: hit.url, cached: true, durationSec: hit.durationSec, words: hit.words };

  const automation: Automation = opts.automation ?? "ig-reels";
  // GATE DE ORÇAMENTO — a narração é PAGA (fal) e o balde `ig-reels` é o freio.
  // Se a estimativa estoura o teto, PULA a narração (fail-open → Reel sai sem voz,
  // sem 402/tempestade). Cost-safe: se nem dá pra checar o orçamento, também pula.
  const estSec = clean.length / 11.6; // ritmo medido da voz — só p/ prever a conta
  const estCost = Math.max(0.005, (clean.length / 1000) * COST_PER_1K);
  try {
    const gate = await checkBudget(automation, estCost + (estSec / 60) * STT_COST_PER_MIN);
    if (!gate.ok) return { url: null, error: `orçamento ${automation} estourado (US$${gate.spent.toFixed(3)} > US$${gate.budget.toFixed(2)}) — narração pulada` };
  } catch {
    return { url: null, error: "orçamento indisponível — narração pulada (cost-safe)" };
  }
  const cfg = vozDe(lang);
  try {
    const corpo = {
      text: clean,
      voice: cfg.voz,
      language_code: "pt",   // ISO exigido pelo ElevenLabs — força o idioma, mata sotaque estrangeiro
      timestamps: true,      // tempo de cada palavra NATIVO → dispensa a transcrição paga
      stability: cfg.stability,
      similarity_boost: cfg.similarity,
      style: cfg.style,
      speed: cfg.speed,
    };
    const res = await fetch(`https://fal.run/${FAL_TTS_11LABS}`, {
      method: "POST",
      headers: { Authorization: `Key ${FAL_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { url: null, error: `fal HTTP ${res.status}: ${body.slice(0, 200)}` };
    }
    const data = await res.json();
    const falUrl: string | undefined = data?.audio?.url;

    // TEMPOS: o ElevenLabs devolve na própria resposta (grátis).
    const wordsNativas = wordsFromElevenLabsTimestamps(data?.timestamps);
    // DURAÇÃO: sai do fim da última palavra falada.
    const durationSec = wordsNativas.length ? wordsNativas[wordsNativas.length - 1].end : 0;

    // fal cobra na geração — loga independentemente do resto.
    await logSpend({
      automation, platform: "fal", operation: "narration", model: FAL_TTS_11LABS,
      units: clean.length, costUsd: Math.max(0.005, (clean.length / 1000) * COST_PER_1K),
      meta: { ...opts.meta, lang, topic, chars: clean.length, voz: cfg.voz, speed: cfg.speed, durationSec },
    });
    if (!falUrl) return { url: null, error: `fal sem audio.url: ${JSON.stringify(data).slice(0, 200)}` };

    const finalUrl = (await rehostToBlob(falUrl, lang)) ?? falUrl;

    // Só transcreve quando a voz NÃO trouxe os tempos nativos (raro). Este é também
    // o único ponto que checa o IDIOMA da voz gerada (guarda acima).
    let words = wordsNativas;
    let erroTempos: string | undefined;
    if (!words.length) {
      const stt = await transcribeWords(falUrl, lang, durationSec, automation, { ...opts.meta, topic });
      if (stt.languageMismatch) {
        // NÃO cacheia, NÃO devolve url: voz no idioma errado nunca publica.
        return { url: null, error: stt.error };
      }
      words = stt.words;
      erroTempos = stt.error;
    }
    // Última linha de defesa: sem duração medida, usa o fim da última palavra.
    const duracaoFinal = durationSec > 0
      ? durationSec
      : (words.length ? words[words.length - 1].end : 0);

    await writeCachedNarration(topic, day, lang, clean, finalUrl, duracaoFinal, words);
    return {
      url: finalUrl, cached: false, durationSec: duracaoFinal, words,
      error: erroTempos ? `voz ok; legenda sem tempos (${erroTempos})` : undefined,
    };
  } catch (e) {
    return { url: null, error: `exceção narração: ${e instanceof Error ? e.message : String(e)}` };
  }
}
