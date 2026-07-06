// LOTE DE 1 DIA — 6 posts (4 reels + 2 carrosséis), copy 100% pela IA (Anthropic).
// SEM publicar (Meta token [FALTA]). Tudo salvo em _amostra/lote-dia/ p/ aprovação.
// Uso: CRON_SECRET=... PEXELS_API_KEY=... node scripts/lote-dia.mjs
// Custo: 6 chamadas haiku (~US$0,007 cada) ≈ US$0,04. Render/footage = grátis.
import { writeFile, mkdir, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const CRON = process.env.CRON_SECRET;
const PEXELS = process.env.PEXELS_API_KEY;
if (!CRON) { console.log("SEM CRON_SECRET"); process.exit(1); }

const PUB = "http://localhost:3000/api/publish";
const OG = "http://localhost:3000/api/og";
const ROOT = new URL("../_amostra/lote-dia/", import.meta.url);
await mkdir(ROOT, { recursive: true });

const STAMP_BY_CAT = {
  network: "Casta vitalícia", anxiety: "Pague e cale-se", dopamine: "Pão e circo",
  self: "Servo voluntário", mind: "Acorda", freedom: "Sem messias",
};

// Plano do dia: 2 carrosséis (runs 0,1) + 4 reels (runs 2,3,4,5).
const PLANO = [
  { run: 0, tipo: "carrossel" },
  { run: 1, tipo: "carrossel" },
  { run: 2, tipo: "reel" },
  { run: 3, tipo: "reel" },
  { run: 4, tipo: "reel" },
  { run: 5, tipo: "reel" },
];

async function preview(run) {
  const r = await fetch(`${PUB}?preview=1&lang=pt&run=${run}`, { headers: { authorization: `Bearer ${CRON}` } });
  const txt = await r.text();
  if (!r.ok) throw new Error(`preview run=${run} HTTP ${r.status}: ${txt.slice(0, 200)}`);
  const j = JSON.parse(txt);
  if (j.blocked) throw new Error(`BLOQUEADO: ${j.reason}`);
  return j;
}
async function fetchBuf(url, headers, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url, { headers }); if (r.ok) return Buffer.from(await r.arrayBuffer()); last = `HTTP ${r.status}`; }
    catch (e) { last = e.message; }
  }
  throw new Error(`fetchBuf falhou (${last})`);
}
async function readJSON(path) { try { return JSON.parse(await readFile(path, "utf8")); } catch { return null; } }
async function ogPng(qs, outPath) {
  const r = await fetch(`${OG}?${new URLSearchParams(qs)}`);
  if (!r.ok) throw new Error(`OG ${qs.slide} HTTP ${r.status}`);
  await writeFile(outPath, Buffer.from(await r.arrayBuffer()));
}
function splitHL(text) {
  const parts = String(text).split(/(?<=[.!?])\s+/).filter(Boolean);
  if (parts.length >= 2) return { title: parts.slice(0, -1).join(" "), hl: parts.at(-1) };
  return { title: text, hl: "" };
}

async function renderCarrossel(dup, dir) {
  await mkdir(dir, { recursive: true });
  const stamp = STAMP_BY_CAT[dup.cat] ?? "Vergonha nacional";
  const common = { cat: dup.cat, ed: dup.ed, total: "5", lang: "pt" };
  await ogPng({ ...common, slide: "cover", title: dup.title, stamp }, new URL("1-capa.png", dir));
  const ins = (dup.slides || []).slice(0, 3);
  for (let i = 0; i < ins.length; i++) {
    await ogPng({ ...common, slide: "insight", num: String(i + 2), text: ins[i] }, new URL(`${i + 2}-insight.png`, dir));
  }
  await ogPng({ ...common, slide: "cta", text: dup.cta }, new URL("5-cta.png", dir));
}

