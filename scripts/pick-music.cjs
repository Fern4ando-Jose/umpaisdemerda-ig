// ─── Seleção da trilha do Reel — UMA FAIXA POR TEMA ──────────────────────────
// Por quê: cada TEMA tem som próprio. O gerador (scripts/generate-music.mjs)
// produz bed-<NN>-<slug>.mp3 por tema e um manifest.json (topic → arquivo).
// Aqui escolhemos a faixa pelo TEMA do post — quando o tema repete (a cada ~8
// dias), o picker reusa o MESMO arquivo já commitado (nada regenera).
//
// FAIL-OPEN (não quebra a automação):
//   1. tema no manifest e arquivo no disco → usa a faixa do tema;
//   2. senão → rotação ANTIGA por `run` entre bed-0.mp3, bed-1.mp3, … (se houver);
//   3. senão → bed.wav/bed.mp3 única;
//   4. nada → "" (Reel renderiza mudo, como antes).
//
// Uso CLI:
//   node scripts/pick-music.cjs --topic="La soledad masculina que nadie ve"
//   node scripts/pick-music.cjs --run=2          # legado (sem tema)
// Uso lib:
//   require("./scripts/pick-music.cjs").pickMusic({ topic, run })  → "music/bed-..mp3" | ""
//   require("./scripts/pick-music.cjs").pickMusic(2)               → legado por run

const fs = require("node:fs");
const path = require("node:path");

const MUSIC_DIR = path.resolve(__dirname, "..", "public", "music");
const MANIFEST = path.join(MUSIC_DIR, "manifest.json");
// bed.wav / bed.mp3 (base) e bed-<n>.wav / bed-<n>.mp3 (legado, rotação por run).
// NÃO casa bed-<NN>-<slug>.mp3 (faixas por tema) — essas só vêm via manifest.
const RE = /^bed(?:-(\d+))?\.(wav|mp3)$/i;

// topic → "music/bed-..mp3" lido do manifest (gerado por generate-music.mjs).
function readManifest() {
  try {
    return JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  } catch {
    return {};
  }
}

// Lista as faixas LEGADO (bed.* e bed-<n>.*), deduplicando por número (.wav > .mp3).
function listBeds() {
  let files;
  try {
    files = fs.readdirSync(MUSIC_DIR);
  } catch {
    return { numbered: [], base: null };
  }
  const byNum = new Map();
  let base = null;
  for (const f of files) {
    const m = RE.exec(f);
    if (!m) continue;
    const isWav = m[2].toLowerCase() === "wav";
    if (m[1] === undefined) {
      if (!base || isWav) base = f;
    } else {
      const n = Number(m[1]);
      const cur = byNum.get(n);
      if (!cur || isWav) byNum.set(n, f);
    }
  }
  const numbered = [...byNum.keys()].sort((a, b) => a - b).map((n) => byNum.get(n));
  return { numbered, base };
}

// Fallback legado: rotação por run entre as faixas numeradas / base.
function pickByRun(run) {
  const r = Number.isFinite(Number(run)) ? Math.abs(Math.trunc(Number(run))) : 0;
  const { numbered, base } = listBeds();
  const pool = numbered.length ? numbered : base ? [base] : [];
  if (!pool.length) return "";
  return `music/${pool[r % pool.length]}`;
}

// Escolhe a trilha. Aceita:
//   • objeto { topic, run }  → tenta tema (manifest); senão run
//   • string                 → tratada como topic
//   • número                 → legado por run
function pickMusic(input) {
  let topic = null;
  let run = 0;
  if (input && typeof input === "object") {
    topic = input.topic != null ? String(input.topic) : null;
    run = input.run;
  } else if (typeof input === "string" && !/^\d+$/.test(input)) {
    topic = input;
  } else {
    run = input;
  }

  if (topic) {
    const file = readManifest()[topic];
    if (file && fs.existsSync(path.resolve(MUSIC_DIR, "..", file))) return file;
  }
  return pickByRun(run);
}

module.exports = { pickMusic, listBeds, readManifest };

// CLI: imprime o caminho (ou linha vazia).
if (require.main === module) {
  const argv = process.argv.slice(2);
  const get = (name) => {
    const a = argv.find((x) => x.startsWith(`--${name}=`));
    return a ? a.slice(name.length + 3) : undefined;
  };
  const topic = get("topic");
  const run = get("run") ?? process.env.RUN ?? "0";
  process.stdout.write(pickMusic(topic != null ? { topic, run } : run));
}
