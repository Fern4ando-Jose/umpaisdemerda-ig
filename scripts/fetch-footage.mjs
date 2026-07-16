// ─── Footage do Reel (CI): SÓ da base compartilhada (biblioteca CURADA) ───────
// O footage é resolvido pela API (/api/publish?preview=1 → selectFootage) a partir
// da biblioteca CURADA por pilar (whitelist vetado à mão em src/lib/footage-library.ts),
// compartilhado entre ES e PT por (tópico, dia) no cache do Postgres, e entregue já
// pronto em props.clips. Este passo do CI NÃO busca mais no Pexels ao vivo: aquela
// roleta não-vetada já trouxe marco dos EUA e cena imprópria — o caminho foi fechado.
//
// Logo, aqui só CONFERIMOS os clipes curados que vieram da API. Se por algum motivo
// não vieram, NÃO caímos em Pexels cru: saímos sem clips e o Reel usa o fallback
// SEGURO de última instância (ilustração estática), garantido pelo guarda anti-preto.
//
// 2026-07-16 — REDE DE SEGURANÇA (403): conferir deixou de ser só contar. Um clipe
// que MORREU no CDN (o Pexels tirou o arquivo; CloudFront devolve 403 permanente)
// fazia o Remotion ABORTAR o render inteiro ("Received a status code of 403 while
// downloading file …" → exit 1 → Reel do dia não publicado). Agora sondamos cada
// clipe (GET Range 0-64, $0, em paralelo) e PODAMOS o que estiver comprovadamente
// morto — inclusive o que vier de um cache envenenado antes do preflight da API.
// Reel com menos cenas (o Reel.tsx cicla o pool) > Reel nenhum. Se sobrar zero, o
// guarda anti-preto do workflow assume e cai na ilustração estática.
// Continua SEM busca ao vivo: podar ≠ descobrir URL nova.
//
// CAMADA: criação (não automação). NÃO-FATAL: sai 0 sempre; footage é opcional.
//
// Uso:  node scripts/fetch-footage.mjs --props=reel-props.json

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pruneDeadUrls } from "./footage-probe.mjs";

const propsArg = process.argv.find((a) => a.startsWith("--props="));
const PROPS_PATH = resolve(process.cwd(), propsArg ? propsArg.slice("--props=".length) : "reel-props.json");

function log(m) {
  console.log(`[footage] ${m}`);
}

// Sempre 0: footage é opcional (fallback p/ ilustração estática).
function done(reason) {
  if (reason) log(reason);
  process.exit(0);
}

async function main() {
  if (!existsSync(PROPS_PATH)) return done(`props ${PROPS_PATH} ausente — nada a conferir`);
  let props;
  try {
    props = JSON.parse(readFileSync(PROPS_PATH, "utf8"));
  } catch (e) {
    return done(`reel-props.json inválido (${e?.message || e}) — sem footage`);
  }
  // A API já resolve o footage CURADO e COMPARTILHADO (mesmo vídeo ES↔PT) e o
  // entrega em props.clips. Só confirmamos aqui — nunca buscamos Pexels ao vivo.
  if (!Array.isArray(props.clips) || !props.clips.length) {
    // Sem clips da API → NÃO busca Pexels cru (fechado). Reel cai no fallback SEGURO
    // (ilustração estática), tratado pelo guarda anti-preto (scripts/reel-media.cjs).
    return done("sem clips da API — SEM busca Pexels ao vivo (curado-only); Reel usa ilustração estática");
  }

  // Sonda de saúde: poda só o que o servidor REPROVOU de vez (403/404/410). Erro de
  // rede/timeout/5xx → mantém (fail-open) — nunca perder um Reel por falso positivo.
  let kept = props.clips;
  let dead = [];
  try {
    ({ kept, dead } = await pruneDeadUrls(props.clips));
  } catch (e) {
    return done(`sonda de saúde falhou (${e?.message || e}) — mantendo os ${props.clips.length} clipes como vieram`);
  }

  if (!dead.length) return done(`clips curados vieram da API (base compartilhada, ${kept.length}) — todos vivos, ok`);

  log(`${dead.length} clipe(s) MORTO(S) no CDN — podando p/ o render não abortar: ${dead.join(" ")}`);
  props.clips = kept.length ? kept : undefined; // zero → guarda anti-preto assume
  try {
    writeFileSync(PROPS_PATH, JSON.stringify(props));
  } catch (e) {
    return done(`não deu p/ regravar ${PROPS_PATH} (${e?.message || e}) — render segue com a lista original`);
  }
  return done(
    kept.length
      ? `restaram ${kept.length} clipe(s) vivo(s) — Reel sai com cenas cicladas (melhor que Reel nenhum)`
      : "nenhum clipe vivo — Reel usa a ilustração estática (guarda anti-preto)",
  );
}

main();
