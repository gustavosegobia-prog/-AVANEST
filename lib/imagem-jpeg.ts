// O símbolo do hospital em JPEG, pronto para entrar no PDF da escala.
//
// O PDF desenhado à mão (lib/pdf.ts) só embute JPEG. O símbolo cadastrado
// costuma ser PNG, muitas vezes com fundo transparente — e transparente, no
// JPEG, vira PRETO. Por isso ele é pintado sobre branco num canvas antes.
//
// Roda no navegador, e ANTES do clique em imprimir: no iPhone o PDF sai pela
// folha de compartilhar, que só abre colada no toque. Esperar a rede depois do
// toque faria o compartilhamento ser recusado.

import type { ImagemJpeg } from "./pdf.ts";

/** Altura máxima em pixels: o símbolo sai com ~1 cm no papel; 240 px sobram. */
const ALTURA_MAXIMA = 240;

const jaCarregados = new Map<string, Promise<ImagemJpeg | null>>();

/**
 * `cinza` tira a cor: a folha em preto e branco existe porque a impressora do
 * centro cirúrgico raramente tem cor, e um símbolo vermelho ali sai borrado.
 */
export function imagemEmJpeg(url: string, cinza = false): Promise<ImagemJpeg | null> {
  if (!/^https?:\/\//i.test(url) || typeof document === "undefined") return Promise.resolve(null);
  const chave = `${cinza ? "cinza" : "cor"}:${url}`;
  let pedido = jaCarregados.get(chave);
  if (!pedido) {
    pedido = converter(url, cinza).catch(() => null);
    jaCarregados.set(chave, pedido);
  }
  return pedido;
}

async function converter(url: string, cinza: boolean): Promise<ImagemJpeg | null> {
  const resposta = await fetch(url, { mode: "cors" });
  if (!resposta.ok) return null;
  const bitmap = await createImageBitmap(await resposta.blob());
  const escala = Math.min(1, ALTURA_MAXIMA / bitmap.height);
  const largura = Math.max(1, Math.round(bitmap.width * escala));
  const altura = Math.max(1, Math.round(bitmap.height * escala));
  const canvas = document.createElement("canvas");
  canvas.width = largura; canvas.height = altura;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, largura, altura);
  ctx.drawImage(bitmap, 0, 0, largura, altura);
  bitmap.close();
  // Pixel a pixel, e não com `ctx.filter`: o Safari do iPhone ignora o filtro.
  if (cinza) {
    const px = ctx.getImageData(0, 0, largura, altura);
    const d = px.data;
    for (let i = 0; i < d.length; i += 4) {
      const y = Math.round(d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114);
      d[i] = d[i + 1] = d[i + 2] = y;
    }
    ctx.putImageData(px, 0, 0);
  }
  const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  // atob devolve exatamente o que montarPdf espera: um caractere por byte.
  return { bytes: atob(base64), largura, altura };
}
