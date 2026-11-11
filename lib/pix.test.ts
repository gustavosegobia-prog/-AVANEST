import test from "node:test";
import assert from "node:assert/strict";
import {
  codigoPix, crc16, FORMAS_DE_PAGAMENTO, mensagemDoPix, normalizarChave, rotuloDoPagamento, textoDoPix, txidDaConsulta,
} from "./pix.ts";

test("pix: o CRC do padrão (CRC16-CCITT, início 0xFFFF)", () => {
  // Valor de referência do CRC-16/CCITT-FALSE para "123456789".
  assert.equal(crc16("123456789"), "29B1");
});

test("pix: reproduz o exemplo oficial do manual do Banco Central", () => {
  // "Manual de Padrões para Iniciação do Pix", BR Code estático sem valor.
  assert.equal(
    codigoPix({ chave: "123e4567-e12b-12d1-a456-426655440000", nome: "Fulano de Tal", cidade: "BRASILIA" }),
    "00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D",
  );
});

test("pix: o código da consulta leva valor, nome e cidade sem acento, e o identificador", () => {
  const codigo = codigoPix({
    chave: "12345678000199", nome: "INOVANEST Anestesiologia Campo Mourão", cidade: "Campo Mourão",
    valor: 250, txid: txidDaConsulta("3f2a9c1e-0000-4000-8000-1234567890ab"),
  });
  assert.ok(codigo.includes("5406250.00"), "valor com duas casas");
  assert.ok(codigo.includes("5924INOVANEST Anestesiologia6012"), "nome cortado em 25, sem o espaço do fim");
  assert.ok(codigo.includes("6012Campo Mourao"), "cidade sem acento");
  assert.ok(codigo.includes("0525CONSULTA3F2A9C1E000040008"), "identificador de até 25, só letras e números");
  assert.equal(codigo.slice(-4), crc16(codigo.slice(0, -4)), "o CRC fecha o código");
});

test("pix: a chave do jeito que o Pix espera", () => {
  assert.deepEqual(normalizarChave("cnpj", "12.345.678/0001-99"), { ok: true, chave: "12345678000199" });
  assert.deepEqual(normalizarChave("cpf", "123.456.789-09"), { ok: true, chave: "12345678909" });
  assert.deepEqual(normalizarChave("celular", "(44) 99999-0000"), { ok: true, chave: "+5544999990000" });
  assert.deepEqual(normalizarChave("celular", "+55 44 99999-0000"), { ok: true, chave: "+5544999990000" });
  assert.deepEqual(normalizarChave("email", " Financeiro@Grupo.com.BR "), { ok: true, chave: "financeiro@grupo.com.br" });
  assert.equal(normalizarChave("cpf", "123").ok, false);
  assert.equal(normalizarChave("celular", "9999-0000").ok, false);
  assert.equal(normalizarChave("email", "sem-arroba").ok, false);
  assert.equal(normalizarChave("aleatoria", "abc").ok, false);
});

test("pix: texto sem acento e no tamanho do campo", () => {
  assert.equal(textoDoPix("São José dos Pinhais", 15), "Sao Jose dos Pi");
  assert.equal(textoDoPix("  Clínica  Ação & Cia ", 25), "Clinica Acao Cia");
});

test("pix: a mensagem do WhatsApp e o rótulo do pagamento na agenda", () => {
  const m = mensagemDoPix({ paciente: "MARIA DAS DORES", organizacao: "INOVANEST", valor: 250 });
  assert.match(m, /^Olá, Maria! Segue o Pix da sua consulta pré-anestésica com a \*INOVANEST\*\./);
  assert.match(m, /Valor: \*R\$\s250,00\*/);
  assert.doesNotMatch(m, /\*\*/, "negrito do WhatsApp com um asterisco");
  assert.match(rotuloDoPagamento("PIX", null, 250), /^Pago · Pix · R\$\s250,00$/);
  assert.match(rotuloDoPagamento("Cartão", "Débito", 180.5), /^Pago · Débito · R\$\s180,50$/);
  assert.deepEqual(FORMAS_DE_PAGAMENTO.map((f) => f.metodo), ["PIX", "Cartão", "Cartão", "Dinheiro", "Transferência"],
    "só formas que o banco aceita");
});
