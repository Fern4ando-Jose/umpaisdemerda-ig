// ─── Geração das trilhas do Reel — UMA FAIXA POR TEMA ─────────────────────────
// Gera uma trilha instrumental por TEMA (os 51 de THEMES) e grava em
// public/music/bed-<NN>-<slug>.mp3, além de um public/music/manifest.json que
// mapeia  topic → arquivo. O pipeline (pick-music.cjs) escolhe a faixa pelo TEMA
// do post (não pelo slot/run), então cada tema tem som próprio e — como o tema
// reaparece a cada ~8 dias — a mesma faixa só volta junto com o tema.
//
// REUSO PRA SEMPRE: por padrão PULA temas que já têm arquivo (gera só o que
// falta). Quando um tema repete, NADA é regenerado: o picker reusa o mp3 já
// commitado. Use --force pra regenerar mesmo os existentes.
//
// FONTE ÚNICA: os 51 temas são EXTRAÍDOS de src/app/api/publish/route.ts (THEMES),
// nunca duplicados aqui — impossível dessincronizar da lista de produção.
//
// CAMADA: criação, AUTHOR-TIME (NÃO roda no CI). Roda na máquina do dono, committa
// os mp3 + manifest. CI usa os arquivos commitados (zero custo).
// Custo: ~US$0,05/faixa na fal (uma vez por tema).
//
// Uso:
//   node scripts/generate-music.mjs --list              # SÓ imprime temas+prompts (grátis)
//   FAL_KEY=... node scripts/generate-music.mjs --only=0      # gera só o tema índice 0 (teste, ~US$0,05)
//   FAL_KEY=... node scripts/generate-music.mjs               # gera os que FALTAM (pula existentes)
//   FAL_KEY=... node scripts/generate-music.mjs --force       # regenera TODOS (~US$2,55)
//   FAL_KEY=... node scripts/generate-music.mjs --only=soledad # gera os temas cujo topic casa "soledad"
//
// Requer ffmpeg no PATH (transcodifica o wav da fal p/ mp3 leve no repo público).

import { writeFileSync, readFileSync, mkdirSync, existsSync, statSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

const arg = (name, def) => {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const has = (name) => process.argv.includes(`--${name}`);

const LIST_ONLY = has("list");
const FORCE = has("force");
const ONLY = arg("only", null); // índice exato OU substring do topic
const SECS = Math.max(20, Number(arg("secs", "28")) || 28);

const MODEL = "cassetteai/music-generator";
const ROUTE = resolve(process.cwd(), "src", "app", "api", "publish", "route.ts");
const OUT_DIR = resolve(process.cwd(), "public", "music");
const MANIFEST = resolve(OUT_DIR, "manifest.json");

// ── Mood por PILAR (rico, cinematográfico, instrumental, sem vocais) ──────────
// A marca é literária/sóbria; aqui a produção fica mais cheia (camadas, textura,
// dinâmica), mantendo o tom. Cada pilar tem uma atmosfera; a variação por tema
// vem do "lead" (instrumento em destaque) rotacionado por índice dentro do pilar.
const PILLAR_MOOD = {
  1: // Dopamina e seus seguimentos — sedução brilhante que se esvazia
    "lush cinematic neo-classical, bright shimmering mallets and a pulsing synth arpeggio that swells seductively then hollows out into sparse echo; warm analog bass, tape saturation, restrained brushed pulse; the tension between bright stimulation and emptiness; around 90 bpm",
  2: // Redes sociais e o fim dos relacionamentos — intimidade que esfria
    "intimate cinematic piano and felt textures, a tender melody that slowly turns glassy and distant; cold reverb tails, subtle vinyl crackle, soft sub bass; the ache of closeness replaced by a screen's distance; slow, around 70 bpm",
  3: // A guerra invisível do Homem — solidão pesada e digna
    "somber cinematic strings and low cello over a lone piano, dignified and heavy with restrained emotional swell; deep warm bass, soft timpani heartbeat; quiet masculine solitude and resilience; slow and building, around 65 bpm",
  4: // Verdades incômodas — áspero, confrontador, que se resolve em firmeza
    "stark minimal piano with firm staccato and a confrontational low pulse that resolves into grounded resolve; analog warmth, sparse percussive ticks, tension chords releasing; an uncomfortable truth turning into clarity; around 85 bpm",
  5: // Liberdade e o direito de falar — expansivo, desafiador, que se abre
    "expansive cinematic build with rising strings, bright piano and an uplifting defiant swell breaking into open air; warm pads, hopeful resolution, gentle propulsive pulse; liberation and the courage to speak; around 100 bpm with a crescendo",
};

// Lead rotacionado por índice DENTRO do pilar (9 por pilar) → 9 faixas distintas.
const LEADS = [
  "solo piano lead",
  "warm electric Rhodes lead",
  "plucked celesta and harp accents",
  "warm analog synth lead",
  "bowed solo cello lead",
  "soft muted electric guitar lead",
  "glassy marimba and music-box accents",
  "wordless ambient choir pads (no lyrics, no singing words)",
  "felt-piano lead with airy strings",
];

// Override de instrumentação POR TEMA (vence o LEAD rotacionado do pilar). Usado
// p/ dar piano + violino (e harmônica/gaita-de-boca em alguns) aos 6 temas novos
// do Pilar 2. Chave = topic exato em THEMES (route.ts).
const LEAD_OVERRIDE = {
  "El filtro que te vendió una belleza que no existe": "intimate solo piano lead with a singing solo violin countermelody",
  "Cientos de likes en la foto, nadie en la vida real": "solo piano and an aching solo violin over a distant lonely harmonica",
  "En la foto haces match; en la cita aparece otra persona": "delicate solo piano lead with a wistful solo violin",
  "Te enamoras de una edición y cenas con la realidad": "felt solo piano lead with a tender solo violin",
  "La ilusión de opciones infinitas te deja solo": "sparse solo piano and solo violin with a faint wandering harmonica",
  "Pasas más tiempo eligiendo que viviendo": "minimal solo piano lead with a restless solo violin",
};

const SHARED = "purely instrumental, no vocals, no spoken word, no lyrics; cohesive brand sound, organic and analog, high production value, cinematic, loopable, suitable as a background bed";

// ── Slug estável a partir do topic (acentos fora, alfanumérico → hífen) ───────
function slugify(s) {
  return s
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // tira acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 56);
}

// ── Extrai os 45 temas (pilar + topic) de THEMES no route.ts (fonte única) ────
function parseThemes() {
  const src = readFileSync(ROUTE, "utf8");
  const start = src.indexOf("const THEMES");
  const open = src.indexOf("[", start);
  const close = src.indexOf("\n];", open);
  if (start < 0 || open < 0 || close < 0) throw new Error("Bloco THEMES não encontrado em route.ts");
  const block = src.slice(open, close);

  const themes = [];
  let pillar = 0;
  for (const line of block.split("\n")) {
    const pil = /\/\/\s*──\s*Pilar\s+(\d+)/.exec(line);
    if (pil) { pillar = Number(pil[1]); continue; }
    const m = /\{\s*topic:\s*"((?:[^"\\]|\\.)*)"/.exec(line);
    if (m) themes.push({ topic: m[1], pillar });
  }
  if (themes.length < 1) throw new Error("Nenhum tema extraído de THEMES");
  return themes;
}

