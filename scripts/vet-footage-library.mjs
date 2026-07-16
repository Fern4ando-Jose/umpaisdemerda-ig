// ─── Vetagem em MASSA da biblioteca curada (footage-library.ts) ────────────────
// Espelha scripts/vet-footage-library.mjs do DR-Libertad (irmão desta
// automação). 2026-07-16: mesmo com ~147 clipes já curados (a UPM já tinha
// alguns Pixabay vídeo à mão), o acervo por pilar ainda é pequeno pro volume
// diário → repetição. Este script AMPLIA cada pilar buscando muito mais
// candidatos nas 4 fontes (Pexels vídeo/foto + Pixabay vídeo/foto, fail-open sem
// PIXABAY_API_KEY) e vetando cada um pelo MESMO juiz automático de visão que já
// existe em produção (src/lib/footage-qa.ts, Claude Haiku no poster/foto) — em
// vez de um humano assistir vídeo por vídeo. Registra quantos candidatos tentou
// vs quantos passaram, por pilar E por fonte.
//
// CUSTO REAL (Anthropic, Haiku vision, ~US$0,005/imagem — mesma tabela de
// src/lib/spend.ts): este script SEMPRE roda em modo --dry-run por padrão (só
// conta candidatos disponíveis nas 4 fontes, ZERO chamada paga) — só gasta com
// --confirm explícito, e mesmo assim imprime a estimativa de custo (e PARA se
// ultrapassar --max-usd) ANTES de qualquer chamada ao juiz. Isto é o freio de
// P2 (CLAUDE.md) embutido no próprio script — não depende de "lembrar" de pedir
// OK antes de rodar.
//
// Uso:
//   node scripts/vet-footage-library.mjs --dry-run                 (padrão — conta candidatos, custo $0)
//   node scripts/vet-footage-library.mjs --confirm --target=50     (roda o QA de verdade, escreve a whitelist)
//   node scripts/vet-footage-library.mjs --confirm --pillars=freedom,mind --target=30
//   node scripts/vet-footage-library.mjs --confirm --max-usd=5     (trava se a estimativa passar de $5)
//
// Env: PEXELS_API_KEY (obrigatória p/ achar candidatos), PIXABAY_API_KEY
// (opcional — fail-open), ANTHROPIC_API_KEY (obrigatória p/ --confirm; sem ela o
// juiz "QA pulado" aceitaria tudo, o que é PERIGOSO em vetagem em massa — este
// script recusa rodar --confirm sem ANTHROPIC_API_KEY, ao contrário do runtime
// que é fail-open por design).

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LIB_PATH = resolve(__dirname, "../src/lib/footage-library.ts");
const REPORT_PATH = resolve(__dirname, "../.footage-vet-report.json");

const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};

const CONFIRM = has("--confirm");
const DRY_RUN = !CONFIRM || has("--dry-run");
const TARGET = Math.max(1, Number(opt("target", "50")));
const MAX_USD = Number(opt("max-usd", "10"));
const PILLARS_FILTER = opt("pillars", "").split(",").map((s) => s.trim()).filter(Boolean);
const QA_COST_PER_IMAGE_USD = 0.005; // mesma estimativa de src/lib/footage-qa.ts (Haiku)

const ALL_PILLARS = ["self", "network", "anxiety", "freedom", "dopamine", "mind"];
const PILLARS = PILLARS_FILTER.length ? ALL_PILLARS.filter((p) => PILLARS_FILTER.includes(p)) : ALL_PILLARS;

