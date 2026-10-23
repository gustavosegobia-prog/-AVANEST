import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  andamentoPelasAvaliacoes, avaliacaoNoEscopo, consultaNoEscopo, cpfMascarado, destaqueDoDia, intervaloDoPeriodo,
  momentoRelativo, paraRetomar, pendenciasVerificadas, proximoAtendimento, resumoDoDia,
  type AvaliacaoResumo, type Escopo,
} from "./area-medica.ts";
import type { ConsultaDaAgenda } from "./recepcao.ts";

const HOJE = "2026-09-30", EU = "eu";
let n = 0;
const c = (x: Partial<ConsultaDaAgenda>): ConsultaDaAgenda => ({
  id: `c${++n}`, patient_id: `p${n}`, avaliacao_id: null, data: HOJE, horario: "09:00:00", status: "agendado", ...x,
});
const av = (x: Partial<AvaliacaoResumo>): AvaliacaoResumo => ({
  id: `a${++n}`, patient_id: `p${n}`, created_by: EU, status: "rascunho", created_at: "2026-09-20T10:00:00Z",
  updated_at: "2026-09-20T10:00:00Z", concluida_at: null, local_atendimento_id: "l1", ...x,
});

describe("o dia: nada é deduzido do horário", () => {
  it("agendado, aguardando, em atendimento e avaliações em andamento são coisas distintas", () => {
    const emCurso = av({ id: "avCurso" });
    const antiga = av({ updated_at: "2026-09-01T10:00:00Z" });
    const dia = [
      c({ horario: "07:00:00" }), // já passou da hora, mas ninguém registrou chegada: continua agendado
      c({ status: "presente" }),
      c({ status: "presente", avaliacao_id: "avCurso" }),
      c({ status: "cancelado" }), c({ status: "faltou" }),
    ];
    const and = andamentoPelasAvaliacoes(dia, new Map([["avCurso", emCurso]]));
    assert.deepEqual(resumoDoDia(dia, and, paraRetomar([emCurso, antiga])),
      { agendados: 1, aguardando: 1, emAtendimento: 1, emAndamento: 2 });
  });
  it("várias avaliações para retomar: todas, da mais recente para a mais antiga", () => {
    const r = paraRetomar([av({ id: "x", updated_at: "2026-09-02T00:00:00Z" }), av({ id: "y", updated_at: "2026-09-29T00:00:00Z" }), av({ id: "z", status: "concluida" })]);
    assert.deepEqual(r.map((a) => a.id), ["y", "x"]);
  });
  it("próximo atendimento pula concluído, desmarcado e falta", () => {
    const fim = av({ id: "fim", status: "concluida" });
    const dia = [
      c({ id: "k1", horario: "08:00:00", status: "presente", avaliacao_id: "fim" }),
      c({ id: "k2", horario: "08:30:00", status: "cancelado" }),
      c({ id: "k3", horario: "10:00:00" }), c({ id: "k4", horario: "09:30:00", status: "faltou" }),
    ];
    assert.equal(proximoAtendimento(dia, andamentoPelasAvaliacoes(dia, new Map([["fim", fim]])))?.id, "k3");
  });
});

describe("escopo", () => {
  const meus: Escopo = { pessoa: "meus", local: "todos" };
  it("minhas avaliações e local atual", () => {
    assert.equal(avaliacaoNoEscopo(av({ created_by: "outro" }), meus, EU, "l1"), false);
    assert.equal(avaliacaoNoEscopo(av({ local_atendimento_id: "l2" }), { pessoa: "equipe", local: "atual" }, EU, "l1"), false);
    assert.equal(avaliacaoNoEscopo(av({ local_atendimento_id: "l2" }), { pessoa: "equipe", local: "atual" }, EU, null), true, "sem local escolhido, não esconde nada");
  });
  it("agenda 'meus': só o que a recepção marcou para mim ou que está em avaliação comigo", () => {
    assert.equal(consultaNoEscopo(c({ medico_id: null }), undefined, meus, EU), false, "sem médico definido não é meu");
    assert.equal(consultaNoEscopo(c({ medico_id: EU }), undefined, meus, EU), true);
    assert.equal(consultaNoEscopo(c({ medico_id: null }), { etapa: "em_atendimento", medico_id: EU }, meus, EU), true);
    assert.equal(consultaNoEscopo(c({ medico_id: "outro" }), undefined, meus, EU), false);
    assert.equal(consultaNoEscopo(c({ medico_id: null }), { etapa: "em_atendimento", medico_id: "outro" }, meus, EU), false);
  });
});

