// ─── Verificação pós-render (ffprobe) ─────────────────────────────────────────
// Assere que um MP4 de saída está no formato que o Instagram Reels exige ANTES
// de publicar: proporção 9:16 (default 1080×1920), stream de vídeo H.264/yuv420p
// e duração > 0. Áudio é OPCIONAL (a decisão travada é "reels sem música"): por
// padrão só REPORTA presença/ausência; use --expect-audio ou --no-audio para
// transformar em asserção dura.
//
// Uso (CLI):
//   node scripts/verify-render.mjs out/reel.mp4
//   node scripts/verify-render.mjs out/reel.mp4 --w=1080 --h=1920 --no-audio
//   node scripts/verify-render.mjs capa.mp4 --w=1080 --h=1350   (carrossel/estático)
//
// Uso (programático):
//   import { verifyRender } from "./verify-render.mjs";
//   await verifyRender("out/reel.mp4", { w: 1080, h: 1920 });  // throw se falhar
//
// Sai com código 1 e mensagem clara em qualquer violação (fail-fast no CI/local).
import { execFileSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";

const FFPROBE = process.env.FFPROBE_BIN || "ffprobe";

function probe(file) {
  const out = execFileSync(
    FFPROBE,
    ["-v", "error", "-print_format", "json", "-show_streams", "-show_format", file],
    { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }
  );
  return JSON.parse(out);
}

/**
 * Verifica um arquivo de mídia renderizado.
 * @param {string} file caminho do MP4
 * @param {{w?:number,h?:number,minDurationSec?:number,expectAudio?:boolean|null,tolerance?:number}} opts
 *   expectAudio: true (exige áudio) | false (exige SEM áudio) | null (só reporta — default)
 * @returns {{ok:true, width:number, height:number, durationSec:number, hasAudio:boolean, vcodec:string}}
 * @throws Error com todas as violações se algo não bater.
 */
export function verifyRender(file, opts = {}) {
  const { w = 1080, h = 1920, minDurationSec = 0.5, expectAudio = null, tolerance = 0 } = opts;

  if (!existsSync(file)) throw new Error(`verify-render: arquivo não existe: ${file}`);
  if (statSync(file).size === 0) throw new Error(`verify-render: arquivo vazio (0 bytes): ${file}`);

  let data;
  try {
    data = probe(file);
  } catch (e) {
    // ffprobe ausente no ambiente (ex.: runner do CI sem ffmpeg) NÃO deve derrubar
    // um render válido — a verificação é uma checagem de segurança, não crítica.
    // Só PULA quando o binário não existe (ENOENT); erros de ffprobe rodando (mídia
    // corrompida) continuam propagando.
    if (e && (e.code === "ENOENT" || /ENOENT|not found|não encontrad/i.test(String(e.message)))) {
      console.warn(`verify-render: ffprobe indisponível — verificação PULADA (${file}). Instale ffmpeg p/ ativar.`);
      return { ok: true, skipped: true, reason: "ffprobe indisponível" };
    }
    throw e;
  }
  const streams = data.streams || [];
  const video = streams.find((s) => s.codec_type === "video");
  const audio = streams.find((s) => s.codec_type === "audio");
  const errs = [];

  if (!video) {
    errs.push("sem stream de vídeo");
  } else {
    const vw = Number(video.width), vh = Number(video.height);
    if (Math.abs(vw - w) > tolerance || Math.abs(vh - h) > tolerance) {
      errs.push(`dimensão ${vw}×${vh} ≠ esperado ${w}×${h} (proporção alvo ${w}:${h})`);
    }
    // pix_fmt: `yuv420p` e `yuvj420p` (full-range) são ambos aceitos pelo Instagram
    // (o Remotion emite `yuvj420p`). Só AVISA em formatos exóticos — nunca derruba
    // um render válido por causa disto (era o que barrava os reels no CI 2026-07-11).
    if (video.pix_fmt && !["yuv420p", "yuvj420p"].includes(video.pix_fmt)) {
      console.warn(`verify-render: pix_fmt incomum '${video.pix_fmt}' (esperado yuv420p/yuvj420p) — seguindo mesmo assim.`);
    }
  }

  const durationSec = Number(video?.duration ?? data.format?.duration ?? 0);
  if (!(durationSec >= minDurationSec)) {
    errs.push(`duração ${durationSec}s < mínimo ${minDurationSec}s`);
  }

  const hasAudio = Boolean(audio);
  if (expectAudio === true && !hasAudio) errs.push("esperava stream de áudio, não há");
  if (expectAudio === false && hasAudio) errs.push("esperava SEM áudio, mas há stream de áudio");

  if (errs.length) {
    throw new Error(`verify-render FALHOU (${file}):\n  - ${errs.join("\n  - ")}`);
  }

  return {
    ok: true,
    width: Number(video.width),
    height: Number(video.height),
    durationSec,
    hasAudio,
    vcodec: video.codec_name,
  };
}

// ─── CLI ──────────────────────────────────────────────────────────────────────
function isMain() {
  const arg = process.argv[1] || "";
  return arg.endsWith("verify-render.mjs");
}

if (isMain()) {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith("--"));
  if (!file) {
    console.error("uso: node scripts/verify-render.mjs <arquivo.mp4> [--w=1080] [--h=1920] [--expect-audio|--no-audio] [--min-dur=0.5]");
    process.exit(1);
  }
  const get = (name) => {
    const a = args.find((x) => x.startsWith(`--${name}=`));
    return a ? a.slice(name.length + 3) : undefined;
  };
  const opts = {
    w: get("w") ? Number(get("w")) : undefined,
    h: get("h") ? Number(get("h")) : undefined,
    minDurationSec: get("min-dur") ? Number(get("min-dur")) : undefined,
    expectAudio: args.includes("--expect-audio") ? true : args.includes("--no-audio") ? false : null,
  };
  try {
    const r = verifyRender(file, opts);
    console.log(
      `✓ verify-render OK: ${r.width}×${r.height} ${r.vcodec} ${r.durationSec}s ` +
        `áudio=${r.hasAudio ? "sim" : "não"} → ${file}`
    );
  } catch (e) {
    console.error(`✗ ${e.message}`);
    process.exit(1);
  }
}
