import { NextRequest, NextResponse } from "next/server";
import { generateIllustration } from "@/lib/illustration";
import { Lang, accountFor, getLang } from "@/lib/accounts";
import { type Automation, checkBudget, logSpend, anthropicCost, EST_RUN_COST } from "@/lib/spend";
import { parseContentJson } from "@/lib/content-json";
import { dayUTC, reelSharedKey, hashStr, readReelShared, writeReelShared, selectFootage } from "@/lib/reel-shared";
import { pickNewsTopic, copyLeaksName } from "@/lib/pauta-semana";
import { readContentCache, writeContentCache } from "@/lib/content-cache";
import { recordRun, recentTopicsAllLangs, runAlreadyPublished } from "@/lib/run-ledger";
import { buildRotation, topicIndexForRun, slotForRun, pickFreshTopicIndex } from "@/lib/rotation";
import { editionFor } from "@/lib/edition";
import { searchDuckDuckGo } from "@/lib/ddg";
import { buildLiteralDirective } from "@/lib/literal-lock";

// Aumenta o limite de execução para 60s (Vercel Hobby permite até 300s)
export const maxDuration = 300;

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface SearchResult { title: string; content: string; url: string }

interface GeneratedContent {
  postTitle: string;
  postBody: string;
  slides: string[];   // 2-3 insights para slides internos
  cta: string;        // pergunta para slide final
  instagramCaption: string;
  tags: string[];
  videoQueries?: string[]; // termos EN p/ buscar footage do Reel (opcional)
}

type Slot = "manha" | "tarde" | "noite";

// ─── Temas (rotação) — FONTE ÚNICA ────────────────────────────────────────────
// Cada tema reúne topic (frase-âncora em PT-BR) + cat (cor/rótulo, espelha CATS de
// /api/og) + motif (desenho abstrato, espelha MOTIF_IDS de /api/og) + subject
// (charge/alegoria em inglês p/ a ilustração da fal) + literal (frase-verdade que
// NÃO pode ser amenizada). TOPICS e os mapas são DERIVADOS daqui → impossível
// dessincronizar. Linha editorial: ver CLAUDE.md "Linha editorial" — 4 pilares
// (servidão voluntária · a casta · o Estado que rouba · liberdade & responsabilidade).
// Régua: ANTI-CASTA E APARTIDÁRIA — alvo é o sistema e o servo voluntário, nunca
// um partido/nome. Charges SEMPRE alegóricas (sem rostos reais, sem símbolos
// partidários). Mapa cat→pilar (rótulo em /api/og): self=O SERVO · mind=O DESPERTAR
// · network=A CASTA · anxiety=O ESTADO · dopamine=PÃO E CIRCO · freedom=LIBERDADE.
interface Theme { topic: string; cat: string; motif: string; subject: string; literal?: boolean }
const THEMES: Theme[] = [
  // ── Pilar 1 — Servidão voluntária & despertar ──
  { topic: "Ninguém te escraviza: você entrega a chave todo dia", literal: true, cat: "self", motif: "boundary", subject: "a kneeling figure calmly handing the key of its own iron collar up to a faceless crowned giant, allegorical, no real faces" },
  { topic: "O tirano só é forte porque você ajoelha", literal: true, cat: "self", motif: "descent", subject: "a colossal golden throne held up on the backs of a kneeling crowd, the throne wobbling where one person starts to stand, allegorical" },
  { topic: "Pare de obedecer e o trono cai sozinho", literal: true, cat: "mind", motif: "gateway", subject: "a huge empty throne toppling as an ordinary crowd simply stands up and walks away in the same direction, no violence, allegorical" },
  { topic: "Você xinga o político e obedece ele no dia seguinte", literal: true, cat: "self", motif: "mirror", subject: "a person shouting at a poster of a faceless ruler, then bowing low to the same faceless figure the next moment, allegorical" },
  { topic: "Reclama da coleira, mas é você que segura a guia", literal: true, cat: "self", motif: "boundary", subject: "a person on all fours wearing a collar while holding their own leash in their hand, complaining, allegorical, no animals named" },
  { topic: "Acostumar com o absurdo é o primeiro passo da servidão", cat: "anxiety", motif: "decay", subject: "a person calmly reading a newspaper while sitting in a chair as dark water rises past their waist, unbothered, allegorical" },
  { topic: "O gado reclama do curral mas tem medo do portão aberto", literal: true, cat: "mind", motif: "gateway", subject: "a herd pressed against the bars of a pen with the gate wide open beside them, too afraid to walk out, allegorical" },
  // ── Pilar 2 — A casta política exploradora ──
  { topic: "O político trocou representar por explorar", cat: "network", motif: "web", subject: "a small group of well-fed crowned figures carried high on a litter on the bent backs of a vast ragged crowd, allegorical, no real faces" },
  { topic: "Eles não governam o país: governam o seu bolso", literal: true, cat: "network", motif: "bars", subject: "an enormous manicured hand reaching down into the trouser pocket of a tired worker, pulling out coins, allegorical" },
  { topic: "A casta é a única classe que nunca entra em crise", literal: true, cat: "network", motif: "orbit", subject: "a crowd struggling in a grey storm while a calm elite dines untouched at a floating banquet table above them, allegorical" },
  { topic: "Eleição é a casta dividindo quem vai te ordenhar", literal: true, cat: "network", motif: "web", subject: "two faceless suited figures shaking hands across a table while dividing a docile crowd drawn as a single cow between them, allegorical" },
  { topic: "Sorri na campanha, some na posse", cat: "network", motif: "masks", subject: "a charismatic smiling mask falling away from a cold blank face the instant a tall palace door closes, allegorical" },
  { topic: "Você é o patrão, mas vive ajoelhado pro empregado", literal: true, cat: "network", motif: "mirror", subject: "a citizen labeled boss kneeling submissively before a public servant lounging on a throne, role reversed, allegorical" },
  { topic: "Se chamam de servidores e moram em palácio", cat: "network", motif: "squares", subject: "an opulent marble palace built on top of a field of tiny crumbling houses, allegorical, no flags" },
  // ── Pilar 3 — O Estado que rouba (impostos / gastança) ──
  { topic: "Metade do que você ganha some antes de chegar em casa", literal: true, cat: "anxiety", motif: "decay", subject: "a worker walking home as the banknotes in their hand dissolve into ash one by one along the way, allegorical" },
  { topic: "Imposto é o roubo que vem com nota fiscal", literal: true, cat: "anxiety", motif: "bars", subject: "a long supermarket receipt that is also a ransom note, coins falling from it into a dark hole, allegorical" },
  { topic: "Você trabalha quase metade do ano só pra sustentar o Estado", literal: true, cat: "anxiety", motif: "clock", subject: "a calendar where the first months are wrapped in heavy chains while only the last few are free, allegorical" },
  { topic: "Quanto mais governo, menos você no comando da própria vida", literal: true, cat: "anxiety", motif: "boundary", subject: "a single ordinary person shrinking smaller and smaller as a vast grey government building swells above them, allegorical" },
  { topic: "Pagar imposto não é dever cívico: é a conta do circo", literal: true, cat: "dopamine", motif: "burst", subject: "streams of coins from tired workers pouring into the mouth of a giant gaudy circus tent, allegorical, no logos" },
  { topic: "O Estado quebra tudo que toca e te manda a fatura", cat: "anxiety", motif: "spiral", subject: "a heavy clumsy hand turning everything it touches into rubble, then handing the bill to the people below, allegorical" },
  { topic: "Te tiram em imposto e te devolvem em fila", literal: true, cat: "anxiety", motif: "waves", subject: "a fat coin dropping into a machine on one side while an endless weary queue of people comes out the other side, allegorical" },
  // ── Pilar 4 — Liberdade & responsabilidade individual ──
  { topic: "Ninguém vem te salvar: nem governo, nem messias", literal: true, cat: "freedom", motif: "descent", subject: "a lone figure at the bottom of a deep dry well calmly building its own ladder rung by rung, no rescuer in sight, allegorical" },
  { topic: "Liberdade dá trabalho; por isso preferem a coleira", literal: true, cat: "freedom", motif: "gateway", subject: "an open door to a bright hard mountain path on one side and a cozy comfortable cage on the other, a figure choosing the cage, allegorical" },
  { topic: "Esperar o governo resolver é terceirizar a própria vida", literal: true, cat: "freedom", motif: "boundary", subject: "a person handing the steering wheel of their own life over to a faceless bureaucrat and sitting back passively, allegorical" },
  { topic: "Quem te dá tudo, te controla por inteiro", literal: true, cat: "freedom", motif: "web", subject: "a giant hand offering bread with one finger while the same hand holds the strings tied to the receiver like a puppet, allegorical" },
  { topic: "Você não é livre: é assistido com a sua própria grana", literal: true, cat: "freedom", motif: "mirror", subject: "a person gratefully receiving a small coin from a huge hand that already took a sack of coins from their other pocket, allegorical" },
  { topic: "O voto não te liberta; sua coragem de não depender, sim", literal: true, cat: "freedom", motif: "branches", subject: "a single tree growing tall and free in the opposite direction from a uniform forest bent toward a distant idol, allegorical" },
  { topic: "Pão e circo é barato; liberdade é cara — e vale", cat: "dopamine", motif: "burst", subject: "a crowd entranced by free bread and a flashy circus while behind them a vast open horizon and an unguarded gate are ignored, allegorical" },
  { topic: "O problema não é só quem está em cima: é quem aplaude embaixo", literal: true, cat: "mind", motif: "ripple", subject: "a vast crowd applauding a faceless figure on a pedestal while one single person quietly lowers their hands and turns away, allegorical" },
];

