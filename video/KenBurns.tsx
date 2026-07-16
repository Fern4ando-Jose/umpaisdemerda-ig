// ─── Cena "FOTO Ken Burns" — 2ª fonte de footage ───────────────────────────────
// Espelha video/KenBurns.tsx do DR-Libertad (irmão desta automação, PR aprovado
// 2026-07-16) — mesmo mecanismo, mesma marca (duotone quente), adaptado à UPM
// (sem variação de grade por pilar; acento de UI continua vindo de CAT_ACCENT
// por pilar, já existente — mas NÃO chega até aqui: o wash do footage é LOCKED
// dentro de `GradeOverlay`, ver video/brand-grade.ts). Transforma uma FOTO
// retrato 9:16 numa cena com movimento cinematográfico LENTO e SUAVE via
// `transform: scale()/translate3d()` interpolado por `useCurrentFrame()` —
// subpixel, GPU, sem o tremor do ffmpeg zoompan (rejeitado no DR por
// arredondamento de pixel).
//
// `SceneBg` (Reel.tsx) detecta se um clipe é foto ou vídeo por extensão de URL
// (`isPhotoUrl`, src/lib/footage-media) e chama `<PhotoKenBurns>` no lugar de
// `<OffthreadVideo>`.

import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { GradeOverlay, DUO_FLOOR, GRADE_FILTER } from "./brand-grade";

// ─── Tipos de movimento Ken Burns ─────────────────────────────────────────────
// Escala base mínima 1.06 pra que o pan/zoom NUNCA revele a borda da foto (já
// entra em `objectFit: cover`, há folga de recorte suficiente).
export type KenBurnsMode = "zoom-in" | "zoom-out" | "pan-left" | "pan-up";

const KEN_BURNS_MODES: KenBurnsMode[] = ["zoom-in", "zoom-out", "pan-left", "pan-up"];

// Escolha DETERMINÍSTICA do modo a partir de um seed (a própria URL da foto,
// hasheada) — o mesmo clipe sempre se move do mesmo jeito, sem estado extra.
export function pickKenBurnsMode(seed: number): KenBurnsMode {
  return KEN_BURNS_MODES[((seed % KEN_BURNS_MODES.length) + KEN_BURNS_MODES.length) % KEN_BURNS_MODES.length];
}

type MoveState = { scale: number; x: number; y: number };

function moveFor(mode: KenBurnsMode): { from: MoveState; to: MoveState } {
  switch (mode) {
    case "zoom-in":
      return { from: { scale: 1.06, x: 0, y: 0 }, to: { scale: 1.15, x: -14, y: -8 } };
    case "zoom-out":
      return { from: { scale: 1.16, x: 12, y: 10 }, to: { scale: 1.06, x: 0, y: 0 } };
    case "pan-left":
      return { from: { scale: 1.14, x: 40, y: 0 }, to: { scale: 1.14, x: -40, y: 0 } };
    case "pan-up":
      return { from: { scale: 1.14, x: 0, y: 44 }, to: { scale: 1.14, x: 0, y: -44 } };
  }
}

// ─── Fundo: foto com Ken Burns + grade da marca ───────────────────────────────
export function PhotoKenBurns({
  src,
  mode,
  dur,
}: {
  src: string;
  mode: KenBurnsMode;
  dur: number;
}) {
  const frame = useCurrentFrame();
  const { from, to } = moveFor(mode);
  const p = interpolate(frame, [0, dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const scale = from.scale + (to.scale - from.scale) * p;
  const x = from.x + (to.x - from.x) * p;
  const y = from.y + (to.y - from.y) * p;

  return (
    <AbsoluteFill style={{ backgroundColor: DUO_FLOOR, overflow: "hidden", isolation: "isolate" }}>
      <AbsoluteFill
        style={{
          transform: `scale(${scale}) translate3d(${x}px, ${y}px, 0)`,
          willChange: "transform",
          backfaceVisibility: "hidden",
        }}
      >
        <Img src={src} style={{ width: "100%", height: "100%", objectFit: "cover", filter: GRADE_FILTER }} />
      </AbsoluteFill>
      <GradeOverlay />
    </AbsoluteFill>
  );
}
