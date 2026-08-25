import test from "node:test";
import assert from "node:assert/strict";
import { domingoDePascoa, feriadosDoAno, feriadosDoMes } from "./feriados.ts";

// Os anos conferidos contra o calendário brasileiro publicado. A Páscoa é o
// que move Carnaval, Sexta-feira Santa e Corpus Christi: errar nela erra os
// quatro de uma vez, e num ano só — o que passaria despercebido até chegar o
// mês.
test("domingo de Páscoa nos anos que dá para conferir", () => {
  assert.deepEqual(domingoDePascoa(2024), { mes: 3, dia: 31 });
  assert.deepEqual(domingoDePascoa(2025), { mes: 4, dia: 20 });
  assert.deepEqual(domingoDePascoa(2026), { mes: 4, dia: 5 });
  assert.deepEqual(domingoDePascoa(2027), { mes: 3, dia: 28 });
});

test("os móveis saem da Páscoa, e caem onde devem", () => {
  const f = feriadosDoAno(2026);
  assert.equal(f.get("2026-02-16")?.nome, "Carnaval");
  assert.equal(f.get("2026-02-17")?.nome, "Carnaval");
  assert.equal(f.get("2026-04-03")?.nome, "Sexta-feira Santa");
  assert.equal(f.get("2026-06-04")?.nome, "Corpus Christi");

  const f25 = feriadosDoAno(2025);
  assert.equal(f25.get("2025-03-03")?.nome, "Carnaval");
  assert.equal(f25.get("2025-04-18")?.nome, "Sexta-feira Santa");
  assert.equal(f25.get("2025-06-19")?.nome, "Corpus Christi");
});

test("Carnaval e Corpus Christi são facultativos, e aparecem assim", () => {
  // Chamá-los de feriado seria dizer o que a lei federal não diz. Escondê-los
  // seria esconder o dia mais difícil de cobrir do ano.
  const f = feriadosDoAno(2026);
  assert.equal(f.get("2026-02-17")?.tipo, "facultativo");
  assert.equal(f.get("2026-06-04")?.tipo, "facultativo");
  assert.equal(f.get("2026-04-03")?.tipo, "nacional");
  assert.equal(f.get("2026-12-25")?.tipo, "nacional");
});

test("os fixos, todos eles", () => {
  const f = feriadosDoAno(2026);
  for (const [data, nome] of [
    ["2026-01-01", "Confraternização Universal"],
    ["2026-04-21", "Tiradentes"],
    ["2026-05-01", "Dia do Trabalho"],
    ["2026-09-07", "Independência do Brasil"],
    ["2026-10-12", "Nossa Senhora Aparecida"],
    ["2026-11-02", "Finados"],
    ["2026-11-15", "Proclamação da República"],
    ["2026-12-25", "Natal"],
  ]) {
    assert.equal(f.get(data)?.nome, nome, data);
  }
});

test("Consciência Negra só é nacional a partir de 2024", () => {
  // Lei 14.759/2023. A escala de 2023 não pode ganhar um feriado que não
  // existia quando ela foi montada.
  assert.equal(feriadosDoAno(2023).get("2023-11-20"), undefined);
  assert.equal(feriadosDoAno(2024).get("2024-11-20")?.nome, "Consciência Negra");
});

test("feriadosDoMes devolve só o mês pedido", () => {
  const dez = feriadosDoMes("2026-12");
  assert.equal(dez.get("2026-12-25")?.nome, "Natal");
  assert.equal(dez.get("2026-01-01"), undefined);
  assert.equal(dez.size, 1);

  const fev = feriadosDoMes("2026-02");
  assert.equal(fev.size, 2);
  assert.equal(fev.get("2026-02-16")?.nome, "Carnaval");
});

test("mês inválido não quebra a escala", () => {
  // O calendário chama isto a cada troca de mês. Devolver vazio é melhor do
  // que derrubar a tela por causa de uma data mal formada.
  assert.equal(feriadosDoMes("").size, 0);
  assert.equal(feriadosDoMes("abc-de").size, 0);
  assert.equal(feriadosDoMes("0001-01").size, 0);
});
