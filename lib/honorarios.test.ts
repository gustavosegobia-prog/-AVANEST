import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CONFERIR_ANTES_DE_ENVIAR, PENDENTE_DE_CONFERENCIA, calcularHonorario, contratoAplicavel, liberaParaOFinanceiro,
  nomeSimples, problemasDaVersao, type Anestesia, type CodigoTuss, type Tabelas, type VersaoDeContrato,
} from "./honorarios.ts";

// Tudo aqui é fictício: códigos 9000000x, descrições "FICTÍCIO", valores redondos.
// Nenhum código, porte ou valor real da TUSS ou da CBHPM.

const tuss = (extra: CodigoTuss[] = []): Tabelas["tuss"] => ({
  versaoId: "tv1", versao: "202603",
  codigos: new Map([
    ["90000001", { codigo: "90000001", descricao: "PROCEDIMENTO FICTÍCIO UM", situacao: "ativo" }],
    ["90000002", { codigo: "90000002", descricao: "PROCEDIMENTO FICTÍCIO DOIS", situacao: "ativo" }],
    ["90000003", { codigo: "90000003", descricao: "PROCEDIMENTO FICTÍCIO TRÊS", situacao: "ativo" }],
    ["90000009", { codigo: "90000009", descricao: "PROCEDIMENTO FICTÍCIO ANTIGO", situacao: "substituido", substituidoPor: "90000001" }],
    ...extra.map((c) => [c.codigo, c] as [string, CodigoTuss]),
  ]),
});

const contrato = (x: Partial<VersaoDeContrato> = {}): VersaoDeContrato => ({
  id: "cv1", contratoId: "c1", operadora: "Unimed Fictícia", localId: null, versao: 1,
  vigenciaInicio: "2026-01-01", vigenciaFim: null, situacao: "vigente",
  referencia: "cbhpm", cbhpmEdicaoId: "ed1", reajustePercentual: 0,
  urgenciaPercentual: null, multiplosPercentuais: null, ajustes: [], ajustesCumulativos: false,
  valoresPorPorte: {}, valoresPorProcedimento: {}, portesPorProcedimento: {}, ...x,
});

const tabelas = (contratos: VersaoDeContrato[], extra: Partial<Tabelas> = {}): Tabelas => ({
  tuss: tuss(),
  correspondencias: [
    { tussCodigo: "90000001", cbhpmEdicaoId: "ed1", cbhpmCodigo: "C1" },
    { tussCodigo: "90000002", cbhpmEdicaoId: "ed1", cbhpmCodigo: "C2" },
    { tussCodigo: "90000003", cbhpmEdicaoId: "ed1", cbhpmCodigo: "C3" },
  ],
  cbhpm: new Map([["ed1", {
    id: "ed1", edicao: "CBHPM fictícia",
    procedimentos: new Map([["C1", 3], ["C2", 5], ["C3", null]]),
    portes: [
      { porte: 3, valor: 400, vigenciaInicio: "2026-01-01" },
      { porte: 5, valor: 800, vigenciaInicio: "2026-01-01" },
    ],
  }]]),
  contratos,
  ...extra,
});

const anestesia = (x: Partial<Anestesia> = {}): Anestesia => ({
  data: "2026-03-10", convenio: "Unimed Fictícia", localId: null, urgencia: false, procedimentos: ["90000001"], ...x,
});

