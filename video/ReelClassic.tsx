// ─── Composição do Reel Dr. Libertad ─────────────────────────────────────────
// Vídeo vertical 1080x1920 (9:16), 30fps, com trilha opcional (prop `music`,
// uma faixa por tema — ver scripts/pick-music.cjs). Sequência de cenas:
//   1. Capa  → ilustração de IA (fal) full-bleed + scrim, gancho `title` (Fraunces)
//   2. Slides → fundo papel, número grande, palavra de destaque no acento da categoria
//   3. CTA   → "Siga @dr.liberdad" sobre INK
// Fonte: Fraunces (mesma da marca) via @remotion/google-fonts.
// Obs.: aqui o render roda no Chromium do CI (não no edge do /api/og), então
// carregar a fonte por google-fonts não infla o bundle edge — regra respeitada.

import React from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
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

// Acento por categoria — espelha CATS de /api/og.
const CAT_ACCENT: Record<string, string> = {
  freedom: "#A45A5A",
  dopamine: "#BE7A2A",
  anxiety: "#3D6360",
  network: "#3F5E78",
  self: "#835A6E",
  mind: "#5B6B3C",
};

// Scrim da capa sobre a ilustração (mesma ideia do /api/og, reforçado embaixo
// onde fica o título). Garante contraste do texto claro.
const COVER_SCRIM =
  "linear-gradient(180deg, rgba(11,11,12,0.35) 0%, rgba(11,11,12,0.12) 34%, rgba(11,11,12,0.92) 100%)";

// Zona segura do FEED (mesmo do Reel.tsx): o feed mostra recorte CENTRADO 4:5
// (y∈[285,1635]). Na CAPA, o título ancorado no rodapé era cortado → subimos
// cabeçalho/título/@ pra dentro da faixa. Slides e CTA já são centralizados (ok).
const SAFE_TOP = 340;
const SAFE_BOTTOM_TEXT = 420;
const SAFE_BOTTOM_HANDLE = 300;

// ─── Props de entrada (inputProps) ────────────────────────────────────────────
// type (não interface) para satisfazer o constraint do Remotion Composition.
export type ReelClassicProps = {
  title: string; // gancho da capa
  slides: string[]; // frases dos slides internos
  accentWords: string[]; // palavra de destaque por slide (pode vir vazio)
  cta: string; // pergunta/chamada (cena final)
  kw: string; // keyword curta — watermark gigante (quando não há ilustração)
  ed: string; // número da edição (ex.: "012")
  img?: string; // URL da ilustração de IA (fundo da capa)
  cat?: string; // categoria → cor de acento
  handle?: string; // @ da conta por idioma
  brand?: string; // nome de exibição (Dr. Libertad | Dr. Liberdade)
  music?: string; // caminho staticFile ("music/bed-..mp3") ou URL — trilha opcional
};