const TOPICS = THEMES.map((t) => t.topic);
const TOPIC_CAT: Record<string, string> = Object.fromEntries(THEMES.map((t) => [t.topic, t.cat]));
const TOPIC_MOTIF: Record<string, string> = Object.fromEntries(THEMES.map((t) => [t.topic, t.motif]));
const TOPIC_SUBJECT: Record<string, string> = Object.fromEntries(THEMES.map((t) => [t.topic, t.subject]));
// Temas-convicção (frase-verdade do dono): título/slide preservam a frase, NUNCA viram
// "libertad". Derivado do flag `literal` (fonte única THEMES). Trava em src/lib/literal-lock.ts.
const TOPIC_LITERAL: Record<string, boolean> = Object.fromEntries(THEMES.filter((t) => t.literal).map((t) => [t.topic, true]));

// ─── Extrai keyword curta do tópico ──────────────────────────────────────────

function extractKeyword(topic: string): string {
  const STOP = new Set(["y","e","o","de","del","la","el","los","las","a","en","con","por","un","una","sus","su","al","se","lo"]);
  const word = topic.split(/\s+/).find(w => !STOP.has(w.toLowerCase())) ?? topic.split(" ")[0];
  return word.toUpperCase().replace(/[^A-ZÁÉÍÓÚÜÑ]/g, "");
}

// runIndex 0..5 → um dos 6 horários do dia. Garante 6 tópicos DISTINTOS por dia
// (o esquema antigo, por dia-da-semana+slot, repetia o tópico nos 2 crons do mesmo
//  slot e o 2º era barrado pela checagem de duplicata → só 3 posts/dia de fato).
// Rotação determinística SEM repetição (cada tema 1× por ciclo de N posts ≈ 8,5
// dias > trava anti-dup de 7d) e com categorias INTERCALADAS. Substitui o
// reembaralho semanal antigo, que fazia o mesmo tema voltar em 1–3 dias e a
// anti-dup bloquear o post. Lógica em src/lib/rotation.ts (com teste invariante).
const ROTATION = buildRotation(THEMES.map((t) => t.cat));
function getTopicForRun(date: Date, runIndex: number): string {
  return TOPICS[topicIndexForRun(ROTATION, date, runIndex)];
}

