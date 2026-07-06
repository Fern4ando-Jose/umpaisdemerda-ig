// Parser robusto do JSON que o haiku devolve em generateContent.
// O modelo às vezes embrulha a saída em prosa ou em ```backticks```; extraímos
// o objeto do primeiro "{" ao último "}" e parseamos. Se ainda assim o JSON
// vier estruturalmente malformado (ex.: aspas não escapadas no meio de uma
// string), o JSON.parse lança — e o chamador (generateContent) RETENTA a
// geração, que normalmente resolve. Antes isso quebrava o post silenciosamente.
export function parseContentJson<T = unknown>(raw: string): T {
  const noFences = raw.replace(/```json|```/g, "").trim();
  const start = noFences.indexOf("{");
  const end = noFences.lastIndexOf("}");
  const candidate = start >= 0 && end > start ? noFences.slice(start, end + 1) : noFences;
  return JSON.parse(candidate) as T;
}