export const reelClassicDefaultProps: ReelClassicProps = {
  title: "A liberdade começa onde o automático termina",
  slides: [
    "O algoritmo decide por você quando você não decide",
    "Atenção é a moeda; recupere o controle dela",
    "Liberdade mental é hábito, não sorte",
  ],
  accentWords: ["liberdade", "controle", "hábito"],
  cta: "O que mais rouba a sua atenção hoje?",
  kw: "LIBERTAD",
  ed: "001",
  img: undefined,
  cat: "freedom",
  handle: "@dr.liberdad",
  brand: "Dr. Libertad",
  music: undefined,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Realça `accent` dentro de `text` pintando-a na cor de destaque.
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

// Assinatura (handle) usada nos rodapés
function Handle({ color = INK, handle = "@dr.liberdad" }: { color?: string; handle?: string }) {
  return (
    <div
      style={{
        fontFamily: FRAUNCES,
        fontSize: 38,
        fontWeight: 600,
        letterSpacing: 2,
        color,
        opacity: 0.85,
      }}
    >
      {handle}
    </div>
  );
}

// ─── Cena 1 — Capa ────────────────────────────────────────────────────────────
function CoverScene({ title, kw, ed, img, accent, brand, handle }: { title: string; kw: string; ed: string; img?: string; accent: string; brand: string; handle: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entry = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 30 });
  const titleY = interpolate(entry, [0, 1], [60, 0]);
  const titleOpacity = interpolate(entry, [0, 1], [0, 1]);

  // Zoom lento ("Ken Burns") na ilustração
  const zoom = interpolate(frame, [0, 90], [1.06, 1.12], { extrapolateRight: "clamp" });
  // Drift do watermark (só quando não há ilustração)
  const drift = interpolate(frame, [0, 90], [-20, 20], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      {img ? (
        <>
          <AbsoluteFill style={{ transform: `scale(${zoom})` }}>
            <Img src={img} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </AbsoluteFill>
          <AbsoluteFill style={{ background: COVER_SCRIM }} />
        </>
      ) : (
        // Sem ilustração: watermark gigante translúcido no acento
        <AbsoluteFill
          style={{
            justifyContent: "center",
            alignItems: "center",
            transform: `translateX(${drift}px) rotate(-8deg)`,
          }}
        >
          <div
            style={{
              fontFamily: FRAUNCES,
              fontWeight: 900,
              fontSize: 320,
              color: accent,
              opacity: 0.14,
              whiteSpace: "nowrap",
              letterSpacing: -8,
            }}
          >
            {kw}
          </div>
        </AbsoluteFill>
      )}

      {/* Cabeçalho: edição */}
      <div
        style={{
          position: "absolute",
          top: SAFE_TOP,
          left: 90,
          fontFamily: FRAUNCES,
          fontSize: 34,
          letterSpacing: 6,
          color: PAPER,
          opacity: 0.7,
        }}
      >
        {brand.toUpperCase()} · Nº {ed}
      </div>

      {/* Título/gancho — na zona segura do feed (não ancorar no rodapé, que é cortado) */}
      <AbsoluteFill
        style={{
          justifyContent: "flex-end",
          alignItems: "flex-start",
          padding: `0 90px ${SAFE_BOTTOM_TEXT}px`,
        }}
      >
        <div style={{ transform: `translateY(${titleY}px)`, opacity: titleOpacity }}>
          <div style={{ width: 110, height: 8, backgroundColor: accent, marginBottom: 40, borderRadius: 4 }} />
          <div
            style={{
              fontFamily: FRAUNCES,
              fontWeight: 800,
              fontSize: 104,
              lineHeight: 1.05,
              color: WHITE,
              textShadow: "0 2px 24px rgba(0,0,0,0.45)",
            }}
          >
            {title}
          </div>
        </div>
      </AbsoluteFill>

      {/* Rodapé com handle */}
      <div style={{ position: "absolute", bottom: SAFE_BOTTOM_HANDLE, left: 90 }}>
        <Handle color={PAPER} handle={handle} />
      </div>
    </AbsoluteFill>
  );
}

// ─── Cena de slide (insight) ──────────────────────────────────────────────────
function SlideScene({
  text,
  accent,
  accentColor,
  index,
  total,
  handle,
}: {
  text: string;
  accent: string;
  accentColor: string;
  index: number;
  total: number;
  handle: string;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const numEntry = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 25 });
  const numScale = interpolate(numEntry, [0, 1], [0.6, 1]);
  const numOpacity = interpolate(numEntry, [0, 1], [0, 1]);

  const textEntry = spring({ frame: frame - 6, fps, config: { damping: 200 }, durationInFrames: 28 });
  const textX = interpolate(textEntry, [0, 1], [-60, 0]);
  const textOpacity = interpolate(textEntry, [0, 1], [0, 1]);

  return (
    <AbsoluteFill style={{ backgroundColor: PAPER }}>
      {/* Número grande de fundo */}
      <div
        style={{
          position: "absolute",
          top: 120,
          right: 70,
          fontFamily: FRAUNCES,
          fontWeight: 900,
          fontSize: 420,
          color: INK,
          opacity: 0.08,
          transform: `scale(${numScale})`,
        }}
      >
        {index}
      </div>

      {/* Indicador de progresso */}
      <div
        style={{
          position: "absolute",
          top: 100,
          left: 90,
          fontFamily: FRAUNCES,
          fontSize: 40,
          fontWeight: 700,
          color: accentColor,
          opacity: numOpacity,
        }}
      >
        {String(index).padStart(2, "0")} / {String(total).padStart(2, "0")}
      </div>

      {/* Texto do insight */}
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "flex-start", padding: "0 90px" }}>
        <div
          style={{
            transform: `translateX(${textX}px)`,
            opacity: textOpacity,
            fontFamily: FRAUNCES,
            fontWeight: 700,
            fontSize: 86,
            lineHeight: 1.15,
            color: INK,
          }}
        >
          <Highlighted text={text} accent={accent} color={accentColor} />
        </div>
      </AbsoluteFill>

      {/* Rodapé */}
      <div style={{ position: "absolute", bottom: 80, left: 90 }}>
        <Handle color={INK} handle={handle} />
      </div>
    </AbsoluteFill>
  );
}

