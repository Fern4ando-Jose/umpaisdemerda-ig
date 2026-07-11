// Lote de reels de teste — 1 por frente, pauta real da semana, ângulo do espelho.
// Uso: PEXELS_API_KEY=... node scripts/render-batch-reels.mjs   (com `npm run dev`)
import { writeFile, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { verifyRender } from "./verify-render.mjs";

const KEY = process.env.PEXELS_API_KEY;
if (!KEY) { console.log("SEM PEXELS_API_KEY"); process.exit(1); }
const OG = "http://localhost:3000/api/og";
const OUT = new URL("../_amostra/reel/batch/", import.meta.url);
const dir = fileURLToPath(OUT);
await mkdir(OUT, { recursive: true });

const REELS = [
  { id: "executivo", ed: "15", queries: ["money handed over hands", "cash handout hands", "government building money"],
    scenes: [
      { kicker: "O Executivo · o herói com o seu dinheiro", title: "O governo “investe” milhões.", hl: "Com o dinheiro que tirou de você.", foot: "é legendado" },
      { title: "Tira um caminhão de imposto. Devolve uma migalha. E posa de herói.", hl: "E você bate palma.", foot: "quem paga? você" },
      { kicker: "A pergunta", title: "Não é bondade. É o seu bolso voltando picado.", hl: "Acorda, rebanho.", foot: "siga ↑" },
    ] },
  { id: "legislativo", ed: "16", queries: ["empty parliament chamber seats", "empty office chairs row", "empty meeting room chairs"],
    scenes: [
      { kicker: "O Legislativo · não trabalham, multiplicam", title: "Cancelaram a sessão.", hl: "Criaram mais cargos.", foot: "é legendado" },
      { title: "Não votam, não aparecem — mas o salário e a mamata nunca atrasam.", hl: "Quem paga? Você. Calado.", foot: "quem paga? você" },
      { kicker: "A pergunta", title: "Você sustenta quem falta ao trabalho e ainda se multiplica.", hl: "Até quando, rebanho?", foot: "siga ↑" },
    ] },
  { id: "judiciario", ed: "17", queries: ["judge gavel money", "counting cash money hands", "stack of money on desk"],
    scenes: [
      { kicker: "O Judiciário · o “penduricalho”", title: "Inventaram mais um penduricalho.", hl: "E você nem percebeu.", foot: "é legendado" },
      { title: "Assessor leva R$ 261 mil num mês. Por fora do salário.", hl: "E você paga, calado.", foot: "quem paga? você" },
      { kicker: "A pergunta", title: "Eles chamam de “merecimento”. Você banca de joelho.", hl: "Até quando, rebanho?", foot: "siga ↑" },
    ] },
  { id: "crime", ed: "18", queries: ["dark city street night", "city night lights street", "money in shadow dark"],
    scenes: [
      { kicker: "Estado paralelo · o pedágio do crime", title: "Duas máfias cobram de você.", hl: "Uma com nota fiscal. Outra na bala.", foot: "é legendado" },
      { title: "Onde o Estado falha, a facção governa, taxa e manda.", hl: "E você abaixa a cabeça pras duas.", foot: "quem manda?" },
      { kicker: "A pergunta", title: "Você paga imposto E pedágio do crime — e chama de “normal”.", hl: "Rebanho.", foot: "siga ↑" },
    ] },
];

function pickFile(v){const fs=(v.video_files||[]).filter(f=>f.link&&f.width&&f.height);const p=fs.filter(f=>f.height>=f.width);const pool=p.length?p:fs;pool.sort((a,b)=>((a.width<=1440?0:1)*1e6+Math.abs(a.width-1080))-((b.width<=1440?0:1)*1e6+Math.abs(b.width-1080)));return pool[0]?.link;}

async function footage(queries){
  for (const q of queries){
    const r = await fetch(`https://api.pexels.com/videos/search?query=${encodeURIComponent(q)}&orientation=portrait&size=medium&per_page=8`,{headers:{Authorization:KEY}});
    if(!r.ok) continue;
    const d = await r.json();
    const v = (d.videos||[]).find(v=>v.height>=v.width && (v.duration||0)>=6);
    if(v){ const link=pickFile(v); if(link){ console.log(`  footage "${q}" id=${v.id} ${v.width}x${v.height}`); return link; } }
  }
  return null;
}

const fc = "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1[bg];"
  + "[bg][1:v]overlay=0:0:enable='between(t,0,4)'[a];"
  + "[a][2:v]overlay=0:0:enable='between(t,4,8)'[b];"
  + "[b][3:v]overlay=0:0:enable='between(t,8,12)'[c]";

for (const reel of REELS){
  console.log(`\n=== ${reel.id} ===`);
  const link = await footage(reel.queries);
  if(!link){ console.log("  sem footage — pulando"); continue; }
  await writeFile(new URL(`${reel.id}.mp4`, OUT), Buffer.from(await (await fetch(link)).arrayBuffer()));
  const pngs = [];
  for (let i=0;i<reel.scenes.length;i++){
    const s = reel.scenes[i];
    const qs = new URLSearchParams({ slide:"reel", variant:"A", ed:reel.ed, title:s.title, hl:s.hl||"", foot:s.foot||"siga ↑", ...(s.kicker?{kicker:s.kicker}:{}) });
    const r = await fetch(`${OG}?${qs}`);
    if(!r.ok){ console.log(`  overlay ${i+1} HTTP ${r.status}`); continue; }
    const f = `${reel.id}-s${i+1}.png`;
    await writeFile(new URL(f, OUT), Buffer.from(await r.arrayBuffer()));
    pngs.push(`${dir}${f}`);
  }
  const args = ["-y","-stream_loop","-1","-i",`${dir}${reel.id}.mp4`,...pngs.flatMap(p=>["-i",p]),
    "-filter_complex",fc,"-map","[c]","-t","12","-r","30","-an","-c:v","libx264","-pix_fmt","yuv420p","-movflags","+faststart",`${dir}reel-${reel.id}.mp4`];
  execFileSync("ffmpeg", args, { stdio:"ignore" });
  verifyRender(`${dir}reel-${reel.id}.mp4`, { w: 1080, h: 1920, expectAudio: false });
  execFileSync("ffmpeg", ["-y","-ss","2","-i",`${dir}reel-${reel.id}.mp4`,"-frames:v","1",`${dir}hook-${reel.id}.png`], { stdio:"ignore" });
  console.log(`  ✓ reel-${reel.id}.mp4 + hook-${reel.id}.png (9:16 verificado)`);
}

// montagem dos 4 ganchos numa imagem
const hooks = REELS.map(r=>`${dir}hook-${r.id}.png`);
execFileSync("ffmpeg", ["-y",...hooks.flatMap(h=>["-i",h]),
  "-filter_complex","[0:v]scale=460:818[a];[1:v]scale=460:818[b];[2:v]scale=460:818[c];[3:v]scale=460:818[d];[a][b][c][d]hstack=inputs=4,pad=iw+50:ih+40:25:20:color=0x0c0b08",
  `${dir}comparativo-frentes.png`], { stdio:"ignore" });
console.log("\nOK → _amostra/reel/batch/ (reel-*.mp4 + comparativo-frentes.png)");
