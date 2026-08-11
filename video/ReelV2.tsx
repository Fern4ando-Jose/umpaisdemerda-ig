// ─── ReelV2 — composição NARRADA (produção dos 2 reels de footage) ────────────
// PORTADO do dr-libertad-site em 2026-07-29 por ordem do dono ("a mesma narração
// do reel que existe no dr liberdade"). O que muda vs. o Reel clássico do UPM:
//   1. VOZ (narrationUrl): a narração dita o relógio — cada cena começa NO FRAME
//      em que a voz começa aquela frase (src/lib/narration-sync.ts).
//   2. CAPA 5,0s → 3,0s + LEGENDA CINÉTICA palavra-por-palavra (retenção).
//   3. DE-DUP (dedupeSlides): insight ~igual ao título é descartado.
// Diferenças para o V2 do DR (de propósito): SEM end-card de funil (o UPM não tem
// funil comment→DM) e CTA fixo em BR ("Siga…"). Reusa a CENA/GRADE do Reel do UPM
// via `Scene` exportado — sem copiar, sem drift.
// Render de teste isolado: `render-reel.mjs --composition=ReelV2` (CI), publish:no.

import React from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont as loadFraunces } from "@remotion/google-fonts/Fraunces";
import { measureText } from "@remotion/layout-utils";
import { Scene, reelDefaultProps, type ReelProps, FPS, CAT_ACCENT } from "./Reel";
import { normalizePhrase } from "../src/lib/slide-dedup";
// Import RELATIVO (não `@/…`) p/ o webpack do Remotion resolver no bundle do render.
// `narration-sync` é PURO (sem next/db), seguro no bundle — mesma regra do slide-dedup.
import {
  alignScriptToTranscript,
  buildSyncPlan,
  segmentTimings,
  splitWords,
} from "../src/lib/narration-sync";
import {
  REEL_LARGURA_UTIL,
  REEL_MARGEM_LATERAL,
  REEL_TEXTO_BOTTOM,
  REEL_ALTURA_MANCHETE,
  tamanhoManchete,
  tamanhoInsight,
} from "../src/lib/capa-escala";
import { selo } from "../src/lib/serie";

const { fontFamily: FRAUNCES } = loadFraunces();

/**
 * A largura REAL de uma palavra nesta fonte e neste corpo — medida pelo navegador que
 * renderiza a peça, não estimada.
 *
 * ⛔ 2026-08-11 — POR QUE ISTO EXISTE. No Dr. Liberdade a conta multiplicava nº de letras
 * por um fator médio; medindo **8 manchetes reais** em quadro renderizado, só **5 ficaram
 * na régua** de 85–96% e a pior deu **70,6%** — frase cheia de letra estreita (i, l, t, r)
 * mede muito menos que a média, sobra margem à direita e a régua vai ao chão. `measureText`
 * usa a métrica da própria fonte: acaba a estimativa, acaba o erro.
 *
 * ⚠️ Os parâmetros abaixo têm de ser os MESMOS do `<div>` que desenha a frase (Fraunces,
 * peso 800) — medir com uma fonte e desenhar com outra é voltar a estimar, só que pior.
 */
const medirFraunces = (palavra: string, size: number) =>
  measureText({ text: palavra, fontFamily: FRAUNCES, fontSize: size, fontWeight: 800 }).width;

const PAPER = "#F4F0E8";
const WHITE = "#ffffff";
const RED = "#A45A5A";
// ─── A COR DA MARCA ───────────────────────────────────────────────────────────
// ⛔ 2026-08-11 — IDENTIDADE NÃO MUDA DE COR A CADA PEÇA. No Dr. Liberdade o dono viu uma
// peça de pilar `anxiety` (verde-azulado) e disse «destaque não é da cor da nossa marca»:
// a barra do topo, a etiqueta da série e a palavra em destaque passaram a usar SEMPRE a
// cor da marca; o acento por pilar continua mandando no wash e no miolo da cena.
// AQUI a cor da marca não é a do DR: é o **carimbo do jornal satírico** desta conta,
// `J_RUST` de `src/app/api/og/route.tsx` (a capa do carrossel) — assim Reel e carrossel
// carimbam na mesma cor, que é o ponto da regra.
const MARCA = "#a83f30";
const SAFE_TOP = 340;
const SAFE_BOTTOM_HANDLE = 300;

