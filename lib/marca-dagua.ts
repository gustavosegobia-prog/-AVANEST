/**
 * O azul da marca d'água do hospital (pedido de 22/10/2026: "azul bem
 * clarinho"): o azul claro da marca AVANEST. O quão clarinho é a opacidade
 * de cada tela (mapa.module.css, tv.module.css).
 */
export const AZUL_DA_MARCA_DAGUA: readonly [number, number, number] = [43, 134, 212];

/**
 * Pinta o logo de um azul só, nos próprios pixels (RGBA, como sai do canvas).
 *
 * O escuro do desenho vira azul, e o fundo branco do JPG vira transparente —
 * inclusive o ruído quase branco da compressão, que de outro jeito sairia como
 * um retângulo manchado em volta do logo. O que é transparente no PNG continua
 * transparente. Fica igual em qualquer logo, de qualquer cor, e no tema claro
 * e no escuro, sem depender de mistura de camadas.
 */
export function pintarDeAzul(px: Uint8ClampedArray, azul: readonly [number, number, number] = AZUL_DA_MARCA_DAGUA) {
  for (let i = 0; i < px.length; i += 4) {
    const luz = (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255;
    const tinta = Math.min(1, Math.max(0, (0.92 - luz) / 0.6));
    px[i] = azul[0];
    px[i + 1] = azul[1];
    px[i + 2] = azul[2];
    px[i + 3] = Math.round(px[i + 3] * tinta);
  }
  return px;
}
