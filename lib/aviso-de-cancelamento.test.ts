import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { emailDeCancelamento, oQueFazer, type Cancelamento } from "./aviso-de-cancelamento.ts";

const base: Cancelamento = {
  organizacao: "Grupo Fictício", plano: "ativo", quem: { nome: "Dra. Teste", email: "teste@exemplo.com" },
  motivo: "ficou caro", acessoAte: "2026-12-19T12:00:00Z", emTeste: false,
  ultimoPagamento: 129, cobrancaEncerrada: true,
};

// Regra de 25/11/2026: cancelar suspende as próximas cobranças, sem devolução.
test("assinatura paga: nada a fazer, e nada manda devolver", () => {
  assert.equal(oQueFazer(base), "Nada a fazer: a próxima cobrança já foi suspensa, e o que foi pago não se devolve.");
  const { assunto, texto } = emailDeCancelamento(base);
  assert.equal(assunto, "Cancelamento: Grupo Fictício");
  assert.match(texto, /Último pagamento: R\$\s?129,00/);
  assert.doesNotMatch(texto, /Devolver|DEVOLVER/);
});

test("no período grátis: nada a fazer", () => {
  assert.equal(oQueFazer({ ...base, emTeste: true }), "Nada a fazer: cancelou no período grátis, o cartão não será cobrado.");
  assert.doesNotMatch(emailDeCancelamento({ ...base, emTeste: true }).texto, /Último pagamento/);
});

test("cobrança que não encerrou sozinha vira tarefa, e o assunto avisa", () => {
  const c = { ...base, cobrancaEncerrada: false };
  assert.match(oQueFazer(c), /Encerrar a cobrança recorrente à mão no Stripe/);
  assert.equal(emailDeCancelamento(c).assunto, "[ENCERRAR NO STRIPE] Cancelamento: Grupo Fictício");
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
  // A tela, os Termos e a página de planos não prometem devolução.
  assert.match(tela, /o valor já pago não é devolvido/);
  assert.doesNotMatch(tela, /será devolvido|(?<!não )é devolvido|prazo_de_reembolso|reembolso_devido/);
  assert.doesNotMatch(rota, /reembolso/i);
  const termos = fs.readFileSync(new URL("../app/termos/page.tsx", import.meta.url), "utf8").replace(/\s+/g, " ");
  assert.match(termos, /o valor já pago <b>não é devolvido<\/b>/);
  assert.doesNotMatch(termos, /14 dias/);
  const planos = fs.readFileSync(new URL("../app/planos/page.tsx", import.meta.url), "utf8");
  assert.match(planos, /o valor já pago não é devolvido/);
  assert.doesNotMatch(planos, /é devolvido pela mesma forma/);
});

test("o relatório do dia repete os cancelamentos, no alto e com o que fazer", async () => {
  const { montarRelatorio, textoDoRelatorio, assuntoDoRelatorio } = await import("./relatorio-diario.ts");
  const r = montarRelatorio([], new Date("2026-11-25T12:00:00Z"), {
    cancelamentos: [{ organizacao: "Grupo Fictício", canceladaEm: "2026-11-25T10:00:00Z", motivo: null, acessoAte: "2026-12-19T12:00:00Z" }],
  });
  assert.match(assuntoDoRelatorio(r), /1 cancelamento/);
  const texto = textoDoRelatorio(r);
  assert.match(texto, /CANCELAMENTOS \(24h\)\n {2}· Grupo Fictício — cancelou em 25\/11\/2026 · acesso até 19\/12\/2026 · motivo: não informado/);
  assert.ok(texto.indexOf("CANCELAMENTOS") < (texto.indexOf("ASSINANTES") === -1 ? Infinity : texto.indexOf("ASSINANTES")));
});