// tópico → índice no array original (p/ a trava anti-dup mapear recentes p/ índices).
const TOPIC_INDEX = new Map(TOPICS.map((t, i) => [t, i] as const));

// Tópico do (data, run) com TRAVA ANTI-DUP CROSS-FORMATO: pula os temas já
// publicados na conta nos últimos 7d em QUALQUER formato (reel ∪ carrossel).
// É a trava REAL — robusta a mudanças de rotação e a repetição reel↔carrossel
// (o bug em que "padre ausente" saiu Reel num dia e carrossel no outro). A
// rotação determinística sozinha não bastava: trocar o algoritmo (ou o reel não
// gravar tópico) reintroduzia repetições. Fail-open: erro de banco → tema-base.
async function getFreshTopicForRun(date: Date, runIndex: number, _lang: Lang): Promise<string> {
  try {
    // Base UNIFICADA (qualquer conta): ES e PT veem os MESMOS recentes → escolhem o
    // MESMO tema por vaga (vídeo compartilhado) e nenhum repete.
    const recent = await recentTopicsAllLangs(7);
    const used = new Set<number>();
    for (const t of recent) {
      const i = TOPIC_INDEX.get(t);
      if (i !== undefined) used.add(i);
    }
    // THREADING intra-dia: inclui os temas que os runs ANTERIORES de hoje escolhem
    // (deterministicamente, mesma base) → 6 temas DISTINTOS no dia, sem depender da
    // ordem/timing de gravação no livro-razão (robusto a re-disparo do catchup).
    for (let i = 0; i < runIndex; i++) {
      used.add(pickFreshTopicIndex(ROTATION, slotForRun(date, i), used));
    }
    return TOPICS[pickFreshTopicIndex(ROTATION, slotForRun(date, runIndex), used)];
  } catch {
    return getTopicForRun(date, runIndex);
  }
}

// Tom editorial derivado do horário (3 slots), independente do tópico.
const SLOT_FOR_RUN: Slot[] = ["manha", "tarde", "noite", "manha", "tarde", "noite"];

// ─── Instruções por slot ──────────────────────────────────────────────────────

const SLOT_INSTRUCTIONS: Record<Slot, string> = {
  manha: "Ângulo MANHÃ: o despertar. Sacode o leitor pra começar o dia enxergando a própria coleira. Tom reflexivo e cortante, mais ideia que piada.",
  tarde: "Ângulo TARDE: o mecanismo. Mostra COMO o esquema funciona (imposto embutido, dependência, troca de liberdade por migalha) de forma concreta e didática. Tom direto e revelador.",
  noite: "Ângulo NOITE: a provocação. Ironia ácida e alto engajamento; termina abrindo o debate. Tom ousado, de quem não tem mais paciência.",
};

// ─── Pesquisa de contexto (GRÁTIS) — DuckDuckGo (web inteira) + Wikipedia (reserva) ─
// Contexto factual de apoio pro prompt; não precisa ser fresco (temas perenes).
// PRIMÁRIA: DuckDuckGo (web inteira, sem chave, sem cartão — src/lib/ddg.ts).
// RESERVA: Wikipedia (enciclopédica) quando o DDG vier vazio/bloqueado. O DDG
// estrangula IP de datacenter (202/403) → a queda pra Wikipedia tende a ser comum
// em prod; por isso o log diz a FONTE (pra medir no teste de uns dias). Espanhol
// (es) porque a pesquisa é COMPARTILHADA ES/PT (conteúdo regenerado por mercado,
// não traduzido). FAIL-OPEN total: erro/zero → [] e a geração segue SEM contexto.
// Histórico: Tavily (paga) aposentada 23/06; Brave virou pago e Google fechou a API
// JSON p/ clientes novos → DDG é a única busca grátis de web inteira (decisão 23/06).
const WIKI_UA = "UmPaisDeMerdaBot/1.0 (research; satire/politics)";

async function searchTopic(topic: string, _automation: Automation): Promise<SearchResult[]> {
  // 1º DuckDuckGo (web inteira); se vazio/bloqueado, Wikipedia (reserva). Ambos fail-open.
  const ddg = await searchDuckDuckGo(topic);
  if (ddg.length > 0) {
    console.log(`[search] fonte=ddg n=${ddg.length} topic="${topic}"`);
    return ddg;
  }
  const wiki = await searchWikipedia(topic);
  console.log(`[search] fonte=wikipedia(reserva) n=${wiki.length} topic="${topic}"`);
  return wiki;
}

async function searchWikipedia(topic: string): Promise<SearchResult[]> {
  try {
    // Viés leve pro domínio — melhora a relevância de temas-frase político-cívicos
    // (ex.: "servidão voluntária" → La Boétie/teoria política, não um filme).
    const searchUrl = `https://pt.wikipedia.org/w/rest.php/v1/search/page?q=${encodeURIComponent(topic + " política liberdade Estado")}&limit=3`;
    const sres = await fetch(searchUrl, { headers: { "User-Agent": WIKI_UA } });
    if (!sres.ok) return [];
    const sdata = await sres.json();
    const pages: any[] = (sdata.pages ?? []).slice(0, 3);
    const summaries = await Promise.all(
      pages.map(async (p): Promise<SearchResult | null> => {
        const key = p.key ?? p.title;
        if (!key) return null;
        try {
          const r = await fetch(
            `https://pt.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(key)}`,
            { headers: { "User-Agent": WIKI_UA } },
          );
          if (!r.ok) return null;
          const d = await r.json();
          if (!d.extract) return null;
          return { title: d.title ?? p.title ?? "", content: d.extract, url: d.content_urls?.desktop?.page ?? "" };
        } catch { return null; }
      }),
    );
    return summaries.filter((s): s is SearchResult => s !== null);
  } catch {
    return []; // fail-open: gera sem contexto
  }
}

