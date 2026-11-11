// A foto (ou o PDF) da ficha pré-anestésica do hospital, lida NO APARELHO.
//
// Nada sobe: a imagem vai para um canvas, é preparada (imagem-da-ficha.ts) e
// lida pelo Tesseract do próprio navegador, como a foto do monitor e a do
// laudo — a promessa da página de privacidade ("a foto é lida no próprio
// aparelho e não é enviada"). Só o que o médico conferir vai para a ficha.

import { cinzaDoRgba, escalaDaFicha, prepararFicha } from "./imagem-da-ficha";
import { juntarComConfianca, lerFichaDoHospital, type FichaDoHospital, type PalavraComConfianca } from "./ficha-do-hospital";

type Trabalhador = Awaited<ReturnType<typeof import("tesseract.js")["createWorker"]>>;

async function palavrasDa(worker: Trabalhador, imagem: HTMLCanvasElement): Promise<PalavraComConfianca[]> {
  const { data } = await worker.recognize(imagem, {}, { blocks: true });
  const palavras: PalavraComConfianca[] = [];
  for (const bloco of data.blocks ?? []) {
    for (const par of bloco.paragraphs) {
      for (const linha of par.lines) {
        for (const w of linha.words) {
          if (w.text.trim()) palavras.push({ t: w.text, c: w.confidence, x0: w.bbox.x0, x1: w.bbox.x1, y0: w.bbox.y0, y1: w.bbox.y1 });
        }
      }
    }
  }
  return palavras;
}

/** A foto na escala de leitura, em preto e branco e sem as bordas das caixas. */
async function preparada(arquivo: Blob): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(arquivo);
  const k = escalaDaFicha(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * k);
  canvas.height = Math.round(bitmap.height * k);
  const g = canvas.getContext("2d", { willReadFrequently: true });
  if (!g) throw new Error("Sem canvas");
  g.imageSmoothingQuality = "high";
  g.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const dados = g.getImageData(0, 0, canvas.width, canvas.height);
  const pronta = prepararFicha(cinzaDoRgba(dados.data, canvas.width, canvas.height));
  for (let i = 0; i < pronta.pontos.length; i++) {
    const v = pronta.pontos[i];
    dados.data[i * 4] = v; dados.data[i * 4 + 1] = v; dados.data[i * 4 + 2] = v; dados.data[i * 4 + 3] = 255;
  }
  g.putImageData(dados, 0, 0);
  return canvas;
}

/** O PDF do sistema do hospital tem texto de verdade: cada pedaço com a sua posição. */
async function palavrasDoPdf(arquivo: File): Promise<PalavraComConfianca[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const tarefa = pdfjs.getDocument({ data: await arquivo.arrayBuffer() });
  try {
    const documento = await tarefa.promise;
    const pagina = await documento.getPage(1);
    const { height } = pagina.getViewport({ scale: 1 });
    const conteudo = await pagina.getTextContent();
    const palavras: PalavraComConfianca[] = [];
    for (const item of conteudo.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      const [, , , d, x, y] = item.transform as number[];
      const altura = item.height || Math.abs(d) || 10;
      // Um pedaço do PDF pode ter várias palavras: cada uma com a sua parte da largura.
      const pedacos = item.str.split(/(\s+)/);
      const porLetra = item.width / Math.max(1, item.str.length);
      let pos = 0;
      for (const p of pedacos) {
        if (p.trim()) palavras.push({ t: p, c: 100, x0: x + pos * porLetra, x1: x + (pos + p.length) * porLetra, y0: height - y - altura, y1: height - y });
        pos += p.length;
      }
    }
    return palavras;
  } finally {
    await tarefa.destroy();
  }
}

/**
 * Lê a ficha do hospital. `avancar` recebe de 0 a 1, para a barra de
 * "Lendo a ficha…". Duas leituras da mesma imagem (automática e texto
 * esparso): cada uma acha respostas que a outra perde.
 */
export async function lerFotoDaFicha(arquivo: File, avancar: (fracao: number) => void = () => {}): Promise<FichaDoHospital> {
  if (arquivo.type === "application/pdf" || /\.pdf$/i.test(arquivo.name)) {
    const palavras = await palavrasDoPdf(arquivo);
    if (palavras.length) return lerFichaDoHospital(palavras);
    // PDF que é só imagem (escaneado): não há texto para ler.
    throw new Error("PDF sem texto");
  }
  avancar(0.05);
  const imagem = await preparada(arquivo);
  avancar(0.12);
  const { createWorker, PSM } = await import("tesseract.js");
  let leitura = 0;
  const worker = await createWorker("por", undefined, {
    logger: (m: { status?: string; progress?: number }) => {
      if (m.status === "recognizing text" && m.progress != null) avancar(0.12 + 0.88 * ((leitura + m.progress) / 2));
    },
  });
  try {
    await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
    const automatica = await palavrasDa(worker, imagem);
    leitura = 1;
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
    const esparsa = await palavrasDa(worker, imagem);
    return lerFichaDoHospital(juntarComConfianca(automatica, esparsa));
  } finally {
    await worker.terminate();
  }
}
