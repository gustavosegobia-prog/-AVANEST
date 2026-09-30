import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  contagem, contagemEscrita, diasDaSemana, filtrarEscala, filtrosAtivos, horarioEscrito, inicioDaSemana,
  pendenciasDaEscala, semanaEscrita, situacaoDaConfirmacao, situacaoDaExecucao, situacaoDoPagamento,
  sobreposicoes, somarDias, valorAusente, FILTROS_DA_ESCALA,
  type PlantaoDoPainel,
} from "./escala-painel.ts";

const EU = "eu";
let n = 0;
const p = (x: Partial<PlantaoDoPainel>): PlantaoDoPainel => ({
  id: `p${++n}`, perfil_id: EU, local_id: "h1", data: "2026-09-10", hora_inicio: "07:00:00", hora_fim: "19:00:00",
  horas: 12, valor: 900, valor_informado: true, situacao: "escalado", pago_em: null, privado: false, confirmado_em: null, ...x,
});

describe("contagem: plantões, turnos e horas não se confundem", () => {
  it("o caso real: 14 lançamentos, quatro de 24h → 14 plantões, 18 turnos, 216 h", () => {
    const mes = [
      ...Array.from({ length: 10 }, (_, i) => p({ data: `2026-09-${String(i + 1).padStart(2, "0")}`, hora_inicio: "19:00:00", hora_fim: "07:00:00", horas: 12 })),
      ...Array.from({ length: 4 }, (_, i) => p({ data: `2026-09-${String(i + 20)}`, hora_inicio: "07:00:00", hora_fim: "07:00:00", horas: 24 })),
    ];
    const c = contagem(mes);
    assert.deepEqual(c, { plantoes: 14, turnos: 18, horas: 216 });
    assert.equal(contagemEscrita(c), "14 plantões · 18 turnos de 12h · 216 h");
  });

  it("cancelado não conta em nenhum dos três, e singular sai no singular", () => {
    const c = contagem([p({}), p({ situacao: "cancelado" })]);
    assert.equal(contagemEscrita(c), "1 plantão · 1 turno de 12h · 12 h");
  });

  it("resumo e lista usam o mesmo filtro: mesmo conjunto, mesmos números", () => {
    const mes = [p({ local_id: "h1" }), p({ local_id: "h2", horas: 24, hora_fim: "07:00:00" })];
    const filtrado = filtrarEscala(mes, { ...FILTROS_DA_ESCALA, local: "h2" }, new Date(2026, 8, 30));
    assert.equal(filtrado.length, 1);
    assert.deepEqual(contagem(filtrado), { plantoes: 1, turnos: 2, horas: 24 });
  });
});

describe("horário: a virada do dia é dita", () => {
  it("24h e noturno viram o dia; diurno não", () => {
    assert.equal(horarioEscrito({ hora_inicio: "07:00:00", hora_fim: "07:00:00", horas: 24 }), "07h → 07h do dia seguinte · 24h");
    assert.equal(horarioEscrito({ hora_inicio: "19:00:00", hora_fim: "07:00:00", horas: 12 }), "19h → 07h do dia seguinte · 12h");
    assert.equal(horarioEscrito({ hora_inicio: "07:00:00", hora_fim: "19:00:00", horas: 12 }), "07h–19h · 12h");
    assert.equal(horarioEscrito({ hora_inicio: "07:30:00", hora_fim: "13:00:00", horas: 5.5 }), "07h30–13h · 5,5h");
  });
});

describe("situações separadas", () => {
  const agora = new Date(2026, 8, 30, 10, 0); // 30/09 às 10h, hora local
  it("confirmado, realizado e recebido são três coisas", () => {
    const x = p({ data: "2026-09-10", confirmado_em: "2026-09-10T20:00:00Z", situacao: "realizado" });
    assert.equal(situacaoDaConfirmacao(x, agora).rotulo, "Confirmado");
    assert.equal(situacaoDaExecucao(x).rotulo, "Realizado");
    assert.equal(situacaoDoPagamento(x).rotulo, "A receber", "confirmado e realizado ainda não é recebido");
    const pago = p({ situacao: "pago", pago_em: "2026-09-25" });
    assert.equal(situacaoDoPagamento(pago).rotulo, "Pago em 25/09/2026");
    assert.equal(situacaoDaExecucao(pago).rotulo, "Realizado");
  });

  it("confirmação: pendente na janela, não confirmado depois, aguardando antes", () => {
    assert.equal(situacaoDaConfirmacao(p({ data: "2026-09-30" }), agora).rotulo, "Pendente");
    assert.equal(situacaoDaConfirmacao(p({ data: "2026-09-20" }), agora).rotulo, "Não confirmado");
    assert.equal(situacaoDaConfirmacao(p({ data: "2026-10-02" }), agora).rotulo, "Aguardando o dia");
    // O noturno de ontem ainda está na janela até 07h30 de hoje.
    assert.equal(situacaoDaConfirmacao(p({ data: "2026-09-29", hora_inicio: "19:00:00", hora_fim: "07:00:00" }), new Date(2026, 8, 30, 7, 20)).rotulo, "Pendente");
    assert.equal(situacaoDaConfirmacao(p({ privado: true }), agora).rotulo, "Não se aplica");
  });

  it("valor zero é diferente de valor não preenchido", () => {
    assert.equal(situacaoDoPagamento(p({ valor: 0, valor_informado: true })).rotulo, "Valor zero");
    assert.equal(situacaoDoPagamento(p({ valor: 0, valor_informado: false })).rotulo, "Valor não preenchido");
    assert.equal(valorAusente(p({ valor: 0, valor_informado: undefined })), true, "sem a coluna, zero é tratado como não preenchido");
    assert.equal(valorAusente(p({ valor: 500, valor_informado: undefined })), false);
  });
});

