// Os meses que ficaram para trás sem ir ao Financeiro (17/11/2026: "analise a
// produção e o financeiro"). O botão "Enviar ao financeiro" envia o mês
// aberto; quem não liga o envio automático e esquece um mês só descobre no
// fechamento — havia anotações de setembro e outubro paradas. A Produção do
// mês avisa quais meses têm o que enviar, e leva até eles.

const NOMES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho",
  "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "2026-09" → "setembro de 2026" (o ano só quando não é o de agora). */
export function nomeDoMesDaProducao(mes: string, anoDeHoje: number): string {
  const [ano, m] = mes.split("-").map(Number);
  const nome = NOMES[(m || 1) - 1] ?? mes;
  return ano === anoDeHoje ? nome : `${nome} de ${ano}`;
}

/**
 * Os meses anteriores ao de hoje com anotação sem enviar, do mais antigo ao
 * mais novo. O mês aberto na tela fica de fora: o botão dele já diz quantas.
 * O mês de hoje também: ainda está acontecendo.
 */
export function mesesSemEnviar(
  linhas: ReadonlyArray<{ data: string; enviado_em?: string | null }>,
  mesAberto: string,
  mesDeHoje: string,
): Array<{ mes: string; n: number }> {
  const conta = new Map<string, number>();
  for (const l of linhas) {
    if (l.enviado_em) continue;
    const mes = l.data.slice(0, 7);
    if (mes >= mesDeHoje || mes === mesAberto) continue;
    conta.set(mes, (conta.get(mes) ?? 0) + 1);
  }
  return [...conta].sort(([a], [b]) => a.localeCompare(b)).map(([mes, n]) => ({ mes, n }));
}