describe("honorários: o cálculo segue o contrato", () => {
  it("porte com valor negociado no contrato", () => {
    const r = calcularHonorario(anestesia(), tabelas([contrato({ valoresPorPorte: { 3: 600 } })]));
    assert.equal(r.situacao, "calculado");
    assert.equal(r.valorPrevisto, 600);
    assert.equal(r.memoria.linhas[0].origem, "porte_do_contrato");
    assert.equal(r.memoria.linhas[0].porte, 3);
    assert.ok(liberaParaOFinanceiro(r));
  });

  it("valor fixo do procedimento vence o valor do porte", () => {
    const r = calcularHonorario(anestesia(), tabelas([contrato({ valoresPorPorte: { 3: 600 }, valoresPorProcedimento: { "90000001": 750 } })]));
    assert.equal(r.valorPrevisto, 750);
    assert.equal(r.memoria.linhas[0].origem, "valor_fixo_do_contrato");
  });

  it("referência da CBHPM com o reajuste do contrato", () => {
    const r = calcularHonorario(anestesia(), tabelas([contrato({ reajustePercentual: 10 })]));
    assert.equal(r.valorPrevisto, 440);
    assert.equal(r.memoria.linhas[0].origem, "referencia_cbhpm");
    assert.equal(r.memoria.reajustePercentual, 10);
  });

  it("contrato com tabela própria não usa a CBHPM para o valor", () => {
    const r = calcularHonorario(anestesia(), tabelas([contrato({ referencia: "propria" })]));
    assert.equal(r.valorPrevisto, null);
    assert.deepEqual(r.pendencias.map((p) => p.tipo), ["sem_valor"]);
  });

  it("o mesmo convênio escrito de outro jeito acha o contrato", () => {
    assert.equal(nomeSimples(" UNIMED  fictícia "), "unimed ficticia");
    const r = calcularHonorario(anestesia({ convenio: "UNIMED ficticia" }), tabelas([contrato({ valoresPorPorte: { 3: 600 } })]));
    assert.equal(r.valorPrevisto, 600);
  });
});

describe("honorários: a tabela do plano de saúde", () => {
  // O plano manda a tabela dele: o código TUSS com o porte anestésico que ELE
  // dá, e o valor de cada porte. Não depende de correspondência com a CBHPM.
  const plano = (x: Partial<VersaoDeContrato> = {}) => contrato({
    referencia: "propria", cbhpmEdicaoId: null, portesPorProcedimento: { "90000001": 4 }, valoresPorPorte: { 4: 900 }, ...x,
  });

  it("o porte vem da tabela do plano, sem correspondência nem CBHPM", () => {
    const r = calcularHonorario(anestesia(), tabelas([plano()], { correspondencias: [], cbhpm: new Map() }));
    assert.equal(r.situacao, "calculado");
    assert.equal(r.valorPrevisto, 900);
    assert.equal(r.memoria.linhas[0].porte, 4);
    assert.equal(r.memoria.linhas[0].porteDe, "contrato");
    assert.equal(r.memoria.linhas[0].cbhpmCodigo, null);
  });

  it("o porte do plano vence o porte da CBHPM para o mesmo código", () => {
    // Na CBHPM fictícia, 90000001 → C1 → AN3. O plano diz AN4.
    const r = calcularHonorario(anestesia(), tabelas([plano({ referencia: "cbhpm", cbhpmEdicaoId: "ed1", valoresPorPorte: {} })]));
    // Pela CBHPM seria AN3 (R$ 400 de referência). Pelo plano é AN4, e a
    // edição fictícia não tem valor para o AN4: fica pendente, sem usar o AN3.
    assert.equal(r.valorPrevisto, null);
    assert.deepEqual(r.pendencias.map((p) => p.tipo), ["sem_valor"]);
    assert.match(r.pendencias[0].texto, /AN4/);
    const comValor = calcularHonorario(anestesia(), tabelas([plano({ referencia: "cbhpm", cbhpmEdicaoId: "ed1", valoresPorPorte: { 4: 700 } })]));
    assert.equal(comValor.valorPrevisto, 700);
    assert.equal(comValor.memoria.linhas[0].porte, 4);
  });

  it("valor fixo do procedimento ainda vence o porte do plano", () => {
    const r = calcularHonorario(anestesia(), tabelas([plano({ valoresPorProcedimento: { "90000001": 1234 } })]));
    assert.equal(r.valorPrevisto, 1234);
    assert.equal(r.memoria.linhas[0].origem, "valor_fixo_do_contrato");
  });

  it("código fora da tabela do plano usa a correspondência da CBHPM, se houver", () => {
    const r = calcularHonorario(anestesia({ procedimentos: ["90000002"] }),
      tabelas([plano({ referencia: "cbhpm", cbhpmEdicaoId: "ed1", valoresPorPorte: { 5: 1000 } })]));
    assert.equal(r.valorPrevisto, 1000);
    assert.equal(r.memoria.linhas[0].porteDe, "cbhpm");
    const sem = calcularHonorario(anestesia({ procedimentos: ["90000002"] }), tabelas([plano()]));
    assert.deepEqual(sem.pendencias.map((p) => p.tipo), ["sem_edicao_cbhpm"]);
  });

  it("tabela com o porte de cada código, mas sem o valor dos portes, não publica", () => {
    assert.deepEqual(problemasDaVersao(plano({ valoresPorPorte: {} })),
      ["A tabela dá o porte de cada procedimento, mas falta o valor de cada porte (AN0 a AN8)."]);
    assert.deepEqual(problemasDaVersao(plano()), []);
    assert.ok(problemasDaVersao(plano({ portesPorProcedimento: { "90000001": 9 as 8 } })).some((x) => /fora de AN0 a AN8/.test(x)));
  });
});

