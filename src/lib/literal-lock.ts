// ─── Trava anti-amenização (temas-convicção) ──────────────────────────────────
// Para os temas que SÃO uma frase-verdade do dono (flag `literal: true` no THEMES,
// fonte única — `api/publish/route.ts`), o modelo NÃO pode suavizar, reformular nem
// trocar a frase por "libertad"/palavra de marca. Foi o bug do ED 106: o tema
// "El hombre no necesita ser amado: necesita cariño, respeto y admiración" saiu como
// "No necesitas ser amado: necesitas LIBERTAD" — a regra de marca (título DEVE
// conectar com a libertad) atropelou a convicção literal. A diretiva abaixo é
// injetada no prompt SÓ para temas-convicção e ANULA, neles, a exigência de libertad
// no título (a libertad vai num insight).
//
// É uma função PURA (testável); a DATA de quais temas são convicção mora no flag
// `literal` de cada entrada do THEMES (viaja com a string do tema → não dessincroniza).
// A linha editorial do dono é INVIOLÁVEL: a provocação vem da IDEIA, e a frase-verdade
// é mantida íntegra. Atualizar a linha = marcar/desmarcar `literal` nos temas + ajustar
// o prompt; é assim que a automação passa a respeitar a visão reestruturada.

export function buildLiteralDirective(isLiteral: boolean, freedom: string): string {
  if (!isLiteral) return "";
  return `
TEMA-CONVICCIÓN (INVIOLABLE) — este tema ES una frase-verdad del autor; su fuerza está en las palabras EXACTAS:
- El "postTitle" PRESERVA las palabras clave de la frase del tema, intactas. Si no cabe en 55 caracteres, recorta relleno pero NUNCA el núcleo; jamás reformules, suavices ni sustituyas la frase por "${freedom}"/"libertad" u otra palabra de marca.
- El PRIMER elemento de "slides" contiene la frase COMPLETA del tema, textual.
- La conexión con la ${freedom} va en OTRO insight (2 o 3), NUNCA en el título ni en lugar de la frase. Esto ANULA, solo para este tema, la exigencia de conectar el título con la libertad.
`;
}
