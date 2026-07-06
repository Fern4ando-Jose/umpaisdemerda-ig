// Renderiza um CARROSSEL completo (5 slides) via /api/og — teste do post inteiro.
// Uso: node scripts/render-carrossel-teste.mjs   (com `npm run dev` rodando)
import { writeFile, mkdir } from "node:fs/promises";

const BASE = "http://localhost:3000/api/og";
const OUT = new URL("../_amostra/carrossel/", import.meta.url);
const cat = "network", ed = "08", total = "5", lang = "pt";

const SLIDES = [
  { f: "1-capa.png",    qs: { slide: "cover", title: "Eles não representam você. Eles vivem de você.", stamp: "Casta vitalícia" } },
  { f: "2-insight.png", qs: { slide: "insight", num: "2", text: "Toda crise é sua. O salário deles nunca atrasou, nunca caiu, nunca sumiu." } },
  { f: "3-insight.png", qs: { slide: "insight", num: "3", text: "Eles não disputam o poder com você. Disputam entre si quem vai te ordenhar." } },
  { f: "4-insight.png", qs: { slide: "insight", num: "4", text: "Servidor que mora em palácio não serve você — se serve de você." } },
  { f: "5-cta.png",     qs: { slide: "cta", text: "Quanto tempo você ainda vai sustentar quem só te chama de patrão na propaganda?" } },
];

await mkdir(OUT, { recursive: true });
for (const s of SLIDES) {
  const qs = new URLSearchParams({ cat, ed, total, lang, ...s.qs });
  const res = await fetch(`${BASE}?${qs.toString()}`);
  if (!res.ok) { console.log(`✗ ${s.f}: HTTP ${res.status} — ${await res.text()}`); continue; }
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(new URL(s.f, OUT), buf);
  console.log(`✓ ${s.f}  (${(buf.length / 1024).toFixed(0)} KB)`);
}
console.log("Carrossel em _amostra/carrossel/");
