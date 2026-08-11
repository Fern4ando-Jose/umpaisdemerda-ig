// ─── 2ª FRENTE: escândalo do dia (notícia → crítica RECONHECÍVEL e apartidária) ──
// O coletor (scripts/coletor-pauta.mjs, cron diário 06:00 BRT) grava as manchetes
// NOVAS em data/pauta-semana.json. Aqui o app lê uma manchete e o post gerado é
// SOBRE o caso — órgão, quantia e fato APARECEM (ordem do dono 27/07 e 29/07/2026:
// antes o prompt mandava esconder tudo e a pesquisa ficava invisível no feed).
// A régua apartidária segue INVIOLÁVEL no seu núcleo: nome de pessoa e partido
// NUNCA — e a GUARDA DE CÓDIGO abaixo rejeita a saída se vazar → cai em tema fixo.
import pautaJson from "../../data/pauta-semana.json";

// Frente do coletor → pilar (cat) da automação.
const FRONT_CAT: Record<string, string> = {
  "Executivo": "anxiety",   // o Estado que gasta/rouba
  "Legislativo": "network", // a casta parlamentar
  "Judiciário": "network",  // a casta togada
  "Crime/Narco": "anxiety", // o Estado/narco que sangra o cidadão
};

interface PautaFile { atualizado?: string; frentes?: Record<string, string[]> }

export interface NewsItem { headline: string; cat: string }

// Prefixo do `topic` de um Reel que nasceu do noticiário. Antes o Reel consumia um
// dos 29 temas perenes por publicação (4/dia = 28 dos 29 queimados na janela
// anti-dup de 7 dias → o carrossel parava de sair). Com a notícia como assunto, o
// universo de tópicos do Reel passa a ser infinito e a rotação perene volta a ter
// folga: só o carrossel (1/dia) consome dela.
export const NEWS_PREFIX = "noticia:";

