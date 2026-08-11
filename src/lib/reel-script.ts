// ─── ROTEIRO DO REEL — a crítica já nasce na forma falada ─────────────────────
// Ordem do dono (31/07/2026): buscar a notícia → fazer a crítica com a voz →
// criar o roteiro → gravar a voz → criar a legenda.
//
// A peça que faltava é ESTA. Antes o Reel reusava a copy do CARROSSEL (título +
// 3 "insights" de 80 chars, sem papel de cena) e o route.ts colava tudo num
// roteiro na hora de narrar — por isso o Reel soava como post lido em voz alta.
// Aqui o roteiro tem 5 cenas com PAPEL NOMEADO, e a crítica é gerada já nesse
// formato (uma geração só: crítica + roteiro + legenda saem juntos, senão o
// roteiro vira resumo da crítica e a voz se perde na tradução entre etapas).
//
// As 5 cenas batem 1-para-1 com o motor: ReelV2 renderiza capa + até 3 insights +
// CTA, e selectFootage entrega 5 clipes distintos, um por cena.

export interface ReelRoteiro {
  gancho: string;     // cena 1 (capa)  — o caso em uma frase, com órgão e número
  fato: string;       // cena 2         — o que aconteceu, dado citável
  mecanismo: string;  // cena 3         — por que não é exceção: é o padrão
  espelho: string;    // cena 4         — a conta volta pro leitor (OBRIGATÓRIA)
  pergunta: string;   // cena 5 (CTA)   — a pergunta do dia
}

import { paraFalar } from "./fala";

// Tetos por cena (chars). Somados com o fecho fixo cabem no TETO_CHARS abaixo —
// um roteiro bem-comportado passa inteiro e o corte nunca precisa disparar.
export const CAP = { gancho: 45, fato: 45, mecanismo: 45, espelho: 45, pergunta: 40 } as const;

// Fecho FALADO fixo (dono, 29/07/2026 — fala o nome da página e amarra com a tese).
export const FECHO_FIXO = "Segue o Um País de Merda — amanhã o escândalo é outro.";

// Ritmo medido da voz. O áudio é o relógio: roteiro comprido = vídeo comprido, e a
// correção é sempre encurtar o TEXTO, nunca acelerar a voz.
export const CHARS_POR_SEG = 11.6;
export const FALA_MAX_SEG = 24;
export const TETO_CHARS = Math.round(FALA_MAX_SEG * CHARS_POR_SEG); // 278

// Ordem de sacrifício quando o roteiro estoura o teto. NUNCA o gancho (é o que
// segura o dedo), NUNCA o espelho (sem ele a crítica vira jornal), NUNCA a
// pergunta/fecho (é o pedido de seguir).
const ORDEM_DE_CORTE: Array<keyof ReelRoteiro> = ["mecanismo", "fato"];

export interface FalaMontada {
  title: string;        // capa
  slides: string[];     // cenas faladas do meio, na ordem
  cta: string;          // pergunta (card final)
  segments: string[];   // blocos NA ORDEM FALADA — fronteira de cena = fronteira da fala
  chars: number;        // tamanho total falado (fecho incluso)
  cortadas: string[];   // cenas descartadas pelo teto (p/ log)
}

const limpa = (s: unknown) => String(s ?? "").trim();
const comPonto = (s: string) => (/[.!?]$/.test(s) ? s : s + ".");

// ⛔ 2026-08-11 — TELA E BOCA SÃO TEXTOS DIFERENTES. Portado do Dr. Liberdade, onde o dono
// ouviu a peça e disse: *"a palavra (20 min) corta a palavra e fica estranho, não existe
// 20 min falado"*. O bloco ia CRU para o motor de voz, então "scrolla 20 min" era lido como
// está escrito. Na tela "20 min" é bom (curto, cabe); na boca é "vinte minutos".
//
// Fica AQUI, e não no `route.ts`, porque este arquivo é a fonte única do roteiro falado — os
// dois caminhos (roteiro de cena e copy pronta) passam por ele, e pôr no chamador deixaria
// um dos dois de fora. `title`, `slides` e `cta` do retorno continuam CRUS: são o que a tela
// mostra. Só `segments` — que é o que vai ao motor de voz — passa por aqui.
const falado = (s: string) => paraFalar(s);

