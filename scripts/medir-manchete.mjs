// ─── Medidor da manchete NO QUADRO RENDERIZADO ────────────────────────────────
// PORTADO do dr-libertad-site em 2026-08-11. Não confia na estimativa de largura por
// caractere: renderiza o quadro DE VERDADE (Remotion + Chromium) duas vezes — uma com o
// texto e outra com o texto vazio — e mede as colunas onde os dois diferem. Essa diferença
// É a letra, em pixels.
//
// Uso:
//   node scripts/medir-manchete.mjs <saida-dir>
//   node scripts/medir-manchete.mjs <saida-dir> --frases=<arquivo.json>
//
// ⚠️ ARMADILHAS JÁ PAGAS (não reintroduzir):
//   · `renderStill` usa `composition.props`; `inputProps` **não** sobrepõe — passando pelo
//     `inputProps`, as duas variantes saem IDÊNTICAS e a medição devolve "0 pixels de
//     texto" com o texto bem visível na imagem;
//   · apertar o alvo de ocupação para "compensar" estimativa ruim DESLIGA a regra: já foi
//     tentado e derrubou a ocupação real de 85% para 71%. Item fora da régua se fecha com
//     amostra medida — que é para isso que este programa existe.

import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(process.argv[2] || ".");
mkdirSync(OUT, { recursive: true });

// ─── MODO LOTE ────────────────────────────────────────────────────────────────
// `--frases=<arquivo.json>` mede a ocupação de VÁRIAS frases reais, uma por render. Uma
// amostra medida diz onde a conta erra; um palpite não diz nada.
// ⚠️ Cada frase custa 2 renders (com e sem texto). Rodar em lote pequeno: o Chrome headless
// come RAM e esta máquina trabalha perto do limite.
const argFrases = process.argv.find((a) => a.startsWith("--frases="));
const FRASES = argFrases
  ? JSON.parse(readFileSync(resolve(argFrases.slice("--frases=".length)), "utf8"))
  : null;

// Peça de referência NA VOZ DESTA CONTA (sátira política PT-BR) — não a do Dr. Liberdade.
// Frases-verdade do catálogo `THEMES` de `src/app/api/publish/route.ts`.
const PROPS = {
  title: "Ninguém te escraviza: você entrega a chave todo dia",
  slides: [
    "O tirano só é forte porque você ajoelha",
    "Reclama da coleira, mas é você que segura a guia",
    "Pare de obedecer e o trono cai sozinho",
  ],
  accentWords: ["ajoelha", "guia", "trono"],
  cta: "O que você deixou de questionar esta semana?",
  kw: "CHAVE",
  ed: "123",
  cat: "self",
  handle: "@umpaisdemerda",
  brand: "Um País de Merda",
};

const browserExecutable =
  process.env.REMOTION_BROWSER_EXECUTABLE || "C:/Program Files/Google/Chrome/Application/chrome.exe";