// Termos de busca por pilar — mais amplos que os beats do runtime (aqui é
// CURADORIA, não seleção por post; queremos VARREDURA, não 1 termo certeiro).
// Mapa cat→pilar (footage-library.ts): self=O SERVO (rebanho/exaustão) ·
// network=A CASTA (luxo/riqueza) · anxiety=O ESTADO (vigilância/opressão/tempo
// roubado) · freedom=LIBERDADE (natureza/solo/resistência) · dopamine=PÃO E
// CIRCO (entretenimento/tela/distração) · mind=O DESPERTAR (rosto pra luz,
// amanhecer, ir contra a maré).
const PILLAR_TERMS = {
  self: [
    "crowd of people walking anonymous", "sheep herd walking field", "exhausted worker slumped desk",
    "crowded subway commuters", "factory worker assembly line back", "crowd from above uniform",
    "cattle herd walking dust", "call center rows cubicles",
  ],
  network: [
    "luxury yacht deck ocean", "champagne toast wealthy party", "marble counter cocktail bar",
    "gold watch chain close up", "private jet interior luxury", "caviar fine dining plate",
    "money cash spread dark", "chandelier ballroom luxury",
  ],
  anxiety: [
    "heavy chain hand grabbing noir", "hourglass sand falling time", "surveillance camera dark",
    "clock ticking close up stress", "prison bars silhouette", "person trapped shadow dark room",
    "industrial chain metal dark", "clenched fist resistance neutral background",
  ],
  freedom: [
    "solo hiker mountain trail", "hawk soaring alone sky", "runner dawn trail sunrise",
    "canyon edge pov feet", "lone sailboat dark sea", "person walking desert alone",
    "cliff edge silhouette sunset", "open road solo travel",
  ],
  dopamine: [
    "old tvs static stacked", "arcade neon corridor silhouette", "casino roulette spinning close up",
    "crowd phones raised concert", "mirror ball spinning nightclub", "carnival ride neon lights",
    "bonfire crowd silhouette festival", "hand scrolling glowing phone dark",
  ],
  mind: [
    "face lifting to light awakening", "eye opening close up consciousness", "person walking against crowd",
    "sunrise over city rooftops", "lone figure standing warehouse determined", "profile serious dramatic light",
    "hand on chin reflective thinking", "aerial dawn golden city",
  ],
};

function log(m) { console.log(`[vet-footage] ${m}`); }

// ─── 4 fontes normalizadas — MESMA lógica de src/lib/footage-providers.ts ──────
function pickPexelsVideoFile(video) {
  const files = (video.video_files || []).filter((f) => f.link && f.width && f.height);
  if (!files.length) return null;
  const portrait = files.filter((f) => f.height >= f.width);
  const pool = portrait.length ? portrait : files;
  pool.sort((a, b) => {
    const sa = (a.width <= 1440 ? 0 : 1) * 1e6 + Math.abs(a.width - 1080);
    const sb = (b.width <= 1440 ? 0 : 1) * 1e6 + Math.abs(b.width - 1080);
    return sa - sb;
  });
  return pool[0].link;
}

async function searchPexelsVideo(term) {
  if (!PEXELS_API_KEY) return [];
  const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(term)}&orientation=portrait&size=medium&per_page=20`;
  const res = await fetch(url, { headers: { Authorization: PEXELS_API_KEY } });
  if (!res.ok) return [];
  const data = await res.json().catch(() => ({}));
  const vids = Array.isArray(data.videos) ? data.videos : [];
  return vids
    .filter((v) => v.height >= v.width && (v.duration || 0) >= 4)
    .map((v) => { const link = pickPexelsVideoFile(v); return link ? { id: v.id, url: link, poster: v.image, source: "pexels", mediaType: "video" } : null; })
    .filter(Boolean);
}

async function searchPexelsPhoto(term) {
  if (!PEXELS_API_KEY) return [];
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(term)}&orientation=portrait&size=large&per_page=20`;
  const res = await fetch(url, { headers: { Authorization: PEXELS_API_KEY } });
  if (!res.ok) return [];
  const data = await res.json().catch(() => ({}));
  const photos = Array.isArray(data.photos) ? data.photos : [];
  return photos
    .filter((p) => (p.height || 0) >= (p.width || 0))
    .map((p) => {
      const src = p.src?.large2x || p.src?.large || p.src?.original;
      return src ? { id: p.id, url: src, poster: src, source: "pexels", mediaType: "photo", alt: p.alt || "" } : null;
    })
    .filter(Boolean);
}

