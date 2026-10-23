import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { VersaoDeContrato } from "./honorarios.ts";
import {
  descreverAlteracao, emLotes, ehArea, faltaInstalar, lerEmPaginas, pendenciasDasTabelas, versaoDoNome, type EstadoDasTabelas,
} from "./honorarios-telas.ts";

// Dados fictícios.

const versao = (x: Partial<VersaoDeContrato> = {}): VersaoDeContrato => ({
  id: "v1", contratoId: "c1", operadora: "Unimed Fictícia", localId: null, versao: 1,
  vigenciaInicio: "2026-01-01", vigenciaFim: null, situacao: "vigente", referencia: "cbhpm", cbhpmEdicaoId: "ed1",
  reajustePercentual: 0, urgenciaPercentual: null, multiplosPercentuais: null, ajustes: [], ajustesCumulativos: false,
  valoresPorPorte: {}, valoresPorProcedimento: {}, portesPorProcedimento: {}, ...x,
});

const estado = (x: Partial<EstadoDasTabelas> = {}): EstadoDasTabelas => ({
  hoje: "2026-10-23",
  tuss: [{ id: "t1", versao: "202609", situacao: "vigente" }],
  edicoes: [{ id: "ed1", edicao: "Fictícia", situacao: "vigente", portes: 9 }],
  operadoras: [{ id: "o1", nome: "Unimed Fictícia", ativo: true }],
  contratos: [{ id: "c1", operadora_id: "o1", identificacao: "Geral", ativo: true }],
  versoes: [versao()],
  correspondenciasPropostas: 0,
  producaoPendente: 0,
  ...x,
});

