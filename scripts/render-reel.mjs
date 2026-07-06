// ─── Render do Reel (CLI puro, sem Next) ──────────────────────────────────────
// Renderiza a composição "Reel" do Remotion para out/reel.mp4.
//
// Origem dos inputProps (em ordem de prioridade):
//   1. --props=<arquivo.json>   → lê o JSON do arquivo
//   2. process.env.REEL_PROPS   → JSON inline na variável de ambiente
//   3. defaultProps da composição (fallback)
//
// Uso:
//   REEL_PROPS='{"title":"...","slides":[...],...}' node scripts/render-reel.mjs
//   node scripts/render-reel.mjs --props=props.json
//
// Observação: só roda de verdade onde houver Chromium/ffmpeg disponíveis
// (o GitHub Actions tem; localmente o Remotion baixa um Chromium Headless Shell).

import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, ".."); // raiz do projeto

// ─── 1. Resolver inputProps ───────────────────────────────────────────────────
function loadInputProps() {
  const propsArg = process.argv.find((a) => a.startsWith("--props="));
  if (propsArg) {
    const file = propsArg.slice("--props=".length);
    const json = readFileSync(resolve(process.cwd(), file), "utf8");
    console.log(`[render] inputProps lidos de arquivo: ${file}`);
    return JSON.parse(json);
  }
  if (process.env.REEL_PROPS) {
    console.log("[render] inputProps lidos de REEL_PROPS (env)");
    return JSON.parse(process.env.REEL_PROPS);
  }
  console.log("[render] sem props fornecidos — usando defaultProps da composição");
  return undefined;
}

// Composição a renderizar: --composition=Reel|ReelClassic ou REEL_COMPOSITION.
function loadComposition() {
  const arg = process.argv.find((a) => a.startsWith("--composition="));
  const id = arg ? arg.slice("--composition=".length) : process.env.REEL_COMPOSITION || "Reel";
  return id === "ReelClassic" ? "ReelClassic" : "Reel";
}

async function main() {
  const inputProps = loadInputProps();
  const compositionId = loadComposition();

  // ─── 2. Empacotar a composição Remotion ─────────────────────────────────────
  const entry = resolve(ROOT, "video", "index.ts");
  console.log("[render] empacotando bundle Remotion…");
  const serveUrl = await bundle({
    entryPoint: entry,
    onProgress: (p) => {
      if (p % 25 === 0) console.log(`[render] bundle ${p}%`);
    },
  });

  // ─── 3. Selecionar a composição (resolve calculateMetadata) ─────────────────
  console.log(`[render] selecionando composição ${compositionId}…`);
  const composition = await selectComposition({
    serveUrl,
    id: compositionId,
    inputProps: inputProps ?? {},
  });

  // ─── 4. Renderizar para out/reel.mp4 ────────────────────────────────────────
  const outDir = resolve(ROOT, "out");
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const outputLocation = resolve(outDir, "reel.mp4");

  console.log(
    `[render] renderizando ${composition.durationInFrames} frames ` +
      `(${composition.width}x${composition.height} @ ${composition.fps}fps)…`
  );
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264", // H.264 + AAC, compatível com Reels
    outputLocation,
    inputProps: inputProps ?? {},
    crf: 22,
    onProgress: ({ progress }) => {
      const pct = Math.round(progress * 100);
      if (pct % 10 === 0) console.log(`[render] render ${pct}%`);
    },
  });

  console.log(`[render] pronto → ${outputLocation}`);
}

main().catch((err) => {
  console.error("[render] erro:", err);
  process.exit(1);
});
