// Invariantes da grade de cor da marca — FONTE ÚNICA (antes redeclarada só em
// video/Reel.tsx; agora também consumida por video/KenBurns.tsx, a 2ª fonte de
// footage). Ao contrário do DR-Libertad (irmão desta automação), a UPM NÃO
// ganhou variação de intensidade por pilar nesta rodada (acento de UI por
// pilar já existe via CAT_ACCENT, intocado) — só a duplicação foi eliminada.
//
// WASH DO FOOTAGE — LOCKED (2026-07-16): o repo-irmão testou wash variando por
// pilar sobre footage real misturado e ficou "doentio" (pele com tons
// errados) — travado mono `#A45A5A`. A UPM tinha o MESMO bug (Reel.tsx passava
// o CAT_ACCENT do pilar pro GradeOverlay); corrigido travando o parâmetro fora
// da API: `GradeOverlay` não aceita mais NENHUMA cor de fora — o wash é sempre
// `FOOTAGE_WASH_ACCENT`, imune a qualquer chamador (mesmo futuro) que tente
// variar por pilar.
import React from "react";
import { describe, it, expect } from "vitest";
import {
  GRADE_FILTER,
  DUO_FLOOR,
  DUO_HIGHLIGHT,
  WARM_WASH,
  FOOTAGE_WASH_ACCENT,
  GradeOverlay,
} from "./brand-grade";

describe("constantes da grade — hex fixo, fonte única", () => {
  it("os 3 tons do duotone são os hex vigentes", () => {
    expect(DUO_FLOOR).toBe("#1F1A18");
    expect(DUO_HIGHLIGHT).toBe("#ECDCC4");
    expect(WARM_WASH).toBe("#5A4636");
  });

  it("GRADE_FILTER é uma string CSS de filter válida", () => {
    expect(GRADE_FILTER).toMatch(/^saturate\([\d.]+\) contrast\([\d.]+\) brightness\([\d.]+\) sepia\([\d.]+\)$/);
  });

  it("FOOTAGE_WASH_ACCENT é o mono/quente travado da marca", () => {
    expect(FOOTAGE_WASH_ACCENT).toBe("#A45A5A");
  });
});

// Percorre a árvore de React.createElement devolvida por GradeOverlay() e
// encontra as camadas AbsoluteFill (sem precisar de renderer/DOM — o próprio
// componente é montado à mão com React.createElement, não JSX).
function absoluteFillLayers(node: React.ReactNode): Array<Record<string, unknown>> {
  const layers: Array<Record<string, unknown>> = [];
  const children = (node as any)?.props?.children;
  const list = Array.isArray(children) ? children : [children];
  for (const child of list) {
    if (child && typeof child === "object" && "props" in child) {
      layers.push((child as any).props.style ?? {});
    }
  }
  return layers;
}

describe("GradeOverlay — wash do footage é LOCKED, nunca varia por pilar", () => {
  it("não aceita NENHUM parâmetro (a API impede variar a cor do wash)", () => {
    expect(GradeOverlay.length).toBe(0);
  });

  it("a última camada (o wash) é sempre FOOTAGE_WASH_ACCENT, mesmo se um chamador tentar forçar outra cor", () => {
    // Simula um chamador antigo/errado (como o Reel.tsx tinha) tentando passar
    // o acento do pilar — a função ignora qualquer argumento.
    const PILLAR_ACCENTS = ["#A45A5A", "#BE7A2A", "#3D6360", "#3F5E78", "#835A6E", "#5B6B3C"];
    for (const poison of PILLAR_ACCENTS) {
      const tree = (GradeOverlay as unknown as (props: { accent: string }) => React.ReactNode)({
        accent: poison,
      });
      const layers = absoluteFillLayers(tree);
      expect(layers.length).toBe(4); // piso, teto, wash-quente-discreto, wash-mono
      const washLayer = layers[layers.length - 1];
      expect(washLayer.backgroundColor).toBe(FOOTAGE_WASH_ACCENT);
      expect(washLayer.mixBlendMode).toBe("soft-light");
    }
  });
});