// Constrói {index, topic, pillar, lead, file, prompt} pra cada tema.
function buildSpecs() {
  const themes = parseThemes();
  // posição dentro do pilar → escolhe o lead (variação)
  const seenInPillar = new Map();
  return themes.map((t, i) => {
    const k = seenInPillar.get(t.pillar) ?? 0;
    seenInPillar.set(t.pillar, k + 1);
    const lead = LEAD_OVERRIDE[t.topic] ?? LEADS[k % LEADS.length];
    const mood = PILLAR_MOOD[t.pillar] || PILLAR_MOOD[5];
    const nn = String(i).padStart(2, "0");
    const file = `bed-${nn}-${slugify(t.topic)}.mp3`;
    const prompt = `${mood}; featured texture: ${lead}; ${SHARED}`;
    return { index: i, topic: t.topic, pillar: t.pillar, lead, file, prompt };
  });
}

// ── fal: fila (submete, pollra, busca) ────────────────────────────────────────
const FAL_KEY = process.env.FAL_KEY;
const AUTH = { Authorization: `Key ${FAL_KEY}`, "Content-Type": "application/json" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function falSubmit(prompt) {
  const res = await fetch(`https://queue.fal.run/${MODEL}`, {
    method: "POST", headers: AUTH, body: JSON.stringify({ prompt, duration: SECS }),
  });
  if (!res.ok) throw new Error(`submit HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  if (!j.status_url || !j.response_url) throw new Error(`submit sem urls: ${JSON.stringify(j).slice(0, 200)}`);
  return { statusUrl: j.status_url, responseUrl: j.response_url };
}

async function falResult({ statusUrl, responseUrl }, timeoutMs = 12 * 60 * 1000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await sleep(5000);
    const st = await fetch(statusUrl, { headers: AUTH }).then((r) => r.json()).catch(() => ({}));
    if (st.status === "COMPLETED") break;
    if (st.status === "FAILED" || st.status === "ERROR") throw new Error(`fal status ${st.status}`);
  }
  const data = await fetch(responseUrl, { headers: AUTH }).then((r) => r.json());
  const url = data?.audio_file?.url || data?.audio?.url || data?.url;
  if (!url) throw new Error(`resultado sem URL: ${JSON.stringify(data).slice(0, 200)}`);
  return url;
}

async function download(url, path) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(path, buf);
  return buf.length;
}

// Reconstrói o manifest com TODOS os temas que têm arquivo no disco (completo,
// mesmo após um --only). topic → caminho staticFile ("music/bed-..mp3").
function writeManifest(specs) {
  const map = {};
  for (const s of specs) {
    if (existsSync(resolve(OUT_DIR, s.file))) map[s.topic] = `music/${s.file}`;
  }
  writeFileSync(MANIFEST, JSON.stringify(map, null, 2) + "\n");
  return Object.keys(map).length;
}

function selectSpecs(specs) {
  if (ONLY == null) return specs;
  // intervalo "a-b" → índices a..b (inclusive)
  const range = /^(\d+)-(\d+)$/.exec(ONLY);
  if (range) {
    const [a, b] = [Number(range[1]), Number(range[2])].sort((x, y) => x - y);
    return specs.filter((s) => s.index >= a && s.index <= b);
  }
  // lista "a,b,c" → esses índices
  if (/^\d+(,\d+)+$/.test(ONLY)) {
    const set = new Set(ONLY.split(",").map(Number));
    return specs.filter((s) => set.has(s.index));
  }
  // índice único
  if (/^\d+$/.test(ONLY)) return specs.filter((s) => s.index === Number(ONLY));
  // substring do topic
  const needle = ONLY.toLowerCase();
  return specs.filter((s) => s.topic.toLowerCase().includes(needle));
}

async function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  const specs = buildSpecs();

  if (LIST_ONLY) {
    console.log(`[music] ${specs.length} temas (fonte: route.ts). Prompts por tema:\n`);
    for (const s of selectSpecs(specs)) {
      console.log(`  [${String(s.index).padStart(2, "0")}] P${s.pillar} ${s.topic}\n        → ${s.file}\n        → ${s.prompt}\n`);
    }
    console.log(`[music] --list não gasta nada. Para gerar: FAL_KEY=... node scripts/generate-music.mjs --only=0`);
    return;
  }

  if (!FAL_KEY) {
    console.error("[music] FAL_KEY ausente — abortando (geração é paga). Use --list para revisar os prompts sem gastar.");
    process.exit(1);
  }

  // Alvo: o subconjunto pedido, pulando os que já existem (a não ser --force).
  let targets = selectSpecs(specs);
  const before = targets.length;
  if (!FORCE) targets = targets.filter((s) => !existsSync(resolve(OUT_DIR, s.file)));
  const skipped = before - targets.length;
  if (skipped) console.log(`[music] pulando ${skipped} tema(s) já gerado(s) (use --force pra regenerar).`);
  if (!targets.length) {
    const n = writeManifest(specs);
    console.log(`[music] nada a gerar. manifest.json reescrito (${n} temas mapeados).`);
    return;
  }
  console.log(`[music] submetendo ${targets.length} faixa(s) de ${SECS}s na fila (${MODEL})  ≈ US$${(targets.length * 0.05).toFixed(2)}`);

  // 1. Submete tudo de uma vez (esperas de fila se sobrepõem).
  const jobs = await Promise.all(targets.map(async (s) => {
    try {
      const handle = await falSubmit(s.prompt);
      console.log(`[music] [${s.index}] enfileirada — ${s.topic}`);
      return { s, handle };
    } catch (e) {
      console.error(`[music] [${s.index}] submit FALHOU: ${e?.message || e}`);
      return { s, handle: null };
    }
  }));

  // 2. Aguarda, baixa, transcodifica + normaliza loudness (consistência).
  let ok = 0;
  for (const { s, handle } of jobs) {
    if (!handle) continue;
    const tmpWav = resolve(OUT_DIR, `.${s.file}.tmp.wav`);
    const outMp3 = resolve(OUT_DIR, s.file);
    try {
      const url = await falResult(handle);
      const bytes = await download(url, tmpWav);
      execFileSync("ffmpeg", ["-y", "-i", tmpWav, "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-b:a", "128k", outMp3], { stdio: "ignore" });
      rmSync(tmpWav, { force: true });
      const kb = Math.round(statSync(outMp3).size / 1024);
      console.log(`[music] [${s.index}] ok → public/music/${s.file} (${kb} KB; wav ${Math.round(bytes / 1024)} KB)`);
      ok++;
    } catch (e) {
      rmSync(tmpWav, { force: true });
      console.error(`[music] [${s.index}] FALHOU: ${e?.message || e}`);
    }
  }

  const mapped = writeManifest(specs);
  console.log(`[music] concluído: ${ok}/${targets.length} gerada(s). manifest.json: ${mapped}/${specs.length} temas mapeados.`);
  console.log(`[music] testar a seleção: node scripts/pick-music.cjs --topic="${specs[0].topic}"`);
}

main();
