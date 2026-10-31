import { SLOGAN } from "./escala.ts";
import { Pagina, corDeHex, cortarTexto, larguraDoTexto, montarPdf, type Cor } from "./pdf.ts";

/**
 * As folhas em lista — faturamento, produção, fechamento — desenhadas em PDF,
 * numa A4 em pé, com quantas páginas forem precisas.
 *
 * ===========================================================================
 * POR QUE EXISTE
 * ===========================================================================
 * Essas folhas iam para a impressora pelo `window.print()` da própria página
 * (ver `imprimirFolha` em components/plantoes.tsx), com a folha de estilo em
 * `@media print`. No computador funciona. No iPhone, a folha de faturamento
 * saiu SEM ESTILO NENHUM (30/10/2026): letra da tela, sem bordas, as colunas
 * coladas umas nas outras — "PARTICULARR$ 0,00". É a mesma família de defeito
 * que levou a escala para o PDF (ver o cabeçalho de `lib/pdf.ts`): no WebKit
 * do iPhone o `@media print` não é garantido, e daqui eu não tenho como ver o
 * que o aparelho desenhou.
 *
 * Aqui o desenho é meu, como na escala. O iPhone só abre um PDF pronto.
 *
 * ===========================================================================
 * O QUE O DESENHO GARANTE
 * ===========================================================================
 * - Texto comprido QUEBRA dentro da célula, em vez de invadir a vizinha. Nome
 *   de paciente e procedimento são os campos mais longos da folha.
 * - Tabela que passa da página continua na seguinte COM o cabeçalho de novo:
 *   a coluna "Valor" na página 2 sem título é só uma coluna de números.
 * - Título de bloco não fica sozinho no pé da página, longe da tabela dele.
 * - Toda página diz "página X de N": folha de nota vai grampeada, e a que se
 *   solta precisa dizer de onde saiu.
 */

/** A4 em pé, em pontos. */
export const A4_EM_PE = { largura: 595.28, altura: 841.89 };

const MARGEM = 36;
/** A faixa do pé de cada página: assinatura e número da página. */
const ALTURA_DO_PE = 22;

export type ColunaDaLista = {
  titulo: string;
  /** Fração da largura útil. As frações de uma tabela somam 1. */
  largura: number;
  direita?: boolean;
};

export type BlocoDaLista =
  | { tipo: "secao"; texto: string; detalhe?: string }
  | { tipo: "subsecao"; texto: string; detalhe?: string; pendente?: boolean }
  | { tipo: "aviso"; texto: string }
  | { tipo: "paragrafo"; texto: string }
  | {
    tipo: "tabela";
    colunas: ColunaDaLista[];
    linhas: string[][];
    /**
     * A linha de total. Os `valores` ocupam as últimas colunas; o rótulo, todas
     * as outras — como o colspan da folha em HTML.
     */
    total?: { rotulo: string; valores: string[]; pendente?: boolean };
  };

export type ListaParaPdf = {
  titulo: string;
  subtitulo?: string;
  blocos: BlocoDaLista[];
  /** O resumo do fim da folha ("10 pacientes · R$ 2.700,00"). */
  rodape?: string;
  impressoEm: Date;
};

const COR = {
  tinta: corDeHex("#111111"),
  fraca: corDeHex("#555555"),
  cabecalho: corDeHex("#444444"),
  borda: corDeHex("#bbbbbb"),
  regua: corDeHex("#333333"),
  fundo: corDeHex("#f1f1f1"),
  pendenteFundo: corDeHex("#fff4e0"),
  pendenteTinta: corDeHex("#8a4b00"),
  pendenteBarra: corDeHex("#d98200"),
  marca: corDeHex("#0a84c8"),
  assinatura: corDeHex("#8a97a4"),
};

const TAMANHO = { titulo: 14, sub: 9, secao: 11, subsecao: 9.5, detalhe: 8.5, celula: 8.5, cabecalho: 7.5, rodape: 8.5 };
const ENTRELINHA = 1.25;
const RESPIRO = { x: 4, y: 3.5 };

