import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { autorEmSchema } from "./autoria.ts";
import { ID_DA_ORGANIZACAO, migalhas, ofertaDosPlanos, organizacao } from "./schema.ts";

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

test("a empresa é declarada com logo, CNPJ, contato e perfil social", () => {
  // O site falava de si em toda página e não dizia a máquina nenhuma QUEM o
  // opera. É o que alimenta o painel de conhecimento e o que liga a marca ao
  // CNPJ, ao Instagram e ao produto — sem isso são três coisas soltas que por
  // acaso usam a mesma palavra.
  const o = organizacao();
  assert.equal(o["@type"], "Organization");
  assert.equal(o.legalName, "G. Segobia Serviços Médicos Ltda.");
  assert.equal(o.taxID, "55.965.276/0001-04");
  assert.equal(o.logo.url, "https://www.avanest.com.br/icone512.png");
  assert.ok(o.logo.width >= 112 && o.logo.height >= 112,
    "o Google recusa logo abaixo de 112×112");
  assert.equal(o.contactPoint.email, "contato@avanest.com.br");
  assert.deepEqual(o.sameAs, ["https://www.instagram.com/useavanest/"]);
});

test("o CNPJ da marcação é o mesmo impresso no rodapé", () => {
  // Dois números diferentes para a mesma empresa é o defeito que ninguém
  // confere e que desmente justamente a identidade que a marcação declara.
  const cnpj = organizacao().taxID;
  for (const arquivo of ["../app/page.tsx", "../components/pagina-de-escore.tsx"]) {
    const texto = fs.readFileSync(new URL(arquivo, import.meta.url), "utf8");
    assert.ok(texto.includes(cnpj), `${arquivo} devia trazer o CNPJ ${cnpj}`);
  }
});

test("o logo apontado existe de verdade em /public", () => {
  // Logo que responde 404 é pior do que logo nenhum: o Google marca a
  // organização como tendo imagem inválida.
  const caminho = organizacao().logo.url.replace("https://www.avanest.com.br", "");
  assert.ok(fs.existsSync(new URL(`../public${caminho}`, import.meta.url)),
    `public${caminho} não existe`);
});

test("a empresa é citada por referência, e não copiada", () => {
  // Repetir o objeto na capa e na página de planos criaria três organizações
  // homônimas; no dia em que uma mudasse, o buscador ficaria com versões
  // conflitantes da mesma marca.
  assert.equal(organizacao()["@id"], ID_DA_ORGANIZACAO);
  const capa = fs.readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(capa, /provider: \{ "@id": ID_DA_ORGANIZACAO \}/);
  assert.doesNotMatch(capa, /addressLocality/,
    "o endereço da empresa só existe em lib/schema.ts");
});

test("a marcação da empresa sai em todas as páginas, não só na capa", () => {
  // O buscador costuma entrar por uma calculadora de escore sem passar pela
  // capa; declarar a empresa só lá deixaria a maior parte das visitas sem ela.
  const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
  assert.match(layout, /comoJson\(organizacao\(\)\)/);
});

test("a empresa aponta para o médico que assina o conteúdo clínico", () => {
  // Sem essa ligação, a autoria das calculadoras e a empresa parecem duas
  // entidades sem relação — e a credencial não sustenta a marca.
  assert.deepEqual(organizacao().founder, autorEmSchema());
});

test("as páginas legais têm descrição de tamanho aproveitável", () => {
  // Abaixo de ~100 caracteres o Google descarta a descrição e escreve a dele
  // com um pedaço qualquer do texto — num documento jurídico, o primeiro
  // parágrafo, que não convida ninguém a clicar. Acima de 160 ele corta.
  for (const arquivo of ["../app/termos/page.tsx", "../app/privacidade/page.tsx"]) {
    const texto = fs.readFileSync(new URL(arquivo, import.meta.url), "utf8");
    const achado = texto.match(/^\s*description: "(.+)",$/m);
    assert.ok(achado, `${arquivo} sem description`);
    const n = achado![1].length;
    assert.ok(n >= 100 && n <= 160, `${arquivo}: ${n} caracteres`);
  }
});
