// Onde a janela do tutorial senta.
//
// Isto morava dentro do componente, e foi lá que o defeito nasceu: a conta
// supunha 240px de altura para todas as etapas e, quando a janela não cabia
// embaixo do elemento, posicionava por `bottom` sem nada que a segurasse pela
// borda de cima. Alvo perto do topo da tela — um item da coluna da esquerda —
// empurrava a janela para fora, e a pessoa lia meia frase.
//
// Aritmética que decide se algo aparece na tela merece teste, e teste precisa
// de uma função pura. Por isso ela mora aqui, sem `window` e sem DOM: quem
// mede a tela é o componente, quem decide é este arquivo.

export type Recorte = { topo: number; esquerda: number; largura: number; altura: number };

export type Janela = {
  /** Onde recortar. Nulo quando a etapa não aponta para nada. */
  foco: Recorte | null;
  /** A altura MEDIDA da janela. Estimar aqui é o erro que este módulo corrige. */
  altura: number;
  larguraTela: number;
  alturaTela: number;
};

export type Posicao = { top: number; left: number; width: number; maxHeight: number };

/** Fora daqui a janela volta ao centro da tela, que é um estado válido. */
export const LARGURA = 360;
export const MARGEM = 12;

/**
 * Abaixo do máximo, a janela ancorada dividiria a tela com a coluna da
 * esquerda e sobraria uma tira de texto. Nessa largura ela volta ao centro —
 * o mesmo caminho do telefone.
 */
export const LARGURA_MINIMA_PARA_ANCORAR = 700;

/**
 * A posição da janela, presa dentro da tela nos dois eixos.
 *
 * Devolve nulo quando não há onde ancorar — sem alvo, ou tela estreita demais
 * — e aí quem chama centraliza.
 *
 * A ordem de preferência é: embaixo do elemento, em cima dele, e por fim o
 * lado com mais espaço. Nesse último caso a janela é maior que qualquer vão, e
 * o `maxHeight` faz o texto rolar por dentro em vez de transbordar — é o que
 * mantém os botões alcançáveis num notebook de tela baixa.
 */
export function posicaoDaJanela({ foco, altura, larguraTela, alturaTela }: Janela): Posicao | null {
  if (!foco) return null;
  if (larguraTela < LARGURA_MINIMA_PARA_ANCORAR) return null;

  const vaoAbaixo = alturaTela - (foco.topo + foco.altura) - MARGEM * 2;
  const vaoAcima = foco.topo - MARGEM * 2;

  let topo: number;
  if (altura <= vaoAbaixo) topo = foco.topo + foco.altura + MARGEM;
  else if (altura <= vaoAcima) topo = foco.topo - altura - MARGEM;
  else topo = vaoAbaixo >= vaoAcima ? foco.topo + foco.altura + MARGEM : MARGEM;

  // A trava final. É ela que faltava: sem isto, um alvo no alto da tela
  // colocava a janela em coordenada negativa e o topo dela ficava fora.
  //
  // O `Math.max` vem DEPOIS do `Math.min` de propósito: numa tela mais baixa
  // que a própria janela, o mínimo devolveria um número negativo, e é o máximo
  // que o traz de volta para a margem. Invertida, a ordem deixaria a janela
  // fora da tela justamente no caso apertado.
  const top = Math.max(MARGEM, Math.min(topo, alturaTela - altura - MARGEM));
  const left = Math.max(MARGEM, Math.min(foco.esquerda, larguraTela - LARGURA - MARGEM));

  return {
    top, left, width: LARGURA,
    // O teto conta a partir de ONDE A JANELA ESTÁ, e não do topo da tela.
    // Medido do zero — como estava —, uma janela posta a 300px com teto de
    // 876px continuava podendo passar da borda de baixo: o teto não sabia que
    // ela já começava lá embaixo. Foi um teste de varredura que pegou isto.
    maxHeight: alturaTela - top - MARGEM,
  };
}
