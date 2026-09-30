// O painel do Financeiro — "Resumo" — como contas, e não como tela.
//
// Tudo que o painel afirma sai daqui, e daqui sai só o que já existia em
// lib/receitas.ts e lib/financeiro-indicadores.ts, recortado de outro jeito.
// Nenhuma regra de negócio nova: o que é faturado, recebido, a receber e
// vencido continua sendo o que era. O que é novo é a pergunta de cada
// bloco — "o que compõe este número?", "o que devo fazer agora?" — e a
// resposta mora aqui para poder ser testada sem montar a tela.

import { doMes, paraRecebivel, type Receita } from "./receitas.ts";
import {
  chaveDoPagador, diasEntre, itensAReceber, itensVencidos, rotulosDePagador,
} from "./financeiro-indicadores.ts";

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const saldoDe = (r: Pick<Receita, "valor" | "recebido">) => Math.max(0, r.valor - r.recebido);
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto",
  "setembro", "outubro", "novembro", "dezembro"];
const MES_CURTO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** "2026-09" → "Setembro de 2026". */
export function nomeDaCompetencia(competencia: string) {
  const [ano, mes] = competencia.split("-").map(Number);
  return maiuscula(`${MESES[mes - 1] ?? competencia} de ${ano}`);
}

function somarMeses(competencia: string, meses: number) {
  const [ano, mes] = competencia.split("-").map(Number);
  const d = new Date(Date.UTC(ano, mes - 1 + meses, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Último dia da competência, AAAA-MM-DD. */
function fimDaCompetencia(competencia: string) {
  const [ano, mes] = competencia.split("-").map(Number);
  const d = new Date(Date.UTC(ano, mes, 0));
  return `${competencia}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

// ── Composição: o que está dentro de cada número ──────────────────────────

export type TipoDeComposicao = "recebido" | "aReceber" | "vencido" | "faturado";

export type LinhaDeComposicao = {
  id: string;
  data: string;
  competencia: string;
  descricao: string;
  pagador: string;
  valor: number;
  recebido: number;
  saldo: number;
  vencimento: string | null;
  /** A parte desta linha que entra no total mostrado. */
  parte: number;
};

export type Composicao = {
  tipo: TipoDeComposicao;
  total: number;
  linhas: LinhaDeComposicao[];
  /** Quanto cada pagador põe no total, maior primeiro. */
  pagadores: { rotulo: string; valor: number; linhas: number }[];
  /**
   * A primeira e a última COMPETÊNCIA (AAAA-MM) entre as linhas; nulo sem
   * linhas. Competência, e não data: a consulta é guardada pelo mês de
   * cobrança, sem o dia — um "01/09" aqui seria um dia inventado.
   */
  periodo: { de: string; ate: string } | null;
};

/**
 * As linhas que compõem cada um dos quatro números do topo.
 *
 * O total devolvido é a soma das partes, calculada pelos MESMOS filtros que
 * produzem o número do cartão (`doMes` para faturado e recebido,
 * `itensAReceber` e `itensVencidos` para os outros dois). Se um dia o cartão
 * e a lista discordarem, o defeito está no filtro — e é um só.
 *
 * Recebido e faturado olham a COMPETÊNCIA selecionada. A receber e vencido
 * olham o histórico inteiro, como sempre olharam: o dinheiro do mês passado
 * ainda na rua é justamente o que esses dois números existem para mostrar.
 */
export function composicao(
  tipo: TipoDeComposicao, receitas: Receita[], competencia: string, hoje: string,
): Composicao {
  let escolhidas: Receita[];
  let parteDe: (r: Receita) => number;
  if (tipo === "faturado") {
    escolhidas = doMes(receitas, competencia);
    parteDe = (r) => r.valor;
  } else if (tipo === "recebido") {
    escolhidas = doMes(receitas, competencia).filter((r) => r.recebido > 0);
    parteDe = (r) => r.recebido;
  } else {
    const porId = new Map(receitas.map((r) => [r.id, r]));
    const recebiveis = receitas.map(paraRecebivel);
    const filtradas = tipo === "aReceber" ? itensAReceber(recebiveis) : itensVencidos(recebiveis, hoje);
    escolhidas = filtradas.map((x) => porId.get(x.id)!).filter(Boolean);
    parteDe = saldoDe;
  }

  const linhas: LinhaDeComposicao[] = escolhidas
    .map((r) => ({
      id: r.id, data: r.data, competencia: r.competencia, descricao: r.descricao,
      pagador: r.pagador, valor: r.valor, recebido: r.recebido, saldo: saldoDe(r),
      vencimento: r.vencimento ?? null, parte: parteDe(r),
    }))
    .sort((a, b) => b.data.localeCompare(a.data) || b.parte - a.parte);

  const rotulos = rotulosDePagador(linhas.map((l) => l.pagador));
  const porPagador = new Map<string, { rotulo: string; valor: number; linhas: number }>();
  for (const l of linhas) {
    const chave = chaveDoPagador(l.pagador);
    const alvo = porPagador.get(chave) ?? { rotulo: rotulos.get(chave) ?? chave, valor: 0, linhas: 0 };
    alvo.valor += l.parte;
    alvo.linhas += 1;
    porPagador.set(chave, alvo);
  }

  const competencias = linhas.map((l) => l.competencia).sort();
  return {
    tipo,
    total: linhas.reduce((s, l) => s + l.parte, 0),
    linhas,
    pagadores: [...porPagador.values()].sort((a, b) => b.valor - a.valor),
    periodo: competencias.length ? { de: competencias[0], ate: competencias[competencias.length - 1] } : null,
  };
}

// ── Situação dos atendimentos ──────────────────────────────────────────────

export type SituacaoDosAtendimentos = {
  /** Lançados na competência mais os que esperam lançamento. */
  realizados: number;
  /** Os que ainda não viraram lançamento (vindos da recepção e da agenda). */
  aguardandoLancamento: number;
  /** Lançados com valor. */
  faturados: number;
  /** Lançados em R$ 0,00 — sem preço, não "pagos". */
  semValor: number;
  /** Com valor, e todo ele recebido. */
  quitados: number;
  parciais: number;
  emAberto: number;
  /** Quitados sobre realizados; nulo sem nenhum realizado. */
  percentualConcluido: number | null;
};

/**
 * Quantos atendimentos a competência teve, e em que pé cada um está.
 *
 * O gráfico anterior contava como "quitado" todo lançamento com saldo zero —
 * e lançamento de R$ 0,00 tem saldo zero. Doze anestesias anotadas sem preço
 * apareciam como doze atendimentos pagos. Aqui R$ 0,00 é "sem valor", uma
 * categoria à parte: não é dinheiro recebido, é preço que falta.
 */
export function situacaoDosAtendimentos(
  receitasDoMes: Receita[], aguardandoLancamento: number,
): SituacaoDosAtendimentos {
  let faturados = 0, semValor = 0, quitados = 0, parciais = 0, emAberto = 0;
  for (const r of receitasDoMes) {
    if (r.valor <= 0) { semValor++; continue; }
    faturados++;
    if (r.recebido >= r.valor) quitados++;
    else if (r.recebido > 0) parciais++;
    else emAberto++;
  }
  const realizados = receitasDoMes.length + aguardandoLancamento;
  return {
    realizados, aguardandoLancamento, faturados, semValor, quitados, parciais, emAberto,
    percentualConcluido: realizados ? Math.round((quitados / realizados) * 100) : null,
  };
}

// ── Recebimentos por convênio ──────────────────────────────────────────────

export type LinhaPorConvenio = {
  rotulo: string;
  faturado: number;
  recebido: number;
  saldo: number;
  lancamentos: number;
  semValor: number;
};

/**
 * Faturado, recebido e saldo de cada pagador na competência.
 *
 * Um pagador com lançamentos só em R$ 0,00 FICA na lista: "Unimed, 12
 * lançamentos sem valor" é exatamente a informação que falta a quem fecha o
 * mês. Sumir com ele faria o convênio parecer inexistente.
 */
export function recebimentosPorConvenio(receitasDoMes: Receita[]): LinhaPorConvenio[] {
  const rotulos = rotulosDePagador(receitasDoMes.map((r) => r.pagador));
  const linhas = new Map<string, LinhaPorConvenio>();
  for (const r of receitasDoMes) {
    const chave = chaveDoPagador(r.pagador);
    const l = linhas.get(chave)
      ?? { rotulo: rotulos.get(chave) ?? chave, faturado: 0, recebido: 0, saldo: 0, lancamentos: 0, semValor: 0 };
    l.faturado += r.valor;
    l.recebido += r.recebido;
    l.saldo += saldoDe(r);
    l.lancamentos += 1;
    if (r.valor <= 0) l.semValor += 1;
    linhas.set(chave, l);
  }
  return [...linhas.values()].sort((a, b) => b.saldo - a.saldo || b.faturado - a.faturado);
}

// ── Evolução mês a mês ────────────────────────────────────────────────────

export type MesDaEvolucao = {
  competencia: string;
  rotulo: string;
  rotuloLongo: string;
  /**
   * "sem-dados": nenhum registro naquele mês — não se sabe, e não é zero.
   * "sem-movimento": a competência existe (tem registro ou período aberto),
   * mas não faturou nada — aí sim, R$ 0,00.
   */
  estado: "sem-dados" | "sem-movimento" | "com-movimento";
  faturado: number;
  recebido: number;
  saldo: number;
};

/**
 * Os `meses` meses que terminam na competência selecionada.
 *
 * Mês sem nenhum registro é "sem dados", e NUNCA zero. A diferença importa:
 * um grupo que começou a usar o sistema em agosto tinha junho e julho
 * desenhados como meses de faturamento nulo — um tombo que não aconteceu.
 * `competenciasComRegistro` são os meses em que o serviço existiu no sistema
 * por outro caminho (período aberto ou fechado, despesa lançada): esses,
 * sem receita, são "R$ 0,00 de verdade".
 */
export function evolucaoFinanceira(
  receitas: Receita[], competencia: string, competenciasComRegistro: Set<string>, meses = 6,
): MesDaEvolucao[] {
  const lista: MesDaEvolucao[] = [];
  for (let k = meses - 1; k >= 0; k--) {
    const c = somarMeses(competencia, -k);
    const doMesC = doMes(receitas, c);
    const faturado = doMesC.reduce((s, r) => s + r.valor, 0);
    const recebido = doMesC.reduce((s, r) => s + r.recebido, 0);
    const saldo = doMesC.reduce((s, r) => s + saldoDe(r), 0);
    const temRegistro = doMesC.length > 0 || competenciasComRegistro.has(c);
    const [ano, mes] = c.split("-").map(Number);
    lista.push({
      competencia: c,
      rotulo: MES_CURTO[mes - 1],
      rotuloLongo: maiuscula(`${MESES[mes - 1]} de ${ano}`),
      estado: !temRegistro ? "sem-dados" : faturado > 0 || recebido > 0 ? "com-movimento" : "sem-movimento",
      faturado, recebido, saldo,
    });
  }
  return lista;
}

// ── Próximos vencimentos ───────────────────────────────────────────────────

/**
 * O que vence nos próximos `dias` dias, e o que está a receber SEM
 * vencimento declarado.
 *
 * O segundo número existe porque "nada vencendo" com R$ 8.000 a receber sem
 * data nenhuma não é tranquilidade — é cobrança que ninguém agendou.
 */
export function proximosVencimentos(receitas: Receita[], hoje: string, dias = 30, limite = 5) {
  const ate = somarDiasIso(hoje, dias);
  const abertas = receitas.filter((r) => saldoDe(r) > 0);
  const vencendo = abertas
    .filter((r) => r.vencimento && r.vencimento >= hoje && r.vencimento <= ate)
    .sort((a, b) => a.vencimento!.localeCompare(b.vencimento!));
  const semVencimento = abertas.filter((r) => !r.vencimento);
  return {
    linhas: vencendo.slice(0, limite).map((r) => ({
      id: r.id, descricao: r.descricao, pagador: r.pagador, vencimento: r.vencimento!, saldo: saldoDe(r),
    })),
    quantidade: vencendo.length,
    total: vencendo.reduce((s, r) => s + saldoDe(r), 0),
    semVencimento: {
      quantidade: semVencimento.length,
      total: semVencimento.reduce((s, r) => s + saldoDe(r), 0),
    },
  };
}

function somarDiasIso(iso: string, dias: number) {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

// ── Fechamento ────────────────────────────────────────────────────────────

export type EstadoDoFechamento =
  | { tipo: "fechado" }
  | { tipo: "sem-movimento" }
  | { tipo: "em-andamento"; diasParaOFim: number }
  | { tipo: "perto-do-fim"; diasParaOFim: number }
  | { tipo: "atrasado"; diasDesdeOFim: number };

/** Dias antes do fim do mês em que o fechamento passa a pedir preparo. */
export const AVISO_DE_FIM_DE_MES = 2;

/**
 * Em que pé está o fechamento de uma competência.
 *
 * Um mês aberto enquanto ele ainda está correndo é o NORMAL — não é
 * pendência. Aparecer como alerta todo dia do mês ensinava a ignorar a
 * fila inteira. Só vira pendência quando o mês acabou e não foi fechado
 * ("atrasado"), ou quando falta pouco para acabar ("perto-do-fim").
 */
export function estadoDoFechamento(
  competencia: string, hoje: string, status: string | null | undefined, temMovimento: boolean,
): EstadoDoFechamento {
  if (status === "fechado") return { tipo: "fechado" };
  if (!temMovimento) return { tipo: "sem-movimento" };
  const fim = fimDaCompetencia(competencia);
  const faltam = diasEntre(hoje, fim);
  if (faltam < 0) return { tipo: "atrasado", diasDesdeOFim: -faltam };
  if (faltam <= AVISO_DE_FIM_DE_MES) return { tipo: "perto-do-fim", diasParaOFim: faltam };
  return { tipo: "em-andamento", diasParaOFim: faltam };
}

// ── Atenção hoje ──────────────────────────────────────────────────────────

export type Prioridade = "alta" | "media" | "baixa";

export type Pendencia = {
  chave: string;
  prioridade: Prioridade;
  titulo: string;
  detalhe: string;
  /** O que está em jogo. `valor`, quando existe, é dinheiro. */
  impacto: { valor: number | null; texto: string };
  /** O verbo do botão — nunca "Ver". */
  acao: string;
  tarefa: string;
  periodo?: string;
};

export type EntradaDaAtencao = {
  aguardandoLancamento: number;
  conveniosSemPreco: number;
  lancamentosSemValor: number;
  podeConfigurarPrecos: boolean;
  notasSemBaixa: { quantidade: number; saldo: number };
  cobrancasAtrasadas: { convenios: number; valor: number };
  glosasComPrazoVencendo: number;
  despesasRecorrentesFaltando: number;
  repassesPendentes: { quantidade: number; valor: number };
  fechamentos: { competencia: string; estado: EstadoDoFechamento }[];
  depoisDoFechamento: [string, number][];
  producaoMudou: { mes: string; antes: { anotacoes: number; valor: number }; agora: { anotacoes: number; valor: number } }[];
};

const ORDEM: Record<Prioridade, number> = { alta: 0, media: 1, baixa: 2 };
const mesBr = (mes: string) => mes.split("-").reverse().join("/");

/**
 * A fila de "Atenção hoje": só o que pede ação, cada item com o botão da
 * ação específica e o que está em jogo.
 *
 * Alta: o dinheiro está em risco ou um número já assinado mudou.
 * Média: trabalho parado que vira problema se esperar.
 * Baixa: rotina que o sistema lembra.
 */
export function montarAtencao(e: EntradaDaAtencao): Pendencia[] {
  const fila: Pendencia[] = [];

  for (const [mes, quantos] of e.depoisDoFechamento) fila.push({
    chave: `depois-${mes}`, prioridade: "alta",
    titulo: `${plural(quantos, "lançamento entrou", "lançamentos entraram")} em ${mesBr(mes)} depois do fechamento`,
    detalhe: "O mês fechado mudou depois da conferência — reabra com o motivo, revise e feche de novo.",
    impacto: { valor: null, texto: "o número assinado do mês não é mais o que está no sistema" },
    acao: "Revisar o fechamento", tarefa: "fechamento", periodo: mes,
  });
  for (const { mes, antes, agora } of e.producaoMudou) fila.push({
    chave: `producao-${mes}`, prioridade: "alta",
    titulo: `A produção de ${mesBr(mes)} mudou depois do fechamento`,
    detalhe: `Era ${plural(antes.anotacoes, "anotação", "anotações")}; agora são ${agora.anotacoes}.`,
    impacto: { valor: Math.abs(agora.valor - antes.valor), texto: "de diferença no faturado assinado" },
    acao: "Revisar o fechamento", tarefa: "fechamento", periodo: mes,
  });
  if (e.cobrancasAtrasadas.convenios > 0) fila.push({
    chave: "idade", prioridade: "alta",
    titulo: `${plural(e.cobrancasAtrasadas.convenios, "convênio devendo", "convênios devendo")} há mais de 90 dias`,
    detalhe: "Dinheiro parado há mais de três meses costuma virar perda se ninguém cobrar.",
    impacto: { valor: e.cobrancasAtrasadas.valor, texto: "em risco" },
    acao: "Cobrar convênios", tarefa: "idade",
  });
  if (e.glosasComPrazoVencendo > 0) fila.push({
    chave: "glosas", prioridade: "alta",
    titulo: `${plural(e.glosasComPrazoVencendo, "glosa com", "glosas com")} prazo de recurso em até 7 dias`,
    detalhe: "Passado o prazo, o convênio não aceita mais o recurso.",
    impacto: { valor: null, texto: "valor glosado deixa de ser recuperável" },
    acao: "Recorrer das glosas", tarefa: "glosas",
  });
  if (e.conveniosSemPreco > 0) fila.push({
    chave: "convenio", prioridade: "media",
    titulo: `${plural(e.conveniosSemPreco, "convênio ativo sem", "convênios ativos sem")} preço configurado`,
    detalhe: "Lançamentos desses convênios podem ficar sem valor.",
    impacto: {
      valor: null,
      texto: e.lancamentosSemValor > 0
        ? `${plural(e.lancamentosSemValor, "lançamento", "lançamentos")} desta competência já estão em R$ 0,00`
        : "novos lançamentos nascem em R$ 0,00",
    },
    acao: e.podeConfigurarPrecos ? "Configurar preços" : "Conferir a tabela de preços",
    tarefa: "valores",
  });
  if (e.aguardandoLancamento > 0) fila.push({
    chave: "lancamentos", prioridade: "media",
    titulo: `${plural(e.aguardandoLancamento, "atendimento aguardando", "atendimentos aguardando")} lançamento`,
    detalhe: "Vindos da recepção e da agenda, prontos para virar cobrança.",
    impacto: { valor: null, texto: "ainda fora do faturado" },
    acao: "Lançar atendimentos", tarefa: "lancamentos",
  });
  if (e.notasSemBaixa.quantidade > 0) fila.push({
    chave: "notas", prioridade: "media",
    titulo: `${plural(e.notasSemBaixa.quantidade, "nota fiscal vencida", "notas fiscais vencidas")} sem baixa`,
    detalhe: "Passou o vencimento (ou 15 dias da emissão) e o pagamento não foi registrado.",
    impacto: { valor: e.notasSemBaixa.saldo, texto: "a cobrar" },
    acao: "Cobrar notas", tarefa: "notas",
  });
  if (e.repassesPendentes.quantidade > 0) fila.push({
    chave: "repasses", prioridade: "media",
    titulo: `${plural(e.repassesPendentes.quantidade, "repasse", "repasses")} ainda não ${e.repassesPendentes.quantidade === 1 ? "pago" : "pagos"}`,
    detalhe: "Conferir e liberar aos anestesiologistas.",
    impacto: { valor: e.repassesPendentes.valor, texto: "devidos à equipe" },
    acao: "Pagar repasses", tarefa: "repasses",
  });
  for (const { competencia, estado } of e.fechamentos) {
    if (estado.tipo === "atrasado") fila.push({
      chave: `fechamento-${competencia}`, prioridade: estado.diasDesdeOFim > 15 ? "alta" : "media",
      titulo: `${nomeDaCompetencia(competencia)} terminou e não foi fechado`,
      detalhe: "Revise notas, glosas e pagamentos pendentes e confirme a conferência.",
      impacto: { valor: null, texto: `há ${plural(estado.diasDesdeOFim, "dia", "dias")} sem número assinado` },
      acao: "Fechar o mês", tarefa: "fechamento", periodo: competencia,
    });
    else if (estado.tipo === "perto-do-fim") fila.push({
      chave: `fechamento-${competencia}`, prioridade: "baixa",
      titulo: estado.diasParaOFim === 0 ? "O mês termina hoje" : `O mês termina em ${plural(estado.diasParaOFim, "dia", "dias")}`,
      detalhe: "Bom momento para conferir notas e glosas antes do fechamento.",
      impacto: { valor: null, texto: "fechamento se aproximando" },
      acao: "Preparar o fechamento", tarefa: "fechamento", periodo: competencia,
    });
  }
  if (e.despesasRecorrentesFaltando > 0) fila.push({
    chave: "despesas", prioridade: "baixa",
    titulo: `${plural(e.despesasRecorrentesFaltando, "despesa recorrente", "despesas recorrentes")} ainda não ${e.despesasRecorrentesFaltando === 1 ? "lançada" : "lançadas"} este mês`,
    detalhe: "O sistema lembra; quem lança é você.",
    impacto: { valor: null, texto: "resultado do mês incompleto" },
    acao: "Lançar despesas", tarefa: "despesas",
  });

  // Estável dentro de cada prioridade: a ordem acima é a de importância.
  return fila
    .map((p, i) => ({ p, i }))
    .sort((a, b) => ORDEM[a.p.prioridade] - ORDEM[b.p.prioridade] || a.i - b.i)
    .map(({ p }) => p);
}
