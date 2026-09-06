import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { migalhas, ofertaDosPlanos } from "./schema.ts";

const plano = (extra: Partial<Parameters<typeof ofertaDosPlanos>[0][number]> = {}) => ({
  codigo: "solo", nome: "Solo", descricao: "Para quem trabalha sozinho",
  preco_mensal: 129, preco_por_profissional: null, sob_consulta: false, ...extra,
});

test("a oferta traz preço, moeda e validade de cada plano", () => {
  // Sem `Offer`, o Google não tem de onde tirar a faixa de preço e a página
  // fica fora do resultado rico — que é onde a comparação acontece antes do
  // clique.
  const oferta = ofertaDosPlanos([
    plano(),
    plano({ codigo: "grupo3", nome: "Grupo 3", preco_mensal: 1049 }),
  ], "2026-12-31")!;
  assert.equal(oferta["@type"], "Service");
  assert.equal(oferta.offers.length, 2);
  assert.deepEqual(oferta.offers.map((o) => o.price), ["129", "1049"]);
  for (const o of oferta.offers) {
    assert.equal(o.priceCurrency, "BRL");
    // O Google recusa oferta com preço e sem validade.
    assert.equal(o.priceValidUntil, "2026-12-31");
  }
});

test("o plano sob consulta fica de fora", () => {
  // `Offer` sem `price` é marcação inválida, e inventar um valor para o plano
  // que não tem preço público seria anunciar número que ninguém combinou.
  const oferta = ofertaDosPlanos([
    plano(),
    plano({ codigo: "enterprise", nome: "Sob consulta", sob_consulta: true, preco_mensal: null }),
  ], "2026-12-31")!;
  assert.equal(oferta.offers.length, 1);
  assert.equal(oferta.offers[0].name, "Solo");
});

test("plano cobrado por profissional entra pelo preço de entrada", () => {
  const oferta = ofertaDosPlanos(
    [plano({ preco_mensal: null, preco_por_profissional: 89 })], "2026-12-31")!;
  assert.equal(oferta.offers[0].price, "89");
});

test("sem nenhum plano com preço, não sai marcação", () => {
  // Um `Service` com `offers: []` é pior do que nenhum: declara oferta e não
  // entrega nenhuma.
  assert.equal(ofertaDosPlanos([], "2026-12-31"), null);
  assert.equal(ofertaDosPlanos([plano({ sob_consulta: true })], "2026-12-31"), null);
});

test("nenhum preço é escrito à mão no código da página", () => {
  // Preço muda na tela administrativa. Uma segunda cópia no código viraria um
  // preço no schema e outro na tela no dia da primeira alteração — e o Google
  // mostraria o antigo.
  const pagina = fs.readFileSync(new URL("../app/planos/page.tsx", import.meta.url), "utf8");
  assert.match(pagina, /ofertaDosPlanos\(planos,/,
    "a oferta tem de sair dos planos que a página buscou");
});

test("a trilha de migalhas inclui a própria página", () => {
  // O Google espera a trilha completa, com a folha inclusa: sem ela o resultado
  // mostra o caminho até o pai e para ali.
  const t = migalhas([{ nome: "Início", caminho: "/" }, { nome: "Planos", caminho: "/planos" }]);
  assert.equal(t.itemListElement.length, 2);
  assert.equal(t.itemListElement[1].name, "Planos");
  assert.equal(t.itemListElement[1].item, "https://www.avanest.com.br/planos");
});
