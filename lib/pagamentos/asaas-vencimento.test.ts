import { strict as assert } from "node:assert";
import { test } from "node:test";
import { primeiroVencimento } from "./asaas.ts";

// As datas são construídas em UTC de propósito. O Asaas recebe a data já
// formatada no fuso de Brasília, e é isso que estes testes conferem.

test("sem campanha, vence amanhã", () => {
  assert.equal(primeiroVencimento(new Date("2026-09-10T12:00:00Z")), "2026-09-11");
});

test("dois meses grátis empurram o vencimento dois meses", () => {
  assert.equal(primeiroVencimento(new Date("2026-09-10T12:00:00Z"), 2), "2026-11-11");
});

test("um mês grátis", () => {
  assert.equal(primeiroVencimento(new Date("2026-09-10T12:00:00Z"), 1), "2026-10-11");
});

test("vira o ano sem se perder", () => {
  assert.equal(primeiroVencimento(new Date("2026-11-20T12:00:00Z"), 2), "2027-01-21");
});

test("dia 31 não transborda para o mês seguinte", () => {
  // 30/08 + 1 dia = 31/08. Somar 1 mês a 31/08 daria 31/09, que não existe —
  // e o JavaScript resolveria isso virando 01/10, cobrando um dia depois do
  // combinado. O vencimento tem de cair no último dia de setembro.
  assert.equal(primeiroVencimento(new Date("2026-08-30T12:00:00Z"), 1), "2026-09-30");
});

test("31 de dezembro com dois meses cai no fim de fevereiro", () => {
  // 30/12 + 1 dia = 31/12; +2 meses seria 31/02, que não existe.
  assert.equal(primeiroVencimento(new Date("2026-12-30T12:00:00Z"), 2), "2027-02-28");
});

test("ano bissexto tem 29 de fevereiro", () => {
  assert.equal(primeiroVencimento(new Date("2027-12-30T12:00:00Z"), 2), "2028-02-29");
});

test("valores inválidos não adiam a cobrança", () => {
  // Zero, negativo, quebrado ou NaN têm de cair no comportamento sem campanha.
  // Um mês grátis concedido por engano é receita perdida sem ninguém decidir.
  const dia = new Date("2026-09-10T12:00:00Z");
  assert.equal(primeiroVencimento(dia, 0), "2026-09-11");
  assert.equal(primeiroVencimento(dia, -3), "2026-09-11");
  assert.equal(primeiroVencimento(dia, Number.NaN), "2026-09-11");
  assert.equal(primeiroVencimento(dia, 1.9), "2026-10-11");
});
