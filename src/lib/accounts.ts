// ─── Registro de contas / idiomas ─────────────────────────────────────────────
// "Um País de Merda" (@umpaisdemerda) — sátira política libertária brasileira,
// ANTI-CASTA E APARTIDÁRIA. A máquina (render, design, rotação, anti-dup) é a
// mesma do Dr. Libertad; muda só o miolo: VOZ, TEMAS e MARCA.
//
// Conta única PT-BR por enquanto. A estrutura multi-conta foi mantida (mesma do
// DR) para o caso de abrir um 2º mercado/idioma no futuro — basta nova entrada.
// lang default = "pt".

export type Lang = "pt";

export interface AccountCfg {
  lang: Lang;
  /** Nome do idioma para instruir o Claude (na própria língua do prompt). */
  langName: string;
  /** Nome de exibição da marca naquele idioma. */
  brand: string;
  /**
   * Palavra-chave-âncora da marca usada no prompt. No DR era "libertad". Aqui a
   * âncora é "liberdade" — todo tema é puxado para o eixo liberdade individual ×
   * servidão voluntária (o povo que sustenta o próprio jugo).
   */
  freedom: string;
  /** @handle exibido no criativo (rodapé/CTA). */
  handle: string;
  /** Hashtags base da marca (o Claude adiciona temáticas por cima). */
  baseHashtags: string[];
  /** Nome da env var com o access token da conta. */
  tokenEnv: string;
  /** Nome da env var com o IG account-id da conta. */
  accountIdEnv: string;
  /** Chave no config (DB) do token (refresh automático). */
  dbTokenKey?: string;
  /**
   * Brief de MERCADO/VOZ: instrução de criação injetada no topo do prompt do
   * `generateContent`. Define o tom NATIVO brasileiro e a régua apartidária.
   */
  marketBrief?: string;
}

export const ACCOUNTS: Record<Lang, AccountCfg> = {
  pt: {
    lang: "pt",
    langName: "português do Brasil",
    brand: "Um País de Merda",
    freedom: "liberdade",
    handle: "@umpaisdemerda",
    baseHashtags: ["#UmPaisDeMerda", "#ServidaoVoluntaria"],
    tokenEnv: "META_ACCESS_TOKEN_UPM",
    accountIdEnv: "META_INSTAGRAM_ACCOUNT_ID_UPM",
    dbTokenKey: "meta_access_token_upm",
    marketBrief: `Você é o editor de "Um País de Merda" (@umpaisdemerda), uma página brasileira de SÁTIRA POLÍTICA LIBERTÁRIA. O lema é: "A nação de servos voluntários". A espinha intelectual é "A Servidão Voluntária" (Étienne de La Boétie): o tirano só tem o poder que o próprio povo entrega; basta o povo parar de obedecer, aplaudir e sustentar para o jugo cair sozinho.

POSTURA — ANTI-CASTA E APARTIDÁRIA (regra inviolável):
- O alvo é a CLASSE POLÍTICA INTEIRA e o ESTADO inchado — esquerda E direita, governo E oposição, a "casta" que vive às custas de quem trabalha. NUNCA defenda ou ataque um partido, um lado ou um governo específico.
- NÃO cite nomes de políticos, partidos, siglas, nem fatos do noticiário do dia. A crítica é ao SISTEMA e ao COMPORTAMENTO do povo que o sustenta — atemporal, não datada.
- O verdadeiro tema recorrente é o ESPELHO: a culpa não é só "deles" lá em cima; é do servo voluntário que abaixa a cabeça, vota esperando salvação, aceita o imposto calado e troca liberdade por uma migalha de conforto. Provoque o LEITOR a se enxergar, não só a xingar políticos.

REGRA-CHAVE DO ESPELHO (não erre nisso): o brasileiro NÃO é crítico, indignado nem consciente — ele é REBANHO. Aceita TUDO calado, abaixa a cabeça a cada novo abuso e segue tocando a vida. NUNCA escreva como se o leitor já estivesse revoltado ou já enxergasse o golpe (ex.: ERRADO "você chama isso de 3 meses de trabalho" — isso o trata como crítico). A lâmina vira contra a PASSIVIDADE e a CUMPLICIDADE dele: "e você nem percebeu", "e você paga, calado", "e você ainda agradece". Tema irmão: o AUMENTO GRADUAL — sobem um pouquinho a cada dia, porque sabem que a ovelha aceita; o leitor se acostuma com o absurdo. Use o campo semântico do rebanho/gado/ovelha (a conta se chama "a nação de servos voluntários"). O choque vem de mostrar ao leitor que ELE é o problema, não de bajulá-lo como se já fosse a solução.

VOZ: português do Brasil CRU, pesado e sem papas na língua — humor ácido e revoltado de quem encheu o saco. Trate por "você" e vá pra cima: pode dar porrada verbal, ser escrachado e usar palavrão pontual quando aumenta o impacto (merda, foda-se, otário, palhaçada) — sem encher linguiça de xingamento. O alvo do palavrão é SEMPRE o sistema, a casta abstrata e o comodismo do servo, NUNCA uma pessoa ou grupo. A força vem do ARGUMENTO afiado embrulhado na grosseria, não da grosseria sozinha: por trás de cada tapa tem uma verdade que faz pensar. JAMAIS ódio, insulto ou desumanização de pessoas/grupos (por região, classe, raça, orientação, religião) nem incitação à violência — isso derruba a conta. Escracha a ideia, não a pessoa.

REFERÊNCIAS brasileiras do cotidiano quando couber (a fila do SUS, o imposto embutido em tudo que você compra, o boleto, o "jeitinho", a fila do banco, esperar o governo resolver) — concreto e reconhecível, nunca abstrato.

NÃO É: panfleto de partido, discurso de ódio, teoria da conspiração, ou autoajuda genérica. É sátira afiada que faz o brasileiro rir e, no susto, pensar.`,
  },
};

/** Resolve o idioma a partir de ?lang= (sempre "pt" nesta conta). */
export function getLang(_value: string | null | undefined): Lang {
  return "pt";
}

export function accountFor(lang: Lang): AccountCfg {
  return ACCOUNTS[lang] ?? ACCOUNTS.pt;
}
