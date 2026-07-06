// ─── Composição do Reel Dr. Libertad ─────────────────────────────────────────
// Vídeo vertical 1080x1920 (9:16), 30fps. Régua: "vídeo de verdade, não slide
// animado". O fundo é FOOTAGE REAL (vídeo filmado de banco / Pexels), um clipe
// por cena (2-3 cenas distintas), com COLOR GRADE da marca por cima p/ unificar
// (duotone ink/paper dessaturado + acento da categoria). O texto entra mínimo,
// como camada. Footage = movimento real + custo zero.
//
// Camadas por cena (de baixo p/ cima):
//   1. Footage graded  → <OffthreadVideo> do clipe, cover-crop 9:16, push-in lento
//      + filtro (dessatura/contraste) + wash do acento. Fallback: ilustração
//      estática → watermark.
//   2. Scrim           → contraste do texto.
//   3. Grão + vinheta  → textura da marca.
//   4. Texto           → Capa (gancho) → Insight(s) → CTA. Mínimo.
//   5. Música          → trilha royalty-free opcional (prop `music`).

import React from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont as loadFraunces } from "@remotion/google-fonts/Fraunces";

const { fontFamily: FRAUNCES } = loadFraunces();

// ─── Cores da marca (espelham /api/og) ────────────────────────────────────────
const INK = "#0B0B0C";
const PAPER = "#F4F0E8";
const WHITE = "#ffffff";
const RED = "#A45A5A"; // acento default (freedom)

const CAT_ACCENT: Record<string, string> = {
  freedom: "#A45A5A",
  dopamine: "#BE7A2A",
  anxiety: "#3D6360",
  network: "#3F5E78",
  self: "#835A6E",
  mind: "#5B6B3C",
};

// Scrim sobre o footage — escurece topo e (forte) a base, onde mora o texto.
const SCRIM =
  "linear-gradient(180deg, rgba(11,11,12,0.58) 0%, rgba(11,11,12,0.20) 30%, rgba(11,11,12,0.22) 58%, rgba(11,11,12,0.90) 100%)";

// ─── Grade cinematográfica QUENTE/VINTAGE (padrão de marca em todo footage) ───
// Restaura e UNIFICA a cara editorial/cine que o footage bom já tinha — tons
// antigos, quentes, puxando pro âmbar/vermelho, matte e profundos. (A 1ª versão
// em grayscale+creme clareou demais e matou a cor — revertida.) Normaliza
// qualquer clipe do Pexels na MESMA faixa tonal quente:
//   1. vídeo → cor PARCIAL + sépia (calor garantido) + escuro (mood);
//   2. screen(PISO quente) → pretos viram marrom profundo (matte vintage; nunca
//      cinza lavado, nunca preto puro);
//   3. multiply(LUZ âmbar) → luzes viram dourado quente (sem estourar);
//   4. soft-light(WASH quente) → base sempre quente, coesa mesmo em clipe frio;
//   5. soft-light(acento) → cor da categoria por cima.
const GRADE_FILTER = "saturate(0.5) contrast(1.1) brightness(0.95) sepia(0.2)";
const DUO_FLOOR = "#1F1A18";      // piso levemente quente (marrom-neutro — matte, sem laranja)
const DUO_HIGHLIGHT = "#ECDCC4";  // teto creme quente suave (entre creme e âmbar)
const WARM_WASH = "#5A4636";      // unificador quente discreto (marrom-neutro, não vermelho)

