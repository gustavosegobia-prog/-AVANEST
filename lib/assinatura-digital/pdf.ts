// ===========================================================================
// O espaço da assinatura no PDF (PAdES), por atualização incremental
// ===========================================================================
// O PDF que o AVANEST gera (jsPDF, na tela de documentos e na ficha) entra
// aqui como está, e sai com uma ATUALIZAÇÃO INCREMENTAL no fim: um campo de
// assinatura, o dicionário /Sig com o espaço reservado (/Contents) e uma nova
// tabela de referências que aponta para a anterior. Os bytes do documento
// original não mudam — é isso que deixa o validador provar que o que o médico
// viu é o que ele assinou.
//
// O /ByteRange diz quais bytes a assinatura cobre: tudo, menos o próprio
// /Contents, onde ela mora. O resumo desses bytes vai no atributo
// message-digest do CMS (cms.ts).
//
// O QUE É ACEITO: PDF com tabela de referências clássica ("xref"), que é o que
// o jsPDF escreve. Tabela comprimida (xref stream), formulário já existente
// ou /Annots indireto na página são recusados com uma frase clara, e não
// "consertados" no escuro: uma assinatura num PDF mal entendido é pior que
// nenhuma.
// ===========================================================================

const latin1 = (bytes: Uint8Array) => Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString("latin1");
const bytesDe = (texto: string) => new Uint8Array(Buffer.from(texto, "latin1"));

export class PdfNaoSuportado extends Error {}

type Ref = { num: number; gen: number };
const textoRef = (r: Ref) => `${r.num} ${r.gen} R`;

function lerRef(dict: string, chave: string): Ref | null {
  const m = new RegExp(`/${chave}\\s+(\\d+)\\s+(\\d+)\\s+R`).exec(dict);
  return m ? { num: Number(m[1]), gen: Number(m[2]) } : null;
}

/** O dicionário do objeto, na revisão mais nova do arquivo (a última definição vale). */
function dicionarioDoObjeto(texto: string, ref: Ref): string {
  const marca = new RegExp(`(?:^|[^0-9])${ref.num}\\s+${ref.gen}\\s+obj\\b`, "g");
  let ultimo = -1;
  for (let m = marca.exec(texto); m; m = marca.exec(texto)) ultimo = m.index + m[0].length;
  if (ultimo < 0) throw new PdfNaoSuportado(`O objeto ${ref.num} não foi encontrado no PDF.`);
  const fim = texto.indexOf("endobj", ultimo);
  const corpo = texto.slice(ultimo, fim).trim();
  if (!corpo.startsWith("<<") || /\bstream\b/.test(corpo)) {
    throw new PdfNaoSuportado(`O objeto ${ref.num} não é um dicionário simples.`);
  }
  return corpo;
}

/** Acrescenta entradas ao fim de um dicionário "<< ... >>". */
function comEntradas(dict: string, entradas: string): string {
  const fecho = dict.lastIndexOf(">>");
  return `${dict.slice(0, fecho).trimEnd()}\n${entradas}\n>>`;
}

