// ─── A SÉRIE BATIZADA E A ASSINATURA FIXA ─────────────────────────────────────
// PORTADO do dr-libertad-site em 2026-08-11. Lá, dos 8 perfis medidos ao vivo, TODOS
// tinham duas coisas que faltavam nas nossas peças: um NOME de série (não só um número)
// e um SINAL fixo que se repete legenda após legenda. Número sem nome não vira coleção,
// porque não há o que lembrar.
//
// ⛔ O QUE ESTÁ PENDENTE E POR QUÊ — LEIA ANTES DE PREENCHER.
// O Dr. Liberdade batiza a série de «GAIOLA SEM GRADE» e assina com 🔒. **Isso é a
// bandeira DELE** — a marca desta conta é outra (sátira política, "A nação de servos
// voluntários", espinha = A Servidão Voluntária de La Boétie).
//
// Procurei bandeira travada para o Um País de Merda em `LINHA-EDITORIAL.md`,
// `DECISOES-TRAVADAS.md` (que é cópia do DR e nem foi renomeado) e em
// `.claude/marca/um-pais-de-merda/`: **não existe**. Batizar uma série e escolher o sinal
// da marca é decisão de copy/identidade, não de engenharia — consultado o diretor em
// 11/08, o veredito foi **DELEGAR** a uma sessão dedicada de marketing (registrado na
// fila). Inventar aqui seria pôr no ar, todo dia, um nome que ninguém escolheu.
//
// ENQUANTO ISSO, nada quebra e nada mente:
//   · `NOME_SERIE` vazio → a etiqueta mostra só «Nº 123», que é o que a peça já dizia; a
//     mudança de FORMA (a etiqueta sólida na cor da marca) entra hoje do mesmo jeito.
//   · `ASSINATURA` vazia → a legenda sai exatamente como saía. Zero risco.
// Decidido o nome, é UMA linha aqui — o resto do motor já lê daqui.

/** O nome da série, em caixa alta. VAZIO = ainda não batizada (ver o bloco acima). */
export const NOME_SERIE = "";

/** O sinal fixo que abre toda legenda. VAZIO = a legenda sai sem assinatura. */
export const ASSINATURA = "";

/**
 * O cabeçalho de coleção da peça: «NOME · Nº 244». Sem nome → só «Nº 244»; sem número →
 * só o nome; sem os dois → string vazia (e quem desenha não pinta etiqueta nenhuma).
 */
export function selo(ed?: string | number | null): string {
  const n = ed == null ? "" : String(ed).trim();
  const numero = n && n !== "0" ? `Nº ${n}` : "";
  if (NOME_SERIE && numero) return `${NOME_SERIE} · ${numero}`;
  return NOME_SERIE || numero;
}

/**
 * Põe a assinatura na ABERTURA da legenda.
 *
 * As mesmas três regras do resto dos enfeites de legenda, pelo mesmo motivo — nenhuma
 * peça pode deixar de sair por causa de um adorno:
 *   · IDEMPOTENTE — legenda que já começa com o sinal não ganha outro (re-tentativa do
 *     watchdog não duplica);
 *   · FAIL-OPEN — legenda vazia, ou assinatura ainda não escolhida, volta como veio (não
 *     se inventa legenda nem se inventa sinal);
 *   · LIMITE DO IG — se o sinal estourasse o teto de 2.200 caracteres, a legenda sai sem ele.
 */
export function assinarLegenda(caption: string | null | undefined, max = 2200): string {
  const base = (caption ?? "").trimStart();
  if (!ASSINATURA) return caption ?? "";
  if (!base.trim()) return caption ?? "";
  if (base.startsWith(ASSINATURA)) return base;
  const assinada = `${ASSINATURA} ${base}`;
  return assinada.length <= max ? assinada : base;
}
