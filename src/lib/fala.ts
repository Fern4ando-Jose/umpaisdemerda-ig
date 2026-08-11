// ─── O TEXTO COMO ELE É FALADO (≠ como ele é ESCRITO) ────────────────────────
// PORTADO do dr-libertad-site em 2026-08-11. Lá o dono ouviu o Reel e disse:
// *"a palavra (20 min) corta a palavra e fica estranho, não existe 20 min falado"*.
// Estava certo: a peça mandava ao motor de voz exatamente o texto que aparece na tela, e
// "scrolla 20 min" foi lido como está escrito. Na tela "20 min" é bom (curto, cabe,
// lê-se rápido); na boca, ninguém diz isso — diz "vinte minutos".
//
// Regra que fica: **tela e boca são dois textos diferentes.** A tela continua recebendo o
// texto original; só o que vai ao motor de voz passa por aqui.
//
// ⚠️ SÓ PT-BR: o Um País de Merda é conta ÚNICA brasileira (`accounts.ts`). A versão do DR
// carrega ES junto porque lá são duas contas — copiar aquilo para cá seria trazer código
// que nunca roda. Se um dia esta marca ganhar outra língua, o lugar de somar é aqui.
//
// O que NÃO se mexe, de propósito:
//   · números de 4 dígitos (ano: "2026" viraria "dois mil e vinte e seis" — e a sátira
//     política cita ano o tempo todo; o leitor de voz já lê ano corretamente);
//   · valores acima de 999 (a expansão viraria uma frase inteira dentro da frase — e a
//     pauta desta conta é cheia de cifra de orçamento: "R$ 4 bilhões" fica como está);
//   · siglas e nomes próprios (Netflix, TikTok, STF) — não são abreviação, são nome.
//
// ⚠️ Efeito colateral conhecido e ACEITO: ao expandir, a contagem de palavras do bloco
// falado deixa de bater com a do texto da tela naquela cena. O `reelPlanV2` já trata isso
// — quando as contagens divergem, aquela cena usa a revelação de ritmo fixo em vez do
// ritmo da voz. Degradação prevista, silenciosa e segura; o oposto (voz lendo "min") não é.

// ── Números por extenso, 0–999 ───────────────────────────────────────────────
const UNI = ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
const DEZ_A_DEZENOVE = [
  "dez", "onze", "doze", "treze", "catorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove",
];
const DEZENAS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const CENTENAS = [
  "", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos",
];

/** 0–999 por extenso. Fora da faixa devolve o próprio número (não se inventa leitura). */
export function porExtenso(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 999) return String(n);
  if (n < 10) return UNI[n];
  if (n < 20) return DEZ_A_DEZENOVE[n - 10];
  if (n < 100) {
    const d = Math.floor(n / 10);
    const u = n % 10;
    return u ? `${DEZENAS[d]} e ${UNI[u]}` : DEZENAS[d];
  }
  if (n === 100) return "cem";
  const c = Math.floor(n / 100);
  const r = n % 100;
  const cent = CENTENAS[c];
  return r ? `${cent} e ${porExtenso(r)}`.replace(/\s+/g, " ") : cent;
}

/**
 * Abreviações que a voz não deve soletrar. A chave casa como PALAVRA INTEIRA — "min" só
 * vira "minutos" quando está solto, nunca dentro de "mínimo" ou "administração".
 * O plural segue o número que vem antes (1 minuto × 2 minutos).
 */
const UNIDADES: Record<string, [string, string]> = {
  min: ["minuto", "minutos"],
  mins: ["minuto", "minutos"],
  h: ["hora", "horas"],
  hs: ["hora", "horas"],
  hrs: ["hora", "horas"],
  seg: ["segundo", "segundos"],
  segs: ["segundo", "segundos"],
  km: ["quilômetro", "quilômetros"],
  kg: ["quilo", "quilos"],
};

/**
 * O texto pronto para ser FALADO. Não toca no texto da tela — quem chama é só o motor de voz.
 */
export function paraFalar(texto: string): string {
  let t = String(texto ?? "");
  if (!t.trim()) return t;

  // 1) NÚMERO + UNIDADE ABREVIADA: "20 min" → "vinte minutos" (o plural segue o número).
  const chaves = Object.keys(UNIDADES).sort((a, b) => b.length - a.length).join("|");
  t = t.replace(new RegExp(`\\b(\\d{1,3})\\s*(${chaves})\\b\\.?`, "gi"), (todo, num, uni) => {
    const n = Number(num);
    const par = UNIDADES[String(uni).toLowerCase()];
    if (!par) return todo;
    return `${porExtenso(n)} ${n === 1 ? par[0] : par[1]}`;
  });

  // 2) PERCENTUAL: "3%" → "três por cento".
  t = t.replace(/\b(\d{1,3})\s*%/g, (_m, num) => `${porExtenso(Number(num))} por cento`);

  // 3) NÚMERO SOLTO de até 3 dígitos: "20" → "vinte". Anos e valores maiores ficam como
  //    estão (o motor de voz já lê ano bem, e expandir milhares vira frase dentro da frase).
  t = t.replace(/\b(\d{1,3})\b/g, (_m, num) => porExtenso(Number(num)));

  return t.replace(/\s{2,}/g, " ").trim();
}
