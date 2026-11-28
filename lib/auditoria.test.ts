import { describe, it, test } from "node:test";
import assert from "node:assert/strict";
import {
  agruparEventos, autorDoEvento, camposDaFicha, camposDoGrupo, diferencas, nomeDoCampoDaFicha, rotuloDaAcao, sobreOEvento,
  type EventoDeAuditoria,
} from "./auditoria.ts";

const e = (x: Partial<EventoDeAuditoria>): EventoDeAuditoria => ({
  id: "1", actor_id: "a", entidade: "perfil", entidade_id: "p", acao: "perfil_atualizado",
  detalhes: {}, created_at: "2026-09-30T12:00:00Z", ...x,
});
const nomes = new Map([["a", "Ana"], ["p", "Pedro"]]);

describe("auditoria legível", () => {
  it("rótulo por entidade e ação, e nunca some um evento desconhecido", () => {
    assert.equal(rotuloDaAcao({ entidade: "local_atendimento", acao: "update" }), "Local alterado");
    assert.equal(rotuloDaAcao({ entidade: "perfil", acao: "saiu_da_escala" }), "Saiu da escala");
    assert.equal(rotuloDaAcao({ entidade: "x", acao: "algo_novo" }), "algo novo");
  });

  it("sobre quem e por quem", () => {
    assert.equal(sobreOEvento(e({}), nomes), "Pedro");
    assert.equal(sobreOEvento(e({ detalhes: { periodo: "2026-09", motivo: "erro" } }), nomes), "competência 09/2026 — motivo: erro");
    assert.equal(autorDoEvento(e({}), nomes), "Ana");
    assert.equal(autorDoEvento(e({ actor_id: null }), nomes), "Sistema");
    assert.equal(autorDoEvento(e({ actor_id: "sumiu" }), nomes), "Pessoa removida");
  });

  it("antes e depois só quando o evento gravou os dois", () => {
    assert.deepEqual(diferencas(e({})), []);
    const d = diferencas(e({
      dados_anteriores: { role: "medico", status: "ativo", permissoes: [], atuacao_medica: null },
      dados_novos: { role: "admin", status: "ativo", permissoes: ["financeiro"], atuacao_medica: true },
    }));
    assert.deepEqual(d, [
      { campo: "Função", de: "Área médica", para: "Administrador" },
      { campo: "Áreas", de: "nenhuma", para: "Financeiro" },
      { campo: "Profissão", de: "Não informada", para: "Médico(a)" },
    ]);
  });
});

// 28/11/2026: "cabecalho" no histórico era o nome técnico da alteração da ficha.
const daFicha = (x: Partial<EventoDeAuditoria>): EventoDeAuditoria => ({
  id: x.id ?? "e", actor_id: "medica", entidade: "evolucao_anestesica", entidade_id: "ficha1", acao: "cabecalho",
  detalhes: {}, created_at: "2026-11-27T18:53:00Z", ...x,
});

test("ficha anestésica no histórico: nome em português, paciente e campos que mudaram", () => {
  assert.equal(rotuloDaAcao({ entidade: "evolucao_anestesica", acao: "cabecalho" }), "Ficha anestésica alterada");
  assert.equal(rotuloDaAcao({ entidade: "evolucao_anestesica", acao: "encerrar" }), "Ficha anestésica encerrada");
  assert.equal(sobreOEvento(daFicha({}), new Map(), new Map([["ficha1", "Paciente Fictícia"]])), "ficha de Paciente Fictícia");
  assert.equal(sobreOEvento(daFicha({ entidade_id: "outra" }), new Map(), new Map()), "ficha anestésica");
  assert.equal(nomeDoCampoDaFicha("papel_pa"), "Pressão arterial");
  assert.equal(nomeDoCampoDaFicha("peso_kg"), "Peso");
  assert.equal(nomeDoCampoDaFicha("campo_novo"), "campo novo");
  assert.deepEqual(camposDaFicha(daFicha({ detalhes: { peso_kg: 72, nega_alergia: true, tecnicas: ["geral", "raqui"], alergias: "" } })), [
    { campo: "Peso", valor: "72" }, { campo: "Nega alergia", valor: "sim" },
    { campo: "Técnica", valor: "geral, raqui" }, { campo: "Alergias", valor: "apagado" },
  ]);
});

test("ficha anestésica no histórico: alterações seguidas da mesma ficha e pessoa viram uma linha", () => {
  const lista = [
    daFicha({ id: "a", created_at: "2026-11-27T18:53:00Z", detalhes: { asa: "II" } }),
    daFicha({ id: "b", created_at: "2026-11-27T18:50:00Z", detalhes: { peso_kg: 70 } }),
    daFicha({ id: "c", created_at: "2026-11-27T18:41:00Z", detalhes: { asa: "I", papel_pa: "120/80" } }),
    // outra ficha: linha nova
    daFicha({ id: "d", entidade_id: "ficha2", created_at: "2026-11-27T18:40:00Z" }),
    // a mesma ficha de novo, mas mais de 30 min depois da anterior do grupo: linha nova
    daFicha({ id: "e", entidade_id: "ficha2", created_at: "2026-11-27T17:00:00Z" }),
    // outra pessoa na mesma ficha: linha nova
    daFicha({ id: "f", entidade_id: "ficha2", actor_id: "outra", created_at: "2026-11-27T16:59:00Z" }),
    // outro tipo de evento nunca se junta
    daFicha({ id: "g", entidade_id: "ficha2", acao: "encerrar", actor_id: "outra", created_at: "2026-11-27T16:58:00Z" }),
  ];
  const grupos = agruparEventos(lista);
  assert.deepEqual(grupos.map((g) => g.eventos.map((e) => e.id)), [["a", "b", "c"], ["d"], ["e"], ["f"], ["g"]]);
  // Cada campo com o valor mais recente do grupo.
  assert.deepEqual(camposDoGrupo(grupos[0]), [
    { campo: "ASA", valor: "II" }, { campo: "Peso", valor: "70" }, { campo: "Pressão arterial", valor: "120/80" },
  ]);
});