// ─── Zona segura do FEED do Instagram ─────────────────────────────────────────
// O Reel é 1080×1920 (9:16), mas o FEED mostra um recorte CENTRADO 4:5 (1080×1350)
// → faixa visível y ∈ [285, 1635]. Texto ancorado no rodapé (como antes, y≈1770)
// era CORTADO no feed (a 3ª linha do título sumia). Mantemos todo texto crítico
// dentro da faixa: cabeçalho em SAFE_TOP, bloco de texto subido (padding-bottom
// SAFE_BOTTOM_TEXT) e @ logo acima da borda inferior do recorte. No player cheio
// (aba Reels) continua tudo visível; o que muda é só não ser comido pelo feed.
const SAFE_TOP = 340;          // topo do recorte 4:5 (285) + margem
const SAFE_BOTTOM_TEXT = 420;  // bloco de texto termina em y≈1500 (< 1635)
const SAFE_BOTTOM_HANDLE = 300; // @ em y≈1620, logo acima da borda do recorte

// ─── Tempos (fonte única; Root.tsx importa reelDurations) ─────────────────────
export const FPS = 30;

// Até 3 insights entre capa e CTA → Reel mais LONGO e com mais cenas (decisão do
// dono: ~25s p/ casar com a música de ~28s; antes eram só 2 insights/~20s e o
// vídeo parecia curto). Capa 5s + 3×5,2s + CTA 4,6s ≈ 25,2s. Com 3 insights são
// 5 cenas (capa + 3 + CTA) → 5 clipes de footage distintos (ver FOOTAGE_NUM_CLIPS).
export function reelDurations(slidesCount: number) {
  const COVER = Math.round(FPS * 5.0);
  const INSIGHT = Math.round(FPS * 5.2);
  const CTA = Math.round(FPS * 4.6);
  const n = Math.min(Math.max(slidesCount || 1, 1), 3);
  return { COVER, INSIGHT, CTA, n, total: COVER + INSIGHT * n + CTA };
}

// ─── Props de entrada (inputProps) ────────────────────────────────────────────
export type ReelProps = {
  title: string; // gancho da capa
  slides: string[]; // frases dos insights (usamos só as 2 primeiras)
  accentWords: string[]; // palavra de destaque por insight (pode vir vazio)
  cta: string; // pergunta/chamada (cena final)
  kw: string; // keyword curta — watermark gigante (fallback sem mídia)
  ed: string; // número da edição (ex.: "012")
  img?: string; // URL da ilustração estática (fallback do fundo)
  clips?: string[]; // URLs de footage (Pexels) — 1 por cena (preferido)
  clip?: string; // compat: 1 clipe único (i2v antigo) — fallback se não houver clips
  music?: string; // caminho staticFile (ex.: "music/bed.mp3") ou URL — opcional
  cat?: string; // categoria → cor de acento
  handle?: string; // @ da conta por idioma (ex.: "@dr.liberdad" | "@dr.liberdade.br")
  brand?: string; // nome de exibição (ex.: "Dr. Libertad" | "Dr. Liberdade")
};

export const reelDefaultProps: ReelProps = {
  title: "A liberdade começa onde o automático termina",
  slides: [
    "O algoritmo decide por você quando você não decide",
    "Atenção é a moeda; recupere o controle dela",
  ],
  accentWords: ["liberdade", "controle"],
  cta: "O que mais rouba a sua atenção hoje?",
  kw: "LIBERTAD",
  ed: "001",
  img: undefined,
  clips: undefined,
  clip: undefined,
  music: undefined,
  cat: "freedom",
  handle: "@dr.liberdad",
  brand: "Dr. Libertad",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Highlighted({ text, accent, color }: { text: string; accent: string; color: string }) {
  if (!accent) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(accent.toLowerCase());
  if (idx === -1) return <>{text}</>;
  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + accent.length);
  const after = text.slice(idx + accent.length);
  return (
    <>
      {before}
      <span style={{ color }}>{match}</span>
      {after}
    </>
  );
}

function Handle({ color = PAPER, handle = "@dr.liberdad" }: { color?: string; handle?: string }) {
  return (
    <div style={{ fontFamily: FRAUNCES, fontSize: 38, fontWeight: 600, letterSpacing: 2, color, opacity: 0.85 }}>
      {handle}
    </div>
  );
}

