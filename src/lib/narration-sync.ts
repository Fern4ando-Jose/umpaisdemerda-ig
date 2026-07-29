// ─── Sincronia da narração: O ÁUDIO É O RELÓGIO ───────────────────────────────
// Módulo PURO (sem rede, sem DB, sem React) — por isso entra no bundle do Remotion
// E no runtime da API, e é travado por teste de invariante.
//
// POR QUE EXISTE (a dessincronia que o dono reprovou):
// Até aqui o pipeline rodava na ordem INVERTIDA — o vídeo estimava a própria duração
// por fórmula de slides (3,0 + 5,6·n + 4,6) e a voz era ESPREMIDA (speed 0,85→0,95)
// pra caber nessa janela. Quando a estimativa errava — e ela erra: pontuação, palavras
// longas, PT mais verboso que ES — a voz atrasava, embolava ou estourava o vídeo.
//
// A ORDEM CERTA (implementada aqui): a voz sai em velocidade natural FIXA, mede-se a
// duração REAL do mp3 e a transcrição diz ONDE cada palavra caiu. Vídeo, cenas e
// legenda são dimensionados por essa medida. Nunca cronometrar pelo texto escrito:
// a voz respira, pausa e acelera, e o desvio se ACUMULA ao longo do vídeo.

export interface NarrationWord {
  text: string;  // a palavra como será EXIBIDA (vem do roteiro, não da transcrição)
  start: number; // segundos
  end: number;   // segundos
}

export interface SegmentTiming {
  start: number; // segundos — quando a voz COMEÇA esta frase
  end: number;   // segundos — quando a voz TERMINA esta frase
  from: number;  // índice da 1ª palavra desta frase em `words`
  to: number;    // índice da última palavra (inclusivo)
}

// Respiro depois da última palavra antes de virar a cena/encerrar (a voz não pode
// terminar no mesmo frame em que a tela corta — soa cortado).
export const TAIL_SEC = 0.5;

// ─── Tempos NATIVOS do ElevenLabs (dispensa a transcrição paga) ──────────────
// O `multilingual-v2` devolve os tempos por CARACTERE (arrays paralelos:
// `characters[]` + `character_start_times_seconds[]` + `character_end_times_seconds[]`),
// não por palavra — então agrupamos por espaço. Também aceita o formato já-por-palavra,
// caso a API mude. Vazio → o chamador cai na transcrição, como no caminho do ES.
// Mesmo tratamento que o AnamnesisMed usa desde 2026-06-18 (`narrate.ts`).
export function wordsFromElevenLabsTimestamps(ts: unknown): NarrationWord[] {
  if (!ts) return [];
  const blocos = (Array.isArray(ts) ? ts : [ts]) as Array<Record<string, unknown>>;
  if (!blocos.length) return [];

  // Formato já no nível de palavra.
  const b0 = blocos[0];
  if (b0 && b0.characters === undefined && (b0.word !== undefined || b0.text !== undefined)) {
    return blocos
      .map((w) => ({
        text: String(w.word ?? w.text ?? "").trim(),
        start: Number(w.start ?? 0),
        end: Number(w.end ?? w.start ?? 0),
      }))
      .filter((w) => w.text && Number.isFinite(w.start) && Number.isFinite(w.end));
  }

  // Formato por caractere: junta em palavras nas fronteiras de espaço.
  const out: NarrationWord[] = [];
  let atual = "", ini = 0, fim = 0, aberto = false;
  for (const b of blocos) {
    const chars = b?.characters as unknown[];
    const st = (b?.character_start_times_seconds ?? b?.characterStartTimesSeconds) as number[] | undefined;
    const en = (b?.character_end_times_seconds ?? b?.characterEndTimesSeconds) as number[] | undefined;
    if (!Array.isArray(chars)) continue;
    for (let i = 0; i < chars.length; i++) {
      const ch = String(chars[i] ?? "");
      const cs = Array.isArray(st) ? Number(st[i] ?? 0) : 0;
      const ce = Array.isArray(en) ? Number(en[i] ?? cs) : cs;
      if (/\s/.test(ch)) {
        if (aberto && atual) { out.push({ text: atual, start: ini, end: fim }); atual = ""; aberto = false; }
      } else {
        if (!aberto) { ini = cs; aberto = true; }
        atual += ch;
        fim = ce;
      }
    }
  }
  if (aberto && atual) out.push({ text: atual, start: ini, end: fim });
  return out.filter((w) => Number.isFinite(w.start) && Number.isFinite(w.end));
}

