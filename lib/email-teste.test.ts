import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MARCA_TESTE, emailDeTeste } from "./email-teste.ts";
import { boasVindas } from "./email-boas-vindas.ts";
import { hoje, somarDias } from "./data-local.ts";

const base = { nome: "Dr. Gustavo", organizacao: "INOVANEST", plano: "Solo", valorMensal: 129 };

describe("o e-mail de teste", () => {
  it("o CORPO é idêntico ao que o cliente recebe", () => {
    // Um teste que manda outra mensagem não testa a mensagem. Se o corpo
    // divergir, o botão vira teatro: prova que o provedor entrega, e não que
    // o cliente vai ler a coisa certa.
    const teste = emailDeTeste(base);
    const real = boasVindas({ ...base, primeiraCobranca: somarDias(hoje(), 30) });
    assert.equal(teste.texto, real.texto);
    assert.equal(teste.html, real.html);
  });

  it("mas o assunto avisa que é teste", () => {
    const teste = emailDeTeste(base);
    assert.ok(teste.assunto.startsWith(MARCA_TESTE), teste.assunto);
    // E o assunto de verdade continua legível logo depois da marca.
    assert.match(teste.assunto, /INOVANEST/);
  });

  it("a data de cobrança é do fuso de São Paulo, não de Greenwich", () => {
    // O mesmo defeito que marcava o dia seguinte às 21h. Aqui apareceria como
    // uma data um dia à frente — e o teste existe justamente para conferir
    // que o texto sai certo.
    const teste = emailDeTeste(base);
    const esperado = somarDias(hoje(), 30).split("-").reverse().join("/");
    assert.ok(teste.texto.includes(esperado), `esperava ${esperado} em: ${teste.texto}`);
  });

  it("mostra o cupom quando há um", () => {
    const m = emailDeTeste({ ...base, valorMensal: 103.2, cupom: "HACKANESTESIA" });
    assert.match(m.texto, /Cupom HACKANESTESIA/);
    assert.match(m.texto, /103,20/);
  });
});
