import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { VersaoDeContrato } from "./honorarios.ts";
import {
  descreverAlteracao, emLotes, ehArea, faltaInstalar, lerEmPaginas, pendenciasDasTabelas, primeirosPassos, padroesDaBusca, codigosSugeridos, divergeDoAnotado, resumoDoHonorarioDoMes, versaoDoNome, type EstadoDasTabelas,
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
    const item = semContrato.find((x) => x.chave === "sem-contrato-o1");
    assert.match(item?.detalhe ?? "", /Importe a tabela do plano/);
    assert.deepEqual(item?.acao, { rotulo: "Importar a tabela do plano", importar: "contrato" });
    const inativo = pendenciasDasTabelas(estado({ operadoras: [{ id: "o1", nome: "X", ativo: false }], contratos: [], versoes: [] }));
    assert.ok(!inativo.some((x) => x.chave.startsWith("sem-contrato")));
  });

  it("produção enviada com honorário pendente é grave e leva à Produção", () => {
    const p = pendenciasDasTabelas(estado({ producaoPendente: 2 }));
    assert.equal(p[0].chave, "producao-pendente");
    assert.match(p[0].titulo, /2 anestesias enviadas/);
    assert.equal(p[0].acao?.href, "/dashboard?area=plantoes&aba=producao");
  });

  it("sem nenhum plano publicado, não diz que está tudo em ordem", () => {
    const nenhum = pendenciasDasTabelas(estado({ operadoras: [], contratos: [], versoes: [] }));
    assert.equal(nenhum[0]?.chave, "sem-plano-publicado");
    assert.deepEqual(nenhum[0]?.acao, { rotulo: "Importar a tabela do plano", importar: "contrato" });
    const soRascunho = pendenciasDasTabelas(estado({ versoes: [versao({ situacao: "rascunho" })] }));
    assert.deepEqual(soRascunho.find((x) => x.chave === "sem-plano-publicado")?.acao, { rotulo: "Conferir e publicar", foco: "c1" });
    assert.ok(!pendenciasDasTabelas(estado()).some((x) => x.chave === "sem-plano-publicado"));
    assert.ok(!pendenciasDasTabelas(estado({ tuss: [], versoes: [] })).some((x) => x.chave === "sem-plano-publicado"),
      "sem TUSS, a pendência da TUSS vem antes");
  });

  it("cada botão leva ao item exato, e não ao primeiro da lista", () => {
    const p = pendenciasDasTabelas(estado({
      edicoes: [{ id: "ed1", edicao: "A", situacao: "vigente", portes: 9 }, { id: "ed2", edicao: "B", situacao: "em_conferencia", portes: 0 }],
      contratos: [{ id: "c1", operadora_id: "o1", identificacao: "Geral", ativo: true }, { id: "c2", operadora_id: "o1", identificacao: "Hospital", ativo: true }],
      versoes: [versao(), versao({ id: "v9", contratoId: "c2", situacao: "rascunho" })],
    }));
    assert.equal(p.find((x) => x.chave === "cbhpm-conferencia-ed2")?.acao?.foco, "ed2");
    assert.equal(p.find((x) => x.chave === "rascunho-v9")?.acao?.foco, "c2");
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

describe("honorários: primeiros passos", () => {
  const tuss = (situacao: "em_conferencia" | "vigente" | "substituida") => [{ id: "t1", versao: "202609", situacao }];
  it("do zero: importar a TUSS é o primeiro clique, e o plano vem importado", () => {
    const p = primeirosPassos({ tuss: [], versoes: [], honorariosCalculados: 0 });
    assert.deepEqual(p.map((x) => [x.chave, x.feito, x.acao]), [
      ["tuss", false, { rotulo: "Importar a TUSS", importar: "tuss" }],
      ["plano", false, { rotulo: "Importar a tabela do plano", importar: "contrato" }],
      ["calculo", false, { rotulo: "Abrir o simulador", area: "regras" }],
    ]);
  });
  it("o que já foi importado leva a conferir e publicar", () => {
    const p = primeirosPassos({ tuss: tuss("em_conferencia"), versoes: [{ situacao: "rascunho" }], honorariosCalculados: 0 });
    assert.deepEqual(p[0].acao, { rotulo: "Conferir e publicar", area: "tuss" });
    assert.deepEqual(p[1].acao, { rotulo: "Conferir e publicar", area: "contratos" });
  });
  it("feito é feito: TUSS publicada, plano publicado e um cálculo", () => {
    const p = primeirosPassos({ tuss: tuss("vigente"), versoes: [{ situacao: "vigente" }], honorariosCalculados: 1 });
    assert.deepEqual(p.map((x) => x.feito), [true, true, true]);
  });
  it("a pendência da TUSS leva direto à importação", () => {
    const [semTuss] = pendenciasDasTabelas(estado({ tuss: [] }));
    assert.equal(semTuss.chave, "tuss-sem-vigente");
    assert.deepEqual(semTuss.acao, { rotulo: "Importar a TUSS", importar: "tuss" });
  });
});

describe("honorários: da ficha ao código TUSS", () => {
  it("o procedimento escrito na ficha vira trechos tolerantes a acento", () => {
    assert.deepEqual(padroesDaBusca("Colecistectomia videolaparoscópica"), ["%c_l_c_%", "%v_d__l%"]);
    assert.deepEqual(padroesDaBusca("Cesárea"), ["%c_s_r_%"]);
    assert.deepEqual(padroesDaBusca("Punção lombar para raqui"), ["%p_n___%", "%l_mb_r%", "%r_q__%"]);
    assert.deepEqual(padroesDaBusca("de da e 12"), []);
    assert.deepEqual(padroesDaBusca(null), []);
  });
  it("o trecho casa com a descrição oficial, com ou sem acento", () => {
    const casa = (padrao: string, texto: string) =>
      new RegExp(`^${padrao.replace(/%/g, ".*").replace(/_/g, ".")}$`, "i").test(texto);
    const [p1, p2] = padroesDaBusca("Colecistectomia videolaparoscópica");
    const tuss = "COLECISTECTOMIA COM COLANGIOGRAFIA POR VIDEOLAPAROSCOPIA";
    assert.ok(casa(p1, tuss) && casa(p2, tuss));
    assert.ok(casa(padroesDaBusca("cesarea")[0], "CESARIANA (PARTO CESÁREO)"));
  });
  it("sugere os códigos da anotação mais recente com o mesmo procedimento", () => {
    const anteriores = [
      { id: "a1", data: "2026-09-01", procedimento: "COLECISTECTOMIA VIDEOLAPAROSCÓPICA" },
      { id: "a2", data: "2026-10-05", procedimento: "colecistectomia  videolaparoscopica" },
      { id: "a3", data: "2026-10-20", procedimento: "Colecistectomia videolaparoscópica" },
      { id: "b1", data: "2026-10-21", procedimento: "Herniorrafia" },
    ];
    const procs = [
      { producao_id: "a1", ordem: 1, tuss_codigo: "90000001", descricao: "ANTIGO" },
      { producao_id: "a2", ordem: 2, tuss_codigo: "90000003", descricao: "SEGUNDO" },
      { producao_id: "a2", ordem: 1, tuss_codigo: "90000002", descricao: "PRINCIPAL" },
      { producao_id: "b1", ordem: 1, tuss_codigo: "90000009", descricao: "OUTRO" },
    ];
    // a3 é mais recente, mas não tem código: vale a2, na ordem escolhida.
    assert.deepEqual(codigosSugeridos({ id: "x", procedimento: "Colecistectomia Videolaparoscópica" }, anteriores, procs), {
      data: "2026-10-05",
      codigos: [{ codigo: "90000002", descricao: "PRINCIPAL" }, { codigo: "90000003", descricao: "SEGUNDO" }],
    });
    assert.equal(codigosSugeridos({ id: "x", procedimento: "Artroscopia" }, anteriores, procs), null);
    assert.equal(codigosSugeridos({ id: "x", procedimento: null }, anteriores, procs), null);
    // A própria anotação não se sugere.
    assert.equal(codigosSugeridos({ id: "b1", procedimento: "Herniorrafia" }, anteriores, procs), null);
  });
  it("o total do mês soma o que tem valor e conta o que falta", () => {
    assert.deepEqual(resumoDoHonorarioDoMes([
      { honorario_situacao: "calculado", honorario_valor_previsto: "1230.50" },
      { honorario_situacao: "conferido", honorario_valor_previsto: 800 },
      { honorario_situacao: "pendente", honorario_valor_previsto: null },
      { honorario_situacao: "nao_calculado" },
      {},
    ]), { previsto: 2030.5, calculadas: 2, pendentes: 1, semCalculo: 2, total: 5, diferenca: 0, comparadas: 0 });
  });
  it("a diferença para o anotado só conta as calculadas que têm valor anotado", () => {
    const r = resumoDoHonorarioDoMes([
      { honorario_situacao: "calculado", honorario_valor_previsto: 1000, valor: 900 },
      { honorario_situacao: "conferido", honorario_valor_previsto: "450.10", valor: "500" },
      { honorario_situacao: "calculado", honorario_valor_previsto: 300, valor: 0 },
      { honorario_situacao: "pendente", valor: 700 },
    ]);
    assert.equal(r.previsto, 1750.1);
    assert.equal(r.comparadas, 2);
    assert.equal(r.diferenca, 50.1, "+100 de uma, −49,90 da outra");
    assert.equal(r.total, 4);
  });
  it("o selo só aponta divergência quando há valor anotado e ele não bate", () => {
    assert.ok(divergeDoAnotado(1000, 900));
    assert.ok(divergeDoAnotado("1000.00", "999.98"));
    assert.ok(!divergeDoAnotado(1000, "1000.00"));
    assert.ok(!divergeDoAnotado(1000, 1000.004), "menos de um centavo não é divergência");
    assert.ok(!divergeDoAnotado(1000, null));
    assert.ok(!divergeDoAnotado(1000, 0));
    assert.ok(!divergeDoAnotado(null, 900));
  });
});
