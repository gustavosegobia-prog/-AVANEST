import test from "node:test";
import assert from "node:assert/strict";
import {
  chavePreditor,
  contarPreditores,
  resumoViaAerea,
  riscoViaAerea,
} from "./via-aerea.ts";

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
