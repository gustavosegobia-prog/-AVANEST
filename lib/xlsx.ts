// Uma planilha do Excel de verdade, escrita à mão.
//
// POR QUE NÃO CSV. O CSV não carrega largura de coluna, e o Excel abre todas
// com a largura padrão de oito caracteres e meio. "29/08/2026" tem dez: a
// coluna de datas abre cheia de `########` — que é o Excel dizendo "não coube",
// e que quem recebe o arquivo lê como "veio quebrado". Numa planilha que vai
// por e-mail ao contador, isso é a primeira impressão.
//
// POR QUE NÃO UMA BIBLIOTECA. As que fazem isso pesam mais que o resto do
// sistema junto, e são carregadas no navegador de quem só quer baixar trinta
// linhas. O que este arquivo usa do formato é pouco: uma aba, larguras, texto e
// número. O resto do .xlsx — fórmulas, gráficos, temas — não entra.
//
// O .xlsx é um ZIP com alguns XML dentro. O ZIP aqui é SEM COMPRESSÃO
// (método 0, "stored"): comprimir exigiria deflate, e trinta linhas de texto
// não justificam. O Excel abre os dois do mesmo jeito.

export type Celula = string | number;

// ── XML ─────────────────────────────────────────────────────────────────────

/**
 * Escapa o que quebraria o XML.
 *
 * Os cinco de sempre, mais os caracteres de controle: um \x00 vindo de um campo
 * colado de outro sistema faz o Excel recusar o arquivo inteiro com "formato
 * não reconhecido", sem dizer qual célula.
 */
const xml = (v: string) =>
  String(v ?? "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&apos;");

/** A1, B1, ..., Z1, AA1. */
export function referencia(coluna: number, linha: number) {
  let nome = "";
  for (let n = coluna + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    nome = String.fromCharCode(65 + ((n - 1) % 26)) + nome;
  }
  return `${nome}${linha + 1}`;
}

/**
 * Quanto uma coluna precisa medir.
 *
 * A largura do Excel é contada em caracteres, e o valor tem de sair da célula
 * mais longa da coluna — não de um palpite. Dois de folga porque a fonte não é
 * de largura fixa e o "M" ocupa mais que a média; teto de 60 para um campo de
 * observação não empurrar as outras colunas para fora da tela.
 */
export function larguraDaColuna(linhas: Celula[][], coluna: number) {
  let maior = 8;
  for (const linha of linhas) {
    const valor = linha[coluna];
    if (valor === undefined || valor === null) continue;
    maior = Math.max(maior, String(valor).length);
  }
  return Math.min(60, maior + 2);
}

