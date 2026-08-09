// Prova que o esqueleto de peça CHEGA ao redator desta página — e que chegar não custou a
// voz nem a régua apartidária.
//
// ⚠️ O QUE ESTA BATERIA COBRE, E O QUE NÃO COBRE — dito na cara, porque teste que promete
// mais do que mede é pior que teste nenhum:
//
//   · o adaptador (sorteio, diretriz, fail-open) é medido RODANDO — prova de comportamento;
//   · a LIGAÇÃO com o gerador é medida LENDO `api/publish/route.ts`. O gerador vive dentro de
//     uma rota do Next que abre conexão de rede e é chamada em produção 4× por dia; extraí-lo
//     para poder chamá-lo aqui seria mexer no que funciona (P1.5) só para agradar a bateria.
//     Então o que se lê não é "a variável existe": é que ela está INTERPOLADA dentro do
//     template do pedido e que o carimbo entra no retorno. Um `${}` desfeito reprova.
//
// O que a leitura NÃO alcança: se a rota deixar de chamar `generateContent`, esta bateria
// continua verde. Quem cobre isso é a bateria de rotação/ledger que já existe.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { formatoDaVaga, formatosPara, diretrizDoRedator, FORMATOS } from "./formatos-nucleo";

const ROTA = readFileSync(join(process.cwd(), "src/app/api/publish/route.ts"), "utf8");

describe("o esqueleto compartilhado", () => {
  it("traz os 7 esqueletos, cada um com roteiro utilizável", () => {
    expect(FORMATOS.length).toBeGreaterThanOrEqual(7);
    for (const f of FORMATOS) expect(f.roteiro.length).toBeGreaterThan(40);
  });

  it("sorteia igual para a mesma chave — nunca por acaso", () => {
    expect(formatoDaVaga("carrossel", "t|d").id).toBe(formatoDaVaga("carrossel", "t|d").id);
  });

  it("se espalha entre as chaves", () => {
    const vistos = new Set(Array.from({ length: 120 }, (_, i) => formatoDaVaga("carrossel", `t-${i}|d`).id));
    expect(vistos.size).toBeGreaterThanOrEqual(3);
  });

  it("carrossel e reel podem ter listas diferentes, e nenhuma é vazia", () => {
    expect(formatosPara("carrossel").length).toBeGreaterThan(0);
    expect(formatosPara("reel").length).toBeGreaterThan(0);
    expect(formatosPara("nao-existe" as never).length).toBe(FORMATOS.length); // fail-open
  });

  it("a diretriz cobra o esqueleto E o conflito antes da tese", () => {
    const d = diretrizDoRedator(formatoDaVaga("carrossel", "x"), "carrossel");
    expect(d).toContain("FORMATO OBRIGATÓRIO DESTA PEÇA:");
    expect(d).toContain("CONFLITO ANTES DA TESE");
    expect(d).toContain("PRIMEIRA tela");
  });
});

describe("a ligação com o gerador desta página", () => {
  it("o gerador importa o núcleo compartilhado", () => {
    expect(ROTA).toMatch(/import\s*\{[^}]*formatoDaVaga[^}]*\}\s*from\s*"@\/lib\/formatos-nucleo"/);
  });

  it("a diretriz é construída a partir do esqueleto sorteado", () => {
    expect(ROTA).toMatch(/const esqueleto = formatoDaVaga\(/);
    expect(ROTA).toMatch(/const diretrizFormato = diretrizDoRedator\(esqueleto/);
  });

  it("a diretriz está INTERPOLADA dentro do pedido (não só declarada)", () => {
    const prompt = ROTA.slice(ROTA.indexOf("const prompt = `"), ROTA.indexOf("Para \"videoQueries\""));
    expect(prompt).toContain("${diretrizFormato}");
  });

  it("a mídia sai da automação, nunca do horário do dia", () => {
    // `slot` é manhã/tarde/noite. Usá-lo como mídia daria esqueleto de carrossel a um Reel.
    expect(ROTA).toMatch(/const midiaDaPeca = automation === "ig-reels" \? "reel" : "carrossel"/);
  });

  it("a chave do sorteio leva tema e dia — e NÃO leva o idioma", () => {
    const linha = ROTA.split("\n").find((l) => l.includes("formatoDaVaga(midiaDaPeca")) ?? "";
    expect(linha).toContain("${topic}");
    expect(linha).toContain("dayUTC()");
    expect(linha).not.toContain("lang");
  });

  it("a peça sai CARIMBADA com o esqueleto que usou", () => {
    expect(ROTA).toMatch(/formato: esqueleto\.id/);
  });
});

describe("nada desta página se perdeu no caminho", () => {
  it("a régua apartidária continua no pedido", () => {
    expect(ROTA).toContain("RÉGUA APARTIDÁRIA (inviolável)");
    expect(ROTA).toContain("NUNCA cite nomes, siglas");
  });

  it("a voz editorial da página continua no pedido", () => {
    expect(ROTA).toContain("VOZ EDITORIAL: direta, mordaz, irônica");
    expect(ROTA).toContain("SERVIDÃO VOLUNTÁRIA");
  });

  it("nenhuma régua de OUTRA plataforma entrou junto", () => {
    // Régua de plataforma não viaja: a de YouTube Shorts é de outra fonte e de outro motor.
    const diretrizes = FORMATOS.map((f) => diretrizDoRedator(f, "carrossel")).join("\n").toLowerCase();
    for (const termo of ["no mudo", "saturaç", "balde"]) expect(diretrizes).not.toContain(termo);
  });
});
