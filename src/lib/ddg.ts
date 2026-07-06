// ─── Busca DuckDuckGo (GRÁTIS, sem chave, sem cartão, web inteira) ─────────────
// Raspagem do endpoint HTML do DDG (html.duckduckgo.com/html) → extrai título +
// snippet + url dos resultados. SEM dependência nova (fetch + regex). É a fonte
// PRIMÁRIA de contexto do prompt; se vier vazia/bloqueada, o chamador cai na
// Wikipedia (reserva). Tudo fail-open.
//
// ⚠️ Realidade: o DDG estrangula IPs de datacenter (202/403) e raspar fere o ToS
// dele — de IP serverless (Vercel) a queda pra Wikipedia pode ser comum. Por isso
// é só a camada PRIMÁRIA fail-open + log da fonte (medir no teste de uns dias).
// Decisão registrada após pesquisa: Brave virou pago e Google fechou a API JSON
// p/ clientes novos → DDG é a única busca grátis de web inteira sem chave/cartão.
//
// O parser (parseDuckDuckGoHtml) é PURO e coberto por teste invariante.

export interface DdgResult {
  title: string;
  content: string;
  url: string;
}

const DDG_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// Tira tags e decodifica as entidades HTML mais comuns + normaliza espaços.
function cleanText(s: string): string {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// O href do DDG é um redirect: //duckduckgo.com/l/?uddg=<URL-encoded>&rut=...
// Devolve a URL real decodificada (ou o próprio href se não houver uddg).
function decodeDdgHref(href: string): string {
  const m = href.match(/[?&]uddg=([^&]+)/);
  if (m) {
    try {
      return decodeURIComponent(m[1]);
    } catch {
      return "";
    }
  }
  return href.startsWith("//") ? `https:${href}` : href;
}

// PURE: extrai {title, content, url} do HTML do DDG. Título (result__a) e snippet
// (result__snippet) aparecem uma vez por resultado, na MESMA ordem → casa por índice.
// Resultados sem snippet são descartados (snippet é o contexto que importa).
export function parseDuckDuckGoHtml(html: string): DdgResult[] {
  const titles: { text: string; url: string }[] = [];
  const titleRe =
    /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  let m: RegExpExecArray | null;
  while ((m = titleRe.exec(html)) !== null) {
    titles.push({ url: decodeDdgHref(m[1]), text: cleanText(m[2]) });
  }
  const snippets: string[] = [];
  const snipRe = /<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
  while ((m = snipRe.exec(html)) !== null) {
    snippets.push(cleanText(m[1]));
  }
  const out: DdgResult[] = [];
  const n = Math.min(titles.length, snippets.length);
  for (let i = 0; i < n; i++) {
    const content = snippets[i];
    if (!content) continue;
    out.push({ title: titles[i]?.text ?? "", content, url: titles[i]?.url ?? "" });
  }
  return out;
}

// Rede: busca no DDG (viés de domínio "psicología", como na query antiga) e devolve
// até `limit` resultados. FAIL-OPEN → [] em qualquer erro/bloqueio (chamador cai na
// Wikipedia). NÃO lança.
export async function searchDuckDuckGo(topic: string, limit = 3): Promise<DdgResult[]> {
  try {
    const q = encodeURIComponent(`${topic} psicología`);
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${q}&kl=es-es`, {
      headers: { "User-Agent": DDG_UA, Accept: "text/html,application/xhtml+xml" },
    });
    if (!res.ok) return [];
    const html = await res.text();
    return parseDuckDuckGoHtml(html).slice(0, limit);
  } catch {
    return [];
  }
}
