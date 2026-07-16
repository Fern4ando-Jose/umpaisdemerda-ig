// ─── Biblioteca CURADA de footage por pilar ──────────────────────────────────
// Clipes do Pexels VETADOS à mão (análise visual foto-a-foto pelos agentes de
// marketing + neurociência, 2026-07-12): sem texto/inglês na tela, sem marcadores
// EUA, sem cena sexual, on-message por SÍMBOLO do pilar, rosto anônimo, retrato 9:16.
// Substitui a busca AO VIVO no Pexels (que era roleta e trouxe endereço dos EUA +
// casal seminu). O reel sorteia SÓ deste whitelist, sem repetir clipe no mesmo reel.
// Mapa cat→pilar: self=O SERVO · network=A CASTA · anxiety=O ESTADO que rouba ·
// freedom=LIBERDADE · dopamine=PÃO E CIRCO · mind=O DESPERTAR.
//
// 2026-07-16: acervo passa a poder MISTURAR 4 fontes — Pexels vídeo/foto (Ken
// Burns) + Pixabay vídeo/foto (já tinha Pixabay vídeo curado à mão; agora
// também via busca+QA automático). `mediaType`/`source` são só METADADOS
// (relatório do QA em massa) — o RENDER decide foto×vídeo pela extensão da
// própria URL (isPhotoUrl, src/lib/footage-media.ts), então entradas antigas
// sem esses campos continuam funcionando sem migração.
// scripts/vet-footage-library.mjs é quem AMPLIA esta lista.
export type FootageClip = {
  url: string;
  poster?: string;
  why?: string;
  mediaType?: "video" | "photo";
  source?: "pexels" | "pixabay";
};

