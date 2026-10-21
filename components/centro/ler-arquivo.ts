// O arquivo do mapa, em grade — no próprio aparelho. Nada sobe para servidor
// nenhum: a planilha, o PDF e a foto são lidos aqui e só os pacientes que o
// enfermeiro confirmar vão para o banco.

import type { PSM as ModoDaPagina } from "tesseract.js";
import { gradeDoCsv, gradeDePalavras, juntarLeituras, type Palavra, type PalavraLida } from "@/lib/centro-importar";
import { gradeDoXlsx } from "@/lib/xlsx-leitura";

const extensao = (f: File) => f.name.toLowerCase().split(".").pop() ?? "";

export const TIPOS_ACEITOS = ".xlsx,.csv,.pdf,image/*";

export async function gradeDoArquivo(arquivo: File, avancar: (fracao: number) => void = () => {}): Promise<string[][]> {
  const ext = extensao(arquivo);
  if (ext === "xlsx") return gradeDoXlsx(await arquivo.arrayBuffer());
  if (ext === "xls") throw new Error("Esta é a planilha antiga (.xls). No Excel, use “Salvar como” .xlsx e envie de novo.");
  if (ext === "csv" || arquivo.type === "text/csv") return gradeDoCsv(await arquivo.text());
  if (ext === "pdf" || arquivo.type === "application/pdf") return exigirTabela(await palavrasDoPdf(arquivo));
  if (arquivo.type.startsWith("image/")) return exigirTabela(await palavrasDaFoto(arquivo, avancar));
  throw new Error("Envie a planilha do mapa (.xlsx), o PDF ou a foto.");
}

function exigirTabela(palavras: Palavra[]): string[][] {
  const grade = gradeDePalavras(palavras);
  if (!grade) throw new Error("Não achei a tabela do mapa: as colunas HORA, PACIENTE, PROCEDIMENTO… precisam aparecer no arquivo.");
  return grade;
}

/** O PDF salvo do Excel tem texto de verdade: cada pedaço com a sua posição. */
async function palavrasDoPdf(arquivo: File): Promise<Palavra[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const tarefa = pdfjs.getDocument({ data: await arquivo.arrayBuffer() });
  try {
    const documento = await tarefa.promise;
    const palavras: Palavra[] = [];
    let deslocamento = 0;
    for (let n = 1; n <= documento.numPages; n++) {
      const pagina = await documento.getPage(n);
      const { height } = pagina.getViewport({ scale: 1 });
      const conteudo = await pagina.getTextContent();
      for (const item of conteudo.items) {
        if (!("str" in item) || !item.str.trim()) continue;
        const [, , , d, x, y] = item.transform as number[];
        const altura = item.height || Math.abs(d) || 10;
        // O PDF conta a altura de baixo para cima; a grade, de cima para baixo.
        palavras.push({ t: item.str, x0: x, x1: x + item.width, y0: deslocamento + height - y - altura, y1: deslocamento + height - y });
      }
      deslocamento += height;
    }
    if (!palavras.length) throw new Error("Este PDF é uma imagem, sem texto. Envie a planilha (.xlsx) ou uma foto do mapa.");
    return palavras;
  } finally {
    await tarefa.destroy();
  }
}

/**
 * A imagem ampliada para uns 2.600 px de largura antes da leitura. O print do
 * WhatsApp chega com 1.280 px, e o título das colunas fica com letra miúda
 * demais: lido assim, o OCR perdia metade dos títulos. Testado numa réplica do
 * mapa do grupo, com pacientes fictícios: em 2× lê tudo, e em 3× piora — a letra em negrito engorda e as linhas
 * da tabela grudam nela. Por isso o teto.
 */
async function ampliada(arquivo: File): Promise<HTMLCanvasElement | File> {
  try {
    const bitmap = await createImageBitmap(arquivo);
    const k = Math.min(2.4, Math.max(1, 2600 / bitmap.width));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * k);
    canvas.height = Math.round(bitmap.height * k);
    const g = canvas.getContext("2d");
    if (!g) return arquivo;
    g.imageSmoothingQuality = "high";
    g.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return canvas;
  } catch {
    return arquivo;
  }
}

/**
 * A foto ou o print do mapa: o OCR do aparelho, com a posição de cada palavra.
 * Lê duas vezes e junta (`juntarLeituras`): o modo automático acerta a sala e
 * a idade, o de texto esparso acerta a cirurgia escrita em duas linhas.
 */
async function palavrasDaFoto(arquivo: File, avancar: (fracao: number) => void): Promise<Palavra[]> {
  const { createWorker, PSM } = await import("tesseract.js");
  let leitura = 0;
  const worker = await createWorker("por", undefined, {
    logger: (m: { status?: string; progress?: number }) => {
      if (m.status === "recognizing text" && m.progress != null) avancar((leitura + m.progress) / 2);
    },
  });
  try {
    const imagem = await ampliada(arquivo);
    const ler = async (modo: ModoDaPagina) => {
      await worker.setParameters({ tessedit_pageseg_mode: modo });
      const { data } = await worker.recognize(imagem, {}, { blocks: true });
      const palavras: PalavraLida[] = [];
      for (const bloco of data.blocks ?? []) {
        for (const par of bloco.paragraphs) {
          for (const linha of par.lines) {
            for (const w of linha.words) {
              if (w.confidence < 20 || !w.text.trim()) continue;
              palavras.push({ t: w.text, x0: w.bbox.x0, x1: w.bbox.x1, y0: w.bbox.y0, y1: w.bbox.y1, c: w.confidence });
            }
          }
        }
      }
      return palavras;
    };
    const automatica = await ler(PSM.AUTO);
    leitura = 1;
    return juntarLeituras(automatica, await ler(PSM.SPARSE_TEXT));
  } finally {
    await worker.terminate();
  }
}