// ─── Tempos V2 (capa curta) ───────────────────────────────────────────────────
// DE-DUP compartilhado (componente E Root.calculateMetadata usam o MESMO) → a
// duração da composição bate com o nº de insights REALMENTE renderizados.
export function dedupeSlides(title: string, slides: string[] | undefined): string[] {
  const raw = (slides && slides.length ? slides : reelDefaultProps.slides).slice(0, 3);
  const tnorm = normalizePhrase(title);
  const distinct = raw.filter((s) => normalizePhrase(s) !== tnorm);
  return distinct.length ? distinct : raw;
}

export function reelDurationsV2(slidesCount: number) {
  const COVER = Math.round(FPS * 3.0);
  const INSIGHT = Math.round(FPS * 5.6);
  const CTA = Math.round(FPS * 4.6);
  const n = Math.min(Math.max(slidesCount || 1, 1), 3);
  return { COVER, INSIGHT, CTA, n, total: COVER + INSIGHT * n + CTA };
}

// ─── PLANO DE TEMPOS — fonte única (componente + Root.calculateMetadata) ──────
// Dois modos, na ordem de preferência:
//   1. SINCRONIZADO (a voz veio com medida): o áudio é o relógio.
//   2. FÓRMULA (sem narração): capa 3,0s + insight 5,6s×n + cta 4,6s.
// A degradação é silenciosa de propósito: um Reel sem voz nunca deve quebrar.
export interface ReelV2Plan {
  synced: boolean;
  scenes: Array<{ fromFrame: number; durationInFrames: number }>; // capa, insights…, cta
  wordFrames: number[][];  // por cena falada: frame RELATIVO em que cada palavra acende
  usedSlides: string[];
  n: number;
  total: number;
}

export function reelPlanV2(props: Partial<ReelProps>, fps: number = FPS): ReelV2Plan {
  const safeSlides = dedupeSlides(props.title ?? "", props.slides);
  const { COVER, INSIGHT, CTA, n, total } = reelDurationsV2(safeSlides.length);
  const usedSlides = safeSlides.slice(0, n);

  const fallback = (): ReelV2Plan => {
    const scenes: Array<{ fromFrame: number; durationInFrames: number }> = [];
    let cursor = 0;
    const push = (d: number) => { scenes.push({ fromFrame: cursor, durationInFrames: d }); cursor += d; };
    push(COVER);
    for (let i = 0; i < n; i++) push(INSIGHT);
    push(CTA);
    return { synced: false, scenes, wordFrames: [], usedSlides, n, total };
  };

  const segments = Array.isArray(props.narrationSegments) ? props.narrationSegments.filter(Boolean) : [];
  const durationSec = Number(props.narrationDurationSec ?? 0);
  // A voz fala título + n insights + FECHO = n+2 blocos (fecho falado incluído em
  // 29/07 por ordem do dono, depois de ouvir o reel das 19:47: a cena final começa
  // quando a voz começa o fecho — mesma mecânica das outras). Divergência → fórmula.
  if (!props.narrationUrl || !(durationSec > 0) || segments.length !== n + 2) return fallback();

  const scriptWords = segments.flatMap(splitWords);
  if (!scriptWords.length) return fallback();

  const words = alignScriptToTranscript(
    scriptWords,
    Array.isArray(props.narrationWords) ? props.narrationWords : [],
    durationSec,
  );
  // A voz cobre TODAS as cenas, fecho incluso. A ÚLTIMA cena (CTA falado) ganha um
  // respiro extra de leitura DEPOIS de a voz acabar — esticar a última cena não
  // empurra ninguém (não há cena depois dela), então o invariante do relógio fica.
  const plan = buildSyncPlan(segments, words, durationSec, fps, 0);
  const timings = segmentTimings(segments, words);
  const scenes = [...plan.scenes];
  const HOLD = Math.round(fps * 2.0); // card final legível após o fim da fala
  scenes[scenes.length - 1] = {
    ...scenes[scenes.length - 1],
    durationInFrames: scenes[scenes.length - 1].durationInFrames + HOLD,
  };
  let totalFrames = plan.totalFrames + HOLD;

  // Frames de cada palavra, RELATIVOS ao início da sua cena. Só aplica quando a
  // contagem de palavras da tela bate com a falada — senão a cena usa o ritmo fixo.
  const screenTexts = [props.title ?? "", ...usedSlides];
  const wordFrames: number[][] = screenTexts.map((text, i) => {
    const t = timings[i];
    const scene = scenes[i];
    if (!t || !scene) return [];
    const screenCount = splitWords(text).length;
    const spokenCount = t.to - t.from + 1;
    if (!screenCount || screenCount !== spokenCount) return [];
    return words
      .slice(t.from, t.to + 1)
      .map((w) => Math.max(0, Math.round(w.start * fps) - scene.fromFrame));
  });

  return { synced: true, scenes, wordFrames, usedSlides, n, total: totalFrames };
}