// ─── Geração de conteúdo via Claude ──────────────────────────────────────────

async function generateContent(
  topic: string,
  searchResults: SearchResult[],
  slot: Slot,
  lang: Lang = "pt",
  automation: Automation,
  newsInspiration?: string, // 2ª frente: manchete real da semana como GATILHO do padrão
): Promise<GeneratedContent> {
  const acc = accountFor(lang);
  const L = acc.langName; // "español" | "português do Brasil"
  const context = searchResults.map((r, i) => `[${i + 1}] ${r.title}\n${r.content}`).join("\n\n");
  // Trava anti-amenização: em tema-convicção, o título preserva a frase-verdade (não vira "libertad").
  const literalDirective = buildLiteralDirective(!!TOPIC_LITERAL[topic], acc.freedom);

  const marketSection = acc.marketBrief
    ? `\nMERCADO / VOZ NATIVA — LEIA ANTES DE TUDO (vale mais que qualquer exemplo abaixo):\n${acc.marketBrief}\n`
    : "";

  // 2ª FRENTE (corrupção da semana): a manchete real entra só como GATILHO do
  // PADRÃO. A régua apartidária abaixo continua INVIOLÁVEL — o post é atemporal e
  // NÃO cita nada da manchete. (Backstop de código copyLeaksName rejeita se vazar.)
  const newsSection = newsInspiration
    ? `\nGATILHO DA SEMANA (uma manchete REAL do noticiário, use APENAS como faísca para achar o PADRÃO por trás — casta/Estado/servidão): "${newsInspiration}"\nOBRIGATÓRIO: NÃO cite, NÃO parafraseie e NÃO deixe reconhecer nada dessa manchete — nem nomes, siglas, partidos, cargos, instituições, lugares, datas ou o fato específico. Extraia só o MECANISMO atemporal e escreva sobre ELE. Se não der pra abstrair sem entregar a manchete, escreva sobre o padrão do pilar de forma genérica.\nCAIXA: escreva o título e os insights em CAIXA NORMAL de frase (só a inicial maiúscula) — NUNCA Title Case (não capitalize cada palavra) nem TUDO MAIÚSCULO; a tela já deixa o título em maiúsculas sozinha.\n`
    : "";

  const prompt = `Você é o editor de "${acc.brand}" (${acc.handle}), uma página brasileira de SÁTIRA POLÍTICA LIBERTÁRIA, ANTI-CASTA E APARTIDÁRIA.

IMPORTANTE — IDIOMA: gere ABSOLUTAMENTE TODA a saída (postTitle, postBody, slides, cta, instagramCaption, tags) em ${L}. NÃO misture idiomas. (videoQueries é a ÚNICA exceção: vai em inglês.)
${marketSection}
Tema: "${topic}"
${SLOT_INSTRUCTIONS[slot]}
${literalDirective}
REGRA DE MARCA (${acc.brand}): todo tema é puxado para o eixo SERVIDÃO VOLUNTÁRIA × ${acc.freedom.toUpperCase()} — o povo que sustenta o próprio jugo, a casta que explora, o Estado que rouba, e o indivíduo que pode parar de obedecer e assumir a própria vida. O título e ao menos UM dos insights devem conectar explicitamente com essa ideia (EXCEÇÃO: num TEMA-CONVICÇÃO, essa conexão vai num insight, NUNCA no título — o título preserva a frase exata). Nada de comentário político genérico: sempre remete ao DNA da página.

VOZ EDITORIAL: direta, mordaz, irônica, sem medo da POLÊMICA — a polêmica é a ferramenta, não o acidente; é o que gera alcance e debate. Diz VERDADES INCÔMODAS de forma LITERAL: nunca suavize, relativize nem "equilibre" pra deixar confortável — a força da frase É o produto. O ESPELHO é o coração: a culpa não é só "deles" lá em cima; é também do servo voluntário que aplaude embaixo. Provoque o LEITOR a se enxergar.

RÉGUA APARTIDÁRIA (inviolável): o alvo é a CLASSE POLÍTICA INTEIRA e o ESTADO inchado — esquerda E direita, governo E oposição. NUNCA defenda nem ataque um partido, lado, governo ou figura específica; NUNCA cite nomes, siglas ou fatos do noticiário. A crítica é ao SISTEMA e ao COMPORTAMENTO do povo — atemporal.
${newsSection}

A provocação vem da IDEIA, NUNCA do ódio: ataca o sistema, a casta abstrata e o comodismo — JAMAIS uma pessoa ou grupo (por região, classe, raça, orientação, religião). Nunca insulte, desumanize nem incite violência — isso derruba a conta. Incomode com argumento e ironia, não com xingamento gratuito.

MOTOR DE ALCANCE (o que o algoritmo mais premia é RETENÇÃO + SALVAMENTOS + COMPARTILHAMENTOS):
- GANCHO: o título e o PRIMEIRO insight têm que travar o dedo em 1-2 segundos. Fale com "você", abra uma brecha de curiosidade ou dê uma virada inesperada. Concreto e específico, nunca abstrato (ex.: "Você trabalha 5 meses do ano só pra sustentar o Estado" > "A carga tributária é alta").
- SALVÁVEL: ao menos UM insight deve ser um reenquadramento que a pessoa queira SALVAR pra reler (uma virada de chave que muda como ela enxerga o esquema).
- COMPARTILHÁVEL: o cta deve convidar a comentar E a marcar/compartilhar com alguém ("Você conhece alguém que…?", "Marca aquele amigo que…"), porque marcar = compartilhar.
- SEGUIDORES (objetivo PRINCIPAL): muita gente que vê isso AINDA NÃO te segue. A legenda deve fechar SEMPRE, antes das hashtags, com um CTA explícito de SEGUIR ${acc.handle} dando um MOTIVO na voz da marca — provocador, nunca genérico ("Segue se você prefere a verdade incômoda ao aplauso fácil" SIM; "Siga para mais conteúdo" NÃO) — além do CTA de salvar (🔖) e compartilhar (📩).

Contexto pesquisado:
${context}

Gere um JSON válido (sem markdown, sem crases) com esta estrutura EXATA:
{
  "postTitle": "GANCHO que trava o scroll, máx 55 chars, concreto e dirigido a 'você', em ${L}",
  "postBody": "artigo em markdown mín 300 palavras, TODO EM ${L}",
  "slides": [
    "insight 1 — GANCHO contundente de NO MÁXIMO 80 chars que abre uma brecha de curiosidade",
    "insight 2 — frase contundente de NO MÁXIMO 80 chars que aprofunda",
    "insight 3 — reenquadramento SALVÁVEL de NO MÁXIMO 80 chars que arremata"
  ],
  "cta": "pergunta de 60-100 chars que convide a comentar e a marcar/compartilhar com alguém, em ${L}",
  "instagramCaption": "legenda IG máx 2200 chars: gancho forte na 1ª linha + desenvolvimento + fechamento com CTA de SEGUIR ${acc.handle} (com motivo provocador de marca) + salvar (🔖) + compartilhar (📩) + 4-5 hashtags, em ${L}",
  "tags": ["tag1", "tag2", "tag3", "tag4"],
  "videoQueries": [
    "CENA 1 (gancho): o SUJEITO DO PROBLEMA em tensão — quem sofre ou o alvo da denúncia, com emoção no rosto/mãos. Termo EM INGLÊS. Ex: 'close up hands emptying worn wallet'",
    "CENA 2 (revelação): o CONTRASTE que o dado expõe — em geral QUEM GANHA (a casta, o luxo, o poder confortável). O corte da cena 1 p/ a 2 é o choque. Ex: 'champagne poured at luxury party'",
    "CENA 3 (provocação): a VIRADA — despertar, olhar que se levanta, corrente arrebentando, porta que abre, multidão. Ex: 'man slowly looking up into the light'"
  ]
}

Para "videoQueries" (o FUNDO de cada cena do Reel — 3 termos EM INGLÊS, 1 por cena NA ORDEM):
- Sátira política NÃO tem footage literal: pense em SÍMBOLO/ARQUÉTIPO, não em ilustração do tema. Busque o SUBSTANTIVO CONCRETO que simboliza (nunca conceito abstrato como "freedom"/"corruption"/"government" — isso volta lixo corporativo).
- A alavanca mais forte é o CONTRASTE IRÔNICO: mostrar QUEM GANHA, não quem perde (texto amargo sobre imposto → footage de jantar de luxo/jato). O gap imagem↔texto é a piada.
- UM sujeito claro, legível em <1s, enquadramento FECHADO (escreva "close up ..." quando puder), com ROSTO humano com emoção OU movimento — nunca plano geral genérico.
- Cada termo casa com a MENSAGEM DAQUELE beat (não com o tema geral). Arco: vítima → quem se beneficia → virada.
- Atemporal e neutro: sem pessoas reconhecíveis, sem texto na tela, sem marcos que gritem "EUA" (Capitólio/bandeira). 2-4 palavras, deve existir no Pexels.`;

  // O haiku ocasionalmente devolve JSON malformado → o post falhava silencioso.
  // Tentamos 2×: extrai o objeto (parseContentJson) e, se o parse falhar, regenera.
  const MAX_CONTENT_TRIES = 2;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_CONTENT_TRIES; attempt++) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) throw new Error(`Claude API error: ${res.status}`);
    const data = await res.json();
    await logSpend({ automation, platform: "anthropic", operation: "content", model: "claude-haiku-4-5-20251001", units: (data?.usage?.input_tokens ?? 0) + (data?.usage?.output_tokens ?? 0), costUsd: anthropicCost("claude-haiku-4-5-20251001", data?.usage) });
    const raw = data.content?.[0]?.text ?? "";
    try {
      return parseContentJson<GeneratedContent>(raw);
    } catch (e) {
      lastErr = e; // JSON malformado → regenera na próxima volta
    }
  }
  throw new Error(`generateContent: JSON inválido após ${MAX_CONTENT_TRIES} tentativas: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`);
}

