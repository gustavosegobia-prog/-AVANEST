import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { comDesconto, descreverCupom, normalizarCupom, porQuantoTempo, quantoAbate, type Cupom } from "./cupom.ts";

const hack: Cupom = {
  id: "promo_123",
  codigo: "HACKANESTESIA",
  percentual: 20,
  valorFixo: null,
  duracao: "forever",
  meses: null,
};

describe("o código que a pessoa digita", () => {
  it("aceita minúscula, espaço sobrando e espaço colado do meio", () => {
    // Cupom vem de flyer, de story do Instagram e de mensagem colada. Recusar
    // "hackanestesia " por causa de um espaço é perder a venda na digitação.
    for (const digitado of [" hackanestesia ", "HackAnestesia", "HACK ANESTESIA", "\thackanestesia\n"]) {
      assert.equal(normalizarCupom(digitado), "HACKANESTESIA", `falhou com ${JSON.stringify(digitado)}`);
    }
  });

  it("vazio continua vazio, e nada explode", () => {
    for (const nada of ["", "   ", null, undefined]) assert.equal(normalizarCupom(nada), "");
  });

  it("não deixa passar um texto gigante para a API do Stripe", () => {
    assert.equal(normalizarCupom("A".repeat(500)).length, 60);
  });
});

describe("quanto fica a mensalidade", () => {
  it("20% de 129 é 103,20", () => {
    assert.equal(comDesconto(129, hack), 103.2);
  });

  it("a conta é em centavos, e bate com a do Stripe", () => {
    // 199 * 0,8 dá 159.20000000000002 em ponto flutuante. Um centavo de
    // diferença entre a tela e a fatura é uma pergunta que alguém vai fazer.
    assert.equal(comDesconto(199, hack), 159.2);
    assert.equal(comDesconto(89.9, hack), 71.92);
  });

  it("desconto em reais também", () => {
    const vinteCinco: Cupom = { ...hack, percentual: null, valorFixo: 25 };
    assert.equal(comDesconto(129, vinteCinco), 104);
  });

  it("cupom maior que o plano zera a fatura, não devolve dinheiro", () => {
    const exagerado: Cupom = { ...hack, percentual: null, valorFixo: 500 };
    assert.equal(comDesconto(129, exagerado), 0);
  });

  it("sem cupom, o preço é o preço", () => {
    assert.equal(comDesconto(129, null), 129);
  });
});

describe("o que o cliente lê", () => {
  it("diz o abatimento, o valor final e por quanto tempo", () => {
    const frase = descreverCupom(129, hack);
    assert.match(frase, /20%/);
    assert.match(frase, /103,20/);
    assert.match(frase, /enquanto a assinatura seguir ativa/);
  });

  it("A DURAÇÃO NUNCA FICA IMPLÍCITA", () => {
    // "20% de desconto" sem dizer até quando é a origem da reclamação do
    // quarto mês: a pessoa entendeu "sempre", o cupom valia uma vez só.
    const uma: Cupom = { ...hack, duracao: "once", meses: null };
    const tres: Cupom = { ...hack, duracao: "repeating", meses: 3 };
    const umMes: Cupom = { ...hack, duracao: "repeating", meses: 1 };
    assert.equal(porQuantoTempo(uma), "no primeiro mês");
    assert.equal(porQuantoTempo(tres), "nos 3 primeiros meses");
    assert.equal(porQuantoTempo(umMes), "no primeiro mês", "'nos 1 primeiros meses' não é português");
    for (const c of [uma, tres, umMes, hack]) {
      assert.ok(descreverCupom(129, c).length > 20, "toda duração precisa virar frase");
    }
  });

  it("o abatimento em reais sai formatado, não cru", () => {
    // O espaço entre "R$" e o número é NÃO SEPARÁVEL (U+00A0) — é assim que o
    // pt-BR formata, e comparar com um espaço comum reprova o código certo.
    assert.match(quantoAbate({ ...hack, percentual: null, valorFixo: 25 }), /^R\$\s25,00$/);
  });
});
