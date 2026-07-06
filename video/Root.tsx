// ─── Catálogo de composições Remotion ─────────────────────────────────────────
// "Reel"        → motor NOVO (footage de banco + grade + música). Duração via
//                 reelDurations() (fonte única em Reel.tsx).
// "ReelClassic" → motor ANTIGO (slide animado sobre ilustração). Mantido para
//                 rodar em paralelo (1x/dia). Duração própria (COVER+SLIDE*n+CTA).

import React from "react";
import { Composition } from "remotion";
import { Reel, reelDefaultProps, reelDurations, ReelProps, FPS } from "./Reel";
import { ReelClassic, reelClassicDefaultProps, ReelClassicProps } from "./ReelClassic";

// Duração do motor clássico (mesma matemática inline do componente original).
function classicDuration(slidesCount: number): number {
  const COVER = Math.round(FPS * 2.8);
  const SLIDE = Math.round(FPS * 2.6);
  const CTA = Math.round(FPS * 3.0);
  return COVER + SLIDE * Math.max(1, slidesCount) + CTA;
}

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Reel"
        component={Reel}
        durationInFrames={reelDurations(reelDefaultProps.slides.length).total}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={reelDefaultProps}
        calculateMetadata={({ props }) => {
          const p = props as ReelProps;
          const count = p.slides && p.slides.length ? p.slides.length : reelDefaultProps.slides.length;
          return { durationInFrames: reelDurations(count).total };
        }}
      />

      <Composition
        id="ReelClassic"
        component={ReelClassic}
        durationInFrames={classicDuration(reelClassicDefaultProps.slides.length)}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={reelClassicDefaultProps}
        calculateMetadata={({ props }) => {
          const p = props as ReelClassicProps;
          const count = p.slides && p.slides.length ? p.slides.length : reelClassicDefaultProps.slides.length;
          return { durationInFrames: classicDuration(count) };
        }}
      />
    </>
  );
};
