import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calcularHonorario } from "./honorarios.ts";
import {
  edicaoCbhpm, proximaVersao, tabelasDoCalculo, versaoDeContrato, versoesPublicadas,
  type LinhaContrato, type LinhaOperadora, type LinhaVersao,
} from "./honorarios-dados.ts";

// Linhas como o Supabase devolve (numeric em texto), com dados fictícios.

const operadora: LinhaOperadora = { id: "o1", nome: "Unimed Fictícia", particular: false, ativo: true };
const contrato: LinhaContrato = { id: "c1", operadora_id: "o1", identificacao: "Geral", local_id: null, ativo: true };
const versao = (x: Partial<LinhaVersao> = {}): LinhaVersao => ({
  id: "v1", contrato_id: "c1", versao: 1, vigencia_inicio: "2026-01-01", vigencia_fim: null,
  referencia: "cbhpm", cbhpm_edicao_id: "ed1", reajuste_percentual: "10.00", urgencia_percentual: "30.00",
  multiplos_percentuais: ["100", "50"], ajustes: [], ajustes_cumulativos: false, situacao: "vigente", ...x,
});

describe("honorários: das linhas do banco para o cálculo", () => {
  it("numeric em texto vira número, e cada valor fica com a sua versão", () => {
    const v = versaoDeContrato(versao(), contrato, operadora,
      [{ versao_id: "v1", porte: 3, valor: "600.00" }, { versao_id: "v2", porte: 3, valor: "999" }],
      [{ versao_id: "v1", tuss_codigo: "90000002", valor: "750.50" }]);
    assert.equal(v.operadora, "Unimed Fictícia");
    assert.equal(v.reajustePercentual, 10);
    assert.equal(v.urgenciaPercentual, 30);
    assert.deepEqual(v.multiplosPercentuais, [100, 50]);
    assert.deepEqual(v.valoresPorPorte, { 3: 600 });
    assert.deepEqual(v.valoresPorProcedimento, { "90000002": 750.5 });
  });

  it("urgência e múltiplos vazios continuam vazios (o contrato não prevê)", () => {
    const v = versaoDeContrato(versao({ urgencia_percentual: null, multiplos_percentuais: null, ajustes: null }), contrato, operadora, [], []);
    assert.equal(v.urgenciaPercentual, null);
    assert.equal(v.multiplosPercentuais, null);
    assert.deepEqual(v.ajustes, []);
  });

  it("rascunho e contrato desativado não entram no cálculo", () => {
    const desativado: LinhaContrato = { ...contrato, id: "c2", ativo: false };
    const r = versoesPublicadas([
      versao(), versao({ id: "v2", versao: 2, situacao: "rascunho" }),
      versao({ id: "v3", contrato_id: "c2" }), versao({ id: "v4", contrato_id: "c-sumido" }),
    ], [contrato, desativado], [operadora], [], []);
    assert.deepEqual(r.map((v) => v.id), ["v1"]);
  });

  it("de ponta a ponta: as linhas lidas calculam o honorário", () => {
    const edicao = edicaoCbhpm({ id: "ed1", edicao: "CBHPM fictícia" },
      [{ codigo: "C1", porte_anestesico: 3 }],
      [{ porte: 3, valor_referencia: "400.00", vigencia_inicio: "2026-01-01" }]);
    const t = tabelasDoCalculo({
      tussVersao: { id: "tv1", versao: "202609" },
      tussCodigos: [{ codigo: "90000001", descricao: "PROCEDIMENTO FICTÍCIO UM", situacao: "ativo", substituido_por: null, inicio_vigencia: null, fim_vigencia: null }],
      correspondencias: [
        { tuss_codigo: "90000001", cbhpm_edicao_id: "ed1", cbhpm_codigo: "C1", situacao: "validada" },
        { tuss_codigo: "90000001", cbhpm_edicao_id: "ed1", cbhpm_codigo: "C9", situacao: "proposta" },
      ],
      edicoes: [edicao],
      contratos: versoesPublicadas([versao()], [contrato], [operadora], [], []),
    });
    assert.equal(t.correspondencias.length, 1, "só a validada vale");
    const r = calcularHonorario({ data: "2026-03-10", convenio: "UNIMED FICTICIA", localId: null, urgencia: false, procedimentos: ["90000001"] }, t);
    assert.equal(r.situacao, "calculado");
    assert.equal(r.valorPrevisto, 440, "referência 400 + reajuste de 10%");
  });

  it("sem versão da TUSS publicada, o cálculo fica pendente", () => {
    const t = tabelasDoCalculo({ tussVersao: null, tussCodigos: [], correspondencias: [], edicoes: [], contratos: [] });
    const r = calcularHonorario({ data: "2026-03-10", convenio: "Unimed Fictícia", localId: null, urgencia: false, procedimentos: ["90000001"] }, t);
    assert.equal(r.situacao, "pendente");
    assert.equal(r.valorPrevisto, null);
  });
});

describe("honorários: próxima versão do contrato", () => {
  it("começa no dia seguinte ao fim da última e copia as regras dela", () => {
    const p = proximaVersao([versao({ vigencia_fim: "2026-12-31" }), versao({ id: "v0", versao: 0 })], "c1", "2026-10-23");
    assert.equal(p.versao, 2);
    assert.equal(p.base?.id, "v1");
    assert.equal(p.vigenciaInicio, "2027-01-01");
  });
  it("primeira versão do contrato começa hoje", () => {
    const p = proximaVersao([], "c1", "2026-10-23");
    assert.deepEqual(p, { versao: 1, base: null, vigenciaInicio: "2026-10-23" });
  });
});
