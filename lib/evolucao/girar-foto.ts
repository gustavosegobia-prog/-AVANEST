// A foto de lado ou de cabeça para baixo, endireitada antes de ler — no aparelho.
//
// Com o celular deitado, a foto chega girada, e o OCR não lê nada de lado
// (11/11/2026: a avaliação de outro hospital e a tela do monitor de outro
// hospital). Duas camadas:
//
// 1. a orientação que o próprio celular grava na foto (EXIF) é aplicada ao
//    abrir — o iPhone guarda a foto "deitada" e anota de que lado ela fica;
// 2. o que ainda vier de lado se acha pela direção das linhas de texto
//    (imagem-da-ficha.ts, direcaoDoTexto), e o lado certo, por uma leitura
//    rápida numa miniatura: no giro certo ela acha dezenas de palavras; de
//    lado, quase nenhuma.

import { binarizar, cinzaDoRgba, direcaoDoTexto } from "./imagem-da-ficha";

export type Giro = 0 | 90 | 180 | 270;
type Fonte = CanvasImageSource & { width: number; height: number };

/** A foto como o celular a mostra: a orientação gravada nela aplicada. */
export function abrirFoto(arquivo: Blob): Promise<ImageBitmap> {
  return createImageBitmap(arquivo, { imageOrientation: "from-image" });
}

/** A foto num canvas, na escala pedida e girada no sentido horário. */
export function desenharGirada(fonte: Fonte, escala: number, giro: Giro): HTMLCanvasElement {
  const w = Math.round(fonte.width * escala), h = Math.round(fonte.height * escala);
  const deitado = giro === 90 || giro === 270;
  const canvas = document.createElement("canvas");
  canvas.width = deitado ? h : w;
  canvas.height = deitado ? w : h;
  const g = canvas.getContext("2d", { willReadFrequently: true });
  if (!g) throw new Error("Sem canvas");
  g.imageSmoothingQuality = "high";
  if (giro === 90) { g.translate(canvas.width, 0); g.rotate(Math.PI / 2); }
  if (giro === 180) { g.translate(canvas.width, canvas.height); g.rotate(Math.PI); }
  if (giro === 270) { g.translate(0, canvas.height); g.rotate(-Math.PI / 2); }
  g.drawImage(fonte, 0, 0, w, h);
  return canvas;
}

/** A direção das linhas de texto, numa miniatura de 900 pontos. */
export function direcaoDaFoto(fonte: Fonte): "horizontal" | "vertical" | "?" {
  const mini = desenharGirada(fonte, Math.min(1, 900 / Math.max(fonte.width, fonte.height)), 0);
  const g = mini.getContext("2d", { willReadFrequently: true })!;
  const { data } = g.getImageData(0, 0, mini.width, mini.height);
  return direcaoDoTexto(binarizar(cinzaDoRgba(data, mini.width, mini.height)));
}

/** Uma miniatura (1.200 pontos) no giro pedido, para a leitura rápida. */
export const miniatura = (fonte: Fonte, giro: Giro) =>
  desenharGirada(fonte, Math.min(1, 1200 / Math.max(fonte.width, fonte.height)), giro);

/** O giro, entre os candidatos, em que a leitura rápida acha mais texto. */
export async function melhorGiro(candidatos: Giro[], pontuar: (giro: Giro) => Promise<number>): Promise<Giro> {
  let melhor = candidatos[0], maior = -1;
  for (const g of candidatos) {
    const p = await pontuar(g);
    if (p > maior) { melhor = g; maior = p; }
  }
  return melhor;
}
