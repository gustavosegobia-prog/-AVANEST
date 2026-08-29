import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  nomeDoArquivo, numeroBR, paraCSV, planilhaDeFaturamento, planilhaDePlantoes,
  planilhaPorConvenio,
} from "./planilha.ts";

describe("o formato que o Excel em português abre certo", () => {
  it("começa com BOM", () => {
    // Sem ele o Excel do Windows lê UTF-8 como Latin-1 e "anestésica" vira
    // "anestÃ©sica" já na primeira coluna.
    assert.equal(paraCSV([["a"]]).charCodeAt(0), 0xfeff);
  });

  it("separa colunas com ponto e vírgula", () => {
    // O Excel em pt-BR usa a vírgula como separador DECIMAL. Com vírgula de
    // separador, "1,50" viraria duas células.
    assert.equal(paraCSV([["a", "b"]]), "﻿\"a\";\"b\"");
  });

  it("termina as linhas com CRLF", () => {
    assert.equal(paraCSV([["a"], ["b"]]).includes("\r\n"), true);
  });

  it("escreve número com vírgula decimal e duas casas", () => {
    assert.equal(numeroBR(2000), "2000,00");
    assert.equal(numeroBR(1234.5), "1234,50");
    assert.equal(numeroBR(0), "0,00");
  });

  it("o CSV formata o número que o montador entregou cru", () => {
    // A divisão de trabalho: o montador devolve 2000, o CSV escreve "2000,00" e
    // o Excel recebe o 2000 como número. Um dado, dois formatos.
    assert.equal(paraCSV([[2000]]), "﻿\"2000,00\"");
  });
});

describe("célula segura", () => {
  it("cita tudo, mesmo o que parece inofensivo", () => {
    assert.equal(paraCSV([["Ana"]]), "﻿\"Ana\"");
  });

  it("aspas dentro do texto viram aspas dobradas", () => {
    assert.equal(paraCSV([['Hospital "Santa Casa"']]),
      "﻿\"Hospital \"\"Santa Casa\"\"\"");
  });

  it("ponto e vírgula dentro do texto não quebra a coluna", () => {
    // O caso real: observação de plantão com ponto e vírgula. A regra "só cita
    // quando precisa" erra justamente aqui.
    const csv = paraCSV([["Cobertura; hora extra", "500,00"]]);
    assert.equal(csv, "﻿\"Cobertura; hora extra\";\"500,00\"");
  });

  it("quebra de linha dentro da célula fica dentro das aspas", () => {
    assert.equal(paraCSV([["linha 1\nlinha 2"]]), "﻿\"linha 1\nlinha 2\"");
  });
});

