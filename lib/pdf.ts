/**
 * Um escritor de PDF mínimo — e a razão de ele existir.
 *
 * ===========================================================================
 * POR QUE NÃO USAR A IMPRESSÃO DO NAVEGADOR
 * ===========================================================================
 * A escala do mês é pregada na parede. Ela precisa sair em UMA folha, deitada,
 * e sem mais nada junto. No computador o `window.print()` faz isso. No iPhone,
 * não — e foram cinco tentativas para eu aceitar isso:
 *
 *  1. Abrir outra janela e imprimir lá. Trava o aplicativo instalado: em modo
 *     standalone a janela nova não tem barra, nem voltar, nem abas.
 *  2. `@media print` na própria página. Saiu um PDF de treze páginas com a TELA
 *     do aplicativo — o <style> criado fora do documento não registra no WebKit.
 *  3. O <style> no <head>, como manda o figurino. Saiu de novo a tela.
 *  4. Esconder a página por estilo em linha, sem depender de folha nenhuma.
 *     Saiu de novo a tela.
 *  5. `@page { size: landscape }`. O WebKit não implementa o descritor. Não há
 *     como pedir paisagem no iPhone. Ponto.
 *
 * Todas essas tentativas têm o mesmo defeito de origem: elas PEDEM ao navegador
 * que desenhe a folha, e eu não tenho o aparelho para verificar se ele desenhou.
 * Cada correção era um palpite, e o colega é que descobria no papel.
 *
 * Aqui o desenho é meu. O PDF sai pronto, deitado, de uma folha só, com a
 * escala e nada mais — e o que o iPhone faz com ele é abrir e imprimir, que é
 * a única coisa que ele faz bem. O que eu posso verificar daqui, eu verifico:
 * este arquivo é testado, e o PDF gerado é aberto e conferido.
 *
 * ===========================================================================
 * POR QUE ESCRITO À MÃO, E NÃO UMA BIBLIOTECA
 * ===========================================================================
 * O que a escala precisa é texto, retângulo e linha. As bibliotecas de PDF
 * pesam de 200KB a 1MB, e este aplicativo abre no 4G do corredor do centro
 * cirúrgico. O PDF de que se precisa aqui cabe em um arquivo.
 *
 * As fontes são as 14 padrão do formato (Helvetica), que todo leitor de PDF já
 * tem: nada é embutido, e o arquivo de um mês inteiro fica na casa dos 20KB.
 */

/**
 * As larguras da Helvetica, em milésimos do tamanho da fonte.
 *
 * Sem elas não há como centralizar um número no dia nem saber se o nome cabe na
 * pastilha — e "cabe" é a diferença entre a escala do mês e uma folha com os
 * nomes cortados no meio. São as métricas oficiais do formato; os índices vão do
 * espaço (32) ao til (126), que é o que o alfabeto sem acento ocupa.
 */
const LARGURA_NORMAL = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];
const LARGURA_NEGRITO = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
  975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
  333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611,
  611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
];

/**
 * O byte que representa cada caractere dentro do PDF, e a letra sem acento que
 * tem a mesma largura.
 *
 * O PDF escreve em WinAnsi, que é o CP1252: de 160 a 255 ele coincide com o
 * Unicode, então "ç" e "ã" entram direto. O que não coincide é a faixa de
 * pontuação de 128 a 159 — e o travessão está bem no meio dela. Sem esta
 * tabela, "—" viraria um losango de interrogação em toda faixa vazia da escala.
 *
 * A largura vem da letra base porque na Helvetica é assim de fato: o "á" ocupa
 * exatamente o mesmo que o "a"; o acento não alarga a letra.
 */
const PONTUACAO: Record<string, number> = {
  "€": 128, "‚": 130, "ƒ": 131, "„": 132, "…": 133,
  "†": 134, "‡": 135, "ˆ": 136, "‰": 137, "Š": 138,
  "‹": 139, "Œ": 140, "Ž": 142, "‘": 145, "’": 146,
  "“": 147, "”": 148, "•": 149, "–": 150, "—": 151,
  "˜": 152, "™": 153, "š": 154, "›": 155, "œ": 156,
  "ž": 158, "Ÿ": 159,
};
const LARGURA_DA_PONTUACAO: Record<number, number> = {
  128: 556, 130: 222, 131: 556, 132: 333, 133: 1000, 134: 556, 135: 556,
  136: 333, 137: 1000, 138: 667, 139: 333, 140: 1000, 142: 611, 145: 222,
  146: 222, 147: 333, 148: 333, 149: 350, 150: 556, 151: 1000, 152: 333,
  153: 1000, 154: 500, 155: 333, 156: 944, 158: 500, 159: 667,
};

