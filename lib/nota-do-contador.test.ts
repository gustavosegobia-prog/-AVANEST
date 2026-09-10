import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  cnpjEscrito, competenciaPorExtenso, faltaPreencher, folhaDaNota, nomeDaFolhaDaNota,
  type DadosDaNota,
} from "./nota-do-contador.ts";

const base = (extra: Partial<DadosDaNota> = {}): DadosDaNota => ({
  prestador: { nome: "INOVANEST", cnpj: "11.222.333/0001-44" },
  profissional: { nome: "Dr. Gustavo Segobia da Silva", crm: "49131 - PR" },
  tomador: { nome: "FUNDAÇÃO HOSPITALAR DE SAÚDE DO PARANÁ", cnpj: "95641007000107" },
  competencia: "2026-08",
  emitidaEm: "2026-09-10",
  plantoes: [
    { data: "2026-08-30", turno: "07:00 às 07:00", horas: 24, valor: 2000 },
    { data: "2026-08-01", turno: "07:00 às 07:00", horas: 24, valor: 2000 },
    { data: "2026-08-28", turno: "07:00 às 19:00", horas: 12, valor: 1000 },
  ],
  ...extra,
});

const celula = (linhas: (string | number)[][], rotulo: string) =>
  linhas.find((l) => l[0] === rotulo)?.[1];

test("o CNPJ sai pontuado, venha como vier do cadastro", () => {
  // O cadastro aceita os dois jeitos porque foi digitado por gente diferente em
  // momentos diferentes. Catorze dígitos corridos é onde o olho troca um número
  // sem perceber, e é contra um documento que o contador confere.
  assert.equal(cnpjEscrito("06339994000151"), "06.339.994/0001-51");
  assert.equal(cnpjEscrito("06.339.994/0001-51"), "06.339.994/0001-51");
});

test("CNPJ malformado volta como está, e não corrigido", () => {
  // Completar um CNPJ de treze dígitos seria adivinhar qual falta — e um
  // documento adivinhado é pior do que um documento faltando.
  assert.equal(cnpjEscrito("123456"), "123456");
  assert.equal(cnpjEscrito(null), "");
});

test("a folha traz quem presta, para quem, de que mês e quanto", () => {
  const linhas = folhaDaNota(base());
  assert.equal(linhas[0][0], "RELATÓRIO PARA EMISSÃO DE NOTA FISCAL");
  assert.equal(celula(linhas, "Prestador"), "INOVANEST");
  assert.equal(celula(linhas, "CNPJ do tomador"), "95.641.007/0001-07");
  assert.equal(celula(linhas, "CRM"), "49131 - PR");
  assert.equal(celula(linhas, "Competência"), "agosto de 2026");
  assert.equal(celula(linhas, "Nota emitida em"), "10/09/2026");
});

test("os plantões saem em ordem de data, e o total fecha", () => {
  // Por data porque é a ordem em que o hospital confere contra a própria
  // escala. O total vem pronto: uma folha que obrigasse a somar de novo
  // devolveria o trabalho que ela veio tirar.
  const linhas = folhaDaNota(base());
  const inicio = linhas.findIndex((l) => l[0] === "Data") + 1;
  const datas = linhas.slice(inicio, inicio + 3).map((l) => l[0]);
  assert.deepEqual(datas, ["01/08/2026", "28/08/2026", "30/08/2026"]);

  const total = linhas[linhas.length - 1];
  // TRÊS LINHAS, CINCO PLANTÕES: 60 horas ÷ 12. O de 24 horas conta por dois,
  // porque é assim que ele é pago. Contar linhas dizia "3 plantões" e
  // contradizia o cartão da tela, que já usava a régua certa.
  assert.equal(total[0], "TOTAL — 5 plantões");
  assert.equal(total[2], 60);   // horas
  assert.equal(total[3], 5000); // reais
});

