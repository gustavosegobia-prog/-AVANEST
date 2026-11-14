// O arquivo do mapa, em grade — no próprio aparelho. Nada sobe para servidor
// nenhum: a planilha, o PDF e a foto são lidos aqui e só os pacientes que o
// enfermeiro confirmar vão para o banco.

import type { PSM as ModoDaPagina } from "tesseract.js";
import { gradeDoCsv, gradeDaFoto, gradeDePalavras, gradeSemTitulos, juntarLeituras, type Palavra, type PalavraLida } from "@/lib/centro-importar";
import { apagarLinhas, cinzaDoRgba, inclinacao, linhasDaTabela, tintaDe } from "@/lib/centro-foto";
import { gradeDoXlsx } from "@/lib/xlsx-leitura";

const extensao = (f: File) => f.name.toLowerCase().split(".").pop() ?? "";

export const TIPOS_ACEITOS = ".xlsx,.csv,.pdf,image/*";

export async function gradeDoArquivo(arquivo: File, avancar: (fracao: number) => void = () => {}): Promise<string[][]> {
  const ext = extensao(arquivo);
  if (ext === "xlsx") return gradeDoXlsx(await arquivo.arrayBuffer());
  if (ext === "xls") throw new Error("Esta é a planilha antiga (.xls). No Excel, use “Salvar como” .xlsx e envie de novo.");
  if (ext === "csv" || arquivo.type === "text/csv") return gradeDoCsv(await arquivo.text());
  if (ext === "pdf" || arquivo.type === "application/pdf") {
    const palavras = await palavrasDoPdf(arquivo);
    return exigirTabela(gradeDePalavras(palavras) ?? gradeSemTitulos(palavras));
  }
  if (arquivo.type.startsWith("image/") || /^(jpe?g|png|heic|heif|webp)$/.test(ext)) return gradeDaImagem(arquivo, avancar);
  throw new Error("Envie a planilha do mapa (.xlsx), o PDF ou a foto.");
}

const SEM_TABELA = "Não achei a tabela do mapa: as colunas HORA, PACIENTE, PROCEDIMENTO… precisam aparecer no arquivo.";

function exigirTabela(grade: string[][] | null): string[][] {
  if (!grade) throw new Error(SEM_TABELA);
  return grade;
}

/**
 * A foto: em pé primeiro; sem tabela, deitada para um lado e para o outro.
 * Quem fotografa a folha larga sobre a mesa vira o celular, e o texto sai
 * deitado — e texto deitado não se lê. As outras duas leituras só rodam quando
 * a primeira não achou nada.
 */
async function gradeDaImagem(arquivo: File, avancar: (fracao: number) => void): Promise<string[][]> {
  let lida = false;
  for (const giro of [0, 90, 270] as const) {
    const imagem = await preparada(arquivo, giro);
    if (giro && !(imagem instanceof HTMLCanvasElement)) break;
    const palavras = await palavrasDaFoto(imagem, giro ? () => {} : avancar);
    if (palavras.length) lida = true;
    const grade = gradeDaFoto(palavras);
    if (grade) return grade;
  }
  throw new Error(lida
    ? SEM_TABELA
    : "A foto não gerou texto legível. Fotografe a folha inteira, de frente, com boa luz e sem sombra.");
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
 * A imagem pronta para a leitura (14/11/2026: a foto do mapa IMPRESSO).
 *
 * O tamanho: o print do WhatsApp (estreito, uns 1.280 px) vai a uns 2.600 px —
 * em 2× lia tudo, em 3× a letra em negrito engordava. A foto (larga) vai a uns
 * 3.400 px: os títulos e as células da folha fotografada são miúdos, e na
 * réplica do mapa impresso, com pacientes fictícios, a foto reduzida do
 * WhatsApp só leu todas as salas e idades nesse tamanho. A foto da câmera
 * (4.032 px) fica como está; maior que 4.200, reduz — o celular não aguenta.
 *
 * Depois, a folha endireitada e as linhas da tabela apagadas (lib/centro-foto.ts).
 * `giro` vira a imagem 90° ou 270° para a foto tirada com o texto deitado.
 */
async function preparada(arquivo: File, giro: 0 | 90 | 270 = 0): Promise<HTMLCanvasElement | File> {
  try {
    const bitmap = await createImageBitmap(arquivo, { imageOrientation: "from-image" });
    const larguraDoTexto = giro ? bitmap.height : bitmap.width;
    const alvo = larguraDoTexto >= 1600 ? 3400 : 2600;
    const k = Math.min(2.4, Math.max(Math.min(1, 4200 / larguraDoTexto), alvo / larguraDoTexto));
    const bw = Math.round(bitmap.width * k), bh = Math.round(bitmap.height * k);
    const [w, h] = giro ? [bh, bw] : [bw, bh];
    let canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    let g = canvas.getContext("2d", { willReadFrequently: true });
    if (!g) return arquivo;
    g.imageSmoothingQuality = "high";
    g.translate(w / 2, h / 2);
    g.rotate((giro * Math.PI) / 180);
    g.drawImage(bitmap, -bw / 2, -bh / 2, bw, bh);
    g.setTransform(1, 0, 0, 1, 0, 0);
    bitmap.close();

    // A folha torta: endireita pelo ângulo das linhas.
    let dados = g.getImageData(0, 0, w, h);
    const angulo = inclinacao(tintaDe(cinzaDoRgba(dados.data, w, h)), w, h);
    if (Math.abs(angulo) >= 0.15) {
      const reto = document.createElement("canvas");
      reto.width = w; reto.height = h;
      const r = reto.getContext("2d", { willReadFrequently: true });
      if (r) {
        r.fillStyle = "#fff";
        r.fillRect(0, 0, w, h);
        r.imageSmoothingQuality = "high";
        r.translate(w / 2, h / 2);
        r.rotate((-angulo * Math.PI) / 180);
        r.drawImage(canvas, -w / 2, -h / 2);
        r.setTransform(1, 0, 0, 1, 0, 0);
        canvas = reto; g = r;
        dados = g.getImageData(0, 0, w, h);
      }
    }

    // A grade da tabela, apagada: o que sobra é o texto.
    const cinza = cinzaDoRgba(dados.data, w, h);
    apagarLinhas(cinza, linhasDaTabela(tintaDe(cinza), w, h));
    for (let i = 0, j = 0; i < cinza.px.length; i++, j += 4) {
      dados.data[j] = dados.data[j + 1] = dados.data[j + 2] = cinza.px[i];
      dados.data[j + 3] = 255;
    }
    g.putImageData(dados, 0, 0);
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
async function palavrasDaFoto(imagem: HTMLCanvasElement | File, avancar: (fracao: number) => void): Promise<Palavra[]> {
  const { createWorker, PSM } = await import("tesseract.js");
  let leitura = 0;
  const worker = await createWorker("por", undefined, {
    logger: (m: { status?: string; progress?: number }) => {
      if (m.status === "recognizing text" && m.progress != null) avancar((leitura + m.progress) / 2);
    },
  });
  try {
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
