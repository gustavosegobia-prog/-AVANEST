import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { COOKIE_LOCAL, COOKIE_LOCAL_MAX_AGE } from "./local-ativo.ts";
import { CHAVE_DO_TEMA } from "./tema.ts";
import { CHAVE_DO_CONSENTIMENTO, rotaAceitaAnuncios } from "./anuncios.ts";

// A Política de Cookies é um inventário: cada promessa dela tem de bater com o
// que o código grava de fato. Estes testes quebram quando os dois se separam.

const ler = (c: string) => fs.readFileSync(new URL(`../${c}`, import.meta.url), "utf8");
const politica = ler("app/cookies/page.tsx");

test("a política de cookies lista o que o sistema grava, com os nomes do código", () => {
  assert.ok(politica.includes(`nome: "${COOKIE_LOCAL}"`), COOKIE_LOCAL);
  assert.equal(COOKIE_LOCAL_MAX_AGE, 60 * 60 * 24 * 30, "a política diz 30 dias para o cookie do local");
  assert.ok(politica.includes(`nome: "${CHAVE_DO_TEMA}"`), CHAVE_DO_TEMA);
  assert.ok(politica.includes(`nome: "${CHAVE_DO_CONSENTIMENTO}"`), CHAVE_DO_CONSENTIMENTO);

  const fila = ler("lib/evolucao/fila.ts").match(/`(avanest:evolucao-fila:)\$\{/);
  assert.ok(fila && politica.includes(`nome: "${fila[1]}…"`), "a fila da ficha");

  const tutorial = ler("lib/tutorial.ts").match(/CHAVE_TUTORIAL = "([^"]+)"/);
  assert.ok(tutorial && politica.includes(tutorial[1]), "o tutorial");

  const deposito = ler("public/sw.js").match(/const DEPOSITO = "([^"]+)"/);
  assert.ok(deposito && politica.includes(`nome: "${deposito[1]}"`), "o cache do service worker");
});

test("a política de cookies tem o painel de escolha e é página pública", () => {
  assert.match(politica, /<h2 id="preferencias">/);
  assert.match(politica, /<PreferenciasDeCookies \/>/);
  assert.equal(rotaAceitaAnuncios("/cookies"), true);
  assert.match(ler("app/sitemap.ts"), /caminho: "\/cookies"/);
  assert.match(ler("components/rodape-publico.tsx"), /href="\/cookies"/);
  assert.match(ler("components/pagina-legal.tsx"), /href="\/cookies"/);
});

test("o aviso de cookies: recusar pesa o mesmo que aceitar, e leva à política", () => {
  const aviso = ler("components/medicao-de-anuncios.tsx");
  assert.match(aviso, /<a href="\/cookies">Política de Cookies<\/a>/);
  // Os dois botões sem classe própria: o mesmo desenho para os dois.
  assert.match(aviso, /<button type="button" onClick=\{\(\) => guardar\("recusado"\)\}>Recusar<\/button>/);
  assert.match(aviso, /<button type="button" onClick=\{\(\) => guardar\("aceito"\)\}>Aceitar<\/button>/);
  assert.doesNotMatch(ler("app/globals.css"), /\.avisoCookiesAceitar/);
});

test("o aceite vale só para medir: sem remarketing, sem Analytics", () => {
  const aviso = ler("components/medicao-de-anuncios.tsx");
  assert.match(aviso, /ad_personalization: "denied"/);
  assert.match(aviso, /analytics_storage: "denied"/);
  assert.match(aviso, /allow_google_signals: false/);
});

test("retirar o consentimento apaga os cookies do Google do nosso domínio", () => {
  const aviso = ler("components/medicao-de-anuncios.tsx");
  assert.match(aviso, /function apagarCookiesDoGoogle\(\)/);
  assert.match(aviso, /\^_\(gcl\|ga\|gid\|gac\)/);
});

test("a fonte do site vem do próprio domínio, sem avisar o Google a cada página", () => {
  const layout = ler("app/layout.tsx");
  assert.doesNotMatch(layout, /fonts\.googleapis\.com|fonts\.gstatic\.com/);
  assert.match(layout, /href="\/fontes\/outfit-latin-v15\.woff2"/);
  const css = ler("app/globals.css");
  for (const arquivo of ["outfit-latin-v15.woff2", "outfit-latin-ext-v15.woff2"]) {
    assert.ok(css.includes(`url(/fontes/${arquivo})`), arquivo);
    assert.ok(fs.existsSync(new URL(`../public/fontes/${arquivo}`, import.meta.url)), arquivo);
  }
});