// Slug estável da manchete — chave de deduplicação (entre os Reels do MESMO dia e
// entre dias, via livro-razão) e base do `topic` do Reel de notícia.
export function newsSlug(headline: string): string {
  return headline
    .toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

// Todas as manchetes utilizáveis da pauta (>= 5 palavras descarta avisos curtos).
export function pautaFlat(): NewsItem[] {
  const pauta = pautaJson as PautaFile;
  const flat: NewsItem[] = [];
  for (const [front, titles] of Object.entries(pauta.frentes || {})) {
    const cat = FRONT_CAT[front] || "anxiety";
    for (const t of titles || []) {
      if (typeof t === "string" && t.trim().split(/\s+/).length >= 5) flat.push({ headline: t.trim(), cat });
    }
  }
  return flat;
}

// Escolhe 1 manchete (determinístico por seed). `used` = slugs já gastos (pelos
// outros Reels de hoje e pelos Reels recentes): caminha a lista a partir do seed e
// devolve a 1ª manchete FRESCA. Todas usadas → cai na do seed (melhor repetir um
// caso do que sair sem notícia). null só quando a pauta está vazia de verdade.
export function pickNewsTopic(seed: number, used?: Set<string>): NewsItem | null {
  const flat = pautaFlat();
  if (!flat.length) return null;
  const start = Math.abs(seed) % flat.length;
  if (used?.size) {
    for (let i = 0; i < flat.length; i++) {
      const item = flat[(start + i) % flat.length];
      if (!used.has(newsSlug(item.headline))) return item;
    }
  }
  return flat[start];
}

// QUANTOS posts do dia nascem do noticiário — regra do dono (27/07/2026):
// "a crítica deve ser sobre o escândalo do governo, que cada dia tem coisa diferente".
//
// A regra é por FORMATO, não por slot (corrigido 31/07/2026). A regra antiga
// (`slot !== "manha"`) foi escrita para a grade velha, em que a 1ª publicação do dia
// era carrossel. Na grade de 29/07 (1 carrossel + 3 reels) o único slot "manha" é o
// REEL das 12:17 — ou seja, a espinha atemporal caía num Reel e a pauta ia parar no
// único carrossel do dia, exatamente o inverso do combinado.
//
//   REEL      → SEMPRE nasce da notícia. É vídeo de feed: tem 1 segundo pra provar
//               que fala do que a pessoa acabou de ver no noticiário.
//   CARROSSEL → SEMPRE atemporal. É a espinha do livro (servidão voluntária), o
//               formato que se salva e se relê; sem ela a conta vira jornal e morre
//               quando a notícia esfria.
//
// Continua valendo "3 das 4 publicações do dia com pauta" (3 reels + 1 carrossel).
export type Formato = "reel" | "carrossel";

export function usaPautaNoFormato(formato: Formato): boolean {
  return formato === "reel";
}

// GUARDA anti-vazamento: rejeita a copy se parecer que citou nome de PESSOA ou
// PARTIDO (a régua já proíbe, mas isto é o backstop de código — como o literal-lock).
// ⚠️ Instituição/órgão (INSS, Receita Federal, STF, Congresso) é PERMITIDA desde
// 29/07/2026 — sem o órgão o escândalo não é reconhecível e a pesquisa vira nada.
// Erra para o lado de REJEITAR só no que resta: um falso-positivo cai em tema fixo.
const SIGLAS = /\b(PT|PL|PSDB|PSD|PP|MDB|PDT|PSOL|PC\s?do\s?B|PSB|PSC|PROS|PTB|PV|PCB|PCO|DEM|PODE|REPUBLICANOS|NOVO|AVANTE|SOLIDARIEDADE|CIDADANIA|UNIÃO\s+BRASIL|PATRIOTA|AGIR)\b/;
// Cargos que denunciam nome de pessoa logo à frente — fonte única do sanitizador
// (CARGO_NOME_G, abaixo) e da guarda (CARGO_NOME).
const CARGO = "presidente|ministr[oa]|deputad[oa]|senador[a]?|governador[a]?|prefeit[oa]|vereador[a]?|desembargador[a]?|relator[a]?|secretári[oa]|ex-secretári[oa]|procurador[a]?|delegad[oa]|juiz|juíza";
const CARGO_NOME = new RegExp(`\\b(${CARGO})\\s+[A-ZÁÉÍÓÚÂÊÔÃÕ][a-záéíóúâêôãõ]+`);
// Par (ou mais) de palavras Capitalizadas seguidas = provável nome próprio/composto
// (ex.: "Jair Messias", "Lula Silva"). EXCETO se TODAS forem termos da marca OU
// vocabulário de INSTITUIÇÃO (o escândalo precisa nomear o órgão para ser
// reconhecível — "Receita Federal", "Congresso Nacional", "Banco Central").
const PAR_CAPS = /[A-ZÁÉÍÓÚÂÊÔÃÕ][a-záéíóúâêôãõ]{2,}(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕ][a-záéíóúâêôãõ]{2,})+/g;
const MARCA_OK = new Set([
  "servidao","voluntaria","estado","brasil","pais","patria","nacao","republica","deus","casta","poder","povo","liberdade",
  // vocabulário institucional (órgão nomeado ≠ pessoa/partido):
  "receita","federal","congresso","nacional","nacionais","camara","deputados","senado","supremo","tribunal","justica","contas",
  "uniao","central","banco","previdencia","social","orcamento","secreto","ministerio","publico","publica","policia",
  "governo","planalto","tesouro","saude","educacao","seguranca","brasilia",
  // 31/07/2026: sem estes, casos REAIS eram descartados como se fossem nome de
  // pessoa — "Operação Brasil Contra o Crime", "Metas Nacionais", "Senado Notícias".
  // Medido na pauta do dia: 6 de 13 manchetes derrubavam a copy que citava o caso.
  "operacao","programa","secretaria","controladoria","procuradoria","defensoria","conselho","comissao",
  "fundo","instituto","agencia","universidade","prefeitura","assembleia","superior","regiao","regional",
  "metas","plano","lei","noticias","auditoria","inquerito","forca","tarefa","tesouraria","municipal","estadual",
]);
const norm = (w: string) => w.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Cargo seguido de nome próprio — o alvo REAL da régua ("o ministro Fulano").
const CARGO_NOME_G = new RegExp(`\\b(${CARGO})\\s+[A-ZÁÉÍÓÚÂÊÔÃÕ][a-záéíóúâêôãõ]+(?:\\s+(?:d[aeo]s?\\s+)?[A-ZÁÉÍÓÚÂÊÔÃÕ][a-záéíóúâêôãõ]+)*`, "g");

// SANITIZA em vez de descartar: "o ministro Fulano de Tal decidiu" → "o ministro
// decidiu". Antes, um nome que escapou no meio de uma copy boa fazia o post INTEIRO
// ser refeito sem a notícia — e o Reel saía atemporal. Aqui o nome cai e a crítica
// (com órgão, valor e fato) sobrevive. A guarda continua depois, como backstop.
export function sanitizeNomesDePessoa(text: string): string {
  return String(text || "").replace(CARGO_NOME_G, "$1");
}