async function renderReel(dup, dir) {
  await mkdir(dir, { recursive: true });
  const rdir = fileURLToPath(dir);
  let clipUrl = (dup.clips || [])[0];
  if (!clipUrl && PEXELS) {
    for (const q of (dup.videoQueries || ["money on table close up"])) {
      const r = await fetch(`https://api.pexels.com/videos/search?query=${encodeURIComponent(q)}&orientation=portrait&size=medium&per_page=8`, { headers: { Authorization: PEXELS } });
      if (!r.ok) continue;
      const d = await r.json();
      const v = (d.videos || []).find(v => v.height >= v.width && (v.duration || 0) >= 6);
      if (v) { const fs = (v.video_files || []).filter(f => f.link); clipUrl = (fs.find(f => f.height >= f.width) || fs[0])?.link; if (clipUrl) break; }
    }
  }
  if (!clipUrl) { console.log("  ! sem footage — reel sem vídeo"); return false; }
  const cbuf = await fetchBuf(clipUrl, undefined, 4);
  await writeFile(new URL("clip.mp4", dir), cbuf);
  const sceneTexts = [dup.slides?.[0] || dup.title, dup.slides?.[1] || dup.slides?.[0], dup.cta];
  for (let i = 0; i < 3; i++) {
    const { title, hl } = splitHL(sceneTexts[i]);
    const qs = { slide: "reel", variant: "A", ed: dup.ed, title, hl, foot: i === 2 ? "siga ↑" : "" };
    if (i === 0) qs.kicker = "enquanto o rebanho dorme";
    if (i === 2) qs.kicker = "A pergunta";
    await ogPng(qs, new URL(`s${i + 1}.png`, dir));
  }
  const fc = "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1[bg];"
    + "[bg][1:v]overlay=0:0:enable='between(t,0,4)'[a];"
    + "[a][2:v]overlay=0:0:enable='between(t,4,8)'[b];"
    + "[b][3:v]overlay=0:0:enable='between(t,8,12)'[c]";
  execFileSync("ffmpeg", ["-y", "-stream_loop", "-1", "-i", `${rdir}clip.mp4`, "-i", `${rdir}s1.png`, "-i", `${rdir}s2.png`, "-i", `${rdir}s3.png`,
    "-filter_complex", fc, "-map", "[c]", "-t", "12", "-r", "30", "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", `${rdir}reel.mp4`], { stdio: "ignore" });
  for (const [t, f] of [["2", "frame-1.png"], ["6", "frame-2.png"], ["10", "frame-3.png"]]) {
    execFileSync("ffmpeg", ["-y", "-ss", t, "-i", `${rdir}reel.mp4`, "-frames:v", "1", `${rdir}${f}`], { stdio: "ignore" });
  }
  return true;
}

let resumo = `LOTE DE 1 DIA — @umpaisdemerda — copy 100% IA (haiku-4-5)\n`;
resumo += `Gerado: ${PLANO.length} posts (2 carrosséis + 4 reels). SEM publicar (token Meta [FALTA]).\n\n`;
let nC = 0, nR = 0;
for (const item of PLANO) {
  const label = item.tipo === "carrossel" ? `carrossel-${++nC}` : `reel-${++nR}`;
  const dir = new URL(`${label}/`, ROOT);
  await mkdir(dir, { recursive: true });
  // reaproveita a copy já gerada (NÃO repaga a Anthropic em rerun)
  let dup = await readJSON(fileURLToPath(new URL("copy.json", dir)));
  if (dup) console.log(`→ ${label} (run ${item.run}): copy reaproveitada (sem repagar)`);
  else {
    dup = await preview(item.run);
    await writeFile(new URL("copy.json", dir), JSON.stringify(dup, null, 2));
    console.log(`→ ${label} (run ${item.run}, ${dup.cat}): "${dup.topic}"`);
  }
  try {
    if (item.tipo === "carrossel") await renderCarrossel(dup, dir);
    else await renderReel(dup, dir);
    console.log(`  ✓ ${label} pronto`);
  } catch (e) { console.log(`  ✗ ${label} render falhou: ${e.message}`); }

  resumo += `══ ${label.toUpperCase()} · pilar ${dup.cat} · ed ${dup.ed}\n`;
  resumo += `TEMA: ${dup.topic}\n`;
  resumo += `TÍTULO: ${dup.title}\n`;
  (dup.slides || []).forEach((s, i) => { resumo += `  ${i + 1}. ${s}\n`; });
  resumo += `CTA: ${dup.cta}\n`;
  resumo += `LEGENDA:\n${dup.caption}\n\n`;
}
await writeFile(new URL("RESUMO.txt", ROOT), resumo);
console.log(`\nOK ✓ tudo em _amostra/lote-dia/ (cada post numa subpasta + RESUMO.txt)`);
