import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// ─── AS MUDANÇAS DE 11/08/2026, PORTADAS DO DR. LIBERDADE ────────────────────
// Ordem do dono: *"aplicando todas as mudanças igual está atual no DR liberdade… deve
// manter a voz de cada IG e também a quantidade diária"*. Cada item que ele apontou lá
// vira trava aqui — sem isso a próxima sessão desfaz sem perceber e ele aponta de novo.
//
// ⚠️ ESTA CONTA NÃO TEM `thumb_offset`: o Instagram usa o PRIMEIRO QUADRO do vídeo como
// capa do grid, e nada aqui aponta para outro. Ou seja, o quadro 0 É a capa do perfil —
// o que torna as travas de "frase inteira" e "cor no quadro 0" mais críticas aqui do que
// no DR, não menos.
//
// Lê os arquivos como TEXTO de propósito: importar o ReelV2 puxaria o Remotion inteiro
// para dentro do teste.

const raiz = join(__dirname, "..", "..");

/**
 * O CÓDIGO, sem os comentários.
 *
 * ⚠️ Régua que lê comentário reprova justamente quem documentou o conserto — e foi o que
 * aconteceu na 1ª versão desta bateria: o cabeçalho do `serie.ts` EXPLICA que «GAIOLA SEM
 * GRADE» é do Dr. Liberdade e não pode ser copiada para cá, e a trava leu essa explicação
 * como se o nome estivesse em uso. O mesmo com o comentário do `ReelV2` que conta que o
 * `volume={(f) => …}` foi removido. Ler o código limpo é o que separa o que a peça FAZ do
 * que ela CONTA.
 */
const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "").replace(/\s\/\/.*$/gm, "");

const ler = (...p: string[]) => semComentarios(readFileSync(join(raiz, ...p), "utf8"));

const reelV2 = ler("video", "ReelV2.tsx");
const serie = ler("src", "lib", "serie.ts");
const publish = ler("src", "app", "api", "publish", "route.ts");

