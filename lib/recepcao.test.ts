import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  acoesDaConsulta, buscarPacientes, confirmacaoDaConsulta, etapaDaConsulta, indicadoresDoDia, motivoParaRecusar,
  proximaDataComConsultas, proximoHorarioLivre, horarioOcupado, totaisDoMes, somarDiasIso, dataPorExtenso,
  type ConsultaDaAgenda,
} from "./recepcao.ts";

const HOJE = "2026-09-30";
let n = 0;
const c = (x: Partial<ConsultaDaAgenda>): ConsultaDaAgenda => ({
  id: `a${++n}`, patient_id: "p", avaliacao_id: null, data: HOJE, horario: "09:00:00", status: "agendado", ...x,
});

describe("etapas lidas dos estados que já existem", () => {
  it("agendado e confirmado são Agendado; presente é Aguardando; avaliação decide o resto", () => {
    assert.equal(etapaDaConsulta(c({})), "agendado");
    assert.equal(etapaDaConsulta(c({ status: "confirmado" })), "agendado");
    assert.equal(etapaDaConsulta(c({ status: "presente" })), "aguardando");
    assert.equal(etapaDaConsulta(c({ status: "presente" }), { etapa: "em_atendimento", medico_id: null }), "em_atendimento");
    assert.equal(etapaDaConsulta(c({ status: "presente" }), { etapa: "concluido", medico_id: null }), "concluido");
  });
  it("falta, cancelamento e reagendamento ficam com o próprio nome, mesmo com avaliação", () => {
    assert.equal(etapaDaConsulta(c({ status: "faltou" }), { etapa: "concluido", medico_id: null }), "faltou");
    assert.equal(etapaDaConsulta(c({ status: "cancelado" })), "cancelado");
    assert.equal(etapaDaConsulta(c({ status: "reagendado" })), "reagendado");
  });
  it("confirmação é detalhe do agendado", () => {
    assert.equal(confirmacaoDaConsulta(c({})), "pendente");
    assert.equal(confirmacaoDaConsulta(c({ status: "confirmado" })), "confirmada");
    assert.equal(confirmacaoDaConsulta(c({ status: "presente" })), null);
  });
});

describe("ações só as que o banco aceita", () => {
  it("hoje: chegada é a principal; no futuro, não há chegada nem falta", () => {
    assert.deepEqual(acoesDaConsulta(c({}), HOJE), ["chegada", "confirmar", "reagendar", "falta", "cancelar"]);
    assert.deepEqual(acoesDaConsulta(c({ data: "2026-10-05" }), HOJE), ["confirmar", "reagendar", "cancelar"]);
  });
  it("chegou: só desfazer, e só se o atendimento não começou", () => {
    assert.deepEqual(acoesDaConsulta(c({ status: "presente" }), HOJE), ["desfazer_chegada"]);
    assert.deepEqual(acoesDaConsulta(c({ status: "presente", avaliacao_id: "av" }), HOJE), []);
  });
  it("falta e cancelada: reagendar ou reativar; reagendada: nada", () => {
    assert.deepEqual(acoesDaConsulta(c({ status: "faltou" }), HOJE), ["reagendar", "reativar"]);
    assert.deepEqual(acoesDaConsulta(c({ status: "cancelado" }), HOJE), ["reagendar", "reativar"]);
    assert.deepEqual(acoesDaConsulta(c({ status: "reagendado" }), HOJE), []);
  });
  it("as mensagens de recusa são as mesmas do banco", () => {
    const sql = readFileSync(new URL("../supabase/migrations/202609300016_agenda_da_recepcao.sql", import.meta.url), "utf8");
    const casos: [string, string, string, boolean][] = [
      ["reagendado", "agendado", HOJE, false], ["agendado", "presente", "2026-10-01", false],
      ["presente", "agendado", HOJE, true], ["presente", "faltou", HOJE, false],
      ["cancelado", "presente", HOJE, false], ["presente", "reagendado", HOJE, false],
    ];
    for (const [de, para, data, av] of casos) {
      const m = motivoParaRecusar(de, para, data, av, HOJE);
      assert.ok(m, `${de}→${para} deveria ser recusado`);
      assert.ok(sql.includes(m!), `a mensagem "${m}" não está no banco`);
    }
    assert.equal(motivoParaRecusar("agendado", "presente", HOJE, false, HOJE), null);
    assert.equal(motivoParaRecusar("faltou", "reagendado", "2026-09-01", false, HOJE), null);
  });
});