// Pares de Capitalizadas da PRÓPRIA manchete que são INSTITUIÇÃO ou LUGAR, não
// pessoa — viram exceção só para aquele post. Instituição: algum termo no
// vocabulário institucional ("Operação Brasil", "Senado Notícias"). Lugar: par
// precedido de preposição e NÃO precedido de cargo ("de Mata Roma" = município;
// "ministro Fulano de Tal" continua barrado).
export function entidadesPermitidas(headline: string): Set<string> {
  const out = new Set<string>();
  const h = String(headline || "");
  for (const m of h.match(PAR_CAPS) || []) {
    const words = m.split(/\s+/).map(norm);
    const institucional = words.some((w) => MARCA_OK.has(w));
    const idx = h.indexOf(m);
    const antes = h.slice(Math.max(0, idx - 24), idx);
    const lugar = /\b(de|em|no|na|do|da)\s+$/i.test(antes) && !new RegExp(`\\b(${CARGO})\\s*$`, "i").test(antes.trim());
    if (institucional || lugar) out.add(words.join(" "));
  }
  return out;
}

// GUARDA anti-vazamento (backstop de código da régua apartidária). `allow` são as
// entidades da manchete liberadas para AQUELE post (ver entidadesPermitidas).
export function copyLeaksName(texts: string[], allow?: Set<string>): boolean {
  const blob = texts.filter(Boolean).join("  ");
  if (SIGLAS.test(blob) || CARGO_NOME.test(blob)) return true;
  for (const m of blob.match(PAR_CAPS) || []) {
    const words = m.split(/\s+/).map(norm);
    if (words.every((w) => MARCA_OK.has(w))) continue;
    if (allow?.has(words.join(" "))) continue; // entidade da própria manchete
    return true; // sobrou algo que não é marca nem instituição → nome
  }
  return false;
}

// ─── CHECAGEM POSITIVA: a crítica é mesmo SOBRE a notícia? ────────────────────
// Só existia validação NEGATIVA ("não pode ter nome"), então o caminho de menor
// resistência do sistema era sempre sair sem notícia — e ninguém via. Aqui se exige
// o contrário: a copy tem de carregar o caso. Sinais fortes (peso 2): sigla do órgão
// (CGU, TCU, INSS) e o VALOR em R$. Sinais fracos (peso 1 cada, máx 2): palavras de
// conteúdo da manchete. Passa com score >= 2 — ou seja, órgão OU valor OU duas
// palavras-chave do caso. Função PURA → testável.
const STOP_PT = new Set([
  "para","com","por","que","dos","das","nos","nas","uma","uns","umas","mais","menos","sobre","entre","apos","após",
  "contra","durante","ainda","como","onde","quando","pelo","pela","pelos","pelas","seu","sua","seus","suas","este",
  "esta","esse","essa","isso","aquele","aquela","ser","sao","são","tem","tem","foi","era","sera","será","ter","fazer",
]);

export function sinaisDaManchete(headline: string): { siglas: string[]; valores: string[]; palavras: string[] } {
  const h = String(headline || "");
  const siglas = Array.from(new Set((h.match(/\b[A-Z]{2,6}\b/g) || []).filter((s) => s !== "R")));
  const valores = Array.from(new Set(h.match(/R\$\s?[\d.,]+/g) || [])).map((v) => v.replace(/\s+/g, " ").trim());
  const palavras = Array.from(new Set(
    h.split(/\s+/).map((w) => norm(w.replace(/[^\p{L}\p{N}]/gu, "")))
      .filter((w) => w.length >= 6 && !STOP_PT.has(w)),
  ));
  return { siglas, valores, palavras };
}

export function copyCobreCaso(texts: string[], headline: string): boolean {
  const blob = texts.filter(Boolean).join("  ");
  const blobNorm = norm(blob);
  const { siglas, valores, palavras } = sinaisDaManchete(headline);
  let score = 0;
  if (siglas.some((s) => new RegExp(`\\b${s}\\b`).test(blob))) score += 2;
  // valor: compara só os dígitos ("R$ 1,3 milhão" na manchete ≈ "R$ 1,3 mi" na copy)
  if (valores.some((v) => { const d = v.replace(/[^\d,.]/g, ""); return d.length >= 1 && blob.includes(d); })) score += 2;
  score += Math.min(2, palavras.filter((p) => blobNorm.includes(p)).length);
  return score >= 2;
}
