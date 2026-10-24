import test from "node:test";
import assert from "node:assert/strict";
import {
  TERMOS_VALEM_PARA_QUEM_JA_USAVA, VERSAO_DOS_TERMOS, dataPorExtenso, ipDaRequisicao,
  navegadorDaRequisicao, precisaAceitar,
} from "./termos.ts";

test("termos: a versão é uma data, e o prazo de quem já usava é 30 dias depois", () => {
  assert.match(VERSAO_DOS_TERMOS, /^\d{4}-\d{2}-\d{2}$/);
  const dias = (Date.parse(TERMOS_VALEM_PARA_QUEM_JA_USAVA) - Date.parse(VERSAO_DOS_TERMOS)) / 86_400_000;
  assert.equal(dias, 30);
});

test("termos: a data por extenso", () => {
  assert.equal(dataPorExtenso("2026-10-23"), "23 de outubro de 2026");
  assert.equal(dataPorExtenso("2026-11-01"), "1 de novembro de 2026");
  assert.equal(dataPorExtenso("não é data"), "não é data");
  assert.equal(dataPorExtenso("2026-13-01"), "2026-13-01");
});

test("termos: só pede aceite a quem não aceitou a versão atual", () => {
  assert.equal(precisaAceitar([], "2026-10-23"), true);
  assert.equal(precisaAceitar(["2026-08-05", "2026-10-15"], "2026-10-23"), true);
  assert.equal(precisaAceitar(["2026-08-05", "2026-10-23"], "2026-10-23"), false);
});

test("termos: o IP de quem aceitou vem do primeiro endereço encaminhado", () => {
  assert.equal(ipDaRequisicao(new Headers({ "x-forwarded-for": "177.10.20.30, 10.0.0.1" })), "177.10.20.30");
  assert.equal(ipDaRequisicao(new Headers({ "x-real-ip": "2804:14c::1" })), "2804:14c::1");
  assert.equal(ipDaRequisicao(new Headers({ "x-forwarded-for": "<script>" })), null);
  assert.equal(ipDaRequisicao(new Headers()), null);
});

test("termos: o navegador é guardado cortado", () => {
  assert.equal(navegadorDaRequisicao(new Headers({ "user-agent": "x".repeat(500) }))?.length, 300);
  assert.equal(navegadorDaRequisicao(new Headers()), null);
});

test("termos: cadastro, pagamento e as páginas usam a mesma versão", async () => {
  const fs = await import("node:fs");
  const ler = (f: string) => fs.readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
  // O cadastro manda a versão no metadado da conta; o banco a grava como prova.
  assert.match(ler("app/criar-conta/sign-up-form.tsx"), /termos_versao: VERSAO_DOS_TERMOS/);
  // O pagamento carimba a organização e a pessoa com a mesma versão.
  assert.match(ler("app/api/assinatura/checkout/route.ts"), /p_versao: VERSAO_DOS_TERMOS/);
  // A vigência das páginas sai da versão, e não de uma data escrita à mão.
  for (const pagina of ["app/termos/page.tsx", "app/privacidade/page.tsx"]) {
    assert.match(ler(pagina), /vigencia=\{dataPorExtenso\(VERSAO_DOS_TERMOS\)\}/, pagina);
  }
  assert.match(ler("app/termos/page.tsx"), /Propriedade intelectual e confidencialidade/);
});