// Grão de filme + vinheta — textura sutil da marca por cima do footage.
function Texture() {
  return (
    <>
      <AbsoluteFill
        style={{ background: "radial-gradient(120% 80% at 50% 42%, rgba(0,0,0,0) 52%, rgba(11,11,12,0.5) 100%)" }}
      />
      <AbsoluteFill style={{ opacity: 0.07, mixBlendMode: "overlay" }}>
        <svg width="100%" height="100%">
          <filter id="reelGrain">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#reelGrain)" />
        </svg>
      </AbsoluteFill>
    </>
  );
}

// ─── Fundo graded de UMA cena ─────────────────────────────────────────────────
// Footage (preferido) → ilustração estática → watermark. Push-in lento + grade
// da marca (dessatura no vídeo + wash do acento) p/ unificar clipes diversos.
function SceneBg({
  clip,
  img,
  kw,
  accent,
  dur,
}: {
  clip?: string;
  img?: string;
  kw: string;
  accent: string;
  dur: number;
}) {
  const frame = useCurrentFrame();
  const zoom = interpolate(frame, [0, dur], [1.06, 1.16], { extrapolateRight: "clamp" });
  const driftX = interpolate(frame, [0, dur], [0, -28], { extrapolateRight: "clamp" });

  if (clip) {
    // isolation: isolate → os mix-blend abaixo se combinam SÓ entre si (duotone
    // fechado), sem vazar pro resto da cena. Ordem importa: grayscale → screen
    // (piso) → multiply (teto) → soft-light (acento).
    return (
      <AbsoluteFill style={{ backgroundColor: DUO_FLOOR, overflow: "hidden", isolation: "isolate" }}>
        <AbsoluteFill style={{ transform: `scale(${zoom}) translateX(${driftX}px)` }}>
          <OffthreadVideo
            src={clip}
            muted
            style={{ width: "100%", height: "100%", objectFit: "cover", filter: GRADE_FILTER }}
          />
        </AbsoluteFill>
        {/* PISO quente: screen com marrom escuro — pretos viram matte vintage
            (clipe escuro deixa de virar preto; sombras coesas e QUENTES, não cinza) */}
        <AbsoluteFill style={{ backgroundColor: DUO_FLOOR, mixBlendMode: "screen" }} />
        {/* TETO âmbar: multiply — luzes viram dourado quente (clipe claro não estoura;
            luzes coesas) → exposição igual clipe a clipe, com calor de filme antigo */}
        <AbsoluteFill style={{ backgroundColor: DUO_HIGHLIGHT, mixBlendMode: "multiply" }} />
        {/* WASH quente global — garante o tom 'antigo/quente' mesmo em clipe frio */}
        <AbsoluteFill style={{ backgroundColor: WARM_WASH, opacity: 0.16, mixBlendMode: "soft-light" }} />
        {/* ACENTO da categoria por cima — cor de marca */}
        <AbsoluteFill style={{ backgroundColor: accent, opacity: 0.18, mixBlendMode: "soft-light" }} />
      </AbsoluteFill>
    );
  }

  if (img) {
    return (
      <AbsoluteFill style={{ backgroundColor: INK, overflow: "hidden" }}>
        <AbsoluteFill style={{ transform: `scale(${zoom}) translateX(${driftX}px)` }}>
          <Img src={img} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }

  const drift = interpolate(frame, [0, dur], [-20, 20], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ backgroundColor: INK, justifyContent: "center", alignItems: "center" }}>
      <div
        style={{
          fontFamily: FRAUNCES,
          fontWeight: 900,
          fontSize: 320,
          color: accent,
          opacity: 0.14,
          whiteSpace: "nowrap",
          letterSpacing: -8,
          transform: `translateX(${drift}px) rotate(-8deg)`,
        }}
      >
        {kw}
      </div>
    </AbsoluteFill>
  );
}