async function searchPixabayVideo(term) {
  if (!PIXABAY_API_KEY) return [];
  const url = `https://pixabay.com/api/videos/?key=${encodeURIComponent(PIXABAY_API_KEY)}&q=${encodeURIComponent(term)}&safesearch=true&per_page=20`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json().catch(() => ({}));
  const hits = Array.isArray(data.hits) ? data.hits : [];
  const out = [];
  for (const h of hits) {
    const sizes = h.videos || {};
    const candidates = [sizes.large, sizes.medium, sizes.small, sizes.tiny].filter((s) => s && s.url && s.width && s.height);
    const portrait = candidates.filter((s) => s.height >= s.width);
    const pool = portrait.length ? portrait : candidates;
    if (!pool.length) continue;
    pool.sort((a, b) => {
      const sa = (a.width <= 1440 ? 0 : 1) * 1e6 + Math.abs(a.width - 1080);
      const sb = (b.width <= 1440 ? 0 : 1) * 1e6 + Math.abs(b.width - 1080);
      return sa - sb;
    });
    const pick = pool[0];
    if (!(pick.height >= pick.width) || (h.duration || 0) < 4) continue;
    out.push({
      id: h.id, url: pick.url,
      poster: h.picture_id ? `https://i.vimeocdn.com/video/${h.picture_id}_295x166.jpg` : pick.url,
      source: "pixabay", mediaType: "video", alt: h.tags || "",
    });
  }
  return out;
}

async function searchPixabayPhoto(term) {
  if (!PIXABAY_API_KEY) return [];
  const url = `https://pixabay.com/api/?key=${encodeURIComponent(PIXABAY_API_KEY)}&q=${encodeURIComponent(term)}&image_type=photo&orientation=vertical&safesearch=true&per_page=20`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json().catch(() => ({}));
  const hits = Array.isArray(data.hits) ? data.hits : [];
  return hits
    .filter((h) => (h.imageHeight || 0) >= (h.imageWidth || 0))
    .map((h) => {
      const src = h.largeImageURL || h.webformatURL;
      return src ? { id: h.id, url: src, poster: src, source: "pixabay", mediaType: "photo", alt: h.tags || "" } : null;
    })
    .filter(Boolean);
}

const SOURCE_FNS = {
  "pexels-video": searchPexelsVideo,
  "pexels-photo": searchPexelsPhoto,
  "pixabay-video": searchPixabayVideo,
  "pixabay-photo": searchPixabayPhoto,
};

function availableSources() {
  const list = [];
  if (PEXELS_API_KEY) list.push("pexels-video", "pexels-photo");
  if (PIXABAY_API_KEY) list.push("pixabay-video", "pixabay-photo");
  return list;
}

// ─── Juiz de visão — ESPELHA src/lib/footage-qa.ts (mesmo prompt/modelo) ───────
const FOOTAGE_QA_PROMPT = `You review a single stock-video POSTER FRAME for a serious mental-health / psychology Instagram brand.
Answer ONLY with JSON: {"reject": boolean, "reason": "<=8 words"}.
Set reject=true if the frame is ANY of:
- an extreme close-up of bare skin or body parts (arm, leg, torso, lips, etc.) filling the frame;
- an abstract skin/flesh/body texture with no clear scene or subject;
- nudity, lingerie, or sexually suggestive content;
- a child or teenager (anyone who looks under ~18) as a subject in the frame;
- anything a psychology brand would be embarrassed to post.
Set reject=false only for a clear, tasteful scene with a discernible ADULT subject in context (a person doing something, a place, an object, nature).
When in doubt, reject=true.`;

function parseFootageVerdict(text) {
  const s = typeof text === "string" ? text : "";
  try {
    const start = s.indexOf("{");
    const end = s.lastIndexOf("}");
    if (start >= 0 && end > start) {
      const o = JSON.parse(s.slice(start, end + 1));
      if (typeof o.reject === "boolean") return { reject: o.reject, reason: typeof o.reason === "string" ? o.reason : "" };
    }
  } catch { /* fail-safe */ }
  return { reject: true, reason: "veredito ilegível → rejeitado (fail-safe)" };
}

