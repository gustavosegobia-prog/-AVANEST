import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { autorDoEvento, diferencas, rotuloDaAcao, sobreOEvento, type EventoDeAuditoria } from "./auditoria.ts";

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
