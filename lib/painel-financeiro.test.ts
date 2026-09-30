import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Receita } from "./receitas.ts";
import { saldoAReceber, saldoVencido } from "./financeiro-indicadores.ts";
import { paraRecebivel } from "./receitas.ts";
import {
  composicao, estadoDoFechamento, evolucaoFinanceira, montarAtencao, nomeDaCompetencia,
  proximosVencimentos, recebimentosPorConvenio, situacaoDosAtendimentos, type EntradaDaAtencao,
} from "./painel-financeiro.ts";

const r = (id: string, x: Partial<Receita>): Receita => ({
  id, origem: "consulta", data: "2026-09-10", competencia: "2026-09", donoId: null,
  descricao: id, pagador: "Particular", valor: 100, recebido: 0, ...x,
});

const HOJE = "2026-09-30";
const RECEITAS = [
  r("pago", { valor: 300, recebido: 300 }),
  r("parcial", { pagador: "UNIMED", valor: 200, recebido: 50, vencimento: "2026-09-20" }),
  r("aberto", { pagador: "Unimed", valor: 150, vencimento: "2026-10-15" }),
  r("zero", { pagador: "Unimed", valor: 0 }),
  r("antigo", { competencia: "2026-06", data: "2026-06-05", valor: 400, vencimento: "2026-07-05" }),
];

describe("composição dos quatro números", () => {
  it("o total de cada composição é o mesmo número do cartão", () => {
    const recebiveis = RECEITAS.map(paraRecebivel);
    assert.equal(composicao("aReceber", RECEITAS, "2026-09", HOJE).total, saldoAReceber(recebiveis));
    assert.equal(composicao("vencido", RECEITAS, "2026-09", HOJE).total, saldoVencido(recebiveis, HOJE));
    assert.equal(composicao("faturado", RECEITAS, "2026-09", HOJE).total, 650);
    assert.equal(composicao("recebido", RECEITAS, "2026-09", HOJE).total, 350);
  });

  it("a receber e vencido olham todos os meses; faturado e recebido, só a competência", () => {
    const aReceber = composicao("aReceber", RECEITAS, "2026-09", HOJE);
    assert.deepEqual(aReceber.linhas.map((l) => l.id).sort(), ["aberto", "antigo", "parcial"]);
    assert.deepEqual(composicao("vencido", RECEITAS, "2026-09", HOJE).linhas.map((l) => l.id).sort(), ["antigo", "parcial"]);
    assert.ok(!composicao("faturado", RECEITAS, "2026-09", HOJE).linhas.some((l) => l.id === "antigo"));
  });

  it("agrupa os pagadores pela grafia, e dá o período das linhas", () => {
    const c = composicao("faturado", RECEITAS, "2026-09", HOJE);
    const unimed = c.pagadores.find((p) => p.rotulo.toLowerCase() === "unimed");
    assert.equal(unimed?.valor, 350);
    assert.equal(unimed?.linhas, 3);
    assert.deepEqual(c.periodo, { de: "2026-09", ate: "2026-09" });
    assert.deepEqual(composicao("aReceber", RECEITAS, "2026-09", HOJE).periodo, { de: "2026-06", ate: "2026-09" },
      "o período é de competências, não de datas");
    assert.equal(composicao("vencido", [], "2026-09", HOJE).periodo, null);
  });
});

describe("situação dos atendimentos", () => {
  it("R$ 0,00 é 'sem valor', nunca 'quitado'", () => {
    const s = situacaoDosAtendimentos(RECEITAS.filter((x) => x.competencia === "2026-09"), 0);
    assert.equal(s.quitados, 1);
    assert.equal(s.semValor, 1);
    assert.equal(s.faturados, 3);
    assert.equal(s.parciais, 1);
    assert.equal(s.emAberto, 1);
  });

  it("realizados somam o que ainda espera lançamento", () => {
    const s = situacaoDosAtendimentos([r("a", { valor: 100, recebido: 100 })], 3);
    assert.equal(s.realizados, 4);
    assert.equal(s.percentualConcluido, 25);
    assert.equal(situacaoDosAtendimentos([], 0).percentualConcluido, null);
  });
});

