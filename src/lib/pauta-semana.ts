// ─── 2ª FRENTE: corrupção da semana (notícia → padrão apartidário) ────────────
// O coletor (scripts/coletor-pauta.mjs, cron de segunda) grava as manchetes NOVAS
// da semana em data/pauta-semana.json. Aqui o app lê uma manchete como GATILHO do
// PADRÃO — o post gerado é atemporal e apartidário (a régua do prompt força isso),
// e uma GUARDA DE CÓDIGO rejeita a saída se vazar nome/partido → cai em tema fixo.
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

// GUARDA anti-vazamento: rejeita a copy se parecer que citou nome/partido/figura da
// notícia (a régua já proíbe, mas isto é o backstop de código — como o literal-lock).
// Erra para o lado de REJEITAR: um falso-positivo só faz o run cair num tema fixo.
const SIGLAS = /\b(PT|PL|PSDB|PSD|PP|MDB|PDT|PSOL|PC\s?do\s?B|PSB|PSC|PROS|PTB|PV|PCB|PCO|DEM|PODE|REPUBLICANOS|NOVO|AVANTE|SOLIDARIEDADE|CIDADANIA|UNIÃO\s+BRASIL|PATRIOTA|AGIR)\b/;
const CARGO_NOME = /\b(presidente|ministr[oa]|deputad[oa]|senador[a]?|governador[a]?|prefeit[oa]|vereador[a]?|desembargador[a]?|relator[a]?)\s+[A-ZÁÉÍÓÚÂÊÔÃÕ][a-záéíóúâêôãõ]+/;
const INSTITUICOES = /\b(STF|STJ|TSE|TCU|Planalto|Congresso Nacional|Câmara dos Deputados|Palácio do)\b/;
// Par (ou mais) de palavras Capitalizadas seguidas = provável nome próprio/composto
// (ex.: "Jair Messias", "Lula Silva"). EXCETO se TODAS forem termos abstratos da
// marca (a página usa "Servidão Voluntária", "Estado", "Brasil" em maiúscula).
const PAR_CAPS = /[A-ZÁÉÍÓÚÂÊÔÃÕ][a-záéíóúâêôãõ]{2,}(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕ][a-záéíóúâêôãõ]{2,})+/g;
const MARCA_OK = new Set(["servidao","voluntaria","estado","brasil","pais","patria","nacao","republica","deus","casta","poder","povo","liberdade"]);
const norm = (w: string) => w.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function copyLeaksName(texts: string[]): boolean {
  const blob = texts.filter(Boolean).join("  ");
  if (SIGLAS.test(blob) || CARGO_NOME.test(blob) || INSTITUICOES.test(blob)) return true;
  for (const m of blob.match(PAR_CAPS) || []) {
    const words = m.split(/\s+/).map(norm);
    if (!words.every((w) => MARCA_OK.has(w))) return true; // algum termo não-marca → nome
  }
  return false;
}
