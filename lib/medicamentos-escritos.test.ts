import { test } from "node:test";
import assert from "node:assert/strict";
import {
  lerMedicamentosEscritos,
  lerUmMedicamento,
  mesmoMedicamento,
  diaParaMomento,
} from "./medicamentos-escritos.ts";

test("separa nome, dose e frequência do jeito que se escreve receita", () => {
  assert.deepEqual(lerUmMedicamento("Ozempic 1 mg"), {
    nome: "Ozempic", dose: "1 mg", frequencia: "",
  });
  assert.deepEqual(lerUmMedicamento("Mounjaro 15 mg semanal"), {
    nome: "Mounjaro", dose: "15 mg", frequencia: "semanal",
  });
  assert.deepEqual(lerUmMedicamento("metformina 850mg 2x/dia"), {
    nome: "metformina", dose: "850mg", frequencia: "2x/dia",
  });
  assert.deepEqual(lerUmMedicamento("sinvastatina 20 mg à noite"), {
    nome: "sinvastatina", dose: "20 mg", frequencia: "à noite",
  });
  assert.deepEqual(lerUmMedicamento("dipirona 1 g de 6/6h"), {
    nome: "dipirona", dose: "1 g", frequencia: "de 6/6h",
  });
});

test("vírgula decimal não parte a dose ao meio", () => {
  // Era o defeito mais silencioso: "hidroclorotiazida 12,5 mg" virava dois
  // cadastros, um deles chamado "5 mg".
  assert.deepEqual(lerMedicamentosEscritos("hidroclorotiazida 12,5 mg"), [
    { nome: "hidroclorotiazida", dose: "12,5 mg", frequencia: "" },
  ]);
  assert.deepEqual(lerUmMedicamento("losartana 50/12,5 mg"), {
    nome: "losartana", dose: "50/12,5 mg", frequencia: "",
  });
});

test("a barra não separa remédios: mora dentro da frequência e do combinado", () => {
  // Antes, "2x/dia" virava os cadastros "2x" e "dia".
  const lista = lerMedicamentosEscritos("metformina 850 mg 2x/dia");
  assert.equal(lista.length, 1);
  assert.equal(lista[0].nome, "metformina");
  assert.deepEqual(lerUmMedicamento("losartana/hidroclorotiazida 50 mg"), {
    nome: "losartana/hidroclorotiazida", dose: "50 mg", frequencia: "",
  });
});

test("pedaço que é só frequência, só dose ou só categoria não vira medicamento", () => {
  assert.equal(lerUmMedicamento("semanal"), null);
  assert.equal(lerUmMedicamento("1x ao dia"), null);
  assert.equal(lerUmMedicamento("à noite"), null);
  assert.equal(lerUmMedicamento("20 mg"), null);
  assert.equal(lerUmMedicamento("anticoagulante"), null);
  assert.equal(lerUmMedicamento("caneta emagrecedora"), null);
  assert.equal(lerUmMedicamento(""), null);
  assert.equal(lerUmMedicamento("   "), null);
});

test("a frase inteira do campo vira a lista certa", () => {
  assert.deepEqual(lerMedicamentosEscritos("Ozempic 1 mg, semanal"), [
    { nome: "Ozempic", dose: "1 mg", frequencia: "" },
  ]);
  assert.deepEqual(
    lerMedicamentosEscritos("metformina 850mg 2x/dia; sinvastatina 20 mg à noite"),
    [
      { nome: "metformina", dose: "850mg", frequencia: "2x/dia" },
      { nome: "sinvastatina", dose: "20 mg", frequencia: "à noite" },
    ],
  );
  assert.deepEqual(
    lerMedicamentosEscritos("losartana 50 mg de manhã, AAS 100 mg"),
    [
      { nome: "losartana", dose: "50 mg", frequencia: "de manhã" },
      { nome: "AAS", dose: "100 mg", frequencia: "" },
    ],
  );
  assert.deepEqual(lerMedicamentosEscritos("enalapril + AAS"), [
    { nome: "enalapril", dose: "", frequencia: "" },
    { nome: "AAS", dose: "", frequencia: "" },
  ]);
});

test("remédio sem dose escrita continua sendo remédio", () => {
  assert.deepEqual(lerUmMedicamento("Xarelto"), {
    nome: "Xarelto", dose: "", frequencia: "",
  });
  assert.deepEqual(lerUmMedicamento("insulina NPH"), {
    nome: "insulina NPH", dose: "", frequencia: "",
  });
});

test("os nomes dos botões de adição rápida sobrevivem à leitura", () => {
  // São eles que entram na lista com um clique. Se a leitura os quebrasse, o
  // atalho passaria a cadastrar lixo.
  for (const [escrito, nome, dose] of [
    ["AAS 100 mg", "AAS", "100 mg"],
    ["Xarelto 20 mg", "Xarelto", "20 mg"],
    ["Insulina NPH", "Insulina NPH", ""],
    ["Losartana", "Losartana", ""],
  ] as const) {
    const lido = lerUmMedicamento(escrito);
    assert.ok(lido, escrito);
    assert.equal(lido.nome, nome, escrito);
    assert.equal(lido.dose, dose, escrito);
  }
});

test("comparação de nomes ignora acento e caixa", () => {
  assert.ok(mesmoMedicamento("Ozempic", "ozempic"));
  assert.ok(mesmoMedicamento("Ácido acetilsalicílico", "acido acetilsalicilico"));
  assert.ok(!mesmoMedicamento("Xarelto", "Eliquis"));
});

test("a data da pergunta vira o momento do campo de última dose", () => {
  assert.equal(diaParaMomento("2026-08-10"), "2026-08-10T12:00");
  assert.equal(diaParaMomento(""), "");
  assert.equal(diaParaMomento("10/08/2026"), "");
});
