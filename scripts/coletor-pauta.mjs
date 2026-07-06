// Coletor de pauta semanal — Um País de Merda
// Puxa as manchetes da semana (Google News RSS, público, grátis, sem chave) nas
// 4 frentes: Executivo, Legislativo, Judiciário e Crime organizado / narco-Estado.
// Uso: node scripts/coletor-pauta.mjs
// Saída: lista por frente (título + fonte + data). NÃO publica nada — é insumo de
// curadoria. O que vira post é decidido depois e SEM nomear pessoas (régua da conta).

const FRENTES = [
  { id: "Executivo",  q: '(governo federal OR Planalto OR presidência OR ministério OR "gasto público") when:7d' },
  { id: "Legislativo", q: '(Congresso OR Câmara dos Deputados OR Senado OR "emenda parlamentar" OR "aumento salarial" deputado OR senador) when:7d' },
  { id: "Judiciário",  q: '(STF OR "Supremo Tribunal" OR judiciário OR "auxílio" magistrado OR "penduricalho") when:7d' },
  { id: "Crime/Narco", q: '(crime organizado OR facção OR narcotráfico OR milícia OR "lavagem de dinheiro") Brasil when:7d' },
];

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) UmPaisDeMerdaBot/1.0";

function decode(s) {
  return s
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ")
    .trim();
}

function parseItems(xml) {
  const items = [];
  const blocks = xml.split(/<item>/).slice(1);
  for (const b of blocks) {
    const title = decode((b.match(/<title>(.*?)<\/title>/s) || [])[1] || "");
    const date  = decode((b.match(/<pubDate>(.*?)<\/pubDate>/s) || [])[1] || "");
    // Google News põe a fonte no fim do título depois de " - "
    const m = title.match(/^(.*?)\s+-\s+([^-]+)$/);
    items.push({
      titulo: m ? m[1].trim() : title,
      fonte:  m ? m[2].trim() : "",
      data:   date,
    });
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

const out = await Promise.all(FRENTES.map(fetchFrente));

for (const f of out) {
  console.log(`\n========== ${f.id} ==========`);
  if (f.erro) { console.log(`  (erro: ${f.erro})`); continue; }
  if (!f.items.length) { console.log("  (sem resultados)"); continue; }
  f.items.forEach((it, i) => {
    console.log(`  ${String(i + 1).padStart(2, " ")}. ${it.titulo}`);
    console.log(`      — ${it.fonte}${it.data ? "  ·  " + it.data : ""}`);
  });
}
console.log("\n(insumo de curadoria — o post é decidido depois, atacando o PADRÃO, sem nomear pessoas)");
