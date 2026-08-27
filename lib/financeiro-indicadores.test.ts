import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  competenciaDoItem, diasEntre, emAberto, envelhecimento, glosa, idadeDoItem,
  mesAnterior, prazoMedioPorConvenio, referenciaDeIdade, saldoAReceber,
  saldoDoItem, saldoVencido, ticketMedio, totaisDoEnvelhecimento, variacao,
  type ItemFinanceiro,
} from "./financeiro-indicadores.ts";

const HOJE = "2026-08-27";

const item = (dados: Partial<ItemFinanceiro> & { id?: string } = {}) => ({
  id: dados.id ?? "x",
  convenio: "Unimed",
  valor: 1000,
  recebido: 0,
  status: "aguardando",
  created_at: "2026-08-01T10:00:00Z",
  ...dados,
});

describe("saldo de um atendimento", () => {
  it("é o que falta receber", () => {
    assert.equal(saldoDoItem(item({ valor: 1000, recebido: 400 })), 600);
  });

  it("nunca fica negativo", () => {
    // Acontece quando o convênio deposita um lote fechado e a baixa é lançada
    // item a item. Saldo negativo abateria a dívida de outro paciente.
    assert.equal(saldoDoItem(item({ valor: 1000, recebido: 1300 })), 0);
  });

  it("trata valor ausente como zero em vez de NaN", () => {
    assert.equal(saldoDoItem(item({ valor: undefined as unknown as number })), 0);
  });
});

describe("o que ainda é cobrável", () => {
  it("cancelado sai da conta", () => {
    assert.equal(emAberto(item({ status: "cancelado" })), false);
  });

  it("glosa CONTINUA na conta", () => {
    // É exatamente o dinheiro que se está tentando recuperar. Tirá-la do saldo
    // esconderia o problema em vez de mostrá-lo.
    assert.equal(emAberto(item({ status: "glosa" })), true);
  });

  it("quitado sai da conta", () => {
    assert.equal(emAberto(item({ valor: 1000, recebido: 1000 })), false);
  });
});

describe("saldo a receber", () => {
  it("soma todo o histórico, não só um mês", () => {
    // O ponto da tela: o dinheiro do mês passado ainda está na rua.
    const total = saldoAReceber([
      item({ valor: 1000, recebido: 0, created_at: "2026-06-02T10:00:00Z" }),
      item({ valor: 800, recebido: 300, created_at: "2026-07-02T10:00:00Z" }),
      item({ valor: 500, recebido: 0, created_at: "2026-08-02T10:00:00Z" }),
      item({ valor: 900, recebido: 0, status: "cancelado" }),
    ]);
    assert.equal(total, 1000 + 500 + 500);
  });
});

describe("a régua da idade", () => {
  it("prefere o vencimento", () => {
    assert.equal(referenciaDeIdade(item({
      nota_vencimento_at: "2026-07-10", nota_emitida_at: "2026-06-25",
    })), "2026-07-10");
  });

  it("sem vencimento, vale a emissão", () => {
    assert.equal(referenciaDeIdade(item({ nota_emitida_at: "2026-06-25" })), "2026-06-25");
  });

  it("sem nota nenhuma, vale a criação do lançamento", () => {
    // De propósito: atendimento lançado há noventa dias sem nota emitida é um
    // problema de faturamento, não um acerto "que ainda não venceu".
    assert.equal(referenciaDeIdade(item({ created_at: "2026-05-04T08:00:00Z" })), "2026-05-04");
  });

  it("conta os dias corridos", () => {
    assert.equal(diasEntre("2026-08-01", "2026-08-27"), 26);
    assert.equal(idadeDoItem(item({ nota_vencimento_at: "2026-07-28" }), HOJE), 30);
  });

  it("devolve negativo para o que ainda não venceu", () => {
    assert.equal(idadeDoItem(item({ nota_vencimento_at: "2026-09-10" }), HOJE), -14);
  });
});