/** A letra sem acento de cada acentuada, para achar a largura. */
const SEM_ACENTO =
  "AAAAAAECEEEEIIIIDNOOOOO*OUUUUYPsaaaaaaeceeeeiiiidnooooo/ouuuuypy";

/** O byte de um caractere no PDF, ou -1 quando ele não existe em WinAnsi. */
export function byteDoCaractere(c: string): number {
  const n = c.codePointAt(0) ?? 0;
  if (n >= 32 && n <= 126) return n;
  if (n >= 160 && n <= 255) return n;
  return PONTUACAO[c] ?? -1;
}

/** Quanto um texto ocupa, em pontos, no tamanho pedido. */
export function larguraDoTexto(texto: string, tamanho: number, negrito = false): number {
  const tabela = negrito ? LARGURA_NEGRITO : LARGURA_NORMAL;
  let milesimos = 0;
  for (const c of texto) {
    const b = byteDoCaractere(c);
    // Caractere que o PDF não escreve sai como "?" — e mede como "?", senão a
    // conta de largura e o que aparece no papel discordariam.
    const codigo = b < 0 ? 63 : b;
    if (codigo >= 32 && codigo <= 126) { milesimos += tabela[codigo - 32]; continue; }
    if (codigo >= 192 && codigo <= 255) {
      const base = SEM_ACENTO.charCodeAt(codigo - 192);
      milesimos += base === 42 || base === 47 ? 584 : tabela[base - 32];
      continue;
    }
    milesimos += LARGURA_DA_PONTUACAO[codigo] ?? 556;
  }
  return (milesimos * tamanho) / 1000;
}

/**
 * Corta o texto para caber na largura, com reticências.
 *
 * Cortar é sempre pior do que caber, e por isso quem chama deve tentar diminuir
 * a fonte antes. Mas um nome comprido demais precisa parar em algum lugar: sem
 * isto ele avança por cima da pastilha do vizinho, e a folha fica ilegível
 * justamente no dia mais cheio.
 */
export function cortarTexto(texto: string, largura: number, tamanho: number, negrito = false): string {
  if (larguraDoTexto(texto, tamanho, negrito) <= largura) return texto;
  const letras = [...texto];
  while (letras.length > 1) {
    letras.pop();
    if (larguraDoTexto(letras.join("") + "…", tamanho, negrito) <= largura)
      return letras.join("") + "…";
  }
  return "";
}

export type Cor = readonly [number, number, number];

/** "#1668b3" nos três componentes de 0 a 1 que o PDF entende. */
export function corDeHex(hex: string): Cor {
  const h = hex.replace("#", "");
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [
    parseInt(n.slice(0, 2), 16) / 255,
    parseInt(n.slice(2, 4), 16) / 255,
    parseInt(n.slice(4, 6), 16) / 255,
  ];
}

const numero = (v: number) => (Math.round(v * 100) / 100).toString();

export type OpcoesDeTexto = {
  tamanho?: number;
  negrito?: boolean;
  cor?: Cor;
  /** "esquerda" (padrão), "centro" ou "direita", em relação ao x dado. */
  alinhamento?: "esquerda" | "centro" | "direita";
};

/**
 * Uma página em construção.
 *
 * O eixo Y do PDF cresce para CIMA, a partir do canto inferior esquerdo. O de
 * quem desenha uma escala cresce para baixo, a partir do topo — é assim que se
 * pensa "o cabeçalho, e abaixo dele a grade". A conversão fica aqui dentro, uma
 * vez, em vez de aparecer invertida em cada linha do desenho.
 */
export class Pagina {
  private readonly partes: string[] = [];
  // Campos declarados e atribuídos à mão: os testes rodam com o Node em modo
  // "strip-only", que não implementa parâmetro-propriedade no construtor.
  readonly largura: number;
  readonly altura: number;