describe("a capa do Reel no grid do Instagram", () => {
  it("a manchete está legível no PRIMEIRO quadro — nada de tela muda", () => {
    // O defeito medido no DR: 12,4% continuavam assistindo (contra 70% da referência),
    // porque a frase entrava palavra a palavra e só ficava inteira no 3º segundo — e a
    // pessoa decide no primeiro. O que esta trava cobre é a CAPA; os INSIGHTS continuam
    // cinéticos de propósito, que é onde a voz dá o ritmo.
    expect(reelV2).toMatch(/<KineticText[^/]*inteiroDeInicio/);
    expect(reelV2).toMatch(/inteiroDeInicio\s*\?\s*1\s*\n?\s*:/);
  });

  it("a cor da marca NASCE no quadro 0 — não acende depois", () => {
    // No DR o dono olhou o primeiro quadro e disse *"no seu texto não tem cor"*: medido,
    // o frame 0 tinha 0 pixel na cor da marca e o frame 15 tinha 10.569. Aqui, sem
    // `thumb_offset`, esse quadro incompleto seria a capa do perfil.
    expect(reelV2).not.toMatch(/interpolateColors/);
    expect(reelV2).toMatch(/isAccent \? accentColor : WHITE/);
    // A identidade do cabeçalho também nasce visível (opacidade 1, sem fade de entrada).
    expect(reelV2).toMatch(/const kickerO = 1;/);
  });

  it("«tamanho da letra e fonte iguais ao print»: a manchete da capa vai em CAIXA ALTA", () => {
    expect(reelV2).toMatch(/const manchete = \(title \|\| ""\)\.toUpperCase\(\)/);
    expect(reelV2).toMatch(/text=\{manchete\}/);
  });

  it("«o texto do reel desce igual ao do carrossel»: ancorado embaixo, capa E insight", () => {
    // Duas telas, uma âncora só — a peça inteira tem de ter uma cara só. Se voltar a
    // `top:`/`padding-bottom`, a capa e o insight desalinham e o grid destoa.
    const ancoras = reelV2.match(/bottom: REEL_TEXTO_BOTTOM/g) ?? [];
    expect(ancoras.length).toBeGreaterThanOrEqual(2);
    expect(reelV2).not.toMatch(/SAFE_BOTTOM_TEXT/);
  });

  it("«destaque não é da cor da nossa marca»: identidade usa MARCA, não o acento do pilar", () => {
    // Identidade que muda de cor a cada peça não é identidade. O acento por pilar continua
    // mandando no wash e no miolo da cena — só a barra, a etiqueta e a palavra em destaque
    // passam a ser sempre a cor da marca.
    expect(reelV2).toMatch(/const MARCA = "#a83f30"/);
    expect(reelV2).toMatch(/backgroundColor: MARCA/);
    expect(reelV2).toMatch(/accentColor=\{MARCA\}/);
  });

  it("a cor da marca é a MESMA que o carrossel carimba — senão não é identidade", () => {
    // `J_RUST` em `api/og/route.tsx` é o carimbo do jornal satírico desta conta. Reel e
    // carrossel têm de sair na mesma cor; foi esse o ponto da ordem do dono.
    const og = ler("src", "app", "api", "og", "route.tsx");
    const m = og.match(/const J_RUST\s*=\s*"(#[0-9a-fA-F]{6})"/);
    expect(m, "não achei J_RUST em api/og/route.tsx").toBeTruthy();
    expect(reelV2).toContain(`const MARCA = "${m![1]}"`);
  });

  it("«nome da série em um quadrado vermelho»: o selo é etiqueta sólida, não texto solto", () => {
    const i = reelV2.indexOf("{etiqueta}");
    expect(i, "não achei a etiqueta na capa").toBeGreaterThan(0);
    const bloco = reelV2.slice(i - 500, i + 40);
    expect(bloco).toMatch(/backgroundColor: MARCA/);
    expect(bloco).toMatch(/borderRadius/);
  });

  it("o selo vem da FONTE ÚNICA e recebe o número da edição", () => {
    expect(reelV2).toMatch(/\bselo\(ed\)/);
    expect(reelV2).toMatch(/<CoverTextV2[^>]*\bed=\{ed\}/);
    expect(serie).toMatch(/Nº \$\{n\}/);
  });

  it("a série ainda NÃO está batizada — e isso é decisão de marca, não descuido", () => {
    // ⚠️ Se esta trava falhar porque `NOME_SERIE` ganhou conteúdo, ótimo: o marketing
    // decidiu e o teste deve ser trocado por um que exija o nome. O que ela impede é o
    // caminho errado — uma sessão inventar um nome aqui, ou copiar a bandeira do Dr.
    // Liberdade, que é de outra marca. Delegado ao diretor em 11/08.
    expect(serie).toMatch(/export const NOME_SERIE = ""/);
    expect(serie).not.toMatch(/GAIOLA SEM GRADE|JAULA SIN REJAS/);
  });

  it("a etiqueta não é pintada quando não há nada a dizer", () => {
    // Sem nome e sem número, um retângulo vermelho vazio no topo seria pior que nada.
    expect(reelV2).toMatch(/\{etiqueta \? \(/);
  });

  it("o Reel usa os acentos vindos da fonte única, não um mapa recriado aqui", () => {
    expect(reelV2).toMatch(/import\s*\{[^}]*CAT_ACCENT[^}]*\}\s*from\s*"\.\/Reel"/);
    expect(reelV2).not.toMatch(/const\s+CAT_ACCENT\s*:/);
  });
});