/**
 * O texto em linhas que cabem na largura.
 *
 * Quebra nos espaços, como a tela. Palavra que sozinha não cabe — um nome
 * colado, um código — é partida onde acabar o espaço, com hífen: cortar com
 * reticências esconderia parte do nome do paciente, e é dele que a nota fala.
 */
export function quebrarTexto(texto: string, largura: number, tamanho: number, negrito = false): string[] {
  const palavras = String(texto ?? "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (palavras.length === 0) return [""];
  const cabe = (t: string) => larguraDoTexto(t, tamanho, negrito) <= largura;
  const linhas: string[] = [];
  let atual = "";
  for (let palavra of palavras) {
    const junto = atual ? `${atual} ${palavra}` : palavra;
    if (cabe(junto)) { atual = junto; continue; }
    if (atual) { linhas.push(atual); atual = ""; }
    while (!cabe(palavra)) {
      const letras = [...palavra];
      let n = letras.length - 1;
      while (n > 1 && !cabe(letras.slice(0, n).join("") + "-")) n--;
      linhas.push(letras.slice(0, n).join("") + "-");
      palavra = letras.slice(n).join("");
    }
    atual = palavra;
  }
  if (atual) linhas.push(atual);
  return linhas;
}

export function listaEmPdf(l: ListaParaPdf): string {
  const util = A4_EM_PE.largura - MARGEM * 2;
  const limite = A4_EM_PE.altura - MARGEM - ALTURA_DO_PE;
  const paginas: Pagina[] = [];
  let pagina!: Pagina;
  let y = 0;
  const novaPagina = () => {
    pagina = new Pagina(A4_EM_PE.largura, A4_EM_PE.altura);
    paginas.push(pagina);
    y = MARGEM;
  };
  /** Começa outra página se `altura` não couber a partir de onde se está. */
  const garantir = (altura: number) => { if (y + altura > limite && y > MARGEM) novaPagina(); };
  const alturaDaLinha = (tamanho: number) => tamanho * ENTRELINHA;

  /** Texto corrido, quebrado na largura, a partir de `x`. Devolve a altura usada. */
  const paragrafo = (texto: string, x: number, largura: number, tamanho: number, cor: Cor, negrito = false) => {
    const linhas = quebrarTexto(texto, largura, tamanho, negrito);
    linhas.forEach((t, i) => pagina.texto(x, y + i * alturaDaLinha(tamanho), t, { tamanho, cor, negrito }));
    return linhas.length * alturaDaLinha(tamanho);
  };

  /** "FUNDHOSPAR  10 pacientes · R$ 2.700,00" — o nome em negrito, o detalhe ao lado. */
  const titulo = (texto: string, detalhe: string | undefined, tamanho: number, cor: Cor) => {
    const nome = cortarTexto(texto, util * 0.7, tamanho, true);
    pagina.texto(MARGEM, y, nome, { tamanho, negrito: true, cor });
    if (detalhe) {
      const x = MARGEM + larguraDoTexto(nome, tamanho, true) + 6;
      pagina.texto(x, y + (tamanho - TAMANHO.detalhe) * 0.75,
        cortarTexto(detalhe, MARGEM + util - x, TAMANHO.detalhe), { tamanho: TAMANHO.detalhe, cor: COR.fraca });
    }
  };

  novaPagina();
  y += paragrafo(l.titulo, MARGEM, util, TAMANHO.titulo, COR.tinta, true) + 2;
  if (l.subtitulo) y += paragrafo(l.subtitulo, MARGEM, util, TAMANHO.sub, COR.fraca) + 6;

  const alturaDoCabecalho = TAMANHO.cabecalho + RESPIRO.y * 2;
  const alturaDoTotal = alturaDaLinha(TAMANHO.celula) + RESPIRO.y * 2;
  const alturaDaFileira = (b: Extract<BlocoDaLista, { tipo: "tabela" }>, celulas: string[]) =>
    Math.max(...celulas.map((t, k) =>
      quebrarTexto(t, b.colunas[k].largura * util - RESPIRO.x * 2, TAMANHO.celula).length))
      * alturaDaLinha(TAMANHO.celula) + RESPIRO.y * 2;
  /**
   * O mínimo de uma tabela que tem de caber junto do começo dela: o cabeçalho e
   * a primeira linha — e o total, quando a linha é a única. Cabeçalho sozinho no
   * pé da página é uma tabela vazia; o mesmo vale para o título que a anuncia.
   */
  const comecoDaTabela = (b: Extract<BlocoDaLista, { tipo: "tabela" }>) =>
    alturaDoCabecalho + (b.linhas[0] ? alturaDaFileira(b, b.linhas[0]) : 0)
      + (b.total && b.linhas.length <= 1 ? alturaDoTotal : 0);
  /** O que vem logo depois do bloco `i`, e precisa descer junto com ele. */
  const reservaApos = (i: number): number => {
    const proximo = l.blocos[i + 1];
    if (!proximo) return 0;
    if (proximo.tipo === "tabela") return comecoDaTabela(proximo);
    if (proximo.tipo === "subsecao") return TAMANHO.subsecao + 8 + reservaApos(i + 1);
    return 0;
  };

  for (const [i, b] of l.blocos.entries()) {
    const seguido = reservaApos(i);

    if (b.tipo === "secao") {
      y += 8;
      garantir(TAMANHO.secao + 6 + seguido);
      titulo(b.texto, b.detalhe, TAMANHO.secao, COR.tinta);
      y += TAMANHO.secao + 3;
      pagina.linha(MARGEM, y, MARGEM + util, y, COR.regua, 1.2);
      y += 5;
      continue;
    }
    if (b.tipo === "subsecao") {
      y += 4;
      garantir(TAMANHO.subsecao + 4 + seguido);
      titulo(b.texto, b.detalhe, TAMANHO.subsecao, b.pendente ? COR.pendenteTinta : COR.tinta);
      y += TAMANHO.subsecao + 4;
      continue;
    }
    if (b.tipo === "paragrafo") {
      const linhas = quebrarTexto(b.texto, util, TAMANHO.sub);
      garantir(linhas.length * alturaDaLinha(TAMANHO.sub));
      y += paragrafo(b.texto, MARGEM, util, TAMANHO.sub, COR.fraca) + 4;
      continue;
    }
    if (b.tipo === "aviso") {
      const linhas = quebrarTexto(b.texto, util - 20, TAMANHO.sub, true);
      const altura = linhas.length * alturaDaLinha(TAMANHO.sub) + 12;
      garantir(altura);
      const topo = y;
      pagina.retangulo(MARGEM, topo, util, altura, COR.pendenteFundo);
      pagina.retangulo(MARGEM, topo, 2.5, altura, COR.pendenteBarra);
      y = topo + 6;
      paragrafo(b.texto, MARGEM + 10, util - 20, TAMANHO.sub, COR.pendenteTinta, true);
      y = topo + altura + 6;
      continue;
    }

    // ---- Tabela ------------------------------------------------------------
    const larguras = b.colunas.map((c) => c.largura * util);
    const xs = larguras.map((_, k) => MARGEM + larguras.slice(0, k).reduce((s, w) => s + w, 0));

    const cabecalho = () => {
      const altura = alturaDoCabecalho;
      pagina.retangulo(MARGEM, y, util, altura, COR.fundo);
      b.colunas.forEach((c, k) => {
        const texto = cortarTexto(c.titulo.toUpperCase(), larguras[k] - RESPIRO.x * 2, TAMANHO.cabecalho, true);
        pagina.texto(c.direita ? xs[k] + larguras[k] - RESPIRO.x : xs[k] + RESPIRO.x, y + RESPIRO.y, texto,
          { tamanho: TAMANHO.cabecalho, negrito: true, cor: COR.cabecalho, alinhamento: c.direita ? "direita" : "esquerda" });
      });
      grade(altura);
      y += altura;
    };
    /** As bordas da linha que começa em `y`, com a altura dada. */
    const grade = (altura: number, divisorias = xs.slice(1)) => {
      pagina.linha(MARGEM, y, MARGEM + util, y, COR.borda, 0.5);
      pagina.linha(MARGEM, y + altura, MARGEM + util, y + altura, COR.borda, 0.5);
      pagina.linha(MARGEM, y, MARGEM, y + altura, COR.borda, 0.5);
      pagina.linha(MARGEM + util, y, MARGEM + util, y + altura, COR.borda, 0.5);
      for (const x of divisorias) pagina.linha(x, y, x, y + altura, COR.borda, 0.5);
    };

    garantir(comecoDaTabela(b));
    cabecalho();

    for (const [n, celulas] of b.linhas.entries()) {
      const quebradas = celulas.map((t, k) => quebrarTexto(t, larguras[k] - RESPIRO.x * 2, TAMANHO.celula));
      const altura = Math.max(...quebradas.map((q) => q.length)) * alturaDaLinha(TAMANHO.celula) + RESPIRO.y * 2;
      // A última linha desce junto com o total: o total sozinho no alto da
      // página seguinte é um número sem nenhuma linha que ele some.
      const junto = n === b.linhas.length - 1 && b.total ? alturaDoTotal : 0;
      if (y + altura + junto > limite) { novaPagina(); cabecalho(); }
      quebradas.forEach((linhas, k) => {
        const c = b.colunas[k];
        linhas.forEach((t, n) => pagina.texto(
          c.direita ? xs[k] + larguras[k] - RESPIRO.x : xs[k] + RESPIRO.x,
          y + RESPIRO.y + n * alturaDaLinha(TAMANHO.celula), t,
          { tamanho: TAMANHO.celula, cor: COR.tinta, alinhamento: c.direita ? "direita" : "esquerda" }));
      });
      grade(altura);
      y += altura;
    }

    if (b.total) {
      const { rotulo, valores, pendente } = b.total;
      const altura = alturaDoTotal;
      if (y + altura > limite) { novaPagina(); cabecalho(); }
      const primeira = b.colunas.length - valores.length;
      pagina.retangulo(MARGEM, y, util, altura, pendente ? COR.pendenteFundo : COR.fundo);
      const tinta = pendente ? COR.pendenteTinta : COR.tinta;
      pagina.texto(MARGEM + RESPIRO.x, y + RESPIRO.y,
        cortarTexto(rotulo, xs[primeira] - MARGEM - RESPIRO.x * 2, TAMANHO.celula, true),
        { tamanho: TAMANHO.celula, negrito: true, cor: tinta });
      valores.forEach((v, n) => {
        const k = primeira + n;
        pagina.texto(xs[k] + larguras[k] - RESPIRO.x, y + RESPIRO.y, v,
          { tamanho: TAMANHO.celula, negrito: true, cor: tinta, alinhamento: "direita" });
      });
      grade(altura, xs.slice(primeira));
      // O traço grosso em cima do total: o olho acha o fim da coluna sem ler as outras.
      pagina.linha(MARGEM, y, MARGEM + util, y, COR.regua, 1.5);
      y += altura;
    }
    y += 4;
  }

  if (l.rodape) {
    garantir(alturaDaLinha(TAMANHO.rodape) + 8);
    y += 8;
    paragrafo(l.rodape, MARGEM, util, TAMANHO.rodape, COR.fraca, true);
  }

  // ---- O pé de cada página ------------------------------------------------
  // Desenhado no fim, porque só agora se sabe quantas páginas são.
  const quando = `Impresso em ${l.impressoEm.toLocaleDateString("pt-BR")} às `
    + l.impressoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  paginas.forEach((p, i) => {
    const yAss = A4_EM_PE.altura - MARGEM + 4;
    // O Λ da marca é desenhado, como na escala: dois traços não pedem imagem.
    p.linha(MARGEM, yAss, MARGEM + 3.4, yAss - 7, COR.marca, 1.3);
    p.linha(MARGEM + 3.4, yAss - 7, MARGEM + 6.8, yAss, COR.marca, 1.3);
    p.texto(MARGEM + 10, yAss - 9.5, "AVANEST", { tamanho: 7.5, negrito: true, cor: COR.assinatura });
    p.texto(MARGEM + 10, yAss - 2.5, SLOGAN, { tamanho: 5.6, cor: COR.assinatura });
    p.texto(A4_EM_PE.largura - MARGEM, yAss - 7.5,
      `${quando} · página ${i + 1} de ${paginas.length}`,
      { tamanho: 6.5, cor: COR.assinatura, alinhamento: "direita" });
  });

  return montarPdf(paginas, l.titulo);
}
