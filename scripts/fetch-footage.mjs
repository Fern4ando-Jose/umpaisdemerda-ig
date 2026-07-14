// ─── Footage do Reel (CI): SÓ da base compartilhada (biblioteca CURADA) ───────
// O footage é resolvido pela API (/api/publish?preview=1 → selectFootage) a partir
// da biblioteca CURADA por pilar (whitelist vetado à mão em src/lib/footage-library.ts),
// compartilhado entre ES e PT por (tópico, dia) no cache do Postgres, e entregue já
// pronto em props.clips. Este passo do CI NÃO busca mais no Pexels ao vivo: aquela
// roleta não-vetada já trouxe marco dos EUA e cena imprópria — o caminho foi fechado.
//
// Logo, aqui só CONFIRMAMOS que os clipes curados vieram da API. Se por algum motivo
// não vieram, NÃO caímos em Pexels cru: saímos sem clips e o Reel usa o fallback
// SEGURO de última instância (ilustração estática), garantido pelo guarda anti-preto.
//
// CAMADA: criação (não automação). NÃO-FATAL: sai 0 sempre; footage é opcional.
//
// Uso:  node scripts/fetch-footage.mjs --props=reel-props.json

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

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

function main() {
  if (!existsSync(PROPS_PATH)) return done(`props ${PROPS_PATH} ausente — nada a conferir`);
  let props;
  try {
    props = JSON.parse(readFileSync(PROPS_PATH, "utf8"));
  } catch (e) {
    return done(`reel-props.json inválido (${e?.message || e}) — sem footage`);
  }
  // A API já resolve o footage CURADO e COMPARTILHADO (mesmo vídeo ES↔PT) e o
  // entrega em props.clips. Só confirmamos aqui — nunca buscamos Pexels ao vivo.
  if (Array.isArray(props.clips) && props.clips.length) {
    return done(`clips curados vieram da API (base compartilhada, ${props.clips.length}) — ok`);
  }
  // Sem clips da API → NÃO busca Pexels cru (fechado). Reel cai no fallback SEGURO
  // (ilustração estática), tratado pelo guarda anti-preto (scripts/reel-media.cjs).
  return done("sem clips da API — SEM busca Pexels ao vivo (curado-only); Reel usa ilustração estática");
}

main();
