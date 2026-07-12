// Coletor de pauta semanal — Um País de Merda
// Puxa as manchetes da semana (Google News RSS, público, grátis, sem chave) nas
// 4 frentes: Executivo, Legislativo, Judiciário e Crime organizado / narco-Estado.
// Uso:
//   node scripts/coletor-pauta.mjs            → lista, marcando 🆕 o que é inédito
//   node scripts/coletor-pauta.mjs --only-new → só as manchetes inéditas
//   node scripts/coletor-pauta.mjs --dry      → não persiste (não marca como visto)
//   node scripts/coletor-pauta.mjs --reset    → zera o histórico de dedup e sai
// Saída: lista por frente (título + fonte + data). NÃO publica nada — é insumo de
// curadoria. O que vira post é decidido depois e SEM nomear pessoas (régua da conta).
//
// DEDUP VERSIONADO: cada manchete vira um hash estável (FNV-1a do título
// normalizado) guardado em `data/pauta-seen.json`. Manchetes já vistas em rodadas
// anteriores saem marcadas "(visto)"; assim a curadoria semanal foca no que é novo.
// O arquivo é versionado (a Action commita de volta) → o dedup persiste entre runs.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEEN_PATH = resolve(__dirname, "..", "data", "pauta-seen.json");
const SEEN_CAP = 1000; // mantém os N hashes mais recentes (evita crescimento sem-fim)
// Pauta da SEMANA — manchetes frescas por frente que o app lê para gerar posts
// da 2ª frente (corrupção atual). NÃO é o post: é o insumo que a IA abstrai num
// ataque ao PADRÃO, apartidário e SEM nomes (trava no publish/route.ts).
const PAUTA_SEMANA_PATH = resolve(__dirname, "..", "data", "pauta-semana.json");
const PAUTA_POR_FRENTE = 5; // guarda até N manchetes novas por frente

const FRENTES = [
  { id: "Executivo",  q: '(governo federal OR Planalto OR presidência OR ministério OR "gasto público") when:7d' },
  { id: "Legislativo", q: '(Congresso OR Câmara dos Deputados OR Senado OR "emenda parlamentar" OR "aumento salarial" deputado OR senador) when:7d' },
  { id: "Judiciário",  q: '(STF OR "Supremo Tribunal" OR judiciário OR "auxílio" magistrado OR "penduricalho") when:7d' },
  { id: "Crime/Narco", q: '(crime organizado OR facção OR narcotráfico OR milícia OR "lavagem de dinheiro") Brasil when:7d' },
];

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) UmPaisDeMerdaBot/1.0";
const args = process.argv.slice(2);
const ONLY_NEW = args.includes("--only-new");
const DRY = args.includes("--dry");

function decode(s) {
  return s
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ")
    .trim();
}

// Hash estável (FNV-1a) do título NORMALIZADO (minúsculo, sem acento, sem
// pontuação, espaços colapsados) → variações triviais da mesma manchete colidem.
function normalize(s) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}
function hashStr(s) {
  let h = 2166136261;
  const n = normalize(s);
  for (let i = 0; i < n.length; i++) { h ^= n.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}

function loadSeen() {
  if (!existsSync(SEEN_PATH)) return [];
  try {
    const j = JSON.parse(readFileSync(SEEN_PATH, "utf8"));
    return Array.isArray(j.hashes) ? j.hashes : [];
  } catch { return []; }
}
function saveSeen(hashes) {
  mkdirSync(dirname(SEEN_PATH), { recursive: true });
  const trimmed = hashes.slice(-SEEN_CAP); // mantém os mais recentes
  writeFileSync(SEEN_PATH, JSON.stringify({ hashes: trimmed }, null, 0) + "\n");
}

function parseItems(xml) {
  const items = [];
  const blocks = xml.split(/<item>/).slice(1);
  for (const b of blocks) {
    const title = decode((b.match(/<title>(.*?)<\/title>/s) || [])[1] || "");
    const date  = decode((b.match(/<pubDate>(.*?)<\/pubDate>/s) || [])[1] || "");
    // Google News põe a fonte no fim do título depois de " - "
    const m = title.match(/^(.*?)\s+-\s+([^-]+)$/);
    const titulo = m ? m[1].trim() : title;
    items.push({ titulo, fonte: m ? m[2].trim() : "", data: date, h: hashStr(titulo) });
  }
  return items;
}

async function fetchFrente(f) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(f.q)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA } });
    if (!r.ok) return { ...f, erro: `HTTP ${r.status}`, items: [] };
    const xml = await r.text();
    return { ...f, items: parseItems(xml).slice(0, 10) };
  } catch (e) {
    return { ...f, erro: String(e), items: [] };
  }
}

// ─── --reset ──────────────────────────────────────────────────────────────────
if (args.includes("--reset")) {
  saveSeen([]);
  console.log(`histórico de dedup zerado → ${SEEN_PATH}`);
  process.exit(0);
}

const seen = new Set(loadSeen());
const out = await Promise.all(FRENTES.map(fetchFrente));

let novos = 0, vistos = 0;
const novosHashes = [];
const pautaFrentes = {}; // { frente: [titulos NOVOS] } → data/pauta-semana.json
for (const f of out) {
  console.log(`\n========== ${f.id} ==========`);
  if (f.erro) { console.log(`  (erro: ${f.erro})`); continue; }
  const lista = ONLY_NEW ? f.items.filter((it) => !seen.has(it.h)) : f.items;
  if (!lista.length) { console.log(ONLY_NEW ? "  (nada novo)" : "  (sem resultados)"); continue; }
  lista.forEach((it, i) => {
    const isNew = !seen.has(it.h);
    if (isNew) {
      novos++; novosHashes.push(it.h);
      (pautaFrentes[f.id] ??= []).push(it.titulo);
    } else { vistos++; }
    const tag = isNew ? "🆕" : "  ";
    console.log(`  ${tag} ${String(i + 1).padStart(2, " ")}. ${it.titulo}`);
    console.log(`        — ${it.fonte}${it.data ? "  ·  " + it.data : ""}`);
  });
  if (pautaFrentes[f.id]) pautaFrentes[f.id] = pautaFrentes[f.id].slice(0, PAUTA_POR_FRENTE);
}

// Grava a pauta da semana (manchetes NOVAS por frente) que o app lê p/ a 2ª frente.
// Só quando há novidade e não é --dry; senão mantém a última pauta.
if (!DRY && novos > 0) {
  mkdirSync(dirname(PAUTA_SEMANA_PATH), { recursive: true });
  writeFileSync(PAUTA_SEMANA_PATH, JSON.stringify({ atualizado: new Date().toISOString(), frentes: pautaFrentes }, null, 2) + "\n");
  console.log(`pauta da semana gravada (${novos} manchetes) → data/pauta-semana.json`);
}

console.log(`\nResumo: ${novos} novas · ${vistos} já vistas.`);
console.log("(insumo de curadoria — o post é decidido depois, atacando o PADRÃO, sem nomear pessoas)");

// Persiste os novos hashes (append) — a menos que --dry. Sem isso, o dedup não
// avança entre rodadas.
if (!DRY && novosHashes.length) {
  saveSeen([...loadSeen(), ...novosHashes]);
  console.log(`dedup atualizado: +${novosHashes.length} hashes → data/pauta-seen.json`);
}
