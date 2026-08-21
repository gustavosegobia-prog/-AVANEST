import test from "node:test";
import assert from "node:assert/strict";
import {
  chavePreditor,
  contarPreditores,
  frasePreditores,
  frasePreditoresMarcados,
  resumoViaAerea,
  riscoNoMasculino,
  riscoViaAerea,
} from "./via-aerea.ts";

test("o plural é escrito, não deixado como preditor(es)", () => {
  assert.equal(frasePreditores(1), "1 preditor");
  assert.equal(frasePreditores(3), "3 preditores");
  // Zero é plural em português: "nenhum preditor" seria outra frase, e quem
  // chama isto já não imprime a linha quando a conta dá zero.
  assert.equal(frasePreditores(0), "0 preditores");
  assert.equal(frasePreditoresMarcados(1), "1 preditor marcado");
  assert.equal(frasePreditoresMarcados(4), "4 preditores marcados");
});

test("via aérea sem nada marcado não tem preditor", () => {
  assert.equal(contarPreditores({}), 0);
  assert.equal(riscoViaAerea(0), "Baixa");
});

test("a chave da caixinha é a mesma que a tela grava", () => {
  assert.equal(chavePreditor("Radioterapia cervical prévia"), "via_radioterapia_cervical_pr_via");
  assert.equal(chavePreditor("Retrognatia/micrognatia"), "via_retrognatia_micrognatia");
});

test("o achado do exame conta como preditor, não só a caixinha", () => {
  // Este é o caso que quebrou na ficha impressa: Mallampati IV sozinho não
  // marca nenhum `via_*`, e antes a impressão contava zero.
  assert.equal(contarPreditores({ mallampati: "Classe IV" }), 1);
  assert.equal(contarPreditores({ mobilidade: "Reduzida" }), 1);
});

test("Mallampati baixo e mobilidade normal não são preditor", () => {
  assert.equal(contarPreditores({ mallampati: "Classe II", mobilidade: "Normal", abertura_oral: "> 4 cm" }), 0);
});

test("edentado não conta — atrapalha ventilar, não intubar", () => {
  assert.equal(contarPreditores({ denticao: "Edentado" }), 0);
  assert.equal(contarPreditores({ denticao: "Prótese removível" }), 1);
});

test("a ficha real: Mallampati IV + mobilidade reduzida + radioterapia = Alta", () => {
  const dados = {
    mallampati: "Classe IV",
    abertura_oral: "> 4 cm",
    distancia_tireo: "> 6,5 cm",
    denticao: "Edentado",
    mobilidade: "Reduzida",
    via_radioterapia_cervical_pr_via: true,
  };
  const resumo = resumoViaAerea(dados);
  assert.equal(resumo.total, 3);
  assert.equal(resumo.risco, "Alta");
  assert.deepEqual(resumo.preditores, ["Radioterapia cervical prévia"]);
});

test("um e dois preditores são Moderada; três já é Alta", () => {
  assert.equal(riscoViaAerea(1), "Moderada");
  assert.equal(riscoViaAerea(2), "Moderada");
  assert.equal(riscoViaAerea(3), "Alta");
  assert.equal(riscoViaAerea(9), "Alta");
});

test("caixinha só conta quando é true de verdade", () => {
  // O rascunho guarda string em quase tudo; um "false" de texto não pode
  // virar preditor.
  assert.equal(contarPreditores({ via_barba: "false" } as Record<string, unknown>), 0);
  assert.equal(contarPreditores({ via_barba: false }), 0);
  assert.equal(contarPreditores({ via_barba: true }), 1);
});

test("na ficha o rótulo é \"Risco sugerido\", e risco é masculino", () => {
  assert.equal(riscoNoMasculino("Baixa"), "Baixo");
  assert.equal(riscoNoMasculino("Moderada"), "Moderado");
  assert.equal(riscoNoMasculino("Alta"), "Alto");
});

test("as duas formas saem da mesma conta, não de duas", () => {
  const dados = { mallampati: "Classe IV", mobilidade: "Reduzida", via_barba: true };
  const { risco } = resumoViaAerea(dados);
  assert.equal(risco, "Alta");                      // "Alta probabilidade" na tela
  assert.equal(riscoNoMasculino(risco), "Alto");    // "Risco sugerido: Alto" no papel
});
