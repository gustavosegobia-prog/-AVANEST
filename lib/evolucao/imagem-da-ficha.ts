// A foto da ficha impressa, preparada para o OCR — no próprio aparelho.
//
// A ficha de avaliação pré-anestésica que o sistema do hospital imprime tem
// cada resposta dentro de uma caixa cinza com borda. Lida como veio da
// câmera, o OCR perdia quase todas as respostas (11/11/2026, no modelo do
// Dr. Gustavo): o cinza da caixa apaga o "Sim" e o "Não", e a borda colada no
// texto faz a caixa inteira virar desenho. Dois passos resolvem:
//
//   1. preto e branco pela vizinhança (limiar adaptativo): cada ponto é
//      comparado com a média em volta, e não com um limiar único — a sombra
//      da mão e o cinza da caixa deixam de importar;
//   2. as linhas compridas (bordas das caixas, faixas dos títulos) viram
//      branco. Letra nenhuma tem um traço reto tão longo. A foto quase nunca
//      sai reta, então a linha "desce um degrau" a cada tantos pontos: a busca
//      olha a linha de cima e a de baixo juntas para não a perder.
//
// Tudo aqui é puro, sobre a imagem em tons de cinza (um byte por ponto):
// o navegador tira os pontos do canvas e devolve para ele.

export type Imagem = { largura: number; altura: number; pontos: Uint8Array };

const PRETO = 0;
const BRANCO = 255;

/** RGBA do canvas para cinza (luminância). */
export function cinzaDoRgba(rgba: Uint8ClampedArray | Uint8Array, largura: number, altura: number): Imagem {
  const pontos = new Uint8Array(largura * altura);
  for (let i = 0; i < pontos.length; i++) {
    const j = i * 4;
    pontos[i] = (rgba[j] * 299 + rgba[j + 1] * 587 + rgba[j + 2] * 114) / 1000;
  }
  return { largura, altura, pontos };
}

/**
 * Preto e branco pela média da vizinhança. `janela` é a fração do lado maior
 * (0,03 ≈ três letras); `k`, quanto mais escuro que a média o ponto precisa
 * ser para virar tinta.
 */
export function binarizar(img: Imagem, { janela = 0.03, k = 0.12 } = {}): Imagem {
  const { largura: W, altura: H, pontos } = img;
  const integral = new Float64Array((W + 1) * (H + 1));
  for (let y = 0; y < H; y++) {
    let linha = 0;
    for (let x = 0; x < W; x++) {
      linha += pontos[y * W + x];
      integral[(y + 1) * (W + 1) + x + 1] = integral[y * (W + 1) + x + 1] + linha;
    }
  }
  const r = Math.max(4, Math.round((janela * Math.max(W, H)) / 2));
  const saida = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(H, y + r + 1);
    for (let x = 0; x < W; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(W, x + r + 1);
      const soma = integral[y1 * (W + 1) + x1] - integral[y0 * (W + 1) + x1] - integral[y1 * (W + 1) + x0] + integral[y0 * (W + 1) + x0];
      const media = soma / ((x1 - x0) * (y1 - y0));
      saida[y * W + x] = pontos[y * W + x] < media * (1 - k) ? PRETO : BRANCO;
    }
  }
  return { largura: W, altura: H, pontos: saida };
}

/**
 * Apaga os traços retos longos: horizontais de `minimoH` pontos ou mais e
 * verticais de `minimoV` ou mais. Na escala em que a ficha é lida (uns 3.000
 * pontos no lado maior), a letra tem uns 25 de altura e a caixa, uns 45: o
 * vertical de 38 pega a borda da caixa e deixa o "l" e o "I".
 */
export function apagarLinhas(img: Imagem, { minimoH = 60, minimoV = 38 } = {}): Imagem {
  const { largura: W, altura: H, pontos } = img;
  const saida = Uint8Array.from(pontos);
  const preto = (x: number, y: number) => pontos[y * W + x] === PRETO;

  // Horizontais: a faixa de três linhas (y-1, y, y+1) junta os degraus.
  for (let y = 0; y < H; y++) {
    let inicio = -1;
    for (let x = 0; x <= W; x++) {
      const tinta = x < W && (preto(x, y) || (y > 0 && preto(x, y - 1)) || (y + 1 < H && preto(x, y + 1)));
      if (tinta && inicio < 0) inicio = x;
      if (!tinta && inicio >= 0) {
        if (x - inicio >= minimoH) for (let k = inicio; k < x; k++) saida[y * W + k] = BRANCO;
        inicio = -1;
      }
    }
  }
  // Verticais: o mesmo, com as colunas x-1, x, x+1. Apagar só a coluna
  // "quase toda tinta" (para poupar a letra colada na borda) foi testado e
  // ficou pior: o resto da borda virava "1" ("64,5" lido 164,5). Por isso o
  // Mallampati de uma letra só não é aceito (ficha-do-hospital.ts).
  for (let x = 0; x < W; x++) {
    let inicio = -1;
    for (let y = 0; y <= H; y++) {
      const tinta = y < H && (preto(x, y) || (x > 0 && preto(x - 1, y)) || (x + 1 < W && preto(x + 1, y)));
      if (tinta && inicio < 0) inicio = y;
      if (!tinta && inicio >= 0) {
        if (y - inicio >= minimoV) for (let k = inicio; k < y; k++) saida[k * W + x] = BRANCO;
        inicio = -1;
      }
    }
  }
  return { largura: W, altura: H, pontos: saida };
}

/** A escala para o lado maior ficar perto de 3.000 pontos (nunca reduz, no máximo 2,4×). */
export function escalaDaFicha(largura: number, altura: number): number {
  return Math.min(2.4, Math.max(1, 3000 / Math.max(largura, altura)));
}

/** Os dois passos, na ordem. */
export function prepararFicha(img: Imagem): Imagem {
  return apagarLinhas(binarizar(img));
}