// ─── Token do Instagram ───────────────────────────────────────────────────────

async function getAccessToken(lang: Lang = "pt"): Promise<string> {
  const acc = accountFor(lang);
  // ES: token no config do DB (refresh automático) → env. PT: só env.
  if (acc.dbTokenKey) {
    try {
      const { sql } = await import("@vercel/postgres");
      const rows = await sql`SELECT value FROM config WHERE key = ${acc.dbTokenKey}`;
      if (rows.rows[0]?.value) return rows.rows[0].value;
    } catch { /* fallback */ }
  }
  return process.env[acc.tokenEnv] ?? "";
}

// ─── Publicação como carrossel ────────────────────────────────────────────────

async function publishCarousel(
  caption: string,
  imageUrls: string[],
  lang: Lang = "pt",
): Promise<string> {
  const acc = accountFor(lang);
  const accountId = process.env[acc.accountIdEnv] ?? "";
  const token     = await getAccessToken(lang);
  const base      = `https://graph.instagram.com/v25.0/${accountId}`;

  // 1. Criar container para cada slide
  const childIds: string[] = [];
  for (const url of imageUrls) {
    const r = await fetch(`${base}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_url: url, is_carousel_item: true, access_token: token }),
    });
    if (!r.ok) throw new Error(`Carousel child error: ${await r.text()}`);
    const { id } = await r.json();
    childIds.push(id);
    await new Promise(res => setTimeout(res, 800)); // pausa entre criações
  }

  // 2. Criar container do carrossel
  const carRes = await fetch(`${base}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      media_type: "CAROUSEL",
      children: childIds.join(","),
      caption,
      access_token: token,
    }),
  });
  if (!carRes.ok) throw new Error(`Carousel container error: ${await carRes.text()}`);
  const { id: carId } = await carRes.json();

  // 3. Aguardar processamento
  await new Promise(res => setTimeout(res, 3000));

  // 4. Publicar
  const pubRes = await fetch(`${base}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: carId, access_token: token }),
  });
  if (!pubRes.ok) throw new Error(`Carousel publish error: ${await pubRes.text()}`);
  const { id: postId } = await pubRes.json();
  return postId;
}

// ─── Salvar no banco ──────────────────────────────────────────────────────────

async function savePost(params: {
  topic: string; slot: Slot; title: string; body: string;
  instagramCaption: string; tags: string[];
  instagramPostId: string | null; publishedAt: Date; lang: Lang;
}): Promise<void> {
  const { sql } = await import("@vercel/postgres");
  await sql`
    INSERT INTO posts (
      topic, slot, title, content, body, instagram_caption,
      tags, instagram_post_id, published_at, lang
    ) VALUES (
      ${params.topic}, ${params.slot}, ${params.title},
      ${params.body}, ${params.body}, ${params.instagramCaption},
      ${"{" + params.tags.join(",") + "}"},
      ${params.instagramPostId}, ${params.publishedAt.toISOString()}, ${params.lang}
    )
  `;
}

// ─── Handler principal ────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const slotParam = sp.get("slot") as Slot | null;
  const runParam = sp.get("run");
  const topicOverride = sp.get("topic");
  const force = sp.get("force") === "1"; // ignora a trava anti-duplicata de 24h (re-publicação/backfill manual)
  const lang = getLang(sp.get("lang")); // "es" (default, conta atual) | "pt"

  // Quais "runs" (0..5) processar nesta chamada:
  // • ?run=N  → exatamente esse horário (caminho do cron, 1 post distinto por horário)
  // • ?slot=  → um horário representativo daquele slot (1 post)
  // • vazio   → os 3 slots base (compatível com o disparo manual antigo)
  let runs: number[];
  if (runParam !== null && /^[0-5]$/.test(runParam)) {
    runs = [parseInt(runParam, 10)];
  } else if (slotParam && ["manha", "tarde", "noite"].includes(slotParam)) {
    runs = [{ manha: 0, tarde: 1, noite: 2 }[slotParam]];
  } else {
    runs = [0, 1, 2];
  }

  // Diagnóstico: roda só a geração da fal e devolve o resultado SEM publicar.
  if (sp.get("dryrun") === "1") {
    const r = runs[0];
    const topic = topicOverride ?? getTopicForRun(new Date(), r);
    const cat = TOPIC_CAT[topic] ?? "freedom";
    const subject = TOPIC_SUBJECT[topic] ?? "";
    // Teto: testes manuais entram no orçamento "manual" (evita o pico de dev).
    const gate = await checkBudget("manual", EST_RUN_COST.dryrun);
    if (!gate.ok) {
      return NextResponse.json({ blocked: true, automation: "manual", reason: `Orçamento diário estourado (gasto US$${gate.spent.toFixed(3)} + est US$${gate.est.toFixed(3)} > teto US$${gate.budget.toFixed(2)})`, gate }, { status: 402 });
    }
    // Testa a geração da ilustração SEM publicar (útil p/ validar a fal/FAL_KEY).
    // Diagnóstico: 1 tentativa só, e reusa o cache do dia (não paga em reruns).
    // ?fresh=1 força uma geração real na fal (quando o objetivo é mesmo testar a fal).
    const fresh = sp.get("fresh") === "1";
    const ill = await generateIllustration(subject, cat, { maxTries: 1, useCache: !fresh, automation: "manual" });
    return NextResponse.json({ dryrun: true, run: r, topic, cat, subject, illustration: ill, falKeyPresent: !!process.env.FAL_KEY });
  }

  // Prévia: gera o conteúdo do dia (e a ilustração da capa) e devolve SEM publicar.
  // Usado pelo pipeline de Reels — o vídeo é renderizado a partir deste mesmo
  // conteúdo, com a ilustração da fal como fundo da capa.
  if (sp.get("preview") === "1") {
    const r = runs[0];
    const slot = SLOT_FOR_RUN[r];
    const now = new Date();
    const topic = topicOverride ?? await getFreshTopicForRun(now, r, lang);
    const cat = TOPIC_CAT[topic] ?? "freedom";

    // Teto: o preview é o pipeline do Reel diário.
    const gate = await checkBudget("ig-reels", EST_RUN_COST.preview);
    if (!gate.ok) {
      return NextResponse.json({ blocked: true, automation: "ig-reels", reason: `Orçamento diário estourado (gasto US$${gate.spent.toFixed(3)} + est US$${gate.est.toFixed(3)} > teto US$${gate.budget.toFixed(2)})`, gate }, { status: 402 });
    }

    // Base LÍNGUA-INDEPENDENTE compartilhada entre ES e PT (= MESMO vídeo): a
    // pesquisa (Wikipedia) e o footage (Pexels) são resolvidos UMA vez por (tópico,
    // dia) e cacheados; o 2º idioma reusa tudo. Só a COPY muda por idioma.
    const day = dayUTC();
    const shared = await readReelShared(topic, day);

    // Pesquisa: reusa a do cache ou busca agora (Wikipedia, grátis e fail-open).
    const searchResults = shared?.research?.length ? shared.research : await searchTopic(topic, "ig-reels");
    // Copy: reusa o cache por (tópico, dia, idioma) → redisparo NÃO repaga a Anthropic.
    let content = (await readContentCache(topic, day, lang)) as GeneratedContent | null;
    if (!content) {
      content = await generateContent(topic, searchResults, slot, lang, "ig-reels");
      await writeContentCache(topic, day, lang, content);
    }

    // videoQueries CANÔNICOS (inglês, língua-independente): do cache (1º idioma)
    // ou os recém-gerados. Garantem o mesmo footage entre os idiomas.
    const videoQueries = shared?.videoQueries?.length
      ? shared.videoQueries
      : (Array.isArray(content.videoQueries) ? content.videoQueries : []);

    // Footage: reusa os clipes do cache (vídeo IDÊNTICO ES/PT) ou seleciona agora
    // com seed de (tópico,dia) — independente de conta. Só cacheia quando há clipes.
    let clips: string[] = shared?.clips ?? [];
    if (!clips.length) {
      clips = await selectFootage(videoQueries, cat, hashStr(reelSharedKey(topic, day)), 5, reelSharedKey(topic, day));
      if (clips.length) await writeReelShared(topic, day, { research: searchResults, videoQueries, clips });
    }

    // Número de edição: por VAGA (dia, run), o MESMO p/ ES e PT (mesmo conteúdo
    // traduzido), monotônico e único — não repete entre Reels (ver edition.ts).
    // Fail-open: se o banco falhar (ed=0), cai no esquema antigo COUNT(posts)+1.
    let editionNum = await editionFor(day, r);
    if (!editionNum) {
      try {
        const { sql } = await import("@vercel/postgres");
        const countResult = await sql`SELECT COUNT(*) as n FROM posts`;
        editionNum = (parseInt(countResult.rows[0]?.n ?? "0") || 0) + 1;
      } catch { editionNum = 1; }
    }
    const ed = String(editionNum).padStart(2, "0");
    const kw = extractKeyword(topic);

    // O Reel de VÍDEO usa FOOTAGE de banco (Pexels) — NÃO gera ilustração na fal
    // aqui (economia; o preview roda várias vezes/dia). EXCEÇÃO: ?illus=1 — o Reel
    // CLÁSSICO (slide animado) usa a ilustração de fundo como a CARA da capa.
    // maxTries=3 (não 1): aqui o "preview" É o render real do clássico (1×/dia) e ele
    // DEPENDE da ilustração; com 1 tentativa, um QA reprovado deixava a capa em branco
    // (só marca d'água). 3 tentativas = mesma robustez do carrossel → a capa quase
    // sempre sai com a ilustração. Reusa o cache do dia (ES/PT compartilham; uma vez
    // aprovada, redisparo não re-paga) e contabiliza na automação ig-reels.
    let illustrationUrl: string | null = null;
    let illustrationError: string | null = null;
    if (sp.get("illus") === "1") {
      const ill = await generateIllustration(TOPIC_SUBJECT[topic] ?? "", cat, { maxTries: 3, automation: "ig-reels", meta: { topic, lang } });
      illustrationUrl = ill.url ?? null;
      illustrationError = ill.error ?? null;
    }

    return NextResponse.json({
      preview: true,
      slot, run: r, topic, cat,
      lang,
      handle: accountFor(lang).handle, // @ correto por idioma (criativo do Reel)
      brand: accountFor(lang).brand, // nome de exibição por idioma
      title: content.postTitle,
      slides: content.slides,
      accentWords: [],
      cta: content.cta,
      caption: content.instagramCaption,
      kw, ed,
      videoQueries, // canônicos (compartilhados entre idiomas)
      clips,        // footage COMPARTILHADO (mesmo vídeo ES/PT); [] → fetch-footage.mjs busca no CI
      sharedFootage: clips.length > 0, // diagnóstico: veio da base compartilhada?
      illustration: illustrationUrl,
      illustrationError,
    });
  }

  const results = [];
  let anyBlocked = false;

  try {
    for (const runIndex of runs) {
      const slot = SLOT_FOR_RUN[runIndex];
      const slotLog: Record<string, unknown> = { slot, run: runIndex };

      try {
        const now   = new Date();

        // IDEMPOTÊNCIA por (dia, run, conta) — a MESMA trava que o Reel já tinha.
        // Sem ela, quando o catchup recupera um run E o cron atrasado do GitHub
        // dispara o MESMO run depois, o carrossel publicava 2× (o anti-dup por
        // TÓPICO não pega porque a seleção fresca dá um tema diferente a cada hora).
        // Aqui: se a vaga já saiu hoje nesta conta, pula (force=1 burla p/ backfill).
        if (!force && await runAlreadyPublished(dayUTC(now), runIndex, lang)) {
          slotLog.skipped = true;
          slotLog.reason = `run ${runIndex} (${lang}) já publicado hoje — idempotência`;
          results.push(slotLog);
          continue;
        }

        // Tópico FRESCO: já pula o que saiu nos últimos 7d em QUALQUER formato
        // (reel ∪ carrossel) — trava anti-dup real, não só a checagem de `posts`.
        const topic = topicOverride ?? await getFreshTopicForRun(now, runIndex, lang);
        slotLog.topic = topic;

        // Backstop defensivo (a menos que force=1): se mesmo assim o tópico já saiu
        // como CARROSSEL nesta conta em 7d, pula. Com o tópico fresco acima isto
        // praticamente nunca dispara (N=51 > 6×7); fica como rede de segurança.
        if (!force) {
          try {
            const { sql } = await import("@vercel/postgres");
            const existing = await sql`SELECT id FROM posts WHERE topic = ${topic} AND lang = ${lang} AND published_at > NOW() - INTERVAL '7 days' LIMIT 1`;
            if (existing.rows.length > 0) {
              slotLog.skipped = true;
              slotLog.reason = "Tópico já publicado nesta conta nos últimos 7 dias";
              continue;
            }
          } catch { /* ignora erro de banco */ }
        }

        // Teto diário da automação ig-posts: se a próxima publicação estoura o
        // orçamento, BLOQUEIA (não gasta) e sinaliza p/ o GitHub Actions falhar.
        const gate = await checkBudget("ig-posts", EST_RUN_COST.publish);
        if (!gate.ok) {
          anyBlocked = true;
          slotLog.blocked = true;
          slotLog.reason = `Orçamento diário ig-posts estourado (gasto US$${gate.spent.toFixed(3)} + est US$${gate.est.toFixed(3)} > teto US$${gate.budget.toFixed(2)}). Suba budget:ig-posts em config p/ liberar.`;
          results.push(slotLog);
          continue;
        }

        // Copy: reusa o cache por (tópico, dia, idioma) → redisparo NÃO repaga
        // a Anthropic. Só busca (Wikipedia, grátis) + gera no MISS.
        let content = (await readContentCache(topic, dayUTC(now), lang)) as GeneratedContent | null;
        if (!content) {
          const searchResults = await searchTopic(topic, "ig-posts");
          // 2ª FRENTE (corrupção da semana): no slot "noite", puxa uma manchete real
          // como GATILHO do padrão (apartidário; a régua + a guarda abaixo protegem).
          const news = slot === "noite" ? pickNewsTopic(hashStr(`${dayUTC(now)}|${runIndex}`)) : null;
          content = await generateContent(topic, searchResults, slot, lang, "ig-posts", news?.headline);
          // GUARDA anti-vazamento: se a copy citou nome/partido/instituição/sigla,
          // REFAZ sem a notícia (tema fixo puro). Backstop de código da régua.
          if (news && copyLeaksName([content.postTitle, ...(content.slides || []), content.cta, content.instagramCaption])) {
            slotLog.newsGuard = "descartou notícia (vazou nome) → tema fixo";
            content = await generateContent(topic, searchResults, slot, lang, "ig-posts");
          } else if (news) {
            slotLog.newsFront = true;
          }
          await writeContentCache(topic, dayUTC(now), lang, content);
        }
        slotLog.title = content.postTitle;

        // Número de edição: por VAGA (dia, run), MESMO p/ ES e PT, único e
        // monotônico (ver edition.ts). Fail-open p/ o esquema antigo COUNT(posts)+1.
        let editionNum = await editionFor(dayUTC(now), runIndex);
        if (!editionNum) {
          try {
            const { sql } = await import("@vercel/postgres");
            const countResult = await sql`SELECT COUNT(*) as n FROM posts`;
            editionNum = (parseInt(countResult.rows[0]?.n ?? "0") || 0) + 1;
          } catch { editionNum = 1; }
        }
        const ed   = String(editionNum).padStart(2, "0");
        const kw   = extractKeyword(topic);
        // mood alterna: red para ímpares, ink para pares (igual ao EditorialGrid do site)
        const mood = editionNum % 2 === 0 ? "ink" : "red";

        // Construir URLs dos slides
        const base = process.env.PRODUCTION_URL ?? "http://localhost:3000";
        const enc  = (s: string) => encodeURIComponent(s.slice(0, 120));
        const totalSlides = 2 + content.slides.length; // capa + insights + cta

        // Primeira tag como categoria do rodapé
        const tag = enc(content.tags[0] ?? kw);
        // Direção de arte do slide: cor (categoria) + desenho (motivo por tema)
        const cat   = TOPIC_CAT[topic] ?? "freedom";
        const motif = TOPIC_MOTIF[topic] ?? "gateway";

        // CAPA do carrossel: estilo JORNAL (tipografia + carimbo), SEM ilustração
        // por IA. Política aprovada pelo dono (2026-06-24): "sem charge fal" → custo
        // de fal = ZERO. A capa não usa `img`; o JornalCover renderiza só com texto.
        // (Para reativar a charge no futuro: gerar via generateIllustration e passar
        //  &img=..., subindo o teto de ig-posts conforme a política do agente de gastos.)
        slotLog.illustration = "tipografia (sem fal)";
        const imgParam = "";

        const slideUrls: string[] = [
          `${base}/api/og?slide=cover&slot=${slot}&title=${enc(content.postTitle)}&kw=${enc(kw)}&ed=${ed}&mood=${mood}&tag=${tag}&cat=${cat}&motif=${motif}${imgParam}&total=${totalSlides}&lang=${lang}`,
          ...content.slides.map((text, i) =>
            `${base}/api/og?slide=insight&slot=${slot}&text=${enc(text)}&num=${i + 2}&total=${totalSlides}&kw=${enc(kw)}&ed=${ed}&mood=${mood}&tag=${tag}&cat=${cat}&motif=${motif}&lang=${lang}`
          ),
          `${base}/api/og?slide=cta&slot=${slot}&text=${enc(content.cta)}&kw=${enc(kw)}&ed=${ed}&mood=${mood}&tag=${tag}&cat=${cat}&motif=${motif}&num=${totalSlides}&total=${totalSlides}&lang=${lang}`,
        ];

        // Publicar carrossel
        let instagramPostId: string | null = null;
        try {
          instagramPostId = await publishCarousel(content.instagramCaption, slideUrls, lang);
          slotLog.instagramPostId = instagramPostId;
          slotLog.slides = slideUrls.length;
        } catch (igErr) {
          slotLog.instagramError = String(igErr);
        }

        // Salvar no banco
        await savePost({
          topic, slot,
          title: content.postTitle,
          body: content.postBody,
          instagramCaption: content.instagramCaption,
          tags: content.tags,
          instagramPostId,
          publishedAt: now,
          lang,
        });

        // Livro-razão (dia,run,lang) p/ o watchdog — só conta como publicado se saiu.
        if (instagramPostId) await recordRun(dayUTC(now), runIndex, lang, "carousel", instagramPostId, topic);

        slotLog.ok = true;
      } catch (slotErr) {
        console.error("[publish] erro no slot:", slotErr);
        slotLog.ok    = false;
        slotLog.error = "erro ao publicar slot";
      }

      results.push(slotLog);
    }

    // Se alguma run foi bloqueada pelo teto, devolve 402 para o workflow falhar
    // (::error:: no GitHub Actions) e avisar o dono — mesmo que outras tenham ok.
    if (anyBlocked) {
      return NextResponse.json({ ok: false, blocked: true, posts: results }, { status: 402 });
    }
    return NextResponse.json({ ok: true, posts: results });
  } catch (err) {
    console.error("[publish] erro geral:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
