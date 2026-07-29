import { describe, it, expect } from "vitest";
import {
  normalizeWord,
  splitWords,
  alignScriptToTranscript,
  segmentTimings,
  buildSyncPlan,
  TAIL_SEC,
  type NarrationWord,
} from "./narration-sync";

// Transcrição de mentira, mas com a forma REAL do Scribe: palavras com start/end
// em segundos. `gap` simula a respiração da voz (é justamente o que a fórmula de
// caracteres/segundo não sabia prever).
function fakeTranscript(words: string[], startAt = 0.2, per = 0.4, gapAfter: number[] = []): NarrationWord[] {
  let t = startAt;
  return words.map((w, i) => {
    const item = { text: w, start: t, end: t + per };
    t += per + (gapAfter.includes(i) ? 0.6 : 0.05);
    return item;
  });
}

describe("narration-sync — o ÁUDIO é o relógio (nunca o texto escrito)", () => {
  it("a legenda exibe o texto do ROTEIRO, com os TEMPOS da voz", () => {
    const script = ["A", "liberdade", "começa", "onde", "acaba", "o", "medo"];
    // O STT erra a grafia de uma palavra ("comeca") — não pode vazar para a tela.
    const trans = fakeTranscript(["a", "liberdade", "comeca", "onde", "acaba", "o", "medo"]);
    const out = alignScriptToTranscript(script, trans, 3.5);
    expect(out.map((w) => w.text)).toEqual(script); // texto = roteiro, sempre
    expect(out[1].start).toBeCloseTo(trans[1].start, 5); // tempo = voz real
    expect(out[6].end).toBeCloseTo(trans[6].end, 5);
  });

  it("palavra que o STT ENGOLIU é interpolada entre as âncoras vizinhas", () => {
    const script = ["um", "dois", "tres", "quatro"];
    const trans = fakeTranscript(["um", "dois", "quatro"]); // "tres" sumiu
    const out = alignScriptToTranscript(script, trans, 2.0);
    expect(out).toHaveLength(4);
    expect(out[2].text).toBe("tres");
    expect(out[2].start).toBeGreaterThanOrEqual(out[1].end);
    expect(out[2].end).toBeLessThanOrEqual(out[3].start + 1e-9);
  });

  it("a legenda NUNCA anda para trás (monotonicidade)", () => {
    const script = splitWords("uma frase qualquer para checar a ordem dos tempos");
    const trans = fakeTranscript(script.map((s) => s), 0.1, 0.3, [2, 5]);
    const out = alignScriptToTranscript(script, trans, 4);
    for (let i = 1; i < out.length; i++) {
      expect(out[i].start).toBeGreaterThanOrEqual(out[i - 1].start);
      expect(out[i].end).toBeGreaterThanOrEqual(out[i].start);
    }
  });

  it("transcrição inútil (outro idioma) → cai para distribuição na duração REAL", () => {
    const script = splitWords("a liberdade começa onde acaba o medo");
    const trans = fakeTranscript(["hello", "world", "this", "is", "wrong"]);
    const out = alignScriptToTranscript(script, trans, 6);
    expect(out).toHaveLength(script.length);
    expect(out[0].start).toBeCloseTo(0, 5);
    expect(out[out.length - 1].end).toBeCloseTo(6, 5); // usa a medida do mp3, não a fórmula
  });

  it("sem transcrição nenhuma → ainda respeita a duração medida do mp3", () => {
    const script = splitWords("uma duas tres quatro cinco");
    const out = alignScriptToTranscript(script, [], 5);
    expect(out[out.length - 1].end).toBeCloseTo(5, 5);
  });

  it("a fronteira da CENA é onde a voz vira de frase", () => {
    const segs = ["a liberdade assusta", "porque ela cobra"];
    const script = segs.flatMap(splitWords);
    // pausa longa entre as duas frases (índice 2 = fim da 1ª)
    const trans = fakeTranscript(script, 0.2, 0.4, [2]);
    const words = alignScriptToTranscript(script, trans, 3.5);
    const t = segmentTimings(segs, words);
    expect(t).toHaveLength(2);
    expect(t[0].end).toBeCloseTo(words[2].end, 5);
    expect(t[1].start).toBeCloseTo(words[3].start, 5);
    expect(t[1].start).toBeGreaterThan(t[0].end); // a pausa real aparece no corte
  });

  it("a voz NUNCA é cortada: a última cena vai até o fim do áudio + respiro", () => {
    const segs = ["gancho curto", "insight um", "me siga se prefere a verdade"];
    const script = segs.flatMap(splitWords);
    const trans = fakeTranscript(script, 0.1, 0.35);
    const durationSec = trans[trans.length - 1].end;
    const words = alignScriptToTranscript(script, trans, durationSec);
    const plan = buildSyncPlan(segs, words, durationSec, 30);
    const totalSec = plan.totalFrames / 30;
    expect(totalSec).toBeGreaterThanOrEqual(durationSec + TAIL_SEC - 0.05);
  });

  it("o end-card do funil entra DEPOIS da voz (não cavalga o fim da fala)", () => {
    const segs = ["gancho", "insight", "cierre falado"];
    const script = segs.flatMap(splitWords);
    const trans = fakeTranscript(script, 0.1, 0.4);
    const dur = trans[trans.length - 1].end;
    const words = alignScriptToTranscript(script, trans, dur);
    const semFunil = buildSyncPlan(segs, words, dur, 30, 0);
    const comFunil = buildSyncPlan(segs, words, dur, 30, 3.5);
    expect(comFunil.scenes).toHaveLength(semFunil.scenes.length + 1);
    const funil = comFunil.scenes[comFunil.scenes.length - 1];
    expect(funil.fromFrame).toBeGreaterThanOrEqual(Math.round((dur + TAIL_SEC) * 30) - 2);
    expect(comFunil.totalFrames).toBe(semFunil.totalFrames + Math.round(3.5 * 30));
  });

  it("PT mais verboso que ES gera vídeo MAIS LONGO — não voz acelerada", () => {
    const es = ["la libertad asusta", "porque cobra un precio"];
    const pt = ["a liberdade assusta muito mais do que parece", "porque ela cobra um preço bem alto de você"];
    const mk = (segs: string[]) => {
      const s = segs.flatMap(splitWords);
      const tr = fakeTranscript(s, 0.1, 0.4);
      const d = tr[tr.length - 1].end;
      return buildSyncPlan(segs, alignScriptToTranscript(s, tr, d), d, 30);
    };
    expect(mk(pt).totalFrames).toBeGreaterThan(mk(es).totalFrames);
  });

  // ⚠️ O invariante que mata a dessincronia: o áudio toca linearmente do frame 0, então
  // a cena i TEM de começar no frame em que a voz começa a frase i. Qualquer "piso" ou
  // arredondamento que empurre uma cena desloca todas as seguintes e a tela volta a
  // atrasar em relação à fala.
  it("cada cena começa NO FRAME em que a voz começa aquela frase", () => {
    const segs = ["gancho da capa", "primeiro insight aqui", "segundo insight ali", "cierre falado"];
    const script = segs.flatMap(splitWords);
    const trans = fakeTranscript(script, 0.3, 0.4, [2, 5, 8]);
    const dur = trans[trans.length - 1].end;
    const words = alignScriptToTranscript(script, trans, dur);
    const t = segmentTimings(segs, words);
    const plan = buildSyncPlan(segs, words, dur, 30);
    expect(plan.scenes[0].fromFrame).toBe(0);
    for (let i = 1; i < segs.length; i++) {
      expect(plan.scenes[i].fromFrame).toBe(Math.round(t[i].start * 30));
    }
  });

  it("frase curtíssima não empurra as cenas seguintes para fora do áudio", () => {
    const segs = ["oi", "tchau", "fim da fala"];
    const script = segs.flatMap(splitWords);
    const trans = fakeTranscript(script, 0.05, 0.15);
    const dur = trans[trans.length - 1].end;
    const words = alignScriptToTranscript(script, trans, dur);
    const t = segmentTimings(segs, words);
    const plan = buildSyncPlan(segs, words, dur, 30);
    for (const s of plan.scenes) expect(s.durationInFrames).toBeGreaterThanOrEqual(1);
    // mesmo com cenas de fração de segundo, a última ainda casa com a voz
    expect(plan.scenes[2].fromFrame).toBe(Math.round(t[2].start * 30));
  });

  it("as cenas são contíguas — sem buraco preto nem sobreposição", () => {
    const segs = ["um gancho", "um insight", "outro insight", "o cierre"];
    const script = segs.flatMap(splitWords);
    const trans = fakeTranscript(script, 0.2, 0.35, [1, 4]);
    const dur = trans[trans.length - 1].end;
    const plan = buildSyncPlan(segs, alignScriptToTranscript(script, trans, dur), dur, 30, 3.5);
    let expected = 0;
    for (const s of plan.scenes) {
      expect(s.fromFrame).toBe(expected);
      expected += s.durationInFrames;
    }
    expect(plan.totalFrames).toBe(expected);
  });

  it("normalizeWord ignora acento, caixa e pontuação", () => {
    expect(normalizeWord("Público,")).toBe(normalizeWord("publico"));
    expect(normalizeWord("¿Verdad?")).toBe("verdad");
  });
});
