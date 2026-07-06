// Teste: footage do Pexels referente a uma notícia. Imprime SÓ os resultados
// (nunca a chave). Baixa a thumbnail do melhor clipe p/ o mockup do reel.
// Uso: PEXELS_API_KEY=... node scripts/test-footage.mjs "query1" "query2" ...
import { writeFile, mkdir } from "node:fs/promises";

const KEY = process.env.PEXELS_API_KEY;
if (!KEY) { console.log("SEM PEXELS_API_KEY"); process.exit(1); }
const queries = process.argv.slice(2);
const OUT = new URL("../_amostra/reel/", import.meta.url);
await mkdir(OUT, { recursive: true });

let savedThumb = false;
for (const q of queries) {
  const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(q)}&orientation=portrait&size=medium&per_page=5`;
  const res = await fetch(url, { headers: { Authorization: KEY } });
  console.log(`\n"${q}" → HTTP ${res.status}`);
  if (!res.ok) continue;
  const data = await res.json();
  const vids = (data.videos || []).filter(v => v.height >= v.width && (v.duration||0) >= 4);
  for (const v of vids.slice(0, 3)) {
    console.log(`  id=${v.id}  ${v.width}x${v.height}  ${v.duration}s  por ${v.user?.name||"?"}`);
  }
  if (!savedThumb && vids[0]?.image) {
    const img = await fetch(vids[0].image);
    if (img.ok) { await writeFile(new URL("footage.jpg", OUT), Buffer.from(await img.arrayBuffer())); savedThumb = true; console.log(`  ↳ thumbnail salva (id=${vids[0].id})`); }
  }
}
console.log("\nThumbnail em _amostra/reel/footage.jpg" + (savedThumb ? "" : " (não salva)"));
