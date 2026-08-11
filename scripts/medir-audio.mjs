// ─── O SOM COBRE A PEÇA INTEIRA? E A VOZ APARECE? ────────────────────────────
// PORTADO do dr-libertad-site em 2026-08-11. Renderiza SÓ O ÁUDIO da composição (leve —
// não desenha um quadro sequer) e mede o volume segundo a segundo. Existe por causa de
// dois defeitos reais, ouvidos pelo dono na peça publicada de lá:
//
//   · "áudio quebra" — o som caía de −17 dB para −85 dB aos ~27 s num vídeo de 30,6 s:
//     **2,6 segundos mudos** no fecho, em cima do convite. A causa não era o fade: **toda
//     trilha do acervo tem exatamente 28,000 s** e a peça passou disso quando o fecho
//     falado entrou. Aqui vale igual — o UPM usa o mesmo acervo e também ganhou fecho
//     falado (29/07);
//   · "sem voz gravada" — a voz estava lá, mas a cama musical ocupava a MESMA faixa de
//     frequência e a mascarava. Medido na banda da fala (300–3000 Hz), a mistura media
//     MENOS que a voz sozinha: assinatura de mascaramento.
//
// O teste de invariante trava o `loop` no código; este script prova o efeito no ÁUDIO.
//
//   node scripts/medir-audio.mjs <saida-dir> [segundos] [--props=<arquivo.json>]

import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(process.argv[2] || ".");
const argSeg = process.argv.slice(3).find((a) => !a.startsWith("--"));
const SEGUNDOS = Number(argSeg || 32);
mkdirSync(OUT, { recursive: true });

// `--props=<arquivo.json>` mede uma peça REAL (com a voz que ela usou). Comparar a faixa
// da fala entre versões só é possível medindo a peça de verdade, não um caso sintético.
const argProps = process.argv.find((a) => a.startsWith("--props="));
const PROPS_REAIS = argProps ? JSON.parse(readFileSync(resolve(argProps.slice("--props=".length)), "utf8")) : null;

// ⚠️ A PEÇA TEM DE SER MAIS LONGA QUE A TRILHA — senão o teste não toca no defeito.
// Sem narração o plano do ReelV2 não cruza os 28,0 s da trilha, e forçar só a duração da
// composição produz silêncio LEGÍTIMO (o fade já terminou), enganando quem mede. Por isso
// aqui vai uma narração de 30 s: é ela que estica o plano, como na peça real.
const NARRACAO_SEG = 30;
const PROPS_BASE = {
  title: "Ninguém te escraviza: você entrega a chave todo dia",
  slides: ["Um", "Dois", "Três"],
  cta: "O que você deixou de questionar esta semana?",
  kw: "CHAVE",
  ed: "123",
  cat: "self",
  handle: "@umpaisdemerda",
  brand: "Um País de Merda",
  music: "music/bed-0.mp3", // 28,000 s — a duração de TODA trilha do acervo
  // Narração de mentira só para esticar o plano: 5 blocos = capa + 3 insights + fecho.
  narrationUrl: "music/bed-1.mp3",
  narrationDurationSec: NARRACAO_SEG,
  narrationSegments: [
    "Ninguém te escraviza você entrega a chave todo dia",
    "Primeiro bloco falado desta peça de teste",
    "Segundo bloco falado desta peça de teste",
    "Terceiro bloco falado desta peça de teste",
    "Fecho falado desta peça de teste",
  ],
  narrationWords: [],
};
const PROPS = PROPS_REAIS ? { ...PROPS_BASE, ...PROPS_REAIS } : PROPS_BASE;

const browserExecutable =
  process.env.REMOTION_BROWSER_EXECUTABLE || "C:/Program Files/Google/Chrome/Application/chrome.exe";

// ⚠️ O ffmpeg escreve a medição em **stderr**, não em stdout. Lendo só o stdout, a medição
// volta vazia — e um medidor que não mede NUNCA pode devolver "está tudo bem": aqui ele
// EXPLODE, porque "não consegui medir" e "não há buraco" são coisas opostas.
// `spawnSync` e não `execFileSync`: só ele devolve stdout E stderr separados.
function medir(args, ondeFalhou) {
  const r = spawnSync("ffmpeg", ["-v", "info", ...args, "-f", "null", "-"], { encoding: "utf8" });
  const saida = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  const m = /mean_volume:\s*(-?[\d.]+) dB/.exec(saida);
  if (!m) throw new Error(`não consegui medir ${ondeFalhou} — medidor cego não vira aprovação`);
  return Number(m[1]);
}

const volumeEm = (arquivo, s) =>
  medir(["-ss", String(s), "-t", "1", "-i", arquivo, "-af", "volumedetect"], `o volume em ${s}s`);

/** Volume médio na faixa em que a voz humana vive — é ela que diz se dá para OUVIR a fala. */
const bandaDaVoz = (arquivo) =>
  medir(["-i", arquivo, "-af", "highpass=f=300,lowpass=f=3000,volumedetect"], "a faixa da voz");

async function main() {
  const serveUrl = await bundle({ entryPoint: resolve(ROOT, "video", "index.ts") });
  const comp = await selectComposition({ serveUrl, id: "ReelV2", inputProps: PROPS, browserExecutable });
  // A duração é a que o PRÓPRIO plano da peça calculou (é ela que passa dos 28 s da
  // trilha). Só se pede um número na linha de comando é que se força outra.
  const frames = argSeg ? Math.round(SEGUNDOS * comp.fps) : comp.durationInFrames;
  const dur = frames / comp.fps;
  const saida = resolve(OUT, `audio-${dur.toFixed(1)}s.mp3`);
  console.log(`[audio] peça de ${dur.toFixed(1)}s contra trilha de 28,0s`);

  await renderMedia({
    composition: { ...comp, props: PROPS, durationInFrames: frames },
    serveUrl,
    codec: "mp3",
    // ⚠️ `outputLocation`, NÃO `output`: com o nome errado o Remotion renderiza, devolve
    // sucesso e **não grava arquivo nenhum** — falha silenciosa que custou uma rodada.
    outputLocation: saida,
    browserExecutable,
    overwrite: true,
  });

  console.log(`[audio] som renderizado → ${saida}`);
  let mudos = 0;
  for (let s = 0; s < Math.floor(dur); s++) {
    const v = volumeEm(saida, s);
    if (v < -60) mudos++;
    if (s >= Math.floor(dur) - 10 || s % 5 === 0) console.log(`[audio] ${String(s).padStart(2)}s: ${v} dB${v < -60 ? "  ← MUDO" : ""}`);
  }
  console.log(`[audio] FAIXA DA VOZ (300-3000 Hz): ${bandaDaVoz(saida)} dB`);
  console.log(mudos ? `[audio] ⛔ ${mudos} segundo(s) MUDO(s)` : "[audio] ✅ som do começo ao fim, sem buraco");
  process.exit(mudos ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
