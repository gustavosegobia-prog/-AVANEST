import test from "node:test";
import assert from "node:assert/strict";
import { lerEvento, primeiroVencimento } from "./asaas.ts";

const ORG = "bd14bf31-0f5d-4d41-b5ec-5b8feab89eda";

function aviso(evento: string, pagamento: Record<string, unknown> = {}) {
  return {
    id: "evt_1",
    event: evento,
    payment: { id: "pay_123", value: 89.9, subscription: "sub_9", customer: "cus_7", ...pagamento },
  };
}

test("PAYMENT_CONFIRMED libera o acesso e compra um mês", () => {
  const evento = lerEvento(aviso("PAYMENT_CONFIRMED", { externalReference: ORG }));
  assert.equal(evento?.status, "approved");
  assert.equal(evento?.meses, 1);
  assert.equal(evento?.valor, 89.9);
  assert.equal(evento?.institutionId, ORG);
  assert.equal(evento?.assinaturaId, "sub_9");
  assert.equal(evento?.clienteId, "cus_7");
});

test("PAYMENT_RECEIVED também aprova, para o caso de vir sozinho", () => {
  assert.equal(lerEvento(aviso("PAYMENT_RECEIVED"))?.status, "approved");
});

test("confirmar e receber o MESMO pagamento não compram dois meses", () => {
  // Este é o teste que importa. No cartão, o mesmo pagamento gera
  // PAYMENT_CONFIRMED hoje e PAYMENT_RECEIVED 32 dias depois. Com uma chave
  // por evento, o segundo renderia um mês de acesso que ninguém pagou. Chave
  // compartilhada: o primeiro credita, o segundo esbarra no unique do banco.
  const confirmado = lerEvento(aviso("PAYMENT_CONFIRMED"))?.idUnico;
  const recebido = lerEvento(aviso("PAYMENT_RECEIVED"))?.idUnico;
  assert.equal(confirmado, recebido);
  assert.equal(confirmado, "asaas:pago:pay_123");
});

test("estornar um pagamento aprovado é fato novo, não repetição", () => {
  // Se o estorno herdasse a chave do pagamento, ele seria engolido como
  // duplicata e o acesso continuaria de pé com o dinheiro devolvido.
  assert.notEqual(
    lerEvento(aviso("PAYMENT_CONFIRMED"))?.idUnico,
    lerEvento(aviso("PAYMENT_REFUNDED"))?.idUnico,
  );
});

test("o mesmo aviso reenviado tem a mesma chave", () => {
  assert.equal(
    lerEvento(aviso("PAYMENT_CONFIRMED", { externalReference: ORG }))?.idUnico,
    lerEvento(aviso("PAYMENT_CONFIRMED", { externalReference: ORG }))?.idUnico,
  );
});

test("estorno e chargeback cortam; atraso apenas suspende", () => {
  assert.equal(lerEvento(aviso("PAYMENT_REFUNDED"))?.status, "cancelled");
  assert.equal(lerEvento(aviso("PAYMENT_CHARGEBACK_REQUESTED"))?.status, "cancelled");
  assert.equal(lerEvento(aviso("PAYMENT_OVERDUE"))?.status, "paused");
  // Suspender não compra nem devolve mês: o acesso vai até a data já paga.
  assert.equal(lerEvento(aviso("PAYMENT_OVERDUE"))?.meses, 0);
});

test("evento que não move dinheiro é registrado, não ignorado", () => {
  // Registrar tudo é o que deixa reconstruir a história quando um cliente
  // reclama. O que ele não pode é mexer na validade.
  const evento = lerEvento(aviso("PAYMENT_BANK_SLIP_VIEWED"));
  assert.equal(evento?.status, "outro");
  assert.equal(evento?.meses, 0);
});

test("externalReference que não é UUID não vira id de organização", () => {
  // O campo vem de fora. Se alguém puser texto livre ali, não pode virar
  // consulta ao banco com valor inventado.
  assert.equal(lerEvento(aviso("PAYMENT_CONFIRMED", { externalReference: "pedido-42" }))?.institutionId, null);
  assert.equal(lerEvento(aviso("PAYMENT_CONFIRMED", { externalReference: null }))?.institutionId, null);
});

test("aviso sem evento ou sem pagamento é descartado", () => {
  assert.equal(lerEvento(null), null);
  assert.equal(lerEvento({ event: "PAYMENT_CONFIRMED" }), null);
  assert.equal(lerEvento({ payment: { id: "pay_1" } }), null);
});

test("o primeiro vencimento é amanhã, nunca hoje", () => {
  // Hoje nasceria vencida se o cliente terminasse o checkout depois do corte.
  assert.equal(primeiroVencimento(new Date("2026-08-19T12:00:00Z")), "2026-08-20");
  // Virada de mês e de ano continuam certas.
  assert.equal(primeiroVencimento(new Date("2026-08-31T12:00:00Z")), "2026-09-01");
  assert.equal(primeiroVencimento(new Date("2026-12-31T12:00:00Z")), "2027-01-01");
});

test("o vencimento é calculado no fuso de Brasília, não em UTC", () => {
  // 19/08 às 02:00 UTC ainda é dia 18 em São Paulo (UTC-3). Em UTC a resposta
  // seria 20/08; a certa é 19/08 — um dia a mais de graça para o cliente, e
  // uma cobrança que nasce válida.
  assert.equal(primeiroVencimento(new Date("2026-08-19T02:00:00Z")), "2026-08-19");
});
