// ===========================================================================
// A tela de abertura do atalho no iPhone e no iPad
// ===========================================================================
// O que o iOS mostra no instante em que se toca no ícone, antes de o site
// carregar. Sem isto ele mostra branco: o aplicativo parece travado por um
// segundo, e um segundo de tela vazia é o suficiente para a pessoa achar que
// não abriu e tocar de novo.
//
// É uma IMAGEM, e não uma animação — o iOS só aceita imagem aqui, e nenhuma
// plataforma anima essa tela. A troca por algo animado já foi tentada e
// falhou: dependia de o site carregar primeiro, e o que aparecia era uma tela
// cinza com um ponto azul. Esta não depende de nada; é o próprio sistema
// operacional que desenha.
//
// POR QUE UMA IMAGEM POR APARELHO. O iOS só usa o arquivo cuja consulta de
// mídia bate EXATAMENTE com o aparelho — largura, altura, densidade e
// orientação. Uma medida que não bate é ignorada em silêncio, e a tela volta
// a ser branca. Não há como servir uma imagem só que se estique.
//
// As imagens são geradas a partir da própria marca, em 128 cores: é branco com
// um logo, e o degradê do Λ sobrevive à redução sem faixa aparente. As 22
// somadas dão menos de meio megabyte, e cada aparelho baixa uma.
//
// iPhone só em retrato: o atalho abre em retrato, e o iOS não procura a versão
// deitada. iPad leva as duas, porque ele é usado das duas formas.
// ===========================================================================

export type TelaDeAbertura = {
  /** Largura em pontos CSS, como o iOS informa. */
  largura: number;
  altura: number;
  /** 2 ou 3, conforme a densidade da tela. */
  densidade: number;
  orientacao: "portrait" | "landscape";
};

const IPHONES: [number, number, number][] = [
  [430, 932, 3],   // 16 Pro Max, 15 Pro Max, 14 Pro Max
  [402, 874, 3],   // 16 Pro
  [393, 852, 3],   // 15 Pro, 15, 14 Pro
  [390, 844, 3],   // 14, 13, 13 Pro, 12, 12 Pro
  [428, 926, 3],   // 13 Pro Max, 12 Pro Max
  [375, 812, 3],   // 13 mini, 12 mini, 11 Pro, X, XS
  [414, 896, 3],   // 11 Pro Max, XS Max
  [414, 896, 2],   // 11, XR
  [375, 667, 2],   // SE (2ª e 3ª), 8, 7
  [414, 736, 3],   // 8 Plus, 7 Plus
];

const IPADS: [number, number, number][] = [
  [1024, 1366, 2], // Pro 12,9"
  [834, 1194, 2],  // Pro 11"
  [820, 1180, 2],  // Air 10,9"
  [810, 1080, 2],  // 10,2"
  [744, 1133, 2],  // mini 6
  [768, 1024, 2],  // 9,7" e Air antigos
];

export const TELAS_DE_ABERTURA: TelaDeAbertura[] = [
  ...IPHONES.map(([largura, altura, densidade]) => ({
    largura, altura, densidade, orientacao: "portrait" as const,
  })),
  ...IPADS.flatMap(([largura, altura, densidade]) => [
    { largura, altura, densidade, orientacao: "portrait" as const },
    // Deitado, o iOS pergunta pela largura e altura TROCADAS. Servir o mesmo
    // arquivo das duas formas faria a imagem em pé aparecer esticada.
    { largura: altura, altura: largura, densidade, orientacao: "landscape" as const },
  ]),
];

/** O arquivo é nomeado pelo tamanho em pixels de verdade, que é o que ele tem. */
export const arquivoDaAbertura = (t: TelaDeAbertura) =>
  `/abertura/abertura-${t.largura * t.densidade}x${t.altura * t.densidade}.png`;

export const consultaDaAbertura = (t: TelaDeAbertura) =>
  `(device-width: ${t.largura}px) and (device-height: ${t.altura}px)`
  + ` and (-webkit-device-pixel-ratio: ${t.densidade})`
  + ` and (orientation: ${t.orientacao})`;
