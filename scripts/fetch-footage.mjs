// ─── Busca de footage de banco (Pexels) ───────────────────────────────────────
// Escolhe 2-3 clipes de VÍDEO REAL (filmado) na Pexels a partir do tema do dia e
// grava as URLs em props.clips dentro do reel-props.json. O Reel usa esses
// clipes como fundo em movimento (graded p/ a paleta da marca). Movimento real,
// custo ZERO (Pexels é grátis).
//
// CAMADA: criação (não automação). NÃO-FATAL: sem PEXELS_API_KEY, sem match ou
// erro de rede → sai 0 sem clips, e o Reel cai no fallback (ilustração estática).
//
// Uso:  PEXELS_API_KEY=... node scripts/fetch-footage.mjs --props=reel-props.json

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
const NUM_CLIPS = Math.max(1, Math.min(6, Number(process.env.FOOTAGE_NUM_CLIPS || "5")));
const PER_PAGE = 20;

const propsArg = process.argv.find((a) => a.startsWith("--props="));
const PROPS_PATH = resolve(process.cwd(), propsArg ? propsArg.slice("--props=".length) : "reel-props.json");

// FALLBACK por CATEGORIA — só usado se o Claude não mandar videoQueries no tema.
// Cenas POLÍTICAS/ECONÔMICAS filmáveis (pilar da conta), não literais. Mapa de
// cats: freedom=LIBERDADE · self=O SERVO · network=A CASTA · anxiety=O ESTADO ·
// dopamine=PÃO E CIRCO · mind=O DESPERTAR. Em inglês (Pexels indexa melhor assim).
const CAT_TERMS = {
  freedom: ["person walking away open road", "breaking free chains hands", "open gate field sunrise", "person standing tall confident"],
  dopamine: ["circus tent lights crowd", "crowd cheering stadium", "fireworks night crowd", "carnival lights people"],
  anxiety: ["worker counting coins table", "long queue people waiting line", "hand holding empty wallet", "stack of bills paperwork desk"],
  network: ["business men suits handshake", "luxury banquet rich dinner", "empty government chamber seats", "wealthy elite champagne toast"],
  self: ["tired worker head down", "man carrying heavy load", "kneeling silhouette dark", "exhausted person sitting alone"],
  mind: ["person waking looking out window", "crowd walking busy city", "serious person thinking", "sunrise over city skyline"],
};

function log(m) {
  console.log(`[footage] ${m}`);
}

// Hash estável (FNV-1a) p/ derivar um seed de diversificação por render.
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Rotaciona um array por n posições (não-destrutivo). Usado p/ variar QUAL clipe
// abre o Reel entre renders, sem mudar o conjunto de candidatos.
function rotate(arr, n) {
  if (!Array.isArray(arr) || arr.length <= 1) return arr || [];
  const k = ((n % arr.length) + arr.length) % arr.length;
  return arr.slice(k).concat(arr.slice(0, k));
}
// Sempre 0: footage é opcional (fallback p/ ilustração estática).
function done(reason) {
  if (reason) log(reason);
  process.exit(0);
}

// Escolhe o melhor arquivo de vídeo de um item Pexels: retrato, ~1080p (evita 4K
// pesado no render do CI). Prefere altura >= largura e largura <= 1440.
function pickFile(video) {
  const files = (video.video_files || []).filter((f) => f.link && f.width && f.height);
  if (!files.length) return null;
  const portrait = files.filter((f) => f.height >= f.width);
  const pool = portrait.length ? portrait : files;
  // ordena por proximidade de 1080 de largura, preferindo <= 1440
  pool.sort((a, b) => {
    const sa = (a.width <= 1440 ? 0 : 1) * 1e6 + Math.abs(a.width - 1080);
    const sb = (b.width <= 1440 ? 0 : 1) * 1e6 + Math.abs(b.width - 1080);
    return sa - sb;
  });
  return pool[0].link;
}

