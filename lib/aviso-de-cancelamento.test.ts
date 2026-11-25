import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { emailDeCancelamento, oQueFazer, type Cancelamento } from "./aviso-de-cancelamento.ts";

const base: Cancelamento = {
  organizacao: "Grupo Fictício", plano: "ativo", quem: { nome: "Dra. Teste", email: "teste@exemplo.com" },
  motivo: "ficou caro", acessoAte: "2026-12-19T12:00:00Z", emTeste: false, reembolsoDevido: false,
  ultimoPagamento: 129, cobrancaEncerrada: true,
};

test("dentro do prazo: devolver, com o valor, e o assunto avisa", () => {
  const c = { ...base, reembolsoDevido: true };
  assert.match(oQueFazer(c), /^Devolver R\$\s?129,00 pelo Stripe/);
  assert.match(emailDeCancelamento(c).assunto, /^\[DEVOLVER\] Cancelamento: Grupo Fictício$/);
});

test("no período grátis: nada a fazer", () => {
  assert.equal(oQueFazer({ ...base, emTeste: true }), "Nada a fazer: cancelou no período grátis, nada foi cobrado.");
});

test("cobrança que não encerrou sozinha vira tarefa", () => {
  assert.match(oQueFazer({ ...base, cobrancaEncerrada: false }), /Encerrar a cobrança recorrente à mão no Stripe/);
});

test("o e-mail traz quem, até quando e o motivo", () => {
  const { texto, html } = emailDeCancelamento(base);
  assert.match(texto, /Quem cancelou: Dra\. Teste \(teste@exemplo\.com\)/);
  assert.match(texto, /Acesso até: 19\/12\/2026/);
  assert.match(texto, /Motivo: ficou caro/);
  assert.doesNotMatch(html, /<script/);
  assert.match(emailDeCancelamento({ ...base, motivo: "<b>x</b>" }).html, /&lt;b&gt;x&lt;\/b&gt;/);
});

test("a rota avisa o dono depois de cancelar, e a tela fala do período grátis", () => {
  const rota = fs.readFileSync(new URL("../app/api/assinatura/cancelar/route.ts", import.meta.url), "utf8");
  assert.match(rota, /emailDeCancelamento\(/);
  assert.match(rota, /\.eq\("super_admin", true\)/);
  const tela = fs.readFileSync(new URL("../app/dashboard/dashboard-client.tsx", import.meta.url), "utf8");
  assert.match(tela, /Você está no período grátis/);
  assert.match(tela, /Cancelado no período grátis: nada foi cobrado e nada será\./);
});

test("o relatório do dia repete os cancelamentos, no alto e com o que fazer", async () => {
  const { montarRelatorio, textoDoRelatorio, assuntoDoRelatorio } = await import("./relatorio-diario.ts");
  const r = montarRelatorio([], new Date("2026-11-25T12:00:00Z"), {
    cancelamentos: [{ organizacao: "Grupo Fictício", canceladaEm: "2026-11-25T10:00:00Z", reembolsoDevido: true, motivo: null, acessoAte: "2026-12-19T12:00:00Z" }],
  });
  assert.match(assuntoDoRelatorio(r), /1 cancelamento/);
  const texto = textoDoRelatorio(r);
  assert.match(texto, /CANCELAMENTOS \(24h\)\n {2}· \[DEVOLVER\] Grupo Fictício — cancelou em 25\/11\/2026 · acesso até 19\/12\/2026 · motivo: não informado/);
  assert.ok(texto.indexOf("CANCELAMENTOS") < (texto.indexOf("ASSINANTES") === -1 ? Infinity : texto.indexOf("ASSINANTES")));
});
