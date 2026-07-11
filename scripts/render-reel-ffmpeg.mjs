// Reel de TESTE local: footage do Pexels + overlays do /api/og + composição ffmpeg.
// (No DR o MP4 sai no CI/Remotion; aqui é um teste local p/ aprovar o visual.)
// Uso: PEXELS_API_KEY=... node scripts/render-reel-ffmpeg.mjs   (com `npm run dev`)
import { writeFile, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { verifyRender } from "./verify-render.mjs";

const KEY = process.env.PEXELS_API_KEY;
if (!KEY) { console.log("SEM PEXELS_API_KEY"); process.exit(1); }
const OG = "http://localhost:3000/api/og";
const OUT = new URL("../_amostra/reel/", import.meta.url);
const dir = fileURLToPath(OUT);
await mkdir(OUT, { recursive: true });

// 1) footage da notícia (penduricalhos → contando dinheiro)
function pickFile(v){const fs=(v.video_files||[]).filter(f=>f.link&&f.width&&f.height);const p=fs.filter(f=>f.height>=f.width);const pool=p.length?p:fs;pool.sort((a,b)=>((a.width<=1440?0:1)*1e6+Math.abs(a.width-1080))-((b.width<=1440?0:1)*1e6+Math.abs(b.width-1080)));return pool[0]?.link;}
let clip;
for (const q of ["counting cash money hands","stack of money on desk","money on table close up"]) {
  const r = await fetch(`https://api.pexels.com/videos/search?query=${encodeURIComponent(q)}&orientation=portrait&size=medium&per_page=8`, { headers:{Authorization:KEY} });
  if (!r.ok) continue;
  const d = await r.json();
  const v = (d.videos||[]).find(v=>v.height>=v.width && (v.duration||0)>=6);
  if (v) { clip = pickFile(v); console.log(`footage: id=${v.id} ${v.width}x${v.height} ${v.duration}s "${q}"`); break; }
}
if (!clip) { console.log("nenhum clipe achado"); process.exit(1); }
const cbuf = Buffer.from(await (await fetch(clip)).arrayBuffer());
await writeFile(new URL("clip.mp4", OUT), cbuf);
console.log(`clip.mp4 (${(cbuf.length/1e6).toFixed(1)} MB)`);

// 2) overlays (transparentes) do motor
// Ângulo: o ESPELHO da servidão voluntária. O brasileiro NÃO é crítico — é rebanho
// que aceita calado, e por isso sobem um pouco a cada dia. A lâmina vira contra a
// passividade do leitor, nunca o bajula como consciente.
const SCENES = [
  { f:"s1.png", qs:{ slide:"reel", variant:"A", ed:"14", kicker:"O Estado · enquanto o rebanho dorme", title:"Inventaram mais um penduricalho.", hl:"E você nem percebeu.", foot:"é legendado" } },
  { f:"s2.png", qs:{ slide:"reel", variant:"A", ed:"14", title:"Um assessor leva R$ 261 mil num mês. Por fora do salário.", hl:"E você paga. Calado.", foot:"quem paga? você" } },
  { f:"s3.png", qs:{ slide:"reel", variant:"A", ed:"14", kicker:"A pergunta", title:"Eles só aumentam porque você abaixa a cabeça.", hl:"Até quando, rebanho?", foot:"siga ↑" } },
];
for (const s of SCENES) {
  const r = await fetch(`${OG}?${new URLSearchParams(s.qs)}`);
  if (!r.ok) { console.log(`✗ ${s.f}: HTTP ${r.status}`); process.exit(1); }
  await writeFile(new URL(s.f, OUT), Buffer.from(await r.arrayBuffer()));
  console.log(`overlay ${s.f} ok`);
}

// 3) ffmpeg: cobre 1080x1920, 12s, 3 cenas de 4s, sem áudio
const fc = "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1[bg];"
  + "[bg][1:v]overlay=0:0:enable='between(t,0,4)'[a];"
  + "[a][2:v]overlay=0:0:enable='between(t,4,8)'[b];"
  + "[b][3:v]overlay=0:0:enable='between(t,8,12)'[c]";
const args = ["-y","-stream_loop","-1","-i",`${dir}clip.mp4`,"-i",`${dir}s1.png`,"-i",`${dir}s2.png`,"-i",`${dir}s3.png`,
  "-filter_complex",fc,"-map","[c]","-t","12","-r","30","-an","-c:v","libx264","-pix_fmt","yuv420p","-movflags","+faststart",`${dir}reel-teste.mp4`];
execFileSync("ffmpeg", args, { stdio:"inherit" });

// 3b) verificação pós-render: 9:16 (1080×1920), vídeo, sem áudio (reel sem música)
const chk = verifyRender(`${dir}reel-teste.mp4`, { w: 1080, h: 1920, expectAudio: false });
console.log(`verify-render OK: ${chk.width}×${chk.height} ${chk.vcodec} ${chk.durationSec}s áudio=${chk.hasAudio ? "sim" : "não"}`);

// 4) stills compostos (PNG visível) p/ aprovação inline
for (const [t,f] of [["2","frame-1.png"],["6","frame-2.png"],["10","frame-3.png"]]) {
  execFileSync("ffmpeg", ["-y","-ss",t,"-i",`${dir}reel-teste.mp4`,"-frames:v","1",`${dir}${f}`], { stdio:"ignore" });
}
console.log("OK → _amostra/reel/reel-teste.mp4 + frame-1/2/3.png");
