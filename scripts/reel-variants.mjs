// Gera a MESMA cena de reel em 3 variantes de fonte/destaque, sobre o footage.
// Uso: node scripts/reel-variants.mjs   (com `npm run dev` e _amostra/reel/clip.mp4)
import { writeFile, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const OG = "http://localhost:3000/api/og";
const OUT = new URL("../_amostra/reel/", import.meta.url);
const dir = fileURLToPath(OUT);
await mkdir(OUT, { recursive: true });

// fundo: um frame do clipe (1080x1920)
execFileSync("ffmpeg", ["-y", "-ss", "2", "-i", `${dir}clip.mp4`, "-frames:v", "1", "-vf", "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920", `${dir}bg.png`], { stdio: "ignore" });

const scene = {
  ed: "14",
  kicker: "O Estado · o que pagam por fora",
  title: "Eles chamam de penduricalho.",
  hl: "Você chama de 3 meses de trabalho.",
  foot: "é legendado",
};
const VARIANTS = [
  { v: "A", nome: "Anton + dourado" },
  { v: "B", nome: "Archivo Black + barra" },
  { v: "C", nome: "Oswald + sublinhado" },
];

for (const { v, nome } of VARIANTS) {
  const qs = new URLSearchParams({ slide: "reel", variant: v, ...scene });
  const r = await fetch(`${OG}?${qs}`);
  if (!r.ok) { console.log(`✗ ${v}: HTTP ${r.status} — ${await r.text()}`); continue; }
  await writeFile(new URL(`ov-${v}.png`, OUT), Buffer.from(await r.arrayBuffer()));
  execFileSync("ffmpeg", ["-y", "-i", `${dir}bg.png`, "-i", `${dir}ov-${v}.png`, "-filter_complex", "overlay=0:0", `${dir}reel-var-${v}.png`], { stdio: "ignore" });
  console.log(`✓ variante ${v} (${nome}) → reel-var-${v}.png`);
}
console.log("OK");
