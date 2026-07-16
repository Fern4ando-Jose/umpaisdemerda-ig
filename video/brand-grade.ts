// ─── Grade de cor da marca — FONTE ÚNICA (2026-07-16) ──────────────────────────
// Antes, `video/Reel.tsx` redeclarava as 4 constantes do duotone (GRADE_FILTER/
// DUO_FLOOR/DUO_HIGHLIGHT/WARM_WASH) — e o clone (video/KenBurns.tsx, mix de 4
// fontes de footage: Pexels vídeo/foto + Pixabay vídeo/foto) precisaria da MESMA
// grade pra ficar visualmente idêntico independente da fonte. Consolidado aqui.
//
// Ao contrário do DR-Libertad (irmão desta automação), a UPM já tem acento POR
// PILAR (`CAT_ACCENT` em video/Reel.tsx: 6 cores distintas, não um acento único)
// — decisão de marca própria, intocada. Este módulo NÃO introduz variação de
// intensidade por pilar (isso foi uma revisão de neuromarketing feita
// especificamente pro grade do DR, 2026-07-16, não replicada aqui sem revisão
// própria) — só mata a duplicação, comportamento visual idêntico ao anterior.
// Import RELATIVO nos consumidores de video/*.tsx (webpack do Remotion não
// resolve `@/`).
import React from "react";
import { AbsoluteFill } from "remotion";

export const GRADE_FILTER = "saturate(0.5) contrast(1.1) brightness(0.95) sepia(0.2)";
export const DUO_FLOOR = "#1F1A18"; // piso levemente quente (matte, sem laranja)
export const DUO_HIGHLIGHT = "#ECDCC4"; // teto creme quente suave
export const WARM_WASH = "#5A4636"; // unificador quente discreto

// Camadas de duotone (piso/teto/wash/acento) — usadas por CIMA do footage já
// filtrado (vídeo com `filter: GRADE_FILTER` ou foto dentro de KenBurns). Um
// ÚNICO componente para as 4 fontes: vídeo Pexels, vídeo Pixabay, foto Pexels ou
// foto Pixabay saem com a MESMA cara.
export function GradeOverlay({ accent }: { accent?: string }) {
  return React.createElement(
    React.Fragment,
    null,
    React.createElement(AbsoluteFill, { style: { backgroundColor: DUO_FLOOR, mixBlendMode: "screen" } }),
    React.createElement(AbsoluteFill, { style: { backgroundColor: DUO_HIGHLIGHT, mixBlendMode: "multiply" } }),
    React.createElement(AbsoluteFill, { style: { backgroundColor: WARM_WASH, opacity: 0.16, mixBlendMode: "soft-light" } }),
    accent ? React.createElement(AbsoluteFill, { style: { backgroundColor: accent, opacity: 0.18, mixBlendMode: "soft-light" } }) : null,
  );
}