// Envelope comum de cena: fundo graded + scrim + textura + conteúdo (texto).
function Scene({
  clip,
  img,
  kw,
  accent,
  dur,
  children,
}: {
  clip?: string;
  img?: string;
  kw: string;
  accent: string;
  dur: number;
  children: React.ReactNode;
}) {
  return (
    <AbsoluteFill>
      <SceneBg clip={clip} img={img} kw={kw} accent={accent} dur={dur} />
      <AbsoluteFill style={{ background: SCRIM }} />
      <Texture />
      {children}
    </AbsoluteFill>
  );
}

// ─── Texto: Capa ──────────────────────────────────────────────────────────────
function CoverText({ title, ed, accent, brand, handle }: { title: string; ed: string; accent: string; brand: string; handle: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // A3 = Opção A — o GANCHO é o scroll-stopper. Em vez de esmaecer por ~1s (metade
  // do público já saiu nos 3s iniciais), ele entra FORTE e quase IMEDIATO: cheio em
  // ~0,2s, com um "assentamento" rápido. Frame 0 segue com opacidade 0 → a CAPA do
  // grid continua só footage (preferência do dono); o ganho é no PLAY, na janela
  // crítica dos 3s. (Pesquisa: retenção de 3s > 60% = 5-10× mais alcance.)
  const o = interpolate(frame, [2, 7], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const settle = spring({ frame, fps, config: { damping: 200, stiffness: 240 }, durationInFrames: 12 });
  const y = interpolate(settle, [0, 1], [28, 0]);
  const scale = interpolate(settle, [0, 1], [1.04, 1]);
  return (
    <AbsoluteFill>
      <div
        style={{ position: "absolute", top: SAFE_TOP, left: 90, fontFamily: FRAUNCES, fontSize: 34, letterSpacing: 6, color: PAPER, opacity: 0.7 }}
      >
        {brand.toUpperCase()} · Nº {ed}
      </div>
      <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "flex-start", padding: `0 90px ${SAFE_BOTTOM_TEXT}px` }}>
        <div style={{ transform: `translateY(${y}px) scale(${scale})`, transformOrigin: "left bottom", opacity: o }}>
          <div style={{ width: 110, height: 8, backgroundColor: accent, marginBottom: 40, borderRadius: 4 }} />
          <div
            style={{ fontFamily: FRAUNCES, fontWeight: 800, fontSize: 100, lineHeight: 1.05, color: WHITE, textShadow: "0 2px 28px rgba(0,0,0,0.55)", maxWidth: 920 }}
          >
            {title}
          </div>
        </div>
      </AbsoluteFill>
      <div style={{ position: "absolute", bottom: SAFE_BOTTOM_HANDLE, left: 90 }}>
        <Handle color={PAPER} handle={handle} />
      </div>
    </AbsoluteFill>
  );
}

// ─── Texto: Insight ───────────────────────────────────────────────────────────
function InsightText({ text, accent, accentColor, index, total, handle }: { text: string; accent: string; accentColor: string; index: number; total: number; handle: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entry = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 26 });
  const x = interpolate(entry, [0, 1], [-50, 0]);
  const o = interpolate(entry, [0, 1], [0, 1]);
  return (
    <AbsoluteFill>
      <div
        style={{ position: "absolute", top: SAFE_TOP, left: 90, fontFamily: FRAUNCES, fontSize: 40, fontWeight: 700, color: accentColor, opacity: o }}
      >
        {String(index).padStart(2, "0")} / {String(total).padStart(2, "0")}
      </div>
      <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "flex-start", padding: `0 90px ${SAFE_BOTTOM_TEXT}px` }}>
        <div
          style={{ transform: `translateX(${x}px)`, opacity: o, fontFamily: FRAUNCES, fontWeight: 800, fontSize: 88, lineHeight: 1.12, color: WHITE, textShadow: "0 2px 28px rgba(0,0,0,0.55)", maxWidth: 920 }}
        >
          <Highlighted text={text} accent={accent} color={accentColor} />
        </div>
      </AbsoluteFill>
      <div style={{ position: "absolute", bottom: SAFE_BOTTOM_HANDLE, left: 90 }}>
        <Handle color={PAPER} handle={handle} />
      </div>
    </AbsoluteFill>
  );
}