describe("saldo vencido", () => {
  it("conta só o que passou do vencimento declarado", () => {
    const total = saldoVencido([
      item({ valor: 1000, nota_vencimento_at: "2026-08-01" }),
      item({ valor: 700, nota_vencimento_at: "2026-09-30" }),
    ], HOJE);
    assert.equal(total, 1000);
  });

  it("lançamento sem vencimento não entra", () => {
    // Sem esta regra todo lançamento novo viraria "vencido" no dia seguinte e
    // o número perderia o sentido de alguém não ter cumprido o combinado.
    assert.equal(saldoVencido([item({ valor: 1000 })], HOJE), 0);
  });

  it("cancelado não entra mesmo vencido", () => {
    assert.equal(saldoVencido(
      [item({ valor: 1000, status: "cancelado", nota_vencimento_at: "2026-01-01" })], HOJE), 0);
  });
});

describe("envelhecimento", () => {
  const linhas = envelhecimento([
    item({ convenio: "Unimed", valor: 1000, nota_vencimento_at: "2026-08-20" }),   // 7 dias
    item({ convenio: "Unimed", valor: 2000, nota_vencimento_at: "2026-07-10" }),   // 48 dias
    item({ convenio: "Unimed", valor: 400, nota_vencimento_at: "2026-04-01" }),    // 148 dias
    item({ convenio: "Bradesco", valor: 900, nota_vencimento_at: "2026-06-20" }),  // 68 dias
    item({ convenio: "Bradesco", valor: 100, valor_pago: 0, status: "cancelado" }),
  ], HOJE);

  it("agrupa por convênio e ordena pelo maior saldo", () => {
    assert.deepEqual(linhas.map((l) => l.convenio), ["Unimed", "Bradesco"]);
  });

  it("põe cada saldo na sua faixa", () => {
    const unimed = linhas[0];
    assert.equal(unimed.faixas.ate30, 1000);
    assert.equal(unimed.faixas.ate60, 2000);
    assert.equal(unimed.faixas.ate90, 0);
    assert.equal(unimed.faixas.acima90, 400);
    assert.equal(unimed.total, 3400);
  });

  it("o que ainda não venceu cai na primeira faixa", () => {
    // Idade negativa é "no prazo", que para efeito de cobrança é o mesmo lugar
    // de quem venceu ontem: nenhum dos dois exige ligação hoje.
    const [linha] = envelhecimento(
      [item({ valor: 500, nota_vencimento_at: "2026-12-01" })], HOJE);
    assert.equal(linha.faixas.ate30, 500);
  });

  it("cancelado fica de fora", () => {
    assert.equal(linhas[1].total, 900);
  });

  it("os totais fecham com a soma das linhas", () => {
    const totais = totaisDoEnvelhecimento(linhas);
    assert.equal(totais.total, 3400 + 900);
    assert.equal(totais.faixas.ate30, 1000);
    assert.equal(totais.faixas.ate60, 2000);
    assert.equal(totais.faixas.ate90, 900);
    assert.equal(totais.faixas.acima90, 400);
    assert.equal(
      Object.values(totais.faixas).reduce((a, b) => a + b, 0),
      totais.total,
      "a soma das faixas tem de bater com o total",
    );
  });

  it("lista vazia devolve zero, não NaN", () => {
    assert.deepEqual(totaisDoEnvelhecimento([]).total, 0);
  });
});

describe("glosa", () => {
  it("mede em dinheiro e em fatia do faturado", () => {
    const g = glosa([
      item({ valor: 8000, status: "glosa", glosa_valor: 2000 }),
      item({ valor: 2000, status: "aguardando" }),
    ]);
    assert.equal(g.quantidade, 1);
    assert.equal(g.valor, 2000);
    assert.equal(g.percentual, 20);
  });

  it("sem valor glosado preenchido, vale o saldo em aberto", () => {
    // É o que o convênio deixou de pagar, que é o que a glosa é.
    const g = glosa([item({ valor: 1000, recebido: 300, status: "glosa" })]);
    assert.equal(g.valor, 700);
  });

  it("não devolve percentual quando não houve faturamento", () => {
    // Dividir por zero daria Infinity, e "∞% de glosa" é pior que não mostrar.
    assert.equal(glosa([]).percentual, null);
  });

  it("três glosas pequenas e três grandes deixam de parecer iguais", () => {
    const pequenas = glosa([1, 2, 3].map((n) =>
      item({ id: `p${n}`, valor: 80, status: "glosa", glosa_valor: 80 })));
    const grandes = glosa([1, 2, 3].map((n) =>
      item({ id: `g${n}`, valor: 8000, status: "glosa", glosa_valor: 8000 })));
    assert.equal(pequenas.quantidade, grandes.quantidade);
    assert.notEqual(pequenas.valor, grandes.valor);
  });
});

