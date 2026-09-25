/**
 * O que muda no banco quando um ato anestésico anda na fila da cobrança.
 *
 * Os quatro estados já existiam desde que a produção do dia nasceu —
 * a_cobrar, faturado, recebido, glosado —, e o seletor da linha já escrevia
 * `situacao`. O que faltava era a DATA DA NOTA, e ela falta pelo mesmo motivo
 * pelo qual faltou no plantão até setembro: "faturado" sem data é uma bandeira
 * sem idade. Não dá para saber se a nota saiu ontem — e aí esperar é o normal
 * — ou em julho, e aí o telefonema está atrasado há dois meses.
 *
 * A regra mora aqui, fora da tela, porque agora ela é escrita por DOIS
 * caminhos: o seletor de cada linha e o botão que marca vários de uma vez. Uma
 * cópia em cada lugar é como um dos dois acaba carimbando a data errada, e
 * esse tipo de defeito só aparece no fechamento, meses depois.
 */

export type SituacaoDaProducao = "a_cobrar" | "faturado" | "recebido" | "glosado";

/** As duas datas que um ato carrega, como estão HOJE no banco. */
export type MarcasDaProducao = {
  /** Dia em que a nota saiu. Nulo enquanto não saiu. */
  faturado_em?: string | null;
  /** Dia em que o dinheiro caiu. Nulo enquanto não caiu. */
  recebido_em?: string | null;
};

export type CamposDaBaixa = {
  situacao: SituacaoDaProducao;
  faturado_em: string | null;
  recebido_em: string | null;
};

/**
 * A situação nova e as duas datas que vão junto com ela.
 *
 * TRÊS DECISÕES, e cada uma tem um porquê:
 *
 * 1. EMITIR NOTA NÃO É RECEBER. Ao marcar "faturado", `recebido_em` volta a
 *    ser nulo: quem emite a nota de um ato que aparecia como recebido está
 *    corrigindo — o dinheiro não tinha caído.
 *
 * 2. RECEBER NÃO APAGA A NOTA. `faturado_em` é preservado, porque a pergunta
 *    "quanto tempo essa nota levou para ser paga" é a que responde se vale a
 *    pena continuar atendendo por aquele convênio.
 *
 * 3. GLOSA TAMBÉM NÃO APAGA A NOTA — a glosa acontece DEPOIS dela; é a
 *    operadora recusando o que foi cobrado. Só "a cobrar" limpa as duas, e
 *    limpa porque é o começo da fila: um ato que guardasse a data da nota
 *    antiga voltaria a parecer faturado no primeiro relatório que olhasse só
 *    a coluna.
 *
 * A data do passo é preservada quando já existe (`?? dia`). O botão que marca
 * vários carimba o dia que a pessoa escolheu, mas só no que ainda não tinha
 * data: quem já tinha nota de julho não passa a ter nota de hoje porque foi
 * marcado junto com os outros.
 */
export function camposDaBaixa(
  passo: SituacaoDaProducao,
  atual: MarcasDaProducao,
  dia: string,
): CamposDaBaixa {
  const nota = atual.faturado_em ?? null;
  switch (passo) {
    case "faturado":
      return { situacao: "faturado", faturado_em: nota ?? dia, recebido_em: null };
    case "recebido":
      return { situacao: "recebido", faturado_em: nota, recebido_em: atual.recebido_em ?? dia };
    case "glosado":
      return { situacao: "glosado", faturado_em: nota, recebido_em: null };
    default:
      return { situacao: "a_cobrar", faturado_em: null, recebido_em: null };
  }
}