test("o total conta plantão por HORA, e não por lançamento", () => {
  // A régua é a mesma do resto do sistema — lib/escala.ts —, e é ela que faz o
  // número da folha conversar com o do cartão. Duas contagens do mesmo mês é o
  // tipo de discordância que o contador descobre na frente do hospital.
  const seisLancamentos = folhaDaNota(base({
    plantoes: [
      { data: "2026-08-01", turno: "07:00 às 07:00", horas: 24, valor: 2000 },
      { data: "2026-08-02", turno: "07:00 às 07:00", horas: 24, valor: 2000 },
      { data: "2026-08-28", turno: "07:00 às 19:00", horas: 12, valor: 1000 },
      { data: "2026-08-28", turno: "19:00 às 07:00", horas: 12, valor: 1000 },
      { data: "2026-08-29", turno: "07:00 às 07:00", horas: 24, valor: 2000 },
      { data: "2026-08-30", turno: "07:00 às 07:00", horas: 24, valor: 2000 },
    ],
  }));
  const total = seisLancamentos[seisLancamentos.length - 1];
  assert.equal(total[0], "TOTAL — 10 plantões", "120 horas são dez plantões");
  assert.equal(total[2], 120);
  assert.equal(total[3], 10000);
});

test("meio turno não vira plantão inteiro", () => {
  // Seis horas são meio plantão, e a folha diz isso. Arredondar para cima daria
  // à nota um plantão que não houve.
  const meio = folhaDaNota(base({
    plantoes: [{ data: "2026-08-01", turno: "07:00 às 13:00", horas: 6, valor: 500 }],
  }));
  assert.equal(meio[meio.length - 1][0], "TOTAL — 0,5 plantões");
});

test("os números são NÚMERO, e não texto formatado", () => {
  // É o que permite ao contador somar a coluna e conferir por conta própria.
  // Uma planilha com "R$ 2.000,00" em cada célula é uma imagem de planilha.
  const linhas = folhaDaNota(base());
  const total = linhas[linhas.length - 1];
  assert.equal(typeof total[2], "number");
  assert.equal(typeof total[3], "number");
});

test("CNPJ que falta vira um traço e um pedido, nunca um palpite", () => {
  // O contador que recebe um CNPJ errado emite a nota para a empresa errada.
  // Um campo em branco pede uma pergunta; um campo errado não pede nada.
  const dados = base({ tomador: { nome: "HOSPITAL MEMORIAL", cnpj: null } });
  const linhas = folhaDaNota(dados);
  assert.equal(celula(linhas, "CNPJ do tomador"), "—");
  assert.deepEqual(faltaPreencher(dados),
    ["CNPJ de HOSPITAL MEMORIAL (cadastre em Locais de atendimento)"]);
  // E o pedido aparece na própria folha, não só no código.
  assert.ok(linhas.some((l) => String(l[0]).startsWith("FALTA PREENCHER")),
    "o contador tem de ver o que falta ao abrir o arquivo");
});

test("com tudo preenchido, não sobra aviso na folha", () => {
  const linhas = folhaDaNota(base());
  assert.equal(faltaPreencher(base()).length, 0);
  assert.ok(!linhas.some((l) => String(l[0]).startsWith("FALTA PREENCHER")));
});

test("o arquivo leva o nome do hospital", () => {
  // Três hospitais no mesmo mês produziriam três arquivos de nome igual, e o
  // segundo sobrescreveria o primeiro na pasta de downloads sem avisar.
  assert.equal(nomeDaFolhaDaNota("FUNDHOSPAR", "2026-08"),
    "avanest-nota-fundhospar-2026-08.xlsx");
  assert.equal(nomeDaFolhaDaNota("Residência Santa Casa", "2026-08"),
    "avanest-nota-residencia-santa-casa-2026-08.xlsx");
});

test("o mês por extenso não depende do relógio", () => {
  assert.equal(competenciaPorExtenso("2026-01"), "janeiro de 2026");
  assert.equal(competenciaPorExtenso("2026-12"), "dezembro de 2026");
});

test("a folha é gerada do mesmo painel em que a nota é marcada", () => {
  // É o mesmo gesto, no mesmo minuto: marcou os plantões, emitiu, manda a
  // lista. Separar os dois faria a pessoa remarcar tudo noutro lugar, e é aí
  // que um plantão fica de fora e a nota sai a menor.
  const tela = fs.readFileSync(
    new URL("../components/meu-financeiro.tsx", import.meta.url), "utf8");
  assert.match(tela, /Relatório de plantões/);
  assert.match(tela, /folhaParaOContador\(l\.nome, l\.pendentes\)/);
  // Sem seleção ela leva o que já tem nota — que é o estado em que a pessoa
  // fica logo depois de apertar "Emiti a nota".
  assert.match(tela, /escolhidos\.length\s*\n?\s*\?\s*escolhidos/);
  assert.match(tela, /p\.situacao === "faturado"/);
});
