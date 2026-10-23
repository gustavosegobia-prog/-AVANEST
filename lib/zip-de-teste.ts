// Só para os testes: monta um .xlsx (um .zip) na memória, sem arquivo.

import { deflateRawSync } from "node:zlib";

/** Um .zip mínimo, com as entradas comprimidas (deflate), como o Excel grava. */
export function zip(arquivos: Record<string, string>): ArrayBuffer {
  const enc = new TextEncoder();
  const partes: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let deslocamento = 0;
  for (const [nome, conteudo] of Object.entries(arquivos)) {
    const n = enc.encode(nome);
    const dados = deflateRawSync(enc.encode(conteudo));
    const local = new Uint8Array(30 + n.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(8, 8, true);
    lv.setUint32(18, dados.length, true); lv.setUint16(26, n.length, true);
    local.set(n, 30);
    const c = new Uint8Array(46 + n.length);
    const cv = new DataView(c.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(10, 8, true); cv.setUint32(20, dados.length, true);
    cv.setUint16(28, n.length, true); cv.setUint32(42, deslocamento, true);
    c.set(n, 46);
    partes.push(local, dados);
    central.push(c);
    deslocamento += local.length + dados.length;
  }
  const tamCentral = central.reduce((s, c) => s + c.length, 0);
  const fim = new Uint8Array(22);
  const fv = new DataView(fim.buffer);
  fv.setUint32(0, 0x06054b50, true); fv.setUint16(8, central.length, true); fv.setUint16(10, central.length, true);
  fv.setUint32(12, tamCentral, true); fv.setUint32(16, deslocamento, true);
  const tudo = new Uint8Array(deslocamento + tamCentral + 22);
  let p = 0;
  for (const x of [...partes, ...central, fim]) { tudo.set(x, p); p += x.length; }
  return tudo.buffer;
}