describe("recebimentos por convênio", () => {
  it("faturado, recebido e saldo por pagador; o saldo maior primeiro", () => {
    const linhas = recebimentosPorConvenio(RECEITAS.filter((x) => x.competencia === "2026-09"));
    assert.equal(linhas[0].rotulo.toLowerCase(), "unimed");
    assert.deepEqual([linhas[0].faturado, linhas[0].recebido, linhas[0].saldo], [350, 50, 300]);
    assert.equal(linhas[0].semValor, 1, "o convênio com lançamento zerado continua aparecendo");
  });
});

describe("evolução financeira", () => {
  it("mês sem registro é 'sem dados', não zero", () => {
    const meses = evolucaoFinanceira(RECEITAS, "2026-09", new Set(["2026-08"]));
    assert.deepEqual(meses.map((m) => m.competencia),
      ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"]);
    assert.deepEqual(meses.map((m) => m.estado),
      ["sem-dados", "sem-dados", "com-movimento", "sem-dados", "sem-movimento", "com-movimento"]);
    const set = meses[5];
    assert.deepEqual([set.faturado, set.recebido, set.saldo], [650, 350, 300]);
  });

  it("vira o ano sem se perder", () => {
    assert.deepEqual(evolucaoFinanceira([], "2026-02", new Set()).map((m) => m.rotulo),
      ["set", "out", "nov", "dez", "jan", "fev"]);
  });
});

describe("próximos vencimentos", () => {
  it("o que vence em 30 dias, em ordem, e o que está a receber sem data", () => {
    const p = proximosVencimentos(RECEITAS, HOJE);
    assert.deepEqual(p.linhas.map((l) => l.id), ["aberto"]);
    assert.equal(p.total, 150);
    assert.equal(p.semVencimento.quantidade, 0);
    const semData = proximosVencimentos([r("x", { valor: 80 })], HOJE);
    assert.deepEqual(semData.semVencimento, { quantidade: 1, total: 80 });
  });
});

describe("fechamento", () => {
  it("mês correndo é andamento normal, não pendência", () => {
    assert.deepEqual(estadoDoFechamento("2026-09", "2026-09-10", null, true), { tipo: "em-andamento", diasParaOFim: 20 });
  });
  it("perto do fim pede preparo; depois do fim, atraso", () => {
    assert.deepEqual(estadoDoFechamento("2026-09", "2026-09-29", null, true), { tipo: "perto-do-fim", diasParaOFim: 1 });
    assert.deepEqual(estadoDoFechamento("2026-08", "2026-09-20", null, true), { tipo: "atrasado", diasDesdeOFim: 20 });
  });
  it("fechado e sem movimento não pedem nada", () => {
    assert.equal(estadoDoFechamento("2026-08", "2026-09-20", "fechado", true).tipo, "fechado");
    assert.equal(estadoDoFechamento("2026-08", "2026-09-20", "aberto", false).tipo, "sem-movimento");
  });
});

describe("Atenção hoje", () => {
  const vazia: EntradaDaAtencao = {
    aguardandoLancamento: 0, conveniosSemPreco: 0, lancamentosSemValor: 0, podeConfigurarPrecos: true,
    notasSemBaixa: { quantidade: 0, saldo: 0 }, cobrancasAtrasadas: { convenios: 0, valor: 0 },
    glosasComPrazoVencendo: 0, despesasRecorrentesFaltando: 0, repassesPendentes: { quantidade: 0, valor: 0 },
    fechamentos: [], depoisDoFechamento: [], producaoMudou: [],
  };

  it("sem nada pendente, fila vazia — mês correndo não entra", () => {
    assert.deepEqual(montarAtencao({ ...vazia,
      fechamentos: [{ competencia: "2026-09", estado: { tipo: "em-andamento", diasParaOFim: 20 } }] }), []);
  });

  it("o exemplo do pedido: convênios sem preço, com o botão de configurar", () => {
    const [p] = montarAtencao({ ...vazia, conveniosSemPreco: 12, lancamentosSemValor: 12 });
    assert.equal(p.titulo, "12 convênios ativos sem preço configurado");
    assert.equal(p.detalhe, "Lançamentos desses convênios podem ficar sem valor.");
    assert.equal(p.acao, "Configurar preços");
    assert.match(p.impacto.texto, /12 lançamentos desta competência já estão em R\$ 0,00/);
    assert.equal(montarAtencao({ ...vazia, conveniosSemPreco: 1, podeConfigurarPrecos: false })[0].acao,
      "Conferir a tabela de preços");
  });

  it("nenhum botão diz só 'Ver', e todo item tem impacto", () => {
    const tudo = montarAtencao({
      aguardandoLancamento: 2, conveniosSemPreco: 1, lancamentosSemValor: 0, podeConfigurarPrecos: true,
      notasSemBaixa: { quantidade: 1, saldo: 90 }, cobrancasAtrasadas: { convenios: 1, valor: 500 },
      glosasComPrazoVencendo: 1, despesasRecorrentesFaltando: 1, repassesPendentes: { quantidade: 2, valor: 300 },
      fechamentos: [{ competencia: "2026-08", estado: { tipo: "atrasado", diasDesdeOFim: 20 } }],
      depoisDoFechamento: [["2026-07", 1]],
      producaoMudou: [{ mes: "2026-07", antes: { anotacoes: 2, valor: 100 }, agora: { anotacoes: 3, valor: 160 } }],
    });
    assert.equal(tudo.length, 10);
    for (const p of tudo) {
      assert.notEqual(p.acao.trim().toLowerCase(), "ver");
      assert.ok(p.impacto.texto.length > 0);
    }
    const nivel = tudo.map((p) => ["alta", "media", "baixa"].indexOf(p.prioridade));
    assert.ok(nivel.every((n, i) => i === 0 || n >= nivel[i - 1]), "alta antes de média antes de baixa");
    assert.equal(tudo.find((p) => p.chave === "producao-2026-07")?.impacto.valor, 60);
    assert.equal(tudo.find((p) => p.chave === "fechamento-2026-08")?.prioridade, "alta");
  });

  it("fechamento atrasado há poucos dias é média; perto do fim é baixa", () => {
    const [atraso] = montarAtencao({ ...vazia, fechamentos: [{ competencia: "2026-08", estado: { tipo: "atrasado", diasDesdeOFim: 3 } }] });
    assert.equal(atraso.prioridade, "media");
    assert.equal(atraso.acao, "Fechar o mês");
    assert.equal(atraso.periodo, "2026-08");
    const [fim] = montarAtencao({ ...vazia, fechamentos: [{ competencia: "2026-09", estado: { tipo: "perto-do-fim", diasParaOFim: 0 } }] });
    assert.equal(fim.prioridade, "baixa");
    assert.equal(fim.titulo, "O mês termina hoje");
  });

  it("cada item leva a uma aba que existe", () => {
    const ABAS = ["lancamentos", "valores", "notas", "idade", "despesas", "repasses", "fechamento", "glosas"];
    const tudo = montarAtencao({ ...vazia, aguardandoLancamento: 1, conveniosSemPreco: 1,
      notasSemBaixa: { quantidade: 1, saldo: 1 }, cobrancasAtrasadas: { convenios: 1, valor: 1 },
      glosasComPrazoVencendo: 1, despesasRecorrentesFaltando: 1, repassesPendentes: { quantidade: 1, valor: 1 } });
    for (const p of tudo) assert.ok(ABAS.includes(p.tarefa), p.tarefa);
  });
});

it("nomeDaCompetencia escreve o mês por extenso", () => {
  assert.equal(nomeDaCompetencia("2026-09"), "Setembro de 2026");
});