async function judgeFootagePoster(posterUrl) {
  if (!posterUrl) return { reject: true, reason: "sem poster — rejeitado (vetagem exige imagem)" };
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 100,
        messages: [{ role: "user", content: [
          { type: "image", source: { type: "url", url: posterUrl } },
          { type: "text", text: FOOTAGE_QA_PROMPT },
        ] }],
      }),
    });
    if (!res.ok) return { reject: true, reason: `QA HTTP ${res.status} → rejeitado (fail-safe)` };
    const data = await res.json();
    return parseFootageVerdict(data?.content?.[0]?.text);
  } catch (e) {
    return { reject: true, reason: `QA erro (${e?.message || e}) → rejeitado (fail-safe)` };
  }
}

// ─── Lê a whitelist atual (parse regex leve — não precisa de TS compiler aqui) ──
function readExistingUrls() {
  const src = readFileSync(LIB_PATH, "utf8");
  const urls = new Set();
  const re = /url:\s*"([^"]+)"/g;
  let m;
  while ((m = re.exec(src))) urls.add(m[1]);
  return { src, urls };
}

function altToWhy(alt, term) {
  const a = (alt || "").trim();
  if (a) return a.length > 90 ? `${a.slice(0, 87)}...` : a;
  return `termo de busca: ${term}`;
}

