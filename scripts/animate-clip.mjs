// ─── Animação da capa (image-to-video, fal) ───────────────────────────────────
// Gera UM clipe curto de vídeo a partir da ilustração do dia (props.img) e grava
// a URL em props.clip dentro do reel-props.json. O Reel usa esse clipe como
// FUNDO EM MOVIMENTO real (régua "vídeo de verdade, não slide animado").
//
// CAMADA: criação (não automação). É NÃO-FATAL por design — qualquer falha
// (sem FAL_KEY, sem imagem, timeout, erro da fal) faz o script sair 0 sem clipe,
// e o Reel cai no fallback (ilustração estática Ken Burns). A automação nunca
// quebra por causa do experimento de criação.
//
// Modelo padrão: LTX-2 Fast (fal-ai/ltx-2/image-to-video/fast) — US$0,04/s, 6s
// mínimo = ~US$0,24/clipe (cabe no teto de US$0,30). Sai 16:9; o Reel faz
// cover-crop p/ 9:16. Tudo configurável por env p/ trocar o modelo depois.
//
// Uso:  FAL_KEY=... node scripts/animate-clip.mjs --props=reel-props.json

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const FAL_KEY = process.env.FAL_KEY;
const MODEL = process.env.FAL_VIDEO_MODEL || "fal-ai/ltx-2/image-to-video/fast";
const DURATION = process.env.FAL_VIDEO_DURATION || "6";
const RESOLUTION = process.env.FAL_VIDEO_RESOLUTION || "1080p";
const POLL_TIMEOUT_MS = 240000; // ~4min de janela total de geração

const propsArg = process.argv.find((a) => a.startsWith("--props="));
const PROPS_PATH = resolve(process.cwd(), propsArg ? propsArg.slice("--props=".length) : "reel-props.json");

// Movimento intencionalmente lento/sóbrio — atmosfera editorial, sem deformar o
// sujeito (modelos i2v "viajam" quando o prompt pede movimento forte).
const MOTION_PROMPT =
  "Slow cinematic push-in with gentle parallax depth. Subtle atmospheric drift: faint floating dust, softly shifting light and shadow. Elegant, restrained, dreamlike motion. The main subject stays stable and coherent — no morphing, no warping, no added objects. No camera shake, no fast movement. Photoreal depth, sober editorial mood.";

function log(m) {
  console.log(`[animate] ${m}`);
}
// Sempre 0: o clipe é opcional (fallback p/ ilustração estática).
function done(reason) {
  if (reason) log(reason);
  process.exit(0);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (!existsSync(PROPS_PATH)) return done(`props ${PROPS_PATH} ausente — nada a animar`);
  let props;
  try {
    props = JSON.parse(readFileSync(PROPS_PATH, "utf8"));
  } catch (e) {
    return done(`reel-props.json inválido (${e?.message || e}) — sem clipe`);
  }

  if (!FAL_KEY) return done("FAL_KEY ausente no runtime — sem clipe (fallback ilustração estática)");
  if (!props.img) return done("props.img vazio (sem ilustração do dia) — sem clipe");

  try {
    log(`submetendo i2v → ${MODEL} (${DURATION}s, ${RESOLUTION})`);
    const submit = await fetch(`https://queue.fal.run/${MODEL}`, {
      method: "POST",
      headers: { Authorization: `Key ${FAL_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        image_url: props.img,
        prompt: MOTION_PROMPT,
        duration: Number(DURATION), // a fal exige inteiro (6,8,10…), não string
        resolution: RESOLUTION,
        generate_audio: false, // áudio entra como trilha própria no Remotion
      }),
    });
    if (!submit.ok) {
      const body = await submit.text().catch(() => "");
      return done(`submit HTTP ${submit.status}: ${body.slice(0, 220)} — sem clipe`);
    }
    const q = await submit.json();
    const statusUrl = q.status_url;
    const responseUrl = q.response_url;
    if (!statusUrl || !responseUrl) return done(`resposta de fila inesperada: ${JSON.stringify(q).slice(0, 220)}`);

    // Polling até COMPLETED (ou timeout).
    const started = Date.now();
    let status = q.status || "IN_QUEUE";
    while (status !== "COMPLETED") {
      if (Date.now() - started > POLL_TIMEOUT_MS) return done("timeout no polling (>240s) — sem clipe");
      await sleep(5000);
      const s = await fetch(statusUrl, { headers: { Authorization: `Key ${FAL_KEY}` } });
      if (!s.ok) return done(`status HTTP ${s.status} — sem clipe`);
      const sd = await s.json().catch(() => ({}));
      status = sd.status || status;
      log(`status: ${status}`);
      if (status === "FAILED" || status === "ERROR") return done("geração falhou na fal — sem clipe");
    }

    const r = await fetch(responseUrl, { headers: { Authorization: `Key ${FAL_KEY}` } });
    if (!r.ok) {
      const body = await r.text().catch(() => "");
      return done(`result HTTP ${r.status}: ${body.slice(0, 300)} — sem clipe`);
    }
    const data = await r.json().catch(() => ({}));
    const url = data?.video?.url || data?.video_url || data?.url;
    if (!url) return done(`resultado sem video.url: ${JSON.stringify(data).slice(0, 220)} — sem clipe`);

    props.clip = url;
    writeFileSync(PROPS_PATH, JSON.stringify(props));
    log(`clipe pronto → ${url}`);
    log("props.clip gravado no reel-props.json");
  } catch (e) {
    return done(`exceção: ${e?.message || e} — sem clipe`);
  }
  return done();
}

main();
