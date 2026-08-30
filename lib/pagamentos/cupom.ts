// Cupom de desconto.
//
// O DESCONTO MORA NO STRIPE, e não numa tabela nossa. A tentação é criar um
// `cupons` no banco e baixar o preço na hora de abrir o checkout — e é errado
// por um motivo que só aparece no segundo mês: desconto de assinatura RECORRE.
// Baixar o `unit_amount` uma vez cria um preço menor para sempre, sem data de
// fim e sem como voltar atrás; o cupom do Stripe tem duração ("só o primeiro
// mês", "os três primeiros", "para sempre"), limite de resgates e validade,
// que é exatamente o controle que uma campanha precisa ter.
//
// De quebra, a fatura do cliente sai com a linha "HACKANESTESIA −20%" escrita
// nela. Desconto que não aparece na fatura vira ligação para o financeiro.
//
// O que mora AQUI é só o que o cliente lê antes de pagar: quanto vai ficar e
// por quanto tempo. Isso é conteúdo sobre dinheiro, e conteúdo sobre dinheiro
// merece teste — quem promete R$ 103,20 na tela e cobra R$ 129,00 no cartão
// leva contestação, e com razão.

import { money } from "../escala.ts";

export type Duracao = "once" | "repeating" | "forever";

/** Um cupom válido, já traduzido do vocabulário do Stripe. */
export type Cupom = {
  /** O id do promotion code (`promo_...`) — é ele que vai para o checkout. */
  id: string;
  /** O código como a pessoa digita e como sai na fatura. */
  codigo: string;
  /** Desconto percentual, 0 a 100. Nulo quando o desconto é em reais. */
  percentual: number | null;
  /** Desconto em reais. Nulo quando o desconto é percentual. */
  valorFixo: number | null;
  duracao: Duracao;
  /** Quantos meses, quando a duração é `repeating`. */
  meses: number | null;
};

/**
 * O código, arrumado.
 *
 * Quem recebe o cupom num flyer digita com espaço no fim, em minúscula, ou
 * cola com um espaço invisível junto. Recusar por isso é perder uma venda por
 * um detalhe de digitação.
 */
export function normalizarCupom(texto: unknown): string {
  return String(texto ?? "")
    .replace(/\s+/g, "")
    .toUpperCase()
    .slice(0, 60);
}

/**
 * Quanto fica a mensalidade com o desconto aplicado.
 *
 * A conta é feita em CENTAVOS, que é como o Stripe faz. Multiplicar reais com
 * casa decimal e arredondar no fim dá um centavo de diferença em alguns
 * valores — e um centavo de diferença entre a tela e a fatura é uma pergunta
 * que alguém vai fazer.
 */
export function comDesconto(valorMensal: number, cupom: Cupom | null): number {
  const centavos = Math.round(Number(valorMensal || 0) * 100);
  if (!cupom || !(centavos > 0)) return Math.max(0, centavos) / 100;

  const abatimento = cupom.percentual !== null
    ? Math.round((centavos * cupom.percentual) / 100)
    : Math.round(Number(cupom.valorFixo || 0) * 100);

  // Nunca abaixo de zero: um cupom de R$ 200 num plano de R$ 129 não devolve
  // dinheiro para o cliente, só zera a fatura.
  return Math.max(0, centavos - abatimento) / 100;
}

/** "20%" ou "R$ 25,00". */
export function quantoAbate(cupom: Cupom): string {
  return cupom.percentual !== null ? `${cupom.percentual}%` : money(Number(cupom.valorFixo || 0));
}

/** "para sempre", "no primeiro mês", "nos 3 primeiros meses". */
export function porQuantoTempo(cupom: Cupom): string {
  if (cupom.duracao === "forever") return "enquanto a assinatura seguir ativa";
  const meses = cupom.duracao === "repeating" ? Number(cupom.meses ?? 1) : 1;
  return meses > 1 ? `nos ${meses} primeiros meses` : "no primeiro mês";
}

/**
 * A frase inteira, do jeito que vai para a tela e para o e-mail.
 *
 * Uma frase só, montada num lugar só, porque a tela do checkout e o e-mail de
 * boas-vindas precisam dizer a MESMA coisa sobre o desconto. Duas frases em
 * dois arquivos divergem no dia em que alguém mexer numa e esquecer da outra.
 */
export function descreverCupom(valorMensal: number, cupom: Cupom): string {
  const final = comDesconto(valorMensal, cupom);
  return `${quantoAbate(cupom)} de desconto — ${money(final)} por mês, ${porQuantoTempo(cupom)}.`;
}
