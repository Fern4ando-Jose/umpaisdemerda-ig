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

const { fontFamily: FRAUNCES } = loadFraunces();

const PAPER = "#F4F0E8";
const WHITE = "#ffffff";
const RED = "#A45A5A";
const SAFE_TOP = 340;
const SAFE_BOTTOM_TEXT = 420;
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
function KineticText({
  text,
  accent,
  accentColor,
  startFrame = 3,
  perWord = 3,
  fontSize = 88,
  wordFrames,
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
}) {
  const frame = useCurrentFrame();
  const words = (text || "").split(" ");
  const timed = Array.isArray(wordFrames) && wordFrames.length === words.length;
  const clean = (w: string) => w.toLowerCase().replace(/[.,;:!?¿¡"']/g, "");
  return (
    <div style={{ fontFamily: FRAUNCES, fontWeight: 800, fontSize, lineHeight: 1.12, color: WHITE, textShadow: "0 2px 28px rgba(0,0,0,0.55)", maxWidth: 920 }}>
      {words.map((w, i) => {
        const f0 = timed ? wordFrames![i] : startFrame + i * perWord;
        const o = interpolate(frame, [f0, f0 + 7], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const y = interpolate(frame, [f0, f0 + 7], [18, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const isAccent = !!accent && clean(w).includes(accent.toLowerCase());
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
function pickCoverAccent(title: string, kw: string): string {
  const words = (title || "").split(/\s+/).filter(Boolean);
  const strip = (w: string) => w.toLowerCase().replace(/[^\p{L}]/gu, "");
  if (kw) {
    const m = words.find((w) => strip(w).includes(strip(kw)) && strip(kw).length > 2);
    if (m) return strip(m);
  }
  return strip(words[words.length - 1] || "");
}

// ─── Capa V2: gancho cinético + identidade de marca ───────────────────────────
function CoverTextV2({ title, accent, brand, handle, kw, wordFrames }: { title: string; accent: string; brand: string; handle: string; kw: string; wordFrames?: number[] }) {
  const frame = useCurrentFrame();
  const coverAccent = pickCoverAccent(title, kw);
  const kickerO = interpolate(frame, [1, 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const barW = interpolate(frame, [2, 14], [0, 96], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill>
      {/* Glow do acento atrás do texto → profundidade de marca */}
      <AbsoluteFill style={{ background: `radial-gradient(60% 38% at 26% 78%, ${accent}38 0%, rgba(0,0,0,0) 70%)` }} />
      {/* Kicker da marca no topo, em cor de acento */}
      <div style={{ position: "absolute", top: SAFE_TOP, left: 90, display: "flex", alignItems: "center", gap: 22, opacity: kickerO }}>
        <div style={{ width: barW, height: 7, backgroundColor: accent, borderRadius: 4 }} />
        <div style={{ fontFamily: FRAUNCES, fontSize: 36, fontWeight: 700, letterSpacing: 5, color: accent }}>
          {brand.toUpperCase()}
        </div>
      </div>
      <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "flex-start", padding: `0 90px ${SAFE_BOTTOM_TEXT}px` }}>
        <KineticText text={title} accent={coverAccent} accentColor={accent} startFrame={3} perWord={2} fontSize={108} wordFrames={wordFrames} />
      </AbsoluteFill>
      <div style={{ position: "absolute", bottom: SAFE_BOTTOM_HANDLE, left: 90 }}>
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
      <div style={{ position: "absolute", top: SAFE_TOP, left: 90, fontFamily: FRAUNCES, fontSize: 40, fontWeight: 700, color: accentColor, opacity: o }}>
        {String(index).padStart(2, "0")} / {String(total).padStart(2, "0")}
      </div>
      <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "flex-start", padding: `0 90px ${SAFE_BOTTOM_TEXT}px` }}>
        <KineticText text={text} accent={accent} accentColor={accentColor} startFrame={3} perWord={3} wordFrames={wordFrames} />
      </AbsoluteFill>
      <div style={{ position: "absolute", bottom: SAFE_BOTTOM_HANDLE, left: 90 }}>
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
    title, slides, accentWords, cta, kw, img, clips, clip, music, narrationUrl, cat,
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
  const musicMax = narrationSrc ? 0.16 : 0.7;
  let sceneIdx = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: "#0B0B0C" }}>
      <Sequence from={COVER_S.fromFrame} durationInFrames={COVER_S.durationInFrames}>
        <Scene clip={sceneClip(sceneIdx++)} img={img} kw={kw} accent={accent} dur={COVER_S.durationInFrames}>
          <CoverTextV2 title={title} accent={accent} brand={brand} handle={handle} kw={kw} wordFrames={wordFrames[0]} />
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

      {musicSrc && (
        <Audio
          src={musicSrc}
          volume={(f) =>
            interpolate(f, [0, 15, total - 24, total], [0, musicMax, musicMax, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
          }
        />
      )}
      {/* Narração em volume cheio, do frame 0 — é ela que dita o vídeo. As cenas
          acima já começam nos frames em que a voz vira de frase. */}
      {narrationSrc && <Audio src={narrationSrc} />}
    </AbsoluteFill>
  );
};
