import test from "node:test";
import assert from "node:assert/strict";
import {
  antropometriaPlausivel, avisoDeFaixa, avisoDePressao, decimalNaTela, lerDecimal, normalizarDecimal,
} from "./numero-clinico.ts";

test("vírgula e ponto valem o mesmo — nunca 10× maior", () => {
  assert.equal(lerDecimal("72,5"), 72.5);
  assert.equal(lerDecimal("72.5"), 72.5);
  assert.equal(lerDecimal("36,5"), 36.5);
  assert.equal(lerDecimal(" 7,21 "), 7.21);
  assert.equal(lerDecimal(""), null);
  assert.equal(lerDecimal(","), null);
});

test("o que se guarda é o que Number() lê; o que se mostra é com vírgula", () => {
  assert.equal(normalizarDecimal("72,5"), "72.5");
  assert.equal(normalizarDecimal("72,"), "72.", "vírgula no fim, enquanto digita, não some");
  assert.equal(normalizarDecimal("1,2,3"), "1.23", "só um separador");
  assert.equal(normalizarDecimal("abc80kg"), "80");
  assert.equal(decimalNaTela("72.5"), "72,5");
  assert.equal(decimalNaTela(undefined), "");
});

test("fora da faixa avisa, dentro não", () => {
  assert.equal(avisoDeFaixa("peso", "72,5"), null);
  assert.match(avisoDeFaixa("peso", "725") ?? "", /Fora da faixa esperada \(1–350 kg\)/);
  assert.equal(avisoDeFaixa("altura", "172"), null);
  assert.match(avisoDeFaixa("altura", "1.72") ?? "", /Parece estar em metros.*172/);
  assert.match(avisoDeFaixa("temperatura", "365") ?? "", /Talvez 36,5/);
  assert.match(avisoDeFaixa("fc", "300") ?? "", /Fora da faixa/);
  assert.equal(avisoDeFaixa("fc", ""), null, "vazio não é erro");
  assert.equal(avisoDeFaixa("campo_sem_faixa", "999"), null);
});

test("pressão com os campos trocados é avisada", () => {
  assert.match(avisoDePressao("80", "140") ?? "", /trocados/);
  assert.equal(avisoDePressao("120", "80"), null);
  assert.equal(avisoDePressao("", "80"), null);
});

test("IMC e peso ideal só com antropometria plausível", () => {
  assert.equal(antropometriaPlausivel(72.5, 172), true);
  assert.equal(antropometriaPlausivel(72.5, 1.72), false, "altura em metros gerava IMC 378583");
  assert.equal(antropometriaPlausivel(null, 172), false);
});
