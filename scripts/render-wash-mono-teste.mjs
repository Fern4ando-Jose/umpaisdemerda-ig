// ─── Prova visual: wash do footage LOCKED × UI variando por pilar (2026-07-16) ─
// Renderiza 1 still da CENA DE CAPA (com a régua) e 1 still da CENA DE INSIGHT
// (com a palavra em destaque) para 3 pilares diferentes (freedom/anxiety/mind),
// usando footage REAL da biblioteca curada (video/src/lib/footage-library.ts —
// mesmas URLs de produção, Pexels CDN, sem precisar de PEXELS_API_KEY porque são
// links diretos de mídia, não uma busca na API).
//
// Objetivo da prova: confirmar visualmente que o WASH sobre o footage fica
// IDÊNTICO/mono entre os 3 pilares (GradeOverlay travado em #A45A5A, sem
// parâmetro), enquanto a RÉGUA (barra sob o título) e a PALAVRA EM DESTAQUE
// continuam mudando de cor conforme CAT_ACCENT do pilar.
//
// Uso: node scripts/render-wash-mono-teste.mjs
// Saída: Arquivo-Midia/prova-wash-mono/<pilar>-capa.png e <pilar>-insight.png
// (script roda fora do Next dev — bundla o Remotion direto, sem precisar de
// `npm run dev` rodando).

import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const OUT_DIR = resolve(ROOT, "Arquivo-Midia", "prova-wash-mono");

// 1 clipe de vídeo REAL por pilar, direto de video/src/lib/footage-library.ts
// (biblioteca curada — mesma fonte usada em produção).
const PILLARS = [
  {
    cat: "freedom",
    clip: "https://videos.pexels.com/video-files/10350799/10350799-hd_720_1280_30fps.mp4",
    title: "A liberdade começa onde o automático termina",
    slide: "O algoritmo decide por você quando você não decide",
    accentWord: "algoritmo",
  },
  {
    cat: "anxiety",
    clip: "https://videos.pexels.com/video-files/7924953/7924953-hd_720_1280_24fps.mp4",
    title: "Você trabalha até maio só pra pagar essa palhaçada",
    slide: "O imposto é o roubo que vem com nota fiscal",
    accentWord: "imposto",
  },
  {
    cat: "mind",
    clip: "https://videos.pexels.com/video-files/8680222/8680222-hd_720_1366_25fps.mp4",
    title: "O despertar não pede licença, ele acontece",
    slide: "Ninguém acorda o rebanho, cada um acorda sozinho",
    accentWord: "rebanho",
  },
];

async function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  // Usa o Chrome já instalado no sistema quando disponível — evita o download
  // do Chrome Headless Shell próprio do Remotion (mais rápido, sem depender de
  // rede extra numa máquina compartilhada). Cai pro default (baixa/usa cache
  // do Remotion) se não achar, pra continuar portável em CI.
  const SYSTEM_CHROME = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  ].find((p) => existsSync(p));
  if (SYSTEM_CHROME) console.log(`[wash-mono] usando Chrome do sistema: ${SYSTEM_CHROME}`);

  const entry = resolve(ROOT, "video", "index.ts");
  console.log("[wash-mono] empacotando bundle Remotion...");
  const serveUrl = await bundle({ entryPoint: entry });
  console.log(`[wash-mono] bundle pronto: ${serveUrl}`);

  for (const p of PILLARS) {
    const baseProps = {
      title: p.title,
      slides: [p.slide],
      accentWords: [p.accentWord],
      cta: "Siga pra mais",
      kw: p.cat.toUpperCase(),
      ed: "001",
      clips: [p.clip],
      cat: p.cat,
      handle: "@umpaisdemerda",
      brand: "Um País de Merda",
    };

    console.log(`[wash-mono] selecionando composição p/ pilar ${p.cat}...`);
    const composition = await selectComposition({
      serveUrl,
      id: "Reel",
      inputProps: baseProps,
      browserExecutable: SYSTEM_CHROME,
      timeoutInMilliseconds: 120000, // máquina compartilhada/carregada — 30s default estourava
    });

    // Cena de CAPA: frame bem dentro da janela de assentamento do texto (~15).
    const capaOut = resolve(OUT_DIR, `${p.cat}-capa.png`);
    await renderStill({
      composition,
      serveUrl,
      output: capaOut,
      inputProps: baseProps,
      frame: 20,
      browserExecutable: SYSTEM_CHROME,
      timeoutInMilliseconds: 120000, // máquina compartilhada/carregada — 30s default estourava
    });
    console.log(`[wash-mono] ✓ ${p.cat}-capa.png`);

    // Cena de INSIGHT: COVER dura 150 frames (5s*30fps) — pega um frame ~40
    // dentro da 1ª (única) cena de insight, já com a entrada assentada.
    const COVER = Math.round(30 * 5.0);
    const insightOut = resolve(OUT_DIR, `${p.cat}-insight.png`);
    await renderStill({
      composition,
      serveUrl,
      output: insightOut,
      inputProps: baseProps,
      frame: COVER + 40,
      browserExecutable: SYSTEM_CHROME,
      timeoutInMilliseconds: 120000, // máquina compartilhada/carregada — 30s default estourava
    });
    console.log(`[wash-mono] ✓ ${p.cat}-insight.png`);
  }

  console.log(`[wash-mono] pronto → ${OUT_DIR}`);
}

main().catch((err) => {
  console.error("[wash-mono] erro:", err);
  process.exit(1);
});
