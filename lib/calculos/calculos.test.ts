/**
 * Testes da via aérea pediátrica (tubo e profundidade), que a avaliação
 * pré-anestésica e a ficha usam. Rodam com o executor embutido do Node, sem
 * dependência nova no projeto:
 *
 *   npm test
 *
 * Os casos são de bancada, com valores conferíveis à mão. A ideia não é cobrir
 * toda combinação possível, e sim travar o comportamento das contas que
 * orientam conduta — se alguém mexer numa fórmula sem querer, isto acusa.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  calibreMaisProximo,
  ehPediatrico,
  idadeEmMeses,
  idadeEmMesesPorNascimento,
  IDADE_MAX_PEDIATRICA_ANOS,
  opcoesDeTubo,
  profundidadeOral,
  sugerirTubo,
  textoDoTubo,
} from "./via-aerea-pediatrica.ts";

describe("via aérea pediátrica — tamanho do tubo", () => {
  it("soma anos e meses", () => {
    assert.equal(idadeEmMeses({ idadeAnos: 2, idadeMeses: 6 }), 30);
  });

  it("4 anos: com cuff 4,5 e sem cuff 5,0", () => {
    const s = sugerirTubo({ idadeAnos: 4 });
    assert.equal(s?.origem, "fórmula da idade");
    assert.equal(s?.comCuff?.calculado, 4.5);
    assert.equal(s?.semCuff?.calculado, 5);
  });

  it("oferece a opção acima e a abaixo do calculado", () => {
    const s = sugerirTubo({ idadeAnos: 4 });
    assert.equal(s?.comCuff?.abaixo, 4);
    assert.equal(s?.comCuff?.acima, 5);
  });

  it("abaixo de 1 ano usa a tabela por peso, não a fórmula da idade", () => {
    const s = sugerirTubo({ idadeMeses: 1, pesoKg: 3.4 });
    assert.equal(s?.origem, "tabela por peso");
    assert.equal(s?.semCuff?.sugerido, 3.5);
  });

  it("prematuro de 900 g recebe 2,5 mm", () => {
    assert.equal(sugerirTubo({ idadeMeses: 0, pesoKg: 0.9 })?.semCuff?.sugerido, 2.5);
  });

  it("sem peso, abaixo de 1 ano avisa em vez de chutar", () => {
    const s = sugerirTubo({ idadeMeses: 2 });
    assert.match(s?.aviso ?? "", /peso/);
  });

  it("arredonda para calibre que existe", () => {
    assert.equal(calibreMaisProximo(4.3), 4.5);
    assert.equal(calibreMaisProximo(4.1), 4);
  });
});

describe("via aérea pediátrica — profundidade", () => {
  it("4 anos: 14 cm pela idade e 13,5 cm pelo tubo de 4,5", () => {
    const p = profundidadeOral({ idadeAnos: 4 }, 4.5);
    assert.equal(p?.pelaIdade, 14);
    assert.equal(p?.peloTubo, 13.5);
    assert.equal(p?.sugerida, "13,5–14 cm");
  });

  it("abaixo de 2 anos não aplica a fórmula da idade", () => {
    const p = profundidadeOral({ idadeMeses: 6 }, 3.5);
    assert.equal(p?.pelaIdade, undefined);
    assert.equal(p?.peloTubo, 10.5);
  });
});

describe("sugestão de tubo dentro da ficha pré-anestésica", () => {

it("idade em meses sai da data de nascimento, e não dos anos inteiros", () => {
  const hoje = new Date("2026-08-09T12:00:00");
  assert.equal(idadeEmMesesPorNascimento("2025-12-09", hoje), 8);
  assert.equal(idadeEmMesesPorNascimento("2020-08-09", hoje), 72);
  assert.equal(idadeEmMesesPorNascimento("2026-08-20", hoje), undefined, "nascimento no futuro");
  assert.equal(idadeEmMesesPorNascimento(null, hoje), undefined);
  assert.equal(idadeEmMesesPorNascimento("data ruim", hoje), undefined);
});

it("o corte pediátrico é do AVANEST e está isolado", () => {
  assert.equal(IDADE_MAX_PEDIATRICA_ANOS, 12);
  assert.equal(ehPediatrico(12 * 12), true);
  assert.equal(ehPediatrico(12 * 12 + 1), false);
  assert.equal(ehPediatrico(undefined), false);
});

it("a linha do tubo junta calibre e profundidade, com vírgula", () => {
  const crianca = { idadeAnos: 4, pesoKg: 16 };
  assert.equal(textoDoTubo(crianca, "comCuff"), "Tubo 4,5 com cuff · profundidade 13,5–14 cm");
  assert.equal(textoDoTubo(crianca, "semCuff"), "Tubo 5 sem cuff · profundidade 14–15 cm");
});

it("abaixo de 1 ano o calibre vem do peso, e só existe sem cuff", () => {
  const lactente = { idadeMeses: 8, pesoKg: 7 };
  const opcoes = opcoesDeTubo(lactente);
  assert.equal(opcoes.length, 1);
  assert.equal(opcoes[0].tipo, "semCuff");
  assert.match(opcoes[0].texto, /^Tubo 3,5 sem cuff/);
  assert.equal(textoDoTubo(lactente, "comCuff"), undefined);
});

it("a faixa da tabela neonatal sai como faixa, não como número único", () => {
  const recem = { idadeMeses: 1, pesoKg: 2.5 };
  assert.match(textoDoTubo(recem, "semCuff")!, /^Tubo 3–3,5 sem cuff/);
});

it("sem peso e sem idade não há opção nenhuma", () => {
  assert.deepEqual(opcoesDeTubo({}), []);
  assert.deepEqual(opcoesDeTubo({ pesoKg: 12 }).map((o) => o.tipo), ["semCuff"]);
});

it("criança maior traz as duas opções", () => {
  assert.deepEqual(opcoesDeTubo({ idadeAnos: 6 }).map((o) => o.tipo), ["comCuff", "semCuff"]);
});
});