async function searchTerm(term) {
  const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(term)}&orientation=portrait&size=medium&per_page=${PER_PAGE}`;
  const res = await fetch(url, { headers: { Authorization: PEXELS_API_KEY } });
  if (!res.ok) {
    log(`busca "${term}" HTTP ${res.status}`);
    return [];
  }
  const data = await res.json().catch(() => ({}));
  const vids = Array.isArray(data.videos) ? data.videos : [];
  // só retrato com duração decente (>=4s)
  return vids.filter((v) => v.height >= v.width && (v.duration || 0) >= 4);
}

async function main() {
  if (!existsSync(PROPS_PATH)) return done(`props ${PROPS_PATH} ausente — nada a buscar`);
  let props;
  try {
    props = JSON.parse(readFileSync(PROPS_PATH, "utf8"));
  } catch (e) {
    return done(`reel-props.json inválido (${e?.message || e}) — sem footage`);
  }
  // A API (/api/publish?preview=1) já resolve o footage COMPARTILHADO entre ES e
  // PT (mesmo vídeo) e o entrega em props.clips. Se veio de lá, não buscamos de
  // novo — isto aqui vira só o FALLBACK de CI (quando a API não trouxe clipes).
  if (Array.isArray(props.clips) && props.clips.length) {
    return done(`clips já vieram da API (base compartilhada, ${props.clips.length}) — pulando Pexels`);
  }
  if (!PEXELS_API_KEY) return done("PEXELS_API_KEY ausente — sem footage (fallback ilustração estática)");

  // Prioridade: termos no tema gerados pelo Claude (videoQueries) → fallback cat.
  const cat = props.cat || "freedom";
  const fromClaude = Array.isArray(props.videoQueries) ? props.videoQueries.filter((t) => typeof t === "string" && t.trim()) : [];
  const fallback = (CAT_TERMS[cat] || CAT_TERMS.freedom).slice();
  log(fromClaude.length ? `videoQueries do Claude: ${fromClaude.join(" | ")}` : `(sem videoQueries) fallback cat "${cat}": ${fallback.join(" | ")}`);

  // Seed de DIVERSIFICAÇÃO por render: dois posts com o MESMO tema (ex.: ES e PT do
  // mesmo run, ou o mesmo run em dias diferentes) não devem abrir com o MESMO clipe
  // da Pexels. ed (nº de edição, muda a cada post), handle (conta) e o dia variam por
  // render → seed distinto → ordem dos candidatos rotacionada → clipe de abertura
  // diferente. Sem DB, sem estado; só evita a colisão determinística.
  const day = new Date().toISOString().slice(0, 10);
  const seed = hashStr(`${props.handle || ""}|${props.ed || ""}|${props.title || ""}|${day}`);
  log(`seed de diversificação=${seed} (handle=${props.handle || "?"} ed=${props.ed || "?"} dia=${day})`);

  try {
    const picked = [];
    const seenVideoIds = new Set();

    // Round-robin entre os termos: pega 1 clipe de CADA termo por passada, depois
    // volta ao 1º para a 2ª passada, etc. Mantém os clipes NO TEMA e DIVERSOS —
    // em vez de esvaziar o 1º termo (4 clipes da mesma busca) ou cair no fallback
    // genérico (o "último clipe fora de contexto"). Só usa o fallback de categoria
    // depois de esgotar as queries do Claude.
    async function harvest(termList) {
      // Pré-carrega as buscas e mantém um cursor por termo (fila de candidatos).
      const queues = [];
      for (let t = 0; t < termList.length; t++) {
        if (picked.length >= NUM_CLIPS) break;
        const term = termList[t];
        // Rotaciona os candidatos por (seed + termo) → abertura varia entre renders.
        const vids = rotate(await searchTerm(term), seed + t * 7);
        queues.push({ term, vids, i: 0 });
      }
      let progressed = true;
      while (picked.length < NUM_CLIPS && progressed) {
        progressed = false;
        for (const q of queues) {
          if (picked.length >= NUM_CLIPS) break;
          // avança no termo até achar um vídeo novo com arquivo utilizável
          while (q.i < q.vids.length) {
            const v = q.vids[q.i++];
            if (seenVideoIds.has(v.id)) continue;
            const link = pickFile(v);
            if (!link) continue;
            seenVideoIds.add(v.id);
            picked.push(link);
            progressed = true;
            log(`+ clipe (${q.term}) id=${v.id} ${v.width}x${v.height} ${v.duration}s`);
            break;
          }
        }
      }
    }

    // 1ª escolha: só as queries do Claude (no tema). Pode render < NUM_CLIPS.
    if (fromClaude.length) await harvest(fromClaude);
    // Fallback de categoria (genérico) só entra se o Claude rendeu ZERO clipes.
    // Se rendeu >=1, NÃO misturamos clipe genérico: o Reel.tsx cicla os clipes no
    // tema (a cena final reusa um deles), evitando o "último clipe fora de contexto".
    if (!picked.length) {
      if (fromClaude.length) log(`Claude rendeu 0 clipes — caindo no fallback cat "${cat}"`);
      await harvest(fallback);
    } else if (picked.length < NUM_CLIPS) {
      log(`Claude rendeu ${picked.length} clipe(s) no tema (< ${NUM_CLIPS}) — Reel cicla os do tema, sem fallback genérico`);
    }

    if (!picked.length) return done("nenhum clipe encontrado na Pexels — fallback ilustração estática");

    props.clips = picked;
    writeFileSync(PROPS_PATH, JSON.stringify(props));
    log(`${picked.length} clipe(s) gravados em props.clips`);

    // Writeback: ESTA conta achou footage no fallback do CI → grava na base
    // compartilhada pra a 2ª conta (PT dispara 5 min depois) REUSAR o MESMO
    // vídeo. Sem isso, ES e PT divergiam (um com footage, outro preto). Só roda
    // quando há topic + CRON_SECRET; best-effort (falha não quebra o render).
    await shareClips(props, picked);
  } catch (e) {
    return done(`exceção: ${e?.message || e} — sem footage`);
  }
  return done();
}

// Compartilha o footage achado aqui com a outra conta (via /api/reel-share).
async function shareClips(props, clips) {
  const secret = process.env.CRON_SECRET;
  const topic = props.topic;
  if (!secret || !topic) {
    return log(`writeback pulado (${!secret ? "sem CRON_SECRET" : "sem topic nos props"}) — footage não compartilhado`);
  }
  const base = process.env.PRODUCTION_URL || "https://www.drlibertad.com";
  const day = new Date().toISOString().slice(0, 10); // UTC, igual a dayUTC()
  try {
    const res = await fetch(`${base}/api/reel-share`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
      body: JSON.stringify({ topic, day, clips, videoQueries: props.videoQueries || [] }),
    });
    log(`writeback /api/reel-share → HTTP ${res.status} (footage compartilhado p/ a 2ª conta)`);
  } catch (e) {
    log(`writeback falhou (${e?.message || e}) — segue sem compartilhar`);
  }
}

main();
