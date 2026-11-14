// A foto do mapa IMPRESSO, limpa antes da leitura (14/11/2026: "às vezes não
// tem um arquivo e tem impresso aqui, só tirar a foto").
//
// O print do WhatsApp é reto e nítido; a foto da folha, não: vem torta, com
// sombra, e a grade da tabela gruda nas letras. Testado numa réplica do mapa do
// grupo, com pacientes fictícios: com as linhas da tabela, o OCR perdia os
// horários e as salas; sem elas, lia os títulos das colunas inteiros — mas a
// folha 0,7° torta fazia o título da última coluna cair noutra linha. Então,
// antes da leitura:
//   1. a tinta, pelo limiar de cada vizinhança (a sombra não vira tinta);
//   2. a inclinação da folha, pelo ângulo em que as linhas de tinta ficam
//      mais retas (quem endireita a imagem é a tela, num canvas);
//   3. as linhas da tabela, apagadas: só um traço que atravessa um bom
//      pedaço da folha — nenhuma letra tem 4% da largura de comprimento.
// Tudo aqui é puro (números em, números fora), para o teste rodar sem tela.

/** A imagem em tons de cinza: 0 é preto, 255 é branco. */
export type Cinza = { w: number; h: number; px: Uint8ClampedArray | Uint8Array };

/** RGBA do canvas → cinza (a luminância de sempre). */
export function cinzaDoRgba(rgba: Uint8ClampedArray, w: number, h: number): Cinza {
  const px = new Uint8ClampedArray(w * h);
  for (let i = 0, j = 0; i < px.length; i++, j += 4) {
    px[i] = (rgba[j] * 299 + rgba[j + 1] * 587 + rgba[j + 2] * 114) / 1000;
  }
  return { w, h, px };
}

/**
 * A tinta (1) e o papel (0). O pixel é tinta quando é mais escuro que a média
 * da vizinhança por uma folga: a sombra da mão escurece a vizinhança inteira e
 * não vira tinta.
 */
export function tintaDe({ w, h, px }: Cinza, folga = 14): Uint8Array {
  const r = Math.max(8, Math.round(Math.max(w, h) / 120));
  // Soma acumulada: a média de qualquer janela em quatro contas.
  const soma = new Uint32Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let linha = 0;
    for (let x = 0; x < w; x++) {
      linha += px[y * w + x];
      soma[(y + 1) * (w + 1) + x + 1] = soma[y * (w + 1) + x + 1] + linha;
    }
  }
  const tinta = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1);
      const total = soma[y1 * (w + 1) + x1] - soma[y0 * (w + 1) + x1] - soma[y1 * (w + 1) + x0] + soma[y0 * (w + 1) + x0];
      const media = total / ((y1 - y0) * (x1 - x0));
      if (px[y * w + x] < media - folga) tinta[y * w + x] = 1;
    }
  }
  return tinta;
}

/**
 * Quantos graus a folha está torta: positivo quando as linhas descem para a
 * direita. É o ângulo em que a tinta, somada linha a linha, fica mais
 * concentrada — as bordas da tabela e as linhas de texto viram picos.
 * Procurado de −8° a 8°, num retrato reduzido da tinta (rápido no celular).
 */
export function inclinacao(tinta: Uint8Array, w: number, h: number): number {
  const f = Math.max(1, Math.ceil(Math.max(w, h) / 800));
  const pw = Math.ceil(w / f), ph = Math.ceil(h / f);
  const marcado = new Uint8Array(pw * ph);
  for (let y = 0; y < h; y++) {
    const base = Math.floor(y / f) * pw;
    for (let x = 0; x < w; x++) if (tinta[y * w + x]) marcado[base + Math.floor(x / f)] = 1;
  }
  const xs: number[] = [], ys: number[] = [];
  for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) if (marcado[y * pw + x]) { xs.push(x); ys.push(y); }
  if (xs.length < 50) return 0;
  const margem = Math.ceil(pw * Math.tan((9 * Math.PI) / 180));
  const caixas = new Int32Array(ph + 2 * margem + 2);
  const nota = (graus: number) => {
    const t = Math.tan((graus * Math.PI) / 180);
    caixas.fill(0);
    for (let i = 0; i < xs.length; i++) caixas[Math.round(ys[i] - xs[i] * t) + margem]++;
    let s = 0;
    for (let i = 0; i < caixas.length; i++) s += caixas[i] * caixas[i];
    return s;
  };
  let melhor = 0, maior = -1;
  for (let a = -8; a <= 8.0001; a += 0.1) { const n = nota(a); if (n > maior) { maior = n; melhor = a; } }
  const grosso = melhor;
  for (let a = grosso - 0.1; a <= grosso + 0.1001; a += 0.02) { const n = nota(a); if (n > maior) { maior = n; melhor = a; } }
  return Math.round(melhor * 100) / 100;
}

/**
 * As linhas da tabela: traço de tinta seguido por 4% da largura (na
 * horizontal) ou 4% da altura (na vertical), engrossado um pouco para levar o
 * borrado da borda junto. Letra nenhuma chega perto disso; a linha da tabela
 * atravessa a folha.
 */
export function linhasDaTabela(tinta: Uint8Array, w: number, h: number): Uint8Array {
  const minimoH = Math.max(40, Math.round(w * 0.04));
  const minimoV = Math.max(40, Math.round(h * 0.04));
  const d = Math.max(1, Math.round(Math.max(w, h) / 1300));
  const linha = new Uint8Array(w * h);
  const marcar = (x0: number, x1: number, y0: number, y1: number) => {
    for (let y = Math.max(0, y0); y <= Math.min(h - 1, y1); y++) {
      linha.fill(1, y * w + Math.max(0, x0), y * w + Math.min(w - 1, x1) + 1);
    }
  };
  for (let y = 0; y < h; y++) {
    let inicio = -1;
    for (let x = 0; x <= w; x++) {
      const t = x < w && tinta[y * w + x];
      if (t && inicio < 0) inicio = x;
      if (!t && inicio >= 0) { if (x - inicio >= minimoH) marcar(inicio - d, x - 1 + d, y - d, y + d); inicio = -1; }
    }
  }
  for (let x = 0; x < w; x++) {
    let inicio = -1;
    for (let y = 0; y <= h; y++) {
      const t = y < h && tinta[y * w + x];
      if (t && inicio < 0) inicio = y;
      if (!t && inicio >= 0) { if (y - inicio >= minimoV) marcar(x - d, x + d, inicio - d, y - 1 + d); inicio = -1; }
    }
  }
  return linha;
}

/** Pinta de branco o que é linha da tabela. Devolve quantos pixels apagou. */
export function apagarLinhas(img: Cinza, linha: Uint8Array): number {
  let n = 0;
  for (let i = 0; i < linha.length; i++) if (linha[i]) { img.px[i] = 255; n++; }
  return n;
}
