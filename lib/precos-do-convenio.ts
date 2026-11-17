// O preço da consulta pela tabela "Valores por convênio" (17/11/2026: "analise
// a produção e o financeiro e corrija e melhore o que for necessário").
//
// UMA REGRA SÓ, em dois lugares: a rota que lança a consulta concluída no
// Financeiro (app/api/avaliacoes/[id]/faturar) e o botão que preenche os
// lançamentos que nasceram em R$ 0,00 quando o preço ainda não estava na
// tabela. Se cada um escolhesse a regra do seu jeito, o botão poderia dar um
// preço e o próximo lançamento outro.
//
// O que mudou em relação à rota antiga:
//   * o convênio casa sem caixa e sem acento: o cadastro do paciente diz
//     "UNIMED" e a tabela "Unimed", e a consulta nascia em R$ 0,00;
//   * com duas regras igualmente específicas, vale a mais recente: antes, sem
//     ordem definida, a velha de R$ 0,00 podia ganhar da nova com o preço.

import { chaveDoPagador } from "./financeiro-indicadores.ts";
import { nomeSimples } from "./honorarios.ts";

export type RegraDePreco = {
  id: string;
  convenio: string;
  procedimento: string | null;
  hospital: string | null;
  valor: number | string;
  repasse_percentual: number | string | null;
  ativo: boolean;
  updated_at?: string | null;
  created_at?: string | null;
};

export type ConsultaParaPreco = { convenio: string | null; procedimento: string | null; hospital: string | null };

const igual = (a: string | null | undefined, b: string | null | undefined) => nomeSimples(a) === nomeSimples(b);
const quando = (r: RegraDePreco) => String(r.updated_at ?? r.created_at ?? "");

/** A regra que vale para a consulta: a mais específica; no empate, a mais recente. */
export function regraDaConsulta<R extends RegraDePreco>(regras: readonly R[], c: ConsultaParaPreco): R | null {
  const chave = chaveDoPagador(c.convenio);
  const valem = regras.filter((r) => r.ativo
    && chaveDoPagador(r.convenio) === chave
    && (!r.procedimento?.trim() || igual(r.procedimento, c.procedimento))
    && (!r.hospital?.trim() || igual(r.hospital, c.hospital)));
  const especifica = (r: R) => Number(Boolean(r.procedimento?.trim())) + Number(Boolean(r.hospital?.trim()));
  return [...valem].sort((a, b) => especifica(b) - especifica(a) || quando(b).localeCompare(quando(a)))[0] ?? null;
}

export type LancamentoSemPreco = ConsultaParaPreco & {
  id: string;
  valor: number | string;
  status: string;
  fechado_at?: string | null;
};

/**
 * Os lançamentos em R$ 0,00 que a tabela agora sabe preencher, por regra.
 * Só os que ainda esperam pagamento, de período aberto, cuja regra que vale
 * tem preço. O que foi pago, cancelado, glosado ou fechado não muda.
 */
export function lancamentosQueOPrecoPreenche<R extends RegraDePreco>(
  regras: readonly R[], lancamentos: readonly LancamentoSemPreco[],
): Map<string, string[]> {
  const porRegra = new Map<string, string[]>();
  for (const l of lancamentos) {
    if (Number(l.valor) !== 0 || l.status !== "aguardando" || l.fechado_at) continue;
    const regra = regraDaConsulta(regras, l);
    if (!regra || !(Number(regra.valor) > 0)) continue;
    porRegra.set(regra.id, [...(porRegra.get(regra.id) ?? []), l.id]);
  }
  return porRegra;
}

/** O repasse que acompanha o valor, como na rota: percentual da regra sobre o valor. */
export const repasseDoValor = (valor: number, percentual: number | string | null) =>
  Math.round(valor * (Number(percentual) || 0)) / 100;

/** A regra já cadastrada para o mesmo convênio, procedimento e hospital — salvar de novo atualiza ela. */
export function mesmaRegra<R extends RegraDePreco>(
  regras: readonly R[], nova: { convenio: string; procedimento: string | null; hospital: string | null },
): R | null {
  return regras.find((r) => chaveDoPagador(r.convenio) === chaveDoPagador(nova.convenio)
    && igual(r.procedimento, nova.procedimento) && igual(r.hospital, nova.hospital)) ?? null;
}
