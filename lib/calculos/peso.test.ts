import { strict as assert } from "node:assert";
import { test } from "node:test";
import { pesoAjustado, pesoDaDose, pesoIdeal, pesoMagro } from "./peso.ts";

const homem = { pesoKg: 130, alturaCm: 170, sexo: "Masculino", idadeAnos: 40 };

test("peso ideal de Devine: o mesmo da avaliação pré-anestésica", () => {
  assert.equal(pesoIdeal(homem), 65.9);
  assert.equal(pesoIdeal({ ...homem, sexo: "Feminino", alturaCm: 160 }), 52.4);
  // A conta da avaliação (assessment-form.tsx), sem arredondar, dá o mesmo número.
  const daAvaliacao = 50 + 2.3 * (170 / 2.54 - 60);
  assert.ok(Math.abs(pesoIdeal(homem)! - daAvaliacao) < 0.05);
  // Abaixo de 152 cm, na criança e sem sexo, a fórmula não vale.
  assert.equal(pesoIdeal({ ...homem, alturaCm: 150 }), null);
  assert.equal(pesoIdeal({ ...homem, idadeAnos: 12 }), null);
  assert.equal(pesoIdeal({ ...homem, sexo: null }), null);
});

test("peso ajustado é o ideal mais 40% do excesso; sem excesso, o próprio peso", () => {
  assert.equal(pesoAjustado(homem), 91.5);
  assert.equal(pesoAjustado({ ...homem, pesoKg: 60 }), 60);
});

test("peso magro de Janmahasatian, diferente para homem e mulher", () => {
  assert.equal(pesoMagro(homem), 73.5);
  assert.ok(pesoMagro({ ...homem, sexo: "Feminino" })! < pesoMagro(homem)!);
});

test("o peso da dose nunca aumenta a conta, e diz quando não pôde corrigir", () => {
  assert.deepEqual(pesoDaDose("ideal", homem), { kg: 65.9, base: "ideal", aviso: null });
  assert.deepEqual(pesoDaDose(undefined, homem), { kg: 130, base: "atual", aviso: null });
  // Magro: abaixo do ideal, vai o peso atual.
  assert.deepEqual(pesoDaDose("ideal", { ...homem, pesoKg: 55 }), { kg: 55, base: "atual", aviso: null });
  // Sem altura: peso atual, com o aviso.
  const sem = pesoDaDose("magro", { pesoKg: 130, sexo: "M", idadeAnos: 40 });
  assert.equal(sem.kg, 130);
  assert.match(sem.aviso!, /peso magro/);
  // Criança: a tabela pediátrica é pelo peso da balança, sem aviso.
  assert.deepEqual(pesoDaDose("ideal", { pesoKg: 20, idadeAnos: 6 }), { kg: 20, base: "atual", aviso: null });
});
