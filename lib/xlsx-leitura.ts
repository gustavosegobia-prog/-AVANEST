// Ler uma planilha .xlsx no navegador, sem biblioteca.
//
// O .xlsx é um .zip com XML dentro. Para tirar a tabela da primeira aba bastam
// três arquivos dele: a lista de abas (xl/workbook.xml e o seu .rels), os
// textos compartilhados (xl/sharedStrings.xml) e a aba em si. O zip é aberto à
// mão e descomprimido com o DecompressionStream do próprio navegador — o mesmo
// motivo do PDF da escala (lib/pdf.ts): o aplicativo abre no 4G do corredor, e
// uma biblioteca de planilha pesa mais que a tela inteira.
//
// Lê o que a planilha MOSTRA como texto. Número sai como está gravado
// ("0.3125" para 07:30, "46316" para uma data): quem interpreta é quem sabe o
// que a coluna quer dizer (lib/centro-importar.ts).

type Entrada = { nome: string; metodo: number; inicio: number; tamanho: number };

function entradasDoZip(b: Uint8Array): Map<string, Entrada> {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  // O fim do diretório central: assinatura 0x06054b50, nos últimos 64 KB.
  let fim = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) {
    if (v.getUint32(i, true) === 0x06054b50) { fim = i; break; }
  }
  if (fim < 0) throw new Error("O arquivo não é uma planilha .xlsx.");
  const total = v.getUint16(fim + 10, true);
  let p = v.getUint32(fim + 16, true);
  const decod = new TextDecoder();
  const entradas = new Map<string, Entrada>();
  for (let k = 0; k < total; k++) {
    if (v.getUint32(p, true) !== 0x02014b50) break;
    const metodo = v.getUint16(p + 10, true);
    const comprimido = v.getUint32(p + 20, true);
    const nLen = v.getUint16(p + 28, true), eLen = v.getUint16(p + 30, true), cLen = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    const nome = decod.decode(b.subarray(p + 46, p + 46 + nLen));
    // O cabeçalho local tem o próprio tamanho de nome e de extra.
    const inicio = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
    entradas.set(nome, { nome, metodo, inicio, tamanho: comprimido });
    p += 46 + nLen + eLen + cLen;
  }
  return entradas;
}

async function inflar(dados: Uint8Array): Promise<Uint8Array> {
  const fluxo = new Blob([dados as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(fluxo).arrayBuffer());
}

async function lerEntrada(b: Uint8Array, e: Entrada): Promise<string> {
  const bruto = b.subarray(e.inicio, e.inicio + e.tamanho);
  const dados = e.metodo === 0 ? bruto : e.metodo === 8 ? await inflar(bruto) : null;
  if (!dados) throw new Error("A planilha usa uma compressão que não dá para ler aqui.");
  return new TextDecoder().decode(dados);
}

const ENTIDADES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
export const desescapar = (s: string) => s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, c: string) =>
  c[0] === "#" ? String.fromCodePoint(c[1].toLowerCase() === "x" ? parseInt(c.slice(2), 16) : Number(c.slice(1))) : ENTIDADES[c] ?? m);

/** O texto de um nó <si> ou <is>: os <t>, em ordem — o texto com formatação vem picado em <r>. */
const textoDosT = (xml: string) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => desescapar(m[1])).join("");

export function textosCompartilhados(xml: string): string[] {
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textoDosT(m[1]));
}

/** "AB12" → coluna 27 (base 0), linha 11 (base 0). */
export function posicaoDaCelula(ref: string): { linha: number; coluna: number } | null {
  const m = ref.match(/^([A-Z]+)(\d+)$/);
  if (!m) return null;
  let coluna = 0;
  for (const ch of m[1]) coluna = coluna * 26 + (ch.charCodeAt(0) - 64);
  return { linha: Number(m[2]) - 1, coluna: coluna - 1 };
}

/** A aba em grade de textos. */
export function gradeDaAba(xml: string, compartilhados: string[]): string[][] {
  const grade: string[][] = [];
  for (const m of xml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const attrs = m[1];
    const corpo = m[2] ?? "";
    const ref = attrs.match(/\br="([A-Z]+\d+)"/)?.[1];
    const pos = ref ? posicaoDaCelula(ref) : null;
    if (!pos) continue;
    const tipo = attrs.match(/\bt="(\w+)"/)?.[1];
    const valor = corpo.match(/<v>([\s\S]*?)<\/v>/)?.[1];
    let texto = "";
    if (tipo === "s" && valor != null) texto = compartilhados[Number(valor)] ?? "";
    else if (tipo === "inlineStr") texto = textoDosT(corpo);
    else if (valor != null) texto = desescapar(valor);
    if (!texto) continue;
    while (grade.length <= pos.linha) grade.push([]);
    const linha = grade[pos.linha];
    while (linha.length < pos.coluna) linha.push("");
    linha[pos.coluna] = texto;
  }
  return grade.map((l) => l.map((c) => c ?? ""));
}

/** A primeira aba da planilha, em grade de textos. */
export async function gradeDoXlsx(arquivo: ArrayBuffer): Promise<string[][]> {
  const b = new Uint8Array(arquivo);
  const zip = entradasDoZip(b);
  const ler = async (nome: string) => { const e = zip.get(nome); return e ? lerEntrada(b, e) : ""; };
  // A primeira aba é a primeira da lista do livro, e não o "sheet1.xml".
  let caminho = "xl/worksheets/sheet1.xml";
  const livro = await ler("xl/workbook.xml");
  const rid = livro.match(/<sheet\b[^>]*\br:id="([^"]+)"/)?.[1];
  if (rid) {
    const rels = await ler("xl/_rels/workbook.xml.rels");
    const alvo = [...rels.matchAll(/<Relationship\b([^>]*)\/?>/g)]
      .map((m) => m[1]).find((a) => a.includes(`Id="${rid}"`))?.match(/Target="([^"]+)"/)?.[1];
    if (alvo) caminho = alvo.startsWith("/") ? alvo.slice(1) : `xl/${alvo.replace(/^\.\//, "")}`;
  }
  const aba = await ler(caminho);
  if (!aba) throw new Error("Não achei a primeira aba da planilha.");
  return gradeDaAba(aba, textosCompartilhados(await ler("xl/sharedStrings.xml")));
}