async function main() {
  log(`modo: ${DRY_RUN ? "DRY-RUN (só conta candidatos, custo $0)" : "CONFIRM (roda o QA de verdade)"}`);
  log(`pilares: ${PILLARS.join(", ")} | meta/pilar: ${TARGET}`);

  const sources = availableSources();
  if (!sources.length) {
    log("ERRO: nenhuma fonte disponível (defina PEXELS_API_KEY; PIXABAY_API_KEY é opcional).");
    process.exit(1);
  }
  log(`fontes disponíveis: ${sources.join(", ")}${PIXABAY_API_KEY ? "" : " (Pixabay PULADO — sem PIXABAY_API_KEY, fail-open)"}`);

  if (!DRY_RUN && !ANTHROPIC_API_KEY) {
    log("ERRO: --confirm exige ANTHROPIC_API_KEY (a vetagem em massa NÃO roda fail-open — sem chave, ela aceitaria tudo, perigoso demais pra popular a whitelist da marca).");
    process.exit(1);
  }

  const { src: currentSrc, urls: existingUrls } = readExistingUrls();
  log(`whitelist atual: ${existingUrls.size} URLs já na base (não serão re-adicionadas nem re-julgadas)`);

  const report = { mode: DRY_RUN ? "dry-run" : "confirm", generatedAt: new Date().toISOString(), pillars: {} };
  const accepted = {}; // pillar -> [{url, poster, why, mediaType, source}]
  let totalCandidates = 0;

  for (const pillar of PILLARS) {
    const terms = PILLAR_TERMS[pillar] || [];
    const seen = new Set();
    const candidates = [];
    for (const source of sources) {
      for (const term of terms) {
        let found = [];
        try {
          found = await SOURCE_FNS[source](term);
        } catch (e) {
          log(`  ! ${pillar}/${source} "${term}" exceção: ${e?.message || e}`);
          found = [];
        }
        for (const c of found) {
          if (existingUrls.has(c.url) || seen.has(c.url)) continue;
          seen.add(c.url);
          candidates.push({ ...c, term });
        }
      }
    }
    totalCandidates += candidates.length;
    report.pillars[pillar] = { candidatesFound: candidates.length, attempted: 0, passed: 0, rejected: 0 };
    log(`${pillar}: ${candidates.length} candidato(s) novo(s) encontrado(s) nas ${sources.length} fonte(s) (${terms.length} termos)`);
    accepted[pillar] = [];

    if (DRY_RUN) continue; // dry-run: só contar, não julgar (custo $0)

    for (const c of candidates) {
      if (accepted[pillar].length >= TARGET) break;
      report.pillars[pillar].attempted++;
      const verdict = await judgeFootagePoster(c.poster);
      if (verdict.reject) {
        report.pillars[pillar].rejected++;
        continue;
      }
      report.pillars[pillar].passed++;
      accepted[pillar].push({
        url: c.url,
        poster: c.mediaType === "video" ? c.poster : undefined,
        why: altToWhy(c.alt, c.term),
        mediaType: c.mediaType,
        source: c.source,
      });
    }
    log(`${pillar}: QA ${report.pillars[pillar].passed}/${report.pillars[pillar].attempted} aprovados (meta ${TARGET})`);
  }

  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), "utf8");
  log(`relatório salvo em ${REPORT_PATH}`);

  if (DRY_RUN) {
    const estUsd = (totalCandidates * QA_COST_PER_IMAGE_USD).toFixed(2);
    log(`ESTIMATIVA (se rodasse --confirm sobre TODOS os candidatos achados agora): ${totalCandidates} imagens × US$${QA_COST_PER_IMAGE_USD} ≈ US$${estUsd}`);
    log(`Nada foi gasto. Pra rodar de verdade: node scripts/vet-footage-library.mjs --confirm --target=${TARGET} [--max-usd=N]`);
    return;
  }

  // ── Trava de custo pós-fato: se o total REALMENTE tentado passou do teto, avisa
  // (a corrida já rodou pilar a pilar — TARGET por pilar já limita o pior caso;
  // isto é um cinto-e-suspensório, não a única defesa).
  const totalAttempted = Object.values(report.pillars).reduce((s, p) => s + p.attempted, 0);
  const realUsd = totalAttempted * QA_COST_PER_IMAGE_USD;
  log(`custo real desta rodada: ${totalAttempted} vereditos × US$${QA_COST_PER_IMAGE_USD} ≈ US$${realUsd.toFixed(2)} (teto avisado: US$${MAX_USD})`);
  if (realUsd > MAX_USD) log(`⚠️ passou do teto avisado (US$${MAX_USD}) — revise --target/--pillars na próxima rodada.`);

  // ── Regenera footage-library.ts: preserva TODO o arquivo, só insere as novas
  // entradas dentro do array de cada pilar (antes do fechamento `],`).
  let newSrc = currentSrc;
  let totalAdded = 0;
  for (const pillar of PILLARS) {
    const list = accepted[pillar];
    if (!list.length) continue;
    const lines = list.map((c) => {
      const poster = c.poster ? `, poster: "${c.poster}"` : "";
      const why = c.why.replace(/"/g, '\\"');
      return `    { url: "${c.url}"${poster}, why: "${why}", mediaType: "${c.mediaType}", source: "${c.source}" },`;
    }).join("\n");
    // Acha o array do pilar: `  <pillar>: [` ... `  ],`
    const re = new RegExp(`(  ${pillar}: \\[\\n)([\\s\\S]*?)(\\n  \\],)`);
    const m = newSrc.match(re);
    if (!m) {
      log(`  ! não achei o array do pilar "${pillar}" em footage-library.ts — pulando escrita (rode com --dry-run pra conferir o arquivo)`);
      continue;
    }
    newSrc = newSrc.replace(re, `$1$2\n${lines}$3`);
    totalAdded += list.length;
  }

  if (totalAdded > 0) {
    writeFileSync(LIB_PATH, newSrc, "utf8");
    log(`footage-library.ts atualizado: +${totalAdded} entrada(s) novas (whitelist total agora maior).`);
  } else {
    log("nenhuma entrada nova aprovada nesta rodada — footage-library.ts NÃO foi alterado.");
  }
}

main().catch((e) => {
  log(`ERRO FATAL: ${e?.stack || e}`);
  process.exit(1);
});
