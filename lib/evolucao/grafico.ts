// A geometria do gráfico: de horário e valor para pixel, e de volta.
//
// A MESMA conta serve à tela e à impressão. É o que garante que o ponto que o
// médico tocou às 10:35 em 120 mmHg sai no papel exatamente no cruzamento de
// 10:35 com 120 — a folha impressa não é um desenho parecido, é o mesmo dado.

/** O eixo vertical da folha de papel: 0 a 240, com linha forte a cada 30. */
export const EIXO_Y = { min: 0, max: 240, passoForte: 30, passoFino: 10 } as const;

export type Escala = {
  /** Horário no x = 0. */
  inicio: number;
  /** Minutos visíveis na largura. */
  minutos: number;
  largura: number;
  altura: number;
};

export function tempoParaX(ms: number, e: Escala): number {
  return ((ms - e.inicio) / 60000) * (e.largura / e.minutos);
}

export function xParaTempo(x: number, e: Escala): number {
  return e.inicio + (x / e.largura) * e.minutos * 60000;
}

export function valorParaY(v: number, e: Escala, min: number = EIXO_Y.min, max: number = EIXO_Y.max): number {
  return e.altura - ((v - min) / (max - min)) * e.altura;
}

export function yParaValor(y: number, e: Escala, min: number = EIXO_Y.min, max: number = EIXO_Y.max): number {
  return min + ((e.altura - y) / e.altura) * (max - min);
}

/**
 * O toque vira um horário redondo e um valor inteiro. Horário no minuto
 * cheio (a folha não registra segundos) e valor sem casa decimal, dentro do
 * eixo. É só a SUGESTÃO que abre na janela de confirmação: o médico ajusta o
 * número antes de gravar.
 */
export function pontoDoToque(x: number, y: number, e: Escala) {
  const ms = Math.round(xParaTempo(x, e) / 60000) * 60000;
  const valor = Math.round(Math.min(EIXO_Y.max, Math.max(EIXO_Y.min, yParaValor(y, e))));
  return { ms, valor };
}

/** As marcas do eixo do tempo: uma a cada intervalo da folha, alinhadas no relógio. */
export function marcasDeTempo(inicio: number, fim: number, intervaloMin: number): number[] {
  const passo = intervaloMin * 60000;
  const primeira = Math.ceil(inicio / passo) * passo;
  const saida: number[] = [];
  for (let t = primeira; t <= fim; t += passo) saida.push(t);
  return saida;
}

/**
 * A janela visível: começa um pouco antes do primeiro registro e vai até o
 * último ou até agora. `zoom` é quantos minutos cabem na largura (60, 120,
 * 240) — procedimento longo navega para os lados em vez de espremer as curvas.
 */
export function janelaVisivel(inicioFolha: number, fim: number, zoomMin: number, deslocMin: number | null) {
  const comeco = inicioFolha - 5 * 60000;
  const totalMin = Math.max(zoomMin, (fim - comeco) / 60000 + 5);
  const maxDesloc = Math.max(0, totalMin - zoomMin);
  // Sem deslocamento escolhido, a janela acompanha o fim: no caso aberto, é o
  // "agora" que fica sempre à vista.
  const d = deslocMin === null ? maxDesloc : Math.min(maxDesloc, Math.max(0, deslocMin));
  return { inicio: comeco + d * 60000, minutos: zoomMin, totalMin, maxDesloc, desloc: d };
}

/** No máximo tantas colunas num arraste só: um escorregão não enche a tarde inteira. */
export const MAX_COLUNAS_REPETIDAS = 96;

/**
 * Arrastar um sinal pela linha (SpO₂ 99 até onde o dedo soltar, como no
 * AxREG): os horários a lançar, um por coluna do intervalo, entre a coluna de
 * origem (que já tem o valor) e a de destino, inclusive.
 *
 * O horário de cada coluna é o mesmo do toque na linha: o meio da coluna,
 * nunca depois de agora nem do fim da anestesia. Coluna que já tem valor
 * daquele sinal fica como está (arrastar não sobrescreve), e coluna que ainda
 * não começou fica de fora. Vale para os dois lados.
 */
export function colunasParaRepetir(o: {
  origemMs: number;
  destinoMs: number;
  intervaloMin: number;
  agoraMs: number;
  /** Fim da anestesia (ou saída da sala), quando marcado. */
  fimMs?: number | null;
  /** Os horários em que aquele sinal já tem valor. */
  ocupados: readonly number[];
}): number[] {
  const passo = o.intervaloMin * 60000;
  const colOrigem = Math.floor(o.origemMs / passo);
  const colDestino = Math.floor(o.destinoMs / passo);
  if (colOrigem === colDestino) return [];
  const limite = Math.min(o.agoraMs, o.fimMs ?? Infinity);
  const ocupadas = new Set(o.ocupados.map((ms) => Math.floor(ms / passo)));
  const sentido = colDestino > colOrigem ? 1 : -1;
  const saida: number[] = [];
  for (let c = colOrigem + sentido; sentido > 0 ? c <= colDestino : c >= colDestino; c += sentido) {
    const inicio = c * passo;
    if (inicio > limite || ocupadas.has(c)) continue;
    saida.push(Math.round(Math.min(inicio + passo / 2, limite) / 60000) * 60000);
    if (saida.length >= MAX_COLUNAS_REPETIDAS) break;
  }
  return saida.sort((a, b) => a - b);
}