describe("pendências verificadas", () => {
  it("rascunho, chegada sem avaliação e consulta passada sem desfecho — com data e responsável", () => {
    const p = pendenciasVerificadas(
      [av({ id: "r1", created_by: "dra" }), av({ status: "concluida" })],
      [
        c({ id: "ch", status: "presente", status_at: "2026-09-30T12:00:00Z", status_by: "rec" }),
        c({ id: "sd", data: "2026-09-25" }), c({ id: "velha", data: "2026-07-01" }),
        c({ id: "futura", data: "2026-10-02" }), c({ id: "ok", status: "presente", avaliacao_id: "r1" }),
      ], HOJE);
    assert.deepEqual(p.map((x) => [x.tipo, x.acao, x.responsavel]), [
      ["avaliacao_aberta", "continuar", "dra"],
      ["chegou_sem_avaliacao", "iniciar", "rec"],
      ["consulta_sem_desfecho", "ver_na_agenda", null],
    ]);
  });
  it("pendência resolvida some: a avaliação concluída não aparece", () => {
    assert.equal(pendenciasVerificadas([av({ status: "concluida" })], [], HOJE).length, 0);
  });
  it("o médico que abre a avaliação direto, sem a recepção dar entrada: a consulta não vira pendência", () => {
    const ontem = "2026-09-29";
    const feita = av({ patient_id: "pac", status: "concluida", created_at: "2026-09-29T13:00:00Z", concluida_at: "2026-09-29T13:40:00Z" });
    // Agendada ontem, sem chegada nem falta, mas o paciente foi avaliado ontem.
    assert.equal(pendenciasVerificadas([feita], [c({ patient_id: "pac", data: ontem })], HOJE).length, 0);
    // A avaliação ligada à consulta também resolve, mesmo com a agenda parada em "agendado".
    assert.equal(pendenciasVerificadas([], [c({ data: ontem, avaliacao_id: "qualquer" })], HOJE).length, 0);
    // Chegou hoje e o médico abriu a avaliação sem ligar ao agendamento: não é "sem avaliação".
    const aberta = av({ patient_id: "hoje", created_at: "2026-09-30T12:00:00Z", updated_at: "2026-09-30T12:00:00Z" });
    assert.deepEqual(pendenciasVerificadas([aberta], [c({ patient_id: "hoje", status: "presente" })], HOJE).map((x) => x.tipo), ["avaliacao_aberta"]);
  });
  it("avaliação de antes da consulta não resolve: quem volta para reavaliação continua na fila", () => {
    const antiga = av({ patient_id: "volta", status: "concluida", created_at: "2026-09-10T13:00:00Z", concluida_at: "2026-09-10T14:00:00Z" });
    assert.deepEqual(pendenciasVerificadas([antiga], [c({ patient_id: "volta", data: "2026-09-29" })], HOJE).map((x) => x.tipo), ["consulta_sem_desfecho"]);
    assert.deepEqual(pendenciasVerificadas([antiga], [c({ patient_id: "volta", status: "presente" })], HOJE).map((x) => x.tipo), ["chegou_sem_avaliacao"]);
  });
  it("o paciente avaliado por um colega também não fica sem desfecho", () => {
    const doColega = av({ patient_id: "pc", created_by: "colega", status: "concluida", created_at: "2026-09-29T13:00:00Z", concluida_at: "2026-09-29T13:30:00Z" });
    assert.equal(pendenciasVerificadas([], [c({ patient_id: "pc", data: "2026-09-29" })], HOJE, [doColega]).length, 0);
  });
});

describe("período e identificação", () => {
  it("o período é dito por extenso", () => {
    assert.equal(intervaloDoPeriodo({ tipo: "hoje" }, HOJE).rotulo, "Hoje, 30/09");
    assert.deepEqual(intervaloDoPeriodo({ tipo: "semana" }, HOJE), { de: HOJE, ate: "2026-10-06", rotulo: "Próximos 7 dias: 30/09 a 06/10" });
    assert.equal(intervaloDoPeriodo({ tipo: "dia", dia: "2026-10-12" }, HOJE).rotulo, "Dia 12/10/2026");
  });
  it("CPF mascarado", () => {
    assert.equal(cpfMascarado("12345678901"), "***.456.789-**");
    assert.equal(cpfMascarado(null), null);
  });
});

describe("o destaque do topo diz o que o paciente está fazendo", () => {
  it("quem já está em atendimento é o de agora, e o cartão mostra quem vem depois", () => {
    const curso = av({ id: "curso" });
    const dia = [c({ id: "d1", horario: "08:00:00", status: "presente", avaliacao_id: "curso" }),
      c({ id: "d2", horario: "08:30:00", status: "presente" }), c({ id: "d3", horario: "09:00:00" })];
    const d = destaqueDoDia(dia, andamentoPelasAvaliacoes(dia, new Map([["curso", curso]])));
    assert.equal(d?.rotulo, "Em atendimento agora");
    assert.equal(d?.consulta.id, "d1");
    assert.equal(d?.depois?.id, "d2");
  });
  it("sem ninguém em atendimento, é o próximo — e não há 'depois'", () => {
    const dia = [c({ id: "e1", horario: "10:00:00" }), c({ id: "e2", horario: "09:00:00", status: "presente" })];
    const d = destaqueDoDia(dia, andamentoPelasAvaliacoes(dia, new Map()));
    assert.equal(d?.rotulo, "Próximo atendimento");
    assert.equal(d?.consulta.id, "e2");
    assert.equal(d?.depois, null);
  });
  it("dia sem fila não tem destaque", () => {
    assert.equal(destaqueDoDia([c({ status: "faltou" })], new Map()), null);
  });
});

describe("as datas dizem 'hoje' e 'ontem' quando é o caso", () => {
  it("no fuso de Brasília, e não no do servidor", () => {
    assert.equal(momentoRelativo("2026-09-30T11:00:00Z", HOJE), "hoje, 08:00");
    // 01:30 UTC do dia 30 ainda é dia 29 em Brasília
    assert.equal(momentoRelativo("2026-09-30T01:30:00Z", HOJE), "ontem, 22:30");
    assert.equal(momentoRelativo("2026-09-20T13:05:00Z", HOJE), "20/09/2026, 10:05");
  });
});
