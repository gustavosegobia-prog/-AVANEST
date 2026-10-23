import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  codigoDaCelula, compararVersoes, dataDaCelula, impressaoDigital, lerCbhpm, lerCorrespondencias, lerDasAbas,
  lerPortesDeReferencia, lerTabelaTuss, lerValoresDoContrato, porteDaCelula, situacaoDoCodigo, valorDaCelula,
} from "./importar-tabelas.ts";
import { abasDoXlsx } from "./xlsx-leitura.ts";
import { zip } from "./zip-de-teste.ts";

// Planilhas fictícias: códigos 9000000x, descrições "FICTÍCIO", valores redondos.

describe("importação: células", () => {
  it("datas em dd/mm/aaaa, ISO e número de série do Excel", () => {
    assert.equal(dataDaCelula("01/03/2026"), "2026-03-01");
    assert.equal(dataDaCelula("2026-03-01"), "2026-03-01");
    assert.equal(dataDaCelula("46082"), "2026-03-01");
    assert.equal(dataDaCelula(""), null);
    assert.equal(dataDaCelula("31/02/2026"), undefined, "data que não existe");
    assert.equal(dataDaCelula("amanhã"), undefined);
  });
  it("valores no formato brasileiro, americano e do Excel", () => {
    assert.equal(valorDaCelula("1.234,56"), 1234.56);
    assert.equal(valorDaCelula("R$ 1.234,56"), 1234.56);
    assert.equal(valorDaCelula("1234,5"), 1234.5);
    assert.equal(valorDaCelula("1234.56"), 1234.56);
    assert.equal(valorDaCelula("1,234.56"), 1234.56);
    assert.equal(valorDaCelula("600"), 600);
    assert.equal(valorDaCelula(""), null);
    assert.equal(valorDaCelula("-10"), undefined, "negativo é erro");
    assert.equal(valorDaCelula("dez"), undefined);
  });
  it("porte AN0 a AN8 e código só de números", () => {
    assert.equal(porteDaCelula("AN3"), 3);
    assert.equal(porteDaCelula("an 0"), 0);
    assert.equal(porteDaCelula("8"), 8);
    assert.equal(porteDaCelula(""), null);
    assert.equal(porteDaCelula("AN9"), undefined);
    assert.equal(porteDaCelula("3A"), undefined);
    assert.equal(codigoDaCelula("90000001"), "90000001");
    assert.equal(codigoDaCelula("9.0000001"), "90000001", "o ponto de milhar some");
    assert.equal(codigoDaCelula("9.0000001E7"), undefined, "notação científica pode ter perdido dígito");
  });
});