function primeiraPagina(texto: string, paginas: Ref, profundidade = 0): Ref {
  if (profundidade > 16) throw new PdfNaoSuportado("A árvore de páginas do PDF é funda demais.");
  const dict = dicionarioDoObjeto(texto, paginas);
  const kids = /\/Kids\s*\[\s*(\d+)\s+(\d+)\s+R/.exec(dict);
  if (!kids) throw new PdfNaoSuportado("O PDF não tem páginas.");
  const filho = { num: Number(kids[1]), gen: Number(kids[2]) };
  return /\/Type\s*\/Pages\b/.test(dicionarioDoObjeto(texto, filho))
    ? primeiraPagina(texto, filho, profundidade + 1)
    : filho;
}

/** Texto do PDF em UTF-16BE, para nome e motivo com acento. */
function textoPdf(s: string): string {
  let hex = "FEFF";
  for (const ch of s) {
    const cp = ch.codePointAt(0) ?? 0;
    const unidades = cp > 0xffff ? [0xd800 + ((cp - 0x10000) >> 10), 0xdc00 + ((cp - 0x10000) & 0x3ff)] : [cp];
    for (const u of unidades) hex += u.toString(16).toUpperCase().padStart(4, "0");
  }
  return `<${hex}>`;
}

/** D:AAAAMMDDHHmmSS+00'00' — o horário da assinatura, em UTC. */
function dataPdf(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `D:${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}`
    + `${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}+00'00'`;
}

export type PdfPreparado = {
  /** O PDF com a atualização incremental e o /Contents ainda zerado. */
  pdf: Uint8Array;
  byteRange: [number, number, number, number];
  /** Bytes reservados para o CMS (o /Contents tem o dobro em hexadecimal). */
  espaco: number;
};

export type OpcoesDoEspaco = {
  /** Nome do titular, para o leitor de PDF mostrar. */
  nome: string;
  /** Por que assinou, por exemplo "Avaliação pré-anestésica". */
  motivo: string;
  quando: Date;
  /** Bytes reservados ao CMS. 24 KB cabem certificado, cadeia e atributos com folga. */
  espaco?: number;
};

const LARGURA_DO_NUMERO = 10;
const BYTE_RANGE_VAZIO = `[0 ${"0".repeat(LARGURA_DO_NUMERO)} ${"0".repeat(LARGURA_DO_NUMERO)} ${"0".repeat(LARGURA_DO_NUMERO)}]`;

export function prepararPdf(original: Uint8Array, o: OpcoesDoEspaco): PdfPreparado {
  const espaco = o.espaco ?? 24 * 1024;
  const texto = latin1(original);
  if (!texto.startsWith("%PDF-")) throw new PdfNaoSuportado("O arquivo não é um PDF.");

  const posStartxref = texto.lastIndexOf("startxref");
  const xrefAnterior = Number(/startxref\s+(\d+)/.exec(texto.slice(posStartxref))?.[1]);
  if (!Number.isFinite(xrefAnterior) || !texto.startsWith("xref", xrefAnterior)) {
    throw new PdfNaoSuportado("O PDF usa tabela de referências comprimida, que ainda não é aceita.");
  }
  const posTrailer = texto.lastIndexOf("trailer", posStartxref);
  const trailer = texto.slice(posTrailer, posStartxref);
  const tamanho = Number(/\/Size\s+(\d+)/.exec(trailer)?.[1]);
  const raiz = lerRef(trailer, "Root");
  const info = lerRef(trailer, "Info");
  const id = /\/ID\s*(\[[^\]]*\])/.exec(trailer)?.[1];
  if (!Number.isFinite(tamanho) || !raiz) throw new PdfNaoSuportado("O trailer do PDF está incompleto.");

  const catalogo = dicionarioDoObjeto(texto, raiz);
  if (/\/AcroForm\b/.test(catalogo)) throw new PdfNaoSuportado("O PDF já tem formulário; ainda não é aceito.");
  const paginas = lerRef(catalogo, "Pages");
  if (!paginas) throw new PdfNaoSuportado("O PDF não diz onde estão as páginas.");
  const pagina = primeiraPagina(texto, paginas);
  const dictPagina = dicionarioDoObjeto(texto, pagina);

  const assinatura = { num: tamanho, gen: 0 };
  const campo = { num: tamanho + 1, gen: 0 };
  const formulario = { num: tamanho + 2, gen: 0 };

  let novaPagina: string;
  if (/\/Annots\s*\[/.test(dictPagina)) novaPagina = dictPagina.replace(/\/Annots\s*\[/, `/Annots [${textoRef(campo)} `);
  else if (/\/Annots\b/.test(dictPagina)) throw new PdfNaoSuportado("A página tem anotações num objeto à parte; ainda não é aceito.");
  else novaPagina = comEntradas(dictPagina, `/Annots [${textoRef(campo)}]`);

  const objetos: Array<[Ref, string]> = [
    [raiz, comEntradas(catalogo.replace(/\/Version\s*\/[\d.]+/, ""), `/AcroForm ${textoRef(formulario)}\n/Version /1.7`)],
    [pagina, novaPagina],
    [assinatura, [
      "<<", "/Type /Sig", "/Filter /Adobe.PPKLite", "/SubFilter /ETSI.CAdES.detached",
      `/ByteRange ${BYTE_RANGE_VAZIO}`,
      `/Contents <${"0".repeat(espaco * 2)}>`,
      `/M (${dataPdf(o.quando)})`,
      `/Name ${textoPdf(o.nome)}`,
      `/Reason ${textoPdf(o.motivo)}`,
      ">>",
    ].join("\n")],
    [campo, [
      "<<", "/Type /Annot", "/Subtype /Widget", "/FT /Sig", "/F 132", "/Rect [0 0 0 0]",
      `/T ${textoPdf("Assinatura AVANEST")}`, `/V ${textoRef(assinatura)}`, `/P ${textoRef(pagina)}`, ">>",
    ].join("\n")],
    [formulario, `<<\n/Fields [${textoRef(campo)}]\n/SigFlags 3\n>>`],
  ];

  let anexo = texto.endsWith("\n") ? "" : "\n";
  const deslocamentos = new Map<number, { pos: number; gen: number }>();
  for (const [ref, corpo] of objetos) {
    deslocamentos.set(ref.num, { pos: original.length + anexo.length, gen: ref.gen });
    anexo += `${ref.num} ${ref.gen} obj\n${corpo}\nendobj\n`;
  }

  const posXref = original.length + anexo.length;
  const numeros = [...deslocamentos.keys()].sort((a, b) => a - b);
  let xref = "xref\n";
  for (let i = 0; i < numeros.length;) {
    let j = i;
    while (j + 1 < numeros.length && numeros[j + 1] === numeros[j] + 1) j++;
    xref += `${numeros[i]} ${j - i + 1}\n`;
    for (let k = i; k <= j; k++) {
      const { pos, gen } = deslocamentos.get(numeros[k])!;
      xref += `${String(pos).padStart(10, "0")} ${String(gen).padStart(5, "0")} n\r\n`;
    }
    i = j + 1;
  }
  anexo += xref;
  anexo += "trailer\n<<\n"
    + `/Size ${tamanho + 3}\n/Root ${textoRef(raiz)}\n`
    + (info ? `/Info ${textoRef(info)}\n` : "")
    + (id ? `/ID ${id}\n` : "")
    + `/Prev ${xrefAnterior}\n>>\nstartxref\n${posXref}\n%%EOF\n`;

  const completo = texto + anexo;
  // Onde ficou o /Contents: os bytes entre "<" e ">" ficam de fora da assinatura.
  const marca = completo.indexOf("/Contents <", original.length);
  const inicio = marca + "/Contents ".length;
  const fim = inicio + espaco * 2 + 2;
  const byteRange: [number, number, number, number] = [0, inicio, fim, completo.length - fim];

  const posByteRange = completo.indexOf(`/ByteRange ${BYTE_RANGE_VAZIO}`, original.length) + "/ByteRange ".length;
  const preenchido = `[0 ${byteRange.slice(1).map((n) => String(n).padEnd(LARGURA_DO_NUMERO, " ")).join(" ")}]`;
  if (preenchido.length !== BYTE_RANGE_VAZIO.length) throw new Error("PDF grande demais para o /ByteRange.");
  const pdf = bytesDe(completo.slice(0, posByteRange) + preenchido + completo.slice(posByteRange + preenchido.length));
  return { pdf, byteRange, espaco };
}

/** Os bytes que a assinatura cobre: o arquivo inteiro, menos o /Contents. */
export function bytesAssinados(p: PdfPreparado): Uint8Array {
  const [a, b, c, d] = p.byteRange;
  const saida = new Uint8Array(b + d);
  saida.set(p.pdf.subarray(a, a + b), 0);
  saida.set(p.pdf.subarray(c, c + d), b);
  return saida;
}

/** Põe o CMS no espaço reservado. O tamanho do arquivo não muda. */
export function inserirAssinatura(p: PdfPreparado, cms: Uint8Array): Uint8Array {
  if (cms.length > p.espaco) throw new Error(`A assinatura (${cms.length} bytes) não cabe no espaço reservado (${p.espaco}).`);
  const hex = Buffer.from(cms).toString("hex").toUpperCase().padEnd(p.espaco * 2, "0");
  const saida = p.pdf.slice();
  saida.set(bytesDe(hex), p.byteRange[1] + 1);
  return saida;
}