describe("o som da peça (11/08/2026)", () => {
  it("«áudio quebra»: a cama musical REPETE, porque toda trilha tem 28,0 s fixos", () => {
    // Medido no Reel publicado do DR: o som caía de −17 dB para −85 dB aos ~27 s num vídeo
    // de 30,6 s. O acervo é o mesmo aqui, e esta conta também ganhou fecho falado em 29/07
    // — que é justamente o que estica a peça para além dos 28 s.
    expect(reelV2).toMatch(/<Audio\s+src=\{musicSrc\}\s+loop/);
  });

  it("a curva de volume lê o frame da COMPOSIÇÃO, não o do áudio", () => {
    // Com `loop`, o frame que o callback do `<Audio>` recebe VOLTA A ZERO a cada repetição
    // e o fade refaz — medido no DR: 3 s mudos no meio, e o som "renascendo" aos 28 s.
    expect(reelV2).toMatch(/const frameDaPeca = useCurrentFrame\(\)/);
    expect(reelV2).toMatch(/interpolate\(frameDaPeca,/);
    expect(reelV2).toMatch(/volume=\{musicVol\}/);
    // E não pode voltar o callback, que é onde o defeito morava.
    expect(reelV2).not.toMatch(/volume=\{\(f\) =>/);
  });

  it("«sem voz gravada»: a cama sai da frente e a voz vai reforçada", () => {
    // A voz estava lá; faltava ESPAÇO. Medido na faixa da fala (300–3000 Hz), a mistura
    // media MENOS que a voz sozinha (−30,1 contra −27,1 dB) — assinatura de mascaramento.
    expect(reelV2).toMatch(/const musicMax = narrationSrc \? 0\.07 : 0\.7/);
    expect(reelV2).toMatch(/const VOZ_GANHO = 1\.5/);
    expect(reelV2).toMatch(/src=\{narrationSrc\} volume=\{VOZ_GANHO\}/);
  });
});

describe("a boca e a tela são textos diferentes (11/08/2026)", () => {
  const script = ler("src", "lib", "reel-script.ts");

  it("o expansor mora na FONTE ÚNICA do roteiro falado, não no chamador", () => {
    // *"não existe 20 min falado"*. Na tela "20 min" é bom; na boca é "vinte minutos".
    // Fica em `reel-script.ts` porque são DOIS caminhos (roteiro de cena e copy pronta) e
    // pôr no `route.ts` deixaria um deles de fora.
    expect(script).toMatch(/import \{ paraFalar \} from "\.\/fala"/);
    expect(publish).not.toMatch(/paraFalar/);
  });

  it("os DOIS caminhos de montagem falam expandido", () => {
    const usos = script.match(/\.map\(falado\)/g) ?? [];
    expect(usos.length, "montarFala e montarFalaDeCopy").toBeGreaterThanOrEqual(2);
  });

  it("o texto da TELA continua saindo como o redator escreveu", () => {
    // Se `paraFalar` encostasse em `title`/`slides`/`cta` do retorno, a tela ganharia
    // "vinte minutos" — longo e fora da régua de ocupação. Só `segments` passa por lá.
    expect(script).not.toMatch(/title: falado\(|slides: .*falado|cta: falado\(/);
  });

  it("a expansão CONTA no teto — senão a fala passa do que foi medido", () => {
    // Mesmo defeito que a correção de 31/07 consertou (o fecho contava depois da conta):
    // medir o texto da tela e falar outro, maior, faz o vídeo estourar a duração.
    expect(script).toMatch(/const tamanhoFalado = /);
    const totais = script.match(/return tamanhoFalado\(/g) ?? [];
    expect(totais.length).toBeGreaterThanOrEqual(2);
  });
});

describe("o placar por formato (11/08/2026)", () => {
  it("a peça publicada carimba o esqueleto no livro-razão — as duas rotas", () => {
    // Sem isto o placar não tem o que contar: o formato fica só na memória da geração.
    // O Reel é 3 das 4 peças do dia — deixar só o carrossel carimbado seria medir 25%.
    // ⚠️ Nada de `[^)]*` aqui: a chamada tem parênteses por dentro (`dayUTC(now)`) e a
    // régua pararia no primeiro fecha-parêntese, reprovando código correto.
    expect(publish).toMatch(/recordRun\([\s\S]{0,200}?content\.formato \?\? null\)/);
    expect(ler("src", "app", "api", "publish-reel", "route.ts")).toMatch(
      /recordRun\([\s\S]{0,200}?formato \|\| null\)/,
    );
  });

  it("o formato viaja do preview até a publicação do Reel", () => {
    expect(publish).toMatch(/formato: content\.formato \?\? null/);
    const wf = readFileSync(join(raiz, ".github", "workflows", "instagram-reels.yml"), "utf8");
    expect(wf).toMatch(/formato\.txt/);
    expect(wf).toMatch(/--data-urlencode "formato@formato\.txt"/);
  });

  it("a coluna do banco é criada pela migração — senão o placar nasce cego", () => {
    expect(ler("src", "app", "api", "migrate", "route.ts")).toMatch(
      /ALTER TABLE published_runs ADD COLUMN IF NOT EXISTS formato TEXT/,
    );
  });
});
