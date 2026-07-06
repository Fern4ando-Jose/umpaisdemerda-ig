// Renderiza capas de teste via o motor /api/og (Next dev em :3000).
// Usa fetch do Node (UTF-8 correto) — diferente do Git Bash/curl, que mangueia acentos.
// Uso: node scripts/render-capas-teste.mjs   (com `npm run dev` rodando)
import { writeFile, mkdir } from "node:fs/promises";

const BASE = "http://localhost:3000/api/og";
const OUT = new URL("../_amostra/capas/", import.meta.url);

const CAPAS = [
  { f: "capa-casta.png",     cat: "network", ed: "08", stamp: "Casta vitalícia",   dateline: "", title: "Eles não representam você. Eles vivem de você." },
  { f: "capa-estado.png",    cat: "anxiety", ed: "09", stamp: "É lei",              dateline: "Economia · a conta do circo", title: "Você trabalha até maio só pra pagar essa palhaçada." },
  { f: "capa-imposto.png",   cat: "anxiety", ed: "11", stamp: "Pague e cale-se",    dateline: "Economia · imposto embutido", title: "Imposto é o roubo que vem com nota fiscal." },
  { f: "capa-servo.png",     cat: "self",    ed: "06", stamp: "Vergonha nacional",  dateline: "", title: "Você não é oprimido. Você é voluntário." },
  { f: "capa-narco.png",     cat: "anxiety", ed: "12", stamp: "Estado paralelo",    dateline: "Segurança · o pedágio do crime", title: "Duas máfias cobram de você: uma na nota fiscal, outra na bala." },
  { f: "capa-liberdade.png", cat: "freedom", ed: "13", stamp: "Sem anistia",        dateline: "Opinião · sem messias à vista", title: "Ninguém vem te salvar. Engole isso e levanta." },
];

await mkdir(OUT, { recursive: true });

for (const c of CAPAS) {
  const qs = new URLSearchParams({ slide: "cover", title: c.title, cat: c.cat, ed: c.ed, stamp: c.stamp, total: "5", lang: "pt" });
  if (c.dateline) qs.set("dateline", c.dateline);
  const res = await fetch(`${BASE}?${qs.toString()}`);
  if (!res.ok) { console.log(`✗ ${c.f}: HTTP ${res.status}`); continue; }
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(new URL(c.f, OUT), buf);
  console.log(`✓ ${c.f}  (${(buf.length / 1024).toFixed(0)} KB)  ${res.headers.get("content-type")}`);
}
console.log("Capas em _amostra/capas/");
