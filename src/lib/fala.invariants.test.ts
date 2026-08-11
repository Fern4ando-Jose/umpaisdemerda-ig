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

// ⛔ 2026-08-11, ordem do dono ouvindo o Reel: *"não deve ter diminutivos, como o PE, a voz
// não sabe falar isso fica feio, já havia ocorrido"*. A peça real era «25 presos em operação
// contra tráfico em PE».
describe("sigla de estado não vai crua para a voz", () => {
  it("o caso exato que o dono ouviu", () => {
    const dito = paraFalar("25 presos em operação contra tráfico em PE.");
    expect(dito).toContain("Pernambuco");
    expect(dito).not.toMatch(/\bPE\b/);
  });

  it("as 27 unidades da federação, todas", () => {
    const casos: Array<[string, string]> = [
      ["SP", "São Paulo"], ["RJ", "Rio de Janeiro"], ["MG", "Minas Gerais"],
      ["DF", "Distrito Federal"], ["MS", "Mato Grosso do Sul"], ["RN", "Rio Grande do Norte"],
      ["TO", "Tocantins"], ["AM", "Amazonas"], ["SE", "Sergipe"], ["PA", "Pará"],
    ];
    for (const [sigla, nome] of casos) {
      expect(paraFalar(`Operação em ${sigla} hoje.`), sigla).toContain(nome);
    }
  });

  it("⚠️ só em CAIXA ALTA — metade das siglas é palavra comum em minúscula", () => {
    // Trocar "se" por "Sergipe" no meio de uma frase seria muito pior que o defeito.
    expect(paraFalar("Ninguém se importa e o pa do fogão.")).toBe("Ninguém se importa e o pa do fogão.");
    expect(paraFalar("Ele foi ao ato.")).toBe("Ele foi ao ato.");
  });

  it("sigla de ÓRGÃO fica como está — a voz soletra, e é assim que se fala", () => {
    // "esse-tê-éfe" é como qualquer brasileiro diz. Expandir estouraria o teto da fala.
    const t = paraFalar("O STF decidiu e a CPI acabou.");
    expect(t).toContain("STF");
    expect(t).toContain("CPI");
  });
});

describe("dinheiro e abreviação de jornal", () => {
  it("«R$ 4 bilhões» vira «4 bilhões de reais», não «erre cifrão»", () => {
    const t = paraFalar("Sumiram R$ 4 bilhões do orçamento.");
    expect(t).toContain("bilhões de reais");
    expect(t).not.toContain("R$");
  });

  it("⚠️ valor com VÍRGULA fica inteiro — «1,3 milhão», não «um,três milhão»", () => {
    // Medido ao escrever esta regra: com `\b(\d{1,3})\b`, a vírgula é fronteira de palavra
    // e cada dígito do decimal virava extenso. A pauta desta conta é orçamento público:
    // valor com vírgula é o normal.
    const t = paraFalar("A CGU achou R$ 1,3 milhão de superfaturamento.");
    expect(t).toContain("1,3 milhão de reais");
    expect(t).not.toContain("um,");
  });

  it("valor com ponto de milhar também fica inteiro", () => {
    expect(paraFalar("Foram R$ 4.500 por dia.")).toContain("4.500");
  });

  it("o hífen de «ex-» corta a palavra na voz — vira «ex assessor»", () => {
    expect(paraFalar("O ex-assessor voltou.")).toContain("ex assessor");
  });

  it("«nº» e tratamento saem por extenso", () => {
    expect(paraFalar("Processo nº 12 arquivado.")).toContain("número");
    expect(paraFalar("O Dr. Fulano assinou.")).toContain("Doutor");
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