function folha(linhas: Celula[][]) {
  const colunas = Math.max(0, ...linhas.map((l) => l.length));
  const larguras = Array.from({ length: colunas }, (_, c) =>
    `<col min="${c + 1}" max="${c + 1}" width="${larguraDaColuna(linhas, c)}" customWidth="1"/>`).join("");

  const corpo = linhas.map((linha, l) => {
    const celulas = linha.map((valor, c) => {
      const ref = referencia(c, l);
      // Número vai como número: é o que deixa o contador somar a coluna e o que
      // faz o Excel alinhar à direita sozinho. Texto vai como `inlineStr`, que
      // dispensa a tabela de strings compartilhadas — um arquivo a menos no zip
      // e uma indireção a menos para dar errado.
      return typeof valor === "number" && Number.isFinite(valor)
        ? `<c r="${ref}"><v>${valor}</v></c>`
        : `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xml(String(valor ?? ""))}</t></is></c>`;
    }).join("");
    return `<row r="${l + 1}">${celulas}</row>`;
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
    + `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`
    + `<cols>${larguras}</cols><sheetData>${corpo}</sheetData></worksheet>`;
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
  + `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
  + `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>`
  + `<Default Extension="xml" ContentType="application/xml"/>`
  + `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>`
  + `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
  + `</Types>`;

const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
  + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
  + `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>`
  + `</Relationships>`;

const RELS_WORKBOOK = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
  + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
  + `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>`
  + `</Relationships>`;

/** O nome da aba. O Excel recusa mais de 31 caracteres e os sete proibidos. */
export function nomeDaAba(bruto: string) {
  const limpo = bruto.replace(/[\\/*?:[\]]/g, " ").trim().slice(0, 31);
  return limpo || "Planilha";
}

const pasta = (aba: string) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
  + `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"`
  + ` xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">`
  + `<sheets><sheet name="${xml(aba)}" sheetId="1" r:id="rId1"/></sheets></workbook>`;

// ── ZIP ─────────────────────────────────────────────────────────────────────

/** A tabela do CRC-32, calculada uma vez. É o que o ZIP usa para conferir cada
 *  arquivo — errar aqui faz o Excel dizer que a planilha está corrompida. */
const TABELA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes: Uint8Array) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = TABELA_CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

type Arquivo = { nome: string; dados: Uint8Array; crc: number };

function escreverU32(destino: number[], valor: number) {
  destino.push(valor & 0xff, (valor >>> 8) & 0xff, (valor >>> 16) & 0xff, (valor >>> 24) & 0xff);
}
function escreverU16(destino: number[], valor: number) {
  destino.push(valor & 0xff, (valor >>> 8) & 0xff);
}

/**
 * Monta o ZIP.
 *
 * Sem data nos arquivos, de propósito: a mesma planilha gerada duas vezes sai
 * byte a byte igual, o que torna o resultado testável. O Excel não usa essa
 * data para nada — ela aparece só nas propriedades do arquivo.
 */
function zipar(arquivos: Arquivo[]) {
  const saida: number[] = [];
  const central: number[] = [];
  const codificador = new TextEncoder();

  for (const arquivo of arquivos) {
    const nome = codificador.encode(arquivo.nome);
    const inicio = saida.length;

    escreverU32(saida, 0x04034b50);          // assinatura do cabeçalho local
    escreverU16(saida, 20);                  // versão mínima
    escreverU16(saida, 0);                   // sem sinalizadores
    escreverU16(saida, 0);                   // método 0: sem compressão
    escreverU16(saida, 0); escreverU16(saida, 0); // hora e data zeradas
    escreverU32(saida, arquivo.crc);
    escreverU32(saida, arquivo.dados.length);
    escreverU32(saida, arquivo.dados.length);
    escreverU16(saida, nome.length);
    escreverU16(saida, 0);                   // sem campo extra
    saida.push(...nome, ...arquivo.dados);

    escreverU32(central, 0x02014b50);        // assinatura do diretório central
    escreverU16(central, 20); escreverU16(central, 20);
    escreverU16(central, 0); escreverU16(central, 0);
    escreverU16(central, 0); escreverU16(central, 0);
    escreverU32(central, arquivo.crc);
    escreverU32(central, arquivo.dados.length);
    escreverU32(central, arquivo.dados.length);
    escreverU16(central, nome.length);
    escreverU16(central, 0); escreverU16(central, 0);
    escreverU16(central, 0); escreverU16(central, 0);
    escreverU32(central, 0);
    escreverU32(central, inicio);            // onde começa o cabeçalho local
    central.push(...nome);
  }

  const inicioDoCentral = saida.length;
  saida.push(...central);
  escreverU32(saida, 0x06054b50);            // fim do diretório central
  escreverU16(saida, 0); escreverU16(saida, 0);
  escreverU16(saida, arquivos.length); escreverU16(saida, arquivos.length);
  escreverU32(saida, central.length);
  escreverU32(saida, inicioDoCentral);
  escreverU16(saida, 0);                     // sem comentário

  return new Uint8Array(saida);
}

/** A planilha pronta, em bytes. */
export function planilhaXLSX(linhas: Celula[][], nomeAba = "Planilha") {
  const codificador = new TextEncoder();
  const parte = (nome: string, texto: string): Arquivo => {
    const dados = codificador.encode(texto);
    return { nome, dados, crc: crc32(dados) };
  };
  return zipar([
    parte("[Content_Types].xml", CONTENT_TYPES),
    parte("_rels/.rels", RELS),
    parte("xl/workbook.xml", pasta(nomeDaAba(nomeAba))),
    parte("xl/_rels/workbook.xml.rels", RELS_WORKBOOK),
    parte("xl/worksheets/sheet1.xml", folha(linhas)),
  ]);
}

/**
 * Manda o arquivo para a pasta de downloads. Só roda no navegador.
 *
 * `revokeObjectURL` no fim porque a URL do Blob segura o conteúdo na memória da
 * aba até ser solta — uma planilha por mês numa sessão longa vira lixo que
 * ninguém vê.
 */
export function baixarXLSX(nome: string, linhas: Celula[][], nomeAba?: string) {
  const bytes = planilhaXLSX(linhas, nomeAba);
  const url = URL.createObjectURL(new Blob([bytes as unknown as BlobPart], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}