describe("planilha de plantões", () => {
  const plantoes = [
    { data: "2026-08-01", local: "FUNDHOSPAR", turno: "07:00 às 07:00", horas: 24, valor: 2000, situacao: "realizado" },
    { data: "2026-08-05", local: "Santa Casa", turno: "07:00 às 19:00", horas: 12, valor: 900, situacao: "pago" },
  ];

  it("traz cabeçalho, uma linha por plantão e o TOTAL somado", () => {
    // O total vem pronto de propósito: a folha impressa passou a trazê-lo, e uma
    // planilha que obrigasse a somar de novo devolveria o trabalho.
    const linhas = planilhaDePlantoes(plantoes);
    assert.equal(linhas.length, 4);
    assert.deepEqual(linhas[0], ["Data", "Local", "Turno", "Horas", "Valor", "Situação"]);
    // Números CRUS, e não "36,00": o Excel precisa deles como número para o
    // contador somar a coluna. Quem formata é o serializador de cada formato.
    assert.deepEqual(linhas[3], ["TOTAL", "", "", 36, 2900, ""]);
  });

  it("escreve a data no formato brasileiro", () => {
    assert.equal(planilhaDePlantoes(plantoes)[1][0], "01/08/2026");
  });

  it("traduz a situação para o que se lê", () => {
    assert.equal(planilhaDePlantoes(plantoes)[1][5], "Realizado");
    assert.equal(planilhaDePlantoes(plantoes)[2][5], "Pago");
  });

  it("com UM profissional não cria a coluna de nome", () => {
    // Num serviço de uma pessoa ela seria o mesmo nome repetido trinta vezes.
    const linhas = planilhaDePlantoes(plantoes.map((p) => ({ ...p, profissional: "Dr. Gustavo" })));
    assert.equal(linhas[0].includes("Profissional"), false);
  });

  it("com MAIS DE UM profissional a coluna aparece", () => {
    const linhas = planilhaDePlantoes([
      { ...plantoes[0], profissional: "Dra. Ana" },
      { ...plantoes[1], profissional: "Dr. Bruno" },
    ]);
    assert.deepEqual(linhas[0],
      ["Data", "Profissional", "Local", "Turno", "Horas", "Valor", "Situação"]);
    assert.equal(linhas[1][1], "Dra. Ana");
    // O TOTAL tem de ter o mesmo número de colunas, senão a planilha entorta.
    assert.equal(linhas[3].length, linhas[0].length);
  });

  it("mês sem plantão devolve só cabeçalho e total zerado", () => {
    const linhas = planilhaDePlantoes([]);
    assert.equal(linhas.length, 2);
    assert.deepEqual(linhas[1], ["TOTAL", "", "", 0, 0, ""]);
  });
});

describe("planilha de faturamento", () => {
  const itens = [
    { data: "2026-08-14", paciente: "Cassilda", convenio: "Unimed", valor: 800, situacao: "a_cobrar", pagador: "convenio" },
    { data: "2026-08-15", paciente: "José", convenio: "Particular", valor: 500, situacao: "recebido", pagador: "direto" },
  ];

  it("traz o essencial de quem emite a nota", () => {
    const linhas = planilhaDeFaturamento(itens);
    assert.deepEqual(linhas[0], ["Data", "Paciente", "Convênio", "Quem paga", "Valor", "Situação"]);
    assert.deepEqual(linhas[1], ["14/08/2026", "Cassilda", "Unimed", "Convênio", 800, "A cobrar"]);
  });

  it("soma o total", () => {
    const linhas = planilhaDeFaturamento(itens);
    assert.equal(linhas[linhas.length - 1][linhas[0].length - 2], 1300);
  });

  it("não cria coluna de procedimento quando ninguém preencheu", () => {
    // Coluna vazia em planilha enviada por e-mail parece dado perdido no
    // caminho.
    assert.equal(planilhaDeFaturamento(itens)[0].includes("Procedimento"), false);
  });

  it("cria a coluna quando ao menos um item tem procedimento", () => {
    const linhas = planilhaDeFaturamento([
      { ...itens[0], procedimento: "Colecistectomia" }, itens[1],
    ]);
    assert.equal(linhas[0][3], "Procedimento");
    assert.equal(linhas[1][3], "Colecistectomia");
    assert.equal(linhas[2][3], "");
    assert.equal(linhas[3].length, linhas[0].length, "o TOTAL tem de acompanhar as colunas");
  });

  it("cria a coluna do local só quando há local", () => {
    const linhas = planilhaDeFaturamento([{ ...itens[0], local: "Santa Casa" }, itens[1]]);
    assert.equal(linhas[0].includes("Local"), true);
    assert.equal(linhas[1][3], "Santa Casa");
  });

  it("todas as linhas têm o mesmo número de colunas", () => {
    // Uma linha mais curta desloca tudo à direita dela quando o Excel abre.
    const linhas = planilhaDeFaturamento([
      { ...itens[0], procedimento: "Colecistectomia", local: "Santa Casa" }, itens[1],
    ]);
    const largura = linhas[0].length;
    for (const [i, linha] of linhas.entries()) {
      assert.equal(linha.length, largura, `a linha ${i} tem largura diferente`);
    }
  });
});