describe("importação: TUSS (Tabela 22)", () => {
  const grade = [
    ["Terminologia de Procedimentos e Eventos em Saúde (Tabela 22) — FICTÍCIA"],
    [],
    ["Código do Termo", "Termo", "Data de início de vigência", "Data de fim de vigência", "Data de fim de implantação"],
    ["90000001", "  PROCEDIMENTO FICTÍCIO UM ", "01/01/2020", "", ""],
    ["90000002", "PROCEDIMENTO FICTÍCIO DOIS", "43831", "31/12/2025", ""],
    ["90000003", "", "01/01/2020", "", ""],
    ["ABC", "CÓDIGO INVÁLIDO", "", "", ""],
    ["90000004", "PROCEDIMENTO FICTÍCIO QUATRO", "01/01/2026", "01/01/2020", ""],
    ["90000005", "REPETIDO A", "", "", ""],
    ["90000005", "REPETIDO B", "", "", ""],
  ];

  it("acha o título fora da primeira linha e lê código, descrição e vigência", () => {
    const r = lerTabelaTuss(grade);
    assert.equal(r.linhaDoTitulo, 3);
    assert.equal(r.total, 7);
    assert.deepEqual(r.itens.map((i) => i.codigo), ["90000001", "90000002"]);
    assert.equal(r.itens[0].descricao, "PROCEDIMENTO FICTÍCIO UM", "só os espaços das pontas saem");
    assert.equal(r.itens[1].inicioVigencia, "2020-01-01");
    assert.equal(r.itens[1].fimVigencia, "2025-12-31");
  });

  it("diz a linha e o motivo de cada erro, e não escolhe entre repetidos", () => {
    const r = lerTabelaTuss(grade);
    assert.deepEqual(r.erros.map((e) => e.linha), [6, 7, 8, 9, 10]);
    assert.match(r.erros[0].mensagem, /sem descrição/);
    assert.match(r.erros[1].mensagem, /não é só número/);
    assert.match(r.erros[2].mensagem, /fim da vigência é antes/);
    assert.match(r.erros[3].mensagem, /repetido no arquivo \(linhas 9, 10\)/);
  });

  it("arquivo sem a coluna obrigatória para e diz qual falta", () => {
    const r = lerTabelaTuss([["Nome", "Valor"], ["x", "1"]]);
    assert.equal(r.itens.length, 0);
    assert.match(r.erros[0].mensagem, /Código do Termo/);
  });

  it("o arquivo da ANS como ela publica: capa na primeira aba, título na linha 8, “Descrição Detalhada” ao lado do “Termo”", async () => {
    // Mesmo desenho da Tabela 22 de setembro de 2026 (conferido no arquivo
    // oficial), com códigos e textos fictícios.
    const textos = ["Tabela 22 - Terminologia de procedimentos e eventos em saúde", "Código do Termo", "Termo",
      "Descrição Detalhada", "Data de início de vigência", "Data de fim de vigência", "Data de fim de implantação",
      "PROCEDIMENTO FICTÍCIO UM", "PROCEDIMENTO FICTÍCIO DOIS", "DETALHE FICTÍCIO"];
    const si = textos.map((t) => `<si><t>${t}</t></si>`).join("");
    const s = (ref: string, i: number) => `<c r="${ref}" t="s"><v>${i}</v></c>`;
    const v = (ref: string, n: string) => `<c r="${ref}"><v>${n}</v></c>`;
    const arquivo = zip({
      "xl/workbook.xml": '<workbook><sheets><sheet name="CAPA" sheetId="2" r:id="rId1"/><sheet name="Tab 22  VERSÃO 202609" sheetId="1" r:id="rId2"/></sheets></workbook>',
      "xl/_rels/workbook.xml.rels": '<Relationships><Relationship Id="rId2" Type="x" Target="worksheets/sheet2.xml"/><Relationship Id="rId1" Type="x" Target="worksheets/sheet1.xml"/></Relationships>',
      "xl/sharedStrings.xml": `<sst>${si}</sst>`,
      "xl/worksheets/sheet1.xml": '<worksheet><sheetData><row r="9"><c r="A9" s="9"/></row></sheetData></worksheet>',
      "xl/worksheets/sheet2.xml": `<worksheet><sheetData>
        <row r="6">${s("A6", 0)}</row>
        <row r="8">${s("A8", 1)}${s("B8", 2)}${s("C8", 3)}${s("D8", 4)}${s("E8", 5)}${s("F8", 6)}</row>
        <row r="9">${v("A9", "90000001")}${s("B9", 7)}${v("D9", "39857")}${v("F9", "40466")}</row>
        <row r="10">${v("A10", "90000002")}${s("B10", 8)}${s("C10", 9)}${v("D10", "46296")}${v("F10", "41882")}</row>
      </sheetData></worksheet>`,
    });
    const abas = await abasDoXlsx(arquivo);
    assert.deepEqual(abas.map((a) => a.nome), ["CAPA", "Tab 22  VERSÃO 202609"]);
    const r = lerDasAbas(abas, lerTabelaTuss);
    assert.equal(r.aba, "Tab 22  VERSÃO 202609");
    assert.equal(r.linhaDoTitulo, 8);
    assert.deepEqual(r.erros, []);
    assert.deepEqual(r.itens.map((i) => [i.codigo, i.descricao, i.inicioVigencia, i.fimImplantacao]), [
      ["90000001", "PROCEDIMENTO FICTÍCIO UM", "2009-02-13", "2010-10-15"],
      ["90000002", "PROCEDIMENTO FICTÍCIO DOIS", "2026-10-01", "2014-08-31"],
    ], "a descrição é o “Termo”, nunca a descrição detalhada");
  });

  it("nenhuma aba com as colunas: vale o aviso da primeira", () => {
    const r = lerDasAbas([{ nome: "CAPA", grade: [["AVANEST"]] }, { nome: "Outra", grade: [] }], lerTabelaTuss);
    assert.equal(r.aba, "CAPA");
    assert.match(r.erros[0].mensagem, /Código do Termo/);
  });

  it("código com fim de vigência passado entra como inativo", () => {
    assert.equal(situacaoDoCodigo({ fimVigencia: "2025-12-31" }, "2026-10-23"), "inativo");
    assert.equal(situacaoDoCodigo({ fimVigencia: null }, "2026-10-23"), "ativo");
  });

  it("compara com a versão vigente: novos, alterados, encerrados e não encontrados", () => {
    const anterior = new Map([
      ["90000001", { descricao: "PROCEDIMENTO FICTÍCIO UM", fimVigencia: null }],
      ["90000002", { descricao: "NOME ANTIGO", fimVigencia: null }],
      ["90000008", { descricao: "SAIU DA TABELA", fimVigencia: null }],
    ]);
    const c = compararVersoes(anterior, lerTabelaTuss(grade).itens);
    assert.deepEqual(c.novos, []);
    assert.deepEqual(c.descricaoAlterada.map((d) => d.codigo), ["90000002"]);
    assert.deepEqual(c.encerrados, ["90000002"]);
    assert.deepEqual(c.naoEncontrados, ["90000008"]);
    assert.equal(c.iguais, 1);
  });
});

