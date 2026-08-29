import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lerDinheiro } from "./dinheiro.ts";

describe("ler o dinheiro que a recepção digitou", () => {
  it("aceita o formato brasileiro completo", () => {
    assert.equal(lerDinheiro("1.100,00"), 1100);
    assert.equal(lerDinheiro("1.234.567,89"), 1234567.89);
  });

  it("aceita o número seco", () => {
    assert.equal(lerDinheiro("1100"), 1100);
    assert.equal(lerDinheiro("350"), 350);
  });

  it("aceita com R$ e espaço, que é como se copia de um WhatsApp", () => {
    assert.equal(lerDinheiro("R$ 1.100,00"), 1100);
    assert.equal(lerDinheiro(" 350 "), 350);
  });

  it("vírgula com uma casa é meio real, e não cinco centavos", () => {
    assert.equal(lerDinheiro("1100,5"), 1100.5);
  });

  it("PONTO SEGUIDO DE MILHAR é milhar, e não decimal", () => {
    // "1.100" digitado por brasileiro é mil e cem. Ler como 1,1 cobraria um
    // real e dez centavos por uma consulta de mil e cem.
    assert.equal(lerDinheiro("1.100"), 1100);
    assert.equal(lerDinheiro("12.500"), 12500);
  });

  it("PONTO COM DUAS CASAS NO FIM é decimal copiado de sistema em inglês", () => {
    // O caso oposto, e igualmente caro: tratar "1100.50" como milhar viraria
    // R$ 110.050,00 — cem vezes o valor.
    assert.equal(lerDinheiro("1100.50"), 1100.5);
    assert.equal(lerDinheiro("350.5"), 350.5);
  });

  it("vazio, lixo e negativo devolvem zero, e zero não lança nada", () => {
    // O zero é o que faz o cadastro seguir sem criar recebimento nenhum:
    // agenda-se particular que vai pagar depois.
    assert.equal(lerDinheiro(""), 0);
    assert.equal(lerDinheiro("abc"), 0);
    assert.equal(lerDinheiro(null), 0);
    assert.equal(lerDinheiro(undefined), 0);
    assert.equal(lerDinheiro("-500"), 500, "o sinal é descartado, não interpretado");
    assert.equal(lerDinheiro("0"), 0);
    assert.equal(lerDinheiro("0,00"), 0);
  });

  it("aceita número, para quem já tem o valor pronto", () => {
    assert.equal(lerDinheiro(1100), 1100);
    assert.equal(lerDinheiro(0), 0);
    assert.equal(lerDinheiro(-5), 0);
  });
});
