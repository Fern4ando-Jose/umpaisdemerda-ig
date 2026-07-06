// TESTE PAGO (cenário A) — gera COPY REAL pela IA (Anthropic) e renderiza
// 1 carrossel + 1 reel com essa copy. SEM publicar (Meta token ainda [FALTA]).
// Uso:  CRON_SECRET=... PEXELS_API_KEY=... node scripts/teste-pago.mjs
// Custo: 2 chamadas ao haiku (~US$0,007 cada) ≈ US$0,014. Render = grátis (ffmpeg).
import { writeFile, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const CRON = process.env.CRON_SECRET;
const PEXELS = process.env.PEXELS_API_KEY;
if (!CRON) { console.log("SEM CRON_SECRET"); process.exit(1); }

const PUB = "http://localhost:3000/api/publish";
const OG = "http://localhost:3000/api/og";
const ROOT = new URL("../_amostra/teste-pago/", import.meta.url);
await mkdir(ROOT, { recursive: true });

const STAMP_BY_CAT = {
  network: "Casta vitalícia", anxiety: "Pague e cale-se", dopamine: "Pão e circo",
  self: "Servo voluntário", mind: "Acorda", freedom: "Sem messias",
};

async function preview(run) {
  const url = `${PUB}?preview=1&lang=pt&run=${run}`;
  const r = await fetch(url, { headers: { authorization: `Bearer ${CRON}` } });
  const txt = await r.text();
  if (!r.ok) throw new Error(`preview run=${run} HTTP ${r.status}: ${txt.slice(0, 300)}`);
  const j = JSON.parse(txt);
  if (j.blocked) throw new Error(`BLOQUEADO pelo teto: ${j.reason}`);
  return j;
}

async function ogPng(qs, outPath) {
  const r = await fetch(`${OG}?${new URLSearchParams(qs)}`);
  if (!r.ok) throw new Error(`OG ${qs.slide} HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
  await writeFile(outPath, Buffer.from(await r.arrayBuffer()));
}

// divide um insight em (título, destaque dourado): último período/oração vira o hl
function splitHL(text) {
  const parts = String(text).split(/(?<=[.!?])\s+/).filter(Boolean);
  if (parts.length >= 2) return { title: parts.slice(0, -1).join(" "), hl: parts.at(-1) };
  return { title: text, hl: "" };
}

// ─── 1) COPY DA IA (2 temas distintos) ───────────────────────────────────────
console.log("→ gerando copy da IA (carrossel, run=0)…");
const carDup = await preview(0);
console.log(`  tema: "${carDup.topic}"  (cat ${carDup.cat}, ed ${carDup.ed})`);
console.log("→ gerando copy da IA (reel, run=1)…");
const reelDup = await preview(1);
console.log(`  tema: "${reelDup.topic}"  (cat ${reelDup.cat}, ed ${reelDup.ed})`);

await writeFile(new URL("copy-carrossel.json", ROOT), JSON.stringify(carDup, null, 2));
await writeFile(new URL("copy-reel.json", ROOT), JSON.stringify(reelDup, null, 2));

// ─── 2) CARROSSEL (capa + 3 insights + cta) via /api/og ──────────────────────
const CAR = new URL("carrossel/", ROOT);
await mkdir(CAR, { recursive: true });
const cstamp = STAMP_BY_CAT[carDup.cat] ?? "Vergonha nacional";
const common = { cat: carDup.cat, ed: carDup.ed, total: "5", lang: "pt" };
await ogPng({ ...common, slide: "cover", title: carDup.title, stamp: cstamp }, new URL("1-capa.png", CAR));
console.log("  ✓ capa");
const ins = (carDup.slides || []).slice(0, 3);
for (let i = 0; i < ins.length; i++) {
  await ogPng({ ...common, slide: "insight", num: String(i + 2), text: ins[i] }, new URL(`${i + 2}-insight.png`, CAR));
  console.log(`  ✓ insight ${i + 1}`);
}
await ogPng({ ...common, slide: "cta", text: carDup.cta }, new URL("5-cta.png", CAR));
console.log("  ✓ cta");

// ─── 3) REEL (footage Pexels da notícia + 3 overlays + ffmpeg) ───────────────
const REEL = new URL("reel/", ROOT);
await mkdir(REEL, { recursive: true });
const rdir = fileURLToPath(REEL);

// footage: 1º clipe sugerido pelo preview (Pexels por tema); fallback por query
let clipUrl = (reelDup.clips || [])[0];
if (!clipUrl && PEXELS) {
  for (const q of (reelDup.videoQueries || ["money on table close up"])) {
    const r = await fetch(`https://api.pexels.com/videos/search?query=${encodeURIComponent(q)}&orientation=portrait&size=medium&per_page=8`, { headers: { Authorization: PEXELS } });
    if (!r.ok) continue;
    const d = await r.json();
    const v = (d.videos || []).find(v => v.height >= v.width && (v.duration || 0) >= 6);
    if (v) { const fs = (v.video_files || []).filter(f => f.link); clipUrl = (fs.find(f => f.height >= f.width) || fs[0])?.link; if (clipUrl) break; }
  }
}
if (!clipUrl) { console.log("  ✗ sem footage Pexels — reel abortado"); process.exit(1); }
const cbuf = Buffer.from(await (await fetch(clipUrl)).arrayBuffer());
await writeFile(new URL("clip.mp4", REEL), cbuf);
console.log(`  footage: ${(cbuf.length / 1e6).toFixed(1)} MB`);

// 3 cenas a partir da COPY DA IA (insight1, insight2/título, cta)
const sceneTexts = [reelDup.slides?.[0] || reelDup.title, reelDup.slides?.[1] || reelDup.slides?.[0], reelDup.cta];
const kickers = [`${(STAMP_BY_CAT[reelDup.cat] ? "" : "")}enquanto o rebanho dorme`, "", "A pergunta"];
for (let i = 0; i < 3; i++) {
  const { title, hl } = splitHL(sceneTexts[i]);
  const qs = { slide: "reel", variant: "A", ed: reelDup.ed, title, hl, foot: i === 2 ? "siga ↑" : "" };
  if (kickers[i]) qs.kicker = kickers[i];
  await ogPng(qs, new URL(`s${i + 1}.png`, REEL));
  console.log(`  ✓ overlay s${i + 1}`);
}

const fc = "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1[bg];"
  + "[bg][1:v]overlay=0:0:enable='between(t,0,4)'[a];"
  + "[a][2:v]overlay=0:0:enable='between(t,4,8)'[b];"
  + "[b][3:v]overlay=0:0:enable='between(t,8,12)'[c]";
execFileSync("ffmpeg", ["-y", "-stream_loop", "-1", "-i", `${rdir}clip.mp4`, "-i", `${rdir}s1.png`, "-i", `${rdir}s2.png`, "-i", `${rdir}s3.png`,
  "-filter_complex", fc, "-map", "[c]", "-t", "12", "-r", "30", "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", `${rdir}reel-teste.mp4`], { stdio: "inherit" });
for (const [t, f] of [["2", "frame-1.png"], ["6", "frame-2.png"], ["10", "frame-3.png"]]) {
  execFileSync("ffmpeg", ["-y", "-ss", t, "-i", `${rdir}reel-teste.mp4`, "-frames:v", "1", `${rdir}${f}`], { stdio: "ignore" });
}

console.log("\nOK ✓");
console.log("  carrossel → _amostra/teste-pago/carrossel/ (5 PNGs)");
console.log("  reel      → _amostra/teste-pago/reel/reel-teste.mp4 + frames");
console.log("\n=== COPY CARROSSEL ===");
console.log("título:", carDup.title);
(carDup.slides || []).forEach((s, i) => console.log(`  ${i + 1}.`, s));
console.log("cta:", carDup.cta);
console.log("\n=== COPY REEL ===");
console.log("título:", reelDup.title);
(reelDup.slides || []).forEach((s, i) => console.log(`  ${i + 1}.`, s));
console.log("cta:", reelDup.cta);
console.log("\n=== LEGENDA (carrossel) ===");
console.log(carDup.caption);
