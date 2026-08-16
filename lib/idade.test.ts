import { test } from "node:test";
import assert from "node:assert/strict";
import {
  idadeDoPaciente,
  idadePorNascimento,
  lerIdadeInformada,
  mesesPorNascimento,
} from "./idade.ts";

// Data fixa para os testes não mudarem de resultado com o passar dos dias.
const HOJE = new Date("2026-08-14T12:00:00");

test("idade pela data de nascimento conta anos completos", () => {
  assert.equal(idadePorNascimento("1956-08-14", HOJE), 70);
  // Aniversário amanhã: ainda não fez.
  assert.equal(idadePorNascimento("1956-08-15", HOJE), 69);
  // Aniversário ontem: já fez.
  assert.equal(idadePorNascimento("1956-08-13", HOJE), 70);
  assert.equal(idadePorNascimento("2026-08-14", HOJE), 0);
});

test("data impossível não vira idade", () => {
  assert.equal(idadePorNascimento("", HOJE), null);
  assert.equal(idadePorNascimento(null, HOJE), null);
  assert.equal(idadePorNascimento("14/08/1956", HOJE), null);
  assert.equal(idadePorNascimento("2030-01-01", HOJE), null, "no futuro");
  assert.equal(idadePorNascimento("1800-01-01", HOJE), null, "acima de 130 anos");
});

test("meses completos, que é o que a via aérea pediátrica usa", () => {
  assert.equal(mesesPorNascimento("2026-02-14", HOJE), 6);
  assert.equal(mesesPorNascimento("2025-08-14", HOJE), 12);
  assert.equal(mesesPorNascimento("2025-08-15", HOJE), 11);
  assert.equal(mesesPorNascimento("", HOJE), undefined);
});

test("idade digitada aceita só inteiro dentro do possível", () => {
  assert.equal(lerIdadeInformada("70"), 70);
  assert.equal(lerIdadeInformada(70), 70);
  assert.equal(lerIdadeInformada("70,5"), null, "vírgula não é número aqui");
  assert.equal(lerIdadeInformada("70.9"), 70, "ponto decimal trunca");
  assert.equal(lerIdadeInformada("0"), 0, "recém-nascido é idade válida");
  assert.equal(lerIdadeInformada("-1"), null);
  assert.equal(lerIdadeInformada("200"), null);
  assert.equal(lerIdadeInformada(""), null);
  assert.equal(lerIdadeInformada(null), null);
  assert.equal(lerIdadeInformada("setenta"), null);
});

test("a data de nascimento vence a idade digitada", () => {
  const r = idadeDoPaciente({ data_nascimento: "1956-08-14", idade_anos: 42 }, HOJE);
  assert.equal(r.anos, 70);
  assert.equal(r.fonte, "nascimento");
  assert.equal(r.meses, 840);
  assert.equal(r.nascimentoInvalido, false);
});

test("sem data de nascimento, vale a idade digitada", () => {
  const r = idadeDoPaciente({ data_nascimento: null, idade_anos: 78 }, HOJE);
  assert.equal(r.anos, 78);
  assert.equal(r.fonte, "informada");
  assert.equal(r.meses, 78 * 12);
});

test("data inválida no cadastro é sinalizada, e a idade digitada segura a avaliação", () => {
  const r = idadeDoPaciente({ data_nascimento: "1800-01-01", idade_anos: 78 }, HOJE);
  assert.equal(r.anos, 78);
  assert.equal(r.fonte, "informada");
  assert.equal(r.nascimentoInvalido, true, "a tela precisa avisar que a data está errada");
});

test("abaixo de dois anos, idade digitada não vira meses", () => {
  // "1 ano" pode ser 12 ou 23 meses, e a diferença troca tubo e lâmina.
  // Nessa faixa o cálculo pediátrico tem de exigir a data de nascimento.
  const bebe = idadeDoPaciente({ idade_anos: 1 }, HOJE);
  assert.equal(bebe.anos, 1);
  assert.equal(bebe.meses, undefined);

  const recem = idadeDoPaciente({ idade_anos: 0 }, HOJE);
  assert.equal(recem.anos, 0);
  assert.equal(recem.meses, undefined);

  // De dois anos em diante a aproximação já não muda a conduta.
  assert.equal(idadeDoPaciente({ idade_anos: 2 }, HOJE).meses, 24);
});

test("sem nenhum dos dois, não há idade", () => {
  const r = idadeDoPaciente({}, HOJE);
  assert.equal(r.anos, null);
  assert.equal(r.meses, undefined);
  assert.equal(r.fonte, "ausente");
  assert.equal(r.nascimentoInvalido, false);
});

test("a idade que entra no STOP-Bang é a mesma pelos dois caminhos", () => {
  // O critério é > 50 anos. Os dois pacientes têm de pontuar igual.
  const porData = idadeDoPaciente({ data_nascimento: "1955-01-10" }, HOJE).anos;
  const porDigitacao = idadeDoPaciente({ idade_anos: 71 }, HOJE).anos;
  assert.equal(porData, 71);
  assert.equal(porDigitacao, 71);
  assert.equal((porData ?? 0) > 50, (porDigitacao ?? 0) > 50);
});