describe("honorários: procedimentos múltiplos", () => {
  const c = contrato({ multiplosPercentuais: [100, 50], valoresPorPorte: { 3: 600, 5: 1000 }, valoresPorProcedimento: { "90000003": 200 } });

  it("o de maior valor inteiro, os demais pelo percentual do contrato", () => {
    const r = calcularHonorario(anestesia({ procedimentos: ["90000001", "90000002", "90000003"] }), tabelas([c]));
    assert.deepEqual(r.memoria.linhas.map((l) => [l.tussCodigo, l.percentual, l.valor]), [
      ["90000002", 100, 1000], ["90000001", 50, 300], ["90000003", 50, 100],
    ]);
    assert.equal(r.valorPrevisto, 1400);
  });

  it("contrato que não diz como pagar múltiplos fica pendente", () => {
    const r = calcularHonorario(anestesia({ procedimentos: ["90000001", "90000002"] }), tabelas([contrato({ valoresPorPorte: { 3: 600, 5: 1000 } })]));
    assert.equal(r.valorPrevisto, null);
    assert.equal(r.mensagem, PENDENTE_DE_CONFERENCIA);
    assert.deepEqual(r.pendencias.map((p) => p.tipo), ["multiplos_sem_regra"]);
  });
});

describe("honorários: urgência, adicionais e redutores", () => {
  it("urgência e redutor somados sobre o subtotal", () => {
    const c = contrato({ valoresPorPorte: { 3: 1000 }, urgenciaPercentual: 30, ajustes: [{ nome: "Redutor do contrato", tipo: "percentual", valor: -10, quando: "sempre" }] });
    const r = calcularHonorario(anestesia({ urgencia: true }), tabelas([c]));
    assert.equal(r.valorPrevisto, 1200);
    assert.deepEqual(r.memoria.acrescimos.map((a) => a.valor), [300, -100]);
  });

  it("contrato cumulativo aplica um percentual sobre o outro", () => {
    const c = contrato({ valoresPorPorte: { 3: 1000 }, urgenciaPercentual: 30, ajustesCumulativos: true,
      ajustes: [{ nome: "Redutor do contrato", tipo: "percentual", valor: -10, quando: "sempre" }] });
    const r = calcularHonorario(anestesia({ urgencia: true }), tabelas([c]));
    assert.equal(r.valorPrevisto, 1170);
  });

  it("adicional de urgência só entra na urgência; fixo entra depois", () => {
    const c = contrato({ valoresPorPorte: { 3: 1000 }, urgenciaPercentual: 0,
      ajustes: [{ nome: "Taxa de urgência", tipo: "fixo", valor: 50, quando: "urgencia" }] });
    assert.equal(calcularHonorario(anestesia(), tabelas([c])).valorPrevisto, 1000);
    assert.equal(calcularHonorario(anestesia({ urgencia: true }), tabelas([c])).valorPrevisto, 1050);
  });

  it("urgência sem regra no contrato fica pendente, sem presumir percentual", () => {
    const r = calcularHonorario(anestesia({ urgencia: true }), tabelas([contrato({ valoresPorPorte: { 3: 600 } })]));
    assert.equal(r.valorPrevisto, null);
    assert.deepEqual(r.pendencias.map((p) => p.tipo), ["urgencia_sem_regra"]);
  });

  it("arredonda para o centavo", () => {
    const c = contrato({ valoresPorPorte: { 3: 333.33 }, urgenciaPercentual: 33.33 });
    const r = calcularHonorario(anestesia({ urgencia: true }), tabelas([c]));
    assert.equal(r.valorPrevisto, 444.43);
  });
});