// Compara palavras ignorando caixa, acento e pontuação — a transcrição devolve
// "publico" onde o roteiro tem "público,", e são a MESMA palavra falada.
export function normalizeWord(w: string): string {
  return (w || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")   // tira o acento combinante que o NFD separou
    .replace(/[^\p{L}\p{N}]/gu, "");
}

export function splitWords(text: string): string[] {
  return (text || "").trim().split(/\s+/).filter(Boolean);
}

// Distribui palavras proporcionalmente ao comprimento dentro de uma janela.
// É o ÚLTIMO recurso (transcrição indisponível): melhor que timing fixo, mas
// ainda é cronômetro de texto — só se usa quando não há medida real da voz.
function spreadByLength(words: string[], start: number, end: number): NarrationWord[] {
  const span = Math.max(0.001, end - start);
  const weights = words.map((w) => Math.max(1, w.length));
  const totalW = weights.reduce((a, b) => a + b, 0);
  let t = start;
  return words.map((w, i) => {
    const dur = (weights[i] / totalW) * span;
    const item = { text: w, start: t, end: t + dur };
    t += dur;
    return item;
  });
}

// ─── Alinhamento roteiro × transcrição ────────────────────────────────────────
// O TEXTO exibido vem SEMPRE do roteiro (é o que a tela promete e o que o dono
// aprovou); da transcrição aproveitamos só os TEMPOS. Assim um erro de grafia do
// STT ("dopamina" → "dopa mina") nunca vaza para a legenda: ele só desloca uma
// âncora de tempo, e as vizinhas corrigem por interpolação.
//
// Casa as duas listas por subsequência comum (DP clássico) sobre a forma
// normalizada; as palavras do roteiro que casaram herdam start/end reais, e as
// que não casaram são interpoladas entre as âncoras vizinhas.
export function alignScriptToTranscript(
  scriptWords: string[],
  transcript: NarrationWord[],
  totalSec: number,
): NarrationWord[] {
  const n = scriptWords.length;
  if (!n) return [];
  const dur = totalSec > 0 ? totalSec : 0;

  const clean = (transcript || []).filter(
    (w) => w && normalizeWord(w.text) && Number.isFinite(w.start) && Number.isFinite(w.end),
  );
  // Sem transcrição utilizável → distribuição proporcional na duração REAL do mp3.
  if (!clean.length || dur <= 0) return spreadByLength(scriptWords, 0, dur || n * 0.35);

  const a = scriptWords.map(normalizeWord);
  const b = clean.map((w) => normalizeWord(w.text));
  const m = b.length;

  // LCS por programação dinâmica (n,m ≈ 60 → 3600 células, custo irrelevante).
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  // Âncoras: índice do roteiro → palavra da transcrição que é a MESMA palavra.
  const anchor: Array<NarrationWord | null> = new Array(n).fill(null);
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { anchor[i] = clean[j]; i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }

  const anchored = anchor.filter(Boolean).length;
  // Casou quase nada (idioma trocado, áudio ruim) → não confiar na transcrição.
  if (anchored < Math.max(2, Math.ceil(n * 0.25))) return spreadByLength(scriptWords, 0, dur);

  // Preenche os vãos: interpola entre a âncora anterior e a próxima, por comprimento.
  const out: NarrationWord[] = new Array(n);
  let k = 0;
  while (k < n) {
    if (anchor[k]) {
      out[k] = { text: scriptWords[k], start: anchor[k]!.start, end: anchor[k]!.end };
      k++;
      continue;
    }
    let end = k;
    while (end < n && !anchor[end]) end++;
    // Janela do vão: do fim da âncora anterior ao início da próxima (ou bordas do áudio).
    const from = k > 0 ? out[k - 1].end : 0;
    const to = end < n ? anchor[end]!.start : dur;
    const filled = spreadByLength(scriptWords.slice(k, end), from, Math.max(from, to));
    for (let x = 0; x < filled.length; x++) out[k + x] = filled[x];
    k = end;
  }

  // Monotonicidade: a legenda nunca anda pra trás nem tem duração negativa.
  for (let x = 0; x < n; x++) {
    if (x > 0 && out[x].start < out[x - 1].end) out[x].start = out[x - 1].end;
    if (out[x].end < out[x].start) out[x].end = out[x].start;
  }
  return out;
}

// ─── Fronteiras de cena: a tela vira quando a VOZ vira de frase ───────────────
// `segments` são os blocos do roteiro NA ORDEM em que foram falados (gancho,
// insights, cierre). Como o roteiro é a junção desses blocos, os índices de
// palavra batem 1:1 — a fronteira de cena é o tempo REAL da fala, não uma conta.
export function segmentTimings(segments: string[], words: NarrationWord[]): SegmentTiming[] {
  const out: SegmentTiming[] = [];
  let cursor = 0;
  for (const seg of segments) {
    const count = splitWords(seg).length;
    const from = Math.min(cursor, Math.max(0, words.length - 1));
    const to = Math.min(cursor + count - 1, words.length - 1);
    const prevEnd = out.length ? out[out.length - 1].end : 0;
    const start = count > 0 && words[from] ? words[from].start : prevEnd;
    const end = count > 0 && words[to] ? words[to].end : start;
    out.push({ start: Math.max(prevEnd, start), end: Math.max(start, end), from, to });
    cursor += count;
  }
  return out;
}

export interface SyncPlan {
  scenes: Array<{ fromFrame: number; durationInFrames: number }>;
  words: NarrationWord[];
  totalFrames: number;
}

// Monta o plano de render inteiro a partir da voz: quantos frames cada cena ocupa
// e onde cada palavra cai. O end-card do funil entra DEPOIS da voz terminar.
//
// ⚠️ INVARIANTE QUE NÃO PODE CAIR: `fromFrame` de cada cena é o frame ABSOLUTO em
// que a voz começa aquela frase. O áudio toca linearmente do frame 0 e não pode ser
// esticado — então NENHUM piso/ajuste de duração de cena é permitido aqui: alongar
// uma cena empurraria todas as seguintes e a tela voltaria a atrasar em relação à
// fala, que é exatamente o defeito que este módulo existe pra matar.
export function buildSyncPlan(
  segments: string[],
  words: NarrationWord[],
  durationSec: number,
  fps: number,
  funnelSec = 0,
): SyncPlan {
  const timings = segmentTimings(segments, words);
  const voiceEnd = Math.max(durationSec, timings.length ? timings[timings.length - 1].end : 0);

  // Fronteiras em segundos: a cena i começa quando a voz começa a frase i. A 1ª
  // começa em 0 (a voz costuma ter um respiro inicial que pertence à capa).
  const bounds: number[] = [0];
  for (let i = 1; i < timings.length; i++) bounds.push(timings[i].start);
  bounds.push(voiceEnd + TAIL_SEC);

  const frames = bounds.map((s) => Math.round(Math.max(0, s) * fps));
  // Monotonicidade: cada cena tem pelo menos 1 frame, sem nunca andar pra trás.
  for (let i = 1; i < frames.length; i++) if (frames[i] <= frames[i - 1]) frames[i] = frames[i - 1] + 1;

  const scenes = frames.slice(0, -1).map((f, i) => ({
    fromFrame: f,
    durationInFrames: frames[i + 1] - f,
  }));

  let total = frames[frames.length - 1];
  if (funnelSec > 0) {
    const funnelFrames = Math.max(1, Math.round(funnelSec * fps));
    scenes.push({ fromFrame: total, durationInFrames: funnelFrames });
    total += funnelFrames;
  }
  return { scenes, words, totalFrames: Math.max(fps, total) };
}