// ─── Cena final — CTA ─────────────────────────────────────────────────────────
function CtaScene({ cta, accent, handle }: { cta: string; accent: string; handle: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entry = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 30 });
  const scale = interpolate(entry, [0, 1], [0.85, 1]);
  const opacity = interpolate(entry, [0, 1], [0, 1]);
  const pulse = 1 + 0.02 * Math.sin((frame / fps) * Math.PI * 2);

  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          padding: "0 90px",
          textAlign: "center",
          transform: `scale(${scale})`,
          opacity,
        }}
      >
        <div style={{ width: 110, height: 8, backgroundColor: accent, marginBottom: 50, borderRadius: 4 }} />
        <div
          style={{
            fontFamily: FRAUNCES,
            fontWeight: 800,
            fontSize: 92,
            lineHeight: 1.1,
            color: WHITE,
            transform: `scale(${pulse})`,
          }}
        >
          Siga <span style={{ color: accent }}>{handle}</span>
        </div>

        <div
          style={{
            marginTop: 50,
            fontFamily: FRAUNCES,
            fontWeight: 400,
            fontSize: 52,
            lineHeight: 1.3,
            color: PAPER,
            opacity: 0.9,
            maxWidth: 880,
          }}
        >
          {cta}
        </div>

        <div
          style={{
            marginTop: 70,
            fontFamily: FRAUNCES,
            fontSize: 40,
            fontWeight: 600,
            letterSpacing: 2,
            color: accent,
          }}
        >
          → Mais no link da bio
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

// ─── Composição completa ──────────────────────────────────────────────────────
export const ReelClassic: React.FC<ReelClassicProps> = ({ title, slides, accentWords, cta, kw, ed, img, cat, handle = "@dr.liberdad", brand = "Dr. Libertad", music }) => {
  const { fps } = useVideoConfig();
  const accent = CAT_ACCENT[cat ?? "freedom"] ?? RED;

  const COVER = Math.round(fps * 2.8);
  const SLIDE = Math.round(fps * 2.6);
  const CTA = Math.round(fps * 3.0);

  const safeSlides = slides && slides.length ? slides : reelClassicDefaultProps.slides;
  const total = COVER + safeSlides.length * SLIDE + CTA; // p/ o fade da trilha
  const musicSrc = music ? (/^https?:\/\//.test(music) ? music : staticFile(music)) : null;

  let cursor = 0;
  const next = (dur: number) => {
    const from = cursor;
    cursor += dur;
    return from;
  };

  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      <Sequence from={next(COVER)} durationInFrames={COVER}>
        <CoverScene title={title} kw={kw} ed={ed} img={img} accent={accent} brand={brand} handle={handle} />
      </Sequence>

      {safeSlides.map((text, i) => (
        <Sequence key={i} from={next(SLIDE)} durationInFrames={SLIDE}>
          <SlideScene
            text={text}
            accent={accentWords?.[i] ?? ""}
            accentColor={accent}
            index={i + 1}
            total={safeSlides.length}
            handle={handle}
          />
        </Sequence>
      ))}

      <Sequence from={next(CTA)} durationInFrames={CTA}>
        <CtaScene cta={cta} accent={accent} handle={handle} />
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