describe("comparação com o mês anterior", () => {
  it("volta um mês", () => {
    assert.equal(mesAnterior("2026-08"), "2026-07");
  });

  it("vira o ano", () => {
    assert.equal(mesAnterior("2026-01"), "2025-12");
  });

  it("a competência é a declarada, ou o mês do lançamento", () => {
    assert.equal(competenciaDoItem(item({ periodo: "2026-05" })), "2026-05");
    assert.equal(competenciaDoItem(item({ created_at: "2026-03-14T09:00:00Z" })), "2026-03");
  });

  it("calcula a variação", () => {
    assert.equal(variacao(1200, 1000), 20);
    assert.equal(variacao(800, 1000), -20);
  });

  it("não devolve variação quando a base é zero", () => {
    // De zero para dez mil não é "aumento de mil por cento", é o primeiro mês.
    assert.equal(variacao(10000, 0), null);
  });
});

describe("prazo médio de recebimento", () => {
  const itens = [
    item({ id: "a", convenio: "Unimed", nota_emitida_at: "2026-06-01" }),
    item({ id: "b", convenio: "Unimed", nota_emitida_at: "2026-06-01" }),
    item({ id: "c", convenio: "Bradesco", nota_emitida_at: "2026-06-01" }),
    item({ id: "d", convenio: "Amil" }), // sem nota emitida
  ];

  it("pesa pelo valor, e não por pagamento", () => {
    // R$ 50 em 5 dias e R$ 50.000 em 90 não dão "47 dias e meio" na prática:
    // dão quase 90, porque é onde o dinheiro está. Média simples aqui daria um
    // número bonito e uma projeção de caixa errada.
    const [unimed] = prazoMedioPorConvenio(itens, [
      { atendimento_id: "a", valor: 50, paid_at: "2026-06-06" },
      { atendimento_id: "b", valor: 50000, paid_at: "2026-08-30" },
    ]);
    assert.equal(unimed.convenio, "Unimed");
    assert.equal(unimed.pagamentos, 2);
    // (5×50 + 90×50000) / 50050 ≈ 89,9 → 90
    assert.equal(unimed.dias, 90);
  });

  it("ordena do mais demorado para o mais rápido", () => {
    const prazos = prazoMedioPorConvenio(itens, [
      { atendimento_id: "a", valor: 1000, paid_at: "2026-06-11" },   // Unimed, 10 dias
      { atendimento_id: "c", valor: 1000, paid_at: "2026-08-30" },   // Bradesco, 90 dias
    ]);
    assert.deepEqual(prazos.map((p) => p.convenio), ["Bradesco", "Unimed"]);
  });

  it("ignora pagamento de atendimento sem nota emitida", () => {
    // Sem data de emissão não há de onde contar, e usar a criação do lançamento
    // misturaria demora do convênio com demora do próprio faturamento.
    const prazos = prazoMedioPorConvenio(itens, [
      { atendimento_id: "d", valor: 1000, paid_at: "2026-08-30" },
    ]);
    assert.deepEqual(prazos, []);
  });

  it("data de pagamento anterior à emissão entra como zero, não como negativo", () => {
    const [p] = prazoMedioPorConvenio(itens, [
      { atendimento_id: "a", valor: 1000, paid_at: "2026-05-20" },
    ]);
    assert.equal(p.dias, 0);
  });

  it("pagamento de valor zero não entra na média", () => {
    const prazos = prazoMedioPorConvenio(itens, [
      { atendimento_id: "a", valor: 0, paid_at: "2026-09-01" },
    ]);
    assert.deepEqual(prazos, []);
  });
});

describe("ticket médio", () => {
  it("é a média do faturado", () => {
    assert.equal(ticketMedio([item({ valor: 300 }), item({ valor: 500 })]), 400);
  });

  it("lista vazia devolve zero, não NaN", () => {
    assert.equal(ticketMedio([]), 0);
  });
});