describe("tabelas e honorários: telas", () => {
  it("reconhece o banco sem a migração", () => {
    assert.ok(faltaInstalar({ code: "PGRST205", message: "Could not find the table 'public.tuss_versoes' in the schema cache" }));
    assert.ok(faltaInstalar({ code: "42P01", message: 'relation "public.tuss_versoes" does not exist' }));
    assert.ok(!faltaInstalar({ code: "42501", message: "permission denied" }));
    assert.ok(!faltaInstalar(null));
  });

  it("lê a versão da TUSS no nome do arquivo ou da aba", () => {
    assert.equal(versaoDoNome("TUSS 22 - PROCEDIMENTOS E EVENTOS EM SAÚDE - VERSÃO 202609.xlsx"), "202609");
    assert.equal(versaoDoNome("tabela.xlsx", "Tab 22  VERSÃO 202603"), "202603");
    assert.equal(versaoDoNome("tabela 2026.xlsx"), null);
    assert.equal(versaoDoNome("202613.xlsx"), null, "mês 13 não existe");
  });

  it("lê a tabela inteira em páginas, e para no erro", async () => {
    const banco = Array.from({ length: 2500 }, (_, i) => i);
    const pedidos: Array<[number, number]> = [];
    const r = await lerEmPaginas((de, ate) => { pedidos.push([de, ate]); return Promise.resolve({ data: banco.slice(de, ate + 1), error: null }); });
    assert.equal(r.linhas.length, 2500);
    assert.deepEqual(pedidos, [[0, 999], [1000, 1999], [2000, 2999]]);
    const exato = await lerEmPaginas((de, ate) => Promise.resolve({ data: banco.slice(0, 2000).slice(de, ate + 1), error: null }));
    assert.equal(exato.linhas.length, 2000, "página vazia no fim encerra");
    const comErro = await lerEmPaginas((de) => Promise.resolve(de ? { data: null, error: { message: "caiu" } } : { data: banco.slice(0, 1000), error: null }));
    assert.equal(comErro.linhas.length, 1000);
    assert.deepEqual(comErro.erro, { message: "caiu" });
  });

  it("grava em lotes e conhece as áreas", () => {
    assert.deepEqual(emLotes([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
    assert.deepEqual(emLotes([], 2), []);
    assert.ok(ehArea("tuss"));
    assert.ok(!ehArea("qualquer"));
  });
});

describe("tabelas e honorários: pendências", () => {
  it("tudo em ordem: nenhuma pendência", () => {
    assert.deepEqual(pendenciasDasTabelas(estado()), []);
  });

  it("sem TUSS publicada é a primeira da lista", () => {
    const p = pendenciasDasTabelas(estado({ tuss: [{ id: "t2", versao: "202609", situacao: "em_conferencia" }], correspondenciasPropostas: 3 }));
    assert.equal(p[0].chave, "tuss-sem-vigente");
    assert.equal(p[0].gravidade, "alta");
    assert.ok(p.some((x) => x.chave === "tuss-conferencia-t2"));
    assert.ok(p.some((x) => x.titulo.startsWith("3 correspondências")));
  });

  it("edição da CBHPM usada por contrato: em conferência ou sem portes é grave", () => {
    const emConferencia = pendenciasDasTabelas(estado({ edicoes: [{ id: "ed1", edicao: "Fictícia", situacao: "em_conferencia", portes: 0 }] }));
    assert.equal(emConferencia.find((x) => x.chave === "cbhpm-conferencia-ed1")?.gravidade, "alta");
    const semPortes = pendenciasDasTabelas(estado({ edicoes: [{ id: "ed1", edicao: "Fictícia", situacao: "vigente", portes: 0 }] }));
    assert.ok(semPortes.some((x) => x.chave === "cbhpm-sem-portes-ed1"));
    const naoUsada = pendenciasDasTabelas(estado({ edicoes: [{ id: "ed2", edicao: "Outra", situacao: "vigente", portes: 0 }] }));
    assert.ok(!naoUsada.some((x) => x.chave.startsWith("cbhpm-sem-portes")), "edição que ninguém usa não é pendência");
  });

  it("rascunho mostra o que falta para publicar", () => {
    const p = pendenciasDasTabelas(estado({ versoes: [versao(), versao({ id: "v2", versao: 2, situacao: "rascunho", referencia: "propria", cbhpmEdicaoId: null })] }));
    const r = p.find((x) => x.chave === "rascunho-v2");
    assert.match(r?.titulo ?? "", /Unimed Fictícia · Geral — versão 2 em rascunho/);
    assert.match(r?.detalhe ?? "", /tabela própria precisa de valores/);
  });

  it("contrato que vence em até 30 dias sem a próxima versão", () => {
    const p = pendenciasDasTabelas(estado({ versoes: [versao({ vigenciaFim: "2026-11-02" })] }));
    assert.match(p.find((x) => x.chave === "vence-v1")?.titulo ?? "", /vence em 10 dias/);
    const comSeguinte = pendenciasDasTabelas(estado({ versoes: [versao({ vigenciaFim: "2026-11-02" }), versao({ id: "v2", versao: 2, situacao: "rascunho", vigenciaInicio: "2026-11-03" })] }));
    assert.ok(!comSeguinte.some((x) => x.chave === "vence-v1"));
  });

  it("convênio ativo sem versão valendo hoje", () => {
    const p = pendenciasDasTabelas(estado({ versoes: [versao({ vigenciaFim: "2026-06-30" })] }));
    assert.ok(p.some((x) => x.chave === "sem-contrato-o1"));
    const semContrato = pendenciasDasTabelas(estado({ contratos: [], versoes: [] }));
    assert.match(semContrato.find((x) => x.chave === "sem-contrato-o1")?.detalhe ?? "", /Cadastre o contrato/);
    const inativo = pendenciasDasTabelas(estado({ operadoras: [{ id: "o1", nome: "X", ativo: false }], contratos: [], versoes: [] }));
    assert.ok(!inativo.some((x) => x.chave.startsWith("sem-contrato")));
  });

  it("produção enviada com honorário pendente é grave", () => {
    const p = pendenciasDasTabelas(estado({ producaoPendente: 2 }));
    assert.equal(p[0].chave, "producao-pendente");
    assert.match(p[0].titulo, /2 anestesias enviadas/);
  });
});

describe("tabelas e honorários: histórico", () => {
  it("descreve publicar, validar e cadastrar", () => {
    assert.equal(descreverAlteracao({ tabela: "contrato_versoes", acao: "update",
      dados_anteriores: { versao: 2, situacao: "rascunho" }, dados_novos: { versao: 2, situacao: "vigente" } }).oQue,
    "Publicou a versão 2 do contrato");
    assert.equal(descreverAlteracao({ tabela: "tuss_cbhpm_correspondencias", acao: "update",
      dados_anteriores: { tuss_codigo: "90000001", cbhpm_codigo: "C1", situacao: "proposta" },
      dados_novos: { tuss_codigo: "90000001", cbhpm_codigo: "C1", situacao: "validada" } }).oQue,
    "Validou a correspondência 90000001 ↔ C1");
    assert.equal(descreverAlteracao({ tabela: "operadoras", acao: "insert", dados_anteriores: null, dados_novos: { nome: "Unimed Fictícia" } }).oQue,
      "Cadastrou o convênio Unimed Fictícia");
  });

  it("valor alterado mostra antes e depois; campo alterado diz qual", () => {
    const r = descreverAlteracao({ tabela: "contrato_valores_porte", acao: "update",
      dados_anteriores: { porte: 3, valor: "500.00" }, dados_novos: { porte: 3, valor: "600.00" } });
    assert.equal(r.oQue, "Alterou o valor do AN3");
    assert.equal(r.detalhe.replace(/\s/g, " "), "R$ 500,00 → R$ 600,00");
    const c = descreverAlteracao({ tabela: "contratos", acao: "update",
      dados_anteriores: { identificacao: "Geral", ativo: true }, dados_novos: { identificacao: "Geral", ativo: false } });
    assert.equal(c.detalhe, "Campos: ativo");
  });
});
