// ─── Biblioteca CURADA de footage por pilar ──────────────────────────────────
// Clipes do Pexels VETADOS à mão (análise visual foto-a-foto pelos agentes de
// marketing + neurociência, 2026-07-12): sem texto/inglês na tela, sem marcadores
// EUA, sem cena sexual, on-message por SÍMBOLO do pilar, rosto anônimo, retrato 9:16.
// Substitui a busca AO VIVO no Pexels (que era roleta e trouxe endereço dos EUA +
// casal seminu). O reel sorteia SÓ deste whitelist, sem repetir clipe no mesmo reel.
// Mapa cat→pilar: self=O SERVO · network=A CASTA · anxiety=O ESTADO que rouba ·
// freedom=LIBERDADE · dopamine=PÃO E CIRCO · mind=O DESPERTAR.
export type FootageClip = { url: string; poster?: string; why?: string };

export const FOOTAGE_LIBRARY: Record<string, FootageClip[]> = {
  // O SERVO — o rebanho que consente (rebanho, metrô lotado, escada rolante, operário exausto)
  self: [
    { url: "https://videos.pexels.com/video-files/37985321/16119613_1080_1920_25fps.mp4", why: "ovelha encara a câmera no meio do rebanho" },
    { url: "https://videos.pexels.com/video-files/38411462/16310404_1080_1920_30fps.mp4", why: "rebanho conduzido pela estrada ao anoitecer" },
    { url: "https://videos.pexels.com/video-files/31200414/13327370_1080_1920_60fps.mp4", why: "ovelha pastando de cabeça baixa" },
    { url: "https://videos.pexels.com/video-files/38477569/16341167_1080_1920_60fps.mp4", why: "homem de costas caminhando entre o rebanho" },
    { url: "https://videos.pexels.com/video-files/35441944/15015375_1080_1920_4fps.mp4", why: "vulto borrado na escada rolante no escuro" },
    { url: "https://videos.pexels.com/video-files/37689044/15979758_1080_1920_50fps.mp4", why: "mão agarrada à alça do metrô — submissão à rotina" },
    { url: "https://videos.pexels.com/video-files/37689041/15979750_1080_1920_50fps.mp4", why: "corpos espremidos no vagão lotado" },
    { url: "https://videos.pexels.com/video-files/37215067/15765036_1080_1920_30fps.mp4", why: "multidão de cima como pontinhos idênticos" },
    { url: "https://videos.pexels.com/video-files/36840856/15608962_1080_1920_60fps.mp4", why: "silhuetas enfileiradas no saguão contra a luz" },
    { url: "https://videos.pexels.com/video-files/38190426/16213124_1080_1920_30fps.mp4", why: "operário de costas na linha de montagem" },
    { url: "https://videos.pexels.com/video-files/9063506/9063506-hd_1080_2048_25fps.mp4", why: "cabeça caída na mesa sob a luminária — esgotamento" },
    { url: "https://videos.pexels.com/video-files/9065730/9065730-hd_1080_2048_25fps.mp4", why: "trabalhador derrotado, jogado na cadeira" },
  ],
  // A CASTA — quem vive às suas custas (champanhe, jato, mármore, banquete, alta gastronomia)
  network: [
    { url: "https://videos.pexels.com/video-files/8765266/8765266-hd_1080_1920_25fps.mp4", why: "taça de champanhe em foco, multidão desfocada" },
    { url: "https://videos.pexels.com/video-files/6624854/6624854-hd_1080_1920_30fps.mp4", why: "mão com taça sob spotlight vermelho, dramático" },
    { url: "https://videos.pexels.com/video-files/29470443/12685760_1080_1920_30fps.mp4", why: "jato privado na pista ao entardecer" },
    { url: "https://videos.pexels.com/video-files/37410264/15844563_1080_1920_24fps.mp4", why: "escadaria de mármore opulenta, luz baixa" },
    { url: "https://videos.pexels.com/video-files/19086476/19086476-hd_1080_1920_60fps.mp4", why: "piscina infinita à noite com lounge iluminado" },
    { url: "https://videos.pexels.com/video-files/6101319/6101319-hd_1080_2048_30fps.mp4", why: "aperto de mãos de ternos diante de biblioteca" },
    { url: "https://videos.pexels.com/video-files/32054939/13663265_1080_1920_60fps.mp4", why: "mesa de banquete refinada, cristais e uvas" },
    { url: "https://videos.pexels.com/video-files/10811234/10811234-hd_1080_1918_30fps.mp4", why: "mesa à luz de velas, moody, jantar de gala" },
    { url: "https://videos.pexels.com/video-files/32856239/14004256_1080_1920_60fps.mp4", why: "P&B: mão ajustando punho/relógio em smoking" },
    { url: "https://videos.pexels.com/video-files/37410282/15844398_1080_1620_30fps.mp4", why: "salão de baile vermelho/dourado com lustres" },
    { url: "https://videos.pexels.com/video-files/36202032/15352106_1080_1920_30fps.mp4", why: "salão dourado com fonte e lustre" },
    { url: "https://videos.pexels.com/video-files/7008582/7008582-hd_1080_1920_25fps.mp4", why: "chef finalizando prato gourmet em louça escura" },
    { url: "https://videos.pexels.com/video-files/28368576/12367941_1080_1920_30fps.mp4", why: "molho despejado sobre prato gourmet, mármore" },
    { url: "https://videos.pexels.com/video-files/8345024/8345024-hd_1080_1920_25fps.mp4", why: "executivo indo a sedan preto com motorista" },
  ],
  // O ESTADO QUE ROUBA — a mão no seu bolso (contar dinheiro, carteira vazia, colunas, cofre, ralo)
  anxiety: [
    // (removido 34993441 na QA visual: cédulas polonesas com "NARODOWY BANK POLSKI" legível)
    { url: "https://videos.pexels.com/video-files/7924953/7924953-hd_720_1280_24fps.mp4", why: "mãos abrindo carteira preta com cartões" },
    { url: "https://videos.pexels.com/video-files/35072497/14856828_720_1280_60fps.mp4", why: "mão segurando carteira gasta — o bolso do cidadão" },
    { url: "https://videos.pexels.com/video-files/34650055/14686104_720_1280_30fps.mp4", why: "fachada de parlamento com colunas" },
    { url: "https://videos.pexels.com/video-files/5970637/5970637-hd_720_1366_25fps.mp4", why: "colunas de mármore de prédio institucional" },
    { url: "https://videos.pexels.com/video-files/36351524/15417965_720_1280_30fps.mp4", why: "fachada neoclássica tipo tribunal, granulada" },
    { url: "https://videos.pexels.com/video-files/35239445/14929118_720_1280_30fps.mp4", why: "fogo/brasa sobre fundo escuro — dinheiro queimando" },
    { url: "https://videos.pexels.com/video-files/9462947/9462947-hd_720_1280_24fps.mp4", why: "ralo de pia em close — dinheiro pelo ralo" },
    { url: "https://videos.pexels.com/video-files/7080902/7080902-hd_720_1280_30fps.mp4", why: "moedas escorrendo de cofrinho preto" },
    { url: "https://videos.pexels.com/video-files/35069364/14855389_720_1280_30fps.mp4", why: "mecanismo de porta pesada de cofre" },
    { url: "https://videos.pexels.com/video-files/6964001/6964001-hd_720_1280_25fps.mp4", why: "mão sobre calculadora em luz baixa — imposto" },
    // (removido 34719410 na QA visual: documento assinado com texto de formulário legível)
    { url: "https://videos.pexels.com/video-files/8103766/8103766-hd_720_1366_25fps.mp4", why: "moedas e cédulas espalhadas em pano preto" },
  ],
  // LIBERDADE — a saída (porta abrindo, cavalo/pássaro livre, estrada aberta, cume, punho erguido)
  freedom: [
    { url: "https://videos.pexels.com/video-files/10350799/10350799-hd_720_1280_30fps.mp4", why: "porta abrindo para montanha ao amanhecer" },
    { url: "https://videos.pexels.com/video-files/4547598/4547598-hd_720_1280_50fps.mp4", why: "silhueta caminhando para a luz de um portal" },
    { url: "https://videos.pexels.com/video-files/12155272/12155272-hd_720_1280_30fps.mp4", why: "porta em arco de pedra abrindo pro céu azul" },
    { url: "https://videos.pexels.com/video-files/18422162/18422162-hd_720_1280_60fps.mp4", why: "cavalo solitário galopando em contraluz dourada" },
    { url: "https://videos.pexels.com/video-files/28759715/12469449_720_1280_30fps.mp4", why: "manada galopando levantando poeira" },
    { url: "https://videos.pexels.com/video-files/17662346/17662346-hd_720_1280_25fps.mp4", why: "gaivota planando em céu azul limpo" },
    { url: "https://videos.pexels.com/video-files/33349053/14199967_720_1280_30fps.mp4", why: "gaivotas voando sobre o mar em luz dourada" },
    { url: "https://videos.pexels.com/video-files/34793278/14751515_720_1280_60fps.mp4", why: "POV de estrada aberta (sinalização europeia)" },
    { url: "https://videos.pexels.com/video-files/15536311/15536311-hd_720_1280_30fps.mp4", why: "POV de estrada ao amanhecer, céu rosa/laranja" },
    { url: "https://videos.pexels.com/video-files/38457972/16331674_720_1280_30fps.mp4", why: "pessoa de braços abertos sobre rocha no vale" },
    { url: "https://videos.pexels.com/video-files/28185282/12321878_720_1280_60fps.mp4", why: "silhueta no cume erguendo o bastão" },
    { url: "https://videos.pexels.com/video-files/17733400/17733400-hd_720_1280_30fps.mp4", why: "espigas douradas em contraluz de hora dourada" },
    { url: "https://videos.pexels.com/video-files/4936487/4936487-hd_720_1366_24fps.mp4", why: "veleiro solitário em mar escuro e sereno" },
    { url: "https://videos.pexels.com/video-files/9465544/9465544-hd_720_1280_25fps.mp4", why: "punho erguido em fundo neutro — resistência" },
  ],
  // PÃO E CIRCO — o espetáculo que anestesia (parque, carrossel, fogos, mar de celulares, TVs)
  dopamine: [
    { url: "https://videos.pexels.com/video-files/37153388/15739577_720_1280_60fps.mp4", why: "parque de diversões vibrante ao entardecer" },
    { url: "https://videos.pexels.com/video-files/37100614/15717378_720_1280_60fps.mp4", why: "festival noturno de cima, massa anônima" },
    { url: "https://videos.pexels.com/video-files/30441554/13045106_720_1280_30fps.mp4", why: "carrossel clássico coberto de lâmpadas" },
    { url: "https://videos.pexels.com/video-files/11011701/11011701-hd_720_1280_25fps.mp4", why: "carrossel girando à noite em motion blur" },
    { url: "https://videos.pexels.com/video-files/19192719/19192719-hd_720_1280_24fps.mp4", why: "carrossel iluminado com brilho enevoado" },
    { url: "https://videos.pexels.com/video-files/15224211/15224211-hd_720_1280_30fps.mp4", why: "roda-gigante em close, luzes girando no escuro" },
    { url: "https://videos.pexels.com/video-files/34935718/14798728_720_1280_30fps.mp4", why: "carro alegórico de LED à noite — desfile-espetáculo" },
    { url: "https://videos.pexels.com/video-files/35333348/14970709_720_1280_60fps.mp4", why: "fogos com silhuetas de multidão embaixo" },
    { url: "https://videos.pexels.com/video-files/35480485/15030841_720_1280_30fps.mp4", why: "fogos sobre árvores com fumaça e silhueta" },
    { url: "https://videos.pexels.com/video-files/35373861/14988044_720_1280_60fps.mp4", why: "fogos sobre grande multidão, bruma roxa" },
    { url: "https://videos.pexels.com/video-files/8516640/8516640-hd_720_1280_30fps.mp4", why: "confete colorido caindo — celebração" },
    { url: "https://videos.pexels.com/video-files/35340079/14973728_720_1280_60fps.mp4", why: "mar de luzes de celular numa multidão de show" },
    { url: "https://videos.pexels.com/video-files/13641379/13641379-hd_720_1280_24fps.mp4", why: "palco de show com refletores e plateia em silhueta" },
    { url: "https://videos.pexels.com/video-files/6955103/6955103-hd_720_1280_25fps.mp4", why: "TVs antigas empilhadas com chuvisco — tela que anestesia" },
  ],
  // O DESPERTAR — a virada (rostos erguendo pra luz, olhos abrindo, ir contra a maré, amanhecer)
  mind: [
    { url: "https://videos.pexels.com/video-files/8680222/8680222-hd_720_1366_25fps.mp4", why: "rosto jovem anônimo olhando pra cima na luz laranja" },
    { url: "https://videos.pexels.com/video-files/8680220/8680220-hd_720_1366_25fps.mp4", why: "homem erguendo o rosto pra luz — o despertar" },
    { url: "https://videos.pexels.com/video-files/6144003/6144003-hd_720_1366_25fps.mp4", why: "perfil de olhar digno erguido, estética jornal" },
    { url: "https://videos.pexels.com/video-files/36171729/15339473_720_1280_60fps.mp4", why: "olho abrindo em close — a consciência que acorda" },
    { url: "https://videos.pexels.com/video-files/7299415/7299415-hd_720_1280_30fps.mp4", why: "olho aberto em close, olhar intenso — o instante da virada" },
    { url: "https://videos.pexels.com/video-files/10210117/10210117-hd_720_1366_25fps.mp4", why: "rosto encarando a câmera, fundo escuro — provocação" },
    { url: "https://videos.pexels.com/video-files/7653859/7653859-hd_720_1280_25fps.mp4", why: "mão no queixo, olhar reflexivo — pensar/questionar" },
    { url: "https://videos.pexels.com/video-files/9902186/9902186-hd_720_1366_25fps.mp4", why: "perfil sério sob luz dramática — tensão e determinação" },
    { url: "https://videos.pexels.com/video-files/10622421/10622421-hd_720_1366_25fps.mp4", why: "figura que caminha na contramão do grupo — ir contra a maré" },
    { url: "https://videos.pexels.com/video-files/6535342/6535342-hd_720_1366_25fps.mp4", why: "figura solitária firme em galpão — quem se levanta" },
    { url: "https://videos.pexels.com/video-files/34439907/14593357_720_1280_30fps.mp4", why: "sol nascendo entre prédios — o novo dia" },
    { url: "https://videos.pexels.com/video-files/31639435/13479755_720_1280_30fps.mp4", why: "amanhecer dourado sobre a cidade (vista aérea)" },
    { url: "https://videos.pexels.com/video-files/35799015/15177806_720_1280_25fps.mp4", why: "silhueta na colina encarando o horizonte ao nascer do sol" },
  ],
};

// Arco visual por cena do Reel (5 cenas): gancho (o problema, no pilar do post) →
// insight → CONTRASTE (a casta que ganha) → insight → VIRADA (o despertar).
// É o arco vítima→vilão→despertar (retenção, Yantis&Jonides + Berger&Milkman).
export function beatPillars(cat: string, numScenes: number): string[] {
  const arc = [cat, cat, "network", cat, "mind"];
  // Se o próprio post já é da casta/despertar, evita repetir o mesmo pilar no beat
  // de contraste/virada (troca por um complementar).
  if (cat === "network") arc[2] = "dopamine"; // casta vs. pão-e-circo
  if (cat === "mind") arc[4] = "freedom"; // despertar → liberdade
  return Array.from({ length: numScenes }, (_, i) => arc[i] ?? cat);
}