describe("importação: CBHPM, portes, contratos e correspondências", () => {
  it("CBHPM com porte anestésico; sem porte é permitido, porte inválido não", () => {
    const r = lerCbhpm([
      ["Código", "Procedimento", "Porte anestésico"],
      ["C001", "CIRURGIA FICTÍCIA", "AN3"],
      ["C002", "EXAME FICTÍCIO", ""],
      ["C003", "OUTRA FICTÍCIA", "AN12"],
    ]);
    assert.deepEqual(r.itens, [
      { codigo: "C001", descricao: "CIRURGIA FICTÍCIA", porte: 3 },
      { codigo: "C002", descricao: "EXAME FICTÍCIO", porte: null },
    ]);
    assert.deepEqual(r.erros.map((e) => e.linha), [4]);
  });

  it("valores de referência por porte", () => {
    const r = lerPortesDeReferencia([["Porte", "Valor"], ["AN1", "100,00"], ["AN2", "R$ 1.200,50"], ["AN1", "110"]]);
    assert.deepEqual(r.itens, [{ porte: 2, valor: 1200.5 }]);
    assert.equal(r.erros.length, 2, "AN1 repetido nas duas linhas");
  });

  it("contrato: porte ou código TUSS, nunca os dois", () => {
    const r = lerValoresDoContrato([
      ["Porte", "Código TUSS", "Valor"],
      ["AN3", "", "600"],
      ["", "90000001", "750,00"],
      ["AN4", "90000002", "1"],
      ["", "", "5"],
      ["AN5", "", "caro"],
    ]);
    assert.deepEqual(r.itens, [
      { tipo: "porte", porte: 3, valor: 600 },
      { tipo: "procedimento", tussCodigo: "90000001", valor: 750 },
    ]);
    assert.deepEqual(r.erros.map((e) => e.linha), [4, 5, 6]);
  });

  it("contrato sem coluna de porte nem de código para", () => {
    const r = lerValoresDoContrato([["Valor"], ["10"]]);
    assert.match(r.erros[0].mensagem, /Porte anestésico.*Código TUSS/);
  });

  it("correspondências viram propostas, uma por código TUSS", () => {
    const r = lerCorrespondencias([["Código TUSS", "Código CBHPM"], ["90000001", "C001"], ["90000002", ""], ["90000001", "C009"]]);
    assert.equal(r.itens.length, 0);
    assert.deepEqual(r.erros.map((e) => e.linha), [2, 3, 4]);
    const ok = lerCorrespondencias([["TUSS", "CBHPM"], ["90000001", "C001"]]);
    assert.deepEqual(ok.itens, [{ tussCodigo: "90000001", cbhpmCodigo: "C001" }]);
  });
});

describe("importação: impressão digital", () => {
  it("o mesmo conteúdo dá a mesma impressão; outro conteúdo, outra", async () => {
    const a = await impressaoDigital(new TextEncoder().encode("arquivo fictício"));
    assert.match(a, /^[0-9a-f]{64}$/);
    assert.equal(a, await impressaoDigital(new TextEncoder().encode("arquivo fictício")));
    assert.notEqual(a, await impressaoDigital(new TextEncoder().encode("arquivo fictício.")));
  });
});