describe("honorários: vigência, reajuste e contratos vencidos", () => {
  const v1 = contrato({ id: "cv1", versao: 1, vigenciaInicio: "2026-01-01", vigenciaFim: "2026-06-30", situacao: "encerrada", valoresPorPorte: { 3: 600 } });
  const v2 = contrato({ id: "cv2", versao: 2, vigenciaInicio: "2026-07-01", valoresPorPorte: { 3: 660 } });

  it("cada anestesia usa a versão vigente na data dela", () => {
    assert.equal(calcularHonorario(anestesia({ data: "2026-03-10" }), tabelas([v1, v2])).memoria.contratoVersaoId, "cv1");
    assert.equal(calcularHonorario(anestesia({ data: "2026-03-10" }), tabelas([v1, v2])).valorPrevisto, 600);
    assert.equal(calcularHonorario(anestesia({ data: "2026-08-10" }), tabelas([v1, v2])).valorPrevisto, 660);
  });

  it("fora de qualquer vigência: sem contrato, sem valor", () => {
    const r = calcularHonorario(anestesia({ data: "2025-12-31" }), tabelas([v1, v2]));
    assert.equal(r.valorPrevisto, null);
    assert.deepEqual(r.pendencias.map((p) => p.tipo), ["sem_contrato"]);
  });

  it("versão em rascunho não vale", () => {
    const r = calcularHonorario(anestesia(), tabelas([contrato({ situacao: "rascunho", valoresPorPorte: { 3: 600 } })]));
    assert.deepEqual(r.pendencias.map((p) => p.tipo), ["sem_contrato"]);
  });

  it("o contrato do hospital vence o geral; dois gerais é ambiguidade", () => {
    const geral = contrato({ id: "g", contratoId: "cg", valoresPorPorte: { 3: 600 } });
    const hospital = contrato({ id: "h", contratoId: "ch", localId: "hosp1", valoresPorPorte: { 3: 700 } });
    assert.equal(contratoAplicavel({ data: "2026-03-10", convenio: "Unimed Fictícia", localId: "hosp1" }, [geral, hospital]).versao?.id, "h");
    assert.equal(contratoAplicavel({ data: "2026-03-10", convenio: "Unimed Fictícia", localId: "outro" }, [geral, hospital]).versao?.id, "g");
    const outroGeral = contrato({ id: "g2", contratoId: "cg2", valoresPorPorte: { 3: 650 } });
    const r = calcularHonorario(anestesia(), tabelas([geral, outroGeral]));
    assert.deepEqual(r.pendencias.map((p) => p.tipo), ["contrato_ambiguo"]);
  });
});

describe("honorários: códigos e tabelas não validados", () => {
  const c = contrato({ valoresPorPorte: { 3: 600, 5: 1000 } });

  it("sem código escolhido", () => {
    const r = calcularHonorario(anestesia({ procedimentos: [] }), tabelas([c]));
    assert.deepEqual(r.pendencias.map((p) => p.tipo), ["codigo_ausente"]);
    assert.equal(r.mensagem, PENDENTE_DE_CONFERENCIA);
    assert.equal(liberaParaOFinanceiro(r), false);
  });

  it("código inexistente, substituído e fora da vigência", () => {
    const t = tabelas([c], { tuss: tuss([{ codigo: "90000004", descricao: "FICTÍCIO NOVO", situacao: "ativo", inicioVigencia: "2026-06-01" }]) });
    assert.deepEqual(calcularHonorario(anestesia({ procedimentos: ["12345678"] }), t).pendencias.map((p) => p.tipo), ["codigo_inexistente"]);
    const sub = calcularHonorario(anestesia({ procedimentos: ["90000009"] }), t);
    assert.deepEqual(sub.pendencias.map((p) => p.tipo), ["codigo_inativo"]);
    assert.match(sub.pendencias[0].texto, /Substituído por 90000001/);
    assert.deepEqual(calcularHonorario(anestesia({ procedimentos: ["90000004"] }), t).pendencias.map((p) => p.tipo), ["codigo_fora_da_vigencia"]);
  });

  it("sem versão da TUSS publicada", () => {
    const r = calcularHonorario(anestesia(), tabelas([c], { tuss: null }));
    assert.deepEqual(r.pendencias.map((p) => p.tipo), ["tuss_sem_versao"]);
    assert.equal(r.valorPrevisto, null);
  });

  it("TUSS e CBHPM não são supostas iguais: sem correspondência validada, pendente", () => {
    const r = calcularHonorario(anestesia(), tabelas([c], { correspondencias: [] }));
    assert.deepEqual(r.pendencias.map((p) => p.tipo), ["sem_correspondencia"]);
  });

  it("procedimento sem porte anestésico na edição", () => {
    const r = calcularHonorario(anestesia({ procedimentos: ["90000003"] }), tabelas([c]));
    assert.deepEqual(r.pendencias.map((p) => p.tipo), ["sem_porte"]);
  });

  it("um código pendente segura o valor da anestesia inteira", () => {
    const r = calcularHonorario(anestesia({ procedimentos: ["90000001", "12345678"] }), tabelas([contrato({ valoresPorPorte: { 3: 600 }, multiplosPercentuais: [100, 50] })]));
    assert.equal(r.valorPrevisto, null);
    assert.equal(r.situacao, "pendente");
  });
});