describe("pendências", () => {
  it("sobreposição inclusive atravessando a meia-noite; da mesma pessoa só", () => {
    const noite = p({ data: "2026-09-10", hora_inicio: "19:00:00", hora_fim: "07:00:00" });
    const manha = p({ data: "2026-09-11", hora_inicio: "06:00:00", hora_fim: "13:00:00", horas: 7 });
    const colega = p({ perfil_id: "outro", data: "2026-09-11", hora_inicio: "06:00:00", hora_fim: "13:00:00" });
    const encostado = p({ data: "2026-09-11", hora_inicio: "13:00:00", hora_fim: "19:00:00", horas: 6 });
    const s = sobreposicoes([noite, manha, colega, encostado]);
    assert.equal(s.length, 1, "13h–19h encostado no 06h–13h não é sobreposição");
    assert.deepEqual([s[0].a.id, s[0].b.id], [noite.id, manha.id]);
  });

  it("confirmações e valores pendentes são só os meus", () => {
    const agora = new Date(2026, 8, 30, 10, 0);
    const pend = pendenciasDaEscala([
      p({ data: "2026-09-30" }), p({ data: "2026-09-30", perfil_id: "outro" }),
      p({ valor: 0, valor_informado: false }), p({ perfil_id: "outro", valor: 0, valor_informado: false }),
    ], EU, agora);
    assert.equal(pend.confirmacoes.length, 1);
    assert.equal(pend.semValor.length, 1);
  });
});

describe("filtros", () => {
  const agora = new Date(2026, 8, 30, 10, 0);
  it("turno usa a cobertura real: o 24h aparece de manhã, de tarde e de noite", () => {
    const dia24 = p({ hora_inicio: "07:00:00", hora_fim: "07:00:00", horas: 24 });
    const noite = p({ hora_inicio: "19:00:00", hora_fim: "07:00:00" });
    assert.equal(filtrarEscala([dia24, noite], { ...FILTROS_DA_ESCALA, turno: "manha" }, agora).length, 1);
    assert.equal(filtrarEscala([dia24, noite], { ...FILTROS_DA_ESCALA, turno: "noite" }, agora).length, 2);
  });
  it("situação filtra pela dimensão certa", () => {
    const lista = [p({ situacao: "pago" }), p({ situacao: "realizado" }), p({ data: "2026-09-30" })];
    assert.equal(filtrarEscala(lista, { ...FILTROS_DA_ESCALA, situacao: "pago" }, agora).length, 1);
    assert.equal(filtrarEscala(lista, { ...FILTROS_DA_ESCALA, situacao: "a_receber" }, agora).length, 2);
    assert.equal(filtrarEscala(lista, { ...FILTROS_DA_ESCALA, situacao: "confirmacao_pendente" }, agora).length, 1);
  });
});

describe("filtros de pendência", () => {
  const agora = new Date(2026, 8, 30, 10, 0);
  it("valor não preenchido é só o meu, e zero informado não entra", () => {
    const lista = [
      p({ valor: 0, valor_informado: false }), p({ valor: 0, valor_informado: true }),
      p({ perfil_id: "outro", valor: 0, valor_informado: false }),
    ];
    assert.equal(filtrarEscala(lista, { ...FILTROS_DA_ESCALA, situacao: "sem_valor" }, agora, EU).length, 1);
  });
  it("sobreposição traz os dois plantões que se cruzam", () => {
    const noite = p({ data: "2026-09-10", hora_inicio: "19:00:00", hora_fim: "07:00:00" });
    const manha = p({ data: "2026-09-11", hora_inicio: "06:00:00", hora_fim: "13:00:00", horas: 7 });
    const solto = p({ data: "2026-09-15" });
    const r = filtrarEscala([noite, manha, solto], { ...FILTROS_DA_ESCALA, situacao: "sobreposicao" }, agora, EU);
    assert.deepEqual(r.map((x) => x.id).sort(), [noite.id, manha.id].sort());
  });
  it("filtrosAtivos só é verdadeiro quando algo mudou", () => {
    assert.equal(filtrosAtivos(FILTROS_DA_ESCALA), false);
    assert.equal(filtrosAtivos({ ...FILTROS_DA_ESCALA, turno: "noite" }), true);
  });
});

describe("semana", () => {
  it("começa no domingo e atravessa a virada do mês", () => {
    assert.equal(inicioDaSemana("2026-10-01"), "2026-09-27");
    assert.equal(inicioDaSemana("2026-09-27"), "2026-09-27");
    assert.deepEqual(diasDaSemana("2026-09-27"), ["2026-09-27", "2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03"]);
    assert.equal(semanaEscrita("2026-09-27"), "27/09 a 03/10/2026");
    assert.equal(semanaEscrita("2026-12-27"), "27/12/2026 a 02/01/2027");
  });
  it("somar dias não tropeça no horário de verão nem no ano bissexto", () => {
    assert.equal(somarDias("2028-02-28", 1), "2028-02-29");
    assert.equal(somarDias("2026-11-01", 7), "2026-11-08");
    assert.equal(somarDias("2026-10-04", -7), "2026-09-27");
  });
});
