// ─── O REDATOR DA MARCA — adaptador do núcleo compartilhado ──────────────────
//
// ⚠️ ARQUIVO ESPELHADO. A fonte única é `.claude/lib/peca/adaptador-nextjs.ts.modelo`, e os
// dados que ele lê são `.claude/lib/peca/formatos.json`. Editar esta cópia não adianta: o
// verificador (`node .claude/lib/peca/verificar-espelho.mjs`) reprova assim que os dois
// deixarem de bater, e `--consertar` sobrescreve o que estiver aqui.
//
// POR QUE EXISTE A CÓPIA: este motor roda na nuvem, que não enxerga a pasta `.claude/`. É a
// mesma exceção física do dicionário de idioma. A cópia é inevitável; a divergência não.
//
// O QUE ESTE ARQUIVO NÃO TRAZ: o título-molde. Ele é régua medida no Instagram do Dr.
// Liberdade e vale só lá (`.claude/marca/dr-libertad/REGRAS-POR-PLATAFORMA.md`). Aqui viaja a
// ARQUITETURA — o esqueleto e a exigência de conflito antes da tese.

import nucleo from "./formatos-nucleo.json";

export type Midia = "carrossel" | "reel" | "texto";

export interface Formato {
  id: string;
  nome: string;
  midia: string[];
  roteiro: string;
}

export const FORMATOS: Formato[] = nucleo.formatos as Formato[];

/** Só os esqueletos que servem à mídia pedida. Fail-open: mídia desconhecida devolve tudo. */
export function formatosPara(midia: Midia): Formato[] {
  const lista = FORMATOS.filter((f) => f.midia.includes(midia));
  return lista.length ? lista : FORMATOS;
}

/**
 * Hash estável (djb2). Tem de ser o MESMO do núcleo e do motor do Instagram: os lados
 * precisam sortear o mesmo esqueleto para a mesma chave, senão as peças param de ser
 * comparáveis. `Math.random` aqui faria o par ES/BR divergir a cada execução.
 */
function semente(texto: string): number {
  let h = 5381;
  for (let i = 0; i < texto.length; i++) h = ((h << 5) + h + texto.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Sorteia o esqueleto de forma DETERMINÍSTICA pela chave.
 * A chave leva o tópico e o dia, NUNCA o idioma — é o que mantém o par no mesmo esqueleto.
 */
export function formatoDaVaga(midia: Midia, chave: string): Formato {
  const lista = formatosPara(midia);
  return lista[semente(String(chave)) % lista.length];
}

export function formatoPorId(id: string): Formato | null {
  return FORMATOS.find((f) => f.id === id) ?? null;
}

/**
 * O bloco que entra no prompt do redator: o esqueleto + a exigência de conflito.
 * Vai ANTES das regras de voz — o formato manda na arquitetura, a voz manda na frase.
 */
export function diretrizDoRedator(f: Formato, midia: Midia = "carrossel"): string {
  const bloco = midia === "texto" ? nucleo.conflitoTextoCorrido : nucleo.conflito;
  return [
    `FORMATO OBRIGATÓRIO DESTA PEÇA: ${f.nome.toUpperCase()}.`,
    f.roteiro,
    "",
    bloco.titulo,
    ...bloco.linhas,
  ].join("\n");
}