describe("honorários: duplicidade e divergência", () => {
  const c = contrato({ valoresPorPorte: { 3: 600 }, multiplosPercentuais: [100, 50] });

  it("o mesmo código duas vezes na anestesia", () => {
    const r = calcularHonorario(anestesia({ procedimentos: ["90000001", "90000001"] }), tabelas([c]));
    assert.deepEqual(r.pendencias.map((p) => p.tipo), ["procedimento_duplicado"]);
    assert.equal(r.valorPrevisto, 600, "calcula uma vez e pede conferência");
    assert.equal(r.mensagem, CONFERIR_ANTES_DE_ENVIAR);
    assert.equal(liberaParaOFinanceiro(r), false);
  });

  it("o mesmo procedimento já lançado para o paciente no dia", () => {
    const r = calcularHonorario(anestesia({ paciente: "Paciente Fictício" }), tabelas([c]),
      [{ data: "2026-03-10", paciente: "PACIENTE FICTICIO", codigos: ["90000001"] }]);
    assert.deepEqual(r.pendencias.map((p) => p.tipo), ["procedimento_duplicado"]);
  });

  it("valor anotado diferente do calculado: mantém o calculado e pede conferência", () => {
    const r = calcularHonorario(anestesia({ valorInformado: 500 }), tabelas([c]));
    assert.equal(r.valorPrevisto, 600);
    assert.deepEqual(r.pendencias.map((p) => p.tipo), ["divergencia_valor"]);
    assert.equal(calcularHonorario(anestesia({ valorInformado: 600 }), tabelas([c])).situacao, "calculado");
    assert.equal(calcularHonorario(anestesia({ valorInformado: 0 }), tabelas([c])).situacao, "calculado", "zero é 'não anotado'");
  });
});

describe("honorários: o passado não muda", () => {
  it("a memória do cálculo não acompanha a tabela atualizada depois", () => {
    const c = contrato({ valoresPorPorte: { 3: 600 } });
    const t = tabelas([c]);
    const r = calcularHonorario(anestesia(), t);
    const gravado = JSON.stringify(r);
    c.valoresPorPorte[3] = 999;
    t.cbhpm.get("ed1")!.procedimentos.set("C1", 8);
    t.tuss!.codigos.get("90000001")!.descricao = "OUTRA";
    assert.equal(JSON.stringify(r), gravado);
    assert.equal(r.memoria.linhas[0].descricao, "PROCEDIMENTO FICTÍCIO UM");
    assert.equal(r.memoria.contratoVersaoId, "cv1");
    assert.equal(r.memoria.tussVersao, "202603");
  });
});

describe("honorários: conferência da versão antes de publicar", () => {
  it("aponta o que falta e aceita a versão completa", () => {
    assert.deepEqual(problemasDaVersao(contrato({ referencia: "propria", cbhpmEdicaoId: null })),
      ["Contrato com tabela própria precisa de valores por porte ou por procedimento."]);
    assert.deepEqual(problemasDaVersao(contrato({ cbhpmEdicaoId: null })), ["Contrato pela CBHPM precisa da edição da CBHPM."]);
    assert.ok(problemasDaVersao(contrato({ valoresPorPorte: { 9: 100 } })).some((p) => /AN9 não existe/.test(p)));
    assert.ok(problemasDaVersao(contrato({ ajustes: [{ nome: "", tipo: "fixo", valor: 1, quando: "sempre" }] })).length > 0);
    assert.deepEqual(problemasDaVersao(contrato({ valoresPorPorte: { 3: 600 } })), []);
  });
});