// ─── Texto: CTA ───────────────────────────────────────────────────────────────
function CtaText({ cta, accent, handle }: { cta: string; accent: string; handle: string }) {
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
        <div
          style={{ fontFamily: FRAUNCES, fontWeight: 800, fontSize: 92, lineHeight: 1.1, color: WHITE, textShadow: "0 2px 28px rgba(0,0,0,0.55)", transform: `scale(${pulse})` }}
        >
          Siga <span style={{ color: accent }}>{handle}</span>
        </div>
        <div
          style={{ marginTop: 50, fontFamily: FRAUNCES, fontWeight: 400, fontSize: 50, lineHeight: 1.3, color: PAPER, opacity: 0.92, maxWidth: 880, textShadow: "0 2px 20px rgba(0,0,0,0.55)" }}
        >
          {cta}
        </div>
        <div style={{ marginTop: 60, fontFamily: FRAUNCES, fontSize: 40, fontWeight: 600, letterSpacing: 2, color: accent }}>
          → Mais no link da bio
        </div>
      </div>
    </AbsoluteFill>
  );
}

// ─── Composição completa ──────────────────────────────────────────────────────
export const Reel: React.FC<ReelProps> = ({ title, slides, accentWords, cta, kw, ed, img, clips, clip, music, cat, handle = "@dr.liberdad", brand = "Dr. Libertad" }) => {
  const accent = CAT_ACCENT[cat ?? "freedom"] ?? RED;
  const safeSlides = (slides && slides.length ? slides : reelDefaultProps.slides).slice(0, 3);
  const { COVER, INSIGHT, CTA, n, total } = reelDurations(safeSlides.length);
  const usedSlides = safeSlides.slice(0, n);

  // Pool de clipes de footage; cicla por cena. Fallback p/ clipe único / img.
  const pool = clips && clips.length ? clips : clip ? [clip] : [];
  const sceneClip = (i: number) => (pool.length ? pool[i % pool.length] : undefined);

  let cursor = 0;
  const next = (dur: number) => {
    const from = cursor;
    cursor += dur;
    return from;
  };

  const musicSrc = music ? (/^https?:\/\//.test(music) ? music : staticFile(music)) : null;
  let sceneIdx = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      <Sequence from={next(COVER)} durationInFrames={COVER}>
        <Scene clip={sceneClip(sceneIdx++)} img={img} kw={kw} accent={accent} dur={COVER}>
          <CoverText title={title} ed={ed} accent={accent} brand={brand} handle={handle} />
        </Scene>
      </Sequence>

      {usedSlides.map((text, i) => (
        <Sequence key={i} from={next(INSIGHT)} durationInFrames={INSIGHT}>
          <Scene clip={sceneClip(sceneIdx++)} img={img} kw={kw} accent={accent} dur={INSIGHT}>
            <InsightText text={text} accent={accentWords?.[i] ?? ""} accentColor={accent} index={i + 1} total={n} handle={handle} />
          </Scene>
        </Sequence>
      ))}

      <Sequence from={next(CTA)} durationInFrames={CTA}>
        <Scene clip={sceneClip(sceneIdx++)} img={img} kw={kw} accent={accent} dur={CTA}>
          <CtaText cta={cta} accent={accent} handle={handle} />
        </Scene>
      </Sequence>

      {musicSrc && (
        <Audio
          src={musicSrc}
          volume={(f) =>
            interpolate(f, [0, 15, total - 24, total], [0, 0.7, 0.7, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
          }
        />
      )}
    </AbsoluteFill>
  );
};
