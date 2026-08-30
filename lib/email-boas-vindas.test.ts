import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { boasVindas } from "./email-boas-vindas.ts";

const base = {
  nome: "Dr. GUSTAVO SEGOBIA DA SILVA",
  organizacao: "INOVANEST — Serviço de Anestesiologia",
  plano: "Solo",
  valorMensal: 129,
  primeiraCobranca: "2026-10-29",
};

describe("o que o cliente lê depois de pagar", () => {
  it("diz o que foi contratado e para quem", () => {
    const m = boasVindas(base);
    assert.match(m.texto, /plano Solo/);
    assert.match(m.texto, /INOVANEST/);
    assert.match(m.assunto, /INOVANEST/);
  });

  it("A DATA DA PRIMEIRA COBRANÇA aparece, em português", () => {
    // Período grátis sem data escrita é origem de contestação de cartão: a
    // pessoa esquece, vê o débito dois meses depois e abre disputa.
    const m = boasVindas(base);
    assert.match(m.texto, /29\/10\/2026/);
    assert.match(m.html, /29\/10\/2026/);
  });

  it("e o valor, com vírgula decimal", () => {
    assert.match(boasVindas(base).texto, /R\$\s?129,00/);
  });

  it("sem período grátis, cobra a partir de agora e não inventa data", () => {
    const m = boasVindas({ ...base, primeiraCobranca: null });
    assert.match(m.texto, /a partir de agora/);
    assert.equal(/\d{2}\/\d{2}\/\d{4}/.test(m.texto), false, "não pode aparecer data nenhuma");
  });

  it("HTML e texto contam a MESMA história sobre dinheiro", () => {
    // Divergir aqui seria o pior lugar possível: metade dos clientes lê um, a
    // outra metade lê o outro, e os dois falam de cobrança.
    const m = boasVindas(base);
    for (const pedaco of ["29/10/2026", "129,00", "Solo"]) {
      assert.ok(m.texto.includes(pedaco), `falta "${pedaco}" no texto`);
      assert.ok(m.html.includes(pedaco), `falta "${pedaco}" no HTML`);
    }
  });

  it("diz por onde entrar", () => {
    const m = boasVindas(base);
    assert.match(m.texto, /avanest\.com\.br/);
    assert.match(m.html, /href="https:\/\/www\.avanest\.com\.br\/login"/);
  });

  it("diz como cancelar, e que dá para fazer sozinho", () => {
    // Quem sabe que pode sair sem ligar para ninguém contesta menos no cartão.
    const m = boasVindas(base);
    assert.match(m.texto, /cancelar quando quiser/);
    assert.match(m.texto, /Admin → Assinatura/);
  });
});

describe("o cumprimento", () => {
  it("usa o tratamento e o primeiro nome, sem gritar", () => {
    // O cadastro guarda "Dr. GUSTAVO SEGOBIA DA SILVA". "Olá, DR." seria pior
    // que não cumprimentar, e o nome inteiro em maiúsculas parece cobrança.
    assert.match(boasVindas(base).texto, /^Olá, Dr\. Gustavo\./);
  });

  it("sem tratamento, só o primeiro nome", () => {
    assert.match(boasVindas({ ...base, nome: "leticia graminha" }).texto, /^Olá, Leticia\./);
  });

  it("sem nome, cumprimenta assim mesmo", () => {
    for (const nome of ["", "   ", null, undefined]) {
      assert.match(boasVindas({ ...base, nome }).texto, /^Olá\./);
    }
  });

  it("só o tratamento não vira 'Olá, Dr. undefined'", () => {
    assert.match(boasVindas({ ...base, nome: "Dra." }).texto, /^Olá, Dra\.\./);
  });
});