export const FOOTAGE_LIBRARY: Record<string, FootageClip[]> = {
  // O SERVO — o rebanho que consente (rebanho, metrô lotado, escada rolante, operário exausto)
  self: [
    // ── Pixabay (2ª fonte curada, QA visual 2026-07-12) ──
    { url: "https://cdn.pixabay.com/video/2024/01/21/197531-905015052_large.mp4", why: "multidão anônima marchando em massa pela rua — rebanho humano" },
    { url: "https://cdn.pixabay.com/video/2023/03/31/156965-813912951_large.mp4", why: "rebanho de ovelhas caminhando em fila pelo pasto" },
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
    { url: "https://videos.pexels.com/video-files/36094559/15307395_1080_1920_30fps.mp4", why: "ovelhas prensadas no curral empoeirado" },
    { url: "https://videos.pexels.com/video-files/34196081/14494192_1080_1920_30fps.mp4", why: "gado em fila indiana pela encosta" },
    { url: "https://videos.pexels.com/video-files/20589723/20589723-hd_1080_1920_30fps.mp4", why: "boiada avancando em bloco na poeira" },
    { url: "https://videos.pexels.com/video-files/30347779/13007939_1080_1920_30fps.mp4", why: "multidao uniforme atravessando a faixa" },
    { url: "https://videos.pexels.com/video-files/30207609/12951524_1080_1920_30fps.mp4", why: "PB: passageiro anonimo em pe no onibus" },
    { url: "https://videos.pexels.com/video-files/5452827/5452827-hd_1080_1920_25fps.mp4", why: "fileiras de telemarketing em cubiculos" },
    { url: "https://videos.pexels.com/video-files/5452537/5452537-hd_1080_1920_25fps.mp4", why: "central de atendimento na penumbra" },
    { url: "https://videos.pexels.com/video-files/35301995/14956727_1080_1920_30fps.mp4", why: "homem curvado na forja entre cilindros" },
    { url: "https://videos.pexels.com/video-files/5846454/5846454-hd_1080_1920_25fps.mp4", why: "operario esmerilhando metal, faiscas" },
    { url: "https://videos.pexels.com/video-files/35379339/14990686_1080_1920_30fps.mp4", why: "turno da noite ao redor da betoneira" },
  ],
  // A CASTA — quem vive às suas custas (champanhe, jato, mármore, banquete, alta gastronomia)
  network: [
    // ── Pixabay (2ª fonte curada, QA visual 2026-07-12) ──
    { url: "https://cdn.pixabay.com/video/2026/05/07/351290_large.mp4", why: "convés de megaiate iluminado, a casta jantando ao pôr do sol" },
    { url: "https://cdn.pixabay.com/video/2026/06/22/360151_large.mp4", why: "taças de champanhe brindando em festa dourada — a casta celebrando" },
    { url: "https://cdn.pixabay.com/video/2025/04/27/275054_large.mp4", why: "jatinho, cobertura panorâmica e champanhe — a casta em Dubai" },
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
    { url: "https://videos.pexels.com/video-files/7318810/7318810-sd_540_960_30fps.mp4", why: "conves de superiate sobre mar turquesa" },
    { url: "https://videos.pexels.com/video-files/27874850/12251842_540_960_25fps.mp4", why: "megaiate atracado na luz dourada" },
    { url: "https://videos.pexels.com/video-files/33391487/14214908_540_960_25fps.mp4", why: "iguaria servida em concha de prata" },
    { url: "https://videos.pexels.com/video-files/7608984/7608984-sd_540_960_25fps.mp4", why: "balcao de marmore, coquetel, clube fechado" },
    { url: "https://videos.pexels.com/video-files/12976044/12976044-sd_540_960_30fps.mp4", why: "relogio de bolso dourado com corrente" },
    { url: "https://videos.pexels.com/video-files/6314336/6314336-sd_540_960_25fps.mp4", why: "espumante rose servido, fundo moody" },
    { url: "https://videos.pexels.com/video-files/35605168/15088846_540_960_30fps.mp4", why: "saguao de palacio veneziano, tapete vermelho" },
    { url: "https://videos.pexels.com/video-files/37883533/16072921_540_960_60fps.mp4", why: "galeria branco-e-ouro com fonte" },
    { url: "https://videos.pexels.com/video-files/28408297/12376999_540_960_29fps.mp4", why: "cabine de seda de luxo, couro branco, tacas" },
    { url: "https://videos.pexels.com/video-files/4254058/4254058-sd_506_960_25fps.mp4", why: "tacas de cristal em carrinho-bar fino" },
    { url: "https://videos.pexels.com/video-files/13771698/13771698-sd_540_960_24fps.mp4", why: "helicoptero sobre torre corporativa de vidro" },
    { url: "https://videos.pexels.com/video-files/36289315/15388063_540_960_60fps.mp4", why: "vagao-bar de trem premium vazio" },
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
    { url: "https://videos.pexels.com/video-files/9945019/9945019-uhd_2160_3840_24fps.mp4", why: "mao agarrando corrente pesada, noir" },
    { url: "https://videos.pexels.com/video-files/32365210/13807580_2160_3840_25fps.mp4", why: "corrente metalica industrial, teal escuro" },
    { url: "https://videos.pexels.com/video-files/31112120/13293234_1080_1920_30fps.mp4", why: "ampulheta com areia caindo - rouba seu tempo" },
    { url: "https://videos.pexels.com/video-files/7034349/7034349-hd_1080_1920_25fps.mp4", why: "gota se formando no preto - sangria lenta" },
    { url: "https://videos.pexels.com/video-files/8084880/8084880-uhd_2160_3840_24fps.mp4", why: "ralo em close, luz baixa - pelo ralo" },
    { url: "https://videos.pexels.com/video-files/20393301/20393301-uhd_2160_3840_50fps.mp4", why: "maos folheando pilha de papeis - burocracia" },
    { url: "https://videos.pexels.com/video-files/8428300/8428300-uhd_2160_4096_25fps.mp4", why: "xadrez com peca tombada, mao pairando" },
    { url: "https://videos.pexels.com/video-files/8431828/8431828-uhd_2160_4096_25fps.mp4", why: "balanca pesando rei x dama - peso da lei" },
    { url: "https://videos.pexels.com/video-files/7345049/7345049-uhd_2160_3840_25fps.mp4", why: "carimbos de lacre de bronze - selo do Estado" },
    { url: "https://videos.pexels.com/video-files/6747719/6747719-hd_1080_1920_24fps.mp4", why: "cera derretendo, lacre em envelope - decreto" },
  ],
  // LIBERDADE — a saída (porta abrindo, cavalo/pássaro livre, estrada aberta, cume, punho erguido)
  freedom: [
    // ── Pixabay (2ª fonte curada, QA visual 2026-07-12) ──
    { url: "https://cdn.pixabay.com/video/2025/05/24/281376_large.mp4", why: "águia dourada soberana, olhar fixo, cordilheira ao fundo" },
    { url: "https://cdn.pixabay.com/video/2024/02/18/201042-914542970_large.mp4", why: "condor planando sozinho sobre a cordilheira" },
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
    { url: "https://videos.pexels.com/video-files/17357481/17357481-hd_720_1280_30fps.mp4", why: "falcao planando sozinho no ceu aberto" },
    { url: "https://videos.pexels.com/video-files/19523592/19523592-hd_720_1280_30fps.mp4", why: "corredor rumo ao amanhecer na trilha" },
    { url: "https://videos.pexels.com/video-files/18444530/18444530-hd_720_1280_30fps.mp4", why: "POV pes na beira do canion verde" },
    { url: "https://videos.pexels.com/video-files/3059486/3059486-hd_720_1280_24fps.mp4", why: "rodovia deserta ao entardecer" },
    { url: "https://videos.pexels.com/video-files/10839429/10839429-hd_720_1280_60fps.mp4", why: "ondas escuras explodindo na rocha" },
    { url: "https://videos.pexels.com/video-files/33279323/14175460_720_1280_30fps.mp4", why: "baloes subindo no ceu azul aberto" },
    { url: "https://videos.pexels.com/video-files/28261442/12343161_720_1280_60fps.mp4", why: "homem de costas diante do mar imenso" },
    { url: "https://videos.pexels.com/video-files/34078191/14453723_720_1280_30fps.mp4", why: "turbinas eolicas sobre campos dourados" },
    { url: "https://videos.pexels.com/video-files/35532696/15053626_720_1280_60fps.mp4", why: "gaivota rasante sobre o mar palido" },
    { url: "https://videos.pexels.com/video-files/28647803/12442262_720_1280_30fps.mp4", why: "sol nascendo na nevoa sobre o campo" },
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
    { url: "https://videos.pexels.com/video-files/13962379/13962379-hd_720_1280_60fps.mp4", why: "corredor de arcade neon, silhueta jogando" },
    { url: "https://videos.pexels.com/video-files/36802803/15594848_720_1280_30fps.mp4", why: "desfile folclorico rodopiando na praca" },
    { url: "https://videos.pexels.com/video-files/17512949/17512949-hd_720_1280_25fps.mp4", why: "mao deslizando o feed luminoso no escuro" },
    { url: "https://videos.pexels.com/video-files/34516347/14624304_720_1280_30fps.mp4", why: "chuvisco/estatica rosa - tela ruidosa" },
    { url: "https://videos.pexels.com/video-files/8114934/8114934-hd_720_1280_24fps.mp4", why: "globo de espelhos girando - brilho vazio" },
    { url: "https://videos.pexels.com/video-files/7722989/7722989-hd_720_1280_25fps.mp4", why: "plateia com celulares erguidos no palco" },
    { url: "https://videos.pexels.com/video-files/9954987/9954987-hd_720_1280_25fps.mp4", why: "roleta de cassino girando em close" },
    { url: "https://videos.pexels.com/video-files/3948683/3948683-hd_720_1280_30fps.mp4", why: "fogueira alta com multidao em silhueta" },
    { url: "https://videos.pexels.com/video-files/18897331/18897331-hd_720_1280_25fps.mp4", why: "festival de massa com efigies em chamas" },
    { url: "https://videos.pexels.com/video-files/30786322/13168027_720_1280_30fps.mp4", why: "brinquedo girando em rastros de neon" },
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
    { url: "https://videos.pexels.com/video-files/7299411/7299411-sd_540_960_30fps.mp4", why: "olho em close extremo - o olhar que se abre" },
    { url: "https://videos.pexels.com/video-files/5944903/5944903-sd_540_960_25fps.mp4", why: "meio-rosto anonimo, olhar fixo e serio" },
    { url: "https://videos.pexels.com/video-files/36546422/15496745_540_960_30fps.mp4", why: "rosto na luz da janela, olhos erguidos" },
    { url: "https://videos.pexels.com/video-files/8038468/8038468-sd_540_960_25fps.mp4", why: "rosto saindo da penumbra pra luz" },
    { url: "https://videos.pexels.com/video-files/7774634/7774634-sd_540_960_30fps.mp4", why: "olhar direto e resoluto sob luz quente" },
    { url: "https://videos.pexels.com/video-files/31574449/13456013_540_960_30fps.mp4", why: "mulher de pe, postura firme, encarando" },
    { url: "https://videos.pexels.com/video-files/34488757/14613445_540_960_60fps.mp4", why: "multidao erguendo bracos no escuro" },
    { url: "https://videos.pexels.com/video-files/15811516/15811516-sd_540_960_24fps.mp4", why: "silhuetas subindo a escada rumo a luz" },
    { url: "https://videos.pexels.com/video-files/19867786/19867786-sd_540_960_30fps.mp4", why: "duas silhuetas rumo a luz do tunel" },
    { url: "https://videos.pexels.com/video-files/29532409/12712583_540_960_30fps.mp4", why: "maos abrindo a cortina pra luz do dia" },
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