export const reelV2DefaultProps: ReelProps = reelDefaultProps;

function Handle({ color = PAPER, handle = "@umpaisdemerda" }: { color?: string; handle?: string }) {
  return (
    <div style={{ fontFamily: FRAUNCES, fontSize: 38, fontWeight: 600, letterSpacing: 2, color, opacity: 0.85 }}>
      {handle}
    </div>
  );
}

// ─── Legenda cinética: revela palavra-por-palavra (movimento = retenção) ───────
//
// ⛔ 2026-08-11 — A CAPA DEIXOU DE ENTRAR PALAVRA A PALAVRA (`inteiroDeInicio`).
// O que estava medido no Dr. Liberdade: **12,4% continuaram assistindo** no canal BR,
// contra 70% da referência estudada. A causa apareceu quadro a quadro: no segundo 0 a tela
// não trazia mensagem nenhuma (só marca e @), a frase ia se formando e só ficava inteira no
// **3º segundo** — e a pessoa decide no primeiro. Em feed de deslizar, tela que começa muda
// é tela que ninguém espera terminar.
//
// A revelação cinética foi decidida contra um problema DIFERENTE: a capa parada, que fazia
// sair DURANTE a capa. Ela resolveu aquilo e criou este. Agora a capa nasce inteira e o
// movimento continua — o fundo respira e a barra do cabeçalho cresce. Os INSIGHTS seguem
// palavra a palavra: lá a pessoa já está dentro, e é a voz que manda no ritmo.
function KineticText({
  text,
  accent,
  accentColor,
  startFrame = 3,
  perWord = 3,
  fontSize = 88,
  wordFrames,
  inteiroDeInicio = false,
  maxWidth = REEL_LARGURA_UTIL,
}: {
  text: string;
  accent: string;
  accentColor: string;
  startFrame?: number;
  perWord?: number;
  fontSize?: number;
  // Frame (relativo à cena) em que CADA palavra é realmente falada. Quando vem, a
  // legenda acende no ritmo da voz. Ausente/incompleto → ritmo fixo de sempre.
  wordFrames?: number[];
  /** Frase legível no PRIMEIRO quadro: nenhuma palavra nasce apagada. */
  inteiroDeInicio?: boolean;
  maxWidth?: number;
}) {
  const frame = useCurrentFrame();
  const words = (text || "").split(" ");
  const timed = !inteiroDeInicio && Array.isArray(wordFrames) && wordFrames.length === words.length;
  const clean = (w: string) => w.toLowerCase().replace(/[.,;:!?¿¡"']/g, "");
  return (
    <div style={{ fontFamily: FRAUNCES, fontWeight: 800, fontSize, lineHeight: 1.12, color: WHITE, textShadow: "0 2px 28px rgba(0,0,0,0.55)", maxWidth }}>
      {words.map((w, i) => {
        const f0 = timed ? wordFrames![i] : startFrame + i * perWord;
        const o = inteiroDeInicio
          ? 1
          : interpolate(frame, [f0, f0 + 7], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const y = inteiroDeInicio
          ? 0
          : interpolate(frame, [f0, f0 + 7], [18, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        // ⛔ 2026-08-11 — PEDAÇO NÃO BASTA: com `includes`, o destaque "pe" acendia
        // "o**pe**ração" e meia manchete saía em vermelho na peça real. Casa por PREFIXO e
        // só a partir de 4 letras — assim "liberdade" ainda pega "liberdades" (plural),
        // mas duas letras soltas não acendem palavra nenhuma.
        const a = (accent || "").toLowerCase();
        const p = clean(w);
        const isAccent = a.length >= 4 && p.length >= 4 && (p.startsWith(a) || a.startsWith(p));
        // ⛔ 2026-08-11 — A COR NASCE NO QUADRO 0. No DR a palavra-chave ACENDIA entre os
        // frames 6 e 16, para dar movimento à capa agora estática; o dono olhou o primeiro
        // quadro e disse *"no seu texto não tem cor"*. Medido: frame 0 com **0 pixel** na cor
        // da marca, frame 15 com 10.569. O quadro 0 é o que o Instagram usa de capa e é o
        // que decide se a pessoa fica — ele não pode ser uma versão incompleta da peça.
        return (
          <span
            key={i}
            style={{ display: "inline-block", opacity: o, transform: `translateY(${y}px)`, color: isAccent ? accentColor : WHITE, marginRight: "0.26em" }}
          >
            {w}
          </span>
        );
      })}
    </div>
  );
}

// Palavra de realce da CAPA: o kw da marca se aparece no título; senão a última
// palavra (a "essência" costuma cair no fim da frase). Vai na cor de acento.
// ⛔ 2026-08-11 — DUAS PALAVRAS SAÍRAM EM VERMELHO NA PEÇA REAL. O primeiro Reel rodado com
// o motor novo trouxe a manchete «25 PRESOS EM OPERAÇÃO CONTRA TRÁFICO EM PE.» e pintou
// **"OPERAÇÃO" e "PE."**. A causa: a última palavra virava o destaque sem nenhuma trava de
// tamanho, e a comparação era por PEDAÇO — com destaque `"pe"`, `"operação"` casa
// (o-**pe**-ração). Palavra de 1–2 letras acende meia frase.
//
// Duas correções, e as duas importam:
//   · **tamanho mínimo também para a última palavra** (a guarda de 3 letras só existia para
//     o `kw`) — "PE.", "EM", "DO" nunca viram destaque;
//   · **casar palavra INTEIRA**, não pedaço. O `kw` continua podendo casar por prefixo
//     (é assim que "LIBERTAD" acha "liberdade"), mas só a partir de 4 letras, que é onde
//     prefixo deixa de ser coincidência de letras.
// Sem destaque adequado, devolve vazio: a frase sai toda branca — o que é correto e limpo,
// nunca meia frase acesa.
function pickCoverAccent(title: string, kw: string): string {
  const words = (title || "").split(/\s+/).filter(Boolean);
  const strip = (w: string) => w.toLowerCase().replace(/[^\p{L}]/gu, "");
  const k = strip(kw);
  if (k.length >= 4) {
    const m = words.find((w) => strip(w).startsWith(k) || k.startsWith(strip(w)));
    if (m && strip(m).length >= 4) return strip(m);
  }
  const ultima = strip(words[words.length - 1] || "");
  return ultima.length >= 4 ? ultima : "";
}

// ─── Capa V2: a frase inteira desde o quadro 0 + identidade de marca ──────────
function CoverTextV2({ title, accent, brand, handle, kw, ed, wordFrames }: { title: string; accent: string; brand: string; handle: string; kw: string; ed?: string | number | null; wordFrames?: number[] }) {
  const frame = useCurrentFrame();
  const coverAccent = pickCoverAccent(title, kw);
  // Nasce em 1 (não em 0): a identidade tem de estar no PRIMEIRO quadro, que é o que o
  // Instagram usa de capa no grid. O movimento fica por conta da barra, que cresce.
  const kickerO = 1;
  const barW = interpolate(frame, [0, 12], [42, 96], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  // ⛔ 2026-08-11 — MANCHETE EM CAIXA ALTA, no corpo que ENCHE a largura útil (o corpo era
  // fixo em 108: frase curta saía minúscula e frase longa estourava). Caixa alta é a forma
  // do jornal satírico desta marca — a mesma manchete que o carrossel carimba.
  const manchete = (title || "").toUpperCase();
  const fontSize = tamanhoManchete(manchete, medirFraunces);
  const etiqueta = selo(ed);
  return (
    <AbsoluteFill>
      {/* Glow do acento atrás do texto → profundidade de marca */}
      <AbsoluteFill style={{ background: `radial-gradient(60% 38% at 26% 78%, ${accent}38 0%, rgba(0,0,0,0) 70%)` }} />
      {/* Cabeçalho: a marca + a ETIQUETA da série logo abaixo, sempre na cor da marca */}
      <div style={{ position: "absolute", top: SAFE_TOP, left: REEL_MARGEM_LATERAL, opacity: kickerO }}>
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <div style={{ width: barW, height: 7, backgroundColor: MARCA, borderRadius: 4 }} />
          <div style={{ fontFamily: FRAUNCES, fontSize: 36, fontWeight: 700, letterSpacing: 5, color: PAPER }}>
            {brand.toUpperCase()}
          </div>
        </div>
        {/* ⛔ 2026-08-11 — «coloque o nome da série em um quadrado vermelho»: o selo virou
            ETIQUETA sólida. Sem série batizada (ver `src/lib/serie.ts`), ela carrega só o
            Nº da edição; nome vazio E sem número → nenhuma etiqueta é pintada. */}
        {etiqueta ? (
          <div style={{ marginTop: 16, marginLeft: 118, display: "inline-block", backgroundColor: MARCA, borderRadius: 6, padding: "12px 22px", boxShadow: "0 4px 18px rgba(0,0,0,0.45)" }}>
            <div style={{ fontFamily: FRAUNCES, fontSize: 30, fontWeight: 700, letterSpacing: 4, color: PAPER, whiteSpace: "nowrap" }}>
              {etiqueta}
            </div>
          </div>
        ) : null}
      </div>
      {/* A manchete inteira, ancorada EMBAIXO como a do carrossel — no grid do perfil, Reel
          com texto no alto destoa dos vizinhos. */}
      <div style={{ position: "absolute", bottom: REEL_TEXTO_BOTTOM, left: REEL_MARGEM_LATERAL, width: REEL_LARGURA_UTIL, maxHeight: REEL_ALTURA_MANCHETE, display: "flex", alignItems: "flex-end", justifyContent: "flex-start" }}>
        <KineticText text={manchete} accent={coverAccent} accentColor={MARCA} fontSize={fontSize} inteiroDeInicio wordFrames={wordFrames} />
      </div>
      <div style={{ position: "absolute", bottom: SAFE_BOTTOM_HANDLE, left: REEL_MARGEM_LATERAL }}>
        <Handle color={PAPER} handle={handle} />
      </div>
    </AbsoluteFill>
  );
}

// ─── Insight V2: legenda cinética ──────────────────────────────────────────────
function InsightTextV2({ text, accent, accentColor, index, total, handle, wordFrames }: { text: string; accent: string; accentColor: string; index: number; total: number; handle: string; wordFrames?: number[] }) {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [0, 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", top: SAFE_TOP, left: REEL_MARGEM_LATERAL, fontFamily: FRAUNCES, fontSize: 40, fontWeight: 700, color: PAPER, opacity: o }}>
        {String(index).padStart(2, "0")} / {String(total).padStart(2, "0")}
      </div>
      {/* Mesma âncora e mesma largura útil da capa — a peça inteira tem de ter uma cara só.
          Aqui o texto SEGUE entrando palavra a palavra: quem chegou até o insight já
          decidiu ficar, e é a voz que dá o ritmo. */}
      <div style={{ position: "absolute", bottom: REEL_TEXTO_BOTTOM, left: REEL_MARGEM_LATERAL, width: REEL_LARGURA_UTIL, maxHeight: REEL_ALTURA_MANCHETE, display: "flex", alignItems: "flex-end", justifyContent: "flex-start" }}>
        <KineticText text={text} accent={accent} accentColor={accentColor} startFrame={3} perWord={3} fontSize={tamanhoInsight(text, medirFraunces)} wordFrames={wordFrames} />
      </div>
      <div style={{ position: "absolute", bottom: SAFE_BOTTOM_HANDLE, left: REEL_MARGEM_LATERAL }}>
        <Handle color={PAPER} handle={handle} />
      </div>
    </AbsoluteFill>
  );
}

// ─── CTA V2 (BR fixo — o UPM publica só em BR) ────────────────────────────────
function CtaTextV2({ cta, accent, handle }: { cta: string; accent: string; handle: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entry = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 30 });
  const scale = interpolate(entry, [0, 1], [0.85, 1]);
  const o = interpolate(entry, [0, 1], [0, 1]);
  const pulse = 1 + 0.02 * Math.sin((frame / fps) * Math.PI * 2);
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: "0 90px", textAlign: "center" }}>
      <div style={{ transform: `scale(${scale})`, opacity: o, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ width: 110, height: 8, backgroundColor: accent, marginBottom: 50, borderRadius: 4 }} />
        <div style={{ fontFamily: FRAUNCES, fontWeight: 800, fontSize: 92, lineHeight: 1.1, color: WHITE, textShadow: "0 2px 28px rgba(0,0,0,0.55)", transform: `scale(${pulse})` }}>
          Siga <span style={{ color: accent }}>{handle}</span>
        </div>
        <div style={{ marginTop: 50, fontFamily: FRAUNCES, fontWeight: 400, fontSize: 50, lineHeight: 1.3, color: PAPER, opacity: 0.92, maxWidth: 880, textShadow: "0 2px 20px rgba(0,0,0,0.55)" }}>
          {cta}
        </div>
        <div style={{ marginTop: 60, fontFamily: FRAUNCES, fontSize: 40, fontWeight: 600, letterSpacing: 2, color: accent }}>
          → Mais no link da bio
        </div>
      </div>
    </AbsoluteFill>
  );
}

// ─── Composição V2 ─────────────────────────────────────────────────────────────
export const ReelV2: React.FC<ReelProps> = (props) => {
  const {
    title, slides, accentWords, cta, kw, ed, img, clips, clip, music, narrationUrl, cat,
    handle = "@umpaisdemerda", brand = "Um País de Merda",
  } = props;
  const accent = CAT_ACCENT[cat ?? "freedom"] ?? RED;
  // PLANO DE TEMPOS (mesma função do Root.calculateMetadata → duração e cenas
  // nunca divergem). Com voz medida, o áudio é o relógio; sem ela, a fórmula.
  const plan = reelPlanV2(props);
  const { scenes, wordFrames, usedSlides, n, total } = plan;

  const pool = clips && clips.length ? clips : clip ? [clip] : [];
  const sceneClip = (i: number) => (pool.length ? pool[i % pool.length] : undefined);

  // Cenas na ordem: capa (0), insights (1..n), cta (n+1).
  const at = (i: number) => scenes[i] ?? { fromFrame: 0, durationInFrames: 1 };
  const COVER_S = at(0);
  const CTA_S = at(n + 1);

  const musicSrc = music ? (/^https?:\/\//.test(music) ? music : staticFile(music)) : null;
  // Narração (voz) por cima; quando há narração, a música (se houver) vira leito suave.
  const narrationSrc = narrationUrl ? (/^https?:\/\//.test(narrationUrl) ? narrationUrl : staticFile(narrationUrl)) : null;
  // ⛔ 2026-08-11 — A VOZ ESTAVA NO VÍDEO E NINGUÉM OUVIA. No Dr. Liberdade o dono ouviu a
  // peça e disse "sem voz gravada"; a voz estava lá, gerada e misturada. O que faltava era
  // ESPAÇO: medido na faixa em que a fala vive (300–3000 Hz), a voz sozinha dava −27,1 dB e
  // a MISTURA dava −30,1 — mais baixa que a voz sozinha, ou seja, a cama musical ocupava
  // exatamente a mesma faixa e mascarava a fala em vez de ficar embaixo dela.
  // A cama cai de 0,16 para 0,07 quando há voz, e a voz passa a ir com um reforço leve.
  // O 0,16 vinha da época em que a peça era só música com voz por cima em trechos curtos.
  const musicMax = narrationSrc ? 0.07 : 0.7;
  // Reforço da fala: mantém a voz claramente ACIMA da cama sem estourar (os picos do
  // arquivo de voz ficam bem abaixo do teto, então 1,5× ainda não chega lá).
  const VOZ_GANHO = 1.5;
  // ⛔ 2026-08-11 — O VOLUME DA MÚSICA SEGUE O RELÓGIO DA PEÇA, NÃO O DA TRILHA.
  // Este `useCurrentFrame` no corpo do componente existe por um motivo exato: o callback
  // `volume={(f) => …}` do `<Audio>` recebe o frame **relativo ao áudio**, e com `loop`
  // esse frame VOLTA A ZERO a cada repetição. Medido no DR: com o loop ligado e a curva no
  // callback, o fecho ganhou um buraco de 3 s mudo aos 25–27 s e o som "renascia" aos 28 s
  // com o fade de abertura outra vez. Lendo o frame da COMPOSIÇÃO, a curva é uma só: sobe
  // no início, segura, e só desce no fim de verdade.
  const frameDaPeca = useCurrentFrame();
  const musicVol = interpolate(frameDaPeca, [0, 15, total - 24, total], [0, musicMax, musicMax, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  let sceneIdx = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: "#0B0B0C" }}>
      <Sequence from={COVER_S.fromFrame} durationInFrames={COVER_S.durationInFrames}>
        <Scene clip={sceneClip(sceneIdx++)} img={img} kw={kw} accent={accent} dur={COVER_S.durationInFrames}>
          <CoverTextV2 title={title} accent={accent} brand={brand} handle={handle} kw={kw} ed={ed} wordFrames={wordFrames[0]} />
        </Scene>
      </Sequence>

      {usedSlides.map((text, i) => {
        const s = at(i + 1);
        return (
          <Sequence key={i} from={s.fromFrame} durationInFrames={s.durationInFrames}>
            <Scene clip={sceneClip(sceneIdx++)} img={img} kw={kw} accent={accent} dur={s.durationInFrames}>
              <InsightTextV2 text={text} accent={accentWords?.[i] ?? ""} accentColor={accent} index={i + 1} total={n} handle={handle} wordFrames={wordFrames[i + 1]} />
            </Scene>
          </Sequence>
        );
      })}

      <Sequence from={CTA_S.fromFrame} durationInFrames={CTA_S.durationInFrames}>
        <Scene clip={sceneClip(sceneIdx++)} img={img} kw={kw} accent={accent} dur={CTA_S.durationInFrames}>
          <CtaTextV2 cta={cta} accent={accent} handle={handle} />
        </Scene>
      </Sequence>

      {/* ⛔ 2026-08-11 — O ÁUDIO MORRIA ANTES DO FIM (no DR o dono ouviu: "áudio quebra").
          Medido no Reel publicado de lá: o som caía de −17 dB para −85 dB aos ~27 s com o
          vídeo terminando aos 30,6 s — **2,6 segundos mudos** em cima do convite. A causa
          não é o fade: **toda trilha do acervo tem exatamente 28,000 s** e a peça passou
          disso quando o fecho falado entrou. Aqui vale igual — o UPM usa o mesmo acervo e
          também ganhou fecho falado (29/07). Com `loop`, a cama recomeça e cobre qualquer
          duração; o fade final continua sendo o da interpolação acima. */}
      {musicSrc && <Audio src={musicSrc} loop volume={musicVol} />}
      {/* Narração em volume cheio, do frame 0 — é ela que dita o vídeo. As cenas
          acima já começam nos frames em que a voz vira de frase. */}
      {narrationSrc && <Audio src={narrationSrc} volume={VOZ_GANHO} />}
    </AbsoluteFill>
  );
};