  constructor(largura: number, altura: number) {
    this.largura = largura;
    this.altura = altura;
  }

  private cor(c: Cor, traco = false) {
    this.partes.push(`${numero(c[0])} ${numero(c[1])} ${numero(c[2])} ${traco ? "RG" : "rg"}`);
  }

  /** Retângulo cheio. `y` é a borda de cima. */
  retangulo(x: number, y: number, largura: number, altura: number, cor: Cor) {
    this.cor(cor);
    this.partes.push(`${numero(x)} ${numero(this.altura - y - altura)} ${numero(largura)} ${numero(altura)} re f`);
  }

  /** Retângulo de cantos arredondados, cheio — a pastilha de nome. */
  pastilha(x: number, y: number, largura: number, altura: number, raio: number, cor: Cor) {
    const r = Math.min(raio, largura / 2, altura / 2);
    const b = this.altura - y - altura, d = x + largura, t = b + altura;
    // O arco de Bézier com 0.5523 do raio é a aproximação padrão de um quarto
    // de círculo; a olho nu, num canto de 2pt, é indistinguível do círculo.
    const k = r * 0.5523;
    this.cor(cor);
    this.partes.push(
      `${numero(x + r)} ${numero(b)} m`,
      `${numero(d - r)} ${numero(b)} l`,
      `${numero(d - r + k)} ${numero(b)} ${numero(d)} ${numero(b + r - k)} ${numero(d)} ${numero(b + r)} c`,
      `${numero(d)} ${numero(t - r)} l`,
      `${numero(d)} ${numero(t - r + k)} ${numero(d - r + k)} ${numero(t)} ${numero(d - r)} ${numero(t)} c`,
      `${numero(x + r)} ${numero(t)} l`,
      `${numero(x + r - k)} ${numero(t)} ${numero(x)} ${numero(t - r + k)} ${numero(x)} ${numero(t - r)} c`,
      `${numero(x)} ${numero(b + r)} l`,
      `${numero(x)} ${numero(b + r - k)} ${numero(x + r - k)} ${numero(b)} ${numero(x + r)} ${numero(b)} c`,
      "f");
  }

  linha(x1: number, y1: number, x2: number, y2: number, cor: Cor, espessura = 0.5) {
    this.cor(cor, true);
    this.partes.push(`${numero(espessura)} w ${numero(x1)} ${numero(this.altura - y1)} m `
      + `${numero(x2)} ${numero(this.altura - y2)} l S`);
  }

  /** Texto. `y` é o TOPO da linha, e não a base sobre a qual as letras se apoiam. */
  texto(x: number, y: number, texto: string, opcoes: OpcoesDeTexto = {}) {
    const { tamanho = 9, negrito = false, cor = [0, 0, 0] as Cor, alinhamento = "esquerda" } = opcoes;
    if (!texto) return;
    const largura = larguraDoTexto(texto, tamanho, negrito);
    const inicio = alinhamento === "centro" ? x - largura / 2
      : alinhamento === "direita" ? x - largura : x;
    // 0.75 do tamanho é a altura da maiúscula na Helvetica: é o que faz "y é o
    // topo" ser verdade para quem desenha, em vez de o topo teórico da fonte,
    // que inclui um vão que nenhuma letra ocupa.
    const base = this.altura - y - tamanho * 0.75;
    this.cor(cor);
    this.partes.push(`BT /${negrito ? "F2" : "F1"} ${numero(tamanho)} Tf `
      + `${numero(inicio)} ${numero(base)} Td (${escaparPdf(texto)}) Tj ET`);
  }

  get conteudo(): string {
    return this.partes.join("\n");
  }
}

/**
 * O texto como o PDF o guarda: em WinAnsi, com os parênteses escapados.
 *
 * Parêntese sem escape ENCERRA a string no meio, e o resto do arquivo vira
 * lixo — um plantão em "Sedação (consultório)" bastaria para o PDF inteiro não
 * abrir. Por isso o escape não é enfeite.
 */
export function escaparPdf(texto: string): string {
  let saida = "";
  for (const c of texto) {
    const b = byteDoCaractere(c);
    if (b < 0) { saida += "?"; continue; }
    if (b === 40 || b === 41 || b === 92) saida += "\\" + c;
    else if (b < 32) saida += " ";
    else if (b > 126) saida += "\\" + b.toString(8).padStart(3, "0");
    else saida += c;
  }
  return saida;
}