describe("nome do arquivo", () => {
  it("põe o ano antes do mês, para a pasta ordenar em ordem cronológica", () => {
    assert.equal(nomeDoArquivo("plantoes", "2026-08"), "avanest-plantoes-2026-08.xlsx");
  });

  it("aceita outra extensão, para quem preferir CSV", () => {
    assert.equal(nomeDoArquivo("plantoes", "2026-08", "csv"), "avanest-plantoes-2026-08.csv");
  });
});

describe("planilha por convênio", () => {
  const itens = [
    { data: "2026-08-28", paciente: "João", convenio: "UNIMED LOCAL", valor: 700, situacao: "a_cobrar" },
    { data: "2026-08-01", paciente: "Gessica", convenio: "Unimed", valor: 900, situacao: "recebido" },
    { data: "2026-08-14", paciente: "Édson", convenio: "UNIMED LOCAL", valor: 500, situacao: "a_cobrar" },
  ];

  it("agrupa numa COLUNA, e não em abas", () => {
    // Quem recebe quer filtrar, ordenar e somar por conta própria. Três abas
    // impedem exatamente isso.
    const linhas = planilhaPorConvenio(itens);
    assert.deepEqual(linhas[0], ["Convênio", "Data", "Paciente", "Valor", "Situação"]);
    // Cada linha de dado carrega o convênio a que pertence.
    assert.equal(linhas[1][0], "Unimed");
  });

  it("junta os pacientes do mesmo convênio, em blocos", () => {
    // A ordem ENTRE convênios é a alfabética do pt-BR — que põe "Unimed"
    // antes de "UNIMED LOCAL", por ser prefixo mais curto. O que o teste
    // garante é que os do mesmo convênio ficam juntos, e não intercalados.
    const linhas = planilhaPorConvenio(itens).slice(1, -1)
      .filter((l) => !String(l[0]).startsWith("Total"));
    const convenios = linhas.map((l) => l[0]);
    assert.deepEqual([...new Set(convenios)].length, convenios.length - 1,
      "os dois da UNIMED LOCAL têm de estar em sequência");
  });

  it("dentro do convênio, ordena por data", () => {
    // Édson é do dia 14 e João do 28, e vieram na ordem inversa na entrada.
    const daUnimedLocal = planilhaPorConvenio(itens)
      .filter((l) => l[0] === "UNIMED LOCAL").map((l) => l[2]);
    assert.deepEqual(daUnimedLocal, ["Édson", "João"]);
  });

  it("fecha cada convênio com o subtotal, que é o que se confere com a operadora", () => {
    const linhas = planilhaPorConvenio(itens);
    const subtotal = linhas.find((l) => l[0] === "Total UNIMED LOCAL");
    assert.ok(subtotal, "faltou o subtotal");
    assert.equal(subtotal[subtotal.length - 2], 1200);
  });

  it("termina com o total geral", () => {
    const linhas = planilhaPorConvenio(itens);
    const ultima = linhas[linhas.length - 1];
    assert.equal(ultima[0], "TOTAL GERAL");
    assert.equal(ultima[ultima.length - 2], 2100);
  });

  it("sem convênio cai em Particular, e não numa célula vazia", () => {
    const linhas = planilhaPorConvenio([{ ...itens[0], convenio: "  " }]);
    assert.equal(linhas[1][0], "Particular");
  });

  it("todas as linhas têm a mesma largura", () => {
    // Uma linha mais curta desloca tudo à direita dela quando o Excel abre.
    const linhas = planilhaPorConvenio(itens.map((i, n) =>
      n === 0 ? { ...i, procedimento: "Colecistectomia" } : i));
    const largura = linhas[0].length;
    for (const [n, linha] of linhas.entries()) {
      assert.equal(linha.length, largura, `a linha ${n} tem largura diferente`);
    }
  });

  it("mês vazio devolve cabeçalho e total zerado", () => {
    const linhas = planilhaPorConvenio([]);
    assert.equal(linhas.length, 2);
    assert.equal(linhas[1][0], "TOTAL GERAL");
  });
});
