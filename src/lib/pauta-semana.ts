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

// Escolhe 1 manchete da semana (determinístico por seed → ES/PT iguais). Só olha
// manchetes com >= 5 palavras (descarta avisos curtos/burocráticos). null = sem pauta.
export function pickNewsTopic(seed: number): { headline: string; cat: string } | null {
  const pauta = pautaJson as PautaFile;
  const flat: { headline: string; cat: string }[] = [];
  for (const [front, titles] of Object.entries(pauta.frentes || {})) {
    const cat = FRONT_CAT[front] || "anxiety";
    for (const t of titles || []) {
      if (typeof t === "string" && t.trim().split(/\s+/).length >= 5) flat.push({ headline: t.trim(), cat });
    }
  }
  if (!flat.length) return null;
  return flat[Math.abs(seed) % flat.length];
}

// QUANTOS posts do dia nascem do noticiário — regra do dono (27/07/2026):
// "a crítica deve ser sobre o escândalo do governo, que cada dia tem coisa diferente".
// Escopo em TRABALHO.md (bloco `pauta:`): 3 das 4 publicações do dia puxam manchete;
// o slot "manha" fica ATEMPORAL — é a espinha do livro (servidão voluntária), e
// sem ela a conta vira jornal e morre quando a notícia esfria.
// Grade 29/07/2026 ("deixa 3 reel e apenas 1 carrossel"):
//   4 = carrossel 09:17 (tarde, PAUTA) · 0 = reel 12:17 (manha, ATEMPORAL) ·
//   1 = reel 17:17 (tarde, PAUTA) · 2 = reel 19:47 (noite, PAUTA)  → 3 com pauta.
export function usaPautaNoSlot(slot: string): boolean {
  return slot !== "manha";
}

// GUARDA anti-vazamento: rejeita a copy se parecer que citou nome de PESSOA ou
// PARTIDO (a régua já proíbe, mas isto é o backstop de código — como o literal-lock).
// ⚠️ Instituição/órgão (INSS, Receita Federal, STF, Congresso) é PERMITIDA desde
// 29/07/2026 — sem o órgão o escândalo não é reconhecível e a pesquisa vira nada.
// Erra para o lado de REJEITAR só no que resta: um falso-positivo cai em tema fixo.
const SIGLAS = /\b(PT|PL|PSDB|PSD|PP|MDB|PDT|PSOL|PC\s?do\s?B|PSB|PSC|PROS|PTB|PV|PCB|PCO|DEM|PODE|REPUBLICANOS|NOVO|AVANTE|SOLIDARIEDADE|CIDADANIA|UNIÃO\s+BRASIL|PATRIOTA|AGIR)\b/;
const CARGO_NOME = /\b(presidente|ministr[oa]|deputad[oa]|senador[a]?|governador[a]?|prefeit[oa]|vereador[a]?|desembargador[a]?|relator[a]?)\s+[A-ZÁÉÍÓÚÂÊÔÃÕ][a-záéíóúâêôãõ]+/;
// Par (ou mais) de palavras Capitalizadas seguidas = provável nome próprio/composto
// (ex.: "Jair Messias", "Lula Silva"). EXCETO se TODAS forem termos da marca OU
// vocabulário de INSTITUIÇÃO (o escândalo precisa nomear o órgão para ser
// reconhecível — "Receita Federal", "Congresso Nacional", "Banco Central").
const PAR_CAPS = /[A-ZÁÉÍÓÚÂÊÔÃÕ][a-záéíóúâêôãõ]{2,}(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕ][a-záéíóúâêôãõ]{2,})+/g;
const MARCA_OK = new Set([
  "servidao","voluntaria","estado","brasil","pais","patria","nacao","republica","deus","casta","poder","povo","liberdade",
  // vocabulário institucional (órgão nomeado ≠ pessoa/partido):
  "receita","federal","congresso","nacional","camara","deputados","senado","supremo","tribunal","justica","contas",
  "uniao","central","banco","previdencia","social","orcamento","secreto","ministerio","publico","publica","policia",
  "governo","planalto","tesouro","saude","educacao","seguranca","brasilia",
]);
const norm = (w: string) => w.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function copyLeaksName(texts: string[]): boolean {
  const blob = texts.filter(Boolean).join("  ");
  if (SIGLAS.test(blob) || CARGO_NOME.test(blob)) return true;
  for (const m of blob.match(PAR_CAPS) || []) {
    const words = m.split(/\s+/).map(norm);
    if (!words.every((w) => MARCA_OK.has(w))) return true; // algum termo não-marca → nome
  }
  return false;
}