/**
 * Uma "text string" do PDF em UTF-16, escrita em hexadecimal.
 *
 * Hexadecimal, e não entre parênteses, porque assim não há byte que precise de
 * escape: um 0x28 no meio de um caractere acentuado não pode ser confundido com
 * um parêntese de abertura.
 */
export function textoUtf16(texto: string): string {
  let hex = "FEFF";
  for (let i = 0; i < texto.length; i++)
    hex += texto.charCodeAt(i).toString(16).toUpperCase().padStart(4, "0");
  return `<${hex}>`;
}

/**
 * Monta o arquivo.
 *
 * Sai como texto de bytes — cada caractere é um byte —, porque a tabela `xref`
 * do PDF guarda a POSIÇÃO EM BYTES de cada objeto, e um arquivo em que posição
 * de caractere e posição de byte fossem coisas diferentes teria a tabela errada
 * e não abriria. Quem entrega o arquivo converte com `charCodeAt & 0xff`.
 */
export function montarPdf(paginas: Pagina[], titulo: string): string {
  const objetos: string[] = [];
  const guardar = (corpo: string) => { objetos.push(corpo); return objetos.length; };

  const idsDasPaginas: number[] = [];
  // Cada página gasta DOIS objetos — o conteúdo e a página em si —, então a
  // árvore de páginas é o próximo. Aqui havia um "1 +" a mais: o catálogo
  // apontava /Pages para a fonte Helvetica, o leitor não achava página nenhuma
  // e abria uma folha em branco, em pé. Saiu exatamente igual ao defeito que
  // este arquivo veio consertar, e só apareceu porque o PDF foi aberto e
  // olhado — daí o teste que trava os números logo abaixo.
  const idDoPai = paginas.length * 2 + 1;
  for (const p of paginas) {
    const conteudo = p.conteudo;
    const idDoConteudo = guardar(`<< /Length ${conteudo.length} >>\nstream\n${conteudo}\nendstream`);
    idsDasPaginas.push(guardar(
      `<< /Type /Page /Parent ${idDoPai} 0 R /MediaBox [0 0 ${numero(p.largura)} ${numero(p.altura)}]`
      + ` /Resources << /Font << /F1 ${idDoPai + 1} 0 R /F2 ${idDoPai + 2} 0 R >> >>`
      + ` /Contents ${idDoConteudo} 0 R >>`));
  }
  guardar(`<< /Type /Pages /Kids [${idsDasPaginas.map((i) => `${i} 0 R`).join(" ")}] /Count ${paginas.length} >>`);
  guardar("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  guardar("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  const idDoCatalogo = guardar(`<< /Type /Catalog /Pages ${idDoPai} 0 R >>`);
  // O título vai no arquivo: é o nome que o leitor de PDF mostra na aba e o que
  // o iPhone oferece ao compartilhar. Sem ele, toda escala salva se chama
  // "documento".
  //
  // Aqui NÃO vale o WinAnsi do resto: a ficha do documento é uma "text string"
  // do formato, e cada leitor adivinha a codificação de um jeito. O travessão
  // de "Escala da equipe — SETEMBRO" saía como "Š" no Chrome. Em UTF-16 com
  // marca de ordem de bytes não há o que adivinhar.
  const idDaFicha = guardar(`<< /Title ${textoUtf16(titulo)} /Producer (AVANEST) >>`);

  let arquivo = "%PDF-1.4\n";
  const posicoes: number[] = [];
  objetos.forEach((corpo, i) => {
    posicoes.push(arquivo.length);
    arquivo += `${i + 1} 0 obj\n${corpo}\nendobj\n`;
  });
  const inicioDaTabela = arquivo.length;
  arquivo += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  for (const p of posicoes) arquivo += `${String(p).padStart(10, "0")} 00000 n \n`;
  arquivo += `trailer\n<< /Size ${objetos.length + 1} /Root ${idDoCatalogo} 0 R /Info ${idDaFicha} 0 R >>\n`
    + `startxref\n${inicioDaTabela}\n%%EOF\n`;
  return arquivo;
}