describe("indicadores do dia e totais do mês", () => {
  it("previstas não contam desmarcadas; cada etapa conta uma vez", () => {
    const dia = [
      c({}), c({ status: "confirmado" }), c({ status: "presente" }), c({ id: "emAt", status: "presente" }),
      c({ id: "fim", status: "presente" }), c({ status: "faltou" }), c({ status: "cancelado" }), c({ status: "reagendado" }),
    ];
    const and = new Map([["emAt", { etapa: "em_atendimento" as const, medico_id: null }], ["fim", { etapa: "concluido" as const, medico_id: null }]]);
    assert.deepEqual(indicadoresDoDia(dia, and), {
      previstas: 6, confirmacoesPendentes: 1, aguardando: 1, emAtendimento: 1, concluidas: 1, faltas: 1, canceladas: 1,
    });
  });
  it("totais do mês e próxima data com consulta ativa", () => {
    const todas = [c({ data: "2026-09-02", status: "presente" }), c({ data: "2026-10-03", status: "cancelado" }), c({ data: "2026-10-07" })];
    assert.equal(totaisDoMes(todas, "2026-09").compareceram, 1);
    assert.equal(proximaDataComConsultas(todas, HOJE), "2026-10-07", "cancelada não conta como próxima");
    assert.equal(proximaDataComConsultas(todas, "2026-10-07"), null);
  });
});

describe("busca por nome, CPF ou telefone", () => {
  const pac = [
    { id: "1", nome: "Maria José Conceição", cpf: "12345678901", telefone: "44999887766" },
    { id: "2", nome: "João Silva", cpf: "98765432100", telefone: "4433221100" },
  ];
  it("nome sem acento, CPF e telefone em qualquer formato", () => {
    assert.deepEqual(buscarPacientes(pac, "conceicao").map((p) => p.id), ["1"]);
    assert.deepEqual(buscarPacientes(pac, "123.456").map((p) => p.id), ["1"]);
    assert.deepEqual(buscarPacientes(pac, "(44) 3322").map((p) => p.id), ["2"]);
    assert.deepEqual(buscarPacientes(pac, "j"), [], "uma letra não busca");
  });
});

describe("datas e horários", () => {
  it("próximo livre pula ocupados e almoço; desmarcada libera o horário", () => {
    const amanha = "2026-10-01";
    assert.equal(proximoHorarioLivre(amanha, [{ horario: "08:30:00", status: "agendado" }]), "09:00:00");
    assert.equal(proximoHorarioLivre(amanha, [{ horario: "08:30:00", status: "cancelado" }]), "08:30:00");
    const manhaCheia = Array.from({ length: 7 }, (_, i) => ({ horario: `${String(8 + Math.floor((30 + i * 30) / 60)).padStart(2, "0")}:${(30 + i * 30) % 60 ? "30" : "00"}:00`, status: "agendado" }));
    assert.equal(proximoHorarioLivre(amanha, manhaCheia), "13:30:00");
    assert.equal(horarioOcupado([{ id: "x", data: amanha, horario: "10:00:00", status: "confirmado" }], amanha, "10:00"), true);
    assert.equal(horarioOcupado([{ id: "x", data: amanha, horario: "10:00:00", status: "confirmado" }], amanha, "10:00", "x"), false);
  });
  it("virada de mês e ano, e data por extenso", () => {
    assert.equal(somarDiasIso("2026-09-30", 1), "2026-10-01");
    assert.equal(somarDiasIso("2026-12-31", 1), "2027-01-01");
    assert.equal(somarDiasIso("2026-03-01", -1), "2026-02-28");
    assert.equal(dataPorExtenso("2026-09-30"), "quarta-feira, 30/09/2026");
  });
});