/** Colunas e linhas em que duas imagens diferem — o retângulo que o texto ocupa. */
async function caixaDaDiferenca(aPath, bPath) {
  const [a, b] = await Promise.all([
    sharp(aPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(bPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
  ]);
  const { width, height, channels } = a.info;
  let x0 = width, x1 = -1, y0 = height, y1 = -1, pixels = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const d =
        Math.abs(a.data[i] - b.data[i]) +
        Math.abs(a.data[i + 1] - b.data[i + 1]) +
        Math.abs(a.data[i + 2] - b.data[i + 2]);
      if (d > 60) {
        pixels++;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return { x0, x1, y0, y1, largura: x1 - x0 + 1, altura: y1 - y0 + 1, pixels, width, height };
}

/** Quantos pixels do quadro estão na COR DA MARCA — prova de que a cor nasce no quadro 0. */
async function pixelsNaCor(caminho, hex, tolerancia = 46) {
  const alvo = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const { data, info } = await sharp(caminho).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let n = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    if (
      Math.abs(data[i] - alvo[0]) <= tolerancia &&
      Math.abs(data[i + 1] - alvo[1]) <= tolerancia &&
      Math.abs(data[i + 2] - alvo[2]) <= tolerancia
    ) n++;
  }
  return n;
}

async function main() {
  console.log("[medir] empacotando…");
  const serveUrl = await bundle({ entryPoint: resolve(ROOT, "video", "index.ts") });

  const comp = await selectComposition({ serveUrl, id: "ReelV2", inputProps: PROPS, browserExecutable });
  console.log(`[medir] composição ${comp.width}x${comp.height}, ${comp.durationInFrames} frames`);

  if (FRASES) {
    const linhas = [];
    for (let i = 0; i < FRASES.length; i++) {
      const titulo = FRASES[i];
      const props = { ...PROPS, title: titulo };
      const com = resolve(OUT, `lote-${i}.png`);
      const sem = resolve(OUT, `_sem-lote-${i}.png`);
      await renderStill({ composition: { ...comp, props }, serveUrl, output: com, frame: 0, browserExecutable, overwrite: true });
      await renderStill({ composition: { ...comp, props: { ...props, title: "" } }, serveUrl, output: sem, frame: 0, browserExecutable, overwrite: true });
      const c = await caixaDaDiferenca(com, sem);
      const pct = (c.largura / c.width) * 100;
      linhas.push({ titulo, ocupacaoPct: Number(pct.toFixed(1)), largura: c.largura });
      console.log(`[medir] ${pct.toFixed(1)}%  «${titulo.slice(0, 52)}»`);
    }
    const vals = linhas.map((l) => l.ocupacaoPct).sort((a, b) => a - b);
    const dentro = linhas.filter((l) => l.ocupacaoPct >= 85 && l.ocupacaoPct <= 96).length;
    console.log(`[medir] ── ${dentro}/${linhas.length} dentro de 85–96% · menor ${vals[0]}% · maior ${vals[vals.length - 1]}% · mediana ${vals[Math.floor(vals.length / 2)]}%`);
    writeFileSync(resolve(OUT, "lote-medidas.json"), JSON.stringify(linhas, null, 2));
    process.exit(0);
  }

  const quadros = [
    { nome: "capa-frame0", frame: 0 },
    { nome: "capa-frame15", frame: 15 },
    { nome: "capa-frame75", frame: 75 },
  ];

  const medidas = [];
  for (const q of quadros) {
    const comTexto = resolve(OUT, `${q.nome}.png`);
    // ⚠️ Os props vão em `composition.props`, NÃO no `inputProps` do renderStill.
    await renderStill({ composition: { ...comp, props: PROPS }, serveUrl, output: comTexto, frame: q.frame, browserExecutable, overwrite: true });
    // O mesmo quadro SEM a frase: a diferença entre os dois é exatamente a letra.
    const semTexto = resolve(OUT, `_sem-${q.nome}.png`);
    await renderStill({ composition: { ...comp, props: { ...PROPS, title: "" } }, serveUrl, output: semTexto, frame: q.frame, browserExecutable, overwrite: true });
    const caixa = await caixaDaDiferenca(comTexto, semTexto);
    const pct = (caixa.largura / caixa.width) * 100;
    // A cor da marca desta conta (o carimbo do jornal satírico) — tem de existir já no
    // quadro 0, que é o que o Instagram usa de capa no grid.
    const marca = await pixelsNaCor(comTexto, "#a83f30");
    medidas.push({ ...q, ...caixa, ocupacaoPct: Number(pct.toFixed(1)), pixelsNaCorDaMarca: marca, arquivo: comTexto });
    console.log(
      `[medir] ${q.nome}: letra ocupa ${pct.toFixed(1)}% da largura (x ${caixa.x0}–${caixa.x1}), ` +
        `${caixa.pixels} pixels de texto, faixa vertical y ${caixa.y0}–${caixa.y1}, ` +
        `${marca} pixels na cor da marca`,
    );
  }

  writeFileSync(resolve(OUT, "medidas.json"), JSON.stringify({ props: PROPS, medidas }, null, 2));
  console.log(`[medir] pronto → ${OUT}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
