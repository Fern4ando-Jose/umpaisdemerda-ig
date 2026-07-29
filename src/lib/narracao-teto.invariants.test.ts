// Trava do TETO DE DURAÇÃO do Reel narrado.
//
// Defeito real (2026-07-27, 1º Reel de produção com voz ligada): saiu com **32s**
// (958 frames). Causa: com o áudio virando o relógio, um roteiro comprido gera um
// vídeo comprido — título + 3 insights + fecho deram ~320 caracteres. Antes isso
// ficava ESCONDIDO porque a voz era espremida numa janela fixa (e então atrasava ou
// cortava, que era o defeito original).
//
// A correção é encurtar o TEXTO, nunca acelerar a voz — e cortar em UM lugar só, já
// que a mesma lista vira o roteiro falado E os slides que a tela mostra.
//
// 2026-07-29: o fecho falado SAIU da voz (ver narracao-cierre.invariants.test.ts) —
// o teto agora conta só título + slides. `podarSlides` perdeu o parâmetro `fecho`
// pra não mentir sobre o que a produção realmente calcula.
import { describe, it, expect } from "vitest";

const CHARS_POR_SEG = 11.6; // ritmo medido da voz a 0,85
const FALA_MAX_SEG = 20;
const TETO_CHARS = Math.round(FALA_MAX_SEG * CHARS_POR_SEG); // 232

// Espelha a poda de src/app/api/publish/route.ts.
export function podarSlides(titulo: string, slides: string[]): string[] {
  const out = slides.slice(0, 3);
  const tamanho = (ss: string[]) => [titulo, ...ss].join(" ").length;
  while (out.length > 1 && tamanho(out) > TETO_CHARS) out.pop();
  return out;
}

describe("teto de duração — o Reel narrado não estica sem limite", () => {
  it("o caso REAL que saiu com 32s agora cabe no teto", () => {
    const titulo = "Quem escolhe com quem dorme e com quem casa?";
    const slides = [
      "A mulher escolhe com quem transar; o homem escolhe com quem casar.",
      "Ela filtra e diz sim ou não. Ele decide se casa ou não. Poder em lugares diferentes.",
      "Reconhecer onde está seu poder real é o primeiro passo para parar de reclamar.",
    ];
    const podados = podarSlides(titulo, slides);
    expect(podados.length).toBeLessThan(3);
    const chars = [titulo, ...podados].join(" ").length;
    expect(chars).toBeLessThanOrEqual(TETO_CHARS);
    expect(chars / CHARS_POR_SEG).toBeLessThanOrEqual(FALA_MAX_SEG);
  });

  it("roteiro CURTO passa intacto — não poda quem já cabe", () => {
    const titulo = "A liberdade começa onde acaba o medo";
    const slides = ["O medo cobra um preço", "Você paga sem perceber"];
    expect(podarSlides(titulo, slides)).toEqual(slides);
  });

  it("nunca zera: sempre sobra pelo menos 1 insight, por mais longo que seja", () => {
    const titulo = "T".repeat(200);
    const slides = ["A".repeat(300), "B".repeat(300), "C".repeat(300)];
    const podados = podarSlides(titulo, slides);
    expect(podados).toHaveLength(1);
    expect(podados[0]).toBe(slides[0]); // corta do FIM, preserva o 1º insight
  });

  it("corta o ÚLTIMO insight (o 1º é o que desenvolve o gancho)", () => {
    const titulo = "T".repeat(60);
    const slides = ["primeiro insight " + "x".repeat(60), "segundo " + "y".repeat(60), "terceiro " + "z".repeat(60)];
    const podados = podarSlides(titulo, slides);
    expect(podados[0]).toBe(slides[0]);
    expect(podados).not.toContain(slides[2]);
  });

  it("o teto vale para o roteiro INTEIRO — inclui o título, não só os slides", () => {
    // 210 chars (não 150): sem o fecho falado (retirado em 29/07), o orçamento de
    // caracteres sobra mais — um título mais curto agora caberia com os 3 slides.
    const tituloLongo = "U".repeat(210);
    const slides = ["curto um", "curto dois", "curto tres"];
    const podados = podarSlides(tituloLongo, slides);
    // sozinhos os slides caberiam; com o título longo, não
    expect(podados.length).toBeLessThan(3);
  });
});
