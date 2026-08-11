import { describe, it, expect } from "vitest";
import { paraFalar, porExtenso } from "./fala";
import { assinarLegenda } from "./serie";

// O caso que criou este módulo, nas palavras do dono no Dr. Liberdade (11/08/2026):
// «a palavra (20 min) corta a palavra e fica estranho, não existe 20 min falado».
// O bloco ia CRU ao motor de voz. Tela e boca são textos diferentes.

describe("o caso que o dono ouviu", () => {
  it("«scrolla 20 min» é FALADO como «vinte minutos»", () => {
    const dito = paraFalar("Você rola o feed 20 min e não lê uma lei que te rouba.");
    expect(dito).toContain("vinte minutos");
    expect(dito).not.toMatch(/\bmin\b/);
    expect(dito).not.toMatch(/\b20\b/);
  });

  it("singular segue o número: 1 minuto, 2 minutos", () => {
    expect(paraFalar("Só 1 min por dia.")).toContain("um minuto");
    expect(paraFalar("São 2 min por dia.")).toContain("dois minutos");
  });

  it("percentual vira «por cento»", () => {
    expect(paraFalar("Só 3% leem o orçamento.")).toContain("três por cento");
  });
});

describe("números por extenso", () => {
  it("na faixa que a peça usa", () => {
    expect(porExtenso(0)).toBe("zero");
    expect(porExtenso(3)).toBe("três");
    expect(porExtenso(15)).toBe("quinze");
    expect(porExtenso(20)).toBe("vinte");
    expect(porExtenso(21)).toBe("vinte e um");
    expect(porExtenso(100)).toBe("cem");
    expect(porExtenso(365)).toBe("trezentos e sessenta e cinco");
  });

  it("ANO fica como está — «2026» não vira frase dentro da frase", () => {
    // Esta conta cita ano o tempo todo (a pauta é o noticiário político).
    expect(porExtenso(2026)).toBe("2026");
    expect(paraFalar("O escândalo de 2026 é o mesmo de sempre.")).toContain("2026");
  });

  it("CIFRA grande fica como está — «4 bilhões» não vira ladainha", () => {
    // A pauta desta conta é cheia de valor de orçamento; expandir milhares viraria uma
    // frase inteira dentro da frase e quebraria o ritmo da fala.
    expect(paraFalar("Sumiram 4500 reais por segundo.")).toContain("4500");
  });
});

describe("o que NÃO pode ser mexido", () => {
  it("«min» dentro de outra palavra não vira «minutos»", () => {
    expect(paraFalar("O mínimo da administração.")).toBe("O mínimo da administração.");
  });

  it("marca e sigla não são abreviação — saem inteiras", () => {
    const t = paraFalar("Netflix e TikTok tomam sua noite.");
    expect(t).toContain("Netflix");
    expect(t).toContain("TikTok");
  });

  it("texto vazio volta como veio — não se inventa fala", () => {
    expect(paraFalar("")).toBe("");
    expect(paraFalar("   ")).toBe("   ");
  });
});

// ─── A ASSINATURA DA LEGENDA ─────────────────────────────────────────────────
// O sinal fixo que abre toda legenda ainda NÃO foi escolhido para esta marca (é decisão
// de copy/identidade — delegada ao diretor em 11/08). Estas travas guardam o
// comportamento seguro do meio-tempo: sem sinal, nada muda.
describe("a assinatura fixa da legenda", () => {
  it("sem sinal escolhido, a legenda sai exatamente como veio", () => {
    const legenda = "A casta não dorme. Você sim.";
    expect(assinarLegenda(legenda)).toBe(legenda);
  });

  it("legenda vazia volta como veio — não se inventa legenda", () => {
    expect(assinarLegenda("")).toBe("");
    expect(assinarLegenda(null)).toBe("");
    expect(assinarLegenda(undefined)).toBe("");
  });

  it("nenhuma peça deixa de sair por causa de um adorno (fail-open)", () => {
    // Legenda no limite do Instagram continua saindo — inteira.
    const longa = "x".repeat(2200);
    expect(assinarLegenda(longa)).toBe(longa);
  });
});