// A expansão CONTA no teto: "20 min" (6) vira "vinte minutos" (13), e o teto existe para o
// vídeo não passar de ~21 s de fala. Medir o texto da tela e falar outro maior é o mesmo
// defeito que a correção de 31/07 consertou (o fecho contava depois da conta).
const tamanhoFalado = (partes: string[]) => partes.filter(Boolean).map(falado).join(" ").length;

// Monta a fala a partir do roteiro. O fecho falado é `pergunta + FECHO_FIXO` —
// e ele CONTA no teto (era o bug: o teto media só título+insights, o fecho entrava
// depois e o Reel ia a ~33s; o corte então derrubava o 3º insight, justamente
// onde mora o espelho).
export function montarFala(roteiro: ReelRoteiro): FalaMontada {
  const r: ReelRoteiro = {
    gancho: limpa(roteiro.gancho),
    fato: limpa(roteiro.fato),
    mecanismo: limpa(roteiro.mecanismo),
    espelho: limpa(roteiro.espelho),
    pergunta: limpa(roteiro.pergunta),
  };
  const vivas = new Set<keyof ReelRoteiro>(["fato", "mecanismo", "espelho"]);
  const cortadas: string[] = [];

  const meio = () => (["fato", "mecanismo", "espelho"] as const).filter((k) => vivas.has(k) && r[k]);
  const total = () => {
    const fecho = [r.pergunta, FECHO_FIXO].filter(Boolean).join(" ");
    return tamanhoFalado([r.gancho, ...meio().map((k) => r[k]), fecho]);
  };

  for (const k of ORDEM_DE_CORTE) {
    if (total() <= TETO_CHARS) break;
    if (meio().length <= 1) break; // sempre sobra ao menos uma cena falada no meio
    vivas.delete(k);
    cortadas.push(k);
  }

  const slides = meio().map((k) => r[k]);
  const fechoFalado = [r.pergunta, FECHO_FIXO].filter(Boolean).join(" ");
  const segments = [r.gancho, ...slides, fechoFalado]
    .map(limpa).filter(Boolean).map(falado).map(comPonto);

  return { title: r.gancho, slides, cta: r.pergunta, segments, chars: total(), cortadas };
}

// Mesma montagem a partir de uma copy JÁ PRONTA (título + insights + pergunta) —
// usada no acerto de cache (o roteiro original não é guardado) e no caminho de
// emergência sem notícia. Aqui o corte tira do FIM (não há papel de cena para
// respeitar), mas o fecho CONTA no teto, que era o bug: o teto media só
// título+insights, o fecho entrava depois e o Reel ia a ~33s.
export function montarFalaDeCopy(title: string, slides: string[], cta: string): FalaMontada {
  const t = limpa(title);
  const c = limpa(cta);
  const vivas = (slides || []).map(limpa).filter(Boolean).slice(0, 3);
  const cortadas: string[] = [];
  const total = () => {
    const fecho = [c, FECHO_FIXO].filter(Boolean).join(" ");
    return tamanhoFalado([t, ...vivas, fecho]);
  };
  while (vivas.length > 1 && total() > TETO_CHARS) cortadas.push(vivas.pop() as string);
  const fechoFalado = [c, FECHO_FIXO].filter(Boolean).join(" ");
  const segments = [t, ...vivas, fechoFalado].map(limpa).filter(Boolean).map(falado).map(comPonto);
  return { title: t, slides: vivas, cta: c, segments, chars: total(), cortadas };
}

// Duração falada estimada (s) — só para log/diagnóstico.
export function duracaoEstimadaSeg(chars: number): number {
  return Math.round((chars / CHARS_POR_SEG) * 10) / 10;
}

// Normaliza o JSON cru do modelo. Devolve null se faltar cena obrigatória — o
// chamador regenera em vez de publicar um Reel manco.
export function normalizaRoteiro(raw: unknown): ReelRoteiro | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const r: ReelRoteiro = {
    gancho: limpa(o.gancho),
    fato: limpa(o.fato),
    mecanismo: limpa(o.mecanismo),
    espelho: limpa(o.espelho),
    pergunta: limpa(o.pergunta),
  };
  // gancho, espelho e pergunta são inegociáveis; fato/mecanismo podem faltar (o
  // corte por teto também pode removê-los), desde que sobre pelo menos um.
  if (!r.gancho || !r.espelho || !r.pergunta) return null;
  if (!r.fato && !r.mecanismo) return null;
  return r;
}
